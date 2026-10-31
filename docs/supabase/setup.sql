-- Life Planner live sync: run this ONCE in Supabase -> SQL Editor -> New query -> Run.
-- Safe to run again (everything is "if not exists" / "create or replace").
-- The planner's data is encrypted on the phones before it is uploaded; this database only ever holds scrambled text.

create table if not exists public.sync_rows (
  household  text    not null check (household ~ '^[0-9a-f]{64}$'),
  tbl        text    not null check (length(tbl) between 1 and 40),
  row_id     text    not null check (length(row_id) between 1 and 80),
  payload    text    check (payload is null or length(payload) <= 65536),
  deleted    boolean not null default false,
  updated_at bigint  not null,
  seq        bigint  not null,
  primary key (household, tbl, row_id)
);

create sequence if not exists public.sync_seq;
create index if not exists sync_rows_pull on public.sync_rows (household, seq);

-- Nobody can read or write the table directly; the only way in is the three functions below.
alter table public.sync_rows enable row level security;
revoke all on public.sync_rows from anon, authenticated;
revoke all on sequence public.sync_seq from anon, authenticated;

create or replace function public.sync_push(p_household text, p_rows jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  top bigint := 0;
  s bigint;
begin
  if p_household !~ '^[0-9a-f]{64}$' then raise exception 'bad household'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'rows must be an array'; end if;
  if jsonb_array_length(p_rows) > 500 then raise exception 'too many rows in one push'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    s := nextval('public.sync_seq');
    insert into public.sync_rows (household, tbl, row_id, payload, deleted, updated_at, seq)
    values (p_household, r->>'tbl', r->>'id', r->>'payload', coalesce((r->>'deleted')::boolean, false), (r->>'updated_at')::bigint, s)
    on conflict (household, tbl, row_id) do update
      set payload = excluded.payload, deleted = excluded.deleted, updated_at = excluded.updated_at, seq = excluded.seq
      where public.sync_rows.updated_at < excluded.updated_at;
    top := greatest(top, s);
  end loop;
  return top;
end
$$;

create or replace function public.sync_pull(p_household text, p_after bigint default 0)
returns table (tbl text, row_id text, payload text, deleted boolean, updated_at bigint, seq bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_household !~ '^[0-9a-f]{64}$' then raise exception 'bad household'; end if;
  return query
    select s.tbl, s.row_id, s.payload, s.deleted, s.updated_at, s.seq
    from public.sync_rows s
    where s.household = p_household and s.seq > p_after
    order by s.seq
    limit 1000;
end
$$;

create or replace function public.sync_ping()
returns text
language sql
security definer
set search_path = public
as $$ select 'ok'::text $$;

revoke all on function public.sync_push(text, jsonb) from public;
revoke all on function public.sync_pull(text, bigint) from public;
revoke all on function public.sync_ping() from public;
grant execute on function public.sync_push(text, jsonb) to anon, authenticated;
grant execute on function public.sync_pull(text, bigint) to anon, authenticated;
grant execute on function public.sync_ping() to anon, authenticated;
