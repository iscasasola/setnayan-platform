## 2026-10-16 · feat(hub): the ceremony card draws its parish — the Santuario de San Vicente de Paul first

Owner, 2026-10-16 (DECISION_LOG "A LIBRARY OF PARISH DRAWINGS FOR THE EVENT HUB"): one watercolour per parish,
shown on the ceremony venue card when the event's ceremony is that parish. The library is parked; *"just the one
for us first"* — cale-ice's church.

- `lib/parish-drawings.ts` — the library's first row, keyed per PARISH (never per event): the card's own venue name,
  normalised, must start with "Santuario de San Vicente de Paul" (so the booked "… Parish & Shrine of the Poor" matches
  and a namesake "San Vicente de Paul Parish" elsewhere does not). Ceremony cards (or one place for both) only. No pin
  check — the pin closes until a guest replies, the name never does, so the drawing never flickers with the reply.
- `public/parish-drawings/santuario-de-san-vicente-de-paul.{avif,webp}` — the owner's Higgsfield drawing, 686 px wide
  (2× the 343 px card), white cut to transparent (paper + sky wash by colour-to-alpha against white, the building kept
  opaque) so a dark Look shows no white box. AVIF 39 KB, WebP 47 KB.
- `VenueWidget` (Photo card) and `VenueFullPhoto` (Full photo) draw it on the plate above the venue's name, lazy, size
  reserved, `<picture>` AVIF → WebP. Where a card has a drawing it takes the photo's place (one picture per card, as in
  the owner's art-kit proof). The journey style is unchanged (no photos there by design).
- `/dev/maker-lab/guest?venues=<style>` (`&parish=0`, `&photo=1`, `&art=candlelight`) — the lab mode the walk used.
- Guard: `lib/the-ceremony-card-draws-its-parish.test.ts` (14 tests; two sabotages caught).

SPEC IMPACT: None — implements DECISION_LOG 2026-10-16 "A LIBRARY OF PARISH DRAWINGS FOR THE EVENT HUB" for one parish;
the per-venue column it names is still the later build.
