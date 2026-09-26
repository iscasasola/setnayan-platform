## 2026-09-26 · fix(event-hub): an empty section is left out for guests, kept in the Maker

cale-ice's live invitation printed "Your hosts haven't shared the dress code yet" and
"will share their photo guidance closer to the wedding" to every guest. Both widgets take
`hideWhenEmpty` (the dress code only in its generic empty case — the INC / Muslim
modest-dress guidance still shows); both render doors (`hideable-widget-render.tsx`,
`public-hideable-widget.tsx`) take `guestView`, and `site-body.tsx` passes
`guestView={!isMakerCanvas}` — so guests and the "Preview the whole stage" tab see
nothing, while the Maker's editing canvas keeps the placeholder (and its navigator
anchor). `HubCanvasFrame` already returns null for a null body. Test:
`app/[slug]/_lib/empty-scenes-stay-out-of-a-guests-way.test.ts` (render-level; sabotage →
1 fail); 77 tests across the 11 files that read these modules pass; tsc clean.

SPEC IMPACT: None (implements the 2026-09-26 Invitation-fixes list).
