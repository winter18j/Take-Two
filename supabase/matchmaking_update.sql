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
