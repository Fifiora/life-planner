import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { generateCode } from '../src/lib/syncCrypto'

vi.mock('../src/data/syncRuntime', async (importOriginal) => ({ ...(await importOriginal<typeof import('../src/data/syncRuntime')>()), joinWithCode: vi.fn() }))
import { PinRequiredError, joinWithCode } from '../src/data/syncRuntime'
import { JoinForm } from '../src/ui/JoinForm'

const code = generateCode()
beforeEach(() => {
  vi.mocked(joinWithCode).mockReset()
  localStorage.clear()
})

const enterCode = async () => {
  await userEvent.type(screen.getByLabelText('Pairing code'), code)
  await userEvent.click(screen.getByRole('button', { name: /replace this phone and join/i }))
}

describe('JoinForm with a PIN', () => {
  it('asks for the PIN when the planner has one, then joins with it', async () => {
    vi.mocked(joinWithCode).mockRejectedValueOnce(new PinRequiredError()).mockResolvedValueOnce(undefined)
    const onJoined = vi.fn()
    render(<JoinForm onJoined={onJoined} />)
    expect(screen.queryByLabelText('PIN')).toBeNull()
    await enterCode()
    expect(await screen.findByLabelText('PIN')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/has a PIN/i)
    expect(onJoined).not.toHaveBeenCalled()
    await userEvent.type(screen.getByLabelText('PIN'), '1234')
    await userEvent.click(screen.getByRole('button', { name: /replace this phone and join/i }))
    expect(joinWithCode).toHaveBeenLastCalledWith(code, { pin: '1234' })
    expect(onJoined).toHaveBeenCalledTimes(1)
  })
  it('shows a wrong PIN and does not join', async () => {
    vi.mocked(joinWithCode).mockRejectedValueOnce(new PinRequiredError()).mockRejectedValueOnce(new Error("That PIN isn't right."))
    const onJoined = vi.fn()
    render(<JoinForm onJoined={onJoined} />)
    await enterCode()
    await userEvent.type(await screen.findByLabelText('PIN'), '0000')
    await userEvent.click(screen.getByRole('button', { name: /replace this phone and join/i }))
    expect(await screen.findByText("That PIN isn't right.")).toBeInTheDocument()
    expect(onJoined).not.toHaveBeenCalled()
  })
  it('forgets this phone\'s own PIN once it has joined', async () => {
    vi.mocked(joinWithCode).mockResolvedValueOnce(undefined)
    localStorage.setItem('lp.pin', '{"v":1}')
    render(<JoinForm onJoined={vi.fn()} />)
    await enterCode()
    await vi.waitFor(() => expect(localStorage.getItem('lp.pin')).toBeNull())
  })
})
