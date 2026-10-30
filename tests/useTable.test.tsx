import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { HouseholdContext } from '../src/data/household'
import { useTable } from '../src/data/useTable'

const state = vi.hoisted(() => ({
  rows: [] as any[],
  insertError: null as null | { message: string },
  inserted: [] as any[],
}))

vi.mock('../src/lib/supabase', () => {
  const builder = (table: string) => ({
    select: () => ({ eq: () => Promise.resolve({ data: [...state.rows], error: null }) }),
    insert: (row: any) => {
      state.inserted.push({ table, row })
      if (!state.insertError) state.rows.push({ id: 'server-1', ...row })
      return Promise.resolve({ error: state.insertError })
    },
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
  })
  const channel = { on: () => channel, subscribe: () => channel }
  return {
    supabase: { from: builder, channel: () => channel, removeChannel: () => {} },
    isConfigured: true,
  }
})

const me = { id: 'm1', user_id: 'u1', display_name: 'A', color: '#000' }
const wrapper = ({ children }: { children: ReactNode }) => (
  <HouseholdContext.Provider value={{ householdId: 'h1', members: [me], me }}>{children}</HouseholdContext.Provider>
)

beforeEach(() => {
  state.rows = [{ id: 'a', name: 'Existing', household_id: 'h1' }]
  state.insertError = null
  state.inserted = []
})

describe('useTable', () => {
  it('loads the household rows on mount', async () => {
    const { result } = renderHook(() => useTable<{ id: string; name: string }>('routines'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows.map((r) => r.name)).toEqual(['Existing'])
  })

  it('adds an inserted row immediately and stamps the household id', async () => {
    const { result } = renderHook(() => useTable<{ id: string; name: string }>('routines'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.insert({ name: 'New' })
    })
    expect(result.current.rows.some((r) => r.name === 'New')).toBe(true)
    expect(state.inserted[0].row.household_id).toBe('h1')
  })

  it('rolls back and reports an error when the insert fails', async () => {
    state.insertError = { message: 'nope' }
    const { result } = renderHook(() => useTable<{ id: string; name: string }>('routines'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.insert({ name: 'Doomed' })
    })
    expect(result.current.rows.some((r) => r.name === 'Doomed')).toBe(false)
    expect(result.current.error).toBe('nope')
  })
})
