import type { Row } from '../types'
import { decryptRow, encryptRow } from './syncCrypto'
import { TABLES } from './tables'

/** One row as the server holds it: scrambled `payload`, or a tombstone (`deleted`) with none. */
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

type Meta = Record<string, Record<string, { u: number; d?: 1 }>>

const BATCH = 200
const PAGE = 1000 // the most rows the server returns in one pull
const KEYS = { meta: 'lp.sync.meta', cursor: 'lp.sync.cursor', dirty: 'lp.sync.dirty', clock: 'lp.sync.clock', device: 'lp.sync.device' }

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

/**
 * Keeps one phone's rows and the shared copy in step. It remembers, per row, when it last changed (`meta`) and
 * which rows still have to be uploaded (`dirty`), and it never sends a row it has just received.
 */
export class SyncEngine {
  private meta: Meta
  private dirty = new Map<string, Set<string>>()
  private clock: number
  private cursor: number
  private device: number
  private off: (() => void) | null = null
  private listeners = new Set<(s: SyncStatus) => void>()
  private current: SyncStatus
  private inflight: Promise<SyncResult> | null = null
  private again = false

  constructor(private opts: SyncEngineOptions) {
    this.meta = readJson<Meta>(opts.kv, KEYS.meta, {})
    for (const [table, ids] of Object.entries(readJson<Record<string, string[]>>(opts.kv, KEYS.dirty, {}))) this.dirty.set(table, new Set(ids))
    this.clock = Number(opts.kv.get(KEYS.clock)) || 0
    this.cursor = Number(opts.kv.get(KEYS.cursor)) || 0
    const saved = opts.kv.get(KEYS.device)
    this.device = opts.device ?? (saved !== null ? Number(saved) : Math.floor(Math.random() * 1000))
    if (saved === null || opts.device !== undefined) opts.kv.set(KEYS.device, String(this.device))
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
    if (this.off) return
    this.off = this.opts.local.onLocalChange((table, prev, next) => this.onChange(table, prev, next))
  }

  stop(): void {
    this.off?.()
    this.off = null
  }

  /** Mark every row this phone holds as waiting to upload (the first phone, when sharing starts). */
  markAllDirty(): void {
    for (const [table, rows] of Object.entries(this.opts.local.getAll())) for (const r of rows) this.mark(table, r.id, false)
    this.persist()
    this.publish()
  }

  /** Upload what changed here, then fetch what changed elsewhere. Never throws; the outcome is in `status`. */
  syncNow(): Promise<SyncResult> {
    if (this.inflight) {
      this.again = true
      return this.inflight
    }
    this.inflight = this.run().finally(() => {
      this.inflight = null
    })
    return this.inflight
  }

  // ----- internals -----

  private now(): number {
    return (this.opts.now ?? Date.now)()
  }

  /**
   * A change time: microseconds-ish (ms x 1000 plus this phone's own 0-999), later than anything issued or seen so
   * far even if this phone's clock is behind, and never equal to another phone's stamp.
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
    this.setStatus({})
  }

  private persist(): void {
    const dirty: Record<string, string[]> = {}
    for (const [table, ids] of this.dirty) if (ids.size > 0) dirty[table] = [...ids]
    this.opts.kv.set(KEYS.meta, JSON.stringify(this.meta))
    this.opts.kv.set(KEYS.dirty, JSON.stringify(dirty))
    this.opts.kv.set(KEYS.clock, String(this.clock))
    this.opts.kv.set(KEYS.cursor, String(this.cursor))
  }

  private mark(table: string, id: string, deleted: boolean): void {
    const u = this.stamp()
    ;(this.meta[table] ??= {})[id] = deleted ? { u, d: 1 } : { u }
    if (!this.dirty.has(table)) this.dirty.set(table, new Set())
    this.dirty.get(table)!.add(id)
  }

  private onChange(table: string, prev: Row[], next: Row[]): void {
    const before = new Map(prev.map((r) => [r.id, JSON.stringify(r)]))
    const after = new Map(next.map((r) => [r.id, JSON.stringify(r)]))
    let any = false
    for (const [id, json] of after) {
      if (before.get(id) !== json) {
        this.mark(table, id, false)
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

  private async run(): Promise<SyncResult> {
    const result: SyncResult = { pushed: 0, pulled: 0, rejected: 0 }
    this.setStatus({ state: 'syncing' })
    try {
      do {
        this.again = false
        result.pushed += await this.pushAll()
        await this.pullAll(result)
      } while (this.again)
      this.setStatus({ state: 'idle', lastSyncedAt: this.now(), message: undefined })
    } catch (err) {
      if (err instanceof Error && err.name === 'TransportError' && (err as TransportError).kind === 'offline') {
        this.setStatus({ state: 'offline', message: undefined })
      } else {
        this.setStatus({ state: 'error', message: err instanceof Error ? err.message : String(err) })
      }
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
      for (const { tbl, id } of batch) {
        const m = this.meta[tbl]?.[id] ?? { u: this.stamp() }
        const row = all[tbl]?.find((r) => r.id === id)
        if (m.d || !row) rows.push({ tbl, id, payload: null, deleted: true, updated_at: m.u })
        else rows.push({ tbl, id, payload: await encryptRow(this.opts.key, tbl, row), deleted: false, updated_at: m.u })
      }
      await this.opts.transport.push(this.opts.household, rows)
      for (const r of rows) {
        // an edit made while this batch was in flight has a later stamp and stays waiting
        if ((this.meta[r.tbl]?.[r.id]?.u ?? r.updated_at) === r.updated_at) this.dirty.get(r.tbl)?.delete(r.id)
      }
      this.persist()
      this.publish()
      pushed += rows.length
    }
  }

  private async pullAll(result: SyncResult): Promise<void> {
    for (;;) {
      const page = await this.opts.transport.pull(this.opts.household, this.cursor)
      if (page.length === 0) return
      await this.applyPage(page, result)
      if (page.length < PAGE) return
    }
  }

  /** Merge one page of remote rows. Nothing is recorded (cursor included) unless the phone saved them. */
  private async applyPage(page: SyncRow[], result: SyncResult): Promise<void> {
    const all = this.opts.local.getAll()
    const changed = new Map<string, Row[]>()
    const seen: { tbl: string; id: string; u: number; d: boolean }[] = []
    let maxSeq = this.cursor
    for (const r of page) {
      maxSeq = Math.max(maxSeq, r.seq ?? 0)
      const m = this.meta[r.tbl]?.[r.id]
      if (m && m.u >= r.updated_at) continue // what we have is newer, or is our own change coming back
      let decoded: Row | null = null
      if (!r.deleted) {
        try {
          decoded = await decryptRow(this.opts.key, r.tbl, r.id, r.payload ?? '')
        } catch {
          result.rejected++
          continue
        }
      }
      const rows = changed.get(r.tbl) ?? [...(all[r.tbl] ?? [])]
      const at = rows.findIndex((x) => x.id === r.id)
      if (decoded === null) {
        if (at >= 0) rows.splice(at, 1)
      } else if (at >= 0) rows[at] = decoded
      else rows.push(decoded)
      changed.set(r.tbl, rows)
      seen.push({ tbl: r.tbl, id: r.id, u: r.updated_at, d: r.deleted })
      result.pulled++
    }
    if (changed.size > 0) this.opts.local.apply(Object.fromEntries(changed)) // throws if the phone cannot save: nothing below runs
    for (const s of seen) {
      ;(this.meta[s.tbl] ??= {})[s.id] = s.d ? { u: s.u, d: 1 } : { u: s.u }
      this.clock = Math.max(this.clock, s.u)
      this.dirty.get(s.tbl)?.delete(s.id) // an older local change is replaced by the newer remote one
    }
    this.cursor = maxSeq
    this.persist()
    this.publish()
  }

  /** Make this phone match the shared copy exactly (joining a household). Anything held here is replaced. */
  async replaceFromRemote(): Promise<{ pulled: number }> {
    const tables: Record<string, Row[]> = Object.fromEntries(TABLES.map((t) => [t, [] as Row[]]))
    const meta: Meta = {}
    let cursor = 0
    let clock = this.clock
    let pulled = 0
    for (;;) {
      const page = await this.opts.transport.pull(this.opts.household, cursor)
      if (page.length === 0) break
      for (const r of page) {
        cursor = Math.max(cursor, r.seq ?? 0)
        clock = Math.max(clock, r.updated_at)
        ;(meta[r.tbl] ??= {})[r.id] = r.deleted ? { u: r.updated_at, d: 1 } : { u: r.updated_at }
        if (r.deleted || !(r.tbl in tables)) continue
        try {
          tables[r.tbl].push(await decryptRow(this.opts.key, r.tbl, r.id, r.payload ?? ''))
          pulled++
        } catch {
          /* a row this code cannot open is left out */
        }
      }
      if (page.length < PAGE) break
    }
    this.opts.local.apply(tables)
    this.meta = meta
    this.dirty.clear()
    this.cursor = cursor
    this.clock = clock
    this.persist()
    this.setStatus({ state: 'idle', lastSyncedAt: this.now(), message: undefined })
    return { pulled }
  }
}
