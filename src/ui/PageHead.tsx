import { Link } from 'react-router-dom'

export function PageHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      <Link to="/settings" className="icon-btn" aria-label="Settings" style={{ textDecoration: 'none', display: 'grid', placeItems: 'center' }}>
        ⚙️
      </Link>
    </header>
  )
}
