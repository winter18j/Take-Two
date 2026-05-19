create extension if not exists pgcrypto;

create or replace function public.normalize_username(input text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(lower(coalesce(input, '')), '[^a-z0-9_]', '', 'g'), '');
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Player',
  username text not null unique default ('player_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  avatar_url text,
  hidden_score integer not null default 1000,
  wins integer not null default 0,
  losses integer not null default 0,
  games integer not null default 0,
  quitter_flag integer not null default 0,
  random_banned_until timestamptz,
  no_ads boolean not null default false,
  premium_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_username_format
  check (username ~ '^[a-z0-9_]{3,24}$');

create table if not exists public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  tokens integer not null default 3,
  updated_at timestamptz not null default now(),
  constraint tokens_not_negative check (tokens >= 0)
);

create table if not exists public.token_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  room_code text,
  player_count integer not null,
  winner_id uuid references public.profiles(id),
  loser_id uuid references public.profiles(id),
  results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.matchmaking_queue (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  hidden_score integer not null,
  enqueued_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'google_play',
  product_id text not null,
  purchase_token text,
  status text not null default 'pending',
  tokens_granted integer not null default 0,
  created_at timestamptz not null default now()
);

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

  insert into public.wallets (user_id, tokens)
  values (new.id, 3)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.recalculate_hidden_score(user_uuid uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  score integer;
  stat record;
begin
  select wins, losses, games into stat from public.profiles where id = user_uuid;
  if stat.games <= 0 then
    score := 1000;
  else
    score := round(1000 + (stat.wins::numeric / stat.games) * 500 - (stat.losses::numeric / stat.games) * 350 + least(300, log(2, stat.games + 1) * 80));
  end if;

  update public.profiles set hidden_score = score, updated_at = now() where id = user_uuid;
  return score;
end;
$$;

create or replace function public.add_tokens(user_uuid uuid, amount integer, reason_text text, metadata_json jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.wallets set tokens = tokens + amount, updated_at = now() where user_id = user_uuid;
  insert into public.token_transactions (user_id, amount, reason, metadata) values (user_uuid, amount, reason_text, metadata_json);
end;
$$;

create or replace function public.spend_token(user_uuid uuid, reason_text text, metadata_json jsonb default '{}'::jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  has_premium boolean;
begin
  select premium_until is not null and premium_until > now() into has_premium from public.profiles where id = user_uuid;
  if has_premium then
    insert into public.token_transactions (user_id, amount, reason, metadata) values (user_uuid, 0, reason_text || '_premium', metadata_json);
    return true;
  end if;

  update public.wallets set tokens = tokens - 1, updated_at = now()
  where user_id = user_uuid and tokens > 0;

  if not found then
    return false;
  end if;

  insert into public.token_transactions (user_id, amount, reason, metadata) values (user_uuid, -1, reason_text, metadata_json);
  return true;
end;
$$;

create or replace function public.record_match_result(user_uuid uuid, placement_delta integer, did_win boolean, did_lose boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    games = games + 1,
    wins = wins + case when did_win then 1 else 0 end,
    losses = losses + case when did_lose then 1 else 0 end,
    hidden_score = greatest(100, hidden_score + placement_delta),
    updated_at = now()
  where id = user_uuid;
end;
$$;

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.token_transactions enable row level security;
alter table public.matches enable row level security;
alter table public.matchmaking_queue enable row level security;
alter table public.purchases enable row level security;

create policy "profiles readable by owner" on public.profiles for select using (auth.uid() = id);
create policy "profiles update by owner" on public.profiles for update using (auth.uid() = id);
create policy "wallet readable by owner" on public.wallets for select using (auth.uid() = user_id);
create policy "transactions readable by owner" on public.token_transactions for select using (auth.uid() = user_id);
create policy "matches readable by participants later" on public.matches for select using (true);
create policy "queue owner access" on public.matchmaking_queue for all using (auth.uid() = user_id);
create policy "purchases readable by owner" on public.purchases for select using (auth.uid() = user_id);
