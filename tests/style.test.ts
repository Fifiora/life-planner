import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getStyleChoice, setStyleChoice, startStyle, STYLE_EVENT } from '../src/lib/style'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-style')
})
afterEach(() => vi.restoreAllMocks())

describe('style choice', () => {
  it('defaults to anime, also for garbage', () => {
    expect(getStyleChoice()).toBe('anime')
    localStorage.setItem('lp.style', 'neon')
    expect(getStyleChoice()).toBe('anime')
  })

  it('stores a choice, applies it to the page and announces it', () => {
    const heard = vi.fn()
    window.addEventListener(STYLE_EVENT, heard)
    setStyleChoice('classic')
    window.removeEventListener(STYLE_EVENT, heard)
    expect(localStorage.getItem('lp.style')).toBe('classic')
    expect(getStyleChoice()).toBe('classic')
    expect(document.documentElement.dataset.style).toBe('classic')
    expect(heard).toHaveBeenCalledTimes(1)
    setStyleChoice('anime')
    expect(getStyleChoice()).toBe('anime')
    expect(document.documentElement.dataset.style).toBe('anime')
  })

  it('does not throw when the phone blocks storage, and still applies the choice', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(getStyleChoice()).toBe('anime')
    expect(() => setStyleChoice('classic')).not.toThrow()
    expect(document.documentElement.dataset.style).toBe('classic')
  })

  it('startStyle applies what was saved', () => {
    localStorage.setItem('lp.style', 'classic')
    startStyle()
    expect(document.documentElement.dataset.style).toBe('classic')
  })

  it('startStyle applies anime when nothing was saved', () => {
    startStyle()
    expect(document.documentElement.dataset.style).toBe('anime')
  })
})
