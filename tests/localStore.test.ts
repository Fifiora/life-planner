import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getAllRows,
  getState,
  hasOwnData,
  insertIfEmpty,
  insertRow,
  isReadOnly,
  loadSnapshot,
  removeRow,
  replaceRows,
  resetStore,
  subscribe,
  updateRow,
} from '../src/data/tableStore'

beforeEach(() => {
  localStorage.clear()
  resetStore()
})
afterEach(() => vi.restoreAllMocks())

const saved = (table: string) => JSON.parse(localStorage.getItem(`lp.data.${table}`) ?? '[]')

describe('local table store', () => {
  it('starts empty and ready', () => {
    expect(getState('bills')).toEqual({ rows: [], loaded: true, error: null })
  })

  it('saves an inserted row on this phone, with an id, and keeps it after a restart', async () => {
    await insertRow('bills', { name: 'Rent' })
    expect(saved('bills')).toHaveLength(1)
    resetStore() // like closing and reopening the app
    const rows = getState('bills').rows
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Rent')
    expect(typeof rows[0].id).toBe('string')
    expect((rows[0].id as string).length).toBeGreaterThan(8)
  })

  it('keeps ids and order when several rows are added', async () => {
    await insertRow('bills', { id: 'a', name: 'A' })
    await insertRow('bills', { id: 'b', name: 'B' })
    expect(getState('bills').rows.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('updates and removes rows', async () => {
    await insertRow('bills', { id: '1', name: 'Rent' })
    await insertRow('bills', { id: '2', name: 'Power' })
    await updateRow('bills', '1', { name: 'Rent!' })
    await removeRow('bills', '2')
    expect(saved('bills')).toEqual([{ id: '1', name: 'Rent!' }])
    expect(getState('bills').rows).toEqual([{ id: '1', name: 'Rent!' }])
  })

  it('replaces a whole table', async () => {
    await insertRow('bills', { id: 'old' })
    await replaceRows('bills', [{ id: 'n1' }, { id: 'n2' }])
    expect(saved('bills')).toEqual([{ id: 'n1' }, { id: 'n2' }])
  })

  it('adds starter rows only when the table is empty', async () => {
    await insertIfEmpty('members', [{ display_name: 'A' }, { display_name: 'B' }])
    expect(getState('members').rows.map((r) => r.display_name)).toEqual(['A', 'B'])
    await insertIfEmpty('members', [{ display_name: 'C' }])
    expect(getState('members').rows.map((r) => r.display_name)).toEqual(['A', 'B'])
  })

  it('tells watchers when something changes, and stops when they leave', async () => {
    const listener = vi.fn()
    const stop = subscribe('bills', listener)
    await insertRow('bills', { name: 'Rent' })
    expect(listener).toHaveBeenCalled()
    listener.mockClear()
    stop()
    await insertRow('bills', { name: 'Power' })
    expect(listener).not.toHaveBeenCalled()
  })

  it('leaves everything as it was and explains when the phone refuses to save', async () => {
    await insertRow('bills', { id: '1', name: 'Rent' })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    await expect(insertRow('bills', { name: 'More' })).rejects.toThrow(/storage may be full/i)
    await expect(updateRow('bills', '1', { name: 'X' })).rejects.toThrow(/storage may be full/i)
    await expect(removeRow('bills', '1')).rejects.toThrow(/storage may be full/i)
    expect(getState('bills').rows).toEqual([{ id: '1', name: 'Rent' }])
  })

  it('ignores saved data that is damaged', () => {
    localStorage.setItem('lp.data.bills', '{oops')
    expect(getState('bills').rows).toEqual([])
    localStorage.setItem('lp.data.places', '{"not":"a list"}')
    expect(getState('places').rows).toEqual([])
  })

  it('picks up a change made in another tab', () => {
    getState('bills')
    localStorage.setItem('lp.data.bills', JSON.stringify([{ id: 'x', name: 'From other tab' }]))
    window.dispatchEvent(new StorageEvent('storage', { key: 'lp.data.bills' }))
    expect(getState('bills').rows).toEqual([{ id: 'x', name: 'From other tab' }])
  })

  it('returns every table for export and sharing', async () => {
    await insertRow('bills', { id: '1' })
    await insertRow('places', { id: '2' })
    const all = getAllRows()
    expect(all.bills).toEqual([{ id: '1' }])
    expect(all.places).toEqual([{ id: '2' }])
    expect(all.routines).toEqual([])
  })

  it('knows whether this phone has its own planner data', async () => {
    expect(hasOwnData()).toBe(false)
    await insertRow('bills', { id: '1' })
    expect(hasOwnData()).toBe(true)
  })
})

describe('view-only copy', () => {
  it('shows the shared rows, never touches this phone\'s storage, and refuses changes', async () => {
    loadSnapshot({ bills: [{ id: '1', name: 'Rent' }] })
    expect(isReadOnly()).toBe(true)
    expect(getState('bills').rows).toEqual([{ id: '1', name: 'Rent' }])
    expect(getState('places').rows).toEqual([])
    expect(getAllRows().bills).toEqual([{ id: '1', name: 'Rent' }])
    await expect(insertRow('bills', { name: 'X' })).rejects.toThrow(/view-only/i)
    await expect(updateRow('bills', '1', { name: 'X' })).rejects.toThrow(/view-only/i)
    await expect(removeRow('bills', '1')).rejects.toThrow(/view-only/i)
    await expect(replaceRows('bills', [])).rejects.toThrow(/view-only/i)
    expect(localStorage.length).toBe(0)
  })
})
