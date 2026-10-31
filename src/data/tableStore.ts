import { loadConfig, mutate, readTable, type StoreConfig } from '../lib/githubStore'
import { newId } from '../lib/ids'
import type { Row } from '../types'

export interface TableState {
  rows: Row[]
  loaded: boolean
  error: string | null
}

interface Entry {
  state: TableState
  etag: string | null
  version: number // bumped on every local change, so a slow older load can be discarded
  listeners: Set<() => void>
  timer: ReturnType<typeof setInterval> | null
  onVisible: (() => void) | null
  queue: Promise<unknown> // saves for one table run one at a time
}

const POLL_MS = 30_000
const EMPTY: TableState = { rows: [], loaded: false, error: null }
const entries = new Map<string, Entry>()

function entry(table: string): Entry {
  let e = entries.get(table)
  if (!e) {
    e = { state: EMPTY, etag: null, version: 0, listeners: new Set(), timer: null, onVisible: null, queue: Promise.resolve() }
    entries.set(table, e)
  }
  return e
}

function setState(e: Entry, patch: Partial<TableState>) {
  e.state = { ...e.state, ...patch }
  e.listeners.forEach((l) => l())
}

function config(): StoreConfig {
  const c = loadConfig()
  if (!c) throw new Error('Not connected to GitHub yet.')
  return c
}

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err))

export function getState(table: string): TableState {
  return entries.get(table)?.state ?? EMPTY
}

/** Fetch the latest rows. Quick no-op when nothing changed; ignored if a local change happened meanwhile. */
export async function refresh(table: string): Promise<void> {
  const e = entry(table)
  const cfg = loadConfig()
  if (!cfg) return
  const startVersion = e.version
  try {
    const res = await readTable(cfg, table, e.etag)
    if (res === 'unchanged') {
      if (!e.state.loaded) setState(e, { loaded: true })
      return
    }
    if (e.version !== startVersion) return
    e.etag = res.etag
    setState(e, { rows: res.rows, loaded: true, error: null })
  } catch (err) {
    setState(e, { loaded: true, error: messageOf(err) })
  }
}

function stopPolling(e: Entry) {
  if (e.timer) clearInterval(e.timer)
  if (e.onVisible) document.removeEventListener('visibilitychange', e.onVisible)
  e.timer = null
  e.onVisible = null
}

/** Watch a table; the first watcher starts checking for the other phone's changes every 30 seconds. */
export function subscribe(table: string, listener: () => void): () => void {
  const e = entry(table)
  e.listeners.add(listener)
  if (e.listeners.size === 1) {
    void refresh(table)
    e.timer = setInterval(() => void refresh(table), POLL_MS)
    e.onVisible = () => {
      if (document.visibilityState === 'visible') void refresh(table)
    }
    document.addEventListener('visibilitychange', e.onVisible)
  }
  return () => {
    e.listeners.delete(listener)
    if (e.listeners.size === 0) stopPolling(e)
  }
}

function enqueue<T>(e: Entry, work: () => Promise<T>): Promise<T> {
  const run = e.queue.then(work)
  e.queue = run.catch(() => {})
  return run
}

async function save(table: string, e: Entry, change: (rows: Row[]) => Row[]) {
  await enqueue(e, async () => {
    await mutate(config(), table, change)
    e.etag = null // our own write changed the file; the next check must re-download it
  })
}

async function resync(table: string, e: Entry) {
  e.etag = null
  e.version++
  await refresh(table)
}

export async function insertRow(table: string, row: Record<string, unknown>): Promise<void> {
  const e = entry(table)
  const full = { ...row, id: typeof row.id === 'string' && row.id ? row.id : newId() } as Row
  e.version++
  setState(e, { rows: [...e.state.rows, full], loaded: true })
  try {
    await save(table, e, (rows) => [...rows, full])
  } catch (err) {
    e.version++
    setState(e, { rows: e.state.rows.filter((r) => r.id !== full.id) })
    throw err
  }
}

export async function updateRow(table: string, id: string, patch: Record<string, unknown>): Promise<void> {
  const e = entry(table)
  e.version++
  setState(e, { rows: e.state.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) })
  try {
    await save(table, e, (rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  } catch (err) {
    await resync(table, e)
    throw err
  }
}

export async function removeRow(table: string, id: string): Promise<void> {
  const e = entry(table)
  e.version++
  setState(e, { rows: e.state.rows.filter((r) => r.id !== id) })
  try {
    await save(table, e, (rows) => rows.filter((r) => r.id !== id))
  } catch (err) {
    await resync(table, e)
    throw err
  }
}

/** Replace the whole table (used by "Import data"). */
export async function replaceRows(table: string, rows: Row[]): Promise<void> {
  const e = entry(table)
  e.version++
  setState(e, { rows, loaded: true })
  try {
    await save(table, e, () => rows)
  } catch (err) {
    await resync(table, e)
    throw err
  }
}

/** Forget everything in memory (tests, and when disconnecting). */
export function resetStore(): void {
  entries.forEach(stopPolling)
  entries.clear()
}
