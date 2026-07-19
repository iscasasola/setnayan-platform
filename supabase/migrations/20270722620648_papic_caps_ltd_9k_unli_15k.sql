-- Papic per-tier CAPTURE caps → Ltd ₱9,000 · Unli ₱15,000 (owner-set 2026-07-11)
-- (Pricing.md § 2.1 · DECISION_LOG 2026-07-11 · supersedes the ₱5,999 / ₱11,999
--  set earlier the same day in 20270715898850.)
--
-- The caps live in events.papic_ltd_cap_php / papic_unli_cap_php (integer PHP,
-- admin-adjustable). Move the DEFAULT and reset only rows still sitting on the
-- prior policy value (5,999 / 11,999) — preserving any genuinely custom per-event
-- cap an admin dialed. Idempotent.

alter table public.events
  alter column papic_ltd_cap_php  set default 9000,
  alter column papic_unli_cap_php set default 15000;

update public.events
  set papic_ltd_cap_php = 9000
  where papic_ltd_cap_php = 5999;

update public.events
  set papic_unli_cap_php = 15000
  where papic_unli_cap_php = 11999;
