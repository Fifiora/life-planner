import type { ReactNode } from 'react'
import { Icon } from './Icon'

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon = <Icon name="leaf" size="xl" />,
}: {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  icon?: ReactNode
}) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden>{icon}</div>
      <h3>{title}</h3>
      {description && <p className="muted">{description}</p>}
      {actionLabel && (
        <button type="button" className="btn btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}
