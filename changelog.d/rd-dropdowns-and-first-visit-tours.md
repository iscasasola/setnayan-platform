## 2026-09-30 · feat(ui): pill rows become one dropdown · first-visit tours for five surfaces

Owner rules 2026-09-28 ("any set of choices is a dropdown") and 2026-09-25 ("every feature gets a
first-visit tour"), applied to the rows that were still pills:

- **One dropdown (shared `PickMenu`)**: Papic Decorate filter, and its caption colours (moved to
  their own row so the caption row fits a 375 phone) · Live Wall layout · Live Wall mode (each
  option now shows its hint; "follows your wedding date" → "your event date") · Papic gallery
  filter · Patiktok template categories · Your Team "Sort by" (the five ranking lenses and two
  plain sorts are two labelled groups in one list; an unavailable lens is listed with its reason)
  · Budget Save / Standard / Splurge (dashboard and the /tour demo) · Seat plan room size ·
  Memories lenses + "Also kept" (one list, two groups).
- New `app/_components/link-pick-menu.tsx`: the same `PickMenu` for a choice that is a page
  address, so server-rendered link rows stay server-rendered.
- **Guest list phone filter**: Side and RSVP are now dropdowns matching Role and Group beside them.
- **Remove-a-celebration reason**: a native `<select>`, deliberately not `PickMenu` — the frame
  is a `showModal()` dialog (top layer) and PickMenu's list portals to `body`, underneath it.
- **Tours** (TOURS + shipped mounts): `guest_papic_camera_v1` and `guest_papic_me_v1`
  (signed-out guests → `GuestGuidedTour`), `customer_guest_list_v1`, `customer_budget_v1`,
  `customer_galleries_v1` (`MiniTour`). `customer_papic_v1` copy refreshed: no more
  "photo-crew seats", "first 5 guest cameras free" or "wedding".
- Guard `lib/choices-are-one-dropdown.test.ts`: no single-choice pill row in any of these
  surfaces (detected by behaviour — `aria-pressed={a === b}` / `aria-current` / `active={a === b}`
  in a `.map(` or written out 3+ times), each still holds a dropdown, and each new tour is 3–5
  slides and mounted. Sabotaged once (seat-plan presets reverted to pills → red), restored.
- `scripts/port-control-baseline.json` regenerated (removed: `TiltButton`, `Seg`, `SegRow`, the
  Memories chip `Icon`).

SPEC IMPACT: None — applies standing owner rules (DECISION_LOG 2026-09-25, 2026-09-27/28); no new decision.
