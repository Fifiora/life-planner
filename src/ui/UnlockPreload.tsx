import { useState, type FormEvent } from 'react'
import { mergeMissing } from '../data/tableStore'
import { adjustPlan } from '../lib/migrate'
import { decryptPreload, type PreloadFile } from '../lib/preload'
import { encodeSnapshot, parseSnapshotJson, type Snapshot } from '../lib/snapshot'

const reload = () => window.location.reload()

/** First screen on a brand-new phone: unlock the planner that came preloaded with the site. */
export function UnlockPreload({
  preload,
  decrypt = decryptPreload,
  onFinished = reload,
  onSkip = reload,
}: {
  preload: PreloadFile
  decrypt?: (file: PreloadFile, passphrase: string) => Promise<string>
  onFinished?: () => void
  onSkip?: () => void
}) {
  const [passphrase, setPassphrase] = useState('')
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err))

  async function unlock(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const parsed = parseSnapshotJson(await decrypt(preload, passphrase))
      setSnapshot({ ...parsed, tables: adjustPlan(parsed.tables) })
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  async function makeMine() {
    if (!snapshot) return
    try {
      const added = await mergeMissing(snapshot.tables)
      const first = snapshot.tables.members?.[0]
      if (first && added.members) localStorage.setItem('lp.me', first.id)
      onFinished()
    } catch (err) {
      setError(messageOf(err))
    }
  }

  async function justLook() {
    if (!snapshot) return
    try {
      localStorage.setItem('lp.snapshot', await encodeSnapshot(snapshot))
      onFinished()
    } catch (err) {
      setError(messageOf(err))
    }
  }

  function skip() {
    localStorage.setItem('lp.skipPreload', '1')
    onSkip()
  }

  return (
    <div className="app login">
      <div className="login-hero" aria-hidden>🌿</div>
      <h1>Life Planner</h1>
      {!snapshot ? (
        <>
          <p className="muted">Our plan is already here, locked. Enter the passphrase to open it.</p>
          <form className="card" onSubmit={unlock} noValidate>
            <label className="label" htmlFor="passphrase">Passphrase</label>
            <input
              id="passphrase"
              className="input"
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
            />
            {error && <p role="alert" className="error">{error}</p>}
            <button type="submit" className="btn btn-primary block mt" disabled={busy || !passphrase.trim()}>{busy ? 'Unlocking…' : 'Unlock'}</button>
          </form>
        </>
      ) : (
        <div className="card">
          <h2>Unlocked ✓</h2>
          <p className="muted small">Choose what this phone should do with it.</p>
          <div className="stack mt">
            <button type="button" className="btn btn-primary block" onClick={() => void makeMine()}>Make this my planner</button>
            <button type="button" className="btn block" onClick={() => void justLook()}>Just look (read-only)</button>
          </div>
          {error && <p role="alert" className="error">{error}</p>}
        </div>
      )}
      <p className="mt">
        <button type="button" className="plain-btn muted" onClick={skip}>Start empty instead</button>
      </p>
    </div>
  )
}
