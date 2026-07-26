## 2026-07-27 · docs(vendors+guest-site): two owner rulings recorded — no behaviour change

Both values already shipped as recommended defaults; this records that they are now RULINGS, so the
next reader does not treat them as provisional and quietly "finish the decision" the wrong way.

1. **Vendor specialization tier floor — LOCKED at `'solo'` (any paid tier).** Asked "your cheapest
   paid plan, or only the higher one?", the owner answered *"solo and up"*. `SPECIALIZATION_MIN_TIER`
   was already `'solo'`, so nothing changes at runtime — but its doc block said "AN OPEN OWNER
   DECISION, NOT A RULING" and "CURRENT VALUE IS A DEFAULT", which is now false and actively
   misleading.

2. **After-event memento presence — LOCKED as `arrived` OR `rsvp_status === 'attending'`.** The owner
   was offered the stricter door-scan-only rule and chose *"keep it as is"*. Noted in
   `buildAfterEventMemento`'s contract so nobody tightens it later without a fresh ruling.

⚠ Still NOT settled, and deliberately left alone: whether to actually switch the specialization gate
ON. It ships unwired because there is already an ungated specialization layer live (`SPECIALIST_TOOLS`,
incl. the `/vendor-dashboard/repertoire` song bank), so enforcing the lock REMOVES tooling free
vendors have today. That is a separate pricing decision from where the floor sits.

SPEC IMPACT: `DECISION_LOG.md` — both rulings appended.
