## 2026-08-12 · fix(wall): the freed wall could never receive a photo — and a duplicated pricing row

Follow-up to #4370, from an adversarial review of that PR. 19 findings raised, 2 survived
independent verification. Both confirmed against the live production database.

**1 · The wall was freed for everyone and could never receive a photo (high).**
#4370 freed the **reader** — the app-side entitlement predicates. The only **writer**,
the `wall_ingest` SQL function (the sole path that inserts into `wall_feed`), was gated
on an entirely different mechanism: a row in `event_software_activations_v2` for
`LIVE_WALL`. Nothing couple-facing writes that table any more — the app-side gates were
moved off it in the 2026-06-15 dead-unlock repair and this SQL writer was never moved
with them.

So every couple's wall switched **on** and stayed permanently **empty**: the venue screen
blank after the code is entered, and every guest's phone showing a panel that promises
"photos appear here the moment they're taken" while nothing ever arrives. **Worse than the
paid wall it replaced, which at least stayed hidden.**

Measured in production, not inferred: 5 events and 14 clean photos, but only **2**
activation rows and **8** `wall_feed` rows — and those 8 were hand-seeded by a sample
script, not ingested. One event with 13 clean, non-hidden, photo-type captures had **zero**
wall rows.

G0 is removed. **Every other gate is preserved byte for byte and still runs in the same
order** — the NSFW allowlist, the fail-closed FaceBlock bake requirement, and the per-guest
photo-consent veto. Nothing about privacy, moderation or consent is loosened; entitlement is
the only thing that stops being checked there, because the wall is free and there is no
entitlement left to check. Per-event visibility is enforced by the reader, untouched.

🔑 **Ask "what ELSE gates this?"** A reader and a writer gating on different mechanisms will
not both follow one flip. If the wall ever becomes paid again, both halves must return
together — restore a gate in the function **and** remove it from `FREE_FOR_ALL_SKUS`.
Restoring one alone reproduces exactly one of the two failures this pair has now caused.

**2 · A duplicated row on the public pricing page (medium) — my error in #4370.**
That PR's comment edit left `{ code: 'PATIKTOK_COMPILER' }` in the list twice, so the public
pricing page rendered two identical Patiktok cards and handed React a duplicate key in the
same list. Removed.

Verified: typecheck clean · unit suite passes · migration guard passes.

SPEC IMPACT: None — #4370's corpus edits (the wall is free) stand and are now actually true.
