import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetStore } from '../src/data/tableStore'
import { decodeSnapshot } from '../src/lib/snapshot'
import type { PreloadFile } from '../src/lib/preload'
import { UnlockPreload } from '../src/ui/UnlockPreload'

const file: PreloadFile = { v: 1, kdf: 'PBKDF2-SHA256', iterations: 250000, salt: 'AAAA', iv: 'BBBB', data: 'CCCC' }
const plain = JSON.stringify({
  v: 1,
  createdAt: '2026-11-01T00:00:00.000Z',
  tables: {
    members: [{ id: 'm1', display_name: 'Stone', color: '#111' }, { id: 'm2', display_name: 'Wifey', color: '#222' }],
    bills: [{ id: 'b1', name: 'Rent', amount: 5 }],
  },
})

beforeEach(() => {
  localStorage.clear()
  resetStore()
})

async function unlock(decrypt = vi.fn().mockResolvedValue(plain)) {
  const onFinished = vi.fn()
  const onSkip = vi.fn()
  render(<UnlockPreload preload={file} decrypt={decrypt} onFinished={onFinished} onSkip={onSkip} />)
  await userEvent.type(screen.getByLabelText('Passphrase'), 'abcd-efgh')
  await userEvent.click(screen.getByRole('button', { name: 'Unlock' }))
  return { decrypt, onFinished, onSkip }
}

describe('UnlockPreload', () => {
  it('says so when the passphrase is wrong and shows no choices', async () => {
    await unlock(vi.fn().mockRejectedValue(new Error("That passphrase didn't work.")))
    expect(await screen.findByRole('alert')).toHaveTextContent(/passphrase/i)
    expect(screen.queryByRole('button', { name: /make this my planner/i })).not.toBeInTheDocument()
  })

  it('tries the passphrase against the preloaded file', async () => {
    const { decrypt } = await unlock()
    expect(decrypt).toHaveBeenCalledWith(file, 'abcd-efgh')
    expect(await screen.findByRole('button', { name: /make this my planner/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /just look/i })).toBeInTheDocument()
  })

  it('makes it this phone\'s own planner, as the first person', async () => {
    const { onFinished } = await unlock()
    await userEvent.click(await screen.findByRole('button', { name: /make this my planner/i }))
    await vi.waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1))
    expect(JSON.parse(localStorage.getItem('lp.data.bills')!)).toEqual([{ id: 'b1', name: 'Rent', amount: 5 }])
    expect(JSON.parse(localStorage.getItem('lp.data.members')!)).toHaveLength(2)
    expect(localStorage.getItem('lp.me')).toBe('m1')
    expect(localStorage.getItem('lp.snapshot')).toBeNull()
  })

  it('keeps a read-only copy without touching any own data', async () => {
    const { onFinished } = await unlock()
    await userEvent.click(await screen.findByRole('button', { name: /just look/i }))
    await vi.waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1))
    const snap = await decodeSnapshot(localStorage.getItem('lp.snapshot')!)
    expect(snap.tables.bills).toEqual([{ id: 'b1', name: 'Rent', amount: 5 }])
    expect(localStorage.getItem('lp.data.members')).toBeNull()
  })

  it('can be skipped, and remembers not to ask again', async () => {
    const onSkip = vi.fn()
    render(<UnlockPreload preload={file} decrypt={vi.fn()} onFinished={vi.fn()} onSkip={onSkip} />)
    await userEvent.click(screen.getByRole('button', { name: /start empty/i }))
    expect(localStorage.getItem('lp.skipPreload')).toBe('1')
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('rejects an unlocked file that is not a planner', async () => {
    await unlock(vi.fn().mockResolvedValue('{"hello":1}'))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /make this my planner/i })).not.toBeInTheDocument()
  })
})
