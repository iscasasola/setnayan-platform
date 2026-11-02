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
- The Picture pill takes the rest of its row (`flex-1`), so the list under it is as wide as the pill and each choice
  reads on one line at 375 px ("Your photo", "Upload a different photo", "Our drawing ◆ Pro") — a pill pinned to the
  right edge left the list only the room to its right, and the labels wrapped.
- **The phone's Maker has the same row** (controller ruling 2026-10-17 — phones are 99% of users; owner: *no
  go-edit-elsewhere links, put the same field right there*). The new Maker's Venue scene › Edit keeps row 1 as the
  venue's own door ("Change it in Suppliers" — the place is the booking's) and draws each card's **Picture ▾** in rows
  2–3 ("Ceremony picture" · "Reception picture"; one card: "Picture"): the SAME `VenuePhotoPicker` in a row variant
  (no picture drawn in the toolbar — the stage behind is the preview), the same list, the same draft
  (`useVenueChoices` → `draftVenueChoice`, now shared by both), the same ◆ / `makerProUsable` rules and Pro hold. The
  list opens as the Maker's bottom sheet (`PickSheetContext`); "Upload your photo" opens the upload there too. Data:
  `MakerState.venuePictures` (the launch page's own Details › Venues slots, only when the new Maker is on); code:
  `VenuePictureRows`, loaded with the Details chunk (`details-lazy.tsx`), never in the Maker's first load.
- Labs: `/dev/maker-lab?tool=details&item=venues&venue=church&vpic=…` (the old Maker, Details › Venues); `/dev/maker-lab?studio=1&venue=church&vpic=…` (the new Maker, Venue scene › Edit); `/dev/details-lab?tool=details&item=venues&venue=church&vpic=photo|drawing|none[&pro=1]`;
  `/dev/maker-lab/guest?venues=default&photo=1&drawing=1`.
- Guard: `lib/a-venue-cards-picture-is-the-couples-choice.test.ts` (section 5: the new Maker's rows, rendered); `the-ceremony-card-draws-its-parish.test.ts`
  now draws only picked cards.

SPEC IMPACT: None — implements DECISION_LOG 2026-10-16 "A VENUE CARD'S PICTURE IS THE COUPLE'S CHOICE" as recorded.
