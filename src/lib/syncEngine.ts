import type { Row } from '../types'
import { decryptRow, encryptRow } from './syncCrypto'
import { TABLES } from './tables'

/** One row as the server holds it: scrambled `payload` (also for deletes), the change time and the deleted flag. */
export interface SyncRow {
  tbl: string
  id: string
  payload: string | null
  deleted: boolean
  updated_at: number
  seq?: number
}

/** The network failed (`offline`) or the server answered with an error (`server`). */
export class TransportError extends Error {
  kind: 'offline' | 'server'
  constructor(kind: 'offline' | 'server', message: string) {
    super(message)
    this.name = 'TransportError'
    this.kind = kind
  }
}

export interface Transport {
  push(household: string, rows: SyncRow[]): Promise<void>
  pull(household: string, after: number): Promise<SyncRow[]>
  ping(): Promise<void>
  subscribe(household: string, onChanged: () => void): () => void
  /** Tell the other phones something changed (optional, so simple fakes can leave it out). */
  notify?(household: string): void
}

export interface LocalStore {
  getAll(): Record<string, Row[]>
  /** Save rows that came from elsewhere. Must not be reported through onLocalChange. */
  apply(tables: Record<string, Row[]>): void
  onLocalChange(cb: (table: string, prev: Row[], next: Row[]) => void): () => void
}

export interface KV {
  get(key: string): string | null
  set(key: string, value: string): void
}

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'offline' | 'error'
  lastSyncedAt: number | null
  pending: number
  message?: string
}

export interface SyncResult {
  pushed: number
  pulled: number
  rejected: number
}

/** `u` change time, `d` deleted, `h` fingerprint of the row as last synced (to notice changes made behind our back). */
type MetaEntry = { u: number; d?: 1; h?: number }
type Meta = Record<string, Record<string, MetaEntry>>

const BATCH = 200
const PAGE = 1000 // the most rows the server returns in one pull
const MAX_PAYLOAD = 32_768 // matches the server's limit
const MAX_PUSH_BYTES = 900_000 // the server refuses a push larger than about 1.5 MB
const MAX_ID = 80
const MAX_TABLE = 40
const MAX_AHEAD = 30 * 24 * 3600 * 1000 * 1000 // a remote change time more than 30 days ahead of this phone's clock is not believed
const KEYS = { meta: 'lp.sync.meta', cursor: 'lp.sync.cursor', dirty: 'lp.sync.dirty', clock: 'lp.sync.clock', device: 'lp.sync.device' }
const KNOWN_TABLES: readonly string[] = TABLES

/** A short fingerprint of a row's JSON (FNV-1a), enough to tell "changed" from "not changed". */
function fingerprint(json: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** One row per id (the last one wins), in first-seen order: two rows with the same id would otherwise fight over one note forever. */
function uniqueById(rows: Row[]): Row[] {
  const byId = new Map<string, Row>()
  for (const r of rows) byId.set(r.id, r)
  return [...byId.values()]
}

function readJson<T>(kv: KV, key: string, fallback: T): T {
  try {
    const raw = kv.get(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export interface SyncEngineOptions {
  household: string
  key: CryptoKey
  local: LocalStore
  transport: Transport
  kv: KV
  now?: () => number
  /** 0-999, different on each phone, so two phones never stamp a change with the same time. Chosen once and remembered if left out. */
  device?: number
}

const NOTES_FULL = 'Could not save sync notes on this phone (its storage may be full).'

/**
 * Keeps one phone's rows and the shared copy in step. It remembers, per row, when it last changed and what the row
 * looked like then (`meta`), and which rows still have to be uploaded (`dirty`). It never sends a row it has just
 * received, and it re-checks the phone's rows against its notes at every sync, so edits it did not hear about
 * (another tab, or made before it started) are still found.
 */
export class SyncEngine {
  private meta: Meta
  private dirty = new Map<string, Set<string>>()
  private clock: number
  private cursor: number
  private device: number
  private off: (() => void) | null = null
  private stopped = false
  private listeners = new Set<(s: SyncStatus) => void>()
  private current: SyncStatus
  private inflight: Promise<SyncResult> | null = null
  private again = false
  private skipped = 0
  private notesError = false

  constructor(private opts: SyncEngineOptions) {
    this.meta = readJson<Meta>(opts.kv, KEYS.meta, {})
    for (const [table, ids] of Object.entries(readJson<Record<string, string[]>>(opts.kv, KEYS.dirty, {}))) this.dirty.set(table, new Set(ids))
    this.clock = Number(opts.kv.get(KEYS.clock)) || 0
    this.cursor = Number(opts.kv.get(KEYS.cursor)) || 0
    const saved = opts.kv.get(KEYS.device)
    this.device = opts.device ?? (saved !== null ? Number(saved) : Math.floor(Math.random() * 1000))
    if (saved === null || opts.device !== undefined) {
      try {
        opts.kv.set(KEYS.device, String(this.device))
      } catch {
        /* reported when the notes are saved */
      }
    }
    this.current = { state: 'idle', lastSyncedAt: null, pending: this.pendingCount() }
  }

  get status(): SyncStatus {
    return this.current
  }

  onStatus(cb: (s: SyncStatus) => void): () => void {
    this.listeners.add(cb)
    return () => void this.listeners.delete(cb)
  }

  start(): void {
    if (this.off || this.stopped) return
    this.off = this.opts.local.onLocalChange((table, prev, next) => this.onChange(table, prev, next))
    if (this.reconcile()) {
      this.persist()
      this.publish()
    }
  }

  /** After this the engine writes nothing more (not even for a sync that is already running). */
  stop(): void {
    this.stopped = true
    this.off?.()
    this.off = null
  }

  /** Mark every row this phone holds as waiting to upload (the first phone, when sharing starts). */
  markAllDirty(): void {
    for (const [table, rows] of Object.entries(this.opts.local.getAll())) for (const r of uniqueById(rows)) this.mark(table, r.id, false, JSON.stringify(r))
    this.persist()
    this.publish()
  }

  /** Upload what changed here, then fetch what changed elsewhere. Never throws; the outcome is in `status`. */
  syncNow(): Promise<SyncResult> {
    if (this.stopped) return Promise.resolve({ pushed: 0, pulled: 0, rejected: 0 })
    if (this.inflight) {
      this.again = true
      return this.inflight
    }
    this.inflight = this.run().finally(() => {
      this.inflight = null
    })
    return this.inflight
  }

  /** Make this phone match the shared copy exactly (joining). Refuses if the shared copy is empty: that is a mistyped code. */
  async replaceFromRemote(opts: { beforeApply?: (tables: Record<string, Row[]>) => Promise<void> } = {}): Promise<{ pulled: number }> {
    const tables: Record<string, Row[]> = Object.fromEntries(TABLES.map((t) => [t, [] as Row[]]))
    const meta: Meta = {}
    let cursor = 0
    let clock = this.clock
    let pulled = 0
    let unreadable = 0
    for (;;) {
      const page = await this.opts.transport.pull(this.opts.household, cursor)
      if (page.length === 0) break
      for (const r of page) {
        cursor = Math.max(cursor, r.seq ?? 0)
        const row = await this.open(r)
        if (row === undefined) {
          unreadable++
          continue
        }
        clock = Math.max(clock, r.updated_at)
        const entry: MetaEntry = r.deleted ? { u: r.updated_at, d: 1 } : { u: r.updated_at, h: fingerprint(JSON.stringify(row)) }
        ;(meta[r.tbl] ??= {})[r.id] = entry
        if (!r.deleted && row) {
          tables[r.tbl].push(row)
          pulled++
        }
      }
      if (page.length < PAGE) break
    }
    if (cursor === 0) throw new Error('No shared planner found for this code. Check the code, and make sure the first phone has been online.')
    if (unreadable > 0) {
      throw new Error(`${unreadable} item${unreadable === 1 ? '' : 's'} in the shared planner could not be read with this code. Nothing on this phone was changed. Check the code (and that the first phone's clock is right) and try again.`)
    }
    await opts.beforeApply?.(tables) // may refuse (it throws) before anything on this phone is touched
    if (this.stopped) return { pulled: 0 }
    this.opts.local.apply(tables)
    this.meta = meta
    this.dirty.clear()
    this.cursor = cursor
    this.clock = clock
    this.persist()
    this.setStatus({ state: 'idle', lastSyncedAt: this.now(), message: undefined })
    return { pulled }
  }

  // ----- internals -----

  private now(): number {
    return (this.opts.now ?? Date.now)()
  }

  /**
   * A change time: ms x 1000 plus this phone's own 0-999. Later than anything issued or seen so far even if this
   * phone's clock is behind, and never equal to another phone's stamp.
   */
  private stamp(): number {
    const base = Math.max(this.now() * 1000, this.clock + 1)
    let u = base - (base % 1000) + this.device
    if (u <= this.clock) u += 1000
    this.clock = u
    return u
  }

  private pendingCount(): number {
    let n = 0
    for (const ids of this.dirty.values()) n += ids.size
    return n
  }

  private setStatus(patch: Partial<SyncStatus>): void {
    this.current = { ...this.current, pending: this.pendingCount(), ...patch }
    this.listeners.forEach((l) => l(this.current))
  }

  private publish(): void {
    this.setStatus(this.notesError ? { state: 'error', message: NOTES_FULL } : {})
  }

  private persist(): void {
    if (this.stopped) return
    try {
      const dirty: Record<string, string[]> = {}
      for (const [table, ids] of this.dirty) if (ids.size > 0) dirty[table] = [...ids]
      this.opts.kv.set(KEYS.meta, JSON.stringify(this.meta))
      this.opts.kv.set(KEYS.dirty, JSON.stringify(dirty))
      this.opts.kv.set(KEYS.clock, String(this.clock))
      this.opts.kv.set(KEYS.cursor, String(this.cursor))
      this.notesError = false
    } catch {
      this.notesError = true
    }
  }

  private mark(table: string, id: string, deleted: boolean, json?: string): void {
    const u = this.stamp()
    ;(this.meta[table] ??= {})[id] = deleted || json === undefined ? { u, d: 1 } : { u, h: fingerprint(json) }
    if (!this.dirty.has(table)) this.dirty.set(table, new Set())
    this.dirty.get(table)!.add(id)
  }

  private onChange(table: string, prev: Row[], next: Row[]): void {
    const before = new Map(prev.map((r) => [r.id, JSON.stringify(r)]))
    const after = new Map(next.map((r) => [r.id, JSON.stringify(r)]))
    let any = false
    for (const [id, json] of after) {
      if (before.get(id) !== json) {
        this.mark(table, id, false, json)
        any = true
      }
    }
    for (const id of before.keys()) {
      if (!after.has(id)) {
        this.mark(table, id, true)
        any = true
      }
    }
    if (any) {
      this.persist()
      this.publish()
    }
  }

  /** Compare the phone's rows with our notes and mark whatever differs (new, edited or removed behind our back). */
  private reconcile(): boolean {
    let any = false
    for (const [table, rows] of Object.entries(this.opts.local.getAll())) {
      const known = this.meta[table] ?? {}
      const present = new Set<string>()
      for (const r of uniqueById(rows)) {
        present.add(r.id)
        const json = JSON.stringify(r)
        const m = known[r.id]
        if (!m || m.d || m.h !== fingerprint(json)) {
          this.mark(table, r.id, false, json)
          any = true
        }
      }
      for (const [id, m] of Object.entries(known)) {
        if (!m.d && !present.has(id)) {
          this.mark(table, id, true)
          any = true
        }
      }
    }
    return any
  }

  private async run(): Promise<SyncResult> {
    const result: SyncResult = { pushed: 0, pulled: 0, rejected: 0 }
    this.skipped = 0
    this.setStatus({ state: 'syncing' })
    let pushError: unknown = null
    let pullError: unknown = null
    try {
      if (this.reconcile()) this.persist()
    } catch (err) {
      pushError = err
    }
    do {
      this.again = false
      // A push the server refuses must not stop us from receiving.
      try {
        result.pushed += await this.pushAll()
      } catch (err) {
        pushError = err
      }
      if (this.stopped) return result
      try {
        await this.pullAll(result)
      } catch (err) {
        pullError = err
      }
      if (this.stopped) return result
    } while (this.again && !pushError && !pullError)

    const failure = [pullError, pushError].find((e) => e !== null)
    const isOffline = (e: unknown) => e instanceof Error && e.name === 'TransportError' && (e as TransportError).kind === 'offline'
    if (isOffline(pullError) || isOffline(pushError)) {
      this.setStatus({ state: 'offline', message: undefined })
    } else if (failure !== undefined) {
      this.setStatus({ state: 'error', message: failure instanceof Error ? failure.message : String(failure) })
    } else if (this.notesError) {
      this.setStatus({ state: 'error', message: NOTES_FULL })
    } else {
      const notes: string[] = []
      if (this.skipped > 0) notes.push(`${this.skipped} item${this.skipped === 1 ? ' is' : 's are'} too large to sync`)
      if (result.rejected > 0) notes.push(`${result.rejected} change${result.rejected === 1 ? '' : 's'} from the other phone could not be read`)
      this.setStatus({ state: 'idle', lastSyncedAt: this.now(), message: notes.length > 0 ? notes.join('; ') : undefined })
    }
    return result
  }

  private nextBatch(): { tbl: string; id: string }[] {
    const out: { tbl: string; id: string }[] = []
    for (const [tbl, ids] of this.dirty) {
      for (const id of ids) {
        out.push({ tbl, id })
        if (out.length >= BATCH) return out
      }
    }
    return out
  }

  private async pushAll(): Promise<number> {
    let pushed = 0
    for (;;) {
      const batch = this.nextBatch()
      if (batch.length === 0) return pushed
      const all = this.opts.local.getAll()
      const rows: SyncRow[] = []
      let bytes = 0
      for (const { tbl, id } of batch) {
        const m = this.meta[tbl]?.[id] ?? { u: this.stamp() }
        const row = uniqueById(all[tbl] ?? []).find((r) => r.id === id)
        const deleted = Boolean(m.d) || !row
        const usable = typeof id === 'string' && id.length > 0 && id.length <= MAX_ID && tbl.length <= MAX_TABLE
        const payload = usable ? await encryptRow(this.opts.key, tbl, deleted ? { id } : (row as Row), { updated_at: m.u, deleted }) : ''
        if (this.stopped) return pushed
        if (!usable || payload.length > MAX_PAYLOAD) {
          // This row can never be accepted by the server: leave it out so it does not block the others.
          this.dirty.get(tbl)?.delete(id)
          this.skipped++
          continue
        }
        rows.push({ tbl, id, payload, deleted, updated_at: m.u })
        bytes += payload.length
        if (bytes >= MAX_PUSH_BYTES) break // the rest waits for the next push: the server refuses very large pushes
      }
      if (rows.length > 0) await this.opts.transport.push(this.opts.household, rows)
      if (this.stopped) return pushed
      for (const r of rows) {
        // an edit made while this batch was in flight has a later stamp and stays waiting
        if ((this.meta[r.tbl]?.[r.id]?.u ?? r.updated_at) === r.updated_at) this.dirty.get(r.tbl)?.delete(r.id)
      }
      this.persist()
      this.publish()
      pushed += rows.length
    }
  }

  /** Decrypt one remote row. Returns the row (null for a delete), or undefined if it must not be trusted or used. */
  private async open(r: SyncRow): Promise<Row | null | undefined> {
    if (!KNOWN_TABLES.includes(r.tbl) || !Number.isFinite(r.updated_at) || r.updated_at < 0) return undefined
    if (r.updated_at > this.now() * 1000 + MAX_AHEAD) return undefined // would win every later edit
    if (typeof r.payload !== 'string' || r.payload === '') return undefined
    try {
      const row = await decryptRow(this.opts.key, r.tbl, r.id, r.payload, { updated_at: r.updated_at, deleted: r.deleted })
      return r.deleted ? null : row
    } catch {
      return undefined
    }
  }

  private async pullAll(result: SyncResult): Promise<void> {
    for (;;) {
      const page = await this.opts.transport.pull(this.opts.household, this.cursor)
      if (this.stopped || page.length === 0) return
      await this.applyPage(page, result)
      if (page.length < PAGE) return
    }
  }

  /**
   * Merge one page of remote rows. All waiting (decrypting) is done first; then, with nothing awaited in between,
   * the phone's rows are read as they are right now and saved, so an edit made meanwhile is never overwritten.
   * Nothing is recorded (cursor included) unless the phone saved the rows.
   */
  private async applyPage(page: SyncRow[], result: SyncResult): Promise<void> {
    let maxSeq = this.cursor
    const opened: { r: SyncRow; row: Row | null }[] = []
    for (const r of page) {
      maxSeq = Math.max(maxSeq, r.seq ?? 0)
      const row = await this.open(r)
      if (row === undefined) result.rejected++
      else opened.push({ r, row })
    }
    if (this.stopped) return

    const all = this.opts.local.getAll()
    const changed = new Map<string, Row[]>()
    const seen: { tbl: string; id: string; entry: MetaEntry }[] = []
    for (const { r, row } of opened) {
      const m = this.meta[r.tbl]?.[r.id]
      if (m && m.u >= r.updated_at) continue // what we have is newer, or is our own change coming back
      const rows = changed.get(r.tbl) ?? uniqueById(all[r.tbl] ?? [])
      const at = rows.findIndex((x) => x.id === r.id)
      if (row === null) {
        if (at >= 0) rows.splice(at, 1)
      } else if (at >= 0) rows[at] = row
      else rows.push(row)
      changed.set(r.tbl, rows)
      seen.push({ tbl: r.tbl, id: r.id, entry: row === null ? { u: r.updated_at, d: 1 } : { u: r.updated_at, h: fingerprint(JSON.stringify(row)) } })
      result.pulled++
    }
    if (changed.size > 0) this.opts.local.apply(Object.fromEntries(changed)) // throws if the phone cannot save: nothing below runs
    for (const s of seen) {
      ;(this.meta[s.tbl] ??= {})[s.id] = s.entry
      this.clock = Math.max(this.clock, s.entry.u)
      this.dirty.get(s.tbl)?.delete(s.id) // an older local change is replaced by the newer remote one
    }
    this.cursor = maxSeq
    this.persist()
    this.publish()
  }
}
