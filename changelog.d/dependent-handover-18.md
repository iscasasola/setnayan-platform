## 2026-07-16 · fix(people): dependent hand-over age is 18 for everyone (owner-locked — PH age of majority, RA 6809)

`handOverAge()` in `lib/dependent-people.ts` returned 18 for females but 21 for males, tying the *ownership* hand-over of a guardian-held dependent record to the debut milestone ladder. Owner locked 2026-07-16: hand-over is **18 for both sexes** — an 18-year-old male is a full adult and data subject under RA 6809/RA 10173, so the guardian's ownership of his sensitive PI (birthdate/sex/religion) cannot extend to 21. The debut MILESTONE ladder (18th for daughters, 21st for sons) is untouched — that is a celebration concept (`dependentNextMilestone` + the "For the debut year" picker copy), not an ownership boundary.

- `lib/dependent-people.ts`: `handOverAge()` → constant 18; `shouldHandOver()` doc updated (elders still never auto-hand-over).
- `lib/dependent-people.test.ts`: expectations flipped (boy at exactly 18 now hands over; still-17 case added); suite green 7/7.

Behavior-inert in production: the whole dependent surface is counsel-gated behind `NEXT_PUBLIC_DEPENDENT_PEOPLE` (off) and nothing calls `shouldHandOver()` yet — the claim/transfer flow is the next build. This lands the locked age *before* the G1 counsel review so counsel reviews the correct rule.

SPEC IMPACT: DECISION_LOG.md 2026-07-16 row (dependent ownership — hand-over 18 for both, superseding the F18/M21 hand-over split; debut ladder unchanged)
