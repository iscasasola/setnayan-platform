## 2026-09-19 · docs(papic): the owner's Papic click-test checklist, and a dead stale price removed (AREA-PAPIC)

`build-sessions/AREA-CHECKLISTS-2026-09-18.md` gains the AREA-PAPIC section. It is 12 numbered steps across the couple (testnayan3 on rosa-ben), a signed-out guest and the supplier (testnayan2), with a restore step at the end. It also records why production has no guest photos yet: the capture path works out each guest's share at the moment of the photo, so no per-guest rows are expected, and no guest has ever accepted the photo terms.

`lib/papic-guest.ts` loses `PAPIC_GUEST_PRICE_PHP = 2999`. Nothing imported it (`tsc` is the proof), and the live catalogue sells `PAPIC_GUEST` at a different price. A price is read from `platform_retail_catalog_v2`.

SPEC IMPACT: None
