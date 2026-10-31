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

- **Today:** progress rings, today's checklist, and anything still due this week/month. Tap the circle to tick; routines with a time rule (bedtime, wake-up) ask for the time and mark a miss if it breaks the rule. Habits you each do are ticked separately; "Shared" items count when either of you ticks. The 👤 chip switches who you're ticking for.
- **Health / Food:** tap a routine's name to edit or delete it; tap **+** to add one. *Our next night in* handles the every-2-weeks game / painting / date / movie night: add ideas, vote, and the host alternates.
- **Study:** Sunday milestones for the coming week, and trivia: claim a topic, your partner writes questions, then play.
- **Travel:** add places with drive hours (6 hours or less = monthly, farther = every 3 months), then plan them into months.
- **Finance:** change month, edit income, bills and the one-time payoffs (set each one's due month; mark paid). The bar shows savings against the target and flags a shortfall.
- **Settings:** names, colors, savings target, the 2-week cycle start date, sharing, backup and restore.
