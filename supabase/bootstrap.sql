-- Run ONCE, after creating the two users in Supabase > Authentication > Users.
-- 1. Replace the two example emails below with the real ones (keep the quotes).
-- 2. Change the display names/colors if you like.

with h as (
  insert into households (name) values ('Home') returning id
)
insert into members (household_id, user_id, display_name, color)
select h.id, u.id, c.display_name, c.color
from h
join (values
  ('you@example.com',     'You',     '#16a34a'),
  ('partner@example.com', 'Partner', '#6366f1')
) as c(email, display_name, color) on true
join auth.users u on u.email = c.email;
