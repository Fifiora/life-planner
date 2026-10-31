import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HouseholdProvider, useHousehold } from '../src/data/household'
import { resetStore } from '../src/data/tableStore'
import { saveConfig } from '../src/lib/githubStore'
import { ToastProvider } from '../src/ui/Toast'
import { installFakeGithub } from './fakeGithub'

function Hello() {
  const { me, members } = useHousehold()
  return (
    <p>
      Hello {me.display_name} of {members.length}
    </p>
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

beforeEach(() => {
  localStorage.clear()
  saveConfig({ owner: 'o', repo: 'r', token: 't' })
  resetStore()
})
afterEach(() => vi.unstubAllGlobals())

describe('HouseholdProvider', () => {
  it('asks for both names the first time, then who this phone belongs to', async () => {
    const gh = installFakeGithub()
    renderIt()
    await userEvent.type(await screen.findByLabelText('First person'), 'Ada')
    await userEvent.type(screen.getByLabelText('Second person'), 'Ben')
    await userEvent.click(screen.getByRole('button', { name: 'Save names' }))
    await userEvent.click(await screen.findByRole('button', { name: "I'm Ben" }))
    expect(await screen.findByText('Hello Ben of 2')).toBeInTheDocument()
    expect(gh.rows('members').map((m) => m.display_name)).toEqual(['Ada', 'Ben'])
  })

  it('needs both names before saving', async () => {
    installFakeGithub()
    renderIt()
    await userEvent.type(await screen.findByLabelText('First person'), 'Ada')
    await userEvent.click(screen.getByRole('button', { name: 'Save names' }))
    expect(screen.getByText(/enter both names/i)).toBeInTheDocument()
  })

  it('remembers who this phone belongs to', async () => {
    installFakeGithub({ members: [{ id: 'm1', display_name: 'Ada', color: '#111' }, { id: 'm2', display_name: 'Ben', color: '#222' }] })
    localStorage.setItem('lp.me', 'm2')
    renderIt()
    expect(await screen.findByText('Hello Ben of 2')).toBeInTheDocument()
  })

  it('asks again if the remembered person no longer exists', async () => {
    installFakeGithub({ members: [{ id: 'm1', display_name: 'Ada', color: '#111' }, { id: 'm2', display_name: 'Ben', color: '#222' }] })
    localStorage.setItem('lp.me', 'gone')
    renderIt()
    expect(await screen.findByRole('button', { name: "I'm Ada" })).toBeInTheDocument()
  })
})
