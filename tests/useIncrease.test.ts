import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIncrease } from '../src/data/useIncrease'

afterEach(() => vi.useRealTimers())

describe('useIncrease', () => {
  it('is quiet when the app opens, even if the count is already high', () => {
    const { result } = renderHook(({ n }) => useIncrease(n), { initialProps: { n: 3 } })
    expect(result.current).toBe(false)
  })
  it('turns on when the count goes up, then off again after a moment', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ n }) => useIncrease(n), { initialProps: { n: 2 } })
    rerender({ n: 3 })
    expect(result.current).toBe(true)
    act(() => {
      vi.advanceTimersByTime(2500)
    })
    expect(result.current).toBe(false)
  })
  it('stays off when the count goes down or stays the same', () => {
    const { result, rerender } = renderHook(({ n }) => useIncrease(n), { initialProps: { n: 2 } })
    rerender({ n: 2 })
    expect(result.current).toBe(false)
    rerender({ n: 1 })
    expect(result.current).toBe(false)
  })
})
