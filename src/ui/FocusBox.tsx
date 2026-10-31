import { useState } from 'react'
import { useHousehold } from '../data/household'
import { useSettings } from '../data/useSettings'
import { focusKey, parseFocus, serializeFocus } from '../lib/focus'
import { monthLabel, shiftMonthKey } from '../lib/format'
import type { FocusGoal } from '../lib/reportTypes'

const SLOTS = [0, 1, 2]

/**
 * `review`: the goals saved for this report's month, each with a "did we do it?" tick.
 * `plan`: up to three goals for the month after, saved when you leave a box.
 */
export function FocusBox({ month, mode }: { month: string; mode: 'review' | 'plan' }) {
  const { readOnly } = useHousehold()
  const settings = useSettings()
  const key = focusKey(mode === 'review' ? month : shiftMonthKey(month, 1))
  const goals = parseFocus(settings.get(key))
  const [drafts, setDrafts] = useState<Record<string, string[]>>({})
  const forKey = drafts[key] ?? SLOTS.map((i) => goals[i]?.text ?? '')

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

  const save = () => {
    if (readOnly) return
    const next: FocusGoal[] = forKey.map((text, i) => ({ text, done: goals[i]?.done ?? false }))
    const value = serializeFocus(next)
    if (value !== (settings.get(key) ?? '')) void settings.set(key, value)
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
            value={forKey[i]}
            onChange={(e) => setDrafts({ ...drafts, [key]: forKey.map((t, j) => (j === i ? e.target.value : t)) })}
            onBlur={save}
          />
        </div>
      ))}
    </section>
  )
}
