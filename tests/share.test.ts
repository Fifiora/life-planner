import { describe, it, expect, vi } from 'vitest'
import { shareOrCopy } from '../src/lib/share'

const abort = () => Object.assign(new Error('cancelled'), { name: 'AbortError' })

describe('shareOrCopy', () => {
  it('uses the share sheet when there is one', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const writeText = vi.fn()
    expect(await shareOrCopy('https://x/#v=1', { share, clipboard: { writeText } })).toBe('shared')
    expect(share).toHaveBeenCalledWith({ title: 'Our Life Planner', url: 'https://x/#v=1' })
    expect(writeText).not.toHaveBeenCalled()
  })
  it('does not copy anything when the share sheet is cancelled', async () => {
    const writeText = vi.fn()
    expect(await shareOrCopy('u', { share: vi.fn().mockRejectedValue(abort()), clipboard: { writeText } })).toBe('cancelled')
    expect(writeText).not.toHaveBeenCalled()
  })
  it('copies instead when sharing fails for another reason', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    expect(await shareOrCopy('u', { share: vi.fn().mockRejectedValue(new Error('nope')), clipboard: { writeText } })).toBe('copied')
    expect(writeText).toHaveBeenCalledWith('u')
  })
  it('copies when there is no share sheet', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    expect(await shareOrCopy('u', { clipboard: { writeText } })).toBe('copied')
  })
  it('reports failure when nothing works', async () => {
    expect(await shareOrCopy('u', {})).toBe('failed')
    expect(await shareOrCopy('u', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })).toBe('failed')
  })
})
