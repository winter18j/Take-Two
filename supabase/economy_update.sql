alter table public.wallets
  add column if not exists coins integer not null default 250,
  add column if not exists gems integer not null default 25;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'coins_not_negative'
  ) then
    alter table public.wallets add constraint coins_not_negative check (coins >= 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'gems_not_negative'
  ) then
    alter table public.wallets add constraint gems_not_negative check (gems >= 0) not valid;
  end if;
end $$;

create table if not exists public.daily_rewards (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_claimed_at timestamptz,
  next_claim_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.owned_card_styles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  style_id text not null,
  acquired_at timestamptz not null default now(),
  unique (user_id, style_id)
);

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

create or replace function public.add_coins(user_uuid uuid, amount integer, reason_text text, metadata_json jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.wallets set coins = coins + amount, updated_at = now() where user_id = user_uuid;
  insert into public.token_transactions (user_id, amount, reason, metadata)
  values (user_uuid, amount, reason_text, metadata_json || jsonb_build_object('currency', 'coins'));
end;
$$;

create or replace function public.add_gems(user_uuid uuid, amount integer, reason_text text, metadata_json jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.wallets set gems = gems + amount, updated_at = now() where user_id = user_uuid;
  insert into public.token_transactions (user_id, amount, reason, metadata)
  values (user_uuid, amount, reason_text, metadata_json || jsonb_build_object('currency', 'gems'));
end;
$$;

create or replace function public.spend_coins(user_uuid uuid, amount integer, reason_text text, metadata_json jsonb default '{}'::jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.wallets set coins = coins - amount, updated_at = now()
  where user_id = user_uuid and coins >= amount;

  if not found then
    return false;
  end if;

  insert into public.token_transactions (user_id, amount, reason, metadata)
  values (user_uuid, -amount, reason_text, metadata_json || jsonb_build_object('currency', 'coins'));
  return true;
end;
$$;

create or replace function public.spend_gems(user_uuid uuid, amount integer, reason_text text, metadata_json jsonb default '{}'::jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.wallets set gems = gems - amount, updated_at = now()
  where user_id = user_uuid and gems >= amount;

  if not found then
    return false;
  end if;

  insert into public.token_transactions (user_id, amount, reason, metadata)
  values (user_uuid, -amount, reason_text, metadata_json || jsonb_build_object('currency', 'gems'));
  return true;
end;
$$;

create or replace function public.claim_daily_reward(user_uuid uuid)
returns table (coins integer, gems integer, next_claim_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_next timestamptz;
begin
  insert into public.daily_rewards (user_id)
  values (user_uuid)
  on conflict (user_id) do nothing;

  select daily_rewards.next_claim_at into current_next
  from public.daily_rewards
  where user_id = user_uuid;

  if current_next is not null and current_next > now() then
    raise exception 'Daily reward is not ready yet.';
  end if;

  update public.wallets
  set coins = wallets.coins + 100,
      gems = wallets.gems + 5,
      updated_at = now()
  where user_id = user_uuid;

  update public.daily_rewards
  set last_claimed_at = now(),
      next_claim_at = now() + interval '24 hours',
      updated_at = now()
  where user_id = user_uuid
  returning daily_rewards.next_claim_at into next_claim_at;

  insert into public.token_transactions (user_id, amount, reason, metadata)
  values (user_uuid, 100, 'daily_reward', jsonb_build_object('currency', 'coins', 'gems', 5));

  select wallets.coins, wallets.gems into coins, gems
  from public.wallets
  where user_id = user_uuid;

  return next;
end;
$$;

alter table public.daily_rewards enable row level security;
alter table public.owned_card_styles enable row level security;

drop policy if exists "daily rewards readable by owner" on public.daily_rewards;
create policy "daily rewards readable by owner" on public.daily_rewards for select using (auth.uid() = user_id);

drop policy if exists "owned styles readable by owner" on public.owned_card_styles;
create policy "owned styles readable by owner" on public.owned_card_styles for select using (auth.uid() = user_id);

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
