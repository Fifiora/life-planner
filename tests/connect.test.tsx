import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Connect from '../src/screens/Connect'
import { loadConfig } from '../src/lib/githubStore'
import { installFakeGithub } from './fakeGithub'

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

async function fill(repo: string, token: string) {
  await userEvent.type(screen.getByLabelText('Data repository'), repo)
  await userEvent.type(screen.getByLabelText('Access token'), token)
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
}

describe('Connect', () => {
  it('saves the connection once GitHub accepts the token', async () => {
    installFakeGithub()
    const onConnected = vi.fn()
    render(<Connect onConnected={onConnected} />)
    await fill('o/r', 'secret-token')
    await vi.waitFor(() => expect(onConnected).toHaveBeenCalledTimes(1))
    expect(loadConfig()).toEqual({ owner: 'o', repo: 'r', token: 'secret-token' })
  })

  it('shows why a token was refused and saves nothing', async () => {
    const gh = installFakeGithub()
    gh.state.repoStatus = 401
    const onConnected = vi.fn()
    render(<Connect onConnected={onConnected} />)
    await fill('o/r', 'bad')
    expect(await screen.findByRole('alert')).toHaveTextContent(/token/i)
    expect(onConnected).not.toHaveBeenCalled()
    expect(loadConfig()).toBeNull()
  })

  it('asks for a repo in owner/name form', async () => {
    installFakeGithub()
    render(<Connect onConnected={() => {}} />)
    await fill('nonsense', 'x')
    expect(await screen.findByRole('alert')).toHaveTextContent(/owner\/name/i)
  })
})
