import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import Today from '../src/screens/Today'
import { renderScreen, seedPlanner } from './seed'

beforeEach(() => seedPlanner())

describe('Today hero wording', () => {
  it('speaks plainly', async () => {
    renderScreen(<Today />)
    expect(await screen.findByText(/A fresh day|Keep going|All done today|Nothing is scheduled/)).toBeInTheDocument()
    expect(screen.queryByText(/Power rising|New episode, new chance/)).toBeNull()
  })
})
