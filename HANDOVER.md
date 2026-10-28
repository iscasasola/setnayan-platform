# HANDOVER — claude/r8-prints-own-page (Builder R8, 2026-10-28)

Contract: DECISION_LOG 2026-10-27 "PRINTS LEAVES STUDIO — ITS OWN PAGE (THE APPROVED SWIPE CAROUSEL), OPENED FROM A PRINTS
LINE ON HOME; NO NEW BOTTOM TAB" (corpus 6bc60ed4) + 2026-10-28 "all mapping will be kept" + "PROTOTYPES ARE FLOW + CONTENT
ONLY"; build plan `EVENT_MENU_REORG_BUILD_PLAN_2026-10-27.md` step 7b.

## State
- Page: `apps/web/app/dashboard/[eventId]/prints/page.tsx` → `LaunchHubPage` with `PRINTS_PAGE_SURFACE` (Symbol key).
- Rules: `apps/web/lib/prints-page.ts` (item, forward, carry, Home words) + `lib/prints-page-href.ts` (address, no imports).
- Shell: `maker-shell.tsx` `printsPage` — title "Prints" in the switch's place, studio-full, own sessionStorage key,
  `itemElsewhere` forward each way (whole-page load: `location.assign` from Prints, `location.replace` from the Maker).
- Launch page: forward before any read; `printsPage && !hasWork` / `!eventNeeds.hubDetails` → Home; no Maker spotlight,
  first-open line or guided door on the Prints page.
- Home: `_components/home-prints-line.tsx`, `HomeFirstScreen` `prints`, page passes `makerHasWork(...) && eventNeeds.hubDetails`.
- Removed: `prints` tile everywhere; Page ▾ / Settings / menu Prints doors.
- Guard: `apps/web/lib/prints-has-its-own-page.test.ts` (sabotage script: scratchpad `r8-sabotage.py`, 11/11 RED).

## Decisions taken (not covered by the record)
- Address: `/dashboard/<id>/prints` (beside /guests, /memories, /budget). No existing prints route (Rule 0 checked:
  only `/[slug]/print` and `/invitation/print`, which are print SHEETS, not doors).
- The page renders the whole Maker page (canvas under the layer included) — "render whole", not a slimmer copy. A lighter
  variant (no canvas) is a possible perf follow-up; not done, because the Prints workspace was only ever validated inside it.
- The Maker's Prints doors are DROPPED, not turned into links (owner rule: no go-elsewhere links; the plan says "drop").
- An empty slide's "Add your Love Story" door on the Prints page loads the Maker at `?tool=details&item=love-story`, which
  (pre-existing rule 3, `makerDoorLanding`) lands on Studio's home — not on the Love Story tile itself. Flagged, not changed.
- Home line placed after the Papic card, before Your services.

## Merge note
- R1 (#7019, RSVP leaves Studio) merged first; main merged in here — the Studio is now 9 tiles (no RSVP, no Prints).
  Count assertions here are DERIVED from `STUDIO_TILE_KEYS`.
