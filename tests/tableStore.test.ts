import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { saveConfig } from '../src/lib/githubStore'
import { getState, insertRow, refresh, removeRow, replaceRows, resetStore, subscribe, updateRow } from '../src/data/tableStore'
import { deferred, installFakeGithub } from './fakeGithub'

beforeEach(() => {
  localStorage.clear()
  saveConfig({ owner: 'o', repo: 'r', token: 't' })
  resetStore()
})
afterEach(() => vi.unstubAllGlobals())

const loaded = (table: string) => vi.waitFor(() => expect(getState(table).loaded).toBe(true))

describe('tableStore', () => {
  it('loads a table from the data repo once someone is watching it', async () => {
    installFakeGithub({ bills: [{ id: '1', name: 'Rent' }] })
    const stop = subscribe('bills', () => {})
    await loaded('bills')
    expect(getState('bills').rows).toEqual([{ id: '1', name: 'Rent' }])
    stop()
  })

  it('treats a missing file as an empty, loaded table', async () => {
    installFakeGithub()
    const stop = subscribe('places', () => {})
    await loaded('places')
    expect(getState('places').rows).toEqual([])
    stop()
  })

  it('shows an inserted row at once and saves it with an id', async () => {
    const gh = installFakeGithub()
    const saving = insertRow('bills', { name: 'Rent' })
    expect(getState('bills').rows).toHaveLength(1)
    await saving
    const saved = gh.rows('bills')
    expect(saved).toHaveLength(1)
    expect(saved[0].name).toBe('Rent')
    expect(typeof saved[0].id).toBe('string')
    expect(saved[0].id.length).toBeGreaterThan(8)
  })

  it('keeps two quick inserts in order and saves both', async () => {
    const gh = installFakeGithub()
    await Promise.all([insertRow('bills', { name: 'A' }), insertRow('bills', { name: 'B' })])
    expect(gh.rows('bills').map((r) => r.name)).toEqual(['A', 'B'])
    expect(getState('bills').rows.map((r) => r.name)).toEqual(['A', 'B'])
  })

  it('removes the row again and reports the failure when the save is rejected', async () => {
    const gh = installFakeGithub()
    gh.state.failWrites = 500
    await expect(insertRow('bills', { name: 'Doomed' })).rejects.toThrow(/server says no/)
    expect(getState('bills').rows).toEqual([])
  })

  it('updates and removes saved rows', async () => {
    const gh = installFakeGithub({ bills: [{ id: '1', name: 'Rent' }, { id: '2', name: 'Power' }] })
    const stop = subscribe('bills', () => {})
    await loaded('bills')
    await updateRow('bills', '1', { name: 'Rent!' })
    await removeRow('bills', '2')
    expect(gh.rows('bills')).toEqual([{ id: '1', name: 'Rent!' }])
    expect(getState('bills').rows).toEqual([{ id: '1', name: 'Rent!' }])
    stop()
  })

  it('replaces a whole table (used by import)', async () => {
    const gh = installFakeGithub({ bills: [{ id: 'old' }] })
    await replaceRows('bills', [{ id: 'n1' }, { id: 'n2' }])
    expect(gh.rows('bills')).toEqual([{ id: 'n1' }, { id: 'n2' }])
  })

  it('does not let an older load undo a change made while it was in flight', async () => {
    const gh = installFakeGithub()
    const hold = deferred()
    gh.state.holdNextGet = hold
    const staleLoad = refresh('bills') // answer is computed now (empty) but delivered late
    await insertRow('bills', { name: 'Mine' })
    hold.resolve()
    await staleLoad
    expect(getState('bills').rows.map((r) => r.name)).toEqual(['Mine'])
  })

  it('picks up what the other phone saved on the next refresh', async () => {
    const gh = installFakeGithub({ bills: [{ id: '1' }] })
    const stop = subscribe('bills', () => {})
    await loaded('bills')
    gh.partnerWrites('bills', [{ id: '1' }, { id: 'theirs' }])
    await refresh('bills')
    expect(getState('bills').rows.map((r) => r.id)).toEqual(['1', 'theirs'])
    stop()
  })

  it('does not re-download a table that has not changed', async () => {
    const gh = installFakeGithub({ bills: [{ id: '1' }] })
    const stop = subscribe('bills', () => {})
    await loaded('bills')
    const rowsBefore = getState('bills').rows
    await refresh('bills')
    expect(getState('bills').rows).toBe(rowsBefore)
    expect(gh.state.getCount).toBe(2)
    stop()
  })

  it('reports a rejected token as an error on the table', async () => {
    const gh = installFakeGithub()
    gh.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401 }))
    await refresh('bills')
    expect(getState('bills').error).toMatch(/token/i)
  })
})
