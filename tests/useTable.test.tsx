import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useTable } from '../src/data/useTable'
import { loadSnapshot, resetStore } from '../src/data/tableStore'
import { ToastProvider } from '../src/ui/Toast'

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>
type Row = { id: string; name: string }
const saved = (t: string) => JSON.parse(localStorage.getItem(`lp.data.${t}`) ?? '[]')

beforeEach(() => {
  localStorage.clear()
  resetStore()
})
afterEach(() => vi.restoreAllMocks())

describe('useTable', () => {
  it('shows what is saved on this phone straight away', () => {
    localStorage.setItem('lp.data.routines', JSON.stringify([{ id: 'a', name: 'Existing' }]))
    const { result } = renderHook(() => useTable<Row>('routines'), { wrapper })
    expect(result.current.loading).toBe(false)
    expect(result.current.rows.map((r) => r.name)).toEqual(['Existing'])
  })

  it('adds a row and keeps it', async () => {
    const { result } = renderHook(() => useTable<Row>('routines'), { wrapper })
    await act(async () => {
      await result.current.insert({ name: 'New' })
    })
    expect(result.current.rows.map((r) => r.name)).toEqual(['New'])
    expect(saved('routines')[0].name).toBe('New')
  })

  it('updates and removes rows', async () => {
    localStorage.setItem('lp.data.routines', JSON.stringify([{ id: 'a', name: 'One' }, { id: 'b', name: 'Two' }]))
    const { result } = renderHook(() => useTable<Row>('routines'), { wrapper })
    await act(async () => {
      await result.current.update('a', { name: 'One!' })
      await result.current.remove('b')
    })
    expect(saved('routines')).toEqual([{ id: 'a', name: 'One!' }])
  })

  it('tells the user when the phone cannot save', async () => {
    const { result } = renderHook(() => useTable<Row>('routines'), { wrapper })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    await act(async () => {
      await result.current.insert({ name: 'Doomed' })
    })
    expect(result.current.rows).toEqual([])
    expect(result.current.error).toMatch(/storage may be full/i)
    expect(await screen.findByText(/couldn't save/i)).toBeInTheDocument()
  })

  it('says the copy is view-only if a change is attempted on a shared copy', async () => {
    loadSnapshot({ routines: [{ id: 'a', name: 'Shared' }] })
    const { result } = renderHook(() => useTable<Row>('routines'), { wrapper })
    await act(async () => {
      await result.current.insert({ name: 'Nope' })
    })
    expect(result.current.rows.map((r) => r.name)).toEqual(['Shared'])
    expect(await screen.findByText(/view-only/i)).toBeInTheDocument()
  })
})
