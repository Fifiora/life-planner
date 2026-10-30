export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon = '🌱',
}: {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  icon?: string
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
