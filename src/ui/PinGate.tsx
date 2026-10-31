import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react'
import { shouldLock } from '../lib/lockPolicy'
import { isPinRecord, verifyPin, type PinRecord } from '../lib/pin'
import { effectivePin, pinSignature, subscribePin } from '../lib/pinStore'
import { eraseThisPhone, reloadApp } from '../lib/session'

const eraseAndReload = () => {
  eraseThisPhone()
  reloadApp()
}

/** If a PIN is set, asks for it once per session before showing the app. A convenience lock, not encryption. */
export function PinGate({
  children,
  verify = verifyPin,
  onErase = eraseAndReload,
  now = Date.now,
}: {
  children: ReactNode
  verify?: (pin: string, record: PinRecord) => Promise<boolean>
  onErase?: () => void
  now?: () => number
}) {
  // The PIN in force can change while the app is open (set on another paired device); it applies the next time the app locks.
  const signature = useSyncExternalStore(subscribePin, pinSignature)
  const record = useMemo<PinRecord | null>(() => {
    const parsed: unknown = JSON.parse(signature)
    return isPinRecord(parsed) ? parsed : null
  }, [signature])
  const [unlocked, setUnlocked] = useState(() => !effectivePin() || sessionStorage.getItem('lp.unlocked') === '1')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [forgot, setForgot] = useState(false)

  // Lock again when the app has been left for longer than the chosen time (default: one minute).
  useEffect(() => {
    if (!record) return
    let hiddenAt: number | null = null
    const lockAfter = () => {
      const saved = localStorage.getItem('lp.lockAfter')
      return saved === null ? 1 : Number(saved)
    }
    const lock = () => {
      sessionStorage.removeItem('lp.unlocked')
      setUnlocked(false)
      setPin('')
      setError(null)
    }
    const onChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = now()
        if (lockAfter() === 0) lock()
      } else if (hiddenAt !== null) {
        if (shouldLock(hiddenAt, now(), lockAfter())) lock()
        hiddenAt = null
      }
    }
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [record, now])

  if (unlocked || !record) return <>{children}</>

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (await verify(pin, record as PinRecord)) {
      sessionStorage.setItem('lp.unlocked', '1')
      setUnlocked(true)
    } else {
      setError('Wrong PIN. Try again.')
    }
  }

  return (
    <div className="app login">
      <div className="login-hero" aria-hidden>🔒</div>
      <h1>Enter your PIN</h1>
      <form className="card" onSubmit={submit} noValidate>
        <label className="label" htmlFor="pin">PIN</label>
        <input id="pin" className="input" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} />
        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" className="btn btn-primary block mt">Unlock</button>
      </form>
      {!forgot ? (
        <p className="mt"><button type="button" className="plain-btn muted" onClick={() => setForgot(true)}>Forgot PIN?</button></p>
      ) : (
        <div className="card mt">
          {localStorage.getItem('lp.sync.code') !== null && <p className="muted small">If your other device is still logged in, open Settings there and set a new PIN. It applies here too.</p>}
          <p className="muted small">The only way in without the PIN is to erase this phone's planner data. Anything you haven't backed up is lost.</p>
          <div className="actions">
            <button type="button" className="btn btn-danger" onClick={onErase}>Erase this phone and start over</button>
            <button type="button" className="btn" onClick={() => setForgot(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
