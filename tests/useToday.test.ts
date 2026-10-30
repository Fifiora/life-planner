import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToday } from '../src/data/useToday'

afterEach(() => vi.useRealTimers())

describe('useToday', () => {
  it('moves to the next Chicago day if the app stays open overnight', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-03T15:00:00Z'))
    const { result } = renderHook(() => useToday())
    expect(result.current).toBe('2026-11-03')
    act(() => {
      vi.setSystemTime(new Date('2026-11-04T13:00:00Z'))
      vi.advanceTimersByTime(60_000)
    })
    expect(result.current).toBe('2026-11-04')
  })
})
