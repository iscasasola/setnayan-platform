## 2026-11-18 · fix(shop): every badge on the Shop tab draws at one size, centred in its ring, the lock on the edge

Owner, 18 Nov, on his phone: *"looks like the badges are small and not centered properly."* The v84 tier pictures are
300 × 286 canvases with the badge drawn low and a soft shadow under it; Bronze's drawn badge is only ~158 × 165 of that.
Drawn at the canvas size, a locked badge was about half the Verified check, sat off its ring's middle, and the lock
(placed at 62% down) covered its face.

- `lib/shop-badge-shelf.ts`: `BADGE_ART_BOX` — each picture's drawn box, measured (alpha > 60) from
  `public/badges/v84/*.webp` — and `badgeArtFit(src, box)`, which places a picture so its drawn badge fills a square,
  centred both ways.
- `shop-badge-row.tsx`: the row draws every badge at the Verified check's size (0.9 of the slot); the lock is 22 px,
  sitting on the ring at its lower right. The risen locked look (`BadgeArtLarge`) uses the same fit.
- `award.module.css` / `locked-tile.tsx`: the risen lock is 26 px at the art's lower right, never over its face.
- 🔓 **A locked badge shows its REAL art** (owner 18 Nov: *"we still want to see how they look like. or it will always
  stay a mystery until someone unlocks it?"*): full colour, never grey, in the row and the risen look (`.lktArt`). The
  small lock and the "5 to go" / "Not yet" line say it is not earned. One knob, `--sn-locked-art-opacity` (default 1);
  the owner is shown full colour beside 0.85.
- **Clients' Choice words fixed** (`award-copy.ts`): it counts the most SECOND bookings of the seal year among shops with
  ≥ `CLIENTS_CHOICE_MIN_EVENTS` events — the engine's rule (`lib/shop-seals.ts`, owner 15 Nov) — not the stale "Top 5%
  by review-weighted score". The award-kit verbatim check skips that seal's body/how, held against the engine instead.
- The art is unchanged (v84, never redrawn); taps stay 96 × 131+ px; no new motion.
- 🔒 `lib/shop-badge-shelf.test.ts` § 8 · `award-kit.test.ts` § 20 (no grey) · `lib/shop-seals.test.ts` (Clients' Choice words = engine).

SPEC IMPACT: The locked look changes from v86's grey to the real art (owner 18 Nov ruling, logged in DECISION_LOG by the controller). Clients' Choice pop-up words now match the 15 Nov ruling; the 15 Nov prototype `badge-milestones_v53.html` still carries the stale heart text.
