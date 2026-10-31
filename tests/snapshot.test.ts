import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  buildViewLink,
  decodeSnapshot,
  encodeSnapshot,
  makeSnapshot,
  parseSnapshotJson,
  trimForSharing,
} from '../src/lib/snapshot'

afterEach(() => vi.unstubAllGlobals())

const NOW = new Date('2026-11-01T12:00:00Z')

describe('snapshot link', () => {
  it('round-trips data, including accents and emoji', async () => {
    const snap = makeSnapshot({ bills: [{ id: '1', name: 'Café ☕ 🌎' }], places: [] }, NOW)
    expect(snap).toEqual({ v: 1, createdAt: '2026-11-01T12:00:00.000Z', tables: { bills: [{ id: '1', name: 'Café ☕ 🌎' }], places: [] } })
    expect(await decodeSnapshot(await encodeSnapshot(snap))).toEqual(snap)
  })

  it('produces text that is safe to put after a # in a link', async () => {
    const enc = await encodeSnapshot(makeSnapshot({ bills: [{ id: '1', name: 'a/b+c=d?e&f#g' }] }, NOW))
    expect(enc).toMatch(/^[A-Za-z0-9._-]+$/)
  })

  it('compresses repetitive data to keep links short', async () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({ id: `id-${i}`, name: 'Daily activity', cadence: 'daily', bucket: 'health' }))
    const snap = makeSnapshot({ routines: rows }, NOW)
    const enc = await encodeSnapshot(snap)
    expect(enc.length).toBeLessThan(JSON.stringify(snap).length / 3)
  })

  it('still works where this browser cannot compress', async () => {
    vi.stubGlobal('CompressionStream', undefined)
    const snap = makeSnapshot({ bills: [{ id: '1', name: 'Rent' }] }, NOW)
    const enc = await encodeSnapshot(snap)
    expect(enc.startsWith('p.')).toBe(true)
    expect(await decodeSnapshot(enc)).toEqual(snap)
  })

  it('rejects text that is not a view-only link', async () => {
    await expect(decodeSnapshot('not a link')).rejects.toThrow(/view-only/i)
    await expect(decodeSnapshot('')).rejects.toThrow(/view-only/i)
    await expect(decodeSnapshot('g.AAAA')).rejects.toThrow(/view-only/i)
  })

  it('refuses a link that is absurdly long', async () => {
    await expect(decodeSnapshot(`g.${'A'.repeat(500_000)}`)).rejects.toThrow(/view-only/i)
  })

  it('refuses a small link that unpacks to something enormous', async () => {
    const bomb = makeSnapshot({ bills: [{ id: '1', padding: 'x'.repeat(6_000_000) }] }, NOW)
    const enc = await encodeSnapshot(bomb)
    expect(enc.length).toBeLessThan(100_000)
    await expect(decodeSnapshot(enc)).rejects.toThrow(/view-only/i)
  })

  it('rejects a link whose content was cut off', async () => {
    const enc = await encodeSnapshot(makeSnapshot({ bills: Array.from({ length: 50 }, (_, i) => ({ id: String(i), name: `Bill ${i}` })) }, NOW))
    await expect(decodeSnapshot(enc.slice(0, Math.floor(enc.length / 2)))).rejects.toThrow(/view-only/i)
  })
})

describe('snapshot file', () => {
  it('reads a file made from a snapshot', () => {
    const snap = makeSnapshot({ bills: [{ id: '1', name: 'Rent' }] }, NOW)
    expect(parseSnapshotJson(JSON.stringify(snap))).toEqual(snap)
  })
  it('gives rows without ids new ones', () => {
    const out = parseSnapshotJson(JSON.stringify({ v: 1, createdAt: NOW.toISOString(), tables: { bills: [{ name: 'Rent' }] } }))
    expect(typeof out.tables.bills[0].id).toBe('string')
  })
  it('rejects anything that is not a Life Planner view-only file', () => {
    expect(() => parseSnapshotJson('nope')).toThrow(/view-only file/i)
    expect(() => parseSnapshotJson('{"v":2,"tables":{}}')).toThrow(/view-only file/i)
    expect(() => parseSnapshotJson('{"v":1}')).toThrow(/view-only file/i)
    expect(() => parseSnapshotJson('{"v":1,"createdAt":"x","tables":{"wat":[]}}')).toThrow(/view-only file/i)
  })
})

describe('trimForSharing', () => {
  const tables = {
    routine_logs: [
      { id: 'old', date: '2026-10-01' },
      { id: 'edge', date: '2026-10-16' },
      { id: 'new', date: '2026-11-29' },
    ],
    bills: [{ id: 'b' }],
  }
  it('drops tick history older than 45 days and keeps everything else', () => {
    const out = trimForSharing(tables, '2026-11-30')
    expect(out.routine_logs.map((l) => l.id)).toEqual(['edge', 'new'])
    expect(out.bills).toEqual([{ id: 'b' }])
  })
  it('also trims old activity entries', () => {
    const out = trimForSharing({ activities: [{ id: 'old', date: '2026-10-01' }, { id: 'new', date: '2026-11-20' }] }, '2026-11-30')
    expect(out.activities.map((a) => a.id)).toEqual(['new'])
  })
  it('does not change what it was given', () => {
    trimForSharing(tables, '2026-11-30')
    expect(tables.routine_logs).toHaveLength(3)
  })
})

describe('buildViewLink', () => {
  it('puts the snapshot after a # on the site address', () => {
    expect(buildViewLink('https://fifiora.github.io/life-planner/', 'g.abc')).toBe('https://fifiora.github.io/life-planner/#v=g.abc')
  })
  it('replaces whatever # part the address already had', () => {
    expect(buildViewLink('https://x.io/y/#/finance', 'g.abc')).toBe('https://x.io/y/#v=g.abc')
  })
})
