# Anime style, XP and shared goals: design

Date: 2026-10-31. Status: for review.

## Why

Stone and his wife are anime fans and want the planner to feel like it: the look, the words, and a little game on top of the real routines. The real planner (money, calendar, routines) must stay clear and quick to use. The theme is a layer on top, never a replacement.

## What was agreed in chat

- Two people, one shared planner. Everything below must work with the live sync already in place.
- **Naming stays as it is.** Bucket names (Health, Study, Travel, Food, Finance), "routine", "bill", "payoff" and the other words in the app today are not renamed. Anime flavour goes into new things (levels, bosses, badges, recaps) and into the encouragement and celebration lines.
- Default look is the adventurous-sunrise anime style. The Classic look stays one tap away.
- All three phases are wanted, built in order.
- Original art and names only. No existing characters, logos or quotes.

## Scope

### Phase 1: Look, voice, mascot

1. **Style switch** (separate from light/dark/auto). Two styles: `anime` (default) and `classic`. Stored per phone in `lp.style`, applied as `<html data-style="...">`. Light, dark and auto keep working inside both styles. Shown in Settings and in the sidebar next to the theme switch, plus the header toggle area on phones (compact).
2. **Anime look** is CSS only, under `html[data-style="anime"]`:
   - Light mode: warm sunrise palette (peach, coral, sky). Dark mode: night-city palette (deep indigo, neon pink and cyan accents).
   - Bold card outlines, a slight offset "panel" shadow, soft speed-line backdrop, heavier italic-skewed headings, pop-style labels on big numbers.
   - System font stack only (no web fonts), so it stays fast and works offline.
   - Sparkle burst on finishing a routine (extends the existing `Confetti`).
   - `prefers-reduced-motion`: no animation, same look.
   - Text and background pairs must keep WCAG AA contrast (4.5:1 for body text) in both modes.
3. **Voice**: one small module `src/lib/voice.ts` holds every themed line in two dictionaries (anime, classic) behind `say(key, vars)`. It covers encouragement lines, toasts, empty states, celebration lines and the new XP/boss/badge text. In classic style it returns today's plain wording, so nothing regresses. Lines are original and kept short.
4. **Mascot "Pip"**: an original round spirit drawn as inline SVG (`src/ui/Pip.tsx`), with moods: sleepy (early or nothing done), happy, hyped (on a streak), proud (all done). Mood is a pure function of daypart, completion and streak. Shown in the Today hero. Hidden in classic style.

### Phase 2: XP, levels, streaks, badges

All of this is **derived** from data that already syncs (`routine_logs`, `activities`, `milestones`, `trivia_attempts`, `bill_payments`). Nothing new is stored, so the two phones can never disagree and editing or deleting a tick re-computes everything.

- **XP sources** (each source belongs to a bucket, so Health and Study earn XP in their own right):

  | Source (already synced) | Bucket | XP |
  |---|---|---|
  | Ticked routine (any bucket; uses the routine's `bucket`) | the routine's | 10 per person per day |
  | Logged health activity (`activities`: run, walk, calisthenics, swim, weights, other) | Health | 15, plus 1 per 10 minutes logged, capped at +15 |
  | Study milestone marked done (`milestones`) | Study | 15 |
  | Trivia answer (`trivia_attempts`) | Study | 3 for a question tried, 8 if any attempt was right (once per question) |
  | Bill payment recorded (`bill_payments`) | Finance | 20 |

  Plus a same-day streak bonus: +2 XP per streak day on that day's ticks, capped at +20.
  Anti-gaming: trivia answers carry no date, so each question pays XP once per person: 8 if any attempt was right, otherwise 3. This does not depend on the order rows were saved, so both phones always agree. A row only counts once (by its id). A tick and an activity for the same thing both count, which is fine for two people who trust each other.
- **Bucket levels**: every bucket has its own small level from its own XP, using the same formula as below (Health, Study, Travel, Food, Finance). They show on each bucket's screen header as a compact "Lv N" chip with a thin XP bar. The person level and the Party level use all XP together.
- **Level**: `xpForLevel(n) = 50 * n * (n - 1)` (level 1 at 0 XP, level 2 at 100, level 3 at 300, level 4 at 600). A person's level is the highest n with `xpForLevel(n) <= xp`. Each person has a level; the **Party level** is computed from the sum of both people's XP.
- **Streak**: a day counts if the person ticked at least one routine. **Rest token**: one empty day per calendar week is forgiven automatically (derived, nothing to spend or store). The Today hero shows the streak and, when a token saved it, a small "rest day used" note.
- **Badges** (about 12, all original names): first tick, first workout logged, first milestone done, 10 correct trivia answers, 3/7/30-day streak, first bill paid, first one-time payoff cleared, a Monday-to-Sunday week with a tick on every one of the 7 days, party level 5 and 10, first cheer sent, first boss defeated. Each is a pure test over the data.
- **Seen state** (so a badge or level-up celebrates once): `lp.seen` on that phone only, not synced. Worst case after clearing storage is a repeat celebration.
- UI: XP bar and level in the Today hero; a "Trophies" card (badges, locked ones greyed with the hint) reachable from Today and Settings.

### Phase 3: Weekly boss, monthly recap, cheers

- **Weekly boss**: one shared boss per ISO week, chosen from a small catalog by week number. The four bosses and their rules (all from data that already syncs; no ledger needed): party ticks 60 routines this week; party logs 8 health activities this week; party marks 6 study milestones done for this week; both of you tick at least one routine on the same day, on 5 days of the week. They rotate by weeks since the plan start. Boss HP is the target, damage is progress. Defeated state is derived. A progress card on Today.
- **Monthly recap "episode"**: for a finished month, a card with a themed title (from a list, picked by month and the top stat), ticks per person, best streak, bills paid, and spend versus budget from the existing ledger. Shown on Today during the first 7 days of the next month and always reachable from Settings.
- **Cheers**: a "Cheer" button on Today, shown once your partner has ticked something that day (one cheer per sender per day). New synced table `cheers` with fields `id, from_member, to_member, date, routine_id`. Add `cheers` to `TABLES` in `src/lib/tables.ts`. **No server change**: `sync_rows.tbl` is free text, and the engine only needs the table in `TABLES`. A cheer shows as a small banner for the receiver that day and counts for a badge.

## Classic style

Classic shows the app exactly as it is today. Everything new is anime-style only: the mascot, XP bar, levels, bucket chips, trophies, boss, recap and cheer button. Cheers sent to a phone on Classic are stored and synced but not shown there.

## Components and boundaries

Each piece is small and testable alone.

| Unit | Purpose | Depends on |
|---|---|---|
| `src/lib/style.ts` | get/set/apply style, event for UI refresh (mirrors `theme.ts`) | localStorage, DOM |
| `src/lib/voice.ts` | `say(key, vars)` for anime and classic | style |
| `src/lib/xp.ts` | XP per source and bucket, level, bucket levels, party level (pure) | logs, activities, milestones, trivia, payments |
| `src/lib/streak.ts` | streak with weekly rest token (pure) | logs, dates |
| `src/lib/badges.ts` | badge catalog and earned set (pure) | xp, streak, data |
| `src/lib/boss.ts` | boss catalog, progress (pure) | logs, ledger, week |
| `src/lib/episode.ts` | monthly recap data and title (pure) | logs, payments, ledger |
| `src/lib/seen.ts` | local "already celebrated" set | localStorage |
| `src/ui/Pip.tsx` | mascot SVG by mood | none |
| `src/ui/StyleSwitch.tsx` | Settings, sidebar and header control | style |
| `src/ui/XpBar.tsx`, `Trophies.tsx`, `BossCard.tsx`, `EpisodeCard.tsx`, `CheerButton.tsx` | views | the libs above |
| `src/index.css` | anime tokens and effects under `html[data-style="anime"]` | none |

`TodayHero.tsx` gets the mascot, XP bar and streak. The existing streak helper in `cadence.ts` stays for routine cadence; the new `streak.ts` is only for the person's daily streak. If the two overlap during implementation, the plan reconciles them (one source of truth), not two.

## Data flow

Logs and payments (already synced) go into the pure libs, which feed the views. Cheers are the only new stored data and go through the existing `tableStore` and sync path. Seen state and style are per phone. Because XP and boss progress are derived, there is no migration and nothing to repair.

## Errors and edge cases

- Empty data: level 1, no streak, no badges, boss at 0. No crashes, friendly empty lines.
- Time zones: all dates use the existing Chicago date helpers.
- A deleted tick lowers XP and can un-earn a badge; the seen set is not rolled back, so it will not re-celebrate on re-earning. That is acceptable.
- Reading a table that fails to parse still reads as empty (already known and recorded).
- Classic style must look and read exactly as it does today.

## Testing

- Test first, through CI as before.
- Pure libs: unit tests with fixed dates (each XP source and its caps, bucket levels, streak with and without a rest token, level boundaries, each badge, each boss, recap title selection).
- UI: RTL tests for the style switch (persists, applies `data-style`, works with each theme choice), voice in both styles, Today hero with mascot and XP, trophies, boss card, cheer button (writes a row; receiver sees it).
- Contrast: a test reads the anime token colours and checks the AA ratio for each text-on-surface pair in light and dark.
- Visuals: Playwright screenshots of mock pages built from the real CSS (phone, tablet, laptop; light and dark; both styles). I cannot test on real phones from here, so the final check on a real phone is Stone's.
- Sync: a test that a `cheers` row from one engine reaches another.

## Phases and delivery

1. Look, voice, mascot (ships and is usable on its own).
2. XP, levels, streaks, badges.
3. Weekly boss, monthly recap, cheers.

Each phase is its own commit series, CI green before the next starts, and a short check-in with Stone after each.

## Out of scope (YAGNI)

Sound, avatar customisation, a shop or currency, losing XP or HP for missed days, push notifications, any third-party art or fonts, renaming existing buckets or words.

## Open assumptions to confirm

- Default style is `anime` for both phones from first load after the update; Classic is one tap away.
- Health activities, Study milestones, trivia answers and bill payments earn XP; receipts and calendar events do not. The XP numbers in the table are starting values and are easy to tune.
- Boss and recap are shared (same for both of you), while style is per phone.

## Deviations recorded during the build

- **Bill XP and payers.** Bill payments carried no payer, so `BillPayment` gained an optional `member_id`, set from the person ticking the bill. Payments made before this update earn no XP and no Debt Slayer badge.
- **Payoffs** are marked on the bill itself (`paid`), not as a payment row, so the Payoff Hero badge is a household badge (any paid one-time bill).
- **Quiet celebrations.** Nothing is celebrated on a phone's first load, and when more than three new things arrive at once (an import or a first sync) they are marked as seen without a fanfare.
- **Streak in the hero.** Under Anime the hero streak is the day streak with the rest day; under Classic it stays the best per-routine streak as before.
- **Celebrations are never silent.** Nothing is announced on a phone's first load. After that, only the highest new level is announced, up to three lines are shown, and anything beyond that is summed up as "and N more!" (this replaces the earlier "more than three is silent" rule, which could swallow real celebrations).
- **Game layer hidden in view-only copies** as well as in Classic.
- **Streak bonus area.** The day's streak bonus goes to the area of the routine with the smallest id, so two phones always agree.
- **Brand pink** in light anime is `#c2255c` (AA as text on the page background).
- **Gaps against the first draft, decided to leave as they are:** the episode title is chosen by month only (not "by the top stat"); the recap shows spending without "versus budget"; a cheer has no `routine_id`; the voice dictionary covers the hero lines, with the newer lines (level-up, badge, boss, cheer) written straight into `voice.ts` as anime-only functions.
