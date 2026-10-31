import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PinGate } from '../src/ui/PinGate'

const record = { v: 1, salt: 'x', hash: 'y', iterations: 1 }
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

const renderGate = (verify = vi.fn().mockResolvedValue(true), onErase = vi.fn()) => {
  render(
    <PinGate verify={verify} onErase={onErase}>
      <p>Inside</p>
    </PinGate>,
  )
  return { verify, onErase }
}

describe('PinGate', () => {
  it('shows the app straight away when no PIN is set', () => {
    renderGate()
    expect(screen.getByText('Inside')).toBeInTheDocument()
  })

  it('stays open for the rest of the session once unlocked', () => {
    localStorage.setItem('lp.pin', JSON.stringify(record))
    sessionStorage.setItem('lp.unlocked', '1')
    renderGate()
    expect(screen.getByText('Inside')).toBeInTheDocument()
  })

  it('asks for the PIN, refuses a wrong one and opens for the right one', async () => {
    localStorage.setItem('lp.pin', JSON.stringify(record))
    const verify = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    renderGate(verify)
    expect(screen.queryByText('Inside')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('PIN'), '1111')
    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/wrong pin/i)
    expect(screen.queryByText('Inside')).not.toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('PIN'))
    await userEvent.type(screen.getByLabelText('PIN'), '2222')
    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    expect(await screen.findByText('Inside')).toBeInTheDocument()
    expect(sessionStorage.getItem('lp.unlocked')).toBe('1')
    expect(verify).toHaveBeenLastCalledWith('2222', record)
  })

  it('offers a way out if the PIN is forgotten, after a confirmation', async () => {
    localStorage.setItem('lp.pin', JSON.stringify(record))
    const { onErase } = renderGate()
    await userEvent.click(screen.getByRole('button', { name: /forgot pin/i }))
    expect(onErase).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /erase this phone and start over/i }))
    expect(onErase).toHaveBeenCalledTimes(1)
  })
})
