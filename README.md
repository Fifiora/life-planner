# Life Planner

A phone-friendly planner for two: Health, Study, Travel, Food and Finance. Everything is editable in the app, and it is hosted free on GitHub Pages.

Live site: `https://<your-github-username>.github.io/life-planner/`

## How it works

- **No login, no server.** The planner opens straight away and saves your data in your own phone's browser (local storage). Your data is never sent anywhere; the only outside request the site makes is for the Inter font from Google Fonts.
- **Hosting:** this repo is deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`. The workflow runs the tests first and only deploys if they pass.
- **Privacy:** this repo contains code only — no names, amounts or tokens.
- **Sharing:** *Settings → Share with your partner* makes a **view-only** copy: a link (or a file) with a snapshot of your planner inside it. The snapshot sits after the `#` in the link, which browsers never send to any server. Anyone who opens the link can look but not change anything, with no login. Anyone who has the link can read it, so send it privately, and send a new link whenever you want fresh progress to show.

## Getting started

Your plan is already published with the site, **locked with a passphrase** (`public/preload.enc.json`). Without the passphrase it is just scrambled data, so it is safe in this public repo.

1. Open the site on your phone. It asks for the passphrase once.
2. Tap **Make this my planner** (or **Just look (read-only)** on your partner's phone). Everything — routines, bills, payoffs, targets — is already there. Then just pick who you are.
3. Back up now and then: *Settings → Download backup*. Your own ticks and edits live only on that phone; clearing browser data or losing the phone loses them unless you have a backup (the app reminds you every two weeks). **On an iPhone, also add the site to your Home Screen** (Share → Add to Home Screen): otherwise Safari can clear a site's saved data after about a week of not using it, and private tabs don't keep it at all.
4. To show your partner your latest progress: *Settings → Share view-only link* (or *Download view-only file*) and send it privately.

Her phone remembers what it was given, so she can reopen the site any time (use the 👤 chip to look as either person). *Remove this copy* in the banner clears it. Links carry a lot of data and are often long; if one gets cut off in a chat app, send the file instead.

### Updating the published plan

The published plan is a snapshot: it has the routines, bills and targets, not anyone's ticks. To change it, download a backup from the app and make a new locked file:

```bash
node --experimental-strip-types scripts/make-preload.mjs <snapshot.json>   # prints a new passphrase, or set PRELOAD_PASSPHRASE
```

Then commit `public/preload.enc.json`. (The plain snapshot must never be committed.)

## Developing

```bash
npm install
npm run dev     # local preview
npm test        # unit and component tests
npm run build   # typecheck + production build
```

## Using it

- **Today:** progress rings, today's checklist, a money snapshot, anything still due this week/month, and a weekly wins recap. Tap the circle to tick; routines with a time rule (bedtime, wake-up) ask for the time and mark a miss if it breaks the rule. Habits you each do are ticked separately; "Shared" items count when either of you ticks. The 👤 chip switches who you're ticking for. Confetti when a bucket hits 100%. A week strip (tap a day to open the calendar), an **Up next** card with your next events, a headline like “3 of 7 done today” with your longest daily streak, and a floating **+** to add an expense, event or shopping item in two taps.
- **Calendar:** a month grid that starts at the plan's first day (26 Oct 2026) and has **no end and no limit** in either direction (jump to any month or year). Dots show events and weekday-specific routines, past days are shaded by how much got done, and tapping a day shows its routines (tick today's), events and nights in. Add your own events, optionally repeating weekly, every 2 weeks, monthly or yearly with no end date; there is also an **Agenda** list of what is coming up.
- **Health:** a monthly scorecard (ticks versus what was expected), an activity log (run, walk, calisthenics, swim, weights) with a week summary, sleep rhythm (on-time bedtimes and wake-ups, average times), the every-2-weeks night in (ideas, votes, rotating host, a log of past nights), and the spiritual routines with a rotating Bible-study lead. Monthly appointments show when they're next due.
- **Food:** the shopping rhythm with next-due dates, a shared shopping list grouped by store, the groceries budget against receipts logged in Finance, and date nights this month. A **Log a grocery receipt** card: type just the total, or snap/choose a photo of the receipt (kept on that phone only, not in backups or shared copies). It counts as a Groceries expense, so the groceries budget and Finance update too. The farmers market is a monthly Tuesday trip, shown on each Tuesday until ticked that month.
- **Study:** Sunday milestones for the coming week (with carry-over of unfinished ones), a four-week completion history, and trivia: claim a topic, your partner writes questions, then play; scores by person and topic.
- **Travel:** places with drive hours (6 hours or less = monthly, farther = every 3 months), notes and estimated cost, a trip-rhythm card (last trip, next due, where to go next), and a month-by-month plan.
- **Finance:** eight sections. *Overview:* income, spending, net and savings tiles, a spending-by-category donut, a checklist of transfers to make (deposit, tax, tithe, savings, payoffs), a could-cancel / already-cancelled savings tracker, debt payoff progress and insights. *Transactions:* a searchable, sortable ledger with extra-spending budget, manual expenses and **bank CSV import** (auto-categorised, duplicates skipped). *Month vs Month:* income vs spend bars, net per month and a per-category trend. *Budget:* budget vs actual by category with status labels. *Bills:* tick off paid bills, mark subscriptions as could-cancel / cancelled, manage payoffs. *Savings* and *Plan* (eight-month forecast). *Insights:* big picture, category callouts, trends and wins. On Overview, click a slice of the spending donut (or its row) to dim the others and see that category's bills and spending on the right; click again to restore.
- **Settings:** names, colors, targets (savings, extra-spending budget, 2-week cycle start), sharing, backup and restore, a **Starter plan** loader (adds the preloaded routines, bills and payoffs that are missing, never overwriting anything), an **Appearance** switch (match phone / light / dark), an optional **App PIN** that re-locks the app when you leave it (choose how long you can be away: immediately, 1, 5 or 15 minutes, or only when the app is closed), **Log out** (forget who is using the phone; data stays) and **Erase this phone**.

## Look and layout

The app has a light and a dark palette (Settings → Appearance), frosted-glass cards with hover effects, and a wide-screen layout: on a laptop the bottom bar becomes a left sidebar and cards flow into two or three columns. Phones keep the single-column layout.

## Anime style, XP and shared goals

Each phone picks a style in Settings (or the header button / laptop sidebar): **Anime** (the default) or **Classic**, which is the plain look and wording. Anime adds an original mascot (Pip), a sunrise/night-city look, and a small game layer. Classic hides all of it.

Everything in the game layer is worked out from data that already syncs, so the two phones always agree and nothing needs repairing:

| What you do | XP |
|---|---|
| Tick a routine | 10 (plus a streak bonus up to 20 a day) |
| Log a health activity | 15, plus 1 per 10 minutes (up to 15 more) |
| Finish a study milestone | 15 |
| Answer a trivia question (pays once per question) | 3, or 8 if any attempt was right |
| Tick a bill as paid (from this update on) | 20 |

Level n needs `50 * n * (n - 1)` XP. Each area (Health, Study, Travel, Food, Finance) has its own level; you and the party have levels too. One empty day a week is forgiven in your streak. There are badges (Trophies card), a shared weekly boss, a monthly recap ("episode") and a daily cheer button. Cheers are the only new stored data (`cheers`), synced like everything else. Which celebrations you have already seen is kept on each phone only (`lp.seen`).

## Month-end report

Open it from the card on Today (first week of a month) or from Settings. Pick any finished month since the plan began, or the current month "so far". It is worked out from what is already saved, so nothing about it is stored except your focus goals.

It covers: a scorecard (ticks per person against last month, completion, best streak, spending against last month), every routine ticked against what was expected (weakest first), health (workouts, bedtime and wake-up on time), study (milestones; trivia is all-time because answers carry no date), travel, food (groceries against the groceries bill, nights in), finance (income, spending, savings against the target, bills, payoffs, categories against budget and the biggest changes), the calendar, then **Wins** and **Improve next month**.

Improvement lines appear for: a routine under 60%, a category more than 10% over budget, any unpaid monthly bill, savings under the target, bedtime or wake-up on time under 70% of logged days, weeks with no workout, study milestones under half done and planned trips not done (at most 7). Wins: routines at 90% or more, every bill paid, savings at target, a category more than 10% under budget, a cleared payoff, a streak of 7 days or more, and (Anime) a boss beaten (at most 5). While a month is still going, rules that need a whole month do not judge.

Write up to three goals for next month at the bottom (saved and synced as a setting); next month's report opens by listing them with a tick box each. Get the report out with **Print or save as PDF**, **Copy as text** or **Download as file** (Markdown).

## Live sync (optional)

Two phones (or a phone and a laptop) can share one planner, so what either of you adds shows up on the other within seconds. There are no logins: you pair once with a code.

**One-time setup (already done for this project):** create a free Supabase project, then run `docs/supabase/setup.sql` once in its SQL Editor. The project URL and *publishable* key live in `src/lib/syncConfig.ts` (they are public by design; never put a service_role/secret key in the code).

**Pairing:** on the first phone open *Settings → Live sync → Start sharing* and keep the code it shows. On the other phone open *Settings → Live sync → Join with a code* and enter it. Joining replaces that phone's data with the shared planner (a backup file is downloaded first), so use a phone you have not used yet. Then pick who you are on that phone.

**How it works:** every row is encrypted on the phone with a key derived from the code before it is uploaded; the database only holds scrambled text and can only be reached through three small functions. If you both change the same item, the most recent change wins. Deletes are shared too. Each phone keeps working offline and catches up when it is back online. A small chip in the page header shows *Synced just now*, *Offline* or *Sync problem*; *Settings → Live sync → Test connection* checks the link.

**Good to know:** keep the code private (anyone with it can read and change the planner) and keep a copy: if you lose every phone and the code, the synced copy cannot be decrypted. Use one window of the app at a time. Receipt photos, the PIN, the light/dark choice and "who am I" stay on each phone. Importing a backup on a synced phone replaces the shared planner on every phone. The free Supabase plan pauses an idle project after about a week; a weekly GitHub job (`.github/workflows/keepalive.yml`) pings it, and the planner keeps working locally if it is ever paused.
