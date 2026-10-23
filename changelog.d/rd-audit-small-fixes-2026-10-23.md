## 2026-10-23 · fix(event day, articles, admin launch offer): three owner-approved audit fixes

Four rulings the audit found were never built (owner "yes", 23 Oct). One already shipped; three land here.

- **Maker "Remove for good" waits for Apply** (DECISION_LOG 2026-10-07) — already shipped in #6397; no change. Held by `lib/remove-for-good-waits-for-apply.test.ts`.
- **Event-day Home: the Head table card shows only when the event has tables.** `your-table-card.tsx` `eventHasSeatPlan` (from the tables the page already reads, no new flag). A failed table read hides the card instead of saying "No head table set up yet". Guard: `the-head-table-needs-a-seat-plan.test.ts`.
- **Articles (`/blog`) say "event", not "wedding"** (DECISION_LOG 2026-10-01): page title, description, Open Graph, Twitter and JSON-LD descriptions, the cover eyebrow ("the Filipino event edit") and the H1 ("Event planning, the Filipino way."). The regroup by event type, faith and feature is a later P10 build.
- **A free-fee window needs a reason to open, not to close** (DECISION_LOG 2026-09-23, money switch #3). New column `platform_settings.booking_fee_free_reason` (migration `20271286170862`, 1–500 characters or NULL; "required" is enforced in the action, not in SQL, so a window opened before the column existed cannot block other settings updates). `saveLaunchOffer` intent `window` refuses an open window with a blank reason, clears the reason when the window is closed, and saves it in the same update the `admin_audit_log` row copies. The form has a Reason field filled from the stored reason. Guards: `lib/a-free-fee-window-needs-its-reason.test.ts` + a DB case in `a-free-fee-window-waives-the-charge.db.test.ts`. No new server action.
- **Not built:** money switch #2 ("turning the event-hub lock on warns and names") has no admin control at all. `fee_unlocks_event_enforced` is read in `lib/` only, so there is nothing to attach a warning to. Building a new money switch is outside this change.

SPEC IMPACT: None. Builds the existing DECISION_LOG rows 2026-09-23 (#3) and 2026-10-01 (blog title). No ruling changes.
