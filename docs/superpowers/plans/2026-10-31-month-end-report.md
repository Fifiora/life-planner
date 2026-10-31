# Month-end report implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Report page that shows everything that happened in a month (routines, health, study, travel, food, money, calendar), says plainly what went well and what to improve, lets the two of them set next month's focus, and exports as print/PDF, copied text or a downloaded file.

**Architecture:** Pure functions turn the saved lists into one plain-data `Report` (`buildReport`); the page and the Markdown export both read that same object. Only the focus goals are written, through the existing `settings` table, so sync needs no change. The Today card and the game lines reuse existing helpers.

**Tech Stack:** React 18, TypeScript, Vite 6, Tailwind 4 + `src/index.css`, Vitest 2 + RTL. No new dependencies. The sandbox has no `node_modules`: every test run is `git push` then `bash /home/claude/ci.sh`.

**Spec:** `docs/superpowers/specs/2026-10-31-month-end-report-design.md`

## Global Constraints

- All dates use the Chicago helpers in `src/lib/dates.ts` (`todayCT`, `addDays`, `weekStart` (Monday), `daysBetween`, `PLAN_START = '2026-10-26'`); month keys are `YYYY-MM`.
- Months offered: finished months since the plan start, newest first (`finishedMonths(today)` in `src/lib/episode.ts`), plus the current month labelled `so far`. Nothing before `2026-10`. With no finished month yet, the page opens on the current month.
- A tick counts once per person per routine per day and a tick whose routine no longer exists is ignored (`memberTicks` in `src/lib/xp.ts`).
- Thresholds: improve a routine under 60%; a category more than 10% over budget; time-rule routines under 70% on time; study milestones under 50% done; wins at 90% or more for routines, a category more than 10% under budget, best streak 7 days or more. At most 7 improvement lines and 5 win lines; routine lines at most 3 each.
- Insight wording is fixed (see Task 4) and money is formatted with `money()` from `src/lib/format.ts`.
- Focus: up to 3 goals, 80 characters each, in the `settings` table under key `focus:YYYY-MM` (the month the goals are for) as JSON `[{"text":"...","done":false}]`.
- Trivia accuracy is all-time (answers carry no date) and labelled so. No "XP gained" in the report. Game lines (level now, bosses beaten) show in Anime only; Classic shows none of the game layer. Everything else is the same in both styles.
- Export file is Markdown named `life-planner-report-YYYY-MM.md`. Copy never throws if the clipboard is blocked.
- No division by zero reaches the screen: zero budgets, zero expected ticks or zero logged days show as `—` and are skipped by the insight rules.
- Existing tests keep passing; `npm run build` includes `tsc --noEmit`. Every commit ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01KLNtuVaFTQGxDeysXMMWtG`. Commit the failing test first, then the code. A phase is done when CI is green.

## Review Focus

- A month with no data at all: every section says `Nothing logged`, no wins or improvements, nothing throws (Tasks 5 and 7).
- The current month (`so far`): expected counts stop at today and rules that need a full month do not judge (Tasks 1, 4, 5).
- A routine deleted after being ticked, milestones counted by `week_start`, and a Sunday tick belonging to the Monday-start week before it (Tasks 1, 2).
- Zero budget, zero expected ticks, zero logged days: no `NaN`, `Infinity` or `-` percent text anywhere (Tasks 1, 3, 4, 6).
- Clipboard blocked, a browser without `URL.createObjectURL`, and the focus box in a view-only copy (Tasks 9, 10).

## File structure

| File | Responsibility |
|---|---|
| `src/lib/reportTypes.ts` | `ReportInput`, `Report` and the section types (plain data) |
| `src/lib/reportSections.ts` | one pure function per section |
| `src/lib/reportInsights.ts` | wins and improvement rules |
| `src/lib/report.ts` | `buildReport` (assembles) |
| `src/lib/reportText.ts` | `reportToMarkdown` |
| `src/lib/focus.ts` | focus parse, serialise, key |
| `src/lib/clipboard.ts` | `copyText` |
| `src/data/useReport.ts` | gathers saved lists, returns the `Report` |
| `src/screens/Report.tsx` | page, month picker, section views |
| `src/ui/ReportView.tsx` | the section cards |
| `src/ui/FocusBox.tsx` | next-month goals and last month's goals |
| `src/ui/ReportCard.tsx` | Today card |
| `tests/reportFixture.ts` | `reportInput(over?: Partial<ReportInput>): ReportInput`, an empty valid input with members `a` (Ada) and `b` (Ben), `today: '2026-11-03'` |

---

## Phase 1: The calculations (pure, no screens)

### Task 1: Types, month range, scorecard and routines

**Files:**
- Create: `src/lib/reportTypes.ts`, `src/lib/reportSections.ts`, `tests/reportFixture.ts`, `tests/reportSections.test.ts`
- Modify: none

**Interfaces:**
- Produces in `reportTypes.ts`:
  - `interface ReportInput { members: { id: string; display_name: string }[]; routines: Routine[]; logs: RoutineLog[]; activities: Activity[]; milestones: Milestone[]; attempts: TriviaAttempt[]; trips: TripPlan[]; places: Place[]; nights: NightLog[]; events: CalEvent[]; expenses: Expense[]; bills: Bill[]; payments: BillPayment[]; budgets: Budget[]; savings: SavingsEntry[]; incomeConfigured: number; savingsTarget: number; today: string }`
  - `interface MonthRange { month: string; first: string; last: string; days: number; partial: boolean }`
  - `interface Scorecard { ticksByMember: Record<string, number>; prevTicksByMember: Record<string, number>; expectedTotal: number; doneTotal: number; completionPct: number | null; bestStreakByMember: Record<string, number>; spent: number; prevSpent: number }`
  - `interface RoutineRow { id: string; name: string; bucket: Bucket; memberId: string | 'shared'; count: number; expected: number; pct: number | null }`
- Produces in `reportSections.ts`: `monthRange(month: string, today: string): MonthRange` (`last` = month end, or `today` when the month is current; `partial` true only for the current month; `days` = number of days from `first` to `last`), `scorecardSection(r: MonthRange, input: ReportInput): Scorecard`, `routinesSection(r: MonthRange, input: ReportInput): RoutineRow[]`.

- [ ] **Step 1: Write failing tests** in `tests/reportSections.test.ts`: `monthRange('2026-10','2026-11-03')` is `{first:'2026-10-01', last:'2026-10-31', days:31, partial:false}`; `monthRange('2026-11','2026-11-03')` has `last:'2026-11-03'`, `days:3`, `partial:true`. Scorecard: ticks counted once per person per routine per day, a tick for a deleted routine ignored, ticks outside the month ignored, `prevTicksByMember` is the previous month's count, `completionPct` is `null` when `expectedTotal` is 0, and with ticks that meet expectations `completionPct` equals `round(doneTotal / expectedTotal * 100)`; `bestStreakByMember` uses `streakLengths` over the person's tick dates inside the month; `spent` and `prevSpent` come from `monthActuals(...).spent`. Routines: a non-shared `applies_to: 'both'` routine gives one row per person (`memberId` is their id), a shared routine one row with `memberId: 'shared'` counting either person's ticks, a routine for one member only that member's row, inactive routines skipped, each row's `count`/`expected` equal `scorecard(routine, logsForThem, last)`, `pct` is `null` when `expected` is 0, and rows come back weakest first (`null` pct last).
- [ ] **Step 2:** Push, `bash /home/claude/ci.sh`; expect FAIL (modules missing).
- [ ] **Step 3: Implement** the types and the three functions. Reuse `scorecard` from `src/lib/habits.ts`, `memberTicks`/`memberTickDates` from `src/lib/xp.ts`, `streakLengths` from `src/lib/streak.ts`, `monthActuals` from `src/lib/ledger.ts`, `shiftMonthKey` from `src/lib/format.ts`.
- [ ] **Step 4:** Push, CI: PASS.
- [ ] **Step 5: Commit** (`feat: report month range, scorecard and routines`).

### Task 2: Health, study, travel, food

**Files:**
- Modify: `src/lib/reportTypes.ts`, `src/lib/reportSections.ts`
- Test: `tests/reportSections.test.ts`

**Interfaces:**
- Consumes: `MonthRange`, `ReportInput` (Task 1).
- Produces:
  - `interface HealthSection { byMember: Record<string, { workouts: number; minutes: number; byType: Record<string, number> }>; timed: { routineId: string; name: string; memberId: string; logged: number; onTime: number; pct: number | null }[]; weeksWithoutWorkout: string[] }`
  - `interface StudySection { milestones: Record<string, { done: number; total: number }>; triviaAllTime: Record<string, { attempts: number; correct: number }> }`
  - `interface TravelSection { planned: number; done: number; trips: { place: string; status: 'planned' | 'done' }[] }`
  - `interface FoodSection { grocerySpent: number; groceryBudget: number; nightsByType: Record<string, number>; groceryRoutinePct: number | null }`
  - `healthSection(r, input)`, `studySection(r, input)`, `travelSection(r, input)`, `foodSection(r, input)`.

- [ ] **Step 1: Write failing tests**: Health counts activities dated in the month per person with minutes (null minutes = 0) and by type; `timed` has one row per member per routine with a `time_rule`, from `timeStats(logs, routine, r.last, r.days, memberId)` with `pct` null when `logged` is 0; `weeksWithoutWorkout` lists the Mondays (`weekStart`) of weeks starting inside the month with no activity by anyone (a week with one run is not listed). Study counts milestones whose `week_start` is inside the month (a Sunday-dated `week_start` is not shifted), done against total per person, and trivia all-time attempts and correct per person. Travel counts `trip_plans` with `planned_month === month`, planned = all of them, done = status `done`, trip place names from `places`, an unknown place shows `Unknown place`. Food: `grocerySpent` = `flexView(0, expenses, month).groceries`, `groceryBudget` = sum of recurring bills whose `normCategory(category) === 'food'`, `nightsByType` counts `night_log` entries dated in the month, `groceryRoutinePct` is the completion % of routines with `bucket: 'food'` and a name containing `rocery` (null if none or expected 0).
- [ ] **Step 2:** Push, CI: FAIL.
- [ ] **Step 3: Implement** the four functions with the signatures above.
- [ ] **Step 4:** Push, CI: PASS.
- [ ] **Step 5: Commit.**

### Task 3: Finance and calendar

**Files:**
- Modify: `src/lib/reportTypes.ts`, `src/lib/reportSections.ts`
- Test: `tests/reportSections.test.ts`

**Interfaces:**
- Produces:
  - `interface FinanceSection { incomeConfigured: number; incomeLogged: number; spent: number; savedThisMonth: number; savingsTarget: number; billsPaid: number; billsDue: number; unpaid: string[]; payoffsCleared: string[]; categories: { category: string; budget: number; spent: number; ratio: number | null }[]; changes: { category: string; delta: number }[] }`
  - `interface CalendarSection { done: number; missed: number; upcoming: number }`
  - `financeSection(r, input)`, `calendarSection(r, input)`.

- [ ] **Step 1: Write failing tests**: Finance: `spent` and `incomeLogged` from `monthActuals`; `savedThisMonth` = sum of `savings` entries for the month; `billsPaid`/`billsDue`/`unpaid` (names) from `billsPaidSummary`; `payoffsCleared` = names of one-time bills with `paid` and `due_month === month`; `categories` from `budgetRows({ bills, budgets, months: [month], actuals: [monthActuals] })` keeping rows with `budget > 0` or `spent > 0`, `spent` = that month's value, `ratio` null when budget is 0; `changes` = the three categories with the largest absolute change in spend against the previous month (ties by name), only those with a non-zero change. Calendar: every event occurrence in the month (`eventOccurrences(event, r.first, r.last)`); `done` when the event's `done_on` has the date, `missed` when not done and date before `input.today`, `upcoming` when not done and date on or after `input.today`.
- [ ] **Step 2:** Push, CI: FAIL.
- [ ] **Step 3: Implement** both functions.
- [ ] **Step 4:** Push, CI: PASS.
- [ ] **Step 5: Commit.**

### Task 4: Wins and improvements

**Files:**
- Create: `src/lib/reportInsights.ts`, `tests/reportInsights.test.ts`

**Interfaces:**
- Consumes: the section types from Tasks 1 to 3.
- Produces: `interface Insight { area: Bucket | 'calendar' | 'general'; text: string }`, `insightsFor(input: { range: MonthRange; members: { id: string; display_name: string }[]; scorecard: Scorecard; routines: RoutineRow[]; health: HealthSection; study: StudySection; travel: TravelSection; finance: FinanceSection; game?: { bossesBeaten: number } }): { wins: Insight[]; improve: Insight[] }`.
- Wording (exact; `{name}` is the routine name with the person's name appended as `{name} ({person})` for per-person rows):
  - improve routine: `{name} was done {pct}% of the time ({count} of {expected}).` (pct under 60, expected above 0, weakest three)
  - improve category: `{Category} ran {over}% over budget ({spent} against {budget}).` with `over = round((spent / budget - 1) * 100)`, `Category` capitalised, only when `spent > budget * 1.10` and budget above 0
  - improve unpaid: `{n} monthly bill(s) not paid: {names}.` for a finished month; `{n} monthly bill(s) not paid yet.` when partial (singular `bill`, plural `bills`)
  - improve savings (finished month only): `Savings reached {saved} against the {target} target.` when saved is below target
  - improve timed: `{name} was on time {pct}% of logged days.` (pct under 70, logged above 0)
  - improve workouts: `No workout was logged in {n} week(s), starting with the week of {date}.`
  - improve study: `Study milestones: {done} of {total} done.` when total above 0 and done / total under 0.5
  - improve trips (finished month only): `{n} planned trip(s) not done.`
  - win routine: `{name}: {pct}% done. Keep it up!` (90 or more, top three)
  - win bills: `Every monthly bill was paid.` (billsDue above 0 and none unpaid)
  - win savings: `Savings hit {saved}, at or above the {target} target.` (finished month only)
  - win category: `{Category} came in {under}% under budget.` (budget above 0, spend above 0, `spent < budget * 0.90`, `under = round((1 - spent / budget) * 100)`)
  - win payoff: `Cleared: {names}.`
  - win streak: `Best streak: {days} days ({person}).` (7 or more, the best person)
  - win boss: `Boss beaten {n} time(s).` only when `game` is given and `bossesBeaten` above 0
- Ordering and caps: improve lines sorted by area priority finance, then routines (any bucket's routine lines), then all other areas, stable within a group, at most 7; wins in the order listed above, at most 5.

- [ ] **Step 1: Write failing tests**: each rule at its boundary: routine 59% listed and 60% not, category exactly 10% over not listed and 11% listed, time rule 69% listed and 70% not, study 49% listed and 50% not, savings below and at target, win routine 89% not and 90% listed, category 10% under not a win and 11% under a win, streak 6 not and 7 a win; the exact strings above for one case each; `{n}` singular/plural; partial month never emits the savings or trips lines and uses the `not paid yet.` wording; caps (nine failing routines give 3 routine lines; the 8th improvement is dropped; a 6th win is dropped); an empty report gives `{ wins: [], improve: [] }`; zero budget, zero expected and zero logged never produce a line containing `NaN` or `Infinity`.
- [ ] **Step 2:** Push, CI: FAIL.
- [ ] **Step 3: Implement** `insightsFor`.
- [ ] **Step 4:** Push, CI: PASS.
- [ ] **Step 5: Commit.**

### Task 5: Focus, buildReport and boss count

**Files:**
- Create: `src/lib/focus.ts`, `src/lib/report.ts`, `tests/focus.test.ts`, `tests/report.test.ts`
- Modify: `src/lib/reportTypes.ts` (add `Report`, `FocusGoal`), `src/lib/boss.ts` (add `bossesBeatenIn`)

**Interfaces:**
- Produces:
  - `interface FocusGoal { text: string; done: boolean }`; `focusKey(month: string): string` (`focus:${month}`); `parseFocus(raw: string | undefined): FocusGoal[]` (bad JSON or wrong shape gives `[]`; at most 3; text trimmed, empty dropped, cut to 80 characters; `done` coerced to boolean); `serializeFocus(goals: FocusGoal[]): string` (same cleaning, JSON).
  - `interface Report { month: string; range: MonthRange; scorecard: Scorecard; routines: RoutineRow[]; health: HealthSection; study: StudySection; travel: TravelSection; food: FoodSection; finance: FinanceSection; calendar: CalendarSection; game: { level: number; bossesBeaten: number } | null; focus: FocusGoal[]; insights: { wins: Insight[]; improve: Insight[] } }`
  - `buildReport(month: string, input: ReportInput, extra?: { game?: { level: number; bossesBeaten: number } | null; focus?: FocusGoal[] }): Report`
  - `bossesBeatenIn(month: string, data: GameData, memberIds: string[]): number` in `boss.ts` (weeks whose Monday is inside the month and whose boss is defeated).

- [ ] **Step 1: Write failing tests**: `parseFocus` of undefined, `'nope'`, `'{}'` and `'[1]'` gives `[]`; four goals keep three; an 100-character goal is cut to 80; `serializeFocus` then `parseFocus` round-trips and drops blanks; `focusKey('2026-11')` is `focus:2026-11`. `buildReport('2026-10', reportInput())` for empty data returns all sections empty/zero, `insights` empty, `game` null, `focus` `[]`, and `JSON.stringify` of it contains no `NaN` (it serialises to `null`, so also assert no numeric field is `NaN` with a deep walk); with data it returns the same section objects the section functions return and `insights.improve` contains the weakest-routine line; `extra.game` and `extra.focus` pass through. `bossesBeatenIn('2026-11', data, ['a','b'])` counts a defeated Monday-2026-11-09 week and not a week starting in October.
- [ ] **Step 2:** Push, CI: FAIL.
- [ ] **Step 3: Implement** `focus.ts`, `report.ts`, and `bossesBeatenIn` (loop weeks with `addDays(w, 7)` and `bossProgress`).
- [ ] **Step 4:** Push, CI: PASS.
- [ ] **Step 5: Commit.**

### Task 6: Markdown

**Files:**
- Create: `src/lib/reportText.ts`, `tests/reportText.test.ts`

**Interfaces:**
- Produces: `reportToMarkdown(report: Report, members: { id: string; display_name: string }[], monthTitle: string): string` where `monthTitle` is like `October 2026` (callers pass `monthLabel(month)`), and `reportFileName(month: string): string` (`life-planner-report-${month}.md`).

- [ ] **Step 1: Write failing tests** on a small fixture report: first line is `# Life Planner report: October 2026` (with ` (so far)` appended for a partial month); contains the headings `## Scorecard`, `## Routines`, `## Health`, `## Study`, `## Travel`, `## Food`, `## Finance`, `## Calendar`, `## Wins`, `## Improve next month`; contains `- Ada: 31 ticks (24 last month)`; an empty section prints `Nothing logged`; wins and improvements print as `- <text>`; a null percent prints `—`; trivia line says `(all time)`; focus goals print as `- [ ] text` / `- [x] text` under `## Focus for <Month>`; game lines appear only when `report.game` is not null; the output has no `NaN`, `undefined` or `Infinity`; `reportFileName('2026-10')` is `life-planner-report-2026-10.md`.
- [ ] **Step 2:** Push, CI: FAIL.
- [ ] **Step 3: Implement** both functions.
- [ ] **Step 4:** Push, CI: PASS; phase 1 is done.
- [ ] **Step 5: Commit.**

---

## Phase 2: The page

### Task 7: Hook, route, month picker, scorecard and routines views

**Files:**
- Create: `src/data/useReport.ts`, `src/screens/Report.tsx`, `src/ui/ReportView.tsx`, `tests/reportScreen.test.tsx`
- Modify: `src/App.tsx` (add `<Route path="/report" element={<Report />} />` next to the other screens), `src/lib/episode.ts` (extract `episodeTitle(month: string): string` and have `episodeFor` use it), `src/index.css` (report styles)

**Interfaces:**
- Produces: `useReport(month: string): Report` (reads tables `routines, routine_logs, activities, milestones, trivia_attempts, trip_plans, places, night_log, events` with `useTable`, finance data from `useFinance(month)` (`bills`, `payments`, `expenses`, `budgets`, `savings` rows, `totalIncome`, `target`), members from `useHousehold`, focus from `useSettings().get(focusKey(month))`, game from `useGame()` when `on` (level `game.me.progress.level`, `bossesBeaten` from `bossesBeatenIn`), then `buildReport`); `ReportView({ report, members }: { report: Report; members: Member[] })` renders the section cards; `Report` screen (default export).
- Screen behaviour: `PageHead title="Month-end report"`; a `<select aria-label="Month">` with `finishedMonths(today)` then the current month as `<Month Year> (so far)`; selected month from `?month=` if it is one of the options, else the newest finished month, else the current month. Sections are cards with `h2` headings `Scorecard`, `Routines`, ... exactly as in Task 6. Anime shows `episodeTitle(month)` as a subtitle; Classic does not.

- [ ] **Step 1: Write failing tests** with `seedPlanner()` and `renderScreen(<Report />, '/report?month=2026-10')` (Report must read the route's query): heading `Month-end report`; the month select shows `October 2026` selected and an option for the current month ending `(so far)`; the Scorecard card lists `Ada` and `Ben` with tick counts; the Routines card lists a weakest-first routine with `N of M`; an empty planner shows `Nothing logged` in Health and no `NaN` text anywhere on the page; Anime shows the subtitle `Arc 1: The Fresh Start`, Classic does not; a month before the plan (`?month=2026-09`) falls back to a valid option; changing the select changes the headline month.
- [ ] **Step 2:** Push, CI: FAIL.
- [ ] **Step 3: Implement** the hook, the screen, `ReportView` for Scorecard and Routines (other sections render in Task 8), the route and the extraction in `episode.ts`.
- [ ] **Step 4:** Push, CI: PASS.
- [ ] **Step 5: Commit.**

### Task 8: Remaining sections, wins and improvements

**Files:**
- Modify: `src/ui/ReportView.tsx`, `src/index.css`
- Test: `tests/reportScreen.test.tsx`

**Interfaces:**
- Consumes: `Report`, `ReportView` (Task 7).

- [ ] **Step 1: Write failing tests** (a seeded month with known rows): Health shows each person's workouts and minutes and the on-time line for a timed routine; Study shows milestones `done of total` and a line containing `(all time)`; Travel lists a trip with its place; Food shows groceries `spent against budget` and nights in; Finance shows income, spent, savings against target, bills paid `n of m`, and an over-budget category; Calendar shows done, missed, upcoming; the `Wins` and `Improve next month` cards list the insight texts; a null percent shows `—`; Classic shows no game lines and Anime shows `Level now` and `Bosses beaten`.
- [ ] **Step 2:** Push, CI: FAIL.
- [ ] **Step 3: Implement** the remaining section views.
- [ ] **Step 4:** Push, CI: PASS.
- [ ] **Step 5: Commit.**

### Task 9: Focus box

**Files:**
- Create: `src/ui/FocusBox.tsx`, `tests/focusBox.test.tsx`
- Modify: `src/ui/ReportView.tsx` (mount two boxes: last month's goals at the top, next month's at the bottom)

**Interfaces:**
- Consumes: `useSettings` (`get`, `set`), `parseFocus`, `serializeFocus`, `focusKey` (Task 5), `useHousehold().readOnly`.
- Produces: `FocusBox({ month, mode }: { month: string; mode: 'review' | 'plan' })`: `review` lists the goals saved for `month` (this report's month) each with a checkbox named `Done: <text>` that saves `done`; `plan` edits goals for the month after the report's month (three inputs labelled `Goal 1` to `Goal 3`, heading `Next month's focus`, saves on blur with `serializeFocus`). In a view-only copy both are read-only (inputs `readOnly`, checkboxes disabled). `review` renders nothing when there are no goals.

- [ ] **Step 1: Write failing tests**: typing a goal in `Goal 1` and leaving the field writes `settings` key `focus:2026-11` for the report of October; a fourth goal cannot be entered (only three inputs); an 100-character goal is stored cut to 80; the November report shows `Our focus for November` with that goal and ticking `Done: ...` updates the saved JSON; blank goals are not saved; view-only shows the goal but the checkbox is disabled and the input read-only; corrupt saved JSON shows no goals and does not crash.
- [ ] **Step 2:** Push, CI: FAIL.
- [ ] **Step 3: Implement** `FocusBox` and mount it.
- [ ] **Step 4:** Push, CI: PASS.
- [ ] **Step 5: Commit.**

### Task 10: Export buttons and print styles

**Files:**
- Create: `src/lib/clipboard.ts`, `tests/clipboard.test.ts`, `tests/reportExport.test.tsx`
- Modify: `src/lib/files.ts` (`downloadText(name: string, text: string, type = 'application/json'): void`), `src/screens/Report.tsx` (button row with class `report-actions`), `src/index.css` (`@media print`)

**Interfaces:**
- Produces: `copyText(text: string): Promise<boolean>` (uses `navigator.clipboard.writeText`; on failure or when missing falls back to a hidden textarea and `document.execCommand('copy')`; returns whether it worked; never throws). Buttons named `Print or save as PDF` (calls `window.print()`), `Copy as text` (calls `copyText(reportToMarkdown(...))` then shows a toast `Copied.` or `Could not copy. Select the text and copy it yourself.`), `Download as file` (calls `downloadText(reportFileName(month), markdown, 'text/markdown')`).

- [ ] **Step 1: Write failing tests**: `copyText` returns true with a working clipboard, falls back and returns true when `clipboard.writeText` rejects and `execCommand` returns true, returns false (no throw) when both fail or the clipboard is undefined; `downloadText` passes the given type to the `Blob` and tolerates being called with a stubbed `URL.createObjectURL`; the three buttons exist; clicking `Copy as text` writes Markdown starting `# Life Planner report: October 2026`; `Download as file` is called with `life-planner-report-2026-10.md`; the stylesheet (read as in `tests/animeTheme.test.tsx`) contains an `@media print` block that hides `.tabbar` and `.report-actions`, and includes `break-inside: avoid` for `.card`.
- [ ] **Step 2:** Push, CI: FAIL.
- [ ] **Step 3: Implement** the helpers, buttons and print CSS (black on white, no shadows, sections not split across pages).
- [ ] **Step 4:** Push, CI: PASS.
- [ ] **Step 5: Visual check (not CI):** a mock page from the real CSS at phone and laptop widths and a print-media PDF screenshot; fix problems.
- [ ] **Step 6: Commit; CI green; tell Stone the report page is live and ask for a look.**

---

## Phase 3: Today card, Settings link, wrap-up

### Task 11: Today card and Settings link

**Files:**
- Create: `src/ui/ReportCard.tsx`, `tests/reportCard.test.tsx`
- Modify: `src/screens/Today.tsx` (mount `<ReportCard today={data.today} />` after the hero), `src/screens/Settings.tsx` (a `Month-end report` link card)

**Interfaces:**
- Consumes: `episodeMonthFor(today: string): string | null`, `monthLabel`.
- Produces: `ReportCard({ today }: { today: string })` shows `Your {Month} report is ready` and a link `Open report` to `/report?month={m}` when `episodeMonthFor(today)` is not null, in both styles; nothing otherwise and in a view-only copy it still shows (reading is allowed).

- [ ] **Step 1: Write failing tests**: on `2026-11-03` the card shows `Your October 2026 report is ready` and the link `href` is `/report?month=2026-10`; on `2026-11-12` and on `2026-10-20` nothing is rendered; Settings has a link `Month-end report` to `/report`; the card appears under Classic too.
- [ ] **Step 2:** Push, CI: FAIL.
- [ ] **Step 3: Implement** the card and the link.
- [ ] **Step 4:** Push, CI: PASS.
- [ ] **Step 5: Commit.**

### Task 12: README, full check, branch review

**Files:**
- Modify: `README.md` (a "Month-end report" section: what is in it, the rules for wins and improvements, the focus goals, the three exports, what is all-time or left out), the spec if anything changed (a "Deviations recorded during the build" section)

- [ ] **Step 1:** Update README and spec notes.
- [ ] **Step 2:** Push; CI shows tests and build green.
- [ ] **Step 3:** One fresh reviewer on the most capable model reviews the whole branch against the spec and the Review Focus above; fix Critical and Important findings test-first in one pass; ledger the rest.
- [ ] **Step 4:** Final report to Stone with the honest caveat that nothing was tried on a real phone, and a request to open October's report on the 1st and tell me what reads wrong.
