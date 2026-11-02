## 2026-09-08 · fix(bench): a row finds a supplier stored under its own tile id

Owner: *"i cannot find saysay's host mc."* A shop with two live, priced,
verified cards was findable on the bench's **Live Band** row and invisible on
**Host / MC**, which said *"Nothing else in this category yet."*

### Measured, not inferred

```
live_band  → canonicals: live_band, band_live_music
             overlap with the shop's stored services: live_band     ← matched
host_mc    → canonicals: host_emcee, tea_ceremony_master
             overlap with the shop's stored services: NONE          ← found nobody
```

The bench expands a tile into CANONICAL services and matches those against
`vendor_profiles.services`. The shop stores **tile ids** (`live_band`,
`host_mc`). `live_band` worked only because its tile id and one of its
canonicals happen to be the same string — a coincidence, not a mechanism.

🔑 **53 of the 78 wedding tiles** have an id that is no canonical —
`reception`, `ceremony_venue`, `coordinator`, `cake`, `florist` among them. So
this was never one broken category, and every row reported the CATEGORY as
empty rather than the lookup as missed.

`lib/card-kind-labeller.ts` already states the underlying fact: *"cards in
production hold `live_band` / `host_mc`, which are tile ids"*. Same conclusion
as `/services/new/[category]` reached the same day: **a vocabulary the product
SAVES has to be one its readers ACCEPT.**

### Where the fix goes is the whole lesson

The first draft widened `canonicalServicesForTile` — and
`taxonomy-tile-reachability.test.ts` refused it. That function's `length > 0` is
how a tile is judged ALIVE and how `KNOWN_DEAD_TILES` self-cleans; widening it
made **every** tile look healthy and would have silently retired a real
regression detector.

So the widening lives in `canonicalsForScope`, where the question is *"what
values match a vendor"* rather than *"what canonicals does this tile have"*. It
widens and never replaces: a shop stored the correct way keeps matching.

Guarded both ways — the search must accept a tile id, **and**
`canonicalServicesForTile` must not be widened again.

⏭ **Not answered here:** whether `vendor_profiles.services` should hold tile ids
at all, and which writer put them there. That is a data question.

SPEC IMPACT: None.
