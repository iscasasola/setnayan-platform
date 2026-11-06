## 2026-11-04 · feat(supplier-scan): slice 4 — Roaming photographer (scan the guests in frame, then shoot)

Slice 4 of 5 of the supplier claim scanner (stacked on slice 3). Owner ruling: DECISION_LOG 2026-09-25 "ROAMING
PHOTOGRAPHER MODE: TAP/SCAN BEFORE THE SHOT, GROUPS INCLUDED" — pre-link by scanning/tapping the guest(s) BEFORE the
photo; no unlinked prints; counter "Shots · Ready · Claimed".

- **Migration `20271322360315`**: the mode `roaming` — settings, claims and sessions CHECKs widen. It is the Group
  session's shot with no station, so slice 3's functions already run it (open · scan in · Done · Ready · pickup).
- **Scanner**: Roaming in the Shop › Services dropdown; the shot panel says "Scan the guests in frame, then take the
  photo"; the result line reads "#0231 · 2 guests · shoot"; the count "Shots 64 · Ready 8 · Claimed 57".
- Tests: `tests/db/a-roaming-photographer-scans-before-the-shot.db.test.ts` (3) · `lib/supplier-scan.test.ts` (+1).

SPEC IMPACT: DECISION_LOG row for slice 4 added. Not built here (separate ruling, separate slice): the uploaded photo per
number paid from the supplier's own Papic allowance (2026-09-25 "EACH SCAN NUMBER CAN CARRY AN UPLOADED FILE…").
