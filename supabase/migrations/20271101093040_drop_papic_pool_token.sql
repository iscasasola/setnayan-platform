-- Drop the bespoke Papic poster token — one day old, never used, superseded.
--
-- `events.papic_pool_token` (migration 20271031174520) backed a standalone
-- /papic/pool/[token] camera reached from a printed poster. It was a SECOND
-- DOOR built beside one that already existed: `/{slug}/invite` is the shared
-- join link the couple already hands out — already rotatable, already revocable,
-- already feeding the guest list's self-join reconcile queue.
--
-- Pointing the poster at the event site is also strictly better for the person
-- scanning it. The standalone camera let them SHOOT and nothing else; the event
-- site gives them a camera, their own QR so other people can tag them, and a
-- gallery of the photos they appear in. A poster scanner could previously shoot
-- all night and receive nothing.
--
-- ── SAFE TO DROP, MEASURED NOT ASSUMED ──────────────────────────────────────
-- Checked on prod before writing this:
--   events with a token minted ........ 0
--   seats created by the poster route . 0   (seat_index >= 300)
-- The column was deliberately NOT backfilled, so "never opened the QR page"
-- and "no token" are the same state. Nothing to migrate, nothing to preserve.
--
-- The route, its action, the library and its tests are deleted in the same
-- change, so no code reads this column after this migration.
--
-- No ACL statements: dropping a column touches no grants, and `events` keeps
-- exactly the grants it had (anon/authenticated hold no select/insert/update on
-- it — verified 2026-08-01 while writing the migration this reverses).

drop index if exists public.events_papic_pool_token_key;

alter table public.events
  drop column if exists papic_pool_token,
  drop column if exists papic_pool_token_rotated_at;
