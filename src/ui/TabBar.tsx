import { NavLink } from 'react-router-dom'
import { StyleSwitch } from './StyleSwitch'
import { ThemeSwitch } from './ThemeToggle'

const TABS = [
  { to: '/', label: 'Today', icon: '🏡', end: true },
  { to: '/calendar', label: 'Calendar', icon: '🗓️', end: false },
  { to: '/health', label: 'Health', icon: '💪', end: false },
  { to: '/study', label: 'Study', icon: '📚', end: false },
  { to: '/travel', label: 'Travel', icon: '🧭', end: false },
  { to: '/food', label: 'Food', icon: '🍲', end: false },
  { to: '/finance', label: 'Finance', icon: '💰', end: false },
]

export function TabBar() {
  return (
    <nav className="tabbar" aria-label="Main">
      <div className="side-brand" aria-hidden>🌿 Life Planner</div>
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
          <span aria-hidden className="tab-icon">{t.icon}</span>
          <span>{t.label}</span>
        </NavLink>
      ))}
      <ThemeSwitch />
      <StyleSwitch />
    </nav>
  )
}
