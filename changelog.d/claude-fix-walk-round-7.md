## 2026-11-13 · fix(walk): round 7 of the re-walk (RW-65 · RW-81 · …)

- **RW-65** The "What do you need?" dropdown's first choice read "Simple event · Papic + one QR", a working name; it now
  says "Just photos and one QR for everyone". The Get-together tile's description said "No vendors, no marketplace" —
  a guarded data migration changes it to "No suppliers to book" only while the row still holds its seed text, so an
  admin's own wording is never overwritten.
- **RW-81** The sample shop page on /for-suppliers drew "View larger map →" as a live link. Both map components take
  `mapHref={null}` (like `checkHref={null}`) and then draw the words with no link; the sample passes it on every map.
  Guard: `app/v/[slug]/the-sample-is-the-real-page.test.ts`.

SPEC IMPACT: None.
