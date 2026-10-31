import { useState } from 'react'
import type { Member, Routine, RoutineLog } from '../types'
import { WEEKDAYS } from '../lib/format'

const CADENCE_LABEL: Record<Routine['cadence'], string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  quarterly: 'Every 3 months',
}

export function describeRoutine(r: Routine): string {
  const parts: string[] = []
  if (r.weekday != null && r.cadence === 'monthly') parts.push(`A ${WEEKDAYS[r.weekday]} each month`)
  else if (r.weekday != null && r.cadence === 'quarterly') parts.push(`A ${WEEKDAYS[r.weekday]} every 3 months`)
  else if (r.weekday != null) parts.push(`${WEEKDAYS[r.weekday]}s`)
  else parts.push(CADENCE_LABEL[r.cadence])
  if (r.times_per_period > 1) parts.push(`${r.times_per_period}×`)
  if (r.place) parts.push(r.place)
  if (r.time_rule) parts.push(r.time_rule)
  return parts.join(' · ')
}

export function RoutineRow({
  routine,
  done,
  streakCount,
  tickedBy,
  myLog,
  color,
  onTick,
  onUntick,
  onEdit,
  dueText,
  readOnly = false,
}: {
  routine: Routine
  done: boolean
  streakCount: number
  tickedBy: Member[]
  myLog?: RoutineLog
  color: string
  onTick: (value?: string) => void
  onUntick: () => void
  onEdit: () => void
  dueText?: string
  readOnly?: boolean
}) {
  const [time, setTime] = useState(myLog?.value ?? '')
  const needsTime = Boolean(routine.time_rule) && !done && !readOnly
  const missed = myLog && !myLog.done

  return (
    <li className="list-row" style={{ ['--accent' as string]: color }}>
      {needsTime ? (
        <span className="time-wrap" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <input
            type="time"
            className="input time-in"
            aria-label={`${routine.name} time`}
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
          <button type="button" className="btn btn-small" disabled={!time} onClick={() => onTick(time)}>
            Log
          </button>
        </span>
      ) : (
        <button
          type="button"
          className={`check${done ? ' on' : ''}`}
          aria-label={done ? `Undo ${routine.name}` : `Mark ${routine.name} done`}
          aria-pressed={done}
          disabled={readOnly}
          onClick={() => (done ? onUntick() : onTick())}
        >
          {done ? '✓' : ''}
        </button>
      )}
      <span className="grow">
        <button type="button" className="plain-btn" disabled={readOnly} onClick={onEdit}>
          <strong>{routine.name}</strong>
        </button>
        <span className="muted small block-text">{describeRoutine(routine)}</span>
        {dueText && <span className="muted small block-text">{dueText}</span>}
        {missed && <span className="miss">Missed ({myLog?.value}) — try again tomorrow</span>}
        {tickedBy.length > 0 && (routine.shared ? done : true) && (
          <span className="muted small block-text">
            {routine.shared
              ? `Done by ${tickedBy.map((m) => m.display_name).join(' & ')}`
              : `${tickedBy.map((m) => m.display_name).join(' & ')} ✓ today`}
          </span>
        )}
      </span>
      {streakCount > 1 && <span className="streak" aria-label={`${streakCount} in a row`}>🔥 {streakCount}</span>}
    </li>
  )
}
