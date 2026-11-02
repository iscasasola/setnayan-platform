## 2026-11-02 · feat(schedule): the supplier's part of the schedule — + My moment, My times, Suggest, Take back, Auto-agree, Seen, Confirm my times, crews (Step 4b)

Owner 2026-11-01 (DECISION_LOG "SUPPLIERS GIVE THEIR PART FROM THEIR SCHEDULE VIEW", "SCHEDULE PLAN §9" item 4 — Auto-agree
starts Off; corpus `SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md` §3, §3c, §12 Step 4).

- **The supplier's Schedule view** (Customer › Schedule): their chapters (Where), every moment — theirs open ("yours",
  their crew), everybody else's greyed and read-only — with **+ My moment · My times · Suggest** on the suppliers' one
  thumb row. The 3 Oct forms under every moment (Change or remove · Suggest a change · Suggest a new timeline entry ·
  Your requests) MOVED into it; the old "Full timeline / My slots only" pill row became one dropdown.
- **Waiting for the host · Take back** on every ask still open; **Seen** when the schedule changed since they last
  looked; **Confirm my times** in the final week (the seven days up to the event day).
- **Auto-agree** — Event Details › Event access › Supplier changes: "I check and approve / reject" (default, every event)
  or "Auto-agree" (a supplier's change goes straight in, through the host's ONE accept path).
- **Crews**: "Who on our side" on a supplier's moment becomes one `event_schedule_tasks` row per crew name on approval.
- The accept path (`decideSuggestion`) moved to `lib/schedule-suggestion-decide.server.ts` so Approve, Approve all and
  Auto-agree run the same code; a new moment lands inside the chapter it named.
- Migration `20271300619930`: `events.supplier_requests_auto_agree` (default false); `event_schedule_suggestions` gains
  `proposed_parent_block_id`, `proposed_crew`, `auto_agreed` and status `withdrawn`; the INSERT policy refuses an add into
  a chapter the supplier is not linked to and crew on anybody else's moment; `withdraw_schedule_request` (Take back);
  `event_supplier_schedule_marks` + `supplier_mark_schedule` (Seen · Confirm, final week only).
- Guards: `tests/db/the-supplier-writes-their-part.db.test.ts` (not theirs = refused · Take back own only · Confirm is
  recorded, final week only) · `lib/auto-agree-off-means-the-change-waits.test.ts` · `lib/supplier-schedule.test.ts`.
- Lab: `/dev/supplier-lab?s=schedule` (&state=week|confirmed|auto|seen|unlinked|fail).

SPEC IMPACT: `SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md` §3 + §4 — Step 4b marked built (not live until shipped);
Auto-agree lives in Event Details › Event access (Event Details has no Privacy group — the plan's "Event Details ›
Privacy" placement, flagged for the owner). `DECISION_LOG.md` — one row recording the build and the placement.
