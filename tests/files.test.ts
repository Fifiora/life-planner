import { describe, it, expect, afterEach, vi } from 'vitest'
import { downloadText } from '../src/lib/files'

const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL }
afterEach(() => {
  URL.createObjectURL = original.create
  URL.revokeObjectURL = original.revoke
  vi.restoreAllMocks()
})

describe('downloadText', () => {
  it('saves with the type it is given', () => {
    const create = vi.fn(() => 'blob:x')
    URL.createObjectURL = create
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    downloadText('a.md', 'hello', 'text/markdown')
    expect(((create.mock.calls[0] as unknown[])[0] as Blob).type).toBe('text/markdown')
  })
  it('still works in a browser without createObjectURL, by using the text itself as the link', () => {
    // @ts-expect-error simulating an old browser
    URL.createObjectURL = undefined
    const seen: { href: string; name: string }[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      seen.push({ href: this.href, name: this.download })
    })
    expect(() => downloadText('a.md', 'hello # world', 'text/markdown')).not.toThrow()
    expect(seen).toHaveLength(1)
    expect(seen[0].name).toBe('a.md')
    expect(seen[0].href.startsWith('data:text/markdown')).toBe(true)
    expect(decodeURIComponent(seen[0].href.split(',')[1])).toBe('hello # world')
  })
})
