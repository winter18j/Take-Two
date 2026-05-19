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
