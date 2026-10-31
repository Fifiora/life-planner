import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  clearConfig,
  loadConfig,
  mutate,
  parseRepo,
  readTable,
  saveConfig,
  verifyConnection,
} from '../src/lib/githubStore'
import { installFakeGithub } from './fakeGithub'

const cfg = { owner: 'o', repo: 'r', token: 't' }

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe('config', () => {
  it('saves, loads and clears the connection', () => {
    expect(loadConfig()).toBeNull()
    saveConfig(cfg)
    expect(loadConfig()).toEqual(cfg)
    clearConfig()
    expect(loadConfig()).toBeNull()
  })
  it('ignores a corrupted saved connection', () => {
    localStorage.setItem('lp.config', '{not json')
    expect(loadConfig()).toBeNull()
  })
})

describe('parseRepo', () => {
  it('accepts owner/name, a GitHub URL, and a .git suffix', () => {
    expect(parseRepo('Fifiora/life-planner-data')).toEqual({ owner: 'Fifiora', repo: 'life-planner-data' })
    expect(parseRepo('https://github.com/Fifiora/life-planner-data')).toEqual({ owner: 'Fifiora', repo: 'life-planner-data' })
    expect(parseRepo(' Fifiora/life-planner-data.git ')).toEqual({ owner: 'Fifiora', repo: 'life-planner-data' })
  })
  it('rejects anything else', () => {
    expect(parseRepo('')).toBeNull()
    expect(parseRepo('just-a-name')).toBeNull()
  })
})

describe('readTable', () => {
  it('reads and decodes a table, including accents and emoji', async () => {
    installFakeGithub({ places: [{ id: '1', name: 'São Paulo 🌎' }] })
    const res = await readTable(cfg, 'places')
    expect(res).toEqual({ rows: [{ id: '1', name: 'São Paulo 🌎' }], sha: 'sha1', etag: '"sha1"' })
  })
  it('treats a table that does not exist yet as an empty list', async () => {
    installFakeGithub()
    expect(await readTable(cfg, 'places')).toEqual({ rows: [], sha: null, etag: null })
  })
  it('says "unchanged" when the saved version tag still matches', async () => {
    installFakeGithub({ places: [] })
    expect(await readTable(cfg, 'places', '"sha1"')).toBe('unchanged')
  })
  it('sends the token and bypasses the browser cache', async () => {
    const gh = installFakeGithub({ places: [] })
    await readTable(cfg, 'places')
    const init = gh.fetch.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t')
    expect(init.cache).toBe('no-store')
  })
  it('explains a rejected token', async () => {
    const gh = installFakeGithub({ places: [] })
    gh.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401 }))
    await expect(readTable(cfg, 'places')).rejects.toThrow(/token/i)
  })
})

describe('mutate', () => {
  it('writes the change to the data repo', async () => {
    const gh = installFakeGithub()
    await mutate(cfg, 'bills', (rows) => [...rows, { id: 'a', name: 'Rent' }])
    expect(gh.rows('bills')).toEqual([{ id: 'a', name: 'Rent' }])
  })
  it('re-reads and re-applies the change when the other phone saved first', async () => {
    const gh = installFakeGithub({ bills: [{ id: '1' }] })
    gh.state.onBeforePut = () => gh.partnerWrites('bills', [{ id: '1' }, { id: 'partner' }])
    await mutate(cfg, 'bills', (rows) => [...rows, { id: 'mine' }], { delayMs: 0 })
    expect(gh.rows('bills').map((r) => r.id)).toEqual(['1', 'partner', 'mine'])
  })
  it('gives up with a clear message after the allowed tries', async () => {
    const gh = installFakeGithub({ bills: [] })
    gh.state.conflictAlways = true
    await expect(mutate(cfg, 'bills', (r) => r, { tries: 2, delayMs: 0 })).rejects.toThrow(/changed this at the same time/i)
    expect(gh.state.putCount).toBe(2)
  })
  it('passes on the reason when GitHub rejects the write', async () => {
    const gh = installFakeGithub()
    gh.state.failWrites = 500
    await expect(mutate(cfg, 'bills', (r) => r)).rejects.toThrow(/server says no/)
  })
})

describe('verifyConnection', () => {
  it('accepts a token that can write to the repo', async () => {
    installFakeGithub()
    expect(await verifyConnection(cfg)).toBeNull()
  })
  it('explains a rejected token', async () => {
    const gh = installFakeGithub()
    gh.state.repoStatus = 401
    expect(await verifyConnection(cfg)).toMatch(/token/i)
  })
  it('explains a repo that cannot be found', async () => {
    const gh = installFakeGithub()
    gh.state.repoStatus = 404
    expect(await verifyConnection(cfg)).toMatch(/find that repo|access/i)
  })
  it('explains a read-only token', async () => {
    const gh = installFakeGithub()
    gh.state.canPush = false
    expect(await verifyConnection(cfg)).toMatch(/write/i)
  })
})
