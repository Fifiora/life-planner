import { NavLink } from 'react-router-dom'
import { Icon, type IconName } from './Icon'
import { ThemeSwitch } from './ThemeToggle'

const TABS: { to: string; label: string; icon: IconName; end: boolean }[] = [
  { to: '/', label: 'Today', icon: 'home', end: true },
  { to: '/calendar', label: 'Calendar', icon: 'calendar', end: false },
  { to: '/health', label: 'Health', icon: 'heart', end: false },
  { to: '/study', label: 'Study', icon: 'book', end: false },
  { to: '/travel', label: 'Travel', icon: 'compass', end: false },
  { to: '/food', label: 'Food', icon: 'utensils', end: false },
  { to: '/finance', label: 'Finance', icon: 'wallet', end: false },
]

export function TabBar({ showSettings = true }: { showSettings?: boolean }) {
  return (
    <nav className="tabbar" aria-label="Main">
      <div className="side-brand" aria-hidden>Life Planner</div>
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
          <span aria-hidden className="tab-icon"><Icon name={t.icon} size="lg" /></span>
          <span>{t.label}</span>
        </NavLink>
      ))}
      {showSettings && (
        <NavLink to="/settings" aria-label="Settings" className={({ isActive }) => `tab tab-settings${isActive ? ' active' : ''}`}>
          <span aria-hidden className="tab-icon"><Icon name="settings" size="lg" /></span>
          <span className="tab-label">Settings</span>
        </NavLink>
      )}
      <ThemeSwitch />
    </nav>
  )
}
