## 2026-09-05 · fix(mood-board): two trade-map rows and ten dead pilot rows (MB26)

Owner rulings 2026-09-05 ("follow your recommendations"), applied verbatim to
`MOODBOARD_SLOT_TRADES` (`apps/web/lib/moodboard-gallery.ts`):

- `overall` gains `coordinator` back (appended LAST, so it never wins the
  credit over `reception`/`stylist_decorator`/`lights_sound`) — MB16 already
  gives coordinators the same colour powers as stylists, and a full-room photo
  is exactly what a coordinator's portfolio holds.
- `stage` gains `lights_sound` — a lights-and-sound shop's own portfolio now
  supplies the Stage slot.
- `backdrop` does **not** change — a backdrop is a stylist's work, never
  lights_sound's. Pinned by a new test alongside the two additions.

`lib/moodboard-gallery.test.ts` extended the way MB18 pinned its rows: exact
arrays, sabotage-proven three ways (drop `coordinator` from `overall`, drop
`lights_sound` from `stage`, add `lights_sound` to `backdrop` — each goes red).

**No fixture elsewhere collided.** MB18's `flowers` change had hit MB16's
`moodboard-finalization.test.ts` FLORIST fixture because `flowers` composes
into a finalizable render part. `overall` does not: `moodboard-render-parts.ts`
marks it `kind: 'not_a_part'` (the whole-look render, not a per-part
agreement), so `tradesForPart`/`canonicalServicesForPart` never reach it, and
`stage`'s finalization fixtures (`moodboard-finalization.test.ts`) test only
`paletteKeysFrozenBy`/`dressingFieldsFrozenBy`, which this change never
touches. Confirmed by running the full unit suite (13,100 tests) and the full
db suite (2,305 tests) after the change: 0 failures in either.

Migration `20271206504078` retires (never deletes) the ten `venue_scene` rows
seeded by the 2026-09-03 decor-layers pilot (`20271194970382`) whose
`storage_path` starts with `https://media.setnayan.com/` — a host that does
not resolve and whose objects 404 on the working `pub-…r2.dev` host too.
Guarded by a `DO $$ … RAISE` that refuses to run unless exactly 10 matching
rows exist (counted without a `retired_at` filter, so the guard itself stays
idempotent on a re-apply).

`tests/db/no-placeholder-photo-is-ever-live.db.test.ts` gained two assertions,
not one — the first ("no LIVE row on that host") is the one the brief asked
for, but it is trivially true with or without the migration: all ten rows are
`approved_at IS NULL`, so they were never "LIVE" by the `approved_at IS NOT
NULL AND retired_at IS NULL` predicate regardless of `retired_at`. Sabotaging
the migration's UPDATE left that assertion green. The second assertion
(`retired_at IS NOT NULL` on all ten) is the one that actually proves the
migration ran; sabotage-proven red when the UPDATE is removed. `lib/moodboard-
library-placeholder.ts` is untouched — no host allowlist or DNS check added,
per the brief.

SPEC IMPACT: None. Applies owner rulings already recorded in this repo's
`build-sessions/MB26.md` and `build-sessions/MB-OVERSIGHT.md`; introduces no
new product decision and touches no document in
`~/Documents/Claude/Projects/Setnayan/`.
