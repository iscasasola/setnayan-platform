## 2026-07-21 · feat(schedule): coordinator "prep-then-release" visibility on the run-of-show (flag-off)

Coordinator P1 (spec § 4) — the industry's #1 coordinator feature (Aisle Planner
prep-then-release). A coordinator (event_moderators `wedding_planner_external`,
schedule 'edit') can stage schedule blocks PRIVATELY, then release them so the
couple sees them. Scoped to the schedule/run-of-show surface for PR-1.

- **Migration** `20270901120000_coordinator_prep_release_schedule_visibility.sql`
  — adds `visibility` (`coordinator_only` | `couple_visible`, default
  `couple_visible`) + `released_at` to `event_schedule_blocks`; tightens the
  `couple_read`, `public_read` (anon), and `booked_vendor_read` policies to
  exclude `coordinator_only`; leaves `moderator_read` open (the coordinator sees
  their own prep). Additive/idempotent; inert until a row is actually staged.
- **Flag** `lib/coordinator-prep-release.ts` —
  `NEXT_PUBLIC_COORDINATOR_PREP_RELEASE_ENABLED`, default OFF.
- **Guest-read leak fix** — the day-of guest schedule read
  (`fetchPublicScheduleBlocks`) runs on the service-role admin client which
  BYPASSES RLS, so it excludes `coordinator_only` in app code (flag-gated).
- **`setBlockPrepVisibility`** action (stage/release, stamps `released_at`) +
  a `prep` option on create — both guarded to the external coordinator only
  (the couple is backfilled as a partner1/partner2 moderator, so the gate keys
  on `role_subtype='wedding_planner_external'`, not merely "is a moderator").
- **UI** (coordinator + flag only): a "Start hidden from the couple (prep)"
  checkbox on the add-block form + a self-contained "Staged — hidden from the
  couple" panel with per-block "Release to couple". Left the complex
  `BlockCard`/`EventDayView` tree untouched.

Flag OFF (default) = byte-identical to today: no row is ever `coordinator_only`,
the tightened read policies + the guest-read filter are inert, and the UI
renders nothing. **DPO-gated** (widens the coordinator's private working set
over the couple's planning surface — same counsel packet as the consent gate);
stays flag-dark until the DPO signs off.

Deferred (PR-2+): a `coordinator_only` badge on the main timeline cards; a
"hide from couple" control on already-visible blocks; extending prep-then-release
to checklist/tasks (which today has no coordinator read/write policy at all).

SPEC IMPACT: Coordinator role § 4 (P1). Canonical: corpus
`Coordinator_Role_Feature_Spec_2026-07-18.md` § 4; logged at the bottom of
`DECISION_LOG.md`.
