import { newId } from '../lib/ids'
import { TABLES } from '../lib/tables'
import type { Row } from '../types'

export interface TableState {
  rows: Row[]
  loaded: boolean
  error: string | null
}

interface Entry {
  state: TableState
  listeners: Set<() => void>
}

const PREFIX = 'lp.data.'
const entries = new Map<string, Entry>()
let snapshot: Record<string, Row[]> | null = null // set when showing someone's view-only copy
let listening = false

function readSaved(table: string): Row[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(PREFIX + table) ?? '[]')
    return Array.isArray(parsed) ? (parsed as Row[]) : []
  } catch {
    return []
  }
}

function setState(e: Entry, rows: Row[]) {
  e.state = { rows, loaded: true, error: null }
  e.listeners.forEach((l) => l())
}

/** Another tab of this app saved something. */
function onStorage(ev: StorageEvent) {
  if (snapshot || !ev.key || !ev.key.startsWith(PREFIX)) return
  const table = ev.key.slice(PREFIX.length)
  const e = entries.get(table)
  if (e) setState(e, readSaved(table))
}

function entry(table: string): Entry {
  if (!listening && typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage)
    listening = true
  }
  let e = entries.get(table)
  if (!e) {
    e = {
      state: { rows: snapshot ? (snapshot[table] ?? []) : readSaved(table), loaded: true, error: null },
      listeners: new Set(),
    }
    entries.set(table, e)
  }
  return e
}

export function getState(table: string): TableState {
  return entry(table).state
}

export function subscribe(table: string, listener: () => void): () => void {
  const e = entry(table)
  e.listeners.add(listener)
  return () => {
    e.listeners.delete(listener)
  }
}

/** Re-read from this phone's storage (no-op for a view-only copy). */
export async function refresh(table: string): Promise<void> {
  if (snapshot) return
  const e = entry(table)
  const rows = readSaved(table)
  if (JSON.stringify(rows) !== JSON.stringify(e.state.rows)) setState(e, rows)
}

const VIEW_ONLY_ERROR = 'This is a view-only copy — nothing can be changed here.'
const SAVE_ERROR = "Couldn't save on this phone — its storage may be full."

/** Saves first, then shows the result, so a failed save leaves the screen untouched. */
function commit(table: string, next: Row[]) {
  if (snapshot) throw new Error(VIEW_ONLY_ERROR)
  try {
    localStorage.setItem(PREFIX + table, JSON.stringify(next))
  } catch {
    throw new Error(SAVE_ERROR)
  }
  setState(entry(table), next)
}

export async function insertRow(table: string, row: Record<string, unknown>): Promise<void> {
  const full = { ...row, id: typeof row.id === 'string' && row.id ? row.id : newId() } as Row
  commit(table, [...entry(table).state.rows, full])
}

export async function updateRow(table: string, id: string, patch: Record<string, unknown>): Promise<void> {
  commit(table, entry(table).state.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
}

export async function removeRow(table: string, id: string): Promise<void> {
  commit(table, entry(table).state.rows.filter((r) => r.id !== id))
}

/** Replace the whole table (used by "Import data"). */
export async function replaceRows(table: string, rows: Row[]): Promise<void> {
  commit(table, rows)
}

/** Replace several tables together: either all of them are saved, or none (used by "Import data"). */
export async function replaceMany(tables: Record<string, Row[]>): Promise<void> {
  if (snapshot) throw new Error(VIEW_ONLY_ERROR)
  const previous = new Map<string, string | null>()
  try {
    for (const [table, rows] of Object.entries(tables)) {
      previous.set(table, localStorage.getItem(PREFIX + table))
      localStorage.setItem(PREFIX + table, JSON.stringify(rows))
    }
  } catch {
    for (const [table, raw] of previous) {
      try {
        if (raw === null) localStorage.removeItem(PREFIX + table)
        else localStorage.setItem(PREFIX + table, raw)
      } catch {
        /* nothing more we can do for this one */
      }
    }
    throw new Error(SAVE_ERROR)
  }
  for (const [table, rows] of Object.entries(tables)) setState(entry(table), rows)
}

/** Adds `rows` only if the table is still empty (first-time setup). */
export async function insertIfEmpty(table: string, rows: Record<string, unknown>[]): Promise<void> {
  if (entry(table).state.rows.length > 0) return
  commit(table, rows.map((r) => ({ ...r, id: newId() }) as Row))
}

/** Every table's rows, straight from storage (or the shared copy). */
export function getAllRows(): Record<string, Row[]> {
  const out: Record<string, Row[]> = {}
  for (const t of TABLES) out[t] = snapshot ? (snapshot[t] ?? []) : readSaved(t)
  return out
}

/** True when this phone already has its own planner data saved. */
export function hasOwnData(): boolean {
  return TABLES.some((t) => readSaved(t).length > 0)
}

/** Show someone's shared copy instead of this phone's own data. It cannot be changed. */
export function loadSnapshot(tables: Record<string, Row[]>): void {
  snapshot = tables
  entries.clear()
}

export function isReadOnly(): boolean {
  return snapshot !== null
}

/** Forget everything in memory (like closing the app) and leave any shared-copy mode. */
export function resetStore(): void {
  entries.clear()
  snapshot = null
}
