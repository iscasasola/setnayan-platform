## 2026-09-30 · fix(maker, services): no camera prompt in the Maker canvas · Our Services trimmed to five

- **The Maker no longer asks for the camera and microphone on every edit.** The canvas is an iframe of the
  couple's own page, the couple holds a seat on their own guest list, and so the page drew the inline Papic
  guest camera — which turns camera + mic on at mount (`usePapicCamera`, audio first). Every canvas frame the
  Maker loaded or re-keyed re-asked Safari. `app/[slug]/page.tsx` now hands `papicGuest: null` to the canvas
  render (`isEditorCanvas`). Guard: `app/[slug]/_components/the-maker-canvas-draws-no-camera.test.ts`.
- **Our Services (owner 2026-09-30):** order is Setnayan AI · Papic · Live Studio · Music Maker · Patiktok.
  Gallery is a part under Papic (beside Thank-You Video) and stands as its own card only where there is no
  Papic card. Editorial is not drawn here (its home is the Maker's Post Event); Event Hub Pro is not a card
  (its home is the Maker's "Unlock Pro and Apply"). `OurService.part` → `parts[]`.
- **"More for your event":** Find your date goes home to Details › Date (`TOOL_HOMES['find-date']`, proven by
  `details-date-finder.tsx`); "Recommended for you now" no longer surfaces retired `utility` cards (Event,
  Photo Delivery — already delivered through Papic since 2026-07-22).

SPEC IMPACT: DECISION_LOG row for the 2026-09-30 Our Services trim (order · Gallery in Papic · Editorial in
Post Event · Event Hub Pro at Apply · Find your date in Details). Not applied from this cloud session — the
corpus is not reachable here.
