# Month-end report: design

Date: 2026-10-31. Status: for review.

## Why

At the end of each month Stone and his wife want one place that shows everything that happened (routines, health, study, travel, food, money, calendar) and says plainly what went well and what to improve, so the next month starts with a few clear goals. The report is worked out from data the app already saves and syncs. Nothing about it is estimated or invented.

## What was agreed in chat

- A Report page for any finished month, plus "this month so far".
- On days 1 to 7 of a month, Today shows a card: "Your <Month> report is ready".
- Sections: scorecard, routines, health, study, travel, food, finance, calendar, wins and "improve next month".
- A "Next month's focus" box with up to three goals, saved and synced; next month's report opens by showing how those went.
- Output: a print-friendly page (save as PDF from the browser), "Copy as text", and "Download as file".
- Works in both Anime and Classic styles (it is a real tool). Anime adds the episode title as a subtitle and the game lines (level, bosses, best streak); Classic shows none of the game layer.
- Plain language, original wording, no renaming of existing buckets or words.

## Scope

### The report page

- Route `/report`, month chosen by `?month=YYYY-MM`. A month picker lists finished months since the plan start (`PLAN_START`, 2026-10-26) newest first, plus the current month labelled "so far". Months before the plan began are not offered. With no finished month yet, the page opens on the current month so far.
- Entry points: the Today card (days 1 to 7), a "Month-end report" link in Settings. It is not a seventh bottom tab.
- View-only copies can read the report; the focus box is read-only there.
- A month with no data in a section shows "Nothing logged" for it and adds nothing to wins or improvements.

### Sections and where every number comes from

All dates use the Chicago date helpers. "Last day" is the month's last day, or today for the current month.

1. **Scorecard**: ticks per person (once per person per routine per day), completion % overall (ticks against expected ticks, below), best day-streak per person (Anime shows the level too), ticks and spending compared with the previous month. Anime only: bosses beaten this month (weeks starting in the month).
2. **Routines**: for each active routine, ticks against expected for the month, using the existing `scorecard(routine, logs, lastDay)` rules; per person for routines that apply to one person, and a single line for shared routines (either partner's tick counts). Sorted weakest first with the best three called out.
3. **Health**: health activities per person by type (count and minutes); for routines with a time rule (bedtime, wake-up) the on-time rate from `timeStats` over the month's days.
4. **Study**: milestones whose `week_start` falls in the month, done against set, per person. Trivia accuracy is **all-time** and labelled so, because answers carry no date.
5. **Travel**: trip plans with `planned_month` equal to the month, planned against done, with place names.
6. **Food**: grocery and food spending against its budget (`budgetFor('food', ...)`), grocery routines' completion, and nights in (`night_log` entries dated in the month) by type.
7. **Finance**: configured income and logged income; spending (`monthActuals`); savings entered for the month against the target (default $10,000); recurring bills paid against due (`billsPaidSummary`); one-time payoffs cleared this month; spending against budget by category (`budgetRows` for the single month), over-budget categories flagged; the three categories with the largest change against the previous month.
8. **Calendar**: events with an occurrence in the month, done (`done_on`) against not done for days already past.
9. **Wins and Improve next month**: rule-based lines (below), each tagged with its area.

Not included, because it cannot be dated: XP gained in the month. The report shows today's level only.

### Wins and improvements (rules, all thresholds fixed and tested)

Improve: a routine under 60% completion (weakest three at most); a category more than 10% over its budget; any recurring bill unpaid for the month; savings below the target; bedtime or wake-up on time less than 70% of logged days; a calendar week of the month with no health activity logged; study milestones done under 50%; a planned trip not done. At most seven improvement lines, most important first (money, then routines, then the rest), each a plain sentence with the number.

Wins: a routine at 90% or more (top three); every recurring bill paid; savings at or above target; a category under budget by more than 10%; a payoff cleared; best streak of 7 days or more; Anime only: a boss beaten. At most five win lines.

### Next month's focus

- Up to three short goals (80 characters each) written in this month's report for the **next** month, stored in the existing `settings` table under `focus:YYYY-MM` (the month the goals are for) as JSON `[{ "text": "...", "done": false }]`. It syncs like every other setting; no server change.
- The following month's report opens with "Our focus for <Month>" listing those goals with a checkbox each ("did we do it?"), and a count in the scorecard. Editing is disabled in view-only copies.

### Getting it out

- **Print or PDF**: a print stylesheet hides the tab bar, buttons and animation, uses black on white, and avoids splitting a section across pages. A "Print or save as PDF" button calls the browser print.
- **Copy as text** and **Download as file**: both use one pure function that turns the report into Markdown. The file is named `life-planner-report-YYYY-MM.md`. Copy uses the clipboard with a fallback that selects the text if the clipboard is blocked.
- Both styles produce the same content; Anime adds only the episode title and game lines.

## Components and boundaries

| Unit | Purpose | Depends on |
|---|---|---|
| `src/lib/report.ts` | `buildReport(month, input): Report` (pure) and the `Report` types | the section units |
| `src/lib/reportSections.ts` | one pure function per section above | existing libs (`habits`, `ledger`, `finance2`, `calendar`, `streak`, `xp`, `boss`) |
| `src/lib/reportInsights.ts` | wins and improvement rules and thresholds (pure) | the section results |
| `src/lib/reportText.ts` | `reportToMarkdown(report): string` (pure) | `Report` |
| `src/lib/focus.ts` | read and write the `focus:YYYY-MM` setting (pure parse and serialise) | settings |
| `src/data/useReport.ts` | gathers the saved lists and calls `buildReport` once per state | tables, household |
| `src/screens/Report.tsx` | page, month picker, section views, buttons | the above |
| `src/ui/ReportCard.tsx` | the Today card (days 1 to 7) | `episodeMonthFor`-style date helper |
| `src/index.css` | report and print styles | none |

`Report` is plain data: every section returns its numbers, never formatted strings, so the page, the Markdown and the tests all read the same values.

## Data flow

Saved lists (routines, logs, activities, milestones, trivia, trips, places, night log, events, expenses, bills, payments, budgets, savings, settings, members) go through `useReport` into `buildReport`, which returns the `Report`; the page renders it and `reportToMarkdown` renders the same object as text. Only the focus goals are written, through the existing settings table.

## Errors and edge cases

- Empty or brand-new data: every section shows "Nothing logged", no wins or improvements, the page does not crash.
- A routine deleted after being ticked: its ticks are ignored (same rule as XP).
- Month boundaries: Sunday belongs to the Monday-start week before it; milestones count by their week start; a plan month before `PLAN_START` is not offered.
- Current month: marked "so far", expected counts stop at today, and "improve" rules that need a full month (savings shortfall, unpaid bills) say "so far" instead of judging.
- Clipboard blocked: the text is selected for the person to copy; nothing throws.

## Testing

- Test first, through CI.
- Pure sections with a fixed full-October fixture and fixed dates; each rule tested at its boundary (59% and 60%, 10% over and exactly 10%, 69% and 70%).
- `reportToMarkdown` tested with explicit expected lines for a small fixture.
- Page: renders both people, the month picker, "so far" labelling, empty-month text; Classic has no game lines; view-only has a read-only focus box.
- Focus: saving writes the settings row; next month's report lists it and ticking updates it; a sync test is not needed (generic settings sync is already covered).
- Today card shows on days 1 to 7 only, and only for a finished month on or after the plan start.
- Print and look: Playwright screenshots of a mock built from the real CSS at phone and laptop sizes, plus a print-media screenshot to a PDF check. I cannot test on real phones from here.

## Phases

1. Calculations: sections, insights, text (all pure, no UI).
2. Page, picker, focus box, export buttons, print styles.
3. Today card, Settings link, README, final check.

Each phase ends with CI green and a short check-in with Stone.

## Out of scope (YAGNI)

Charts and trend graphs across many months (the existing month-versus-month tab covers money), XP gained in a month, emailing or scheduling reports, custom thresholds, per-routine notes, comparing against other households.

## Deviations recorded during the build

- **One section builder.** The page and the Markdown both read `reportSections(report, members)` in `reportText.ts`, so what you see and what you copy cannot disagree. The plan's separate per-section views were folded into it.
- **Empty and partial months.** The savings line needs some money logged that month; "no workout in N weeks" needs at least one workout logged; "under budget" wins only for a finished month. These keep an empty or unfinished month from reading as failure or praise.
- **Trivia line** appears only once somebody has answered a question.
- **Page takes an optional `today`** (used by tests) and the Today card shows in both styles.
- **Settings** holds a small "Reports" card linking to the page.
- **CI:** the build job is pinned to `ubuntu-24.04` and keeps its install output, after the install step failed transiently three times.
- **The plan start counts.** Nothing before 2026-10-26 is counted: routine expectations, weeks without a workout, calendar events and ticks all start there, October has no "last month" comparison, and savings are only judged from the month savings tracking began.
- **A month with nothing logged is empty all the way down** (a new `hasData` on the report): every section says "Nothing logged" and there are no wins or improvements, even when routines and bills are set up.
- **Overall completion** adds each routine's ticks only up to what was expected, so it can never pass 100%.
- **Focus box.** Only the boxes you changed are applied on top of what is saved right now, so a goal your partner added on her phone is never overwritten.
- **If copying is blocked,** the report text appears in a box on the page, selected, for you to copy by hand.
- **Finishing pass (all built):** workout types shown; "Level now" per person; focus count in the scorecard and the exported text opening with the focus goals; the three strongest routines called out; a saved food budget is used; categories capitalised and dates read "Oct 12"; focus goals also save after a pause in typing; a month still in progress does not judge monthly or weekly routines or study milestones early; a month's last week is not judged while it is still going; Today always has a link to the report (so view-only copies can reach it); download falls back to a data link in browsers without `URL.createObjectURL`; printing stops animations and hides the empty goal boxes.
- **Left as is:** two phones that both create `focus:YYYY-MM` before syncing could end up with two rows (a general settings behaviour that predates this feature).
