import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetStore } from '../src/data/tableStore'
import { PinGate } from '../src/ui/PinGate'

const record = { v: 1, salt: 'x', hash: 'y', iterations: 1 }
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  resetStore()
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

  it('uses the PIN shared through the paired planner', async () => {
    localStorage.setItem('lp.data.settings', JSON.stringify([{ id: 'household_pin', key: 'household_pin', value: JSON.stringify(record) }]))
    const { verify } = renderGate()
    expect(screen.queryByText('Inside')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('PIN'), '1234')
    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    expect(await screen.findByText('Inside')).toBeInTheDocument()
    expect(verify).toHaveBeenLastCalledWith('1234', record)
  })

  it('tells a paired phone that forgot the PIN to set a new one on another device', async () => {
    localStorage.setItem('lp.data.settings', JSON.stringify([{ id: 'household_pin', key: 'household_pin', value: JSON.stringify(record) }]))
    localStorage.setItem('lp.sync.code', 'ABCD')
    renderGate()
    await userEvent.click(screen.getByRole('button', { name: /forgot pin/i }))
    expect(screen.getByText(/still logged in/i)).toBeInTheDocument()
  })

  it('offers a way out if the PIN is forgotten, after a confirmation', async () => {
    localStorage.setItem('lp.pin', JSON.stringify(record))
    const { onErase } = renderGate()
    await userEvent.click(screen.getByRole('button', { name: /forgot pin/i }))
    expect(onErase).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /erase this phone and start over/i }))
    expect(onErase).toHaveBeenCalledTimes(1)
  })

  describe('locking again after being away', () => {
    const setVisibility = (state: 'hidden' | 'visible') =>
      act(() => {
        Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
        document.dispatchEvent(new Event('visibilitychange'))
      })

    const openUnlocked = (now: () => number) => {
      localStorage.setItem('lp.pin', JSON.stringify(record))
      sessionStorage.setItem('lp.unlocked', '1')
      render(
        <PinGate verify={vi.fn()} now={now}>
          <p>Inside</p>
        </PinGate>,
      )
    }

    it('locks after the chosen time away (one minute by default)', async () => {
      let t = 0
      openUnlocked(() => t)
      setVisibility('hidden')
      t = 2 * 60_000
      setVisibility('visible')
      expect(await screen.findByLabelText('PIN')).toBeInTheDocument()
      expect(screen.queryByText('Inside')).not.toBeInTheDocument()
      expect(sessionStorage.getItem('lp.unlocked')).toBeNull()
    })

    it('stays open for a quick switch away and back', () => {
      let t = 0
      openUnlocked(() => t)
      setVisibility('hidden')
      t = 20_000
      setVisibility('visible')
      expect(screen.getByText('Inside')).toBeInTheDocument()
    })

    it('can lock the moment the app is left', async () => {
      localStorage.setItem('lp.lockAfter', '0')
      openUnlocked(() => 0)
      setVisibility('hidden')
      expect(await screen.findByLabelText('PIN')).toBeInTheDocument()
    })

    it('can be set never to lock by time', () => {
      localStorage.setItem('lp.lockAfter', '-1')
      let t = 0
      openUnlocked(() => t)
      setVisibility('hidden')
      t = 10 * 60 * 60_000
      setVisibility('visible')
      expect(screen.getByText('Inside')).toBeInTheDocument()
    })
  })
})
