import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HouseholdProvider } from '../src/data/household'
import { resetStore } from '../src/data/tableStore'
import { ToastProvider } from '../src/ui/Toast'

const save = (table: string, rows: unknown[]) => localStorage.setItem(`lp.data.${table}`, JSON.stringify(rows))

/** A realistic little planner in this phone's storage, for screen smoke tests. */
export function seedPlanner() {
  localStorage.clear()
  sessionStorage.clear()
  resetStore()
  const today = new Date().toISOString().slice(0, 10)
  const month = today.slice(0, 7)
  save('members', [
    { id: 'a', display_name: 'Ada', color: '#16a34a', user_id: '' },
    { id: 'b', display_name: 'Ben', color: '#6366f1', user_id: '' },
  ])
  localStorage.setItem('lp.me', 'a')
  const r = (id: string, name: string, over: Record<string, unknown> = {}) => ({
    id, name, bucket: 'health', sub_bucket: 'physical', cadence: 'daily', times_per_period: 1, applies_to: 'both', place: null, time_rule: null, weekday: null, active: true, shared: false, ...over,
  })
  save('routines', [
    r('r1', 'Daily activity'),
    r('r2', 'Lights out', { time_rule: 'before 22:30' }),
    r('r3', 'Wake up', { time_rule: 'after 04:00' }),
    r('r4', 'Sunday mass', { sub_bucket: 'spiritual', cadence: 'weekly', weekday: 0, shared: true }),
    r('r5', 'Grocery shopping', { bucket: 'food', sub_bucket: null, cadence: 'biweekly', shared: true }),
    r('r6', 'Salon', { cadence: 'monthly', place: 'Braids and Fadez', shared: true }),
  ])
  save('routine_logs', [
    { id: 'l1', routine_id: 'r1', member_id: 'a', date: today, done: true, value: null },
    { id: 'l2', routine_id: 'r2', member_id: 'a', date: today, done: true, value: '21:55' },
  ])
  save('income', [{ id: 'i1', name: 'Combined', monthly_amount: 19200 }])
  const bill = (id: string, name: string, amount: number, category: string) => ({ id, name, amount, category, kind: 'recurring', due_month: null, paid: false })
  save('bills', [
    bill('b1', 'Rent', 1700, 'housing'),
    bill('b2', 'Netflix', 7, 'subscriptions'),
    bill('b3', 'Groceries', 500, 'food'),
    { id: 'b4', name: 'Card payoff', amount: 2200, category: 'debt', kind: 'one_time', due_month: month, paid: false },
  ])
  save('settings', [{ id: 's1', key: 'savings_target', value: '10000' }])
  save('places', [
    { id: 'p1', name: 'Austin', drive_hours: 3, rank: 1, visited: false },
    { id: 'p2', name: 'New Orleans', drive_hours: 8, rank: 2, visited: false, notes: 'Food trip', est_cost: 900 },
  ])
  save('milestones', [{ id: 'm1', week_start: today, member_id: 'a', text: 'Read chapter 3', done: false }])
  save('trivia_topics', [{ id: 't1', topic: 'Cardio', claimed_by: 'a', author_id: 'b' }])
  save('trivia_questions', [{ id: 'q1', topic_id: 't1', prompt: 'Resting HR?', options: ['a', 'b', 'c', 'd'], correct_index: 0 }])
  save('trivia_attempts', [{ id: 'at1', question_id: 'q1', member_id: 'a', chosen_index: 0, correct: true }])
}

export function renderScreen(ui: ReactElement, route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>
        <HouseholdProvider>{ui}</HouseholdProvider>
      </ToastProvider>
    </MemoryRouter>,
  )
}

export const saved = (table: string): any[] => JSON.parse(localStorage.getItem(`lp.data.${table}`) ?? '[]')
