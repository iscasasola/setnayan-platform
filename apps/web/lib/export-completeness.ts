/**
 * export-completeness.ts — the registry that decides, per table, whether a
 * person's own rows are part of their RA 10173 § 16(c) access request.
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 * `/privacy` grants the right without qualification: "download a JSON archive
 * of your data anytime (served by our /api/profile/export endpoint)."
 *
 * That route is careful about what it READ and could not read — `listOutcome`,
 * `not_included`, `export_complete`, and a ban on `?? []` so a failed read can
 * never render as "you have none". 🔑 **But a table the route never QUERIES is
 * absent from `not_included` too.** It is not reported as missing; it is
 * outside the universe the route knows about. Careful accounting of a set that
 * is itself incomplete still reports completeness.
 *
 * Measured against production on 2026-09-15 by diffing the tables the route
 * reads against every `public` base table carrying a person-key column, seven
 * with live rows were in neither list — `receipts` (4 rows), `notifications`
 * (72), `user_devices` (32), `social_posts` (103), `order_ledger` (9),
 * `event_moderators` (6), `creator_chapters` (1).
 *
 * ⚠ **AND NOT ALL OF THEM BELONG IN AN EXPORT.** `admin_audit_log` records what
 * an ADMIN did; `community_invite_tokens` are credentials. The defect was never
 * "seven tables are missing" — it was that **nobody had decided, and there was
 * nowhere to write the decision down.** This file is that place. Every
 * person-keyed table is EXPORTED or EXCLUDED, and an exclusion carries a reason
 * a person can disagree with.
 *
 * `every-person-keyed-table-is-decided.db.test.ts` replays the full schema and
 * fails on any table in neither list, so a table added next month forces the
 * decision instead of inheriting silence.
 */

/** Columns that mean "this row is about a particular person". */
export const PERSON_KEY_COLUMNS = [
  'user_id',
  'author_user_id',
  'owner_user_id',
  'created_by',
  'actor_user_id',
] as const;

export type ExportDecision =
  | { table: string; decision: 'exported'; as: string }
  | { table: string; decision: 'excluded'; why: string };

/**
 * ⚖ EXCLUSIONS — each is a judgement, not an oversight. Disagree with one and
 * change it; do not add an entry you could not defend to the person whose
 * access request it narrows.
 */
export const EXPORT_DECISIONS: ReadonlyArray<ExportDecision> = [
  // ── The subject's own records ───────────────────────────────────────────
  { table: 'users', decision: 'exported', as: 'profile (users)' },
  { table: 'event_members', decision: 'exported', as: 'event_memberships' },
  { table: 'chat_messages', decision: 'exported', as: 'chat_messages_authored' },
  { table: 'orders', decision: 'exported', as: 'orders' },
  { table: 'payments', decision: 'exported', as: 'payments' },
  { table: 'guest_face_enrollments', decision: 'exported', as: 'face_enrollments' },
  { table: 'dependents', decision: 'exported', as: 'alaga_dependents' },
  { table: 'godparents', decision: 'exported', as: 'alaga_godparents' },
  { table: 'community_members', decision: 'exported', as: 'samahan_memberships' },
  { table: 'samahan_stories', decision: 'exported', as: 'samahan_stories' },
  { table: 'samahan_messages', decision: 'exported', as: 'samahan_messages' },
  { table: 'vendor_profiles', decision: 'exported', as: 'vendor_profile' },
  { table: 'papic_free_grant_claims', decision: 'exported', as: 'papic_free_grant' },
  { table: 'event_deletion_requests', decision: 'exported', as: 'event_deletion_requests' },

  // ── Excluded, with the reason ───────────────────────────────────────────
  {
    table: 'admin_audit_log',
    decision: 'excluded',
    why:
      'Records what an ADMIN did, keyed by the admin as actor. It is the platform\'s ' +
      'accountability record, not the subject\'s personal data, and handing it out would ' +
      'disclose other people\'s moderation decisions. A subject asking what was done TO them ' +
      'is a different request, answered by a person.',
  },
  {
    table: 'community_invite_tokens',
    decision: 'excluded',
    why:
      'Credentials, not personal data. Exporting a live invite token in a file the subject ' +
      'may email to themselves turns an access request into a key disclosure.',
  },
  {
    table: 'api_keys',
    decision: 'excluded',
    why: 'Credentials. Same reason as community_invite_tokens — an export must never carry a secret.',
  },
  {
    table: 'push_subscriptions',
    decision: 'excluded',
    why:
      'Holds a browser push endpoint plus its encryption keys. The endpoint IS personal, but it ' +
      'is also a live delivery credential; exporting it lets anyone holding the file push to ' +
      'that device. Disclose that it is held; do not hand over the keys.',
  },
];

/** Tables that must appear in the export payload, by their payload key. */
export function exportedTables(): ReadonlyArray<{ table: string; as: string }> {
  return EXPORT_DECISIONS.flatMap((d) =>
    d.decision === 'exported' ? [{ table: d.table, as: d.as }] : [],
  );
}

/** Tables deliberately left out, with the reason a reader can argue with. */
export function excludedTables(): ReadonlyArray<{ table: string; why: string }> {
  return EXPORT_DECISIONS.flatMap((d) =>
    d.decision === 'excluded' ? [{ table: d.table, why: d.why }] : [],
  );
}

/**
 * ⏳ UNDECIDED — the honest third state, and a RATCHET.
 *
 * Measured 2026-09-15 by replaying the full schema: these tables carry a
 * person-key column and nobody has yet decided whether a subject's own rows
 * belong in their export. Listing them is not approval — it is the difference
 * between a backlog somebody can work and a gap nobody can see.
 *
 * 🔒 THE GUARD ASSERTS THIS LIST ONLY SHRINKS. A NEW person-keyed table may not
 * join it: a table added next month must be decided when it is added, while the
 * person who added it still knows what it holds. That is the one moment the
 * decision is cheap.
 *
 * ⚠ Several of these are genuinely the OWNER's call, not engineering's — where
 * a record is the subject's personal data versus Setnayan's own business record
 * (`platform_expenses`, `founder_time_log`, `vendor_client_notes` — notes a
 * supplier wrote ABOUT a client are both people's data at once). Those go to
 * him as questions, not as a fence.
 *
 * ⚠ THIS LIST IS THE MEASURED SET AS OF 2026-09-15, and the ratchet applies FROM
 * here — it is the baseline, not a parking space. It was taken from the guard's
 * own output rather than re-derived by hand, after a first attempt that read the
 * output through `head -40` and silently lost the alphabetically-last entry
 * (`vendor_member_token_wallets`) — and then a SECOND one (`vendor_team_members`),
 * because the guard reports every unaccounted table at once and the same `head`
 * hid two, not one. **A truncated capture of a correct measurement is a wrong
 * measurement, and it looks complete.** The list was finally settled by diffing
 * the registry against `information_schema` directly, with both sides printed.
 *
 * The ones with live rows in production on 2026-09-15, worth doing first:
 *   social_posts (103) · notifications (72) · user_devices (32) ·
 *   order_ledger (9) · event_moderators (6) · receipts (4) ·
 *   chat_thread_reads (4) · creator_chapters (1) · communities (1)
 *
 * 🔑 `receipts` is the sharpest: a financial record naming the person, which
 * /privacy promises to KEEP for ten years under the BIR floor while the access
 * right does not hand it back. `user_devices` is next — the page has a whole
 * section promising the device identifier is exported and deleted, and it is in
 * neither list.
 */
export const UNDECIDED_PERSON_KEYED_TABLES: ReadonlyArray<string> = [
  'account_deletion_requests',
  // 'bespoke_monogram_generations' — REMOVED (S40, migration 20271233873951):
  // the table itself is dropped (0 rows, the Bespoke AI Monogram Studio
  // feature it backed was retired 2026-06-19). No longer in information_schema.
  'budget_builds',
  'chat_thread_reads',
  'communities',
  'comp_grants',
  'couple_event_type_notify_signups',
  'couple_wedding_type_notify_signups',
  'creator_chapters',
  'discount_code_eligible_users',
  'editorial_vendor_media',
  'event_clusters',
  'event_colour_changes',
  'event_colour_grants_coordinator',
  'event_day_requests',
  'event_moderators',
  'event_preparation_items',
  'event_stage_notes',
  'event_vendor_working_notes',
  'founder_seats',
  // 'founder_time_log' — REMOVED (S40, migration 20271233873951): the table
  // itself is dropped (0 rows, no dashboard ever shipped for it). No longer
  // in information_schema.
  'fraud_enforcement_audit',
  'guest_qr_rotations',
  'guest_saved_vendors',
  'help_messages',
  'live_studio_highlights',
  'notifications',
  'order_ledger',
  'platform_expenses',
  'promo_free_windows',
  'receipts',
  'referral_codes',
  'service_slot_reservations',
  'social_posts',
  'user_devices',
  'user_face_profiles',
  'vendor_client_notes',
  'vendor_custom_plans',
  'vendor_date_waitlist',
  'vendor_member_token_wallets',
  'vendor_team_members',
];
