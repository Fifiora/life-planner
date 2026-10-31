import type { Row } from '../types'
import { addDays } from './dates'
import { parseImport } from './export'

/** A read-only copy of the planner that can travel in a link or a file. */
export interface Snapshot {
  v: 1
  createdAt: string
  tables: Record<string, Row[]>
}

const KEEP_LOG_DAYS = 45
const MAX_LINK_CHARS = 400_000 // longer than any real link
const MAX_UNPACKED_BYTES = 5_000_000 // a real planner is far smaller; stops a tiny link that unpacks to gigabytes

export function makeSnapshot(tables: Record<string, Row[]>, now: Date = new Date()): Snapshot {
  return { v: 1, createdAt: now.toISOString(), tables }
}

/** Drops tick history older than 45 days so links stay short. Returns a copy. */
export function trimForSharing<T extends Record<string, Row[]>>(tables: T, today: string): T {
  const cutoff = addDays(today, -KEEP_LOG_DAYS)
  const recent = (rows: Row[] = []) => rows.filter((r) => String(r.date) >= cutoff)
  return { ...tables, routine_logs: recent(tables.routine_logs), activities: recent(tables.activities) }
}

export function buildViewLink(base: string, encoded: string): string {
  return `${base.split('#')[0]}#v=${encoded}`
}

// ---------- Text <-> URL-safe base64 ----------

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

async function pipe(bytes: Uint8Array, transform: CompressionStream | DecompressionStream, maxBytes = Infinity): Promise<Uint8Array> {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
  const reader = source.pipeThrough(transform as unknown as ReadableWritablePair<Uint8Array, Uint8Array>).getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > maxBytes) {
      await reader.cancel()
      throw new Error('too large')
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}

/** "g." + compressed, or "p." + plain text where this browser cannot compress. */
export async function encodeSnapshot(snapshot: Snapshot): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot))
  if (typeof CompressionStream === 'undefined') return `p.${toBase64Url(bytes)}`
  return `g.${toBase64Url(await pipe(bytes, new CompressionStream('gzip')))}`
}

export async function decodeSnapshot(text: string): Promise<Snapshot> {
  const bad = () => new Error("That doesn't look like a complete view-only link. Ask for a new one.")
  try {
    if (text.length > MAX_LINK_CHARS) throw bad()
    const m = /^([gp])\.([A-Za-z0-9_-]+)$/.exec(text.trim())
    if (!m) throw bad()
    let bytes = fromBase64Url(m[2])
    if (m[1] === 'g') {
      if (typeof DecompressionStream === 'undefined') throw bad()
      bytes = await pipe(bytes, new DecompressionStream('gzip'), MAX_UNPACKED_BYTES)
    }
    if (bytes.length > MAX_UNPACKED_BYTES) throw bad()
    return parseSnapshotJson(new TextDecoder().decode(bytes))
  } catch {
    throw bad()
  }
}

/** Reads a view-only file (the JSON form of a snapshot). */
export function parseSnapshotJson(text: string): Snapshot {
  const bad = () => new Error("That isn't a Life Planner view-only file.")
  let data: { v?: unknown; createdAt?: unknown; tables?: unknown }
  try {
    data = JSON.parse(text)
  } catch {
    throw bad()
  }
  if (!data || data.v !== 1 || typeof data.createdAt !== 'string' || !data.tables || typeof data.tables !== 'object') throw bad()
  try {
    return { v: 1, createdAt: data.createdAt, tables: parseImport(JSON.stringify(data.tables)) }
  } catch {
    throw bad()
  }
}
