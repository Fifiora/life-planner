import type { Row } from '../types'
import { encryptRow } from './syncCrypto'

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
const KEYS = { meta: 'lp.sync.meta', cursor: 'lp.sync.cursor', dirty: 'lp.sync.dirty', clock: 'lp.sync.clock' }

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

  /** Upload what changed here, then (Task 4) fetch what changed elsewhere. Never throws; the outcome is in `status`. */
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

  /** Later than anything issued or seen so far, even if this phone's clock is behind. */
  private stamp(): number {
    this.clock = Math.max(this.now(), this.clock + 1)
    return this.clock
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
}
