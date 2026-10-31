import { vi } from 'vitest'

export interface Deferred {
  promise: Promise<void>
  resolve: () => void
}
export const deferred = (): Deferred => {
  let resolve!: () => void
  const promise = new Promise<void>((r) => (resolve = r))
  return { promise, resolve }
}

const toB64 = (s: string) => {
  let binary = ''
  new TextEncoder().encode(s).forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary)
}
const fromB64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)))

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

/** An in-memory stand-in for the GitHub contents API (one repo), installed as global fetch. */
export function installFakeGithub(initial: Record<string, unknown[]> = {}, owner = 'o', repo = 'r') {
  const files = new Map<string, { content: string; sha: string }>()
  let counter = 0
  const nextSha = () => `sha${++counter}`
  for (const [table, rows] of Object.entries(initial)) {
    files.set(`data/${table}.json`, { content: JSON.stringify(rows), sha: nextSha() })
  }

  const state = {
    failWrites: null as number | null,
    holdNextGet: null as Deferred | null,
    holdNextPut: null as Deferred | null,
    nextPut: null as { status: number; message: string } | null,
    largeFileBytes: null as number | null,
    onBeforePut: null as (() => void) | null,
    conflictAlways: false,
    repoStatus: 200,
    canPush: true,
    putCount: 0,
    getCount: 0,
  }
  const prefix = `https://api.github.com/repos/${owner}/${repo}`

  const handler = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = String(input)
    const method = (init.method ?? 'GET').toUpperCase()
    const headers = new Headers(init.headers)

    if (url === prefix) {
      if (state.repoStatus === 200) return json(200, { permissions: { push: state.canPush } })
      return json(state.repoStatus, { message: state.repoStatus === 401 ? 'Bad credentials' : 'Not Found' })
    }
    if (!url.startsWith(`${prefix}/contents/`)) return json(404, { message: 'unknown route' })
    const path = decodeURIComponent(url.slice(`${prefix}/contents/`.length))

    if (method === 'GET') {
      state.getCount++
      const f = files.get(path)
      let res: Response
      if (!f) res = json(404, { message: 'Not Found' })
      else if (headers.get('If-None-Match') === `"${f.sha}"`) res = new Response(null, { status: 304 })
      else if (state.largeFileBytes !== null && f.content.length > state.largeFileBytes) {
        // Like GitHub for files over 1 MB: no content in the normal answer, but the raw media type works.
        if ((headers.get('Accept') ?? '').includes('raw')) res = new Response(f.content, { status: 200, headers: { ETag: `"${f.sha}"` } })
        else res = json(200, { sha: f.sha, content: '', encoding: 'none' }, { ETag: `"${f.sha}"` })
      } else res = json(200, { sha: f.sha, content: toB64(f.content), encoding: 'base64' }, { ETag: `"${f.sha}"` })
      const hold = state.holdNextGet
      if (hold) {
        state.holdNextGet = null
        await hold.promise
      }
      return res
    }

    if (method === 'PUT') {
      state.putCount++
      const holdPut = state.holdNextPut
      if (holdPut) {
        state.holdNextPut = null
        await holdPut.promise
      }
      if (state.nextPut) {
        const n = state.nextPut
        state.nextPut = null
        return json(n.status, { message: n.message })
      }
      if (state.failWrites) return json(state.failWrites, { message: 'server says no' })
      if (state.onBeforePut) {
        const hook = state.onBeforePut
        state.onBeforePut = null
        hook()
      }
      const body = JSON.parse(String(init.body))
      const f = files.get(path)
      if (state.conflictAlways || (f && body.sha !== f.sha)) {
        return json(409, { message: `${path} does not match ${f?.sha}` })
      }
      const sha = nextSha()
      files.set(path, { content: fromB64(body.content), sha })
      return json(f ? 200 : 201, { content: { sha } })
    }
    return json(405, { message: 'method not allowed' })
  }

  const mock = vi.fn(handler)
  vi.stubGlobal('fetch', mock)

  return {
    files,
    state,
    fetch: mock,
    rows: (table: string): any[] => JSON.parse(files.get(`data/${table}.json`)?.content ?? '[]'),
    /** Simulates the other phone saving a new version of a table. */
    partnerWrites: (table: string, rows: unknown[]) => {
      files.set(`data/${table}.json`, { content: JSON.stringify(rows), sha: nextSha() })
    },
  }
}
