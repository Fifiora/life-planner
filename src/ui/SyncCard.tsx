import { useState, type FormEvent } from 'react'
import { useHousehold } from '../data/household'
import { getCode, joinWithCode, startSharing, stopSyncing, testConnection, useSyncStatus } from '../data/syncRuntime'
import { isValidCode } from '../lib/syncCrypto'
import { describeSync } from './SyncStatus'

const BAD_CODE = "That doesn't look like a pairing code. Codes have 24 letters and numbers and never contain O, 0, I, 1 or L."

/** Settings: share one planner between phones. Start on one phone, join on the other with the code. */
export function SyncCard({ onJoined = () => window.location.reload() }: { onJoined?: () => void }) {
  const { readOnly } = useHousehold()
  const status = useSyncStatus()
  const code = getCode()
  const [, bump] = useState(0)
  const [joining, setJoining] = useState(false)
  const [fresh, setFresh] = useState<string | null>(null)
  const [reveal, setReveal] = useState(false)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [connection, setConnection] = useState<string | null>(null)
  const [confirmStop, setConfirmStop] = useState(false)
  const [stopped, setStopped] = useState(false)
  const [copied, setCopied] = useState(false)

  if (readOnly) return null
  const paired = status !== null || code !== null

  async function start() {
    setBusy(true)
    setError(null)
    setStopped(false)
    try {
      setFresh(await startSharing())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
      bump((n) => n + 1)
    }
  }

  async function join(e: FormEvent) {
    e.preventDefault()
    if (!isValidCode(typed)) return setError(BAD_CODE)
    setBusy(true)
    setError(null)
    try {
      await joinWithCode(typed)
      onJoined()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
      bump((n) => n + 1)
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setError('Could not copy. Show the code and write it down instead.')
    }
  }

  async function share(text: string) {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Our Life Planner pairing code', text })
        return
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
      }
    }
    await copy(text)
  }

  async function test() {
    setConnection(null)
    const result = await testConnection()
    setConnection(result === 'ok' ? 'Connected ✓' : result)
  }

  return (
    <section className="card">
      <h2>Live sync</h2>

      {!paired && !fresh && (
        <>
          <p className="muted small">
            Share one planner between your phones: what either of you adds shows up on the other phone within seconds, and each phone keeps working without a connection. Everything is encrypted on the phone before it is sent.
          </p>
          {stopped && <p className="callout">Syncing stopped. Everything stays on this phone.</p>}
          {!joining ? (
            <div className="actions">
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void start()}>Start sharing</button>
              <button type="button" className="btn" onClick={() => { setJoining(true); setError(null) }}>Join with a code</button>
            </div>
          ) : (
            <form onSubmit={join} noValidate>
              <p className="callout">This replaces everything on this phone with the shared planner. A backup file is downloaded first. Use a phone you have not used yet.</p>
              <label className="label" htmlFor="sync-code">Pairing code</label>
              <input id="sync-code" className="input" autoCapitalize="characters" autoCorrect="off" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
              <div className="actions">
                <button type="submit" className="btn btn-primary" disabled={busy}>Replace this phone and join</button>
                <button type="button" className="btn" onClick={() => { setJoining(false); setError(null) }}>Cancel</button>
              </div>
            </form>
          )}
        </>
      )}

      {fresh && (
        <>
          <p className="muted small">Your pairing code. Enter it once on your partner's phone (Settings, Live sync, Join with a code).</p>
          <p className="pairing-code">{fresh}</p>
          <p className="callout">Keep this code safe: anyone with it can read and change your planner. Your partner enters it on their phone.</p>
          <div className="actions">
            <button type="button" className="btn" onClick={() => void copy(fresh)}>Copy code</button>
            <button type="button" className="btn" onClick={() => void share(fresh)}>Share code</button>
            <button type="button" className="btn btn-primary" onClick={() => { setFresh(null); setReveal(false) }}>Done</button>
          </div>
          {copied && <p className="muted small" role="status" aria-label="Copied">Copied.</p>}
        </>
      )}

      {paired && !fresh && (
        <>
          <p>{status ? describeSync(status, Date.now()) : 'Sharing'}</p>
          {status?.message && status.state !== 'idle' && <p className="error">{status.message}</p>}
          {status?.message && status.state === 'idle' && <p className="muted small">{status.message}</p>}
          {reveal && code && <p className="pairing-code">{code}</p>}
          <div className="actions">
            <button type="button" className="btn" onClick={() => setReveal((v) => !v)}>{reveal ? 'Hide code' : 'Show code'}</button>
            {code && <button type="button" className="btn" onClick={() => void copy(code)}>Copy code</button>}
            {code && <button type="button" className="btn" onClick={() => void share(code)}>Share code</button>}
            <button type="button" className="btn" onClick={() => void test()}>Test connection</button>
          </div>
          {copied && <p className="muted small" role="status" aria-label="Copied">Copied.</p>}
          {connection !== null && <p role="status" aria-label="Connection test" className={connection.startsWith('Connected') ? 'callout ok' : 'error'}>{connection}</p>}
          <p className="muted small">Importing a backup on this phone replaces the shared planner on every phone. Use one window of the app at a time.</p>
          {!confirmStop ? (
            <div className="actions"><button type="button" className="btn btn-danger" onClick={() => setConfirmStop(true)}>Stop syncing on this phone</button></div>
          ) : (
            <div className="actions">
              <button type="button" className="btn btn-danger" onClick={() => { stopSyncing(); setConfirmStop(false); setReveal(false); setStopped(true); bump((n) => n + 1) }}>Yes, stop syncing</button>
              <button type="button" className="btn" onClick={() => setConfirmStop(false)}>Cancel</button>
            </div>
          )}
        </>
      )}

      {error && <p role="alert" className="error">{error}</p>}
    </section>
  )
}
