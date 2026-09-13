## 2026-09-05 · fix(mood-board): the gallery slot → trade map matches the owner's own words (MB18)

Four rows in `MOODBOARD_SLOT_TRADES` (`apps/web/lib/moodboard-gallery.ts`) now say what
the owner said in the 2026-09-04 working session, no more and no less:

- `entourage` and `guests` each gain `filipiniana_barongs` — a shop whose only
  service is a barong or Filipiniana rental can now upload to those two
  inspiration slots. `filipiniana_barongs` was already resolving its ten
  canonical services correctly everywhere else (`vendor-counts.ts`'s explicit
  `FILIPINIANA_BARONG_CANONICALS` map, flowing through both
  `canonicalServicesForTile` and `canonicalServicesForSlot`); it was simply
  absent from these two rows.
- `flowers` becomes `['florist', 'stylist_decorator']` — florist stays first,
  so a shop that is both is still credited "Florist" (`tradeLabelForCredit`
  reads the row in order); a stylist-only shop now gets a "Stylist / Decorator"
  credit where before it got none.
- `overall` becomes `['reception', 'stylist_decorator', 'lights_sound']`,
  replacing `['stylist_decorator', 'coordinator']` — the owner's order,
  verbatim. A shop holding both `reception` and styling is now credited
  "· Reception" on an overall photo, not "· Stylist / Decorator".

**No resolution fix was needed or made.** An earlier note in
`build-sessions/MB-GALLERY-PLAN.md` claimed `filipiniana_barongs` was an
"inert tile" that failed to resolve canonicals; that claim was measured
directly against `origin/main` on 2026-09-04/05 and found false (both call
paths already return all 10 canonicals). This session's job was only the four
map rows above.

One pre-existing fixture broke as a direct, expected consequence of the
`flowers` change: `lib/moodboard-finalization.test.ts`'s `FLORIST` fixture had
borrowed `canonicalServicesForSlot('flowers')` as shorthand for "a florist's
own services," which silently picked up `stylist_decorator`'s canonicals too
once `flowers` became a two-trade slot. Fixed to use
`canonicalServicesForTile('florist')` directly.

SPEC IMPACT: None. This applies owner decisions already recorded in this
repo's `build-sessions/MB-GALLERY-PLAN.md` (§ MB18) to the existing
slot → trade lookup; it introduces no new product decision and touches no
document in `~/Documents/Claude/Projects/Setnayan/`. `stage`/`backdrop`
admitting `lights_sound` and whether `overall` should have kept `coordinator`
remain open owner questions per `build-sessions/MB-OVERSIGHT.md` and are out
of scope here — nothing in this PR answers them.
