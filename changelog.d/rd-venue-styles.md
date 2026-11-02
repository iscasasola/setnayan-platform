## 2026-10-01 · feat(event-hub): the venue scene's three looks — Photo card · Full photo · The journey

Implements DECISION_LOG 2026-09-30 "VENUE STYLES APPROVED" on
`prototypes/venue_styles_2026-09-30_fable.html`. The Venue scene's existing Style ▾ (the
one scene-styles registry, `lib/scene-styles-stages.ts`) now offers **Photo card** (the
default — today's card) · **Full photo** (the name on the photo over a fixed dark gradient,
address and directions on the plate below) · **The journey** (one map with every pin joined
in order, then time · stop · stop, one **Directions ▾** per stop). They replace the
unpicked "Map and plate · One map, two pins · Full map" set (no event stored any of them —
measured in prod, 15 venue rows, all unset).

The Maker's Venue panel gains **Map: One map for both / No map** beside Style, stored as
`canvas.venueMap = 'none'` (absent = one map; free; not a look key). With one located place,
Photo card is byte-for-byte today's card; with two, ONE map holds both pins above the cards
instead of a map in each card (the approved "One map for both").

Stop times come only from the run of show (the ceremony block, the first reception block);
no drive time is drawn — nothing we hold measures one. Unreplied guests: names (and photos)
only, no map, no address, no directions, the withheld line once — in every style.

SPEC IMPACT: None — builds the approved 2026-09-30 row as written, except the journey's
"about 20 min drive", which is left out until a source for drive time exists.
