/**
 * RA 10173 subject-export COVERAGE guardrail.
 *
 * The invariant it restores: `app/api/profile/export/route.ts` is the data-subject
 * export, and until now every NEW user-data table silently defaulted to
 * UN-exported. That failure mode recurred three times in a single day
 * (orders/payments · consent receipts · coordinator working notes + broadcasts)
 * because nothing anywhere connected "a migration added a user-identifying
 * table" to "the export must decide what to do about it".
 *
 * This test makes that decision MANDATORY and REVIEWED. Every table in
 * supabase/migrations that carries a subject-identifying column must be in
 * exactly one of three buckets:
 *   • EXPORTED             — derived from the route source, never hand-written.
 *   • DELIBERATE_EXCLUSIONS — the account holder is not the data subject, or
 *                             exporting the row is itself unsafe. One reason each.
 *   • KNOWN_GAPS            — a real RA 10173 shortfall, PINNED and greppable
 *                             (`TODO(RA10173-backlog):`) so it stays countable.
 * A new table lands in NONE of them and the test goes RED. That is the whole
 * point: a silent omission becomes a deliberate, reviewed one.
 *
 * ── HONESTY ABOUT THE HEURISTIC ──────────────────────────────────────────────
 * A guardrail that silently under-detects is WORSE than no guardrail, because it
 * manufactures false confidence. So, plainly:
 *
 *  1. Only regex-visible `CREATE TABLE public.<name>` is seen. A table created
 *     inside a DO block, via dynamic SQL / EXECUTE, in a non-`public` schema, or
 *     outside supabase/migrations (e.g. applied straight to prod) is INVISIBLE
 *     here and will never be flagged.
 *  2. Subject-column detection is TWO signals, not one (widened 2026-07-21 after
 *     adversarial review found the single name-regex under-detecting):
 *       (a) the name matches `SUBJECT_COL` (`user_id` / `*_user_id`), minus the
 *           eight enumerated `STAFF_ACTOR` names, OR
 *       (b) the column carries `REFERENCES public.users(user_id)` under ANY
 *           name — which is how `marketing_share_consents.customer_id` is now
 *           seen. Before this, the guardrail could not see a table the export
 *           itself already reads.
 *     Signal (b) is applied with NO second suppressor. A first cut filtered it
 *     through `STAFF_ACTOR_FK = /^(.*_by|…)$/`; that regex suppressed 22 tables
 *     wholesale and took two genuine subject tables with it
 *     (`event_journey_steps`, `event_preparation_items`), i.e. it re-created the
 *     under-detection this widening exists to close. It is deleted; operator
 *     stamps are now answered one-by-one in DELIBERATE_EXCLUSIONS.
 *     Both signals remain defeatable, and this is the residual blind spot:
 *     a subject column with neither the name nor an INLINE FK — a bare `UUID`
 *     holding a uid, or an FK attached later by `ALTER TABLE … ADD CONSTRAINT`
 *     rather than declared inline — is still invisible here and always will be.
 *     Measured 2026-07-21 on this repo, after both fixes: 344 tables · 135 in
 *     the enforced tier · 37 FK-to-users columns whose NAME the regex misses,
 *     on 35 tables, of which 25 were invisible to the name regex alone.
 *     Parsing is segment-oriented (top-level comma split with `--` comments
 *     stripped to end of line), not line-oriented, so a REFERENCES clause
 *     wrapped onto its own line is caught. T10 asserts that every table already
 *     classified here is still SEEN, so a future narrowing of either signal
 *     fails loudly instead of silently shrinking the guarded set.
 *  3. The SECOND tier is deliberately NOT enforced. Measured on this repo:
 *     344 tables · 135 carry a subject column (the enforced tier) · a further 87
 *     carry `event_id` (personal data reachable through an event) with NO
 *     subject column. Enforcing that tier would flag 222 of 344 tables and
 *     produce a ~200-entry allowlist nobody reads — i.e. exactly the rubber
 *     stamp this test exists to prevent. The numbers are recorded so the
 *     trade-off stays auditable and revisitable, not so it stays permanent.
 *  4. A textual reference in the route proves a table is TOUCHED, not that it is
 *     CORRECTLY SCOPED, and it says NOTHING about which of the table's columns
 *     actually reach the subject. Only T6 (identity column) and T11 (which
 *     CLIENT issues the read) check scoping, and only for the three tables read
 *     through the service-role client; only T12 checks column COMPLETENESS, and
 *     only for `vendor_profiles`. Every other EXPORTED entry is trusted to be
 *     reviewed by a human — including its select list, which for most sections
 *     is a hand-written subset nothing compares against the table.
 *  5. Retired tables are not detected. `DROP TABLE` in these migrations is
 *     idempotency scaffolding preceding a CREATE, not retirement — so a
 *     genuinely dropped table would linger as a stale map entry until T3 is
 *     reconciled by hand.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readSchema, type TableSchema } from './security/migration-schema';
import {
  VENDOR_PROFILE_EXPORT_COLUMNS,
  VENDOR_PROFILE_EXPORT_OMITTED,
} from './export-vendor-profile-columns';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // apps/web/lib
const MIGRATIONS = path.resolve(HERE, '..', '..', '..', 'supabase', 'migrations');
const ROUTE = path.resolve(HERE, '..', 'app', 'api', 'profile', 'export', 'route.ts');

// ── Parser ───────────────────────────────────────────────────────────────────
// Extracted 2026-07-26 to lib/security/migration-schema.ts so the RA 10173
// ERASURE guardrail reuses this exact parser instead of growing a second one.
// The honesty notes in the docblock above still describe its limits.

/** `user_id` or anything ending `_user_id` — the account holder's own handle. */
const SUBJECT_COL = /^([a-z0-9_]*_)?user_id$/;

/**
 * Setnayan-STAFF action stamps. These identify an operator acting in role, not
 * the account holder whose export this is — an admin's uid on a review row does
 * not make that row the admin's personal data.
 *
 * ⚠ `accessed_user_id` and `target_user_id` were WRONGLY listed here until
 * 2026-07-21. On those two names the subject IS the target, not the operator:
 * admin_data_access_log.accessed_user_id is the account that was LOOKED AT, and
 * admin_approval_requests / vendor_admin_motions .target_user_id is the account
 * the motion is ABOUT. Excluding them hid three tables from the guardrail
 * entirely. The docblock rationale was true for the `*_by_user_id` names and
 * simply false for those two; both are now in scope and classified below. T7
 * pins that they stay in scope.
 */
const STAFF_ACTOR =
  /^(admin_user_id|reviewed_by_user_id|approved_by_user_id|decided_by_user_id|handled_by_user_id|moderated_by_user_id|resolved_by_user_id|actor_user_id)$/;

/**
 * Second, name-independent detector: any column with an explicit
 * `REFERENCES public.users(user_id)` FK points at a person, whatever it is
 * called. This is what catches `marketing_share_consents.customer_id` — a
 * table the export already reads but which the name regex could not see, i.e.
 * the guardrail was blind to a table it was supposedly guarding.
 *
 * ⚠ THERE IS DELIBERATELY NO SECOND SUPPRESSOR HERE.
 * A first cut of this widening paired the FK signal with
 * `STAFF_ACTOR_FK = /^(.*_by|.*_admin_id|…)$/` to keep operator stamps out.
 * Adversarial review killed it, correctly: the blanket `.*_by` alternative
 * suppressed 22 tables wholesale, including `event_journey_steps.completed_by`
 * (the couple member who completed a planning step) and
 * `event_preparation_items.created_by` (a couple-added prep item) — pure
 * subject data with no `*_user_id` column, hence invisible, unexported and
 * unclassified. A regex cannot decide this: `created_by` is a Setnayan admin on
 * `platform_expenses` and a data subject on `event_preparation_items`. So the
 * FK signal is now UNFILTERED and every table it pulls in is classified BY NAME
 * below with a stated reason — which is the rule the rest of this file already
 * lives by ("NO wildcards, NO prefix rules"). The cost is 22 extra
 * DELIBERATE_EXCLUSIONS lines. That is the correct price.
 */
function isSubjectColumn(col: string, userFks: Set<string>): boolean {
  if (STAFF_ACTOR.test(col)) return false;
  if (SUBJECT_COL.test(col)) return true;
  return userFks.has(col);
}

function inScopeTables(schema: Map<string, TableSchema>): string[] {
  return [...schema.entries()]
    .filter(([, s]) => [...s.cols].some((col) => isSubjectColumn(col, s.userFks)))
    .map(([t]) => t)
    .sort();
}

/**
 * Tables the export route references. Two call shapes are both real:
 *   • `.from('table')`
 *   • PostgREST embeds inside a select string — `events(...)`, `communities(...)`
 *     — which never appear as from() literals.
 */
function exportedTables(routeSrc: string): Set<string> {
  const out = new Set<string>();
  for (const m of routeSrc.matchAll(/\bfrom\(\s*'([a-z0-9_]+)'\s*\)/g)) {
    if (m[1]) out.add(m[1]);
  }
  for (const lit of routeSrc.matchAll(/'([^'\\\n]*)'/g)) {
    for (const e of (lit[1] ?? '').matchAll(/([a-z0-9_]+)\(/g)) {
      if (e[1]) out.add(e[1]);
    }
  }
  return out;
}

// ── The two reviewed buckets ─────────────────────────────────────────────────
// Per-table only. NO wildcards, NO prefix rules — a pattern rule would
// re-create the silent default this test exists to kill.

/**
 * Tables where the account holder is genuinely NOT the data subject, or where
 * exporting the row is itself unsafe. These are answers, not debt.
 */
const DELIBERATE_EXCLUSIONS: Record<string, string> = {
  // Became "user-identifying" on 2026-08-04 when the lock handshake added
  // lock_requested_by_user_id / lock_answered_by_user_id. Both are ACTOR STAMPS
  // (SET NULL + nullable — the same actor-or-subject test the erasure guardrail
  // applies), recording WHICH person clicked ask/agree, not facts about them.
  // The row's subject is the BOOKING between a couple and a vendor, and it is
  // already reachable in an export through the EVENT, scoped to the account
  // holder's own events — not through whoever happened to press the button. A
  // vendor's staffer appearing in lock_answered_by_user_id must not pull a
  // couple's whole booking into that staffer's personal export.
  event_vendors:
    'Booking row shared by a couple and a vendor. Its two *_user_id columns are actor stamps (who asked, who answered), not subject data — exporting by them would hand one party the other party’s commercial record.',
  api_keys:
    '0033 gateway credential material — a key hash is a bearer secret, never exported (same rule as the alaga claim_token).',
  vendor_locked_qr_tokens: 'Live bearer tokens — exporting one hands over a redeemable secret.',
  seating_editor_locks: 'Ephemeral advisory lock; holds no durable personal data.',
  blacklisted_emails:
    'Anti-abuse investigation record — disclosure defeats detection (NPC investigation carve-out; counsel-reviewed).',
  concierge_abuse_flags:
    'Anti-abuse investigation record — disclosure defeats detection (NPC investigation carve-out; counsel-reviewed).',
  chat_message_flags:
    'Anti-abuse enforcement record (off-platform-contact block) — metadata only (categories + timestamp of a blocked message, NEVER the text); exporting it hands the subject the exact filter triggers to evade (NPC investigation carve-out, same rule as concierge_abuse_flags). sender_user_id is the blocked sender.',
  concierge_brain_chunks:
    'Setnayan-authored planning content; the *_by stamp is an internal editor, not a data subject.',
  concierge_plan_templates:
    'Setnayan-authored planning content; the *_by stamp is an internal editor, not a data subject.',
  concierge_response_cache:
    'Setnayan-authored cached content; the *_by stamp is an internal editor, not a data subject.',
  setnayan_pay_methods: 'Platform payment configuration — Setnayan’s own rails, not subject data.',
  platform_settings:
    'Platform configuration; platform_settings.ig_user_id is Setnayan’s OWN IG account, not a user’s.',
  vendor_verifications: 'Admin decision record — the uid on it is a staff actor, not the subject.',
  vendor_admin_motion_votes: 'Admin decision record — the uid on it is a staff actor, not the subject.',
  oauth_grants:
    'Live credential material — refresh_token / access_token to the subject’s Google account. Same rule as api_keys: a bearer secret is never exported, and a subject-access download is a file that lands in Downloads and gets emailed around. Newly VISIBLE 2026-07-26, not newly excluded: `granted_by_user_id` was added so ERASURE could stop deleting the co-partner’s grant event-wide (migration 20271009200000), and the attribution column is what made this table detectable at all. The non-secret fact of the connection (which account, connected when) is mirrored onto `events.photo_delivery_account_email` / `photo_delivery_status`.',

  // ── Newly VISIBLE 2026-07-21 (second pass) ────────────────────────────────
  // These 21 became visible when STAFF_ACTOR_FK was DELETED (see the
  // isSubjectColumn docblock). Each was checked column-by-column against its
  // migration; in every one the only FK to public.users is a Setnayan-operator
  // stamp on Setnayan's own configuration, books, or moderation queues. They
  // are written out one by one, by name, precisely so nobody has to trust a
  // regex's opinion about what `created_by` means on a given table.
  discount_codes: 'Platform promo configuration — created_by_admin_id is the admin who authored the code.',
  promo_free_windows:
    'Platform promo configuration (free-window announcements) — created_by is the admin who scheduled the window; the row defines a promo, not any data subject’s personal data.',
  event_feature_policy_override:
    'Per-event feature toggle set by staff — set_by_admin_id is the operator, not the subject.',
  feature_policy: 'Platform feature-gate configuration — updated_by_admin_id is a staff actor.',
  homepage_background_videos: 'Marketing site configuration — updated_by_admin_id is a staff actor.',
  homepage_hero_config: 'Marketing site configuration — updated_by_admin_id is a staff actor.',
  reveal_studio_config: 'Platform Reveal Studio configuration — updated_by_admin_id is a staff actor.',
  site_widgets: 'Marketing site configuration — updated_by_admin_id is a staff actor.',
  platform_compliance_facts:
    'Setnayan’s OWN PIC/DPO compliance record (singleton row) — updated_by is a staff actor; the personal data in it is Setnayan’s officers, disclosed on /privacy, not a user’s.',
  platform_expenses: 'Setnayan’s own books — created_by is the staff member who logged the expense.',
  order_refunds: 'Admin reconciliation decision — refunded_by_admin_id is a staff actor. The subject-side record is `orders`/`payments`, both exported.',
  vendor_2307_filings: 'BIR filing artifact generated by staff — generated_by_admin_id is a staff actor.',
  vendor_self_comp_caps: 'Platform comp-cap configuration — raised_by_admin is a staff actor.',
  vendor_correction_requests:
    'Vendor identity-field correction queue — resolved_by is the reviewing admin; the request itself is keyed to vendor_profile_id, whose owner-side record is `vendor_profile` (exported).',
  vendor_web_dossiers:
    'Admin-run vendor due-diligence search — requested_by is the admin who ran it; the dossier is about a BUSINESS listing, not the account holder.',
  moodboard_library_assets:
    'Setnayan-curated mood-board asset library — uploaded_by is the internal stylist/admin who added the asset, not a data subject.',
  social_posts:
    'Setnayan’s OWN outbound social posts — created_by is the admin who composed the post. The couple-side record is `marketing_share_consents` (exported).',
  fraud_signals:
    'Anti-abuse detection record — reviewed_by is the reviewing admin; disclosure defeats detection (NPC investigation carve-out, same rule as blacklisted_emails).',
  integrity_flags:
    'Anti-abuse detection record (review fraud / ghost listing) — reviewed_by is the reviewing admin; disclosure defeats detection.',
  vendor_image_flags:
    'Anti-abuse detection record (image repost watch) — reviewed_by is the reviewing admin; disclosure defeats detection.',
  vendor_qr_media_flags:
    'Anti-abuse detection record (QR-in-media guard) — reviewed_by is the reviewing admin; disclosure defeats detection.',
  owner_alerts:
    'Internal ops alerting for the platform owner — acknowledged_by is the owner acting as operator; holds no user personal data.',
};

/**
 * PINNED RA 10173 backlog. These are NOT excuses — each is a table whose rows
 * plausibly ARE the subject's personal data and which the export does not yet
 * ship. Prefixed `TODO(RA10173-backlog):` so they are greppable and countable.
 * This PR closes 2 of ~99 in-scope tables; the honest size of the remainder is
 * exactly what this map exists to make visible.
 */
const KNOWN_GAPS: Record<string, string> = {
  // ── Newly VISIBLE 2026-07-26, not newly created ──────────────────────────
  event_paperwork:
    'TODO(RA10173-backlog): the subject’s own PSA / CENOMAR / baptismal reference numbers and the scanned documents behind them — squarely subject data, and not exported today. It became DETECTABLE only on 2026-07-26, when `subject_user_id` was added so ERASURE could stop destroying the co-partner’s civil-registry documents event-wide (migration 20271009200000). Nothing populates that column yet (no user↔partner-slot mapping exists), so an attribution-scoped export would currently return zero rows; wire it into the export route in the same PR that lands the mapping. Only the 8 per-partner document_type values can ever have a subject — the 7 joint ones (marriage_license, pre_cana_certificate, banns_posted, the counselling records) belong to both partners and need their own disclosure decision.',

  // ── Newly VISIBLE 2026-07-21, not newly created ──────────────────────────
  // These three were always gaps. They were invisible because STAFF_ACTOR
  // wrongly claimed `accessed_user_id` / `target_user_id` name an operator; on
  // these tables they name the SUBJECT. See the STAFF_ACTOR docblock.
  admin_data_access_log:
    'TODO(RA10173-backlog): accessed_user_id is the SUBJECT (the account an admin viewed), not the operator. The export currently discloses the table’s existence in `not_included` and routes the subject to the DPO, because each row also names the admin who looked — the disclosure shape is pending DPO review.',
  admin_approval_requests:
    'TODO(RA10173-backlog): target_user_id is the SUBJECT the two-admin motion is ABOUT — a decision record concerning them, which they are entitled to know exists.',
  vendor_admin_motions:
    'TODO(RA10173-backlog): target_user_id is the SUBJECT the vendor motion is ABOUT — same reasoning as admin_approval_requests.',
  account_deletion_requests:
    'TODO(RA10173-backlog): the subject’s own erasure requests — arguably the most export-worthy audit trail we hold.',
  blocked_users: 'TODO(RA10173-backlog): the subject’s own block list — their stated preference.',
  chat_thread_reads: 'TODO(RA10173-backlog): read receipts — behavioural data about the subject.',
  chat_threads:
    'TODO(RA10173-backlog): thread metadata (counterparty, timestamps); message BODIES are already exported.',
  comp_grants: 'TODO(RA10173-backlog): comps issued to the subject — a commercial record about them.',
  coordinator_feature_recommendations:
    'TODO(RA10173-backlog): recommendations the subject authored as coordinator.',
  couple_event_type_notify_signups:
    'TODO(RA10173-backlog): the subject’s waitlist signup — a marketing-contact record.',
  couple_wedding_type_notify_signups:
    'TODO(RA10173-backlog): the subject’s waitlist signup — a marketing-contact record.',
  creator_applications: 'TODO(RA10173-backlog): the subject’s own creator-program application.',
  creator_chapters: 'TODO(RA10173-backlog): creator content the subject authored.',
  discount_code_eligible_users:
    'TODO(RA10173-backlog): targeting-list membership — the subject is the target.',
  discount_code_redemptions: 'TODO(RA10173-backlog): the subject’s own redemption history.',
  event_action_log:
    'TODO(RA10173-backlog): actor-stamped activity log — export shape pending (mixes several actors per event).',
  event_appointments: 'TODO(RA10173-backlog): appointments the subject booked or was booked into.',
  event_blocked_users: 'TODO(RA10173-backlog): per-event block entries naming the subject.',
  event_delegates: 'TODO(RA10173-backlog): delegate grants the subject holds or issued.',
  event_egift_methods: 'TODO(RA10173-backlog): the subject’s own e-gift payout handles (financial identifiers).',
  event_inspiration_assets: 'TODO(RA10173-backlog): uploads the subject contributed.',
  // Newly VISIBLE 2026-07-21 (second pass): both were suppressed by the blanket
  // `.*_by` alternative in the deleted STAFF_ACTOR_FK. Neither is an operator
  // stamp — both name the couple/host member who acted.
  event_journey_steps:
    'TODO(RA10173-backlog): completed_by is the couple/host member who completed a planning step — their own progress record, not a staff stamp.',
  event_preparation_items:
    'TODO(RA10173-backlog): created_by is the couple member who added a prep item (source_tag `couple_manual`) — their own to-do text.',
  event_manual_vendors: 'TODO(RA10173-backlog): vendor contact details the subject typed in themselves.',
  event_meaningful_dates: 'TODO(RA10173-backlog): personal dates the subject recorded.',
  event_moderators: 'TODO(RA10173-backlog): coordinator/moderator grants naming the subject.',
  event_playlist_picks: 'TODO(RA10173-backlog): music picks the subject made — taste data.',
  event_playlist_slot_vibes:
    'TODO(RA10173-backlog): the vibe the subject chose per moment — taste data, same class as event_playlist_picks above.',
  event_schedule_suggestions: 'TODO(RA10173-backlog): suggestions the subject authored.',
  event_sponsors: 'TODO(RA10173-backlog): sponsor rows naming the subject.',
  event_walkthrough_zones: 'TODO(RA10173-backlog): walkthrough notes the subject authored.',
  feature_reviews: 'TODO(RA10173-backlog): the subject’s own feature feedback.',
  force_majeure_flags: 'TODO(RA10173-backlog): flags raised by or about the subject.',
  founder_seats: 'TODO(RA10173-backlog): the subject’s founder-seat grant — an entitlement record.',
  founder_time_log: 'TODO(RA10173-backlog): the subject’s own logged hours.',
  guest_checkins: 'TODO(RA10173-backlog): the subject’s own check-in events (time + place).',
  guest_claims: 'TODO(RA10173-backlog): the subject’s claim of a guest identity.',
  guest_saved_vendors:
    'TODO(RA10173-backlog): the subject’s saved vendors — cross-event taste data (see the privacy memo on this table).',
  guest_souvenir_claims: 'TODO(RA10173-backlog): the subject’s souvenir claims.',
  guests:
    'TODO(RA10173-backlog): the guest row for the subject themselves — export shape pending (a guest row is also the HOST’s stored data about them).',
  help_messages: 'TODO(RA10173-backlog): support correspondence the subject wrote.',
  kwento_assignments: 'TODO(RA10173-backlog): assignments naming the subject.',
  lead_token_holds: 'TODO(RA10173-backlog): token holds tied to the subject’s vendor account.',
  manpower_gigs: 'TODO(RA10173-backlog): gigs the subject posted or accepted.',
  // ⚠ CORRECTED 2026-07-26. Previously said "staff-authored fields need
  // stripping first" — naming fields that do not exist. The richer shape was
  // declared by 20260628000000 and never landed (CREATE TABLE IF NOT EXISTS
  // no-opped); prod has no `verified_by_admin_id`, no `rejection_reason`, and
  // no `customer_user_id`. There is nothing staff-authored to strip, and the
  // row has no direct subject key — it reaches a person only via `event_id`.
  // See 20271011873973 and apps/web/tests/db/schema-drift.db.test.ts.
  manual_payment_logs:
    'TODO(RA10173-backlog): manual QR/bank payment rows for the subject’s events (reference_number + amount + status). Reachable only via event_id — there is no direct subject key and nothing staff-authored on the row.',
  notifications: 'TODO(RA10173-backlog): the subject’s notification history — a real omission.',
  panood_camera_operators: 'TODO(RA10173-backlog): operator assignments naming the subject.',
  paparazzi_seats: 'TODO(RA10173-backlog): seats claimed by the subject.',
  people: 'TODO(RA10173-backlog): person records the subject stewards — overlaps the alaga export; shape pending.',
  person_connections: 'TODO(RA10173-backlog): relationship edges the subject created.',
  person_stewardships: 'TODO(RA10173-backlog): stewardship grants held by the subject.',
  photo_delivery_jobs: 'TODO(RA10173-backlog): delivery jobs the subject requested.',
  push_subscriptions:
    'TODO(RA10173-backlog): the subject’s own push endpoints — export shape pending (device tokens are credentials, so metadata-only like face_enrollments).',
  receipts: 'TODO(RA10173-backlog): the subject’s BIR receipts — orders/payments ship, receipts do not.',
  referral_codes: 'TODO(RA10173-backlog): the subject’s own referral code.',
  referral_redemptions: 'TODO(RA10173-backlog): redemptions by or crediting the subject.',
  scan_events: 'TODO(RA10173-backlog): QR scans involving the subject — time + place behavioural data.',
  stewardship_transfers: 'TODO(RA10173-backlog): hand-over history involving the subject.',
  supplies_orders: 'TODO(RA10173-backlog): the subject’s own supplies orders.',
  thread_calls:
    'TODO(RA10173-backlog): call metadata (never content — calls are locked never-recorded); metadata is still personal data.',
  // ⚠ TABLE DROPPED 2026-08-01 (migration 20271028225106) with the per-USER
  // Setnayan AI path — owner: "it is per event". The entry STAYS because
  // lib/security/migration-schema.ts derives the schema from migration HISTORY
  // and does not parse DROP TABLE, so the historical CREATE still makes this
  // table visible to the classifier. Removing the line fails the "every
  // subject-bearing table is classified" gate. Several already-dropped tables
  // (patiktok_*, panood_roam_*, telemetry_events, creator_applications) sit in
  // these lists for the same reason; teaching the parser about DROP TABLE would
  // prune them all at once and is deliberately NOT bundled into this change.
  user_ai_subscription: 'TODO(RA10173-backlog): table DROPPED 2026-08-01 — nothing to export.',
  user_devices: 'TODO(RA10173-backlog): the subject’s devices — same credential caveat as push_subscriptions.',
  user_face_profiles:
    'TODO(RA10173-backlog): account-level face profile — must ship METADATA ONLY, mirroring guest_face_enrollments.',
  user_follows: 'TODO(RA10173-backlog): who the subject follows — social graph.',
  user_reports: 'TODO(RA10173-backlog): reports the subject FILED (reports filed ABOUT them are a separate call).',
  vendor_ad_subscriptions: 'TODO(RA10173-backlog): the subject’s vendor ad subscriptions.',
  vendor_change_orders: 'TODO(RA10173-backlog): change orders on the subject’s bookings.',
  proposal_amendments:
    'TODO(RA10173-backlog): bundled proposal amendments the subject raised or was sent (same class as vendor_change_orders).',
  vendor_client_notes:
    'TODO(RA10173-backlog): vendor-authored notes — must be AUTHOR-scoped for the same reason as working notes.',
  vendor_contract_signatures: 'TODO(RA10173-backlog): the subject’s own e-signatures (RA 8792 evidence).',
  vendor_contracts: 'TODO(RA10173-backlog): contracts the subject is a party to.',
  vendor_creator_offers: 'TODO(RA10173-backlog): offers the subject made or received.',
  vendor_date_waitlist: 'TODO(RA10173-backlog): waitlist entries naming the subject.',
  vendor_disputes: 'TODO(RA10173-backlog): disputes the subject raised (staff fields need stripping first).',
  vendor_event_access_grants: 'TODO(RA10173-backlog): access grants the subject issued or holds.',
  vendor_feature_recommendations: 'TODO(RA10173-backlog): recommendations the subject authored.',
  vendor_follows: 'TODO(RA10173-backlog): vendors the subject follows — taste data.',
  vendor_ig_connections: 'TODO(RA10173-backlog): the subject’s linked IG account (OAuth material needs stripping).',
  vendor_invites: 'TODO(RA10173-backlog): invites the subject sent or received.',
  vendor_lock_proposals: 'TODO(RA10173-backlog): proposals the subject authored.',
  vendor_meetings: 'TODO(RA10173-backlog): meetings the subject attended.',
  vendor_member_token_wallets: 'TODO(RA10173-backlog): the subject’s vendor token balance.',
  vendor_recommendations: 'TODO(RA10173-backlog): recommendations naming the subject.',
  vendor_release_history: 'TODO(RA10173-backlog): release actions the subject took.',
  vendor_review_appeals: 'TODO(RA10173-backlog): appeals the subject filed.',
  vendor_reviews: 'TODO(RA10173-backlog): reviews the subject wrote — clearly their own words.',
  vendor_subscriptions: 'TODO(RA10173-backlog): the subject’s vendor subscription history.',
  vendor_team_members: 'TODO(RA10173-backlog): team membership naming the subject.',
  vendor_token_purchases: 'TODO(RA10173-backlog): the subject’s token purchases — a commercial record.',
};

/**
 * Ratchet. This number may only ever go DOWN — every decrement is a table that
 * moved into the export (or was consciously reclassified as a deliberate
 * exclusion). Raising it means shipping a new RA 10173 gap, which must be an
 * explicit, argued decision, never a drive-by edit.
 *
 * 82 → 87 on 2026-07-21, in two argued steps. This is the ONE exception the
 * docblock above allows. No new gap was CREATED by either step; five
 * PRE-EXISTING gaps became countable for the first time:
 *
 *   82 → 85  Correcting the STAFF_ACTOR mistake (see its docblock) exposed
 *            admin_data_access_log, admin_approval_requests,
 *            vendor_admin_motions.
 *   85 → 87  Deleting STAFF_ACTOR_FK (see the isSubjectColumn docblock) exposed
 *            event_journey_steps, event_preparation_items.
 *
 * ⚠ FULL DISCLOSURE, because the first cut of this change got this wrong:
 * the ORIGINAL 82 → 85 raise was argued on the claim "no new gap was created",
 * and that claim was incomplete. In the same commit a parser rewrite silently
 * pushed `people` and `vendor_meetings` OUT of the enforced tier — they kept
 * counting toward the ceiling while no longer being guarded at all, and the
 * suite stayed green. Both are back in scope (parser fixed) and both are now
 * pinned by name in T7, with T10 asserting the whole class can never recur.
 *
 * The honest number went up because the measurement got honest, not because
 * coverage got worse. Refusing the raise would have meant keeping the heuristic
 * wrong to protect a number — precisely the false confidence this file exists
 * to prevent. Every future movement must be downward.
 *
 *   88 → 89  2026-07-26 · `event_paperwork`. Same shape as every raise above:
 *            the gap is not new, the VISIBILITY is. The table holds the
 *            subject's PSA / CENOMAR references and was never exported, but it
 *            is keyed by event_id and had no user column at all, so this
 *            detector was structurally incapable of counting it. Adding
 *            `subject_user_id` — for ERASURE, so one partner deleting their
 *            account would stop destroying the OTHER partner's civil-registry
 *            documents — is what made it countable. (`oauth_grants` became
 *            visible in the same migration and went to DELIBERATE_EXCLUSIONS
 *            instead: it is credential material.)
 *
 *            Worth stating plainly, because it is the reusable lesson: an
 *            attribution column improves BOTH sides at once. It let erasure
 *            stop over-deleting, and it dragged a silent export gap into the
 *            count. Tables with no user column are not clean; they are unread.
 */
// Raised 89 → 90 on 2026-07-30 for `event_playlist_slot_vibes` (Song Desk PR 4).
// Deliberate, not a rubber stamp: the vibe is taste data the subject chose, in the
// same class as `event_playlist_picks` directly above it in KNOWN_GAPS, so it gets
// the same honest "not yet decided" rather than an invented exclusion reason.
const KNOWN_GAP_CEILING = 90;

// ── Tests ────────────────────────────────────────────────────────────────────

test('fixture paths resolve (a moved file must fail loudly, not silently pass)', () => {
  assert.ok(fs.existsSync(MIGRATIONS), `migrations dir not found at ${MIGRATIONS}`);
  assert.ok(fs.existsSync(ROUTE), `export route not found at ${ROUTE}`);
});

test('T1 · every user-identifying table is classified', () => {
  const schema = readSchema();
  const routeSrc = fs.readFileSync(ROUTE, 'utf8');
  const exported = exportedTables(routeSrc);

  const unclassified = inScopeTables(schema).filter(
    (t) => !exported.has(t) && !(t in DELIBERATE_EXCLUSIONS) && !(t in KNOWN_GAPS),
  );

  assert.deepEqual(
    unclassified,
    [],
    `Unclassified user-identifying table(s): ${unclassified.join(', ')}\n` +
      'Each carries a subject-identifying *_user_id column, so the RA 10173 export must make a DECISION about it. Do one of:\n' +
      '  1. reference it from apps/web/app/api/profile/export/route.ts (preferred — and scope it to the AUTHOR/owner, not the event), or\n' +
      '  2. add a DELIBERATE_EXCLUSIONS entry here with a one-line reason why the account holder is not its data subject, or\n' +
      '  3. add a KNOWN_GAPS entry here (TODO(RA10173-backlog): …) and raise KNOWN_GAP_CEILING deliberately.',
  );
});

test('T2 · pinned gaps stay honest (a gap that got exported must be deleted)', () => {
  const exported = exportedTables(fs.readFileSync(ROUTE, 'utf8'));
  for (const table of Object.keys(KNOWN_GAPS)) {
    assert.ok(
      !exported.has(table),
      `${table} is now referenced by the export route but is still listed in KNOWN_GAPS. ` +
        'Delete its KNOWN_GAPS line and lower KNOWN_GAP_CEILING — the backlog must never rot into a rubber stamp.',
    );
  }
});

test('T3 · no stale map entries (every classified table still exists)', () => {
  const schema = readSchema();
  for (const table of [...Object.keys(DELIBERATE_EXCLUSIONS), ...Object.keys(KNOWN_GAPS)]) {
    assert.ok(
      schema.has(table),
      `${table} is classified here but no CREATE TABLE public.${table} exists in supabase/migrations. ` +
        'If the table was retired, delete its entry.',
    );
  }
});

test('T4 · backlog ratchet (KNOWN_GAPS may only shrink)', () => {
  assert.ok(
    Object.keys(KNOWN_GAPS).length <= KNOWN_GAP_CEILING,
    `KNOWN_GAPS has ${Object.keys(KNOWN_GAPS).length} entries, ceiling is ${KNOWN_GAP_CEILING}. ` +
      'This number may only ever go DOWN.',
  );
});

test('T5 · the two tables this PR fixed are exported (regression pin)', () => {
  const exported = exportedTables(fs.readFileSync(ROUTE, 'utf8'));
  assert.ok(exported.has('event_vendor_working_notes'), 'event_vendor_working_notes dropped from the export');
  assert.ok(exported.has('coordinator_broadcasts'), 'coordinator_broadcasts dropped from the export');
});

test('T7 · the heuristic sees subject columns that are not named *_user_id', () => {
  const inScope = new Set(inScopeTables(readSchema()));

  // FK-to-users under a different NAME. The export already reads this table,
  // so before the 2026-07-21 widening the guardrail was blind to a table it
  // was supposedly guarding — the clearest possible proof of under-detection.
  assert.ok(
    inScope.has('marketing_share_consents'),
    'marketing_share_consents.customer_id REFERENCES public.users(user_id) — a subject column under a non-standard name. ' +
      'If this is out of scope the FK detector regressed (likely: the parser went back to line-oriented, so the wrapped REFERENCES clause is invisible again).',
  );

  // Names STAFF_ACTOR wrongly claimed were operator stamps. On these tables the
  // subject IS the target — see the STAFF_ACTOR docblock.
  assert.ok(
    inScope.has('admin_data_access_log'),
    'admin_data_access_log.accessed_user_id is the account that was VIEWED — the subject, not the operator.',
  );
  assert.ok(
    inScope.has('admin_approval_requests'),
    'admin_approval_requests.target_user_id is the account the motion is ABOUT — the subject, not the operator.',
  );
  assert.ok(
    inScope.has('vendor_admin_motions'),
    'vendor_admin_motions.target_user_id is the account the motion is ABOUT — the subject, not the operator.',
  );

  // Columns the deleted STAFF_ACTOR_FK blanket-`.*_by` suppressed. Neither is
  // an operator stamp; both are the acting couple/host member.
  assert.ok(
    inScope.has('event_journey_steps'),
    'event_journey_steps.completed_by REFERENCES public.users(user_id) and names the couple member who completed the step. ' +
      'The table has NO *_user_id column, so if a name-based suppressor comes back it goes invisible, unexported and unclassified.',
  );
  assert.ok(
    inScope.has('event_preparation_items'),
    'event_preparation_items.created_by names the couple member who added the prep item — subject data, not a staff stamp.',
  );

  // Tables a whole-line `--` comment filter silently dropped out of the
  // enforced tier while the suite stayed green (see the readSchema docblock).
  // They are named individually because the failure was invisible in aggregate:
  // the in-scope COUNT went up while these two fell out.
  for (const t of ['people', 'vendor_meetings', 'person_connections']) {
    assert.ok(
      inScope.has(t),
      `${t} carries a *_user_id column and must be in the enforced tier. ` +
        'If it is not, the migration parser regressed — most likely a `--` comment is no longer being stripped to end of line, ' +
        'so a comma inside a trailing comment is splitting the column body.',
    );
  }

  // The complement still holds in its ONLY honest form. Operator-stamp tables
  // ARE in scope now (there is no FK suppressor left), but each must be
  // answered BY NAME rather than waved through by a pattern — otherwise the
  // widening degenerates into "every table" and the map becomes the rubber
  // stamp T1 exists to prevent.
  assert.ok(
    inScope.has('homepage_hero_config'),
    'homepage_hero_config.updated_by_admin_id FKs to public.users, so the heuristic must SEE it…',
  );
  assert.ok(
    'homepage_hero_config' in DELIBERATE_EXCLUSIONS,
    '…and it must be answered by an explicit named reason (an operator stamp on Setnayan’s own marketing config), never by a regex.',
  );
});

test('T10 · every classified table is still IN SCOPE (a narrowing heuristic must fail loudly)', () => {
  // The reverse of T3. T3 catches "classified but the table is gone"; nothing
  // caught "classified but the DETECTOR stopped seeing it" — which is how the
  // first cut of this change de-enforced `people` and `vendor_meetings` while
  // they kept counting toward KNOWN_GAP_CEILING. A guardrail that silently
  // under-detects is worse than no guardrail; this is the assertion that makes
  // that specific failure mode impossible to ship green.
  const inScope = new Set(inScopeTables(readSchema()));
  const missing = [...Object.keys(DELIBERATE_EXCLUSIONS), ...Object.keys(KNOWN_GAPS)].filter(
    (t) => !inScope.has(t),
  );
  assert.deepEqual(
    missing,
    [],
    `Classified here but NO LONGER detected as user-identifying: ${missing.join(', ')}.\n` +
      'The subject-column heuristic narrowed. These tables are now unguarded while still counting toward ' +
      'KNOWN_GAP_CEILING — i.e. the number says "guarded" and the code says nothing. Fix the detector, do not delete the entries.',
  );
});

test('T11 · the three identity-scoped reads use the PRIVILEGED client, not the session client', () => {
  const src = fs.readFileSync(ROUTE, 'utf8');
  // THE load-bearing assertion for this whole fix, and it is here because
  // mutation testing proved its absence: reverting both reads to the RLS
  // session client — i.e. restoring the exact bug — left 19/19 green.
  //
  // Neither table grants an author/sender SELECT policy, so a departed
  // coordinator (removeHost stamps event_moderators.removed_at AND deletes the
  // event_members row) reads ZERO rows through the session client and receives
  // a subject-access file asserting they wrote nothing.
  // `vendor_profiles` joined this set on 2026-07-27 for a DIFFERENT reason than
  // the two coordinator tables, and the difference is worth stating so nobody
  // "simplifies" it back: those two have no author SELECT policy, so RLS filters
  // the subject's own rows to zero. vendor_profiles has a working owner policy —
  // what breaks it is COLUMN privilege. Once `SELECT (tin_number, …)` is revoked
  // from `authenticated` (the whole point of the follow-up PR), the owner's own
  // read 42501s and PostgREST drops the ENTIRE row, not the one column. Same
  // outcome as the coordinator bug — the subject's own record missing from the
  // subject's own export — reached by a different mechanism.
  for (const [table, col] of [
    ['event_vendor_working_notes', 'author_user_id'],
    ['coordinator_broadcasts', 'sender_user_id'],
    ['vendor_profiles', 'user_id'],
  ] as const) {
    assert.match(
      src,
      new RegExp(`admin\\s*\\n?\\s*\\.from\\(\\s*'${table}'\\s*\\)`),
      `${table} must be read from the SERVICE-ROLE client (\`admin\`) — otherwise the subject's own ` +
        'rows are filtered or refused on their own subject-access request (no author SELECT policy for the ' +
        'coordinator tables; a column-level REVOKE for vendor_profiles), and they receive a false empty.',
    );
    assert.doesNotMatch(
      src,
      new RegExp(`supabase\\s*\\n?\\s*\\.from\\(\\s*'${table}'\\s*\\)`),
      `${table} must NOT be read from the RLS session client — that is the exact bug this PR fixed.`,
    );
    // The bypass is only bounded while the filter is the author column itself.
    assert.match(
      src,
      new RegExp(`'${table}'[\\s\\S]{0,400}?\\.eq\\(\\s*'${col}'\\s*,\\s*user\\.id\\s*\\)`),
      `${table} must be filtered by .eq('${col}', user.id) — a server-verified session identity, never request input.`,
    );
  }

  // And the privileged client must be gated on the SERVICE-ROLE KEY, not on
  // createAdminClient() throwing: lib/supabase/admin.ts falls back to the ANON
  // key under NODE_ENV==='development', so construction succeeds, the read runs
  // unauthenticated, RLS returns 0 rows with error null, and export_complete
  // ships TRUE. That is the silent empty, resurrected in dev.
  assert.match(
    src,
    /process\.env\.SUPABASE_SERVICE_ROLE_KEY/,
    'The route must gate the privileged read on SUPABASE_SERVICE_ROLE_KEY being present. ' +
      'A try/catch around createAdminClient() is NOT enough — the dev-only anon-key fallback in lib/supabase/admin.ts never throws.',
  );
});

test('T12 · the vendor_profiles export projection is COMPLETE (no column silently drops out)', () => {
  // WHY THIS TEST IS THE POINT OF THE CHANGE IT GUARDS.
  //
  // Replacing `select('*')` with a named list buys a column-level revoke on
  // vendor_profiles, and costs a new failure mode that the wildcard could not
  // have: UNDER-EXPORT. A wildcard cannot forget a column. A hand-written list
  // can, and the omission is invisible in every way that normally catches
  // things — the route still returns 200, the section still looks populated,
  // typecheck is silent (a PostgREST select list is a string), and the phantom-
  // column scanner only looks for the OPPOSITE error (a column that does not
  // exist). The data subject receives a file that is quietly missing their
  // registered business address, and nobody finds out.
  //
  // So the projection is not trusted; it is DERIVED-CHECKED. The assertion is
  // an equality, deliberately, not a subset check in either direction:
  //   • schema \ (projection ∪ omitted) → UNDER-EXPORT, an incomplete legal
  //     disclosure. This is the one that motivated the test.
  //   • projection \ schema → a phantom column. PostgREST 42501/42703s the
  //     WHOLE statement on one bad name, so this would delete the entire
  //     vendor_profile section rather than one field.
  //   • omitted \ schema → a stale withholding decision pointing at a column
  //     that no longer exists, i.e. a reason nobody has re-read.
  //
  // Same `readSchema()` the rest of this file uses, so its honesty notes apply
  // verbatim: a column added inside a DO block or applied straight to prod is
  // invisible here. Mitigated once by hand — the migration-derived set was
  // diffed against production `information_schema.columns` on 2026-07-27 and
  // matched exactly, 93 for 93.
  const table = readSchema().get('vendor_profiles');
  assert.ok(
    table,
    'No CREATE TABLE public.vendor_profiles found in supabase/migrations — the parser regressed, ' +
      'and with it every assertion below (an empty schema would make this test vacuously green).',
  );

  const omitted = Object.keys(VENDOR_PROFILE_EXPORT_OMITTED);
  const projected = new Set(VENDOR_PROFILE_EXPORT_COLUMNS);

  // Anti-vacuity. If the projection were emptied, or the parser started
  // returning a handful of columns, the set arithmetic below could still be
  // made to pass by a matching mistake on the other side.
  assert.ok(
    table.cols.size > 80,
    `readSchema() sees only ${table.cols.size} columns on vendor_profiles; production had 93 on 2026-07-27. ` +
      'The parser has narrowed — fix it rather than lowering this floor.',
  );
  assert.equal(
    projected.size,
    VENDOR_PROFILE_EXPORT_COLUMNS.length,
    'The projection names the same column twice. It is derived by splitting VENDOR_PROFILE_EXPORT_SELECT, ' +
      'so a duplicate means the string itself repeats a name.',
  );

  const missing = [...table.cols].filter((c) => !projected.has(c) && !omitted.includes(c)).sort();
  assert.deepEqual(
    missing,
    [],
    `UNDER-EXPORT: vendor_profiles column(s) reach no data subject: ${missing.join(', ')}.\n` +
      'A column exists on the table but is neither in the export projection nor deliberately withheld. ' +
      'Under RA 10173 that is an incomplete subject-access response, not a style issue. Do one of:\n' +
      '  1. add it to VENDOR_PROFILE_EXPORT_SELECT in lib/export-vendor-profile-columns.ts (preferred), or\n' +
      '  2. add a VENDOR_PROFILE_EXPORT_OMITTED entry there with the reason it is withheld from the ' +
      'subject — and expect that reason to be read by the DPO, not by a linter.',
  );

  const phantom = [...projected].filter((c) => !table.cols.has(c)).sort();
  assert.deepEqual(
    phantom,
    [],
    `Projected column(s) no migration declares on vendor_profiles: ${phantom.join(', ')}.\n` +
      'PostgREST fails the WHOLE select on one unknown column, so this does not lose a field — it loses ' +
      'the entire vendor_profile section of every vendor’s export.',
  );

  const staleOmissions = omitted.filter((c) => !table.cols.has(c)).sort();
  assert.deepEqual(
    staleOmissions,
    [],
    `VENDOR_PROFILE_EXPORT_OMITTED names column(s) that no longer exist: ${staleOmissions.join(', ')}. ` +
      'Delete the entries — a withholding decision about a dropped column is a reason nobody has re-read.',
  );

  for (const [col, reason] of Object.entries(VENDOR_PROFILE_EXPORT_OMITTED)) {
    assert.ok(
      reason.trim().length > 20,
      `VENDOR_PROFILE_EXPORT_OMITTED.${col} needs a real reason, not a placeholder. ` +
        'Withholding a column from a subject-access response is a decision someone must defend.',
    );
  }
});

test('T13 · a privileged read that could not run is DISCLOSED, never rendered as an empty', () => {
  const src = fs.readFileSync(ROUTE, 'utf8');
  // The `admin === null` path (no SUPABASE_SERVICE_ROLE_KEY) is not an error —
  // it is the route declining to take a read it cannot take honestly. Every
  // section behind that client must therefore pass `adminUnavailable` into its
  // outcome helper, or it ships `[]` / `null` under `export_complete: true`:
  // the exact false statement of fact this route exists to prevent, just
  // relocated. vendor_profile is the newest such section and the easiest to
  // miss, because unlike the other two it reads as an ordinary owner query.
  assert.match(
    src,
    /singleOutcome<[\s\S]{0,300}?>\(\s*'vendor_profile'\s*,\s*vendorProfileRes\s*,\s*adminUnavailable\s*\)/,
    "The vendor_profile section must be unwrapped as singleOutcome('vendor_profile', vendorProfileRes, " +
      "adminUnavailable). Without the third argument a run with no service key reports `vendor_profile: null` " +
      'with export_complete TRUE — telling a vendor in writing that Setnayan holds no business record for them.',
  );
  // The two media sections hang off the profile row, so they go empty with it.
  assert.match(
    src,
    /vendorMediaIncomplete\s*=\s*listOutcome\(/,
    'When the vendor_profile read is not taken, vendor_portfolio_media and vendor_submitted_media resolve to ' +
      '[] with nothing said — the same silent empty one level down. They must be named as NOT READ too.',
  );
});

test('T8 · the false not_included claim about the access log stays corrected', () => {
  const src = fs.readFileSync(ROUTE, 'utf8');
  // The route asserted "no user-scoped access-log table in V1" while
  // supabase/migrations/20270212405352 creates admin_data_access_log with an
  // accessed_user_id column and an index its own comment labels
  // "(subject-access)". Telling a data subject a false fact about what we hold
  // is the same category of harm as the silent empty this PR fixes.
  assert.doesNotMatch(
    src,
    /no user-scoped access-log table/,
    'The export must not claim there is no user-scoped access-log table — admin_data_access_log is one.',
  );
  assert.match(
    src,
    /admin_data_access_log/,
    'The export must name admin_data_access_log in not_included so the subject knows it exists and can request it.',
  );
});

test('T9 · no read on the export route is unwrapped with a bare `?? []`', () => {
  const src = fs.readFileSync(ROUTE, 'utf8');
  // `res.data ?? []` is exactly how the silent empty got shipped: a failed read
  // and a genuinely empty one become the same JSON. Every read now goes through
  // lib/export-integrity, which names failures in `not_included`.
  //
  // Matched broadly, NOT via the `*Res` naming convention: the route's own
  // original offender was `mediaRows ?? []`, which a `\w+Res` regex could never
  // have caught, and any rename would defeat it. One legitimate non-read
  // default is allowlisted by its exact text.
  const ALLOWED_EMPTY_ARRAY_DEFAULTS = [
    // A column default on an already-unwrapped row, not a read unwrap.
    'vp.portfolio_r2_keys ?? []',
  ];
  // Comments are stripped first — this file and the route BOTH discuss `?? []`
  // in prose, and a prose mention is not a defect.
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');
  const offenders = [...code.matchAll(/[^\n]*\?\?\s*\[\]/g)]
    .map((m) => m[0].trim())
    .filter((line) => !ALLOWED_EMPTY_ARRAY_DEFAULTS.some((ok) => line.includes(ok)));
  assert.deepEqual(
    offenders,
    [],
    `Bare \`?? []\` unwrap(s) reintroduced on the export route: ${offenders.join(' | ')}. ` +
      'Use listOutcome()/singleOutcome() from lib/export-integrity so a failed read is DISCLOSED, not silently rendered as "you have no such records".',
  );
  // Match the FIELD, not the bare identifier: `export_complete` also appears in
  // three comments on this route, so a bare-identifier match survived deleting
  // the actual field (mutation-tested).
  assert.match(
    src,
    /export_complete:\s*incompleteSections\.length === 0/,
    'the export must carry a machine-readable completeness flag computed from the failed-section list',
  );
});

test('T6 · the privileged reads stay IDENTITY-scoped, never event- or profile-scoped', () => {
  const src = fs.readFileSync(ROUTE, 'utf8');
  // Coarse but real: a refactor that flips either filter to .eq('event_id', …)
  // would leak a third party's prose into a subject-access file — private
  // coordinator notes the couple cannot even read, and broadcasts every event
  // member receives but only one person wrote.
  assert.match(
    src,
    /event_vendor_working_notes[\s\S]{0,400}?author_user_id/,
    'event_vendor_working_notes must be filtered by author_user_id, not by event_id.',
  );
  assert.match(
    src,
    /coordinator_broadcasts[\s\S]{0,400}?sender_user_id/,
    'coordinator_broadcasts must be filtered by sender_user_id, not by event_id.',
  );
  // vendor_profiles (2026-07-27). The tempting refactor here is not event_id —
  // it is `.eq('vendor_profile_id', …)` resolved from somewhere else, which
  // behind the service-role client would hand one vendor another vendor's BIR
  // tax identity. The uid filter is the only thing making this read
  // self-scoped now that RLS is no longer in the path.
  assert.match(
    src,
    /'vendor_profiles'[\s\S]{0,400}?\.eq\(\s*'user_id'\s*,\s*user\.id\s*\)/,
    "vendor_profiles must be filtered by .eq('user_id', user.id). It is read service-role, so RLS is NOT " +
      'a second line of defence here — the filter is the only bound on the row set.',
  );
});
