import { describe, it, expect, beforeEach } from 'vitest'
import { getState, isReadOnly, resetStore } from '../src/data/tableStore'
import { startup } from '../src/data/startup'
import { encodeSnapshot, makeSnapshot } from '../src/lib/snapshot'

beforeEach(() => {
  localStorage.clear()
  resetStore()
})

const sample = () =>
  encodeSnapshot(
    makeSnapshot(
      { members: [{ id: 'a', display_name: 'Ada' }, { id: 'b', display_name: 'Ben' }], bills: [{ id: '1', name: 'Rent' }] },
      new Date('2026-11-01T12:00:00Z'),
    ),
  )

describe('startup', () => {
  it('starts normally on a phone with nothing special', async () => {
    expect(await startup('')).toEqual({ mode: 'own', fromLink: false })
    expect(isReadOnly()).toBe(false)
  })

  it('opens a shared link as a view-only copy and remembers it', async () => {
    const enc = await sample()
    const result = await startup(`#v=${enc}`)
    expect(result).toMatchObject({ mode: 'view', fromLink: true, createdAt: '2026-11-01T12:00:00.000Z' })
    expect(isReadOnly()).toBe(true)
    expect(getState('bills').rows).toEqual([{ id: '1', name: 'Rent' }])
    expect(localStorage.getItem('lp.snapshot')).toBe(enc)
  })

  it('shows the remembered copy again later, without the link', async () => {
    localStorage.setItem('lp.snapshot', await sample())
    const result = await startup('#/')
    expect(result).toMatchObject({ mode: 'view', fromLink: false })
    expect(getState('members').rows).toHaveLength(2)
  })

  it('prefers this phone\'s own planner over a remembered copy', async () => {
    localStorage.setItem('lp.snapshot', await sample())
    localStorage.setItem('lp.data.members', JSON.stringify([{ id: 'me', display_name: 'Me' }]))
    expect(await startup('#/')).toEqual({ mode: 'own', fromLink: false })
    expect(isReadOnly()).toBe(false)
  })

  it('replaces the remembered copy when a newer link is opened', async () => {
    localStorage.setItem('lp.snapshot', 'p.' + 'e30') // an older, different copy
    const enc = await sample()
    await startup(`#v=${enc}`)
    expect(localStorage.getItem('lp.snapshot')).toBe(enc)
  })

  it('explains a damaged link and keeps what was remembered', async () => {
    const enc = await sample()
    localStorage.setItem('lp.snapshot', enc)
    const result = await startup('#v=garbage')
    expect(result.mode).toBe('own')
    expect(result.error).toMatch(/damaged|cut off/i)
    expect(localStorage.getItem('lp.snapshot')).toBe(enc)
  })
})
