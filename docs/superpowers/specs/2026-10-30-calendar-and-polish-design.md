# Calendar, Today upgrades and visual polish: design

Date: 2026-10-30. Status: awaiting review. No private data in this file (public repo).

## Intent
One calendar that ties Health, Study, Travel, Food and Finance together for two people. The plan starts **Mon 26 Oct 2026**; the calendar has **no end date and no navigation limit** (days before the start are dimmed but open). Plus a general improvement of look, feel and day-to-day usefulness. Everything stays on the phone (no login, no server); the view-only copy keeps working.

## Scope
1. **Calendar tab** (`/calendar`): month grid, agenda list, day sheet, custom events.
2. **Today upgrades**: week strip, "Up next", quick-add button, progress headline with streak.
3. **Look and feel**: dark mode (follows phone, manual override in Settings), motion, larger touch targets, friendlier empty/error states.
4. Bottom bar goes from 6 to 7 tabs (Calendar added after Today).

Out of scope: notifications, sync between phones, external calendar import/export, per-bill due days (offered, not built unless asked).

## Data
- New table `events`: `{ id, title, date, time|null, member ('both' | member id), category (bucket | 'other'), repeat ('none'|'weekly'|'biweekly'|'monthly'|'yearly'), repeat_until|null, notes, done_on: string[] }`. Per-occurrence completion lives in `done_on` (dates), so a repeating event can be ticked each time.
- Added to `TABLES`, backup/restore, and the shared view-only snapshot (trimmed like other tables). Existing data is untouched; the new table starts empty.
- Constant `PLAN_START = '2026-10-26'` in `src/lib/dates.ts`.

## Pure logic (`src/lib/calendar.ts`, unit-tested first)
- `monthGrid(monthKey)`: 6 weeks x 7 days starting Monday, any year.
- `eventOccurrences(event, from, to)`: expands repeats lazily inside a window (weekly, every 2 weeks, monthly with end-of-month clamping, yearly with 29 Feb clamping), honouring `repeat_until`.
- `routinesOn(date, routines, anchor)`: daily routines every day; weekly/biweekly with a weekday on that weekday (biweekly by anchor parity); monthly/quarterly routines without a weekday are listed under "this period", not on a day.
- `dayMarkers(date, ...)`: coloured dots by bucket from routines, events, trips in that month (month-level), nights turns.
- `dayCompletion(date, routines, logs, memberId)`: done/total for past days (drives the grid shading and streak).
- All date maths in UTC from `YYYY-MM-DD` strings (same approach as `dates.ts`), so there is no range limit.

## UI units
- `ui/MonthGrid` (grid, dots, today ring, dim before plan start, swipe-free prev/next buttons, month/year jump, "Today" button).
- `ui/AgendaList` (next N weeks, grouped by day, infinite "load more").
- `ui/DaySheet` (that day's routines with tick boxes using the existing routine rows, events with done tick, nights, add-event button).
- `ui/EventForm` (title, date, time, who, category, repeat, until, notes; edit and delete).
- `ui/WeekStrip`, `ui/UpNext`, `ui/QuickAdd` (expense / event / shopping item sheets reusing existing forms) on Today.
- `lib/theme.ts` + CSS variables for dark mode; Settings "Appearance" select (System / Light / Dark).
- View-only mode: calendar fully browsable, no add/edit/tick controls (same rule as other screens).

## Error handling
Invalid dates and empty titles are rejected in the form with inline messages. Corrupt imported event rows are skipped by the occurrence expander rather than crashing the screen (the error boundary stays as the last resort).

## Testing
TDD through CI as before: logic tests for `calendar.ts` (leap years, month ends, far-future dates such as 2040, plan-start dimming, repeat expansion, biweekly parity), component tests with the existing localStorage seed helpers (grid renders Oct 2026 and navigates beyond a year in both directions, day sheet ticks save, event create/edit/delete, view-only has no controls, Today week strip and quick-add), theme tests (system/override). Full suite plus typecheck must be green before each push; then a fresh independent review pass.

## Delivery order
1. `calendar.ts` + events table + Calendar screen + nav.
2. Today upgrades.
3. Dark mode and motion/touch polish, README update.
