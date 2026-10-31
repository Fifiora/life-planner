import { useState, type FormEvent } from 'react'
import { joinWithCode } from '../data/syncRuntime'
import { reloadApp } from '../lib/session'
import { isValidCode } from '../lib/syncCrypto'

const BAD_CODE = "That doesn't look like a pairing code. Codes have 24 letters and numbers and never contain O, 0, I, 1 or L."
export const REPLACE_WARNING = 'This replaces everything on this phone with the shared planner. A backup file is downloaded first. Use a phone you have not used yet.'

/** Enter a pairing code to make this phone a copy of the shared planner. Used in Settings and on a phone's first screens. */
export function JoinForm({ onJoined = reloadApp, onCancel, warning = REPLACE_WARNING }: { onJoined?: () => void; onCancel?: () => void; warning?: string }) {
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
    }
  }

  return (
    <form onSubmit={join} noValidate>
      <p className="callout">{warning}</p>
      <label className="label" htmlFor="sync-code">Pairing code</label>
      <input id="sync-code" className="input" autoCapitalize="characters" autoCorrect="off" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
      {error && <p role="alert" className="error">{error}</p>}
      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>Replace this phone and join</button>
        {onCancel && <button type="button" className="btn" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}
