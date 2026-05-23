alter table public.profiles
  add column if not exists presence_status text not null default 'offline',
  add column if not exists presence_room_code text,
  add column if not exists presence_room_size integer,
  add column if not exists last_seen_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_presence_status'
  ) then
    alter table public.profiles
      add constraint profiles_presence_status
      check (presence_status in ('offline', 'online', 'ingame', 'inroom'));
  end if;
end $$;

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_not_self check (requester_id <> addressee_id),
  constraint friendships_status check (status in ('pending', 'accepted', 'blocked'))
);

create unique index if not exists friendships_pair_unique
on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create table if not exists public.friend_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint friend_messages_body_length check (length(trim(body)) between 1 and 500)
);

alter table public.friendships enable row level security;
alter table public.friend_messages enable row level security;

drop policy if exists "friendships visible to participants" on public.friendships;
create policy "friendships visible to participants"
on public.friendships for select
using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "friend messages visible to participants" on public.friend_messages;
create policy "friend messages visible to participants"
on public.friend_messages for select
using (auth.uid() = sender_id or auth.uid() = receiver_id);

create or replace function public.send_friend_request(requested_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  select id into target_id
  from public.profiles
  where username = public.normalize_username(requested_username);

  if target_id is null then
    raise exception 'Pseudo not found.';
  end if;

  if target_id = auth.uid() then
    raise exception 'You cannot add yourself.';
  end if;

  insert into public.friendships (requester_id, addressee_id, status)
  values (auth.uid(), target_id, 'pending')
  on conflict ((least(requester_id, addressee_id)), (greatest(requester_id, addressee_id)))
  do update set
    requester_id = excluded.requester_id,
    addressee_id = excluded.addressee_id,
    status = case
      when public.friendships.status = 'blocked' then public.friendships.status
      else 'pending'
    end,
    updated_at = now();
end;
$$;

create or replace function public.respond_friend_request(friendship_uuid uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.friendships
  set status = case when accept then 'accepted' else 'blocked' end,
      updated_at = now()
  where id = friendship_uuid
    and addressee_id = auth.uid()
    and status = 'pending';

  if not found then
    raise exception 'Friend request not found.';
  end if;
end;
$$;

create or replace function public.get_friend_requests()
returns table (
  friendship_id uuid,
  requester_id uuid,
  username text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select f.id, f.requester_id, p.username, f.created_at
  from public.friendships f
  join public.profiles p on p.id = f.requester_id
  where f.addressee_id = auth.uid()
    and f.status = 'pending'
  order by f.created_at desc;
$$;

create or replace function public.get_friends()
returns table (
  friend_id uuid,
  username text,
  status text,
  room_code text,
  room_size integer,
  last_seen_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    case
      when p.presence_status <> 'offline' and p.last_seen_at < now() - interval '90 seconds' then 'offline'
      else p.presence_status
    end,
    p.presence_room_code,
    p.presence_room_size,
    p.last_seen_at
  from public.friendships f
  join public.profiles p on p.id = case
    when f.requester_id = auth.uid() then f.addressee_id
    else f.requester_id
  end
  where (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
    and f.status = 'accepted'
  order by p.username asc;
$$;

create or replace function public.send_friend_message(friend_uuid uuid, message_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  message_id uuid;
begin
  if length(trim(message_body)) < 1 or length(trim(message_body)) > 500 then
    raise exception 'Message must be between 1 and 500 characters.';
  end if;

  if not exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = auth.uid() and f.addressee_id = friend_uuid)
        or (f.addressee_id = auth.uid() and f.requester_id = friend_uuid)
      )
  ) then
    raise exception 'You can only message friends.';
  end if;

  insert into public.friend_messages (sender_id, receiver_id, body)
  values (auth.uid(), friend_uuid, trim(message_body))
  returning id into message_id;

  return message_id;
end;
$$;

create or replace function public.get_friend_messages(friend_uuid uuid, limit_count integer default 50)
returns table (
  id uuid,
  sender_id uuid,
  receiver_id uuid,
  body text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select m.id, m.sender_id, m.receiver_id, m.body, m.created_at
  from public.friend_messages m
  where (m.sender_id = auth.uid() and m.receiver_id = friend_uuid)
     or (m.sender_id = friend_uuid and m.receiver_id = auth.uid())
  order by m.created_at desc
  limit least(greatest(limit_count, 1), 100);
$$;
