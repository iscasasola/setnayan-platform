-- event_std_views
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- Save-the-Date view counter (iteration 0024). A privacy-first DAILY ROLLUP:
-- ONE row per (event, day) holding a plain integer count — NO per-device data,
-- NO PII (RA 10173). "Unique per day" is enforced entirely cookie-side in the
-- /api/std/view route (an httpOnly first-party cookie remembers which days a
-- device already counted), so this table only ever sees aggregate increments.
-- The couple's own visits are excluded upstream (the beacon is gated off for
-- authed hosts), and only Save-the-Date-phase loads are counted. Owner
-- 2026-06-19: "add view count for the save the date (can be tallied for data)."

create table if not exists public.event_std_views (
  event_id   uuid not null references public.events(event_id) on delete cascade,
  view_date  date not null,
  views      integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (event_id, view_date)
);

-- RLS on at create time (canonical). Reads: any member of the event (couple +
-- coordinators, via current_event_ids()) and admins. Writes: NONE for
-- authenticated/anon — the only writer is the service-role route handler (which
-- bypasses RLS) via record_std_view(), so no INSERT/UPDATE/DELETE policy exists.
alter table public.event_std_views enable row level security;

drop policy if exists event_member_can_read_std_views on public.event_std_views;
create policy event_member_can_read_std_views
  on public.event_std_views
  for select
  using (event_id in (select public.current_event_ids()) or public.is_admin());

-- Admin all-time per-event totals (the HQ events-list column) scan by event_id;
-- the couple's builder reads a single event's recent days. Both covered by the PK
-- (event_id, view_date) prefix, so no extra index is needed.

-- Atomic per-day increment. The Supabase JS .upsert() can't express
-- `views = views + 1`, so the route handler calls this SECURITY DEFINER RPC:
-- insert the day's row at 1, or bump the existing count by 1 — race-safe under
-- the (event_id, view_date) primary key.
create or replace function public.record_std_view(p_event_id uuid, p_date date)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.event_std_views (event_id, view_date, views, updated_at)
  values (p_event_id, p_date, 1, now())
  on conflict (event_id, view_date)
  do update set views = public.event_std_views.views + 1, updated_at = now();
$$;
