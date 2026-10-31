import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetStore } from '../src/data/tableStore'
import type { PreloadFile } from '../src/lib/preload'
import { UnlockPreload } from '../src/ui/UnlockPreload'
import { renderScreen } from './seed'

const rt = vi.hoisted(() => ({ joinWithCode: vi.fn() }))
vi.mock('../src/data/syncRuntime', () => ({
  getCode: () => null,
  useSyncStatus: () => null,
  startSharing: vi.fn(),
  stopSyncing: vi.fn(),
  testConnection: vi.fn(),
  joinWithCode: (...a: unknown[]) => rt.joinWithCode(...a),
}))
vi.mock('../src/lib/session', async (importOriginal) => ({ ...(await importOriginal<typeof import('../src/lib/session')>()), reloadApp: vi.fn() }))
import { reloadApp } from '../src/lib/session'

const CODE = 'ABCD-EFGH-JKMN-PQRS-TUVW-XYZ2'
const file: PreloadFile = { v: 1, kdf: 'PBKDF2-SHA256', iterations: 250000, salt: 'AAAA', iv: 'BBBB', data: 'CCCC' }

beforeEach(() => {
  localStorage.clear()
  resetStore()
  rt.joinWithCode.mockReset().mockResolvedValue(undefined)
  vi.mocked(reloadApp).mockClear()
})

describe('Join with a code on the locked starter-plan screen', () => {
  it('lets a new phone join straight away, without unlocking or entering names', async () => {
    render(<UnlockPreload preload={file} onFinished={() => {}} onSkip={() => {}} />)
    expect(screen.queryByLabelText('Pairing code')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Join a shared planner with a code' }))
    await userEvent.type(screen.getByLabelText('Pairing code'), CODE)
    await userEvent.click(screen.getByRole('button', { name: 'Replace this phone and join' }))
    expect(rt.joinWithCode).toHaveBeenCalledWith(CODE)
    await vi.waitFor(() => expect(reloadApp).toHaveBeenCalledTimes(1))
  })

  it('shows why joining failed and stays on the screen', async () => {
    rt.joinWithCode.mockRejectedValue(new Error('No shared planner found for this code.'))
    render(<UnlockPreload preload={file} onFinished={() => {}} onSkip={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Join a shared planner with a code' }))
    await userEvent.type(screen.getByLabelText('Pairing code'), CODE)
    await userEvent.click(screen.getByRole('button', { name: 'Replace this phone and join' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No shared planner found for this code.')
    expect(reloadApp).not.toHaveBeenCalled()
  })

  it('can be closed again', async () => {
    render(<UnlockPreload preload={file} onFinished={() => {}} onSkip={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Join a shared planner with a code' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('Pairing code')).toBeNull()
  })
})

describe('Join with a code on the names screen', () => {
  it('is offered to a phone that has not been set up', async () => {
    renderScreen(<p>app</p>) // no people saved: the "Who's using this planner?" screen
    expect(await screen.findByRole('heading', { name: "Who's using this planner?" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Already set up on another phone? Join with a code' }))
    await userEvent.type(screen.getByLabelText('Pairing code'), CODE)
    await userEvent.click(screen.getByRole('button', { name: 'Replace this phone and join' }))
    expect(rt.joinWithCode).toHaveBeenCalledWith(CODE)
    await vi.waitFor(() => expect(reloadApp).toHaveBeenCalledTimes(1))
  })

  it('rejects something that is not a code', async () => {
    renderScreen(<p>app</p>)
    await userEvent.click(await screen.findByRole('button', { name: 'Already set up on another phone? Join with a code' }))
    await userEvent.type(screen.getByLabelText('Pairing code'), 'hello')
    await userEvent.click(screen.getByRole('button', { name: 'Replace this phone and join' }))
    expect(screen.getByRole('alert')).toHaveTextContent("That doesn't look like a pairing code.")
    expect(rt.joinWithCode).not.toHaveBeenCalled()
  })
})
