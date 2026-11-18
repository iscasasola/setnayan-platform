## 2026-11-18 · fix(seating): the "To seat" tray no longer covers the zoom stack or the empty floor's steps

Regression from #7906 (seat plan drag-first on a phone), found at 390x844 on Guests › Seats › 2D:
- The tray (`seat-face-tray.tsx`, `SeatFaceTray`) now publishes its covered height through the one thumb-room
  mechanism (`useThumbRoom`, `lib/thumb-room.ts`), so the zoom stack — which stands on `--sn-thumb-room` — rides above
  it: Fit all / Zoom in / Zoom out are no longer under a face.
- The empty floor's "Lay out your floor" card (`seating-editor.tsx`) centres between the pinned row and the thumb room in
  Guests, clear of the zoom column on a phone, so "Build my seating draft" shows without a pan.
- With 0 tables the tray no longer says "drag it to a chair": it says "No tables yet — Build my seating draft, or Add
  your first table." (`hasTables`).
- 🔒 `the-seat-tray-never-covers-the-zoom.test.ts`.

SPEC IMPACT: None
