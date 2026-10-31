import { SYNC_KEY, SYNC_URL } from './syncConfig'
import { TransportError, type SyncRow, type Transport } from './syncEngine'

export interface TransportOptions {
  url?: string
  key?: string
  fetchImpl?: typeof fetch
  WebSocketImpl?: typeof WebSocket
}

const OFFLINE_STATUSES = new Set([0, 502, 503, 504, 540])
const OPEN = 1

/** Talks to the three Supabase functions over plain HTTPS, and listens for "changed" nudges over a WebSocket. */
export function createSupabaseTransport(opts: TransportOptions = {}): Transport {
  const url = (opts.url ?? SYNC_URL).replace(/\/+$/, '')
  const key = opts.key ?? SYNC_KEY
  const doFetch = opts.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init))
  const Socket = opts.WebSocketImpl ?? (typeof WebSocket !== 'undefined' ? WebSocket : undefined)

  async function rpc(name: string, body: unknown): Promise<unknown> {
    let res: Response
    try {
      res = await doFetch(`${url}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch {
      throw new TransportError('offline', 'Could not reach the sync server.')
    }
    if (res.ok) {
      const text = await res.text()
      try {
        return text ? JSON.parse(text) : null
      } catch {
        return text
      }
    }
    if (OFFLINE_STATUSES.has(res.status)) throw new TransportError('offline', 'The sync server is not reachable right now.')
    let message = ''
    try {
      const parsed = JSON.parse(await res.text()) as { message?: string; error?: string }
      message = parsed.message ?? parsed.error ?? ''
    } catch {
      /* not JSON */
    }
    if (res.status === 401 || res.status === 403) throw new TransportError('server', 'The sync server refused the request: check the project key.')
    if (res.status === 404) throw new TransportError('server', 'The sync functions are missing: run docs/supabase/setup.sql in Supabase (SQL Editor).')
    throw new TransportError('server', message || `The sync server answered with an error (${res.status}).`)
  }

  // ----- live nudges (best effort: polling keeps working without them) -----
  let socket: WebSocket | null = null
  let topic = ''

  const frame = (event: string, payload: unknown, t = topic) => JSON.stringify({ topic: t, event, payload, ref: String(Date.now()) })

  return {
    async push(household, rows) {
      await rpc('sync_push', {
        p_household: household,
        p_rows: rows.map(({ tbl, id, payload, deleted, updated_at }) => ({ tbl, id, payload, deleted, updated_at })),
      })
    },

    async pull(household, after) {
      const data = (await rpc('sync_pull', { p_household: household, p_after: after })) as
        | { tbl: string; row_id: string; payload: string | null; deleted: boolean; updated_at: number; seq: number }[]
        | null
      return (data ?? []).map((r): SyncRow => ({ tbl: r.tbl, id: r.row_id, payload: r.payload, deleted: r.deleted, updated_at: Number(r.updated_at), seq: Number(r.seq) }))
    },

    async ping() {
      await rpc('sync_ping', {})
    },

    subscribe(household, onChanged) {
      if (!Socket) return () => undefined
      topic = `realtime:hh:${household}`
      let stopped = false
      let delay = 1000
      let heartbeat: ReturnType<typeof setInterval> | null = null
      let retry: ReturnType<typeof setTimeout> | null = null

      const connect = () => {
        const ws = new Socket(`${url.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(key)}&vsn=1.0.0`)
        socket = ws
        ws.onopen = () => {
          delay = 1000
          ws.send(frame('phx_join', { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, postgres_changes: [] } }))
          heartbeat = setInterval(() => ws.readyState === OPEN && ws.send(frame('heartbeat', {}, 'phoenix')), 25_000)
        }
        ws.onmessage = (e: MessageEvent) => {
          try {
            const msg = JSON.parse(String(e.data)) as { event?: string; payload?: { event?: string } }
            if (msg.event === 'broadcast' && msg.payload?.event === 'changed') onChanged()
          } catch {
            /* ignore frames we do not understand */
          }
        }
        ws.onclose = () => {
          if (heartbeat) clearInterval(heartbeat)
          heartbeat = null
          if (socket === ws) socket = null
          if (stopped) return
          retry = setTimeout(connect, delay)
          delay = Math.min(delay * 2, 30_000)
        }
        ws.onerror = () => undefined
      }
      connect()

      return () => {
        stopped = true
        if (retry) clearTimeout(retry)
        if (heartbeat) clearInterval(heartbeat)
        const ws = socket
        socket = null
        ws?.close()
      }
    },

    notify(household) {
      if (socket && socket.readyState === OPEN && topic === `realtime:hh:${household}`) {
        socket.send(frame('broadcast', { type: 'broadcast', event: 'changed', payload: {} }))
      }
    },
  }
}
