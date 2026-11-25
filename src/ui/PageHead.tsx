import { Link } from 'react-router-dom'
import { useHousehold } from '../data/household'
import { Icon } from './Icon'
import { SyncStatus } from './SyncStatus'
import { ThemeToggle } from './ThemeToggle'

export function PageHead({ title, sub }: { title: string; sub?: string }) {
  const { me, members, readOnly, switchTo } = useHousehold()
  const other = members.find((m) => m.id !== me.id)
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      <div className="head-actions">
        {readOnly && <span className="badge view-badge"><Icon name="eye" /> View-only</span>}
        <SyncStatus />
        <ThemeToggle />
        {other && (
          <button type="button" className="chip" aria-label={`Switch person (now ${me.display_name})`} onClick={() => switchTo(other.id)}>
            <Icon name="user" /> {me.display_name}
          </button>
        )}
        {!readOnly && (
          <>
            <Link to="/settings" className="icon-btn" aria-label="Settings" style={{ textDecoration: 'none', display: 'grid', placeItems: 'center' }}>
              <Icon name="settings" size="lg" />
            </Link>
          </>
        )}
      </div>
    </header>
  )
}
