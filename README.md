# Life Planner

A shared, phone-friendly planner for two: Health, Study, Travel, Food and Finance. Everything is editable in the app, ticks sync live between both phones, and the site is hosted free on GitHub Pages.

Live site (after setup): `https://<your-github-username>.github.io/life-planner/`

## How it works

- **App:** React + TypeScript (Vite), deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`. The workflow runs the tests first and only deploys if they pass.
- **Data:** Supabase (Postgres + login + realtime). Row Level Security means only the two household members can read or write anything.
- **Privacy:** this repo is public, so it contains code only. Real names, amounts and places live only in your Supabase database (loaded from a private `supabase/seed.sql` that is git-ignored).

## One-time setup

1. **Create a Supabase project** (free) at supabase.com. Note the *Project URL* and the *anon public key* (Project Settings → API).
2. **Create the tables:** Supabase → SQL Editor → paste `supabase/schema.sql` → Run.
3. **Create the two logins:** Authentication → Users → *Add user* → *Create new user* (tick "Auto Confirm User"), once for each of you.
4. **Link the logins to a household:** open `supabase/bootstrap.sql`, replace the two example emails (and names) with yours, and run it in the SQL Editor.
5. **Load your starter plan (optional):** run your private `supabase/seed.sql` in the SQL Editor. `supabase/seed.example.sql` shows the format with made-up values.
6. **Lock sign-ups:** Authentication → Sign In / Providers (or Settings) → turn off *Allow new users to sign up*.
7. **Give GitHub the connection details:** repo → Settings → Secrets and variables → Actions → *New repository secret*:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon public key
   (The anon key is meant to be public; the database rules protect your data.)
8. **Turn on Pages:** repo → Settings → Pages → *Build and deployment* → Source: **GitHub Actions**.
9. **Deploy:** repo → Actions → *Test, build and deploy* → *Run workflow* (or push any commit). When it's green, open the site URL and sign in.

## Checking the privacy rules (do this once)

In the Supabase SQL editor, confirm each table has RLS on:

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;
```

Every row should show `true`. Then sign in as a third test user (not in `members`) and confirm they see an empty app.

## Developing

```bash
npm install
cp .env.example .env   # fill in your Supabase values
npm run dev            # local preview
npm test               # unit and component tests
npm run build          # typecheck + production build
```

## Using it

- **Today:** progress rings, today's checklist, and anything still due this week/month. Tap the circle to tick; routines with a time rule (bedtime, wake-up) ask for the time and mark a miss if it breaks the rule.
- **Health / Food:** tap a routine's name to edit or delete it; tap **+** to add one. The *Our next night in* card handles the every-2-weeks game / painting / date / movie night: add ideas, vote, and the host alternates.
- **Study:** Sunday milestones for the coming week, and trivia: claim a topic, your partner writes questions, then play.
- **Travel:** add places with drive hours (6 hours or less = monthly, farther = every 3 months), then plan them into months.
- **Finance:** change month, edit income, bills and the one-time payoffs (set each one's due month; mark paid). The bar shows savings against the target and flags a shortfall.
- **Settings:** names, colors, savings target, the 2-week cycle start date, JSON export, sign out.
