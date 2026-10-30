-- Life Planner schema. Run once in the Supabase SQL editor.
-- Every table belongs to a household; Row Level Security limits each row to household members.

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Home',
  created_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  color text not null default '#16a34a',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function is_member(h uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from members where household_id = h and user_id = auth.uid())
$$;

create table routines (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  bucket text not null default 'health',
  sub_bucket text,
  cadence text not null default 'daily' check (cadence in ('daily','weekly','biweekly','monthly','quarterly')),
  times_per_period int not null default 1 check (times_per_period >= 1),
  applies_to text not null default 'both',
  place text,
  time_rule text,
  weekday int check (weekday between 0 and 6),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table routine_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  routine_id uuid not null references routines(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  date date not null,
  done boolean not null default true,
  value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (routine_id, member_id, date)
);

create table night_options (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  slot_date date not null,
  type text not null check (type in ('game','painting','date','movie')),
  proposed_by uuid references members(id) on delete set null,
  activity text not null,
  snack text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table night_votes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  option_id uuid not null references night_options(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (option_id, member_id)
);

create table turns (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  current_member_id uuid references members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, name)
);

create table milestones (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  week_start date not null,
  member_id uuid not null references members(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table trivia_topics (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  topic text not null,
  claimed_by uuid not null references members(id) on delete cascade,
  author_id uuid not null references members(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table trivia_questions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  topic_id uuid not null references trivia_topics(id) on delete cascade,
  prompt text not null,
  options jsonb not null,
  correct_index int not null check (correct_index between 0 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table trivia_attempts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  question_id uuid not null references trivia_questions(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  chosen_index int not null,
  correct boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table places (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  drive_hours numeric not null check (drive_hours >= 0),
  rank int not null default 99,
  notes text,
  visited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table trip_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  planned_month text not null,
  status text not null default 'planned' check (status in ('planned','done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table income (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  monthly_amount numeric not null check (monthly_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  amount numeric not null check (amount >= 0),
  category text not null default 'misc',
  kind text not null check (kind in ('recurring','one_time')),
  due_month text,
  paid boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind = 'recurring' or due_month is not null)
);

create table settings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  key text not null,
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, key)
);

-- Row Level Security: only household members can read or write their household's rows.
alter table households enable row level security;
create policy "members read household" on households for select to authenticated using (is_member(id));

do $$
declare t text;
begin
  foreach t in array array[
    'members','routines','routine_logs','night_options','night_votes','turns','milestones',
    'trivia_topics','trivia_questions','trivia_attempts','places','trip_plans','income','bills','settings'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "household access" on %I for all to authenticated using (is_member(household_id)) with check (is_member(household_id))',
      t
    );
    execute format('alter publication supabase_realtime add table %I', t);
  end loop;
end $$;
