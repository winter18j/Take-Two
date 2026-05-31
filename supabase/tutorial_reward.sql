alter table public.profiles
add column if not exists tutorial_reward_claimed boolean not null default false;

create or replace function public.claim_tutorial_reward(user_uuid uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set tutorial_reward_claimed = true,
      updated_at = now()
  where id = user_uuid
    and tutorial_reward_claimed = false;

  if not found then
    return false;
  end if;

  update public.wallets
  set coins = coins + 150,
      updated_at = now()
  where user_id = user_uuid;

  insert into public.token_transactions (user_id, amount, reason, metadata)
  values (user_uuid, 150, 'tutorial_completion', jsonb_build_object('currency', 'coins'));

  return true;
end;
$$;

revoke execute on function public.claim_tutorial_reward(uuid) from public;
revoke execute on function public.claim_tutorial_reward(uuid) from authenticated;
grant execute on function public.claim_tutorial_reward(uuid) to service_role;
