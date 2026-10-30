import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NightsView } from '../src/ui/NightsView'
import type { Member, NightOption, NightVote } from '../src/types'

const members: Member[] = [
  { id: 'a', user_id: 'ua', display_name: 'Ada', color: '#111' },
  { id: 'b', user_id: 'ub', display_name: 'Ben', color: '#222' },
]
const opt = (id: string, activity: string): NightOption => ({ id, slot_date: '2026-11-14', type: 'game', proposed_by: 'a', activity, snack: 'popcorn' })
const vote = (option_id: string, member_id: string): NightVote => ({ id: option_id + member_id, option_id, member_id })

const base = { members, meId: 'a', hostId: 'b', onVote: () => {}, onAdd: () => {}, onDone: () => {} }

describe('NightsView', () => {
  it('shows an empty state with no options', () => {
    render(<NightsView {...base} options={[]} votes={[]} />)
    expect(screen.getByText(/no ideas yet/i)).toBeInTheDocument()
  })

  it('announces a tie instead of a winner', () => {
    render(<NightsView {...base} options={[opt('x', 'Chess'), opt('y', 'Painting')]} votes={[vote('x', 'a'), vote('y', 'b')]} />)
    expect(screen.getByText(/tie — flip a coin/i)).toBeInTheDocument()
    expect(screen.queryByText(/winner/i)).not.toBeInTheDocument()
  })

  it('shows the winner when one option leads', () => {
    render(<NightsView {...base} options={[opt('x', 'Chess'), opt('y', 'Painting')]} votes={[vote('x', 'a'), vote('x', 'b')]} />)
    expect(screen.getByText(/winner: chess/i)).toBeInTheDocument()
  })

  it('requires both an activity and a snack to add an idea', async () => {
    const onAdd = vi.fn()
    render(<NightsView {...base} options={[]} votes={[]} onAdd={onAdd} />)
    await userEvent.type(screen.getByLabelText('Activity'), 'Scrabble')
    await userEvent.click(screen.getByRole('button', { name: 'Add idea' }))
    expect(onAdd).not.toHaveBeenCalled()
    await userEvent.type(screen.getByLabelText('Snack'), 'Chips')
    await userEvent.click(screen.getByRole('button', { name: 'Add idea' }))
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ activity: 'Scrabble', snack: 'Chips' }))
  })
})
