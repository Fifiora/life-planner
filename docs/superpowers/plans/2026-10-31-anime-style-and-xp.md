# Anime style, XP and shared goals implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the planner an original anime look and voice, an XP/level/badge layer built from data that already syncs, and a shared weekly boss, monthly recap and cheers, while Classic style stays exactly as it is today.

**Architecture:** A per-phone style switch sets `<html data-style>`; the anime look is CSS under that attribute. XP, streaks, badges, boss progress and the recap are pure functions over existing synced tables, wired through one hook `useGame()`. Only cheers add stored data (one new table, already covered by the generic sync). Game UI renders only when the style is `anime`.

**Tech Stack:** React 18, TypeScript, Vite 6, Tailwind 4 + `src/index.css`, Vitest 2 + RTL. No new dependencies, no web fonts. The sandbox has no `node_modules`: every test run is `git push` then `bash /home/claude/ci.sh`.

**Spec:** `docs/superpowers/specs/2026-10-31-anime-style-and-xp-design.md`

## Global Constraints

- Naming stays: bucket names, "routine", "bill", "payoff" and today's words are not renamed. Classic style reads and looks exactly as today.
- Style key `lp.style`, values `'anime' | 'classic'`, default `'anime'` (also when storage is blocked). Event name `lp:style`. Attribute `data-style` on `<html>`.
- Original art, names and lines only: no existing characters, logos or quotes. System fonts only.
- All dates use the Chicago helpers in `src/lib/dates.ts` (`todayCT`, `addDays`, `weekStart` (Monday), `monthKeyCT`, `PLAN_START = '2026-10-26'`).
- Level formula `xpForLevel(n) = 50 * n * (n - 1)`; level = highest n with `xpForLevel(n) <= xp`. Party XP is the sum of both members' XP.
- XP table (each row counted once by id): routine tick 10 (bucket = routine's `bucket`; one per member|routine|date); health activity 15 + `min(15, floor(minutes / 10))` (null minutes = 0), bucket health; study milestone `done` 15, bucket study; trivia attempt 3, or 8 if `correct`, bucket study, only the first attempt per member per question; bill payment 20, bucket finance. Streak bonus: once per day that has a tick, `min(20, 2 * streakLengthOnThatDay)`, in the routine's bucket of the first tick that day.
- Streak: a day counts if the person ticked at least one routine; one empty day per Monday-based week is forgiven (rest token), forgiven days add nothing to the count.
- Anime palettes (CSS custom properties; the contrast test reads these): light `--bg #fff1e6`, `--card-solid #ffffff`, `--ink #2b1a3a`, `--muted #6b5577`, `--brand #c2255c`, `--brand-ink #ffffff`, `--brand-2 #0b7fa8`; dark `--bg #0d0b24`, `--card-solid #1a1540`, `--ink #f4f0ff`, `--muted #b3a8d9`, `--brand #ff6fa8`, `--brand-ink #1a0b24`, `--brand-2 #3fe0ff`. WCAG AA 4.5:1 for ink/bg, ink/card-solid, muted/bg, muted/card-solid, brand-ink/brand.
- Honour `prefers-reduced-motion` for every new animation.
- Every commit ends with the trailer lines `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01KLNtuVaFTQGxDeysXMMWtG`. Commit the failing test first ("test: ... (red)"), then the code. A phase is done only when CI is green; then check in with Stone.
- Existing tests must keep passing; `npm run build` includes `tsc --noEmit`.

## Review Focus

- Fresh phone with no data: level 1, streak 0, no badges, boss at 0, nothing throws (Task 7 and Task 10 tests).
- A tick whose routine was deleted afterwards (orphan log) is ignored, not a crash (Task 7).
- Unticking or deleting a row lowers XP; a badge or level-up already celebrated is not celebrated again (Task 9).
- Week and month edges: Sunday belongs to the Monday-start week before it; boss week and recap month use the shared date helpers (Tasks 6, 11, 13).
- Classic style and read-only (view-only) mode show none of the game UI and cannot send cheers; blocked localStorage does not throw (Tasks 1, 12).

---

## Phase 1: Look, voice, mascot

### Task 1: Style choice

**Files:**
- Create: `src/lib/style.ts`, `tests/style.test.ts`
- Modify: `src/main.tsx` (call `startStyle()` next to `startTheme()`)

**Interfaces:**
- Produces: `type StyleChoice = 'anime' | 'classic'`, `STYLE_EVENT = 'lp:style'`, `getStyleChoice(): StyleChoice`, `applyStyle(choice: StyleChoice, root?: HTMLElement): void`, `setStyleChoice(choice: StyleChoice): void`, `startStyle(): void`.

- [ ] **Step 1: Write failing tests** in `tests/style.test.ts`: default is `'anime'` with empty storage; `setStyleChoice('classic')` stores `lp.style`, sets `document.documentElement.dataset.style` to `'classic'` and dispatches `lp:style`; `setStyleChoice('anime')` restores; an unknown stored value reads as `'anime'`; with `localStorage.getItem` and `setItem` stubbed to throw, `getStyleChoice()` returns `'anime'` and `setStyleChoice('classic')` does not throw but still applies the attribute; `startStyle()` applies the stored choice.
- [ ] **Step 2:** Push, run `bash /home/claude/ci.sh`; expect these tests FAIL (module missing).
- [ ] **Step 3: Implement** `src/lib/style.ts` mirroring the shape of `src/lib/theme.ts` (try/catch around storage). Call `startStyle()` in `src/main.tsx`.
- [ ] **Step 4:** Push, CI: new tests PASS.
- [ ] **Step 5: Commit** (`feat: style choice (anime or classic), per phone`).

### Task 2: Style switch controls

**Files:**
- Create: `src/ui/StyleSwitch.tsx`, `tests/styleSwitch.test.tsx`
- Modify: `src/ui/PageHead.tsx` (add `<StyleToggle />` after `<ThemeToggle />`), `src/ui/TabBar.tsx` (add `<StyleSwitch />` under `<ThemeSwitch />`), `src/screens/Settings.tsx` (new select in the Appearance card), `src/index.css` (small styles reusing `.side-theme*`, but two columns)

**Interfaces:**
- Consumes: Task 1 functions.
- Produces: `useStyleChoice(): StyleChoice` (via `useSyncExternalStore` on `STYLE_EVENT` and `storage`), `StyleToggle` (header icon button, `aria-label` `Style: Anime. Tap for Classic.` and the reverse), `StyleSwitch` (group `aria-label="Style"` with two buttons named `Anime` and `Classic`, `aria-pressed`).

- [ ] **Step 1: Write failing tests**: toggle button label flips and `document.documentElement.dataset.style` follows; `StyleSwitch` buttons set the choice and show `aria-pressed`; Settings has a labelled select `Style` (options `Anime`, `Classic`) that changes the choice; a second mounted `StyleToggle` updates when the first changes the style. Use the `renderScreen` helper from `tests/seed.tsx` where the household is needed.
- [ ] **Step 2:** Push, CI: FAIL.
- [ ] **Step 3: Implement** the components and mount them; keep accessible names unique so existing `Appearance` tests still find one control each.
- [ ] **Step 4:** Push, CI: all PASS including existing `themeToggle` and `pageHead` tests.
- [ ] **Step 5: Commit.**

### Task 3: Voice module

**Files:**
- Create: `src/lib/voice.ts`, `tests/voice.test.ts`
- Modify: `src/ui/TodayHero.tsx` (replace local `encouragement()` with voice lines)

**Interfaces:**
- Consumes: `StyleChoice` from Task 1, `useStyleChoice` from Task 2.
- Produces: `type VoiceKey = 'encourage.empty' | 'encourage.all' | 'encourage.some' | 'encourage.fresh'`, `say(style: StyleChoice, key: VoiceKey): string`, `heroLine(style: StyleChoice, done: number, total: number): string` (picks the key: total 0 empty; done >= total all; done > 0 some; else fresh).

- [ ] **Step 1: Write failing tests**: classic strings are exactly today's: `Nothing is scheduled today.`, `All done today. Nice work!`, `Keep going, you are on a roll.`, `A fresh day. Start with one thing.`; anime strings are `Quiet day. Recharge for the next episode.`, `Cleared! Pip is doing a victory dance.`, `Power rising! Keep the combo going.`, `New episode, new chance. Land the first hit.`; `heroLine` picks the right key for (0,0), (3,3), (1,3), (0,3).
- [ ] **Step 2:** Push, CI: FAIL.
- [ ] **Step 3: Implement** `voice.ts` (two plain dictionaries) and make `TodayHero` use `heroLine(useStyleChoice(), done, total)`.
- [ ] **Step 4:** Push, CI: PASS, and the existing `today.test.tsx` hero text assertions still pass under Classic: set `localStorage.setItem('lp.style','classic')` in any existing test that asserts old wording, and add one test that the same screen under anime shows the anime line.
- [ ] **Step 5: Commit.**

### Task 4: Mascot Pip

**Files:**
- Create: `src/lib/pip.ts`, `src/ui/Pip.tsx`, `tests/pip.test.tsx`
- Modify: `src/ui/TodayHero.tsx` (show Pip beside the headline in anime style only)

**Interfaces:**
- Produces: `type PipMood = 'sleepy' | 'happy' | 'hyped' | 'proud'`, `pipMood(input: { done: number; total: number; streak: number; part: Daypart }): PipMood` (proud: total > 0 and done >= total; hyped: streak >= 3 or done/total >= 0.5; sleepy: done = 0 and part is `'morning'` or `'evening'`; otherwise happy; check in this order), `Pip({ mood }: { mood: PipMood })` (inline SVG, `role="img"`, `aria-label` `Pip is ${mood}`, original round-spirit drawing, no external assets).

- [ ] **Step 1: Write failing tests** for `pipMood` (proud at 3/3; hyped at streak 3 with 0 done; hyped at 2/4; sleepy at 0/4 morning; happy at 1/4 afternoon, streak 0) and for rendering: the hero shows `Pip is proud` under anime at 3/3, and shows no Pip under classic.
- [ ] **Step 2:** Push, CI: FAIL.
- [ ] **Step 3: Implement** the pure function and the SVG (four mouth/eye variants), and conditionally render in `TodayHero`.
- [ ] **Step 4:** Push, CI: PASS.
- [ ] **Step 5: Commit.**

### Task 5: Anime look (CSS) and contrast guard

**Files:**
- Create: `tests/animeTheme.test.ts`
- Modify: `src/index.css`, `src/ui/Confetti.tsx` (add class `spark` to the container when the style is anime)

**Interfaces:**
- Consumes: `useStyleChoice`.

- [ ] **Step 1: Write failing tests** in `tests/animeTheme.test.ts`: read `src/index.css` with `fs`; parse the custom properties inside `html[data-style="anime"]` (light) and `html[data-style="anime"][data-theme="dark"]` (dark); assert each palette value in Global Constraints is present, and compute WCAG contrast for the five pairs in both modes, each `>= 4.5`; assert the stylesheet contains a `@media (prefers-reduced-motion: reduce)` rule that turns off `.confetti.spark span` animation. Also an RTL test: `Confetti` with `fire` renders a container with class `spark` under anime and without it under classic.
- [ ] **Step 2:** Push, CI: FAIL.
- [ ] **Step 3: Implement** the CSS under `html[data-style="anime"]` and its dark variant: palette tokens from Global Constraints; bold 2px card outline in `--ink` at low alpha plus an offset "panel" shadow; speed-line backdrop as a fixed pseudo-layer built from `repeating-conic-gradient` (no images, `pointer-events: none`); italic-skewed heading style (`font-style: italic; font-weight: 800`) on `h1` and `.headline`; pop-label style on `.kpi` numbers and ring centres; sparkle keyframes for `.confetti.spark span`. Do not change any rule outside the `data-style="anime"` selectors.
- [ ] **Step 4:** Push, CI: PASS.
- [ ] **Step 5: Visual check (not CI):** build a mock page from the real CSS in `/tmp/shots` and screenshot with Playwright at 390, 820 and 1280 px, light and dark, anime and classic; confirm classic is unchanged and anime text is legible. Fix problems found.
- [ ] **Step 6: Commit and push; CI green; tell Stone Phase 1 is live and ask for a look on a real phone.**

---

## Phase 2: XP, levels, streaks, badges

### Task 6: Day streak with rest token

**Files:**
- Create: `src/lib/streak.ts`, `tests/streak.test.ts`

**Interfaces:**
- Produces: `streakLengths(dates: string[]): Record<string, number>` (input unsorted, may repeat; output maps each tick date to the streak length ending that day), `dayStreak(dates: string[], today: string): { days: number; restUsed: boolean }`.

- [ ] **Step 1: Write failing tests** (today `2026-11-04`, a Wednesday): ticks 11-02, 11-03, 11-04 give `{ days: 3, restUsed: false }`; ticks 10-31, 11-01, 11-02, 11-04 (Tuesday missed) give `{ days: 4, restUsed: true }`; ticks 10-30, 10-31, 11-04 give `{ days: 1, restUsed: false }` (three misses break it); with today `2026-11-06` and ticks 11-02, 11-04, 11-06 (Tuesday and Thursday missed, same week) days is 1; ticks through yesterday only (11-02, 11-03) give `{ days: 2, restUsed: false }` (today still open); empty gives `{ days: 0, restUsed: false }`; duplicate dates count once; `streakLengths` for 11-02, 11-03 returns `{ '2026-11-02': 1, '2026-11-03': 2 }`.
- [ ] **Step 2:** Push, CI: FAIL.
- [ ] **Step 3: Implement** by walking sorted unique dates; a gap of exactly one missing day is bridged if no other bridge was used in that Monday-based week (`weekStart` of the missing day); bridged gaps add nothing. The streak is alive if the last tick is today or yesterday, or is two days ago with yesterday bridgeable.
- [ ] **Step 4:** Push, CI: PASS.
- [ ] **Step 5: Commit.**

### Task 7: XP and levels

**Files:**
- Create: `src/lib/xp.ts`, `tests/xp.test.ts`

**Interfaces:**
- Consumes: `streakLengths` (Task 6); types `Routine, RoutineLog, Activity, Milestone, TriviaAttempt, BillPayment, Bucket` from `src/types.ts`.
- Produces:
  - `interface GameData { routines: Routine[]; logs: RoutineLog[]; activities: Activity[]; milestones: Milestone[]; attempts: TriviaAttempt[]; payments: BillPayment[]; bills: Bill[] }`
  - `type BucketXp = Record<Bucket, number>`
  - `xpForLevel(n: number): number`, `levelFor(xp: number): number`, `levelProgress(xp: number): { level: number; into: number; needed: number }` (`into` = xp above the current level, `needed` = xp from this level to the next)
  - `memberXp(data: GameData, memberId: string): { total: number; byBucket: BucketXp }`
  - `partyXp(data: GameData, memberIds: string[]): number`

- [ ] **Step 1: Write failing tests** with `data` built inline: empty data gives total 0, level 1; `levelFor(0)=1`, `99=1`, `100=2`, `299=2`, `300=3`, `600=4`; one tick on a health routine gives health 10 + streak bonus 2 (day streak 1); same member|routine|date twice counts once; an orphan log (routine not in `routines`) adds nothing; an activity with minutes 45 gives 15 + 4 = 19 health, minutes null gives 15, minutes 400 gives 30; a `done` milestone gives 15 study, a not-done one 0; two attempts on one question by one member count the first only (8 if that first was correct, 3 if wrong); a bill payment gives 20 finance; the streak bonus caps at 20 (a 12-day streak day gives 20); `memberXp` for member `b` ignores member `a` rows; `partyXp` sums members.
- [ ] **Step 2:** Push, CI: FAIL.
- [ ] **Step 3: Implement** `xp.ts` as pure functions. Derive each member's tick dates once for `streakLengths`; "first attempt per question" uses array order of `attempts`.
- [ ] **Step 4:** Push, CI: PASS.
- [ ] **Step 5: Commit.**

### Task 8: Badges

**Files:**
- Create: `src/lib/badges.ts`, `tests/badges.test.ts`

**Interfaces:**
- Consumes: `GameData`, `memberXp`, `partyXp`, `levelFor`, `dayStreak`/`streakLengths`.
- Produces: `interface BadgeDef { id: string; name: string; hint: string }`, `BADGES: BadgeDef[]` (ids and names below), `earnedBadges(data: GameData, memberId: string, memberIds: string[], extra?: { cheersSent?: number; bossesDefeated?: number }): string[]` (ids, in `BADGES` order).
- Badge list (id: name, rule): `first-spark: First Spark` first tick; `first-sweat: First Sweat` first activity; `first-lesson: First Lesson` first milestone done; `quiz-whiz: Quiz Whiz` 10 correct trivia answers; `streak-3: Three-Day Flame`, `streak-7: Week of Fire`, `streak-30: Unbroken` (longest `streakLengths` value >= 3, 7, 30); `full-week: Full Week` a Monday-to-Sunday week with a tick on all 7 days; `first-bill: Debt Slayer I` first bill payment; `payoff-hero: Payoff Hero` a payment on a bill with `kind === 'one_time'`; `party-5: Party Level 5` and `party-10: Party Level 10` (party level from `partyXp`); `first-cheer: First Cheer` `extra.cheersSent >= 1`; `first-boss: Boss Slayer` `extra.bossesDefeated >= 1`. Hints are one short sentence each, original.

- [ ] **Step 1: Write failing tests** for each badge: a case that earns it and one that does not (30-day streak built with `addDays`; full-week built from `2026-10-26` to `2026-11-01`; party 5 needs 1000 XP total; cheer and boss via `extra`). Also: empty data earns none; `BADGES` ids are unique and each has a non-empty hint.
- [ ] **Step 2:** Push, CI: FAIL.
- [ ] **Step 3: Implement** `badges.ts` (declarative list of `{def, test}` pairs; `BADGES` derived from it).
- [ ] **Step 4:** Push, CI: PASS.
- [ ] **Step 5: Commit.**

### Task 9: `useGame` hook, seen state and celebrations

**Files:**
- Create: `src/data/useGame.ts`, `src/lib/seen.ts`, `src/ui/Celebrations.tsx`, `tests/seen.test.ts`, `tests/celebrations.test.tsx`
- Modify: `src/App.tsx` (mount `<Celebrations />` inside the providers, once)

**Interfaces:**
- Consumes: Tasks 6-8, `useTable`, `useHousehold`, `useStyleChoice`, `Confetti`, `useToast`.
- Produces:
  - `seen.ts`: `hasSeen(key: string): boolean`, `markSeen(key: string): void` (stored as a JSON array under `lp.seen`; storage errors are swallowed).
  - `useGame(): { on: boolean; me: { xp: number; level: number; progress: ReturnType<typeof levelProgress>; byBucket: BucketXp; badges: string[] }; party: { xp: number; level: number; progress: ReturnType<typeof levelProgress> }; data: GameData }`. `on` is `style === 'anime'`. It reads tables `routines`, `routine_logs`, `activities`, `milestones`, `trivia_attempts`, `bill_payments`, `bills` through `useTable`, and the household for `me` and `members`. The `cheers` and boss extras are added in Task 14.
  - `Celebrations`: when `on`, after data loads, for the current level, party level and earned badges it shows a toast via `useToast` and fires `Confetti` for each key not yet seen (`level:<memberId>:<n>`, `party:<n>`, `badge:<memberId>:<id>`), then `markSeen`s them. On the very first render of a phone with no `lp.seen` yet, it marks everything currently earned as seen without celebrating (so existing data does not trigger a flood).

- [ ] **Step 1: Write failing tests**: `seen` round-trips and survives throwing storage; `Celebrations` shows nothing on first load of a seeded planner (everything silently marked); after a new tick is saved to `routine_logs` it toasts `LEVEL UP! You reached level 2!` when the level changes and `Badge unlocked: <name>` for a new badge, exactly once (re-render does not repeat); nothing is shown when the style is classic; `useGame` for the seeded planner returns level >= 1 and a defined progress.
- [ ] **Step 2:** Push, CI: FAIL.
- [ ] **Step 3: Implement.** Voice lines for these two toasts live in `voice.ts` as new anime-only functions `levelUpLine(n)` and `badgeLine(name)`.
- [ ] **Step 4:** Push, CI: PASS.
- [ ] **Step 5: Commit.**

### Task 10: XP bar, bucket chips, trophies, hero streak

**Files:**
- Create: `src/ui/XpBar.tsx`, `src/ui/BucketLevel.tsx`, `src/ui/Trophies.tsx`, `tests/gameUi.test.tsx`
- Modify: `src/ui/TodayHero.tsx` (accept optional `xp?: { level: number; into: number; needed: number; partyLevel: number }` and render the bar), `src/screens/Today.tsx` (pass `xp`; under anime use `dayStreak(...).days` from the member's tick dates instead of `bestStreak`; add `<Trophies />` card), `src/ui/PageHead.tsx` (optional `bucket?: Bucket` prop renders `<BucketLevel bucket={bucket} />`), the five bucket screens `Health.tsx`, `Study.tsx`, `Travel.tsx`, `Food.tsx` and Finance (`Finance.tsx`) to pass `bucket`, `src/screens/Settings.tsx` (a Trophies section using the same component)

**Interfaces:**
- Consumes: `useGame`, `levelProgress`, `BADGES`.
- Produces: `XpBar({ level, into, needed, label })` (a `role="progressbar"` with `aria-valuenow`, `aria-valuemax`), `BucketLevel({ bucket })` (text `Lv N`, thin bar), `Trophies()` (heading `Trophies`; each badge as a list item; locked ones have `aria-label` `<name>, locked: <hint>`).

- [ ] **Step 1: Write failing tests**: under anime the Today hero shows `Lv` for me and `Party Lv`; the Health screen header shows a `Lv` chip; Trophies lists every badge and marks locked ones; under classic none of these appear and the hero streak is the old `bestStreak` chip (`🔥 N-day streak` when N >= 2); the anime hero streak equals `dayStreak` days and shows a `rest day used` note when `restUsed`.
- [ ] **Step 2:** Push, CI: FAIL.
- [ ] **Step 3: Implement.** Add the voice line `restUsedLine = 'Rest day used. The streak lives on.'`.
- [ ] **Step 4:** Push, CI: PASS, including all existing screen tests.
- [ ] **Step 5: Visual check** with Playwright mocks as in Task 5; fix issues.
- [ ] **Step 6: Commit and push; CI green; check in with Stone.**

---

## Phase 3: Weekly boss, monthly recap, cheers

### Task 11: Weekly boss

**Files:**
- Create: `src/lib/boss.ts`, `tests/boss.test.ts`

**Interfaces:**
- Consumes: `GameData`, `weekStart`, `addDays`, `daysBetween`, `PLAN_START`.
- Produces: `interface Boss { id: 'wraith' | 'giant' | 'sphinx' | 'twins'; name: string; blurb: string; target: number; unit: string }`, `BOSSES: Boss[]` in this order (`wraith`: "Lord Snooze", target 60 ticks; `giant`: "The Couch Colossus", target 8 activities; `sphinx`: "The Book Sphinx", target 6 milestones done; `twins`: "The Together Twins", target 5 days), `bossForWeek(week: string): Boss` (index = `floor(daysBetween(weekStart(PLAN_START), week) / 7)` mod 4, never negative), `bossProgress(boss: Boss, week: string, data: GameData, memberIds: string[]): { value: number; target: number; defeated: boolean }` (ticks: de-duplicated member|routine|date ticks dated in the week by either member; giant: activities dated in the week; sphinx: milestones with `week_start === week` and `done`; twins: days in the week on which every id in `memberIds` has at least one tick).

- [ ] **Step 1: Write failing tests**: `bossForWeek('2026-10-26')` is `wraith`, `'2026-11-02'` is `giant`, `'2026-11-23'` wraps back to `wraith`, a week before the plan start still returns a valid boss; each boss's progress with empty data is `{ value: 0, defeated: false }`; ticks on a Sunday count for the week starting the Monday before; `twins` counts a day only when both members ticked; a milestone from another week does not count; `defeated` is true exactly at `value >= target`.
- [ ] **Step 2:** Push, CI: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Push, CI: PASS.
- [ ] **Step 5: Commit.**

### Task 12: Cheers

**Files:**
- Create: `src/ui/CheerCard.tsx`, `tests/cheers.test.tsx`
- Modify: `src/lib/tables.ts` (add `'cheers'` to `TABLES`), `src/types.ts` (add `Cheer`), `src/screens/Today.tsx` (mount `<CheerCard />`), `tests/syncEngine.test.ts` or a new `tests/syncCheers.test.ts` following the two-phone pattern in `tests/syncHelpers.ts`

**Interfaces:**
- Produces: `interface Cheer { id: string; from_member: string; to_member: string; date: string }`; `CheerCard()` renders, under anime and not read-only: for each cheer addressed to me dated today a line `<Name> cheered you on today!`; and, when the partner has at least one tick today and I have not cheered them today, a button named `Cheer <Name>` that inserts one `cheers` row (`date` = `todayCT()`); after sending, the button is replaced by `Cheer sent`.

- [ ] **Step 1: Write failing tests**: with the partner's tick today the button shows and clicking it adds one row with the right from/to/date; clicking twice (or re-rendering) never adds a second row for that day; no button when the partner has no tick today; a cheer row addressed to me shows the line; nothing renders under classic or in read-only mode; `TABLES` contains `cheers`; sync test: a `cheers` row written on phone A reaches phone B through the engine.
- [ ] **Step 2:** Push, CI: FAIL.
- [ ] **Step 3: Implement.** Voice lines in `voice.ts` (anime only): `cheerLine(name)` = `${name} cheered you on today!`.
- [ ] **Step 4:** Push, CI: PASS.
- [ ] **Step 5: Commit.**

### Task 13: Boss card and boss/cheer badges

**Files:**
- Create: `src/ui/BossCard.tsx`, `tests/bossCard.test.tsx`
- Modify: `src/data/useGame.ts` (also read `cheers`; expose `boss: { boss: Boss; progress: ReturnType<typeof bossProgress>; week: string }` and pass `extra` to `earnedBadges` with `cheersSent` = cheers from me, `bossesDefeated` = number of past-or-current weeks since `PLAN_START` whose boss is defeated), `src/ui/Celebrations.tsx` (celebrate `boss:<week>` once with `Boss defeated: <name>!`), `src/screens/Today.tsx` (mount `<BossCard />`)

**Interfaces:**
- Produces: `BossCard()` renders the boss name, blurb, an `HP` progressbar (remaining = `target - min(value, target)`), and text `Defeated!` when defeated; hidden under classic.

- [ ] **Step 1: Write failing tests**: card shows the boss for the current week and HP matching seeded ticks; defeated state shows `Defeated!`; the `first-cheer` badge is earned after a cheer from me exists and `first-boss` after any defeated week; the boss celebration fires once.
- [ ] **Step 2:** Push, CI: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Push, CI: PASS.
- [ ] **Step 5: Commit.**

### Task 14: Monthly recap episode

**Files:**
- Create: `src/lib/episode.ts`, `src/ui/EpisodeCard.tsx`, `tests/episode.test.ts`, `tests/episodeCard.test.tsx`
- Modify: `src/screens/Today.tsx` (show the previous month's card during days 1-7 of a month), `src/screens/Settings.tsx` (an "Episodes" section: a select of finished months since `PLAN_START`, newest first, rendering `EpisodeCard`)

**Interfaces:**
- Consumes: `GameData`, `monthActuals` from `src/lib/ledger.ts` (fields as defined at `ledger.ts:8-20`), `Expense`, `streakLengths`.
- Produces: `EPISODE_TITLES: string[]` (`The Fresh Start`, `The Savings Push`, `Rising Tide`, `Steady Footing`, `The Long Road`, `Bright Horizon`), `episodeFor(month: string, data: GameData & { expenses: Expense[] }, members: { id: string; display_name: string }[]): { month: string; title: string; ticksByMember: Record<string, number>; bestStreak: number; billsPaid: number; spent: number }` where `title` is `Arc ${n}: ${EPISODE_TITLES[(n - 1) % 6]}` and `n` = whole months from `PLAN_START`'s month to `month`, plus 1; `ticksByMember` counts de-duplicated ticks; `bestStreak` is the largest `streakLengths` value over dates in the month for either member; `billsPaid` counts payments with that `month`; `spent` comes from `monthActuals`.

- [ ] **Step 1: Write failing tests**: `episodeFor('2026-10', ...)` has title `Arc 1: The Fresh Start`; `'2027-04'` is `Arc 7: The Fresh Start` (wraps); ticks and payments outside the month are ignored; empty data gives zeros; `EpisodeCard` shows the title, each member's name with their tick count, and the spent figure; Today shows the card on `2026-11-03` and not on `2026-11-12` (pass the date through a prop so the test controls it); hidden under classic.
- [ ] **Step 2:** Push, CI: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Push, CI: PASS.
- [ ] **Step 5: Commit.**

### Task 15: Docs, full check, branch review

**Files:**
- Modify: `README.md` (section "Anime style, XP and shared goals": what it is, the XP table, Classic switch, what is not synced), `docs/superpowers/specs/2026-10-31-anime-style-and-xp-design.md` (a "Deviations recorded during the build" section if anything changed)

- [ ] **Step 1:** Update the README and spec notes.
- [ ] **Step 2:** Push; `bash /home/claude/ci.sh` shows tests and build green.
- [ ] **Step 3:** Playwright mock screenshots of Today (hero with Pip, XP bar, boss, cheer, trophies) at phone, tablet and laptop widths, light and dark, anime and classic; confirm Classic is unchanged.
- [ ] **Step 4:** One fresh reviewer on the most capable model reviews the whole branch against the spec and this plan's Review Focus; fix what it finds test-first.
- [ ] **Step 5:** Final CI green; report to Stone with the honest caveat that nothing was tried on real phones, and ask him to try both styles and a cheer on both phones.
