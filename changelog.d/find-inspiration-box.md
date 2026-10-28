## 2026-10-29 · feat(suppliers): the Inspiration box — each open category in Find shows Services · Inspiration

Owner, live, Suppliers › Find: *"where are the inspiration box"*. Built to the approved prototype "Find at scale" v2
(claude.ai artifact VeH8DgXyXTrCMqZXJiFaFj) and the rulings DECISION_LOG 2026-10-28 "INSPIRATION LIVES IN SUPPLIERS ›
FIND" / "INSPIRATION IN FIND — FINAL FRAMES A–F APPROVED"; plan `EVENT_MENU_REORG_BUILD_PLAN_2026-10-27.md` row 11 (R5).

- Each open category whose services have inspiration PARTS (Admin › Categories — `inspiration_parts` +
  `inspiration_part_services`, one source) gets a **Services · Inspiration** switch pinned under its head (one stacked
  block, heights measured — `--cat-head-h` + `--cat-mode-h`; the open body clips with `overflow:clip` so it can pin).
- **Inspiration**: Part ▾ (PickMenu), the suppliers' own credited photos in a 2/3/4-column wall, 24 at a time, a
  full-screen viewer (swipe / ‹ › / Esc) naming who made the photo, and **View their services** → the shipped supplier
  sheet.
- **Fewest requests:** the parts ride the page's existing batched read (`getInspirationParts()`, React-cached); opening
  a category asks nothing; the photos are ONE ranged read per 24 over every part of the category (the shipped
  `fetchGalleryAssets` now takes `slotKeys`), kept for the visit; switching back to Services keeps it mounted — no
  refetch.
- **Reads honest:** a failed read says "We couldn't load the photos just now · Try again", never "no photos".
- Lab: `/dev/suppliers-lab?open=catering` (100 photos) · `&inspo=fail|none|slow`.

NOT in this slice (next): ♡ Save to the board + shortlist + the auto-inquiry (28 Oct ruling — needs a dedupe record);
Sort ▾ "Most saved" (no saves count exists yet); Services at scale (Best for your event · All N · chips · Saved tray ·
Compare · Ask all); the Studio › Mood Board tile is LEFT AS-IS (rename vs remove is an open owner question).

SPEC IMPACT: corpus `EVENT_MENU_REORG_BUILD_PLAN_2026-10-27.md` row 11 → "Inspiration box in Find: built, not live".
