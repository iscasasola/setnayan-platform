## 2026-06-24 · fix(papic): "Start my 3 free seats" silently no-op'd — pgcrypto schema resolution

The free-Papic sampler button (`Start my 3 free seats`) and the paid 5-seat
provision both did nothing in prod. Root cause was a Supabase pgcrypto
schema-resolution trap, not the UI.

- **DB fix — migration `20270128500000` (APPLIED to prod 2026-06-24).** Both
  `papic_provision_sampler()` and `papic_provision_seats()` mint each seat's
  `claim_qr_token` with `encode(gen_random_bytes(18), 'hex')`. `gen_random_bytes`
  lives in the `extensions` schema (pgcrypto), but both functions are declared
  `SET search_path = public`, which drops `extensions` from the resolver (the DB
  session default is `"$user", public, extensions`, which is why the same call
  works in an ad-hoc query but throws inside the function). Every call raised
  `42883: function gen_random_bytes(integer) does not exist`, the server action
  redirected to `?seat_error=…`, and the sampler empty-state swallowed it — so
  the button looked dead. Fix: schema-qualify the one unqualified symbol as
  `extensions.gen_random_bytes(18)` (everything else in both functions was
  already qualified). CREATE OR REPLACE only — no data change, idempotent.
  Verified end-to-end against the test event by impersonating the couple's JWT:
  the RPC now returns 3 (it would have thrown before); test seats cleaned up.

- **UX fix — `studio/papic/crew` empty-state now surfaces `seat_error`.** That
  branch rendered the "Try Papic free" card but never showed `seat_error`
  (the non-empty render already did, at the seat-management view). So any
  provision failure reloaded the same card with no feedback. Added the standard
  `role="alert"` rose banner above the card, matching the existing pattern.

Only two functions repo-wide had this `gen_random_bytes` + `search_path=public`
combination (audited live); both are fixed here.

SPEC IMPACT: None (bug fix; 0012 Papic free sampler behavior already specced).
Logged at the bottom of `DECISION_LOG.md`.
