import type { Row } from '../types'

export interface StoreConfig {
  owner: string
  repo: string
  token: string
}

export interface TableFile {
  rows: Row[]
  sha: string | null
  etag: string | null
}

type Fetch = typeof fetch
const globalFetch: Fetch = (...args) => fetch(...args)

const API = 'https://api.github.com'
const CONFIG_KEY = 'lp.config'

// ---------- Saved connection (stays on this phone) ----------

export function loadConfig(): StoreConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return null
    const c = JSON.parse(raw)
    if (c && typeof c.owner === 'string' && typeof c.repo === 'string' && typeof c.token === 'string') {
      return { owner: c.owner, repo: c.repo, token: c.token }
    }
    return null
  } catch {
    return null
  }
}

export function saveConfig(cfg: StoreConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
}

export function clearConfig(): void {
  localStorage.removeItem(CONFIG_KEY)
}

/** Accepts "owner/name", a github.com URL, or either with a trailing ".git". */
export function parseRepo(input: string): { owner: string; repo: string } | null {
  const cleaned = input
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '')
  const m = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(cleaned)
  return m ? { owner: m[1], repo: m[2] } : null
}

// ---------- Text <-> base64 (UTF-8 safe) ----------

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(binary)
}

function decodeBase64(b64: string): string {
  const binary = atob(b64.replace(/\s/g, ''))
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)))
}

// ---------- GitHub contents API ----------

const authHeaders = (cfg: StoreConfig): Record<string, string> => ({
  Authorization: `Bearer ${cfg.token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
})

const tableUrl = (cfg: StoreConfig, table: string) => `${API}/repos/${cfg.owner}/${cfg.repo}/contents/data/${table}.json`

/** Thrown when the file changed on GitHub between our read and our write. */
export class ConflictError extends Error {}

async function apiError(res: Response): Promise<Error> {
  let detail = ''
  try {
    detail = ((await res.json()) as { message?: string }).message ?? ''
  } catch {
    /* no JSON body */
  }
  if (res.status === 401) return new Error("GitHub didn't accept the access token. It may have expired — reconnect with a new one.")
  if (res.status === 403) return new Error(`GitHub refused this (${detail || 'forbidden'}). The token may be missing write access.`)
  return new Error(`GitHub: ${detail || `error ${res.status}`}`)
}

/** Reads one list. Returns "unchanged" when `etag` still matches (a free, fast check). */
export async function readTable(
  cfg: StoreConfig,
  table: string,
  etag: string | null = null,
  fetchImpl: Fetch = globalFetch,
): Promise<TableFile | 'unchanged'> {
  const headers = authHeaders(cfg)
  if (etag) headers['If-None-Match'] = etag
  const res = await fetchImpl(tableUrl(cfg, table), { headers, cache: 'no-store' })
  if (res.status === 304) return 'unchanged'
  if (res.status === 404) return { rows: [], sha: null, etag: null }
  if (!res.ok) throw await apiError(res)
  const body = (await res.json()) as { content: string; sha: string }
  const rows = JSON.parse(decodeBase64(body.content))
  if (!Array.isArray(rows)) throw new Error(`data/${table}.json should be a list`)
  return { rows: rows as Row[], sha: body.sha, etag: res.headers.get('etag') }
}

async function writeTable(
  cfg: StoreConfig,
  table: string,
  rows: Row[],
  sha: string | null,
  fetchImpl: Fetch,
): Promise<{ sha: string }> {
  const body: Record<string, unknown> = {
    message: `Update ${table}`,
    content: encodeBase64(JSON.stringify(rows, null, 1)),
  }
  if (sha) body.sha = sha
  const res = await fetchImpl(tableUrl(cfg, table), {
    method: 'PUT',
    headers: { ...authHeaders(cfg), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (res.status === 409 || res.status === 422) throw new ConflictError()
  if (!res.ok) throw await apiError(res)
  const data = (await res.json()) as { content: { sha: string } }
  return { sha: data.content.sha }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Read the latest list, apply `change`, write it back. If the other phone saved in between,
 * read again and re-apply the same change (up to `tries` times).
 */
export async function mutate(
  cfg: StoreConfig,
  table: string,
  change: (rows: Row[]) => Row[],
  opts: { tries?: number; delayMs?: number; fetchImpl?: Fetch } = {},
): Promise<{ rows: Row[]; sha: string }> {
  const tries = opts.tries ?? 4
  const delayMs = opts.delayMs ?? 250
  const fetchImpl = opts.fetchImpl ?? globalFetch
  for (let attempt = 1; ; attempt++) {
    const file = await readTable(cfg, table, null, fetchImpl)
    if (file === 'unchanged') throw new Error('Unexpected "unchanged" answer')
    const next = change(file.rows)
    try {
      const { sha } = await writeTable(cfg, table, next, file.sha, fetchImpl)
      return { rows: next, sha }
    } catch (err) {
      if (!(err instanceof ConflictError)) throw err
      if (attempt >= tries) throw new Error('Your partner changed this at the same time. Please try again.')
      await sleep(delayMs * attempt)
    }
  }
}

/** Returns a problem to show the user, or null when the token can write to the repo. */
export async function verifyConnection(cfg: StoreConfig, fetchImpl: Fetch = globalFetch): Promise<string | null> {
  const res = await fetchImpl(`${API}/repos/${cfg.owner}/${cfg.repo}`, { headers: authHeaders(cfg), cache: 'no-store' })
  if (res.status === 401) return "GitHub didn't accept that token. Check you copied all of it and that it hasn't expired."
  if (res.status === 404) return "Couldn't find that repo with this token. Check the name, and that the token has access to it."
  if (!res.ok) return (await apiError(res)).message
  const repo = (await res.json()) as { permissions?: { push?: boolean } }
  if (!repo.permissions?.push) return 'This token can read the repo but not write to it. Give it "Contents: Read and write".'
  return null
}
