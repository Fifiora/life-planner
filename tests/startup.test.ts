import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getState, isReadOnly, resetStore } from '../src/data/tableStore'
import { startup } from '../src/data/startup'
import { encodeSnapshot, makeSnapshot } from '../src/lib/snapshot'

const PRELOAD = { v: 1, kdf: 'PBKDF2-SHA256', iterations: 250000, salt: 'AAAA', iv: 'BBBB', data: 'CCCC' }
const respond = (body: unknown, status = 200) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  localStorage.clear()
  resetStore()
  fetchMock = vi.fn().mockResolvedValue(respond('', 404))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

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
    localStorage.setItem('lp.data.routines', JSON.stringify([{ id: 'r1', name: 'Walk' }]))
    expect(await startup('#/')).toEqual({ mode: 'own', fromLink: false })
    expect(isReadOnly()).toBe(false)
  })

  it('replaces the remembered copy when a newer link is opened', async () => {
    localStorage.setItem('lp.snapshot', 'p.' + 'e30') // an older, different copy
    const enc = await sample()
    await startup(`#v=${enc}`)
    expect(localStorage.getItem('lp.snapshot')).toBe(enc)
  })

  it('explains a damaged link but still shows the copy remembered earlier', async () => {
    const enc = await sample()
    localStorage.setItem('lp.snapshot', enc)
    const result = await startup('#v=garbage')
    expect(result).toMatchObject({ mode: 'view', fromLink: false })
    expect(result.error).toMatch(/damaged|cut off/i)
    expect(getState('bills').rows).toEqual([{ id: '1', name: 'Rent' }])
    expect(localStorage.getItem('lp.snapshot')).toBe(enc)
  })

  it('explains a damaged link and starts normally when nothing was remembered', async () => {
    const result = await startup('#v=garbage')
    expect(result.mode).toBe('own')
    expect(result.error).toMatch(/damaged|cut off/i)
    expect(localStorage.getItem('lp.snapshot')).toBeNull()
  })

  describe('preloaded plan', () => {
    it('offers to unlock the preloaded plan on a brand-new phone', async () => {
      fetchMock.mockResolvedValue(respond(PRELOAD))
      const result = await startup('')
      expect(result).toEqual({ mode: 'locked', fromLink: false, preload: PRELOAD })
      expect(String(fetchMock.mock.calls[0][0])).toContain('preload.enc.json')
    })

    it('does not look for it when this phone already has its own plan', async () => {
      localStorage.setItem('lp.data.routines', JSON.stringify([{ id: 'r1', name: 'Walk' }]))
      fetchMock.mockResolvedValue(respond(PRELOAD))
      expect((await startup('')).mode).toBe('own')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('does not offer it when a shared copy is remembered', async () => {
      localStorage.setItem('lp.snapshot', await sample())
      fetchMock.mockResolvedValue(respond(PRELOAD))
      expect((await startup('')).mode).toBe('view')
    })

    it('shows a remembered view-only copy even when only names were entered before (no unlock loop)', async () => {
      localStorage.setItem('lp.data.members', JSON.stringify([{ id: 'me' }]))
      localStorage.setItem('lp.snapshot', await sample())
      fetchMock.mockResolvedValue(respond(PRELOAD))
      expect((await startup('')).mode).toBe('view')
    })

    it('stops offering it after "start empty"', async () => {
      localStorage.setItem('lp.skipPreload', '1')
      fetchMock.mockResolvedValue(respond(PRELOAD))
      expect((await startup('')).mode).toBe('own')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('carries on normally if the file is missing, unreadable or the wrong shape', async () => {
      fetchMock.mockResolvedValue(respond('', 404))
      expect((await startup('')).mode).toBe('own')
      fetchMock.mockRejectedValue(new Error('offline'))
      expect((await startup('')).mode).toBe('own')
      fetchMock.mockResolvedValue(respond('not json'))
      expect((await startup('')).mode).toBe('own')
      fetchMock.mockResolvedValue(respond({ v: 2 }))
      expect((await startup('')).mode).toBe('own')
    })
  })
})
