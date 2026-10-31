import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HouseholdProvider, useHousehold } from '../src/data/household'
import { loadSnapshot, resetStore } from '../src/data/tableStore'
import { ToastProvider } from '../src/ui/Toast'

function Hello() {
  const { me, members, readOnly, switchTo } = useHousehold()
  const other = members.find((m) => m.id !== me.id)
  return (
    <div>
      <p>
        Hello {me.display_name} of {members.length}
        {readOnly ? ' (view-only)' : ''}
      </p>
      {other && (
        <button type="button" onClick={() => switchTo(other.id)}>
          switch
        </button>
      )}
    </div>
  )
}

const renderIt = () =>
  render(
    <ToastProvider>
      <HouseholdProvider>
        <Hello />
      </HouseholdProvider>
    </ToastProvider>,
  )

const two = [
  { id: 'm1', display_name: 'Ada', color: '#111' },
  { id: 'm2', display_name: 'Ben', color: '#222' },
]

beforeEach(() => {
  localStorage.clear()
  resetStore()
})

describe('HouseholdProvider', () => {
  it('asks for both names the first time, then who is using this phone', async () => {
    renderIt()
    await userEvent.type(await screen.findByLabelText('First person'), 'Ada')
    await userEvent.type(screen.getByLabelText('Second person'), 'Ben')
    await userEvent.click(screen.getByRole('button', { name: 'Save names' }))
    await userEvent.click(await screen.findByRole('button', { name: "I'm Ben" }))
    expect(await screen.findByText('Hello Ben of 2')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('lp.data.members')!).map((m: { display_name: string }) => m.display_name)).toEqual(['Ada', 'Ben'])
  })

  it('needs both names before saving', async () => {
    renderIt()
    await userEvent.type(await screen.findByLabelText('First person'), 'Ada')
    await userEvent.click(screen.getByRole('button', { name: 'Save names' }))
    expect(screen.getByText(/enter both names/i)).toBeInTheDocument()
  })

  it('remembers who is using this phone', async () => {
    localStorage.setItem('lp.data.members', JSON.stringify(two))
    localStorage.setItem('lp.me', 'm2')
    renderIt()
    expect(await screen.findByText('Hello Ben of 2')).toBeInTheDocument()
  })

  it('asks again if the remembered person no longer exists', async () => {
    localStorage.setItem('lp.data.members', JSON.stringify(two))
    localStorage.setItem('lp.me', 'gone')
    renderIt()
    expect(await screen.findByRole('button', { name: "I'm Ada" })).toBeInTheDocument()
  })

  it('switches person instantly and remembers the choice', async () => {
    localStorage.setItem('lp.data.members', JSON.stringify(two))
    localStorage.setItem('lp.me', 'm1')
    renderIt()
    await userEvent.click(await screen.findByRole('button', { name: 'switch' }))
    expect(await screen.findByText('Hello Ben of 2')).toBeInTheDocument()
    expect(localStorage.getItem('lp.me')).toBe('m2')
  })

  it('opens a view-only copy without asking who anyone is', async () => {
    loadSnapshot({ members: two })
    renderIt()
    expect(await screen.findByText('Hello Ada of 2 (view-only)')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /I'm/ })).not.toBeInTheDocument()
  })

  it('says so if a view-only copy has no people in it', async () => {
    loadSnapshot({})
    renderIt()
    expect(await screen.findByText(/empty/i)).toBeInTheDocument()
  })
})
