/**
 * RA 10173 right-to-ERASURE coverage guardrail.
 *
 * Sibling of `lib/export-coverage-guardrail.test.ts` (subject ACCESS) and built
 * on the same extracted parser (`lib/security/migration-schema.ts`). Export had
 * a guardrail; erasure had none — which is why erasure drifted from the schema
 * in both directions and nobody noticed.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS CATCHES — and, more importantly, WHAT IT DOES NOT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * CATCHES (each maps to a real defect this PR fixed):
 *
 *   G1 · PHANTOM COLUMN. Every column name erasure writes must exist on that
 *        table in the migration corpus. `events.owner_email` and
 *        `events.owner_display_name` never existed — they are output aliases of
 *        the admin-intelligence VIEW in 20261202001000 — and because PostgREST
 *        rejects the WHOLE statement on one unknown key (PGRST204), the entire
 *        owned-event purge failed in production from the day they were added.
 *        Nobody saw it: the best-effort design (correctly) logged
 *        `erasure_purge_failed` and carried on. This test is the reason that
 *        cannot recur, and it is the single highest-value assertion in the file.
 *
 *   G2 · PHANTOM FILTER. Same, for the columns row-deletes filter on.
 *
 *   G3 · UNDECIDED NEW TABLE. Every table carrying a subject-identifying column
 *        must sit in exactly one of four buckets. A NEW table lands in none and
 *        CI goes red — the silent default ("new table = never erased") is gone.
 *
 *   G4 · PARSER NARROWING. Every classified table must still be SEEN by the
 *        parser, so a future tightening of the regex fails loudly instead of
 *        silently shrinking the guarded set.
 *
 * DOES NOT CATCH — read this before trusting a green run:
 *
 *   1. It cannot tell whether a purge is CORRECT, only whether its column names
 *      are real. `.update({ tin_number: null }).eq('user_id', x)` and the same
 *      statement with the wrong filter both pass here. Scoping is proved by
 *      `tests/db/erasure-completeness.db.test.ts`, which runs the real purge
 *      against the real replayed schema, and nowhere else.
 *   2. It only sees columns written through the constants in
 *      `lib/erasure/coverage.ts`. A key typed inline into a `.update({ … })`
 *      literal in `purge.ts` is INVISIBLE here — the db test is the backstop.
 *   3. ⚠ THE ENFORCED TIER IS NOT A SUPERSET OF WHAT ERASURE MUST COVER.
 *      Eight tables this purge reaches carry NO subject column at all and are
 *      therefore invisible to the detector: guest_face_enrollments,
 *      vendor_push_tokens, vendor_verification_applications,
 *      couple_waitlist_signups and the four *_oauth_state tables. They are keyed
 *      by event_id / vendor_profile_id / guest_id / email. So a future table
 *      shaped like the old `oauth_grants` — personal data hung off an event with
 *      no user FK — will NOT be flagged by G3. That is the residual blind spot,
 *      it is structural, and no amount of regex fixes it.
 *      `PURGED_WITHOUT_SUBJECT_COLUMN` below pins the ones we know about so at
 *      least the count stays visible.
 *
 *      ⚠ The proof that this blind spot is not academic:
 *      `vendor_verification_applications` — the vendor's GOVERNMENT ID, DTI/SEC
 *      certificate and BIR 2303 in a private R2 bucket — had NO erasure code at
 *      all until 2026-07-26, and this guardrail could never have said so. Its
 *      one `*_user_id` column is `admin_user_id`, a STAFF actor the detector
 *      deliberately ignores. It was found by reading, not by CI.
 *
 *      ⚠ Moving the other way, same date: `event_paperwork` and `oauth_grants`
 *      LEFT this list. They gained `subject_user_id` / `granted_by_user_id`
 *      (migration 20271009200000) so the purge could scope per-partner instead
 *      of event-wide, and the side effect is that the detector can now see them.
 *      Attribution columns shrink the blind spot as well as preventing
 *      over-deletion — worth knowing next time a table lands in this list.
 *   4. The parser's own limits (DO blocks, dynamic SQL, non-public schemas,
 *      changes applied straight to prod) are inherited verbatim — see
 *      `lib/security/migration-schema.ts`.
 *   5. `UNDECIDED_BACKLOG` is NOT a clean bill of health. It is 82 tables that
 *      pre-date this guardrail and have had NO erasure decision made about them.
 *      The ratchet (G5) only guarantees the number never goes UP.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readSchema, type TableSchema } from '../security/migration-schema';
import {
  ERASURE_COLUMN_WRITES,
  ERASURE_FILTER_COLUMNS,
  ERASURE_ROW_DELETES,
  WIZARD_STATE_ALLOWED_KEYS,
} from './coverage';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // apps/web/lib/erasure
const WIZARD_LIB = path.resolve(HERE, '..', 'wizard.ts');

// Same two detectors as the export guardrail. Kept as literal copies rather than
// exported from there, because the two guardrails are allowed to disagree about
// WHO the subject is (an operator stamp is not subject data for export, but a
// staff member erasing their own account still owns their operator rows) — and a
// shared regex would hide that disagreement instead of surfacing it. If they
// ever need to diverge, the divergence should be visible here.
const SUBJECT_COL = /^([a-z0-9_]*_)?user_id$/;
const STAFF_ACTOR =
  /^(admin_user_id|reviewed_by_user_id|approved_by_user_id|decided_by_user_id|handled_by_user_id|moderated_by_user_id|resolved_by_user_id|actor_user_id)$/;

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

/** DERIVED from the erasure surface, never hand-written. */
const PURGED: ReadonlySet<string> = new Set([
  ...Object.keys(ERASURE_COLUMN_WRITES),
  ...Object.keys(ERASURE_ROW_DELETES),
]);

/**
 * Tables erasure reaches that the subject-column detector CANNOT SEE — they have
 * no `*_user_id` column and no inline FK to public.users. Pinned so the size of
 * the blind spot in note 3 above stays honest and countable.
 */
const PURGED_WITHOUT_SUBJECT_COLUMN: ReadonlySet<string> = new Set([
  'guest_face_enrollments', // keyed by (event_id, guest_id)
  'vendor_push_tokens', // keyed by vendor_profile_id
  // Keyed by vendor_profile_id. Its ONLY *_user_id column is `admin_user_id` —
  // the reviewing staff member, which the detector correctly treats as a staff
  // actor and skips. So the table holding vendors' government IDs / DTI / BIR
  // 2303 in the private setnayan-vendor-verification bucket was invisible here
  // for its entire uncovered life. Purged as of 2026-07-26
  // (purgeVendorVerificationDocuments); pinned so the blind spot stays counted.
  'vendor_verification_applications',
  'couple_waitlist_signups', // keyed by email only — no FK at all
  'oauth_state',
  'vendor_ig_oauth_state',
  'patiktok_oauth_state',
  'live_studio_channel_oauth_state',
  // ⚠ REMOVED 2026-07-26: `event_paperwork` and `oauth_grants`. Migration
  // 20271009200000 gave them `subject_user_id` / `granted_by_user_id` so the
  // purge could stop deleting event-wide, and that makes them visible to the
  // detector — they are now in the ENFORCED tier, not this one.
]);

/**
 * Tables THIS PR considered and deliberately did NOT purge, one reason each.
 * These are answers, not debt. Anything not reasoned about here belongs in
 * UNDECIDED_BACKLOG instead — a fabricated reason would be worse than an honest
 * "not looked at yet".
 */
const DELIBERATE_EXCLUSIONS: Record<string, string> = {
  // ── lawful retention: financial + BIR records ──
  orders: 'Financial record retained under the BIR/bookkeeping basis (0026). The personal data on it is the transaction, not the profile.',
  payments: 'Financial record — retained with the order it settles.',
  receipts: 'BIR Official Receipt. issued_to_name/email/tin are the statutory content of the document; erasing them destroys the receipt.',
  order_refunds: 'Reconciliation decision attached to a retained financial record.',
  supplies_orders: 'Purchase record; delivery_address is part of the fulfilment evidence.',
  // ⚠ CORRECTED 2026-07-26. This previously read "the audit trail behind a
  // retained payment" — describing a table that does not exist. The richer
  // shape was declared by 20260628000000 but never landed (CREATE TABLE IF NOT
  // EXISTS no-opped against an out-of-band table); prod has SEVEN columns and
  // none of them is `verified_at`, `verified_by_admin_id`, `rejection_reason`
  // or `customer_user_id`. So there is no reconciliation trail to retain, and
  // no direct subject key on the row at all — it links to a person only
  // indirectly, through `event_id`. Retention basis restated to match the
  // columns that are actually there. See 20271011873973 and
  // apps/web/tests/db/schema-drift.db.test.ts.
  manual_payment_logs: 'Financial record for the manual QR/bank rail: reference_number + amount_php + payment_status against an event_id. No direct subject key (attribution is via event_id) and no staff-authored fields — the reconciliation trail the old note claimed was never built.',
  vendor_2307_filings: 'BIR Form 2307 artifact — a statutory filing.',
  vendor_token_purchases: 'Financial record (token pack purchase).',
  comp_grants: 'Comp/discount grant — the money-side record of a waived charge.',
  discount_code_redemptions: 'Redemption record attached to a retained order.',
  user_ai_subscription: 'Subscription/entitlement record with a billing history behind it.',
  vendor_subscriptions: 'Subscription billing record.',
  vendor_ad_subscriptions: 'Subscription billing record.',

  // ── lawful retention: contracts under RA 8792 ──
  vendor_contracts: 'Executed contract — retained for the limitation period.',
  vendor_contract_signatures:
    'E-signature evidence under RA 8792 (signer name + IP + signature image). Erasing it voids the contract’s enforceability. ⚠ Flagged to the DPO: a signature image + IP is a heavier retention than a receipt and may warrant a shorter period.',

  // ── accountability: audit trails ──
  admin_data_access_log: 'Record of ADMIN access to an account. Erasing the subject id destroys the accountability trail that protects that same subject.',
  admin_approval_requests: 'Two-admin governance record.',
  event_action_log: 'Per-event action trail used for dispute resolution.',
  account_deletion_requests:
    'The erasure REQUEST itself. Deleting it would erase the evidence that erasure was asked for and fulfilled — and this is also where a failed erasure is discoverable.',

  // ── anti-abuse: disclosure or deletion defeats detection ──
  blacklisted_emails: 'Anti-abuse block-list — deleting the row re-opens signup to the blocked address (and `blacklistUser` writes it deliberately, at erasure time).',
  concierge_abuse_flags: 'Anti-abuse investigation record (NPC investigation carve-out).',
  chat_message_flags: 'Anti-abuse enforcement record — metadata only, never message text.',
  fraud_signals: 'Fraud-detection signal; deleting it on request makes the control trivially defeatable.',
  integrity_flags: 'Price-under-declaration integrity signal.',
  user_reports: 'Safety report — may have been filed BY or ABOUT the subject; deleting either side harms the other party.',
  vendor_image_flags: 'Content-moderation record.',
  vendor_qr_media_flags: 'Content-moderation record.',

  // ── retention review already open, do not pre-empt ──
  user_devices:
    'Device-fingerprint rows feed the fraud identity graph. `Device_Fingerprint_Data_Use_DPO_Review_2026-07-12.md` is open on exactly this; erasure must not settle it unilaterally. ⚠ Note the existing half-and-half: erasure DOES null users.address_normalized, another fraud-graph input.',

  // ── consent receipts: the proof that consent was given ──
  marketing_share_consents: 'Consent receipt — the artifact proving lawful basis. Erasing it erases the proof.',
  coordinator_access_consents: 'Consent receipt for coordinator access to the event.',

  // ── shared records: the own-vs-shared line (DPO questions in the PR) ──
  chat_threads: 'The conversation container is shared with the vendor and co-partner; only the subject’s own MESSAGES are deleted.',
  event_members: 'Membership is the event’s record of who was on it — and erasure’s own lookups resolve through it.',
  event_manual_vendors: 'Third-party contact PII the subject entered ABOUT someone else — excluded by the same rule as event_vendors.',
  event_sponsors: 'Third-party PII (sponsor name/email/phone) the subject entered about others.',

  // ── the uid is a staff actor, not the subject ──
  vendor_verifications: 'Admin decision record — the uid on it is the reviewing staff member.',
};

/**
 * Tables erasure purges IN PART, where the remainder is a deliberate deferral
 * rather than an oversight. A third state is needed because the own-vs-shared
 * line runs THROUGH these tables, not between them — the whole point of the
 * design is that a row can be half the subject's and half somebody else's.
 * Being in PURGED alone would over-claim; being in DELIBERATE_EXCLUSIONS alone
 * would under-claim.
 */
const PARTIALLY_PURGED: Record<string, string> = {
  events:
    'PURGED: birth/consent data, the photo-delivery account + credential, and the wizard_state personal payload. DEFERRED: bride/groom names, venue, and ~20 jointly-authored jsonb blobs (love_story, our_photos, std_media, reception_design …) — the shared-record DPO question.',
  guests:
    'PURGED: the subject’s face enrolments, the R2 selfies behind them, and their selfie display photo. DEFERRED: first/last name, email, mobile, address on the same rows — that row is also the host’s record of their invitee.',
  chat_messages:
    'PURGED: every message the subject AUTHORED, plus the R2 attachment objects behind them. DEFERRED: the counterparty’s messages and the thread itself — the shared conversation.',
  vendor_profiles:
    'PURGED: all contact/identity/registration PII + unpublished from the marketplace. DEFERRED: the profile SHELL, kept for vendor-team continuity (a shop can have staff who are not the erased owner).',
  event_moderators:
    'PURGED: the subject’s own invitation email/phone/token. DEFERRED: rows where the subject was the INVITER — third-party PII about someone else — and display_label, the host’s record of who their coordinator was.',
  scan_events:
    'PURGED: scanner_user_id, user_agent, ip_anon. DEFERRED: the scan row itself, which is the host’s per-guest attendance record.',
  people:
    'PURGED: the subject’s claimed identity node (7 PII columns + deleted_at). DEFERRED: claimed_by_user_id, retained on purpose so the biometric purge can still resolve through the person spine, and nodes the subject CREATED for third parties.',
  event_paperwork:
    'PURGED: tracking_reference, document_r2_key, notes — but ONLY on rows with subject_user_id = the leaver (owner ruling 2026-07-26). DEFERRED, fail-closed: every row with a NULL subject, which today is ALL of them (nothing populates the column yet, and no user↔partner-slot mapping exists to populate it honestly). Destroying the co-partner’s PSA/CENOMAR scan is the worse failure; the retained rows are audit-logged as erasure_unattributed_retained.',
  oauth_grants:
    'PURGED: grants with granted_by_user_id = the leaver, deleted whole (a live credential must not outlive the account). DEFERRED, fail-closed: NULL-attributed grants — the connected Google/YouTube account may be the co-partner’s. Also DEFERRED: calling the provider’s own revoke endpoint (a DPO question, see the PR).',
  vendor_verification_applications:
    'PURGED: doc_uploads (the R2 objects behind the government ID / DTI / BIR 2303 / Mayor’s Permit, plus the JSONB refs) and the docs_complete derivative. DEFERRED: the row itself and its decision fields (admin_user_id, decision, decision_reason, decided_at) — the admin verification accountability trail, excluded by the same rule as vendor_verifications.',
};

/**
 * Real shortfalls, pinned and greppable (`TODO(RA10173-erasure):`) so they stay
 * countable rather than dissolving into the backlog.
 */
const KNOWN_GAPS: Record<string, string> = {
  // TODO(RA10173-erasure): auth.identities.identity_data survives erasure.
  // Not a public table, so the detector never sees it — listed by hand.
  // Each linked provider (email/google/facebook/apple) keeps a copy of the full
  // name, email, avatar URL and provider subject id. `updateUserById` scrubs the
  // email and (as of this PR) user_metadata, but does not touch identities, and
  // no auth.users DELETE is ever issued so the CASCADE never fires. The fix
  // needs either a verified `auth.admin.deleteIdentity` on the pinned
  // supabase-js version or a SECURITY DEFINER helper over the auth schema —
  // deliberately NOT attempted in this PR.
  'auth.identities':
    'Per-provider copy of name/email/avatar/subject-id. Needs a verified identity-delete API or an auth-schema helper; out of scope here.',
};

/**
 * ⚠ NOT A CLEAN BILL OF HEALTH — the opposite.
 *
 * 82 subject-bearing tables that pre-date this guardrail and about which NO
 * erasure decision has been made. Frozen as a RATCHET: G5 asserts the count can
 * only go DOWN. New tables cannot join it (they fail G3 until classified), and
 * every entry moved into PURGED or DELIBERATE_EXCLUSIONS shrinks it.
 *
 * Why a ratchet instead of 82 reasons written today: the export guardrail's own
 * docblock names the failure mode — "a ~200-entry allowlist nobody reads, i.e.
 * exactly the rubber stamp this test exists to prevent". Eighty-two reasons
 * invented in one sitting would be that. An honest "not yet decided", counted
 * and unable to grow, is worth more than eighty-two sentences nobody trusts.
 */
const UNDECIDED_BACKLOG: readonly string[] = [
  'blocked_users', 'community_members', 'concierge_brain_chunks', 'concierge_plan_templates',
  'concierge_response_cache', 'coordinator_broadcasts', 'coordinator_feature_recommendations',
  'creator_applications', 'creator_chapters', 'discount_code_eligible_users', 'discount_codes',
  'editorial_vendor_media', 'event_appointments', 'event_blocked_users', 'event_delegates',
  'event_egift_methods', 'event_feature_policy_override', 'event_inspiration_assets',
  'event_journey_steps', 'event_meaningful_dates', 'event_playlist_picks',
  'event_preparation_items', 'event_schedule_suggestions', 'event_vendor_working_notes',
  'event_walkthrough_zones', 'feature_policy', 'feature_reviews', 'force_majeure_flags',
  'founder_seats', 'founder_time_log', 'guest_checkins', 'guest_souvenir_claims',
  'homepage_background_videos', 'homepage_hero_config', 'kwento_assignments', 'lead_token_holds',
  'manpower_gigs', 'moodboard_library_assets', 'owner_alerts', 'panood_camera_operators',
  'paparazzi_seats', 'person_connections', 'person_stewardships', 'photo_delivery_jobs',
  'platform_compliance_facts', 'platform_expenses', 'platform_settings', 'promo_free_windows',
  'proposal_amendments', 'referral_codes', 'referral_redemptions', 'reveal_studio_config',
  'setnayan_pay_methods', 'site_widgets', 'social_posts', 'stewardship_transfers', 'thread_calls',
  'vendor_admin_motion_votes', 'vendor_admin_motions', 'vendor_change_orders',
  'vendor_client_notes', 'vendor_correction_requests', 'vendor_creator_offers',
  'vendor_date_waitlist', 'vendor_disputes', 'vendor_event_access_grants',
  'vendor_feature_recommendations', 'vendor_ig_connections', 'vendor_invites',
  'vendor_lock_proposals', 'vendor_locked_qr_tokens', 'vendor_meetings',
  'vendor_member_token_wallets', 'vendor_recommendations', 'vendor_release_history',
  'vendor_review_appeals', 'vendor_reviews', 'vendor_self_comp_caps', 'vendor_team_members',
  'vendor_web_dossiers',
];

/** Ratchet high-water mark. May be LOWERED, never raised. */
const BACKLOG_HIGH_WATER = 82;

// ─────────────────────────────────────────────────────────────────────────────

test('G0 · the parser sees a real corpus (guards against an empty-schema pass)', () => {
  const schema = readSchema();
  assert.ok(schema.size > 300, `expected >300 parsed tables, got ${schema.size}`);
  // A vacuous readSchema() would make every other test in this file trivially
  // green, so pin the two tables the erasure path cares about most.
  assert.ok(schema.get('events')?.cols.has('wizard_state'), 'events.wizard_state not parsed');
  assert.ok(schema.get('users')?.cols.has('deleted_at'), 'users.deleted_at not parsed');
});

test('G1 · every column erasure WRITES exists on that table', () => {
  const schema = readSchema();
  const missing: string[] = [];
  for (const [table, cols] of Object.entries(ERASURE_COLUMN_WRITES)) {
    const entry = schema.get(table);
    if (!entry) {
      missing.push(`${table} (table not found in migrations)`);
      continue;
    }
    for (const col of cols) {
      if (!entry.cols.has(col)) missing.push(`${table}.${col}`);
    }
  }
  assert.deepEqual(
    missing,
    [],
    'Erasure writes to columns that do not exist. PostgREST rejects the ENTIRE update on ' +
      'one unknown key (PGRST204), so each of these silently voids every other column in the ' +
      'same statement — the exact defect that left events.owner_email failing in production ' +
      `for months. Missing: ${missing.join(', ')}`,
  );
});

test('G2 · every column erasure FILTERS row-deletes on exists', () => {
  const schema = readSchema();
  const missing: string[] = [];
  for (const [table, cols] of Object.entries(ERASURE_ROW_DELETES)) {
    const entry = schema.get(table);
    if (!entry) {
      missing.push(`${table} (table not found in migrations)`);
      continue;
    }
    for (const col of cols) {
      if (!entry.cols.has(col)) missing.push(`${table}.${col}`);
    }
  }
  assert.deepEqual(missing, [], `Row-delete filters on non-existent columns: ${missing.join(', ')}`);
});

test('G2b · every column erasure SCOPES an update on exists', () => {
  // The scoping half of G1. A phantom name in the `.eq()` of an UPDATE fails the
  // whole statement exactly as a phantom name in its payload does — Postgres
  // rejects it, best-effort logs it, and the purge stops purging. This matters
  // most for the newest names: `event_paperwork.subject_user_id` and
  // `oauth_grants.granted_by_user_id` exist in ONE migration each, and they are
  // the only thing standing between the leaver's documents and the
  // co-partner's.
  const schema = readSchema();
  const missing: string[] = [];
  for (const [table, cols] of Object.entries(ERASURE_FILTER_COLUMNS)) {
    const entry = schema.get(table);
    if (!entry) {
      missing.push(`${table} (table not found in migrations)`);
      continue;
    }
    for (const col of cols) {
      if (!entry.cols.has(col)) missing.push(`${table}.${col}`);
    }
  }
  assert.deepEqual(
    missing,
    [],
    'Erasure scopes an UPDATE on columns that do not exist. The statement will be rejected in ' +
      `full and the purge will silently do nothing. Missing: ${missing.join(', ')}`,
  );
});

test('G3 · every subject-bearing table is classified (a NEW table fails here)', () => {
  const inScope = inScopeTables(readSchema());
  const unclassified = inScope.filter(
    (t) =>
      !PURGED.has(t) &&
      !(t in DELIBERATE_EXCLUSIONS) &&
      !(t in KNOWN_GAPS) &&
      !UNDECIDED_BACKLOG.includes(t),
  );
  assert.deepEqual(
    unclassified,
    [],
    'These tables carry a subject-identifying column but no erasure decision. Put each in ' +
      'PURGED (by covering it in lib/erasure/coverage.ts), DELIBERATE_EXCLUSIONS (with a ' +
      'reason), or KNOWN_GAPS. They may NOT be appended to UNDECIDED_BACKLOG — that list is ' +
      `frozen. Unclassified: ${unclassified.join(', ')}`,
  );
});

test('G4 · every classified table is still SEEN (guards parser narrowing)', () => {
  const schema = readSchema();
  const unseen = [
    ...Object.keys(DELIBERATE_EXCLUSIONS),
    ...UNDECIDED_BACKLOG,
    ...PURGED,
  ].filter((t) => !t.startsWith('auth.') && !schema.has(t));
  assert.deepEqual(
    unseen,
    [],
    'Tables classified here are no longer visible to the migration parser. Either the parser ' +
      'was narrowed (fix it — a silent shrink of the guarded set is how this whole class of ' +
      `bug happens) or the table was genuinely dropped (prune the entry). Unseen: ${unseen.join(', ')}`,
  );
});

test('G5 · the undecided backlog is a RATCHET — it may only shrink', () => {
  assert.ok(
    UNDECIDED_BACKLOG.length <= BACKLOG_HIGH_WATER,
    `UNDECIDED_BACKLOG grew to ${UNDECIDED_BACKLOG.length} (high-water ${BACKLOG_HIGH_WATER}). ` +
      'A new table must be DECIDED, not parked. Lower BACKLOG_HIGH_WATER when you clear entries.',
  );
  assert.equal(
    new Set(UNDECIDED_BACKLOG).size,
    UNDECIDED_BACKLOG.length,
    'duplicate entries in UNDECIDED_BACKLOG',
  );
});

test('G6 · no table sits in two buckets at once', () => {
  const overlaps: string[] = [];
  for (const t of UNDECIDED_BACKLOG) {
    if (PURGED.has(t)) overlaps.push(`${t} (backlog + purged — promote it out of the backlog)`);
    if (t in DELIBERATE_EXCLUSIONS) overlaps.push(`${t} (backlog + excluded)`);
  }
  for (const t of Object.keys(DELIBERATE_EXCLUSIONS)) {
    if (PURGED.has(t)) {
      overlaps.push(
        `${t} (excluded + purged — erasure DOES touch it, so the "not purged" reason is false. ` +
          'If it is purged in part, move the entry to PARTIALLY_PURGED and say which part.)',
      );
    }
  }
  // A partial-purge note only makes sense for a table erasure actually touches.
  for (const t of Object.keys(PARTIALLY_PURGED)) {
    if (!PURGED.has(t)) {
      overlaps.push(`${t} (PARTIALLY_PURGED but erasure touches no column on it — the note is fiction)`);
    }
    if (t in DELIBERATE_EXCLUSIONS) overlaps.push(`${t} (partially purged + excluded)`);
  }
  assert.deepEqual(overlaps, [], overlaps.join('; '));
});

test('G9 · every table where the own-vs-shared line runs THROUGH it is documented', () => {
  // The tables erasure writes SOME columns of but not all the personal ones.
  // Each must carry an explicit note saying which part is deferred, so "we
  // purged that table" can never be read as "that table is clean".
  const partialByDesign = [
    'events',
    'guests',
    'chat_messages',
    'vendor_profiles',
    'event_moderators',
    'scan_events',
    'people',
    // Added 2026-07-26. The first two are partial in a NEW way — not "some
    // columns deferred" but "some ROWS deferred", because per-partner scoping
    // fails closed on anything it cannot attribute. Same requirement either
    // way: "we purged that table" must never be readable as "that table is
    // clean".
    'event_paperwork',
    'oauth_grants',
    'vendor_verification_applications',
  ];
  const undocumented = partialByDesign.filter((t) => !(t in PARTIALLY_PURGED));
  assert.deepEqual(
    undocumented,
    [],
    `Partially-purged tables missing a deferral note: ${undocumented.join(', ')}`,
  );
});

test('G7 · tables erasure purges WITHOUT a subject column stay pinned', () => {
  const inScope = new Set(inScopeTables(readSchema()));
  const invisible = [...PURGED].filter((t) => !inScope.has(t));
  assert.deepEqual(
    invisible.sort(),
    [...PURGED_WITHOUT_SUBJECT_COLUMN].sort(),
    'The set of purged-but-undetectable tables changed. These are the ones G3 can never flag ' +
      '(personal data keyed by event_id / vendor_profile_id / guest_id / email, with no user ' +
      'FK), so the count is the honest measure of this guardrail’s blind spot. Update ' +
      'PURGED_WITHOUT_SUBJECT_COLUMN and say so in the PR.',
  );
});

test('G8 · the wizard_state allow-list matches WizardState’s CLOSED fields', () => {
  const src = fs.readFileSync(WIZARD_LIB, 'utf8');
  const decl = /export type WizardState = Partial<[\s\S]*?\n>;/.exec(src)?.[0];
  assert.ok(decl, 'could not locate the WizardState type declaration in lib/wizard.ts');

  // The named (closed) fields of a task entry, ignoring the open index signature.
  const named = new Set(
    [...decl.matchAll(/^\s{6}([a-z0-9_]+)\?:/gm)].map((m) => m[1] as string),
  );
  assert.ok(named.size > 0, 'parsed zero named fields — the regex has drifted from the type');

  assert.deepEqual(
    [...named].sort(),
    [...WIZARD_STATE_ALLOWED_KEYS].sort(),
    'lib/wizard.ts declared a new NAMED field on a wizard task entry. The erasure allow-list ' +
      '(WIZARD_STATE_ALLOWED_KEYS) is the set of keys that SURVIVE erasure, so a new named ' +
      'field needs a decision: is it progress (add it, and say why it holds no personal data) ' +
      'or payload (leave it out — it is already stripped, this test just makes you look).',
  );
});
