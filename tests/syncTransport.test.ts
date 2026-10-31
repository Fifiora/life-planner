import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createSupabaseTransport } from '../src/lib/syncTransport'
import { SYNC_KEY, SYNC_URL } from '../src/lib/syncConfig'
import type { SyncRow } from '../src/lib/syncEngine'

const URL_ = 'https://demo.supabase.co'
const KEY = 'sb_publishable_demo'
const HOUSEHOLD = 'b'.repeat(64)

const reply = (body: unknown, status = 200) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
const lastCall = (f: ReturnType<typeof vi.fn>) => {
  const [url, init] = f.mock.calls.at(-1)!
  return { url: String(url), init: init as RequestInit, body: JSON.parse(String((init as RequestInit).body)) }
}

describe('config', () => {
  it('points at the Life Planner project with a publishable key', () => {
    expect(SYNC_URL).toBe('https://ifnlknnyemllrcwkzmsa.supabase.co')
    expect(SYNC_KEY.startsWith('sb_publishable_')).toBe(true)
  })
})

describe('Supabase transport: calls', () => {
  it('pushes rows to sync_push with the key in both headers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(42))
    const t = createSupabaseTransport({ url: URL_, key: KEY, fetchImpl })
    const rows: SyncRow[] = [{ tbl: 'bills', id: 'b1', payload: 'abc', deleted: false, updated_at: 5, seq: 9 }]
    await t.push(HOUSEHOLD, rows)
    const { url, init, body } = lastCall(fetchImpl)
    expect(url).toBe(`${URL_}/rest/v1/rpc/sync_push`)
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' })
    expect(body).toEqual({ p_household: HOUSEHOLD, p_rows: [{ tbl: 'bills', id: 'b1', payload: 'abc', deleted: false, updated_at: 5 }] })
  })

  it('pulls from sync_pull and renames row_id to id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply([{ tbl: 'bills', row_id: 'b1', payload: 'abc', deleted: false, updated_at: 5, seq: 9 }]))
    const t = createSupabaseTransport({ url: URL_, key: KEY, fetchImpl })
    expect(await t.pull(HOUSEHOLD, 3)).toEqual([{ tbl: 'bills', id: 'b1', payload: 'abc', deleted: false, updated_at: 5, seq: 9 }])
    const { url, body } = lastCall(fetchImpl)
    expect(url).toBe(`${URL_}/rest/v1/rpc/sync_pull`)
    expect(body).toEqual({ p_household: HOUSEHOLD, p_after: 3 })
  })

  it('pings with sync_ping', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply('ok'))
    await createSupabaseTransport({ url: URL_, key: KEY, fetchImpl }).ping()
    expect(lastCall(fetchImpl).url).toBe(`${URL_}/rest/v1/rpc/sync_ping`)
  })
})

describe('Supabase transport: failures', () => {
  const run = (fetchImpl: typeof fetch) => createSupabaseTransport({ url: URL_, key: KEY, fetchImpl }).pull(HOUSEHOLD, 0)
  it('calls a network failure "offline"', async () => {
    await expect(run(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))).rejects.toMatchObject({ name: 'TransportError', kind: 'offline' })
  })
  it.each([0, 502, 503, 504, 540])('calls status %i "offline"', async (status) => {
    await expect(run(vi.fn().mockResolvedValue({ ok: false, status, text: async () => '', json: async () => ({}) }))).rejects.toMatchObject({ kind: 'offline' })
  })
  it('passes the server message on for other errors', async () => {
    await expect(run(vi.fn().mockResolvedValue(reply({ message: 'bad household' }, 400)))).rejects.toMatchObject({ kind: 'server', message: 'bad household' })
  })
  it('explains a refused key', async () => {
    await expect(run(vi.fn().mockResolvedValue(reply({ message: 'Invalid API key' }, 401)))).rejects.toMatchObject({ kind: 'server', message: expect.stringMatching(/refused/i) })
  })
  it('explains a missing function (the SQL was not run)', async () => {
    await expect(run(vi.fn().mockResolvedValue(reply({ message: 'Could not find the function' }, 404)))).rejects.toMatchObject({ kind: 'server', message: expect.stringMatching(/setup\.sql|SQL/i) })
  })
})

class FakeSocket {
  static all: FakeSocket[] = []
  readyState = 0
  sent: Record<string, unknown>[] = []
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(public url: string) {
    FakeSocket.all.push(this)
  }
  send(text: string) {
    this.sent.push(JSON.parse(text))
  }
  close() {
    this.readyState = 3
    this.onclose?.()
  }
  open() {
    this.readyState = 1
    this.onopen?.()
  }
  receive(msg: unknown) {
    this.onmessage?.({ data: JSON.stringify(msg) })
  }
}

describe('Supabase transport: live nudges', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeSocket.all = []
  })
  afterEach(() => vi.useRealTimers())
  const make = () => createSupabaseTransport({ url: URL_, key: KEY, fetchImpl: vi.fn(), WebSocketImpl: FakeSocket as unknown as typeof WebSocket })

  it('joins the household channel and calls back when another phone says "changed"', () => {
    const onChanged = vi.fn()
    make().subscribe(HOUSEHOLD, onChanged)
    const ws = FakeSocket.all[0]
    expect(ws.url).toContain('wss://demo.supabase.co/realtime/v1/websocket')
    expect(ws.url).toContain(`apikey=${KEY}`)
    ws.open()
    expect(ws.sent[0]).toMatchObject({ topic: `realtime:hh:${HOUSEHOLD}`, event: 'phx_join' })
    ws.receive({ topic: `realtime:hh:${HOUSEHOLD}`, event: 'broadcast', payload: { type: 'broadcast', event: 'changed', payload: {} } })
    expect(onChanged).toHaveBeenCalledTimes(1)
    ws.receive({ topic: `realtime:hh:${HOUSEHOLD}`, event: 'broadcast', payload: { type: 'broadcast', event: 'other', payload: {} } })
    ws.receive({ topic: 'phoenix', event: 'phx_reply', payload: {} })
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('sends a heartbeat every 25 seconds', () => {
    make().subscribe(HOUSEHOLD, vi.fn())
    const ws = FakeSocket.all[0]
    ws.open()
    vi.advanceTimersByTime(25_000)
    expect(ws.sent.filter((m) => m.event === 'heartbeat')).toHaveLength(1)
    vi.advanceTimersByTime(25_000)
    expect(ws.sent.filter((m) => m.event === 'heartbeat')).toHaveLength(2)
  })

  it('reconnects after the connection drops, and stops after unsubscribing', () => {
    const off = make().subscribe(HOUSEHOLD, vi.fn())
    FakeSocket.all[0].open()
    FakeSocket.all[0].close()
    expect(FakeSocket.all).toHaveLength(1)
    vi.advanceTimersByTime(1000)
    expect(FakeSocket.all).toHaveLength(2)
    off()
    expect(FakeSocket.all[1].readyState).toBe(3)
    vi.advanceTimersByTime(60_000)
    expect(FakeSocket.all).toHaveLength(2)
  })

  it('tells the other phones about a change, only while connected', () => {
    const t = make()
    t.subscribe(HOUSEHOLD, vi.fn())
    const ws = FakeSocket.all[0]
    t.notify!(HOUSEHOLD) // not open yet: nothing sent
    expect(ws.sent).toHaveLength(0)
    ws.open()
    t.notify!(HOUSEHOLD)
    expect(ws.sent.at(-1)).toMatchObject({ topic: `realtime:hh:${HOUSEHOLD}`, event: 'broadcast', payload: { type: 'broadcast', event: 'changed' } })
  })
})
