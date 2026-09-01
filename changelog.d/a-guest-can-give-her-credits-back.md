## 2026-08-31 · feat(papic): a guest can give her unused credits back to the celebration

Spec § 7b's reversal half, **asked for by the owner on 2026-08-31** after being shown
what the feature was. Migration `20271185813837`.

**The second attempt.** PR #5028 shipped this on `papic_dedicate_shots` and it went
live moving credits the wrong way on both sides — her balance UP by her own spend,
the couple's pot DOWN by the same. PR #5038 removed it and left behind an autopsy test
plus `releasesContract`, the assertions a real primitive would have to satisfy. This
builds that primitive and runs the pre-written contract against it.

**The new layer.** `papic_seat_grant_releases` — one row per camera, cumulative
credits given back — composed by the same two read functions that already compose the
hand-out layer:

```
dedicated to a camera  = seat grants + allocation − RELEASED
left in the shared pot = shared grants − allocations + RELEASES
```

Every gate, meter and capture path composes for free, because they already ask those
two functions rather than the tables. `papic_event_point_grants` is never touched — it
is an append-only money record an admin reconciles orders against, and
`papic_guest_self_funded_spend` reads it to decide what is exempt from the couple's
per-guest ceiling.

**Two ceilings on what can move:** her own un-released bought credits (the host's
hand-outs are the couple's money and come back via `papic_dedicate_shots`), and never
below what the camera has already SHOT.

**No amount, anywhere** — not in the form, not in the action, not in the RPC signature.
`papic_seat_releasable_grants` is ONE expression with TWO readers: the panel displays
it, the mover re-evaluates it under its row lock and returns what actually moved. That
gap is exactly where #5028 died, and a migration assertion now fails if the mover ever
stops reading it.

**Tests.** 14 db tests (zero-sum, the append-only receipt, the spend floor, the host's
money, double-press, cross-event refusal, and the capture path falling through to the
pool afterwards) · 6 unit tests · the re-aimed source guard. 12 mutations, all RED.

SPEC IMPACT: `WHATS_NEXT_Shots_Per_Guest_2026-08-28.md` § 7b and
`..._SESSIONS_2026-08-28.md` S5 — the release is no longer an open owner call; he made
it, and it is built. Both updated.
