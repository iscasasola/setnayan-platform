## 2026-11-01 · feat(schedule): Journey is gone, the Schedule prints like the budget PDF, Approve all

Plan §6b of `SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md` (DECISION_LOG 2026-11-01 "JOURNEY IS REMOVED" · "THE SCHEDULE PRINTS LIKE THE BUDGET PDF" · "APPROVE ALL").

- **Journey removed.** `journey-view.tsx`, `lib/journey.ts` (pure aggregation, no table) and its CSS are deleted; the view leaves the segmented control and Booked's view ▾. Every door forwards: `lib/schedule-view.ts` `forwardScheduleView` turns `?view=journey` into Planning Stage on `schedule/page.tsx` BEFORE it carries the view on to Suppliers › Booked or the Maker; Home's two links now say `?view=preparation`. The page also stops reading `event_recaps` (only Journey used it).
- **Print = the budget PDF.** `lib/schedule-pdf.ts` on the shared `lib/share-pdf.ts` engine + `app/api/schedule/[eventId]/export` (gated on the Schedule's own access before any read; a refused read is a 503 sentence, never a file of zeros). Page 1: Chapters · Moments · Venues · Suppliers; each chapter (top-level block) a section, its moments (children) as rows: time · what · who. `?names=0` drops Who; Paper ▾ A4 · Letter · Long bond. One shared `SharePdfButton` on the Schedule page header and on Booked › Schedule's date line. `lib/schedule-ros.ts` gains `readBlockRosMeta` (null on refusal).
- **Approve all.** Pinned at the foot of the Requests sheet when 2+ changes wait, behind the house `ConfirmForm`, posting the ids on the sheet. A suggestion in words gets **Noted** (no Decline) and is never in it — client (`approvableTogether`) and server (`decideSuggestion(…, onlyChanges)`) both. One accept path for Approve and Approve all; every supplier approved is told in-app.

Guards: `lib/journey-is-gone.test.ts` · `lib/the-schedule-prints-like-the-budget.test.ts` · `lib/approve-all-is-every-change-you-saw.test.ts` (each fails with its change reverted). Regenerated: port-control, design-rules, no-card baselines, Ugat screens.

SPEC IMPACT: None — implements rulings already in the corpus (plan §6b, DECISION_LOG 2026-11-01).
