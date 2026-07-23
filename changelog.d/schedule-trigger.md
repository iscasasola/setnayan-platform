## 2026-07-23 · feat(run-of-show): guest "happening now" follows the host-set trigger + delegate coordinators can advance

Owner directive 2026-07-23: on the wedding day the HOST and the COORDINATOR set
what is CURRENTLY HAPPENING; guests' "What's happening now" follows that
trigger instead of the wall clock; during RSVP season guests see the ESTIMATED
schedule, labeled as such. (~70% was already live via migration 20270321980372;
this ships the three deltas from OnTheDay_App_Build_Studies_2026-07-23 § 5.)

- **Coordinator widening (LIVE on merge)** — migration
  `20270917100000_runofshow_coordinator_advance.sql` re-creates
  `advance_schedule_block()` with ONE added gate arm:
  `moderator_area_level(event_id,'schedule')='edit'`. The shipped gate
  (`current_event_ids ∪ current_vendor_booked_event_ids ∪ is_admin`,
  20270321980372:118-122) rejected the product's real coordinator (an
  `event_moderators` delegate) with 42501 even though RLS already grants the
  same delegate a direct FOR ALL write on the same rows. Sequential advance
  only — no jump/rewind; single-winner + idempotent semantics unchanged.
- **Server-derived `canAdvance`** on the host schedule page (was hardcoded
  `true` — a view-only delegate saw the button and got a raw 42501 on tap):
  event_members row OR delegate schedule:'edit' via `resolveAreaLevel`.
- **Guest trigger read (flag-dark)** — behind `NEXT_PUBLIC_GUEST_NOW_TRIGGER`
  (default OFF; exists only to sequence against the 5-tab hub rebuild that
  re-homes these panels): `pickTriggerNowNext`/`hasRunShowSignal` in
  `lib/run-of-show.ts` (+ unit suite `lib/run-of-show.test.ts`); GuestHubCard
  "Coming up" (`pickNextScheduleBlock` preferRunState), /[slug]/hub Now panel
  (`WhatsHappeningCard` runStateTrigger + wrapped state + "Live · set by your
  hosts"), ScheduleWidget per-block badges + progress ring follow run_state so
  they can no longer contradict the RunOfShowHeader above them. Wall clock
  stays the fallback while every block is 'upcoming'; a private
  (is_public=false) live block degrades to "between moments" — no teaser.
- **Estimated labeling (same flag)** — pre/inactive phases render "Estimated
  program · times may shift on the day" on the guest ScheduleWidget (both the
  anonymous and identified-guest dispatchers + the hub Schedule panel).
- Booked vendors keep their shipped sequential advance untouched.

SPEC IMPACT: `0012`-adjacent day-of program (OnTheDay_App_Build_Studies_2026-07-23 § 5
is the authoring spec; orchestrator logs the DECISION_LOG row). No pricing, no
new tables — one CREATE OR REPLACE migration, columns unchanged.
