import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { pipMood } from '../src/lib/pip'
import { Pip } from '../src/ui/Pip'
import { TodayHero } from '../src/ui/TodayHero'

beforeEach(() => localStorage.clear())

describe('pipMood', () => {
  it('is proud when everything is done', () => {
    expect(pipMood({ done: 3, total: 3, streak: 0, part: 'afternoon' })).toBe('proud')
  })
  it('is hyped on a streak of 3 even before anything is done', () => {
    expect(pipMood({ done: 0, total: 4, streak: 3, part: 'morning' })).toBe('hyped')
  })
  it('is hyped when half the day is done', () => {
    expect(pipMood({ done: 2, total: 4, streak: 0, part: 'afternoon' })).toBe('hyped')
  })
  it('is sleepy in the morning or evening with nothing done', () => {
    expect(pipMood({ done: 0, total: 4, streak: 0, part: 'morning' })).toBe('sleepy')
    expect(pipMood({ done: 0, total: 4, streak: 0, part: 'evening' })).toBe('sleepy')
  })
  it('is happy otherwise', () => {
    expect(pipMood({ done: 1, total: 4, streak: 0, part: 'afternoon' })).toBe('happy')
    expect(pipMood({ done: 0, total: 4, streak: 0, part: 'afternoon' })).toBe('happy')
  })
})

describe('Pip', () => {
  it('is a labelled picture', () => {
    render(<Pip mood="hyped" />)
    expect(screen.getByRole('img', { name: 'Pip is hyped' })).toBeInTheDocument()
  })
})

describe('Pip in the hero', () => {
  const hero = () => (
    <MemoryRouter>
      <TodayHero rings={[]} done={3} total={3} streak={0} part="afternoon" />
    </MemoryRouter>
  )
  it('shows in the anime style', () => {
    render(hero())
    expect(screen.getByRole('img', { name: 'Pip is proud' })).toBeInTheDocument()
  })
  it('is gone in Classic', () => {
    localStorage.setItem('lp.style', 'classic')
    render(hero())
    expect(screen.queryByRole('img', { name: /^Pip/ })).toBeNull()
  })
})
