## 2026-10-16 · feat(hub): a venue card's picture is the couple's choice — Your photo · Our drawing ◆ · None

Owner, 2026-10-16 (DECISION_LOG "A VENUE CARD'S PICTURE IS THE COUPLE'S CHOICE"), verbatim: *"on a church you can
upload a photo or use our pro feature photos of the venue"*. Corrects #6588, whose parish drawing replaced the
couple's uploaded photo by itself.

- **Maker › Details › Venues** (`VenuePhotoPicker` in `launch/_components/details-your-event.tsx` — the shipped photo
  chooser, extended, also opened by tapping a venue card on a stage): each card's one dropdown is now **Picture ▾** —
  the supplier's photos (as shipped), **Your photo** / Upload your photo, **Our drawing ◆** and **None** (was "No
  photo"). "Our drawing" is listed ONLY when `parishDrawingFor` has a drawing of that card's name (asked with the name
  the guest reads, on the card's role). ◆ Pro while tried, ◆ once owned (`makerProMark`); hidden in the app-store
  shell without Pro (`makerProUsable`). The list is `lib/venue-picture-choice.ts` (pure).
- **Storage**: `VenueChoice.drawing: true` in the `venue_map` scene's own `config_json.venue[slot]` — no new column.
  Absent = the photo if uploaded, else nothing. Picking the drawing keeps the photo refs (picking the photo back
  restores it); a photo, an upload or None takes it off.
- **Guest card**: `venueDrawingFor` (lib/parish-drawings.ts) draws the drawing only when `EventVenue.drawingChosen`
  (set by `resolveEventVenues` from the choice). Every other event is unchanged.
- **Pro**: `venueBagNewDrawings` / `venueBagFreePart` (lib/hub-draft.ts) — turning a drawing ON is an 'add' held at
  Apply for a couple without Event Hub Pro (the bag's photo/source edits still go live); named on the Apply sheet as
  "Our drawing · Ceremony venue" with Remove (lib/hub-pro-effects.ts). Turning it off is free. The Save-the-Date's
  live venue door keeps whatever the row holds (never sets it).
- ⚠ **cale-ice**: its ceremony card shows the couple's uploaded photo again (no stored pick) until they pick
  "Our drawing ◆" in the Maker.
- Labs: `/dev/details-lab?tool=details&item=venues&venue=church&vpic=photo|drawing|none[&pro=1]`;
  `/dev/maker-lab/guest?venues=default&photo=1&drawing=1`.
- Guard: `lib/a-venue-cards-picture-is-the-couples-choice.test.ts`; `the-ceremony-card-draws-its-parish.test.ts`
  now draws only picked cards.

SPEC IMPACT: None — implements DECISION_LOG 2026-10-16 "A VENUE CARD'S PICTURE IS THE COUPLE'S CHOICE" as recorded.
