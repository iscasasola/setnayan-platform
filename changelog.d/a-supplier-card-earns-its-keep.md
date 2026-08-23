## 2026-08-24 · fix(vendor-services): the maker stops costing the vendor their card, and the clip pill says how long the clip is

Two epilogue items from the Card Family stream (`WHATS_NEXT_Card_Family_Handoff_2026-07-29.md`
§ 3f), both in the zero-step canvas maker.

**Saving "who it's for" no longer throws the card away.** The audience sheet writes
`vendor_coverages`, so it is a sibling form — and it posted the shipped
`updateCoverageServes`, which ends in `redirect('/vendor-dashboard/services')`. Pressed
mid-build that discarded everything not yet posted: title, price, inclusions, the
customization draft, the photos already uploaded. The sheet WARNED about it, which is not a
fix — a warning that precedes losing the vendor's work still loses the work. The write is now
one body behind two doors: `updateCoverageServes` (unchanged, still used by the Services
page's own coverage panel, which is already on the page it returns to) and
`updateCoverageServesInPlace`, which returns its outcome for `useActionState`. Refusals and
the "Saved" note render beside the button — the redirect used to carry `?error=` and this
form no longer goes anywhere. "Saved" is bound to a key of what the SERVER stored, so it
disappears the moment a chip changes and can never confirm a selection nobody saved.

**The clip pill shows the real duration.** `ShowcaseMediaFields` already probed the video's
length to enforce the 30-second cap and then dropped it, so the card face read `▶ clip` — a
placeholder for a number the browser had just computed. The validator now reports it through
a callback (deliberately not a form field: it is a local measurement, the server has no use
for it, and the canvas's input-name set is pinned against the wizard's). `▶ 0:24`.
Floor, never round — the picker tolerates cap + 0.9s because container metadata rounds up, and
rounding would print `0:31` on a card whose own label says 30. An unprobeable codec reports
`null` and the pill falls back to the word: never `0:00`, never the previous file's number.
NOT persisted, on purpose — the only surface with a clip pill is the maker, which always has
the file in hand, and a column with no reader is this project's most-repeated defect shape.

SPEC IMPACT: None. No schema, no pricing, no locked decision touched. Both changes are inside
the vendor's own card maker.
