-- Iteration 0012 Papic — Limited cameras = the guest list.
--
-- Owner-locked 2026-06-26. The per-camera model splits cleanly:
--   • Limited (roll) cameras come FROM the guest list. Each non-declined guest
--     becomes a Limited camera and their existing personal QR (guests.qr_token)
--     is the credential. Sold via a reversible SNAPSHOT — the couple taps
--     "Ready for Papic", we freeze the count + bill, but late "yes" RSVPs still
--     get a camera within the cost cap at no surprise charge (app-side sync).
--   • Unlimited cameras are the ONLY way to add a shooter who is NOT on the
--     guest list (a videographer friend, a hired second shooter). Those stay
--     anonymous paparazzi_seats with claim links — unchanged.
--
-- Strictly ADDITIVE. The free sampler (index 101–103), the legacy PAPIC_SEATS
-- pack (1–5) and the anonymous per-camera paid seats (>= 200) are untouched.

begin;

-- 1. Link a Limited camera to its guest.
--    ON DELETE SET NULL (never CASCADE): deleting a guest must NOT cascade-delete
--    their photos (the never-auto-delete rule). The orphaned roll seat is revoked
--    by the app-side sync (a roll seat whose guest_id went NULL).
alter table public.paparazzi_seats
  add column if not exists guest_id uuid
    references public.guests(guest_id) on delete set null;

comment on column public.paparazzi_seats.guest_id is
  'Limited (roll) cameras: the guest this camera belongs to (their personal QR is the credential). NULL for anonymous extra/pack/sampler seats. ON DELETE SET NULL so photos are never cascade-deleted; the orphaned roll seat is revoked by the app-side sync.';

-- 2. At most ONE active camera per guest.
create unique index if not exists paparazzi_seats_one_active_camera_per_guest
  on public.paparazzi_seats(event_id, guest_id)
  where guest_id is not null and revoked_at is null;

-- Fast lookup of an event's guest cameras during the sync.
create index if not exists paparazzi_seats_event_guest_idx
  on public.paparazzi_seats(event_id, guest_id)
  where guest_id is not null;

-- 3. The Limited activation record (one ACTIVE per event; re-activation supersedes).
create table if not exists public.papic_limited_snapshots (
  id              bigint generated always as identity primary key,
  snapshot_id     uuid not null default gen_random_uuid() unique,
  event_id        uuid not null references public.events(event_id) on delete cascade,
  order_id        uuid references public.orders(order_id) on delete set null,
  guest_count     integer not null check (guest_count >= 0),
  rate_php        integer not null check (rate_php >= 0),
  cap_php         integer not null check (cap_php >= 0),
  frozen_bill_php integer not null check (frozen_bill_php >= 0),
  camera_cap      integer not null check (camera_cap >= 0),
  days            integer not null default 1 check (days >= 1),
  status          text not null default 'pending_payment'
                    check (status in ('pending_payment','active','superseded','cancelled')),
  created_at      timestamptz not null default now(),
  activated_at    timestamptz,
  superseded_at   timestamptz
);

comment on table public.papic_limited_snapshots is
  'Papic Limited (guest-list) activations. One row per "Ready for Papic" purchase: the frozen guest_count + bill + cost cap at snapshot time. status flips to active once the order is paid (or immediately when free). Late "yes" RSVPs get a camera within camera_cap at no extra charge via the app-side sync. Re-activation supersedes the prior row.';

create index if not exists papic_limited_snapshots_event_idx
  on public.papic_limited_snapshots(event_id);

-- At most ONE live snapshot per event (the current Limited coverage). The app
-- supersedes the prior row before inserting a new one.
create unique index if not exists papic_limited_snapshots_one_live_per_event
  on public.papic_limited_snapshots(event_id)
  where status in ('pending_payment','active');

alter table public.papic_limited_snapshots enable row level security;

-- Couple-or-admin full access — mirrors paparazzi_seats_couple_full exactly.
create policy papic_limited_snapshots_couple_full
  on public.papic_limited_snapshots
  for all
  using (
    is_admin() or exists (
      select 1 from public.event_members em
      where em.event_id = papic_limited_snapshots.event_id
        and em.user_id = auth.uid()
        and em.member_type = 'couple'::member_type
    )
  )
  with check (
    is_admin() or exists (
      select 1 from public.event_members em
      where em.event_id = papic_limited_snapshots.event_id
        and em.user_id = auth.uid()
        and em.member_type = 'couple'::member_type
    )
  );

commit;
