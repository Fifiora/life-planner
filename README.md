# Life Planner

A shared, phone-friendly planner for two: Health, Study, Travel, Food and Finance. Everything is editable in the app, ticks sync between both phones, and the whole thing runs on GitHub — no other accounts or servers.

Live site (after setup): `https://<your-github-username>.github.io/life-planner/`

## How it works

- **The app** (this repo, public) is a React + TypeScript site deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`. The workflow runs the tests first and deploys only if they pass.
- **Your data** lives in a second, **private** GitHub repo (e.g. `life-planner-data`) as small JSON files (`data/bills.json`, `data/routines.json`, …). The app reads and writes them through the GitHub API using an access token you paste into each phone once.
- **Privacy:** this public repo contains code only — no names, amounts or tokens. Your token never leaves the phone it was pasted into.
- **Sync:** each phone checks for the other's changes every 30 seconds and whenever the app is reopened. If you both save at the same instant, the app re-reads and re-applies your change automatically.

## One-time setup

1. **Make the data repo** (private, can be empty). You've named it `life-planner-data`.
2. **Create an access token:** GitHub → Settings → Developer settings → Personal access tokens → *Fine-grained tokens* → *Generate new token*.
   - Repository access: **Only select repositories** → pick the data repo.
   - Repository permissions: **Contents → Read and write** (Metadata stays read-only).
   - Choose an expiry (GitHub allows up to a year) and copy the token (starts with `github_pat_`).
3. **Turn on Pages:** this repo → Settings → Pages → Build and deployment → Source: **GitHub Actions**. Then Actions → *Test, build and deploy* → *Run workflow*.
4. **Open the site** on each phone, enter the data repo (`owner/name`) and paste the token. Use the same token on both phones and share it privately.
5. **First phone only:** enter both of your names, then pick who you are. On the second phone just pick who you are.
6. **Load the starter plan:** get your private `starter-data.json` onto the phone (it is deliberately *not* in this repo — send it to yourself by AirDrop, email or a private chat), then Settings → *Import data from a file* → choose it → *Replace my data*.

When the token expires, create a new one the same way and use *Settings → Disconnect this phone*, then reconnect. To lock a lost phone out, delete the token on GitHub.

## Developing

```bash
npm install
npm run dev     # local preview
npm test        # unit and component tests
npm run build   # typecheck + production build
```

## Using it

- **Today:** progress rings, today's checklist, and anything still due this week/month. Tap the circle to tick; routines with a time rule (bedtime, wake-up) ask for the time and mark a miss if it breaks the rule. Habits you each do are ticked separately; "Shared" items count when either of you ticks.
- **Health / Food:** tap a routine's name to edit or delete it; tap **+** to add one. *Our next night in* handles the every-2-weeks game / painting / date / movie night: add ideas, vote, and the host alternates.
- **Study:** Sunday milestones for the coming week, and trivia: claim a topic, your partner writes questions, then play.
- **Travel:** add places with drive hours (6 hours or less = monthly, farther = every 3 months), then plan them into months.
- **Finance:** change month, edit income, bills and the one-time payoffs (set each one's due month; mark paid). The bar shows savings against the target and flags a shortfall.
- **Settings:** names, colors, savings target, the 2-week cycle start date, export / import, disconnect.
