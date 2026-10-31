# Calendar, Today upgrades and visual polish: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an unlimited-range calendar (plan start Mon 26 Oct 2026) with custom repeating events, upgrade the Today screen, and add dark mode plus motion/touch polish.

**Architecture:** Pure date logic in `src/lib/calendar.ts` (UTC `YYYY-MM-DD` maths, no range tables), a new `events` table through the existing `useTable`/tableStore path, and small focused UI units composed by a new `Calendar` screen and the existing `Today` screen. Theme is CSS variables switched by a `data-theme` attribute.

**Tech Stack:** React 18, TypeScript, Vite 6, Tailwind 4 + `src/index.css`, HashRouter, Vitest 2 + RTL (jsdom). CI on GitHub (`/home/claude/ci.sh` waits for the HEAD run and prints failures); no local npm.

**Spec:** `docs/superpowers/specs/2026-10-30-calendar-and-polish-design.md`

## Global Constraints

- Plan start constant: `PLAN_START = '2026-10-26'`; calendar has no end date and no navigation limit; days before the start are dimmed but openable.
- All dates are `YYYY-MM-DD` strings; maths in UTC like `src/lib/dates.ts`; "today" comes from `todayCT()`; weeks start Monday (`weekStart`).
- Everything stays on the phone (localStorage `lp.data.<table>`); no login, no network.
- View-only mode (`readOnly` from `useHousehold`): browsing allowed, no add/edit/tick controls.
- Only today's routines can be ticked (existing `tick` uses `todayCT()`); other days show state read-only.
- Public repo: no real finance numbers or personal data in code, tests or docs.
- Every push: `npm test` and `tsc --noEmit` green in CI (`/home/claude/ci.sh`). Commit messages end with the two attribution lines from the session reminder.
- Existing tab names, labels and test ids must keep working (existing tests stay green).

## Review Focus

- Far-future and far-past navigation (2040, 2100, 1999) renders a correct grid with no crash. Pinned in Task 1 and Task 3.
- Yearly event on 29 Feb and monthly event on the 31st land on the last valid day in short months and years. Task 1.
- Biweekly routine parity for dates before the anchor (negative modulo) is still every other week. Task 1.
- A repeat event with `repeat_until` before its start, or a corrupt row (missing date/title), shows nothing and does not crash the screen. Task 1 and Task 3.
- A view-only copy made before this release has no `events` table; the Calendar must open empty, not error. Task 3.
- Switching month across a year boundary (Dec to Jan and back) keeps the right month label and grid. Task 3.
- An event dated before the plan start is still shown (dimming is cosmetic). Task 3.

---

## File structure

- Create `src/lib/calendar.ts`: pure logic (grid, occurrences, routinesOn, dayMarkers, dayCompletion, validateEvent).
- Create `src/data/useEvents.ts`: events table hook with add/edit/delete/toggleDone.
- Create `src/screens/Calendar.tsx`; `src/ui/MonthGrid.tsx`, `AgendaList.tsx`, `DaySheet.tsx`, `EventForm.tsx`, `WeekStrip.tsx`, `UpNext.tsx`, `QuickAdd.tsx`.
- Create `src/lib/theme.ts`.
- Modify `src/types.ts`, `src/lib/tables.ts`, `src/lib/dates.ts`, `src/App.tsx`, `src/ui/TabBar.tsx`, `src/screens/Today.tsx`, `src/screens/Settings.tsx`, `src/main.tsx`, `src/index.css`, `README.md`.
- Tests: `tests/calendar.test.ts`, `tests/events.test.tsx`, `tests/calendarScreen.test.tsx`, `tests/today.test.tsx`, `tests/theme.test.ts`, plus tab-count updates in existing tests if any assert six tabs.

---

### Task 1: Calendar logic

**Files:**
- Create: `src/lib/calendar.ts`
- Modify: `src/lib/dates.ts` (add `PLAN_START`), `src/types.ts` (add `CalEvent`)
- Test: `tests/calendar.test.ts`

**Interfaces:**
- Produces:
  - `export const PLAN_START = '2026-10-26'` in `dates.ts`
  - `type Repeat = 'none'|'weekly'|'biweekly'|'monthly'|'yearly'`
  - `interface CalEvent { id: string; title: string; date: string; time: string|null; member: string; category: Bucket|'other'; repeat: Repeat; repeat_until: string|null; notes: string; done_on: string[] }` in `types.ts` (`member` is `'both'` or a member id)
  - `monthGrid(monthKey: string): string[][]` (6 rows x 7 dates, Monday first, includes leading/trailing days of neighbouring months)
  - `eventOccurrences(event: CalEvent, from: string, to: string): string[]` (inclusive window, ascending, `[]` for corrupt rows or `repeat_until < date`)
  - `routinesOn(date: string, routines: Routine[], anchor: string): Routine[]`
  - `dayMarkers(date: string, input: { routines: Routine[]; events: CalEvent[]; anchor: string }): Bucket[]` (distinct bucket colours, events with category `'other'` map to `'finance'`-free neutral: return type `(Bucket|'other')[]`)
  - `dayCompletion(date: string, routines: Routine[], logs: RoutineLog[], memberId: string, anchor: string): { done: number; total: number }`
  - `validateEvent(v: { title: string; date: string; repeat: Repeat; repeat_until: string|null }): string | null` (error text or null)

- [ ] **Step 1: Write failing tests** in `tests/calendar.test.ts`:
  - `monthGrid('2026-10')`: 6 rows, 7 columns, first cell `'2026-09-28'` (Monday), contains `'2026-10-26'`; `monthGrid('2040-02')` and `monthGrid('1999-12')` return 42 valid dates; `monthGrid('2028-02')` includes `'2028-02-29'`.
  - `eventOccurrences`: weekly from `2026-10-26` over `2026-10-26..2026-11-16` gives 4 dates; biweekly gives `10-26, 11-09`; monthly on `2026-01-31` gives `2026-02-28` and `2026-03-31`; yearly on `2024-02-29` gives `2025-02-28` and `2028-02-29`; `repeat: 'none'` outside window gives `[]`; `repeat_until` before `date` gives `[]`; row with `date: ''` gives `[]`; window in 2100 works for a weekly event started 2026.
  - `routinesOn`: daily routine on every date; weekly Sunday routine only on `2026-11-01`; biweekly routine with weekday 1 and anchor `2026-11-02` matches `2026-11-02` and `2026-11-16`, not `2026-11-09`, and also matches `2026-10-19` (before the anchor); monthly routine with no weekday never matches.
  - `dayCompletion`: 2 daily routines, one logged done for member `a` gives `{done:1,total:2}`; a log by another member does not count for non-shared routines.
  - `validateEvent`: empty title, bad date (`'2026-13-40'`), and `repeat_until` earlier than `date` each return a message; a valid value returns `null`.
- [ ] **Step 2: Run** `npm test -- tests/calendar.test.ts` (via CI). Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the functions above in `src/lib/calendar.ts` using `addDays`, `daysBetween`, `weekStart` from `dates.ts`; month clamping by computing the last day of the target month; biweekly parity as `Math.floor(daysBetween(anchor, d) / 7)` modulo 2 with a positive-modulo helper, applied only when `d`'s weekday equals the routine's weekday. Reuse `periodProgress`/`scopedLogs` semantics from `cadence.ts` for `dayCompletion` (shared routines count any member's log).
- [ ] **Step 4: Run tests**; expected PASS.
- [ ] **Step 5: Commit** `feat: calendar date logic (grid, repeats, routine days)`.

### Task 2: Events data and form

**Files:**
- Create: `src/data/useEvents.ts`, `src/ui/EventForm.tsx`
- Modify: `src/lib/tables.ts` (add `'events'`)
- Test: `tests/events.test.tsx`

**Interfaces:**
- Consumes: `validateEvent`, `CalEvent` (Task 1); `useTable` (existing); `useHousehold().me`.
- Produces:
  - `useEvents(): { events: CalEvent[]; add(v: EventValues): Promise<void>; edit(id: string, v: EventValues): Promise<void>; remove(id: string): Promise<void>; toggleDone(id: string, date: string): Promise<void> }`
  - `type EventValues = Omit<CalEvent, 'id' | 'done_on'>`
  - `<EventForm initial?: CalEvent; defaultDate: string; members: Member[]; onSave(v: EventValues): void; onDelete?(): void />` with labels "Title", "Date", "Time", "For", "Category", "Repeat", "Repeat until", "Notes", button "Save event", delete button "Delete event".

- [ ] **Step 1: Write failing tests** in `tests/events.test.tsx` using `seedPlanner`/`renderScreen`: saving the form with title "Dentist", date `2026-11-03`, repeat "Every 2 weeks" calls `onSave` with those values; empty title shows alert "Give the event a title."; `repeat_until` before date shows the `validateEvent` message; `toggleDone('e1','2026-11-03')` adds the date to `done_on` and toggling again removes it (read back from `localStorage['lp.data.events']`); `remove` deletes the row.
- [ ] **Step 2: Run**; expected FAIL.
- [ ] **Step 3: Implement** `useEvents` over `useTable<CalEvent>('events')` (ids generated by the store like other tables) and `EventForm` (controlled inputs, validation via `validateEvent`, `role="alert"` error text, defaults: member `'both'`, category `'other'`, repeat `'none'`).
- [ ] **Step 4: Run tests**; expected PASS. Also confirm backup/restore lists `events` (existing `TABLES`-driven code) with a one-line assertion in this file.
- [ ] **Step 5: Commit** `feat: events table, hook and form`.

### Task 3: Calendar screen and navigation

**Files:**
- Create: `src/screens/Calendar.tsx`, `src/ui/MonthGrid.tsx`, `src/ui/AgendaList.tsx`, `src/ui/DaySheet.tsx`
- Modify: `src/App.tsx` (route `/calendar`), `src/ui/TabBar.tsx` (add `{ to: '/calendar', label: 'Calendar', icon: '🗓️' }` second, after Today), `src/index.css`
- Test: `tests/calendarScreen.test.tsx`

**Interfaces:**
- Consumes: Task 1 functions, Task 2 `useEvents`/`EventForm`, `useRoutineData`, `useTable<TripPlan>`, existing `RoutineRows`, `Sheet`, `Ring`/colour vars.
- Produces: `<MonthGrid month: string; selected: string; today: string; markers(date): (Bucket|'other')[]; completion(date): {done:number;total:number}; onSelect(date); />`, `<AgendaList from: string; days: number; ... />`, `<DaySheet date open onClose />`.

- [ ] **Step 1: Write failing tests** in `tests/calendarScreen.test.tsx`:
  - Renders heading with the current month and a "Today" button; buttons "Previous month" / "Next month" change the heading; pressing "Next month" 14 times shows the month 14 later and "Previous month" back returns; Dec 2026 then Next shows "January 2027".
  - Month/year jump: select labelled "Month" and number input labelled "Year"; setting Year `2040` shows a 2040 heading with 42 day buttons.
  - Day button for `2026-10-26` has `aria-label` containing "26" and no `dimmed` flag; `2026-10-25` button has `data-before-start="true"`.
  - Tapping a day opens dialog "Day details" listing that weekday's routines (Sunday shows "Sunday mass") and an "Add event" button; saving an event makes it appear in the agenda and as a dot on that day.
  - Tick on today's routine inside the day sheet writes a `routine_logs` row; the sheet for another day shows no tick boxes.
  - Event dated before plan start is listed on its day.
  - View-only (`lp.snapshot` mode via existing view-only test helper): no "Add event" button, no tick boxes, and a snapshot without an `events` table renders without error.
  - "Agenda" toggle lists upcoming days and a "Show more" button extends the list by 14 days.
- [ ] **Step 2: Run**; expected FAIL.
- [ ] **Step 3: Implement** screen state (`month`, `selected`, `view: 'month'|'agenda'`) and the three UI units; day cell is a button with `aria-label` `"<Weekday> <Month> <day>"`, colour dots from `dayMarkers`, a completion shade for past days on or after `PLAN_START`, today ring; route and tab added. Corrupt event rows are filtered by `eventOccurrences` returning `[]`.
- [ ] **Step 4: Run tests**; expected PASS, then full suite green.
- [ ] **Step 5: Commit** `feat: calendar tab with month grid, agenda and day sheet`.

### Task 4: Today upgrades

**Files:**
- Create: `src/ui/WeekStrip.tsx`, `src/ui/UpNext.tsx`, `src/ui/QuickAdd.tsx`
- Modify: `src/screens/Today.tsx`, `src/index.css`
- Test: `tests/today.test.tsx`

**Interfaces:**
- Consumes: Task 1-3 units; existing Finance expense insert (`useFinance(...).expenses.insert`), `useTable<ShoppingItem>('shopping')`, `streak` from `cadence.ts`.
- Produces: `<WeekStrip today />` (7 buttons from `weekStart(today)`, each linking to `/calendar` with the date), `<UpNext today limit={3} />`, `<QuickAdd />` (floating button "Quick add" opening a sheet with three choices: "Expense", "Event", "Shopping item").

- [ ] **Step 1: Write failing tests**: week strip shows seven day buttons with today marked `aria-current="date"`; "Up next" lists a seeded event dated tomorrow and omits events older than today; headline text "3 of 6 done" style line reflects seeded logs ("done today" count for today's items) and shows a streak count when a daily routine has consecutive logs; "Quick add" then "Expense" saves an expense row; "Event" saves an event; "Shopping item" saves a shopping row; none of the quick-add controls render in view-only mode.
- [ ] **Step 2: Run**; expected FAIL.
- [ ] **Step 3: Implement** the units and place them in `Today.tsx` (strip under the greeting, Up next after rings, headline in the page sub-line). Keep existing Today texts so earlier tests stay green.
- [ ] **Step 4: Run tests**; expected PASS, full suite green.
- [ ] **Step 5: Commit** `feat: today week strip, up next, quick add and progress headline`.

### Task 5: Dark mode

**Files:**
- Create: `src/lib/theme.ts`
- Modify: `src/main.tsx` (apply on boot), `src/screens/Settings.tsx` ("Appearance" select), `src/index.css` (dark variable set)
- Test: `tests/theme.test.ts`

**Interfaces:**
- Produces: `type ThemeChoice = 'system'|'light'|'dark'`; `getThemeChoice(): ThemeChoice` (reads `lp.theme`, default `'system'`, unknown values fall back to `'system'`); `setThemeChoice(c: ThemeChoice): void` (stores and applies); `applyTheme(choice: ThemeChoice, prefersDark: boolean, root?: HTMLElement): 'light'|'dark'` (sets `data-theme` on `<html>` and returns the resolved value).

- [ ] **Step 1: Write failing tests**: `applyTheme('system', true)` returns `'dark'` and sets `data-theme="dark"`; `('system', false)` gives light; `('dark', false)` gives dark; `getThemeChoice()` returns `'system'` for missing or garbage storage; `setThemeChoice('dark')` stores `lp.theme`; Settings shows select "Appearance" with the three options and changing it updates `data-theme`.
- [ ] **Step 2: Run**; expected FAIL.
- [ ] **Step 3: Implement** with a `matchMedia('(prefers-color-scheme: dark)')` listener registered once in `main.tsx` (guarded when `matchMedia` is missing, as in jsdom); define dark values for every existing CSS variable under `html[data-theme="dark"]`.
- [ ] **Step 4: Run tests**; expected PASS.
- [ ] **Step 5: Commit** `feat: dark mode with system default and manual override`.

### Task 6: Motion, touch polish, docs

**Files:**
- Modify: `src/index.css`, `src/ui/EmptyState.tsx` and `src/ui/ErrorBoundary.tsx` (copy only), `README.md`
- Test: `tests/polish.test.tsx`

- [ ] **Step 1: Write failing tests**: the error boundary fallback shows a "Try again" button; `EmptyState` renders its action button with class `btn`; the CSS file contains `prefers-reduced-motion` (read the file in the test) and `min-height: 44px` rules for `.tab`, `.btn`, `.add-btn`.
- [ ] **Step 2: Run**; expected FAIL.
- [ ] **Step 3: Implement** transitions for sheets, tabs and rings (all wrapped by a `@media (prefers-reduced-motion: no-preference)` block), 44px minimum touch targets, friendlier empty/error copy; update README with the Calendar, Today and Appearance sections.
- [ ] **Step 4: Run tests**; expected PASS, full suite and typecheck green on CI.
- [ ] **Step 5: Commit** `feat: motion and touch polish, README`. Then request one fresh whole-branch review (Opus, read-only) against this plan and the spec; fix Critical/Important findings test-first.
