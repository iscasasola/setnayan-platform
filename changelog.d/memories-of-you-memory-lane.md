## 2026-10-24 · copy(memories): "Photos of you" → "Memories of you"; the live photo wall → "Memory lane"

Owner ruling 2026-10-24, continuing the 2026-10-23 "no 'gallery' — Memories" ruling. Visible words
only: no identifier, route, column, SKU key (`LIVE_WALL`), CSS class or `data-*` marker moved.

- **"Photos of you" → "Memories of you"** — the guest's own tagged photos (Maker part `myphotos`,
  `f:photos_of_you`): the guest bar, the block's heading ("— so far" on the day), the hub, the
  `/papic/me` page, the Maker part/eyebrow labels, "What guests see", help, tours, the /papic and
  App Store demos.
- **"Live Photo Wall" / "Live Wall" / "photo wall" → "Memory lane"** (sentence case everywhere,
  matching the app's other part names — "Your seat", "Digital pass"): the guest-page block and its
  heading (was "Live from the {occasion}"), the venue screen, the couple's Papic card, the live page
  + its nav/route labels, the day-of card, Clearance, put-away, the editorial and Post Event scene
  names, the guest card's blur switch, the Panood control room source, the flash-auto-wall
  notification, onboarding, /features (EN + TL), /papic, privacy, cookies, llms.txt, the tour.
- **The photos scene's small line "Our photos" → "Memories"** (`PHOTOS_EYEBROW`, every style). A
  heading the couple typed (`config_json.photos_heading`) is untouched.

Kept on purpose: lower-case prose that describes photos rather than naming the feature ("the photos
of you find their way back to you"), the physical décor "photo wall" (step-and-repeat backdrop in
the reception scene / theme vocabulary / a Papic challenge prompt), and the generic comparison on
/papic ("A photo wall gives everyone one pile to scroll"). The shorthand "the wall" (e.g. "Take it
off the wall", "Open the wall") is unchanged and is an open owner question.

Tests that assert the visible words were moved to the new words; none deleted.

SPEC IMPACT: None in code. Display names stored in the database are NOT changed here:
`platform_package_catalog.PAPIC_UNLOCK_LTD.description` (inactive) still says "Live Photo Wall";
a catalogue change needs the owner's OK and a migration.
