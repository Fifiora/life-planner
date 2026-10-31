import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Settings from '../src/screens/Settings'
import { getAllRows, loadSnapshot } from '../src/data/tableStore'
import { PageHead } from '../src/ui/PageHead'
import { SyncCard } from '../src/ui/SyncCard'
import { SyncStatus } from '../src/ui/SyncStatus'
import type { SyncStatus as Status } from '../src/lib/syncEngine'
import { renderScreen, seedPlanner } from './seed'

const rt = vi.hoisted(() => ({
  code: null as string | null,
  status: null as Status | null,
  startSharing: vi.fn(),
  joinWithCode: vi.fn(),
  stopSyncing: vi.fn(),
  testConnection: vi.fn(),
}))
vi.mock('../src/data/syncRuntime', () => ({
  getCode: () => rt.code,
  useSyncStatus: () => rt.status,
  startSharing: (...a: unknown[]) => rt.startSharing(...a),
  joinWithCode: (...a: unknown[]) => rt.joinWithCode(...a),
  stopSyncing: (...a: unknown[]) => rt.stopSyncing(...a),
  testConnection: (...a: unknown[]) => rt.testConnection(...a),
}))

const CODE = 'ABCD-EFGH-JKMN-PQRS-TUVW-XYZ2'
const idle = (over: Partial<Status> = {}): Status => ({ state: 'idle', lastSyncedAt: Date.now() - 1000, pending: 0, ...over })

beforeEach(() => {
  seedPlanner()
  rt.code = null
  rt.status = null
  rt.startSharing.mockReset().mockImplementation(async () => {
    rt.code = CODE
    rt.status = idle()
    return CODE
  })
  rt.joinWithCode.mockReset().mockResolvedValue(undefined)
  rt.stopSyncing.mockReset().mockImplementation(() => {
    rt.code = null
    rt.status = null
  })
  rt.testConnection.mockReset().mockResolvedValue('ok')
})

describe('Live sync card: not sharing yet', () => {
  it('offers to start sharing or to join', () => {
    renderScreen(<SyncCard />)
    expect(screen.getByRole('heading', { name: 'Live sync' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start sharing' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join with a code' })).toBeInTheDocument()
  })

  it('shows the new code once, with a warning, after starting', async () => {
    renderScreen(<SyncCard />)
    await userEvent.click(screen.getByRole('button', { name: 'Start sharing' }))
    expect(await screen.findByText(CODE)).toBeInTheDocument()
    expect(screen.getByText(/Keep this code safe: anyone with it can read and change your planner/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByText(CODE)).toBeNull()
    expect(screen.getByRole('button', { name: 'Show code' })).toBeInTheDocument()
  })

  it('says so when starting fails', async () => {
    rt.startSharing.mockRejectedValue(new Error('Could not reach the sync server.'))
    renderScreen(<SyncCard />)
    await userEvent.click(screen.getByRole('button', { name: 'Start sharing' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the sync server.')
  })
})

describe('Live sync card: joining', () => {
  async function open() {
    const onJoined = vi.fn()
    renderScreen(<SyncCard onJoined={onJoined} />)
    await userEvent.click(screen.getByRole('button', { name: 'Join with a code' }))
    return onJoined
  }

  it('warns that this phone will be replaced', async () => {
    await open()
    expect(screen.getByText(/This replaces everything on this phone with the shared planner\. A backup file is downloaded first\. Use a phone you have not used yet\./)).toBeInTheDocument()
  })

  it('rejects something that is not a pairing code without calling the runtime', async () => {
    await open()
    await userEvent.type(screen.getByLabelText('Pairing code'), 'hello')
    await userEvent.click(screen.getByRole('button', { name: 'Replace this phone and join' }))
    expect(screen.getByRole('alert')).toHaveTextContent("That doesn't look like a pairing code.")
    expect(rt.joinWithCode).not.toHaveBeenCalled()
  })

  it('joins with a valid code and then lets the app reload', async () => {
    const onJoined = await open()
    await userEvent.type(screen.getByLabelText('Pairing code'), CODE.toLowerCase())
    await userEvent.click(screen.getByRole('button', { name: 'Replace this phone and join' }))
    expect(rt.joinWithCode).toHaveBeenCalledWith(CODE.toLowerCase())
    await vi.waitFor(() => expect(onJoined).toHaveBeenCalledTimes(1))
  })

  it('shows the reason when joining fails', async () => {
    rt.joinWithCode.mockRejectedValue(new Error('No shared planner found for this code.'))
    const onJoined = await open()
    await userEvent.type(screen.getByLabelText('Pairing code'), CODE)
    await userEvent.click(screen.getByRole('button', { name: 'Replace this phone and join' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No shared planner found for this code.')
    expect(onJoined).not.toHaveBeenCalled()
  })
})

describe('Live sync card: sharing', () => {
  beforeEach(() => {
    rt.code = CODE
    rt.status = idle()
  })

  it('keeps the code hidden until asked', async () => {
    renderScreen(<SyncCard />)
    expect(screen.queryByText(CODE)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Show code' }))
    expect(screen.getByText(CODE)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Hide code' }))
    expect(screen.queryByText(CODE)).toBeNull()
  })

  it('copies the code', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderScreen(<SyncCard />)
    await userEvent.click(screen.getByRole('button', { name: 'Copy code' }))
    expect(writeText).toHaveBeenCalledWith(CODE)
  })

  it('tests the connection and shows the answer', async () => {
    renderScreen(<SyncCard />)
    await userEvent.click(screen.getByRole('button', { name: 'Test connection' }))
    expect(await screen.findByRole('status', { name: 'Connection test' })).toHaveTextContent('Connected')
    rt.testConnection.mockResolvedValue('The sync functions are missing: run docs/supabase/setup.sql in Supabase (SQL Editor).')
    await userEvent.click(screen.getByRole('button', { name: 'Test connection' }))
    expect(await screen.findByRole('status', { name: 'Connection test' })).toHaveTextContent('setup.sql')
  })

  it('needs a second tap to stop, then keeps the data', async () => {
    renderScreen(<SyncCard />)
    await userEvent.click(screen.getByRole('button', { name: 'Stop syncing on this phone' }))
    expect(rt.stopSyncing).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Yes, stop syncing' }))
    expect(rt.stopSyncing).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/Syncing stopped\. Everything stays on this phone\./)).toBeInTheDocument()
  })

  it('warns that importing a backup replaces the shared planner', () => {
    renderScreen(<SyncCard />)
    expect(screen.getByText(/importing a backup on this phone replaces the shared planner on every phone/i)).toBeInTheDocument()
  })
})

describe('Live sync card: view-only copy', () => {
  it('is not shown', () => {
    loadSnapshot(getAllRows())
    renderScreen(<SyncCard />)
    expect(screen.queryByRole('heading', { name: 'Live sync' })).toBeNull()
  })
})

describe('Settings', () => {
  it('has the Live sync card', async () => {
    renderScreen(<Settings />)
    expect(await screen.findByRole('heading', { name: 'Live sync' })).toBeInTheDocument()
  })
})

describe('Sync status chip', () => {
  const text = (s: Status | null) => {
    rt.status = s
    renderScreen(<SyncStatus />)
  }
  it('shows nothing when this phone is not sharing', () => {
    text(null)
    expect(screen.queryByRole('status', { name: 'Sync status' })).toBeNull()
  })
  it.each([
    [idle({ lastSyncedAt: Date.now() - 1000 }), 'Synced just now'],
    [idle({ lastSyncedAt: Date.now() - 2 * 60_000 - 500 }), 'Synced 2 min ago'],
    [idle({ lastSyncedAt: Date.now() - 3 * 3600_000 - 500 }), 'Synced 3 h ago'],
    [idle({ state: 'syncing' }), 'Syncing…'],
    [idle({ pending: 3 }), 'Sending 3 changes…'],
    [idle({ state: 'offline', pending: 2 }), 'Offline, changes are saved here'],
    [idle({ state: 'error', message: 'bad household' }), 'Sync problem'],
  ])('says the right thing for %j', (status, expected) => {
    text(status)
    expect(screen.getByRole('status', { name: 'Sync status' })).toHaveTextContent(expected)
  })
  it('is in the page header, and not in a view-only copy', () => {
    rt.status = idle()
    const { unmount } = renderScreen(<PageHead title="Today" />)
    expect(within(screen.getByRole('banner')).getByRole('status', { name: 'Sync status' })).toBeInTheDocument()
    unmount()
    loadSnapshot(getAllRows())
    renderScreen(<PageHead title="Today" />)
    expect(screen.queryByRole('status', { name: 'Sync status' })).toBeNull()
  })
})
