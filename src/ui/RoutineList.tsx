import { useState } from 'react'
import type { Bucket, Routine } from '../types'
import type { RoutineData } from '../data/useRoutineData'
import { nextDue, periodProgress, scopedLogs, streak } from '../lib/cadence'
import { dueLabel } from '../lib/format'
import { RoutineForm } from './RoutineForm'
import { RoutineRow } from './RoutineRow'
import { Sheet } from './Sheet'

export const bucketColor = (b: Bucket | string) => `var(--${b})`

/** The rows only (no card), reused by Today and the bucket screens. */
export function RoutineRows({
  routines,
  data,
  onEdit,
  showDue = false,
}: {
  routines: Routine[]
  data: RoutineData
  onEdit: (r: Routine) => void
  showDue?: boolean
}) {
  return (
    <ul className="list">
      {routines.map((r) => {
        const mine = scopedLogs(r, data.logs, data.me.id)
        const progress = periodProgress(r, mine, data.today, data.anchor)
        // Shared routines name everyone who did it; personal ones only show what the partner did.
        const tickedBy = data.members.filter(
          (m) =>
            (r.shared || m.id !== data.me.id) &&
            data.logs.some((l) => l.routine_id === r.id && l.member_id === m.id && l.done && l.date === data.today),
        )
        return (
          <RoutineRow
            key={r.id}
            routine={r}
            done={progress.done}
            streakCount={streak(r, mine, data.today, data.anchor)}
            tickedBy={tickedBy}
            myLog={data.myLogToday(r)}
            color={bucketColor(r.bucket)}
            onTick={(value) => data.tick(r, value)}
            onUntick={() => data.untick(r)}
            onEdit={() => onEdit(r)}
            readOnly={data.readOnly}
            dueText={showDue && r.cadence !== 'daily' ? `${progress.done ? 'Next' : 'Due'}: ${dueLabel(nextDue(r, mine, data.today, data.anchor), data.today)}` : undefined}
          />
        )
      })}
    </ul>
  )
}

/** A titled card of routines with add/edit sheets. */
export function RoutineList({
  title,
  color,
  routines,
  data,
  defaults,
  emptyHint,
  showDue = false,
}: {
  title: string
  color: string
  routines: Routine[]
  data: RoutineData
  defaults: Partial<Routine>
  emptyHint?: string
  showDue?: boolean
}) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Routine | null>(null)

  return (
    <section className="card">
      <div className="card-head">
        <div className="card-title">
          <span className="accent-bar" style={{ background: color }} />
          <h2>{title}</h2>
        </div>
        <button type="button" className="add-btn" aria-label={`Add to ${title}`} onClick={() => setAdding(true)}>+</button>
      </div>

      {routines.length === 0 ? (
        <p className="muted small">{emptyHint ?? 'Nothing here yet — tap + to add something.'}</p>
      ) : (
        <RoutineRows routines={routines} data={data} onEdit={setEditing} showDue={showDue} />
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title={`Add to ${title}`}>
        <RoutineForm
          initial={defaults}
          onSave={async (v) => {
            await data.saveRoutine(v)
            setAdding(false)
          }}
        />
      </Sheet>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title="Edit routine">
        {editing && (
          <RoutineForm
            key={editing.id}
            initial={editing}
            onSave={async (v) => {
              await data.saveRoutine(v, editing.id)
              setEditing(null)
            }}
            onDelete={async () => {
              await data.deleteRoutine(editing.id)
              setEditing(null)
            }}
          />
        )}
      </Sheet>
    </section>
  )
}
