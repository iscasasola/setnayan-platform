## 2026-11-21 · chore(card-maker): one batch for #7928 #8038 #7939 #8006 #8008 #8009 #8010, on main's newer maker

One merge train for the Card Maker HYBRID stack (merge commits, no rebase). Each part keeps its own fragment; this one
records what the batch itself changed.

- **Conflicts, main kept.** Main's Availability step 3 (#7544/#8042: the style pick, "Recommended for …", Made to order's
  rows, Always available never counted) moved WITH the hybrid's "How clients book" group to the first page. Main's 701 px
  (`tab:`) split kept. The maker's select carries main's `availability_style`/`order_lead_days` beside part 2's and
  part 7's columns. Admin › Categories keeps main's Availability picks beside part 2's Quick Forms.
- **Parity fixes from the walk at 375 light/dark and 1280.** The Availability pick is a row of the group (name left,
  pill right, like Schedule) instead of a loose label over a bare dropdown. The SameDayRow tip that pointed to "More
  settings · Booking terms" (moved) now points to Exact time slots. In dark, What's included's rows wore the page's
  cream inside the framed group (a darker inset); their swipe face now wears the frame's own ground.
- **Motion.** Made to order's rows (Order at least · Usual prep) enter with `sn-rise` (MOTION_STANDARD § Enter, "a new
  row"); reduced motion freezes it through the global block.
- Regenerated once: admin jobs, admin map, ugat screens, exposure baseline, port baseline.
- ⚠ #8010 carries #8012 (Availability step 4) whole, including migration `20271352068061`.

SPEC IMPACT: None — merges approved parts and fixes parity with the HYBRID drawing; no ruling changed.
