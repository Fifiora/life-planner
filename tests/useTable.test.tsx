import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useTable } from '../src/data/useTable'
import { resetStore } from '../src/data/tableStore'
import { saveConfig } from '../src/lib/githubStore'
import { ToastProvider } from '../src/ui/Toast'
import { installFakeGithub } from './fakeGithub'

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>
type Row = { id: string; name: string }

beforeEach(() => {
  localStorage.clear()
  saveConfig({ owner: 'o', repo: 'r', token: 't' })
  resetStore()
})
afterEach(() => vi.unstubAllGlobals())

describe('useTable', () => {
  it('loads the rows from the data repo', async () => {
    installFakeGithub({ routines: [{ id: 'a', name: 'Existing' }] })
    const { result } = renderHook(() => useTable<Row>('routines'), { wrapper })
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows.map((r) => r.name)).toEqual(['Existing'])
  })

  it('adds a row immediately and saves it to the repo', async () => {
    const gh = installFakeGithub({ routines: [] })
    const { result } = renderHook(() => useTable<Row>('routines'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.insert({ name: 'New' })
    })
    expect(result.current.rows.map((r) => r.name)).toEqual(['New'])
    expect(gh.rows('routines')[0].name).toBe('New')
  })

  it('rolls back and tells the user when a save fails', async () => {
    const gh = installFakeGithub({ routines: [] })
    const { result } = renderHook(() => useTable<Row>('routines'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    gh.state.failWrites = 500
    await act(async () => {
      await result.current.insert({ name: 'Doomed' })
    })
    expect(result.current.rows).toEqual([])
    expect(result.current.error).toMatch(/server says no/)
    expect(await screen.findByText(/couldn't save/i)).toBeInTheDocument()
  })

  it('updates and removes rows', async () => {
    const gh = installFakeGithub({ routines: [{ id: 'a', name: 'One' }, { id: 'b', name: 'Two' }] })
    const { result } = renderHook(() => useTable<Row>('routines'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.update('a', { name: 'One!' })
      await result.current.remove('b')
    })
    expect(gh.rows('routines')).toEqual([{ id: 'a', name: 'One!' }])
  })
})
