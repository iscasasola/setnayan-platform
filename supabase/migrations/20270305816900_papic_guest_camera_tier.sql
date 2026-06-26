-- Papic guest cameras — choose Limited or Unlimited for the whole guest list.
--
-- Owner 2026-06-26: the "a camera for every guest" card now offers an UPGRADE TO
-- UNLIMITED. The guest-list cameras can be activated (or upgraded) at either tier:
--   • roll      (Limited)   — ₱30/guest/day, 30 photos + 10 clips each, cap ₱6,000
--   • unlimited (Unlimited) — ₱100/guest/day, no shot limit, Drive-archived, cap ₱10,000
--
-- We record the chosen tier on the activation snapshot so the cost/cap and the
-- provisioned guest seats (paparazzi_seats.tier) all agree. Additive + idempotent.

begin;

alter table public.papic_limited_snapshots
  add column if not exists tier text not null default 'roll'
    check (tier in ('roll', 'unlimited'));

comment on column public.papic_limited_snapshots.tier is
  'The tier the guest-list cameras run at: roll (Limited - capped per-day shots) or unlimited (Unlimited - no shot cap - Drive-archived). Drives the per-guest paparazzi_seats.tier + the cost/cap on the snapshot.';

commit;
