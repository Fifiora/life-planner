import type { FocusGoal } from './reportTypes'

const MAX_GOALS = 3
const MAX_TEXT = 80

export const focusKey = (month: string): string => `focus:${month}`

function clean(list: unknown[]): FocusGoal[] {
  const out: FocusGoal[] = []
  for (const g of list) {
    if (!g || typeof g !== 'object') continue
    const { text, done } = g as { text?: unknown; done?: unknown }
    if (typeof text !== 'string') continue
    const trimmed = text.trim().slice(0, MAX_TEXT).trim()
    if (trimmed) out.push({ text: trimmed, done: Boolean(done) })
    if (out.length === MAX_GOALS) break
  }
  return out
}

/** The goals saved for a month; anything unreadable is simply no goals. */
export function parseFocus(raw: string | undefined): FocusGoal[] {
  if (!raw) return []
  try {
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) ? clean(value) : []
  } catch {
    return []
  }
}

export const serializeFocus = (goals: FocusGoal[]): string => JSON.stringify(clean(goals))
