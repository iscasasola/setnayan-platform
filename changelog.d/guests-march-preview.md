## 2026-10-30 · feat(guests): ▶ Preview plays the march, one walk at a time

Guests › March's count row ended on a DISABLED "▶ Preview — The walk preview is coming" (R4 slice 3). It now plays the
march as the approved prototype's `startPreview` does (owner 2026-10-29: *"maybe we can use this row to add the
preview walk so it is not lost?"*):

- Press ▶ Preview → every section opens; each walk in turn is ringed (`data-march-walk-now`) and scrolled to the middle
  of the screen while a dark bar under the pinned row names it — "3. Tito Ben & Tita Cora" · "Principal Sponsors"
  (+ "· walks alone") — one walk every 1.1 s; then "That is the whole march · N walks" for 1.8 s and the bar leaves.
- While playing the tile reads Stop (■); the bar has its own Stop. Disabled only when nobody walks ("Nobody walks yet").
- The bar floats in a zero-height sticky slot (takes no room), slides in/out 0.25 s, no motion under reduced motion
  (and the scroll jumps instead of gliding). The timer is cleared every step and when March unmounts.
- Nothing is saved — a look, not an edit. Pure steps + words in `lib/march-preview.ts`.
- Guard `lib/the-march-preview-plays-the-walks.test.ts`; `lib/r4-seats-march-forwards.test.ts` test 8 updated (it
  pinned the disabled tile).

SPEC IMPACT: None — builds the approved prototype's ▶ Preview.
