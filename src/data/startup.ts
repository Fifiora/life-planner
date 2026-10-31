import { decodeSnapshot } from '../lib/snapshot'
import { hasOwnData, loadSnapshot } from './tableStore'

export interface BootResult {
  mode: 'own' | 'view'
  fromLink: boolean
  createdAt?: string
  error?: string
}

const SNAPSHOT_KEY = 'lp.snapshot'

/**
 * Decides what to show before the app starts: a shared view-only copy (from a link, or remembered
 * from an earlier link) or this phone's own planner.
 */
export async function startup(hash: string): Promise<BootResult> {
  const link = /^#v=(.+)$/.exec(hash)
  if (link) {
    try {
      const snap = await decodeSnapshot(link[1])
      loadSnapshot(snap.tables)
      try {
        localStorage.setItem(SNAPSHOT_KEY, link[1])
      } catch {
        /* still viewable this time; just not remembered */
      }
      return { mode: 'view', fromLink: true, createdAt: snap.createdAt }
    } catch {
      return { mode: 'own', fromLink: false, error: 'That view-only link looks damaged or cut off. Ask for a new one, or for the file version.' }
    }
  }

  const remembered = localStorage.getItem(SNAPSHOT_KEY)
  if (remembered && !hasOwnData()) {
    try {
      const snap = await decodeSnapshot(remembered)
      loadSnapshot(snap.tables)
      return { mode: 'view', fromLink: false, createdAt: snap.createdAt }
    } catch {
      localStorage.removeItem(SNAPSHOT_KEY)
    }
  }
  return { mode: 'own', fromLink: false }
}
