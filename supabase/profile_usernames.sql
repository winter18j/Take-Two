create or replace function public.normalize_username(input text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(lower(coalesce(input, '')), '[^a-z0-9_]', '', 'g'), '');
$$;

create or replace function public.generate_unique_username(preferred text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  candidate text;
begin
  base_username := public.normalize_username(preferred);

  if base_username is null or length(base_username) < 3 then
    base_username := 'player';
  end if;

  base_username := left(base_username, 20);
  candidate := base_username;

  while exists (select 1 from public.profiles where username = candidate) loop
    candidate := left(base_username, 15) || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
  end loop;

  return candidate;
end;
$$;

alter table public.profiles
  add column if not exists username text;

update public.profiles
set username = 'player_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
where username is null or length(trim(username)) = 0;

update public.profiles
set username = public.normalize_username(username)
where public.normalize_username(username) is distinct from username;

update public.profiles
set username = 'player_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
where username is null
  or length(username) < 3
  or username !~ '^[a-z0-9_]{3,24}$';

update public.profiles p
set username = 'player_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
where exists (
  select 1
  from public.profiles other
  where other.username = p.username
    and other.id < p.id
);

alter table public.profiles
  alter column username set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_username_format'
  ) then
    alter table public.profiles
      add constraint profiles_username_format
      check (username ~ '^[a-z0-9_]{3,24}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_username_unique'
  ) then
    alter table public.profiles
      add constraint profiles_username_unique unique (username);
  end if;
end $$;

create or replace function public.is_username_available(requested_username text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.normalize_username(requested_username) is not null
    and length(public.normalize_username(requested_username)) between 3 and 24
    and public.normalize_username(requested_username) ~ '^[a-z0-9_]{3,24}$'
    and not exists (
      select 1 from public.profiles where username = public.normalize_username(requested_username)
    );
$$;

create or replace function public.prevent_username_change()
returns trigger
language plpgsql
as $$
begin
  if old.username is distinct from new.username then
    raise exception 'Username cannot be changed after account creation.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_username_change on public.profiles;
create trigger prevent_username_change
before update on public.profiles
for each row execute function public.prevent_username_change();

create or replace function public.get_leaderboard(metric text, period text default 'all_time', limit_count integer default 50)
returns table (
  rank integer,
  user_id uuid,
  display_name text,
  value integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  from_time timestamptz;
begin
  from_time := case period
    when 'day' then now() - interval '1 day'
    when 'month' then now() - interval '1 month'
    when 'year' then now() - interval '1 year'
    else null
  end;

  if metric = 'coins' then
    return query
      select
        row_number() over (order by w.coins desc, p.username asc)::integer as rank,
        p.id as user_id,
        p.username as display_name,
        w.coins as value
      from public.wallets w
      join public.profiles p on p.id = w.user_id
      order by w.coins desc, p.username asc
      limit least(greatest(limit_count, 1), 100);
    return;
  end if;

  if metric = 'wins' then
    return query
      select
        row_number() over (order by count(*) desc, p.username asc)::integer as rank,
        p.id as user_id,
        p.username as display_name,
        count(*)::integer as value
      from public.matches m
      join public.profiles p on p.id = m.winner_id
      where m.winner_id is not null
        and (from_time is null or coalesce(m.finished_at, m.created_at) >= from_time)
      group by p.id, p.username
      order by count(*) desc, p.username asc
      limit least(greatest(limit_count, 1), 100);
    return;
  end if;

  if metric = 'matches' then
    return query
      with match_players as (
        select
          (entry->>'accountId')::uuid as account_id
        from public.matches m,
        lateral jsonb_array_elements(m.results) entry
        where (entry->>'accountId') is not null
          and (from_time is null or coalesce(m.finished_at, m.created_at) >= from_time)
      )
      select
        row_number() over (order by count(*) desc, p.username asc)::integer as rank,
        p.id as user_id,
        p.username as display_name,
        count(*)::integer as value
      from match_players mp
      join public.profiles p on p.id = mp.account_id
      group by p.id, p.username
      order by count(*) desc, p.username asc
      limit least(greatest(limit_count, 1), 100);
    return;
  end if;

  raise exception 'Unsupported leaderboard metric: %', metric;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_username text;
begin
  requested_username := coalesce(
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'display_name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', requested_username, 'Player'),
    public.generate_unique_username(requested_username)
  )
  on conflict (id) do nothing;

  insert into public.wallets (user_id, coins, gems, tokens)
  values (new.id, 250, 25, 0)
  on conflict (user_id) do nothing;

  insert into public.daily_rewards (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;
