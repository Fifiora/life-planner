import type { RoutineLog } from '../types'
import { addDays } from './dates'

/** How many different routines each person ticked on each of the last `days` days (today last). */
export function dailyTicks(logs: RoutineLog[], memberIds: string[], today: string, days: number): Record<string, number[]> {
  const start = addDays(today, -(days - 1))
  const seen = new Set<string>()
  const out: Record<string, number[]> = Object.fromEntries(memberIds.map((id) => [id, Array<number>(days).fill(0)]))
  for (const l of logs) {
    if (!l.done || l.date < start || l.date > today || !out[l.member_id]) continue
    const key = `${l.member_id}|${l.routine_id}|${l.date}`
    if (seen.has(key)) continue
    seen.add(key)
    const i = Math.round((Date.parse(`${l.date}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000)
    out[l.member_id][i] += 1
  }
  return out
}

/** A smooth line through the points (Catmull-Rom turned into curves), as an SVG path. */
export function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M${pts[0].x} ${pts[0].y}`
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
    d += ` C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}
