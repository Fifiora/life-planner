import { useState, type FormEvent } from 'react'
import { useHousehold } from '../data/household'
import { fetchPreload } from '../data/startup'
import { mergeMissing } from '../data/tableStore'
import { decryptPreload, type PreloadFile } from '../lib/preload'
import { parseSnapshotJson } from '../lib/snapshot'

const LABELS: Record<string, [string, string]> = {
  routines: ['routine', 'routines'],
  bills: ['bill', 'bills'],
  income: ['income source', 'income sources'],
  settings: ['setting', 'settings'],
  places: ['place', 'places'],
  members: ['person', 'people'],
}
const describe = (added: Record<string, number>) =>
  Object.entries(added)
    .map(([t, n]) => `${n} ${(LABELS[t] ?? [t, t])[n === 1 ? 0 : 1]}`)
    .join(', ')

/**
 * Adds the plan that ships (locked) with the site: routines, bills, one-time payoffs, income and targets.
 * It only ever adds what is missing, so it is safe to run again and never touches anything already edited.
 */
export function StarterPlanLoader({
  loadFile = fetchPreload,
  decrypt = decryptPreload,
}: {
  loadFile?: () => Promise<PreloadFile | null>
  decrypt?: (file: PreloadFile, passphrase: string) => Promise<string>
}) {
  const { readOnly } = useHousehold()
  const [file, setFile] = useState<PreloadFile | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  if (readOnly) return null

  const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err))

  async function fetchFile() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const found = await loadFile()
      if (found) setFile(found)
      else setError("The starter plan isn't published with this site.")
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  async function unlock(e: FormEvent) {
    e.preventDefault()
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const snap = parseSnapshotJson(await decrypt(file, passphrase))
      const added = await mergeMissing(snap.tables)
      setMessage(Object.keys(added).length === 0 ? 'Everything from the starter plan is already here.' : `Added ${describe(added)}.`)
      setFile(null)
      setPassphrase('')
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="starter">
      {!file && (
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void fetchFile()}>
          Load our starter plan
        </button>
      )}
      {file && (
        <form onSubmit={unlock} noValidate>
          <label className="label" htmlFor="starter-pass">Starter plan passphrase</label>
          <input id="starter-pass" className="input" autoCapitalize="characters" autoCorrect="off" autoComplete="off" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
          <div className="actions">
            <button type="submit" className="btn btn-primary" disabled={busy || !passphrase.trim()}>{busy ? 'Unlocking…' : 'Unlock and add'}</button>
            <button type="button" className="btn" onClick={() => setFile(null)}>Cancel</button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="error">{error}</p>}
      {message && <p role="status" aria-label="Starter plan result" className="callout ok">{message}</p>}
    </div>
  )
}
