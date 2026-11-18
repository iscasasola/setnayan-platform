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
- The art is unchanged (v84, never redrawn); taps stay 96 × 131+ px; no new motion.
- 🔒 `lib/shop-badge-shelf.test.ts` § 8.

SPEC IMPACT: None
