import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { HouseholdContext } from '../src/data/household'
import { useTable } from '../src/data/useTable'
import { ToastProvider } from '../src/ui/Toast'

type Result = { data: any[]; error: null }
const state = vi.hoisted(() => ({
  rows: [] as any[],
  insertError: null as null | { message: string },
  inserted: [] as any[],
  deleted: [] as string[],
  selectQueue: [] as Promise<any>[],
  insertGate: null as null | Promise<void>,
}))

vi.mock('../src/lib/supabase', () => {
  const builder = (table: string) => ({
    select: () => ({
      eq: () => (state.selectQueue.length ? state.selectQueue.shift()! : Promise.resolve({ data: [...state.rows], error: null })),
    }),
    insert: async (row: any) => {
      state.inserted.push({ table, row })
      if (state.insertGate) await state.insertGate
      if (!state.insertError) state.rows.push({ id: 'server-1', ...row })
      return { error: state.insertError }
    },
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    delete: () => ({
      eq: (_col: string, id: string) => {
        state.deleted.push(id)
        return Promise.resolve({ error: null })
      },
    }),
  })
  const channel = { on: () => channel, subscribe: () => channel }
  return {
    supabase: { from: builder, channel: () => channel, removeChannel: () => {} },
    isConfigured: true,
  }
})

const me = { id: 'm1', user_id: 'u1', display_name: 'A', color: '#000' }
const wrapper = ({ children }: { children: ReactNode }) => (
  <ToastProvider>
    <HouseholdContext.Provider value={{ householdId: 'h1', members: [me], me }}>{children}</HouseholdContext.Provider>
  </ToastProvider>
)

type Row = { id: string; name: string }

beforeEach(() => {
  state.rows = [{ id: 'a', name: 'Existing', household_id: 'h1' }]
  state.insertError = null
  state.inserted = []
  state.deleted = []
  state.selectQueue = []
  state.insertGate = null
})

describe('useTable', () => {
  it('loads the household rows on mount', async () => {
    const { result } = renderHook(() => useTable<Row>('routines'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows.map((r) => r.name)).toEqual(['Existing'])
  })

  it('adds an inserted row immediately and stamps the household id', async () => {
    const { result } = renderHook(() => useTable<Row>('routines'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.insert({ name: 'New' })
    })
    expect(result.current.rows.some((r) => r.name === 'New')).toBe(true)
    expect(state.inserted[0].row.household_id).toBe('h1')
  })

  it('rolls back and reports an error when the insert fails', async () => {
    state.insertError = { message: 'nope' }
    const { result } = renderHook(() => useTable<Row>('routines'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.insert({ name: 'Doomed' })
    })
    expect(result.current.rows.some((r) => r.name === 'Doomed')).toBe(false)
    expect(result.current.error).toBe('nope')
  })

  it('tells the user when a save fails', async () => {
    state.insertError = { message: 'nope' }
    const { result } = renderHook(() => useTable<Row>('routines'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.insert({ name: 'Doomed' })
    })
    expect(await screen.findByText(/couldn't save/i)).toBeInTheDocument()
  })

  it('ignores a delete for a row that has not been saved yet', async () => {
    let release!: () => void
    state.insertGate = new Promise<void>((r) => (release = r))
    const { result } = renderHook(() => useTable<Row>('routines'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    let pending!: Promise<void>
    act(() => {
      pending = result.current.insert({ name: 'Pending' })
    })
    const temp = result.current.rows.find((r) => r.name === 'Pending')!
    expect(temp.id.startsWith('tmp-')).toBe(true)

    await act(async () => {
      await result.current.remove(temp.id)
    })
    expect(state.deleted).toEqual([])

    await act(async () => {
      release()
      await pending
    })
  })

  it('keeps the newest rows when an older load finishes last', async () => {
    const { result } = renderHook(() => useTable<Row>('routines'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    let resolveOld!: (v: Result) => void
    let resolveNew!: (v: Result) => void
    state.selectQueue.push(new Promise((r) => (resolveOld = r)), new Promise((r) => (resolveNew = r)))

    let first!: Promise<void>
    let second!: Promise<void>
    act(() => {
      first = result.current.refetch()
      second = result.current.refetch()
    })
    await act(async () => {
      resolveNew({ data: [{ id: 'n', name: 'Newest' }], error: null })
      await second
      resolveOld({ data: [{ id: 'o', name: 'Stale' }], error: null })
      await first
    })
    expect(result.current.rows.map((r) => r.name)).toEqual(['Newest'])
  })
})
