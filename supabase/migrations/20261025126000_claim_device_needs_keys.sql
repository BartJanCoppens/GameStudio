-- Security review: a device moves to another person only when the request carries the device's own keys (which
-- only that browser holds); knowing the endpoint alone is not enough.
create or replace function public.claim_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ((select auth.uid()), p_endpoint, p_p256dh, p_auth)
    on conflict (endpoint) do update set user_id = excluded.user_id, created_at = now()
    where public.push_subscriptions.p256dh = excluded.p256dh and public.push_subscriptions.auth = excluded.auth;
$$;
