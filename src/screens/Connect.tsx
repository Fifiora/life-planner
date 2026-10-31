import { useState, type FormEvent } from 'react'
import { parseRepo, saveConfig, verifyConnection } from '../lib/githubStore'

export default function Connect({ onConnected }: { onConnected: () => void }) {
  const [repoText, setRepoText] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const repo = parseRepo(repoText)
    if (!repo) return setError('Enter the repository as owner/name, for example Fifiora/life-planner-data.')
    if (!token.trim()) return setError('Paste your access token.')
    setBusy(true)
    setError(null)
    try {
      const cfg = { ...repo, token: token.trim() }
      const problem = await verifyConnection(cfg)
      if (problem) {
        setError(problem)
      } else {
        saveConfig(cfg)
        onConnected()
      }
    } catch {
      setError("Couldn't reach GitHub. Check your internet connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app login">
      <div className="login-hero" aria-hidden>🌿</div>
      <h1>Life Planner</h1>
      <p className="muted">Connect this phone to your private data repo on GitHub.</p>
      <form className="card" onSubmit={submit} noValidate>
        <label className="label" htmlFor="repo">Data repository</label>
        <input id="repo" className="input" placeholder="owner/name" autoCapitalize="off" autoCorrect="off" value={repoText} onChange={(e) => setRepoText(e.target.value)} />
        <label className="label" htmlFor="token">Access token</label>
        <input id="token" className="input" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} />
        <p className="muted small mt">
          Create a fine-grained token at GitHub → Settings → Developer settings, limited to that one repo with
          "Contents: Read and write". It stays on this phone.
        </p>
        {error && <p role="alert" className="error">{error}</p>}
        <button className="btn btn-primary block mt" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Connect'}</button>
      </form>
    </div>
  )
}
