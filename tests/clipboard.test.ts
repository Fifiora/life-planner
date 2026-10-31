import { describe, it, expect, afterEach, vi } from 'vitest'
import { copyText } from '../src/lib/clipboard'

const setClipboard = (value: unknown) => Object.defineProperty(navigator, 'clipboard', { value, configurable: true })
afterEach(() => {
  setClipboard(undefined)
  vi.restoreAllMocks()
  Reflect.deleteProperty(document, 'execCommand')
})

describe('copyText', () => {
  it('uses the clipboard when it works', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard({ writeText })
    expect(await copyText('hello')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })
  it('falls back to selecting and copying when the clipboard refuses', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('blocked')) })
    document.execCommand = vi.fn(() => true)
    expect(await copyText('hello')).toBe(true)
    expect(document.execCommand).toHaveBeenCalledWith('copy')
  })
  it('falls back when there is no clipboard at all', async () => {
    setClipboard(undefined)
    document.execCommand = vi.fn(() => true)
    expect(await copyText('hello')).toBe(true)
  })
  it('says no, without throwing, when nothing works', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('blocked')) })
    document.execCommand = vi.fn(() => {
      throw new Error('nope')
    })
    expect(await copyText('hello')).toBe(false)
  })
})
