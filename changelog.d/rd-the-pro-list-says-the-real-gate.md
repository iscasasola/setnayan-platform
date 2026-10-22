## 2026-10-22 · fix(pro): the Pro list says the real gate — upload space, Love Story photos, all-in-one downloads

Owner 2026-10-22, "Yes to all" to the controller's recommendation on #6761's three flags: make the list match the
gates, no gating change. Three lines of `WEBSITE_PRO_ITEMS` (`lib/website-pro-items.ts`) reworded:

- "Uploads over 10 MB" → **"More upload space — 500 MB per event"**. The figure is COMPUTED
  (`UPLOAD_SPACE_ITEM` = `formatMakerMediaMB(coupleMediaCapBytes(true))`), so it follows the one cap function.
- "A 6th Love Story moment, with photos" → **"Photos in your Love Story"** (`momentCapRefusal` refuses a free couple's
  photo on ANY story).
- "One download of every guest's ticket" → **"All-in-one downloads — whole set, guest passes, QR sheet, place cards"**
  — every piece `isAllInOnePrint` refuses, by name ("Everything" is all of them in one).

The buy page's `BENEFITS` sentences name none of the three, so they are unchanged. The list still counts 14.
Guard: `lib/the-pro-list-names-only-real-gates.test.ts` § 4a–4c holds each line to its gate's behaviour (sabotaged red:
Pro cap = Free cap · a hand-typed figure · the photo gate only past the cap · `seating-pack` dropped from the gate ·
`menu` added to it · the old 6th line put back).

SPECIAL NOTE: "guest passes" is added to the owner-approved downloads wording because the gate covers every guest's
pass too and the instruction was to list exactly what the gate covers — flagged in the PR body.

SPEC IMPACT: `Setnayan/DECISION_LOG.md` — row 2026-10-22 "THE PRO LIST SAYS THE REAL GATE" (the three reworded lines).
