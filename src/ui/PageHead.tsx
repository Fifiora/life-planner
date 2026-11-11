import { Link } from 'react-router-dom'
import { useHousehold } from '../data/household'
import type { Bucket } from '../types'
import { BucketLevel } from './BucketLevel'
import { SyncStatus } from './SyncStatus'
import { ThemeToggle } from './ThemeToggle'

export function PageHead({ title, sub, bucket }: { title: string; sub?: string; bucket?: Bucket }) {
  const { me, members, readOnly, switchTo } = useHousehold()
  const other = members.find((m) => m.id !== me.id)
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
        {bucket && <BucketLevel bucket={bucket} />}
      </div>
      <div className="head-actions">
        {readOnly && <span className="badge view-badge">👁 View-only</span>}
        <SyncStatus />
        <ThemeToggle />
        {other && (
          <button type="button" className="chip" aria-label={`Switch person (now ${me.display_name})`} onClick={() => switchTo(other.id)}>
            👤 {me.display_name}
          </button>
        )}
        {!readOnly && (
          <>
            <Link to="/settings" className="icon-btn" aria-label="Settings" style={{ textDecoration: 'none', display: 'grid', placeItems: 'center' }}>
              ⚙️
            </Link>
          </>
        )}
      </div>
    </header>
  )
}
