## 2026-08-17 · fix(exposure): recreating the stats view handed it back to strangers

`20271143376954` rebuilds `vendor_full_completed_events_stats` with DROP +
CREATE, then re-granted it `TO anon, authenticated` — a grant line copied from
the view's FIRST creation rather than its CURRENT state. That silently undid
`20271132024116_anon_view_grants_narrow.sql`, which had revoked `anon` on purpose:
this matview is the deliberately-UNREDACTED twin of the public one, so a stranger
could read both and subtract to learn how many of a supplier's finished jobs we
wrote off as fake, internal or self-comped.

🔑 **DROP + CREATE IS NOT AN EDIT — IT IS A RESET.** Every grant, and every later
narrowing of one, is discarded.

🚨 **AND A NARROWER GRANT ALONE DOES NOT FIX IT.** This database carries default
privileges that grant `anon` on newly created objects, so the recreated matview
gets `anon` back BY ITSELF, before any GRANT in the file runs. Writing
"TO authenticated" left the leak fully open — proved by the freeze still failing.
The REVOKE is the load-bearing line.

Caught only by the exposure freeze. The PR had been open, armed for auto-merge and
red for two days, so nothing else was ever going to catch it.

- explicit REVOKE from `anon` and `authenticated`, then GRANT SELECT to
  `authenticated`, mirroring the narrowing migration exactly.
- mutation-proved by occurrence count: removing the revoke 1 → 0 takes the freeze
  red; restoring it green. The PR's own 4 tests still pass.

SPEC IMPACT: None — restores a decision already taken on 2026-08-12.

⚠ **AND THE FIX ITSELF NEEDED CORRECTING BEFORE IT MERGED.** Its first cut re-granted
`authenticated`, mirroring the narrowing migration — correct right up until
`20271145190664` landed hours later and revoked `authenticated` too, closing the
last way to derive a supplier's written-off count. This file's prefix sorts BELOW
that one but `--include-all` applies it anyway, and on production it runs AFTER, so
the grant would have **silently re-opened what the other migration had just
closed.** No grant at all now.
🔑 **TWO SESSIONS CAN EACH BE RIGHT AND STILL COLLIDE.** A migration is judged
against the state it will LAND in, not the state it was written against. Re-read the
live grants immediately before merging.

