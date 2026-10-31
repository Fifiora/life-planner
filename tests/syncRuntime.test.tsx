import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { getCode, getSyncStatus, joinWithCode, resumeSync, setSyncDepsForTests, startSharing, stopSyncing, testConnection, useSyncStatus } from '../src/data/syncRuntime'
import { deriveKey, householdId, isValidCode, generateCode } from '../src/lib/syncCrypto'
import { SyncEngine } from '../src/lib/syncEngine'
import type { Row } from '../src/types'
import { FakeBackend, MemoryKV, MemoryLocal, offline } from './syncHelpers'

const row = (id: string, extra: Record<string, unknown> = {}): Row => ({ id, name: `Item ${id}`, ...extra })
// Web Crypto runs on real time, not fake time: after moving the clock, give it real turns to finish.
const settle = async () => {
  for (let i = 0; i < 40; i++) await new Promise((r) => setImmediate(r))
}
async function flush(ms = 0) {
  let left = ms
  await vi.advanceTimersByTimeAsync(0)
  await settle()
  while (left > 0) {
    const step = Math.min(1000, left)
    await vi.advanceTimersByTimeAsync(step)
    await settle()
    left -= step
  }
}

let backend: FakeBackend
let local: MemoryLocal
let kv: MemoryKV
let downloads: ReturnType<typeof vi.fn>
let readOnly = false

function useDevice(over: { local?: MemoryLocal; kv?: MemoryKV } = {}) {
  local = over.local ?? new MemoryLocal()
  kv = over.kv ?? new MemoryKV()
  setSyncDepsForTests({ transport: backend, kv, local, now: () => Date.now(), downloadBackup: downloads, isReadOnly: () => readOnly })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  localStorage.clear()
  readOnly = false
  backend = new FakeBackend()
  downloads = vi.fn()
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  useDevice()
})
afterEach(() => {
  setSyncDepsForTests(null)
  vi.useRealTimers()
})

describe('starting to share', () => {
  it('makes a code, uploads what is here and reports it synced', async () => {
    local.tables = { bills: [row('b1'), row('b2')] }
    const code = await startSharing()
    expect(isValidCode(code)).toBe(true)
    expect(getCode()).toBe(code)
    expect(backend.rows.size).toBe(2)
    expect(getSyncStatus()).toMatchObject({ state: 'idle', pending: 0 })
  })
})

describe('joining', () => {
  async function sharedFromAnotherPhone() {
    local.tables = { bills: [row('b1', { amount: 1700 })], places: [row('p1')] }
    const code = await startSharing()
    setSyncDepsForTests(null)
    return code
  }

  it('rejects a code that is not a pairing code and touches nothing', async () => {
    local.tables = { routines: [row('own')] }
    await expect(joinWithCode('not a code')).rejects.toThrow(/pairing code/i)
    expect(downloads).not.toHaveBeenCalled()
    expect(local.rows('routines')).toHaveLength(1)
    expect(getCode()).toBeNull()
  })

  it('downloads a backup first, then makes this phone match the shared planner', async () => {
    const code = await sharedFromAnotherPhone()
    useDevice()
    local.tables = { routines: [row('own')] }
    localStorage.setItem('lp.me', 'someone')
    let heldWhenBackedUp = -1
    downloads.mockImplementation(() => {
      heldWhenBackedUp = local.rows('routines').length
    })
    await joinWithCode(code.toLowerCase())
    expect(heldWhenBackedUp).toBe(1) // the backup was taken before anything was replaced
    expect(local.rows('routines')).toEqual([])
    expect(local.rows('bills')).toEqual([{ id: 'b1', name: 'Item b1', amount: 1700 }])
    expect(localStorage.getItem('lp.me')).toBeNull()
    expect(getCode()).toBe(code)
    expect(getSyncStatus()?.state).toBe('idle')
  })

  it('leaves the phone as it was when the shared planner cannot be reached', async () => {
    const code = await sharedFromAnotherPhone()
    useDevice()
    local.tables = { routines: [row('own')] }
    backend.failAlways = offline()
    await expect(joinWithCode(code)).rejects.toThrow()
    expect(local.rows('routines')).toHaveLength(1)
    expect(getCode()).toBeNull()
    expect(getSyncStatus()).toBeNull()
  })
})

describe('staying in step', () => {
  async function sharing() {
    await startSharing()
    backend.pushes.length = 0
    backend.pulls.length = 0
  }

  it('sends an edit one second after it was made, as one push for several edits', async () => {
    await sharing()
    local.put('bills', row('b1'))
    await flush(999)
    expect(backend.pushes).toHaveLength(0)
    local.put('bills', row('b2'))
    await flush(1000)
    expect(backend.pushes).toHaveLength(1)
    expect(backend.pushes[0]).toHaveLength(2)
  })

  it('tells the other phones after it sent something', async () => {
    await sharing()
    const before = backend.notified
    local.put('bills', row('b1'))
    await flush(1000)
    expect(backend.notified).toBeGreaterThan(before)
  })

  it('checks for news every 20 seconds while the app is visible, not while it is hidden', async () => {
    await sharing()
    await flush(20_000)
    expect(backend.pulls).toHaveLength(1)
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    await flush(60_000)
    expect(backend.pulls).toHaveLength(1)
  })

  it('checks when the phone comes back online and when the app is shown again', async () => {
    await sharing()
    window.dispatchEvent(new Event('online'))
    await flush(0)
    expect(backend.pulls).toHaveLength(1)
    document.dispatchEvent(new Event('visibilitychange'))
    await flush(0)
    expect(backend.pulls).toHaveLength(2)
  })

  it('checks straight away when another phone says something changed', async () => {
    await sharing()
    backend.emitChanged()
    await flush(0)
    expect(backend.pulls).toHaveLength(1)
  })

  it('shows what another phone changed as soon as it says so', async () => {
    const code = await startSharing()
    const otherLocal = new MemoryLocal()
    const other = new SyncEngine({ household: await householdId(code), key: await deriveKey(code), local: otherLocal, transport: backend, kv: new MemoryKV(), device: 5 })
    other.start()
    otherLocal.put('bills', row('from-other'))
    await other.syncNow()
    backend.emitChanged()
    await flush(0)
    expect(local.rows('bills').map((r) => r.id)).toEqual(['from-other'])
  })
})

describe('when the connection fails', () => {
  it('retries after 10 s, 20 s, 40 s ... never more than 300 s apart, and starts over after a success', async () => {
    await startSharing()
    backend.attempts.length = 0
    backend.failAlways = offline()
    local.put('bills', row('b1'))
    await flush(1000 + 10_000 + 20_000 + 40_000 + 80_000 + 160_000 + 300_000 + 300_000 + 1000)
    const gaps = backend.attempts.slice(1).map((t, i) => t - backend.attempts[i])
    expect(gaps.slice(0, 7)).toEqual([10_000, 20_000, 40_000, 80_000, 160_000, 300_000, 300_000])
    expect(getSyncStatus()).toMatchObject({ state: 'offline', pending: 1 })
    backend.failAlways = null
    await flush(300_000)
    expect(getSyncStatus()).toMatchObject({ state: 'idle', pending: 0 })
    backend.attempts.length = 0
    backend.failAlways = offline()
    local.put('bills', row('b2'))
    await flush(1000 + 10_000 + 20_000 + 1)
    const again = backend.attempts.slice(1).map((t, i) => t - backend.attempts[i])
    expect(again.slice(0, 2)).toEqual([10_000, 20_000])
  })
})

describe('resuming, stopping and testing', () => {
  it('does nothing on a phone that never started sharing, or in a view-only copy', async () => {
    resumeSync()
    await flush(25_000)
    expect(backend.pulls).toHaveLength(0)
    kv.set('lp.sync.code', generateCode())
    readOnly = true
    resumeSync()
    await flush(25_000)
    expect(backend.pulls).toHaveLength(0)
  })

  it('carries on after a restart when a code is saved', async () => {
    const code = await startSharing()
    setSyncDepsForTests(null)
    useDevice({ local: new MemoryLocal(), kv: Object.assign(new MemoryKV(), {}) })
    kv.set('lp.sync.code', code)
    backend.pulls.length = 0
    resumeSync()
    await flush(0)
    expect(backend.pulls.length).toBeGreaterThanOrEqual(1)
    expect(getSyncStatus()).not.toBeNull()
  })

  it('stopping forgets the code and the sync notes but keeps the rows, and stops sending', async () => {
    await startSharing()
    local.put('bills', row('b1'))
    await flush(1000)
    stopSyncing()
    expect([...kv.m.keys()].filter((k) => k.startsWith('lp.sync.'))).toEqual([])
    expect(getCode()).toBeNull()
    expect(local.rows('bills')).toHaveLength(1)
    const pushes = backend.pushes.length
    local.put('bills', row('b2'))
    await flush(30_000)
    expect(backend.pushes.length).toBe(pushes)
    expect(getSyncStatus()).toBeNull()
  })

  it('tests the connection', async () => {
    expect(await testConnection()).toBe('ok')
    backend.failAlways = offline()
    expect(await testConnection()).toBe('No connection')
  })
})

describe('useSyncStatus', () => {
  function Probe() {
    const s = useSyncStatus()
    return <p>{s ? `${s.state}/${s.pending}` : 'not sharing'}</p>
  }
  it('is empty until sharing and then follows the state', async () => {
    render(<Probe />)
    expect(screen.getByText('not sharing')).toBeInTheDocument()
    await act(async () => {
      await startSharing()
    })
    expect(screen.getByText('idle/0')).toBeInTheDocument()
    await act(async () => {
      local.put('bills', row('b1'))
    })
    expect(screen.getByText('idle/1')).toBeInTheDocument()
  })
})
