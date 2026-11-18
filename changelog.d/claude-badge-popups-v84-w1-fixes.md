## 2026-11-18 · fix(shop-badges): W1's three faults on the v84 badge row

- **F1** — the not-earned Setnayan Verified sheet printed "Send the three business papers; Setnayan checks the owner,
  the papers and the work." twice (the locked tile's line and the plain line under it). The plain line now shows only
  when it differs from what the locked tile already says.
- **F2** — the Shop header's "Next badge" read the retired events ladder ("10 events · 10 to go") while the Completed
  bookings tile said "Bronze at 5 bookings · 5 to go". The header now reads the tile's own goal
  (`shelfNextBadgeLine` → the tile's `nextShort`, built from the same step as its `next`); `nextBadgeShort` is gone.
  🔒 `lib/shop-badge-shelf.test.ts` § 6 compares the two at every count (sabotage-checked: it goes red).
- **F3** — the supplier hero (Today · Shop · Portfolio) drew its lines absolutely in a fixed 208 px box, so a wrapped sub
  row grew upward over the eyebrow and the "Sample photo" chip. **Also on `main`.** The rows are now in flow (eyebrow ·
  chip row · title block pinned to the bottom), the hero is `min-h-[208px]` — 208 whenever its lines fit, taller rather
  than overlapping — the placeholder's Upload pill moved into the chip row so the title keeps the full width, and the
  Shop cover's sub-row links press at 44 through `.sn-hit` instead of drawing 44-px rows.

SPEC IMPACT: None
