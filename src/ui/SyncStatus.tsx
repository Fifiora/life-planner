import { useEffect, useState } from 'react'
import { useHousehold } from '../data/household'
import { useSyncStatus } from '../data/syncRuntime'
import type { SyncStatus as Status } from '../lib/syncEngine'

function ago(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 10) return 'just now'
  if (s < 60) return `${s} sec ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`
}

/** One plain sentence for the sync state (shared by the header chip and the Settings card). */
export function describeSync(s: Status, now: number): string {
  if (s.state === 'syncing') return 'Syncing…'
  if (s.state === 'offline') return 'Offline, changes are saved here'
  if (s.state === 'error') return 'Sync problem'
  if (s.pending > 0) return `Sending ${s.pending} change${s.pending === 1 ? '' : 's'}…`
  return s.lastSyncedAt ? `Synced ${ago(now - s.lastSyncedAt)}` : 'Ready'
}

/** A small "Synced just now" chip for the page header. Nothing when this phone is not sharing. */
export function SyncStatus() {
  const { readOnly } = useHousehold()
  const status = useSyncStatus()
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15_000)
    return () => clearInterval(t)
  }, [])
  if (readOnly || !status) return null
  return (
    <span role="status" aria-label="Sync status" aria-live={status.state === 'offline' || status.state === 'error' ? 'polite' : 'off'} className={`sync-chip ${status.state}`} title={status.message}>
      <span className="sync-dot" aria-hidden />
      {describeSync(status, Date.now())}
    </span>
  )
}
