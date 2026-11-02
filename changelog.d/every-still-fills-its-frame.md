## 2026-09-08 · fix(demo): twelve more spotlight stills stop shipping half empty

Follow-up to #5318, which fixed two Setnayan AI scenes and BASELINED 23 others
rather than sweeping them up. This works that list — by measuring, not by
repeating the edit.

**Every still was decoded and its content's bounding box measured.** Median fill
across all 52 was **39%**, and the 23 split cleanly in two:

- **12 genuinely short** (24–68% fill) — centred and re-captured across 9
  products: Papic, Mood Board, Custom QR, Photo Delivery, Patiktok, Landing
  Page, Music Creator, Pakanta, Playlist.
- **11 must stay top-aligned.** Ten already fill **92–100%** of the frame;
  `PAKANTA_SCENES:3` fills 100% — its content is TALLER than the frame, so
  centring would clip its FIRST row instead of its last.

🔑 **THE BLANKET EDIT WOULD HAVE DAMAGED TEN PICTURES**, and the source cannot
tell you which: all 23 read `absolute inset-0 flex flex-col`. Only the pixels
distinguish a short scene from an overflowing one. This is the whole reason
#5318 baselined instead of fixing.

Re-verified after capture: 12 of 12 centred, **0 clipped** (each still's bounding
box diffed against `origin/main`).

⚠ **`INDOOR_BLUEPRINT_SCENES:2` came back to the baseline, and found a real bug
on the way.** Centring it is a NO-OP — its last child is `flex-1`, so the column
is already full height, and the re-captured JPEG was byte-identical. Looking at
that still to find out why showed the scene is **separately broken on main**: the
floor map's markers escape their container and land on the header — the green
"T3" over "Setnayan", the "Entrance" pill over "Blue Leaf Pavilion". Confirmed
pre-existing by diffing against `origin/main`. **Not fixed here** — it is a
layout bug in `floorMap`, not a framing one, and it is recorded in the baseline
so the next reader meets it.

⛔ **AND THE FRAME IS NOT BEING SHORTENED.** The open question from #5318 was
whether to shrink the 9:19 capture so content fills it. The measurement answers
it: **11 stills already fill 92–100%**, so a shorter frame would crop real
content out of them through `object-cover`. Refused on evidence rather than left
open.

SPEC IMPACT: None. Re-captured images and scene layout; no copy, price or locked
decision changed.
