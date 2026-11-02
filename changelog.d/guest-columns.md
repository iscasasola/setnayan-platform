## 2026-07-23 · feat(guest-columns): Guest Columns — one guest op-ed per guest for the couple's paper (BUILD ①, flag-dark)

OnTheDay BUILD ① (studies doc § 1) — a Kwento (`photo_messages`) near-clone for
zero-account guest TEXT with couple review:

- **Migration `20270917200000_guest_columns.sql` (INERT on merge):**
  `guest_columns` table — title ≤60 + body ≤280, `UNIQUE(event_id, guest_id)`
  (one column per guest), status `pending/approved/rejected/user_deleted`,
  `moderation_state` + `gcol_approved_needs_screen` CHECK interlock,
  `consent_captured_at NOT NULL` (RA 10173), `decline_note` (decline RETURNS
  the column to the guest). RLS at CREATE TABLE time: member-read +
  couple/coordinator moderate, **NO INSERT policy**. Service-role-ONLY
  SECURITY DEFINER RPCs `guest_submit_column` (upsert with
  edit-resets-moderation, per-guest advisory lock, edit burst guard, shared
  `guest_message_blocks` lever, and the **server-side EDITORIAL-PHASE
  cutoff** — submissions close when `NOW()` passes the event-date Asia/Manila
  midnight + 8h, mirroring `getLifecyclePhase`'s 'editorial' threshold;
  already-submitted columns remain approvable) and `guest_withdraw_column`
  (RA 10173 self-serve takedown, honest FALSE on nothing-to-withdraw).
- **Route `/api/guest-columns`** — cookie-validated (`setnayan_guest_session`),
  Tier-1 `moderateKwentoText` runs synchronously BEFORE the RPC ('blocked'
  never stored), consent required on every submit.
- **Guest UI** — `GuestColumnCard` on the guest-session tree of
  `app/[slug]/page.tsx` (one import + one mount line): approved columns
  ("The paper") + compose/pending-edit/declined-resubmit/approved-withdraw
  states with the editorial close-state mirrored client-side.
- **Review queue** — `/dashboard/[eventId]/studio/guest-columns`
  (kwento-queue clone): approve / return-with-note via RLS-riding server
  actions with 0-row-update honesty; access = couple OR **coordinator**,
  deliberately following the `guest_columns_moderate` RLS rather than the
  kwento surface's couple-only app gate (the study's § 1.2 inconsistency
  finding). Doorway QuickLink on the website hub (flag-gated).
- **Editorial** — new reorderable section key `guestColumns` ("Letters to the
  Editor"), fail-closed load (`approved` + `clean` + author not hidden) beside
  the Kwento quotes; registry appends the unknown key safely for saved orders.
- **Rollout:** everything behind `GUEST_COLUMNS_ENABLED` (server env, default
  OFF) — flag-off = zero behavior; the inert schema is the go-live hold.
- **Tests:** `tests/db/guest-columns.db.test.ts` replays ALL migrations and
  proves the upsert, burst guard, approved-lock, CHECK interlock, withdraw
  honesty, revive loop, and the editorial-phase cutoff.

SPEC IMPACT: None beyond the studies doc it implements
(`OnTheDay_App_Build_Studies_2026-07-23.md` § 1); owner sign-offs still open on
consent wording + print consent (§ 6.2 items 2–8) — flag stays OFF until then.
