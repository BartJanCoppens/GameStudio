-- Security review: a device subscription may only point at a browser push service, so the notification sender
-- never makes requests to other hosts. Same list as PUSH_HOSTS in supabase/functions/_shared/notifyText.ts.
alter table public.push_subscriptions add constraint push_subscriptions_known_host check (
  endpoint ~ '^https://(fcm\.googleapis\.com|[a-z0-9-]+(\.[a-z0-9-]+)*\.push\.services\.mozilla\.com|[a-z0-9-]+(\.[a-z0-9-]+)*\.notify\.windows\.com|web\.push\.apple\.com)/');
