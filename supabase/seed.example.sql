-- EXAMPLE starter data with made-up values. Copy to supabase/seed.sql (git-ignored)
-- and put your real values there. Run it in the Supabase SQL editor after bootstrap.sql.

with h as (select id from households limit 1)
insert into routines (household_id, name, bucket, sub_bucket, cadence, times_per_period, place, time_rule, weekday)
select h.id, r.name, r.bucket, r.sub_bucket, r.cadence, r.times, r.place, r.time_rule, r.weekday
from h, (values
  ('Daily activity',  'health', 'physical',  'daily',   1, null,          null,           null::int),
  ('Lights out',      'health', 'physical',  'daily',   1, null,          'before 22:30', null),
  ('Morning prayer',  'health', 'spiritual', 'daily',   1, null,          null,           null),
  ('Sunday mass',     'health', 'spiritual', 'weekly',  1, null,          null,           0),
  ('Salon visit',     'health', 'physical',  'monthly', 1, 'Example Salon', null,         null),
  ('Grocery run',     'food',   null,        'biweekly',1, null,          null,           null)
) as r(name, bucket, sub_bucket, cadence, times, place, time_rule, weekday);

with h as (select id from households limit 1)
insert into income (household_id, name, monthly_amount) select h.id, 'Combined contributions', 10000 from h;

with h as (select id from households limit 1)
insert into bills (household_id, name, amount, category, kind, due_month)
select h.id, b.name, b.amount, b.category, b.kind, b.due_month
from h, (values
  ('Rent',        2000, 'housing', 'recurring', null),
  ('Utilities',   1000, 'housing', 'recurring', null),
  ('Example debt',4000, 'debt',    'one_time',  '2026-11')
) as b(name, amount, category, kind, due_month);

with h as (select id from households limit 1)
insert into settings (household_id, key, value)
select h.id, s.key, s.value from h, (values ('savings_target','5000'), ('biweekly_anchor','2026-11-02')) as s(key, value);
