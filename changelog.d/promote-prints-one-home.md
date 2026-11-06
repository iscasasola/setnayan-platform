## 2026-11-06 · feat(shop): Shop › Promote › Calling card + tarps — row 2, Reviews QR, the badge print inside prints

Owner, 6 Nov: *"Use fable to decide. Find the best location for each. Make the pages live there and not jump to
another menu."* — DECISION_LOG 2026-11-06 "ONE HOME FOR EVERY PROMOTE TOOL": Promote's rows in order (1) QR codes ·
(2) Calling card + tarps · 15 designs · (3) gifts · (4) Share your work; the door print and the badge print are pieces
INSIDE prints; a Reviews QR (`/v/<slug>#reviews`) joins the prints QR ▾. Hint "QR codes · prints · gifts · share your work".

- RULE 0 / rule 8: the prints themselves (15 looks · 7 pieces incl. the A4 door print · Design ▾ · QR ▾ · Save per
  piece · See it in use) were ALREADY built in draft #7318 (`claude/exciting-babbage-psw43o`). This branch MERGES it
  and adds only the ruling's delta — nothing redrawn.
- Order: Prints mounts as Promote's row 2 (before the gifts; #7318 had it after).
- Reviews QR: `PrintQrMode = PromoteQrMode | 'reviews'`; `printQrUrl('reviews')` = `myPageUrl` + `#reviews` (the shop
  page's own `<section id="reviews">`). Print-only — the Promote screen's code picker is unchanged. Decode test scans it
  on all 7 sides. ⚠ "Reviews" / "Scan to read our reviews" are NOT prototype words (its QR table has three rows) —
  flagged for the owner.
- Your badges: a piece in the prints list saving the shipped badge print (`/api/vendor/badges?badge=all`); its facts
  are read when the sheet opens (`?view=facts`, the Today line's read) so Promote's own reads do not grow; a refused
  read is said. Analytics › Your badges' "Save to print" removed. Today's "You earned …" line keeps its own Save.
- Hint: `SHOP_SEGMENT_HINT.promote` = "QR codes · prints · gifts · share your work".
- Not in this branch: the door STICKER's mount on Customers › QR codes and `lib/door-sticker-print.ts` live in #7303
  (S0, base main), not in this stack; the shop's logo in the print's circle (initials still print).

SPEC IMPACT: None — implements DECISION_LOG 2026-11-06 "ONE HOME FOR EVERY PROMOTE TOOL" (prints row); no corpus edit.
