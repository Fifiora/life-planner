import { useState } from 'react'
import { useHousehold } from '../data/household'
import { useSettings } from '../data/useSettings'
import { focusKey, parseFocus, serializeFocus } from '../lib/focus'
import { monthLabel, shiftMonthKey } from '../lib/format'

const SLOTS = [0, 1, 2]

/**
 * `review`: the goals saved for this report's month, each with a "did we do it?" tick.
 * `plan`: up to three goals for the month after, saved when you leave a box. Only the boxes you
 * changed are applied on top of what is saved right now, so a goal your partner added is never lost.
 */
export function FocusBox({ month, mode }: { month: string; mode: 'review' | 'plan' }) {
  const { readOnly } = useHousehold()
  const settings = useSettings()
  const key = focusKey(mode === 'review' ? month : shiftMonthKey(month, 1))
  const goals = parseFocus(settings.get(key))
  const [edits, setEdits] = useState<Record<number, string>>({})

  if (mode === 'review') {
    if (goals.length === 0) return null
    const toggle = (i: number) => settings.set(key, serializeFocus(goals.map((g, j) => (j === i ? { ...g, done: !g.done } : g))))
    return (
      <section className="card" aria-labelledby="focus-review">
        <h2 id="focus-review">{`Our focus for ${monthLabel(month).split(' ')[0]}`}</h2>
        <ul className="list">
          {goals.map((g, i) => (
            <li key={i} className="list-row">
              <label className="grow">
                <input type="checkbox" aria-label={`Done: ${g.text}`} checked={g.done} disabled={readOnly} onChange={() => void toggle(i)} /> {g.text}
              </label>
            </li>
          ))}
        </ul>
        <p className="muted small">{`${goals.filter((g) => g.done).length} of ${goals.length} done`}</p>
      </section>
    )
  }

  const save = async () => {
    if (readOnly) return
    const next = SLOTS.map((i) => (i in edits ? { text: edits[i], done: false } : { text: goals[i]?.text ?? '', done: goals[i]?.done ?? false }))
    const value = serializeFocus(next)
    const unchanged = value === serializeFocus(goals)
    const nothingToKeep = settings.get(key) === undefined && parseFocus(value).length === 0
    if (!unchanged && !nothingToKeep) await settings.set(key, value)
    setEdits({})
  }
  return (
    <section className="card report-focus" aria-labelledby="focus-plan">
      <h2 id="focus-plan">Next month's focus</h2>
      <p className="muted small">{`Up to three goals for ${monthLabel(shiftMonthKey(month, 1))}. They show at the top of next month's report.`}</p>
      {SLOTS.map((i) => (
        <div key={i}>
          <label className="label" htmlFor={`goal-${i + 1}`}>{`Goal ${i + 1}`}</label>
          <input
            id={`goal-${i + 1}`}
            className="input"
            maxLength={80}
            readOnly={readOnly}
            value={i in edits ? edits[i] : (goals[i]?.text ?? '')}
            onChange={(e) => setEdits({ ...edits, [i]: e.target.value })}
            onBlur={() => void save()}
          />
        </div>
      ))}
    </section>
  )
}
