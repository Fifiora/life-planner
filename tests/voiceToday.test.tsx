import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import Today from '../src/screens/Today'
import { renderScreen, seedPlanner } from './seed'

beforeEach(() => seedPlanner())

describe('Today hero wording follows the style', () => {
  it('speaks anime by default', async () => {
    renderScreen(<Today />)
    expect(await screen.findByText(/Quiet day\.|Cleared!|Power rising!|New episode, new chance/)).toBeInTheDocument()
    expect(screen.queryByText(/A fresh day|Keep going, you|All done today/)).toBeNull()
  })

  it('speaks plainly in Classic', async () => {
    localStorage.setItem('lp.style', 'classic')
    renderScreen(<Today />)
    expect(await screen.findByText(/A fresh day|Keep going|All done today/)).toBeInTheDocument()
    expect(screen.queryByText(/Power rising|New episode, new chance/)).toBeNull()
  })
})
