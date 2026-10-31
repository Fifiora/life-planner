import type { Row } from '../src/types'
import { TransportError, type KV, type LocalStore, type SyncRow, type Transport } from '../src/lib/syncEngine'

export class MemoryKV implements KV {
  m = new Map<string, string>()
  failSet = false
  get(key: string) {
    return this.m.get(key) ?? null
  }
  set(key: string, value: string) {
    if (this.failSet) throw new Error('quota exceeded')
    this.m.set(key, value)
  }
  remove(key: string) {
    this.m.delete(key)
  }
}

type Listener = (table: string, prev: Row[], next: Row[]) => void

/** A phone's saved rows. `put` and `remove` act like the user editing; `apply` acts like the sync writing (no change report). */
export class MemoryLocal implements LocalStore {
  tables: Record<string, Row[]> = {}
  listeners = new Set<Listener>()
  applyError: Error | null = null
  applied: Record<string, Row[]>[] = []

  /** Runs after the next getAll(): lets a test make an edit at an exact moment. */
  afterGetAll: (() => void) | null = null

  getAll() {
    const out = JSON.parse(JSON.stringify(this.tables)) as Record<string, Row[]>
    this.afterGetAll?.()
    return out
  }
  apply(tables: Record<string, Row[]>) {
    if (this.applyError) throw this.applyError
    this.applied.push(tables)
    for (const [t, rows] of Object.entries(tables)) this.tables[t] = JSON.parse(JSON.stringify(rows))
  }
  onLocalChange(cb: Listener) {
    this.listeners.add(cb)
    return () => void this.listeners.delete(cb)
  }
  rows(table: string): Row[] {
    return this.tables[table] ?? []
  }
  private set(table: string, next: Row[]) {
    const prev = this.rows(table)
    this.tables[table] = next
    this.listeners.forEach((l) => l(table, prev, next))
  }
  /** Change rows without telling anyone (like another tab, or an edit made before sync started). */
  silentPut(table: string, row: Row) {
    const rows = this.rows(table)
    this.tables[table] = rows.some((r) => r.id === row.id) ? rows.map((r) => (r.id === row.id ? row : r)) : [...rows, row]
  }
  silentRemove(table: string, id: string) {
    this.tables[table] = this.rows(table).filter((r) => r.id !== id)
  }
  put(table: string, row: Row) {
    const rows = this.rows(table)
    this.set(table, rows.some((r) => r.id === row.id) ? rows.map((r) => (r.id === row.id ? row : r)) : [...rows, row])
  }
  remove(table: string, id: string) {
    this.set(table, this.rows(table).filter((r) => r.id !== id))
  }
}

/** A stand-in for the Supabase functions: last write wins by updated_at, rows come back in seq order. */
export class FakeBackend implements Transport {
  rows = new Map<string, SyncRow>()
  seq = 0
  pushes: SyncRow[][] = []
  pulls: number[] = []
  failNext: Error | null = null
  failAlways: Error | null = null
  attempts: number[] = []
  pageSize = 1000
  notified = 0
  onChanged = new Set<() => void>()

  private maybeFail() {
    if (this.failAlways) throw this.failAlways
    if (this.failNext) {
      const e = this.failNext
      this.failNext = null
      throw e
    }
  }
  async push(household: string, rows: SyncRow[]) {
    this.attempts.push(Date.now())
    this.maybeFail()
    this.pushes.push(rows)
    for (const r of rows) {
      const key = `${household}|${r.tbl}|${r.id}`
      const have = this.rows.get(key)
      if (!have || have.updated_at < r.updated_at) this.rows.set(key, { ...r, seq: ++this.seq })
    }
  }
  async pull(household: string, after: number) {
    this.maybeFail()
    this.pulls.push(after)
    return [...this.rows.entries()]
      .filter(([k, r]) => k.startsWith(`${household}|`) && (r.seq ?? 0) > after)
      .map(([, r]) => r)
      .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
      .slice(0, this.pageSize)
  }
  async ping() {
    this.maybeFail()
  }
  subscribe(_household: string, onChanged: () => void) {
    this.onChanged.add(onChanged)
    return () => void this.onChanged.delete(onChanged)
  }
  /** A phone told the others something changed (counted only: the sender never hears its own nudge). */
  notify() {
    this.notified++
  }
  /** Simulate another phone's nudge arriving. */
  emitChanged() {
    this.onChanged.forEach((cb) => cb())
  }
}

export const offline = () => new TransportError('offline', 'No connection')
export const serverError = (message = 'Server said no') => new TransportError('server', message)
