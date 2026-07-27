/**
 * RA 10173 right-to-erasure — the erasure SURFACE, expressed as data.
 *
 * WHY THIS FILE EXISTS. Erasure used to be a set of column names typed inline
 * into `.update({ … })` calls in `app/admin/users/actions.ts`, against an
 * UNTYPED supabase-js client (`createAdminClient()` returns `SupabaseClient`
 * with no generated Database type). Nothing connected those strings to the real
 * schema, in either direction:
 *
 *   • a column that DOESN'T EXIST is accepted by the compiler and rejected at
 *     runtime by PostgREST (PGRST204) — which rejects the WHOLE statement, so
 *     one bad name silently voids every other column in the same update. That
 *     is not hypothetical: `owner_email` and `owner_display_name` were never
 *     columns of `public.events` (they are output aliases of an admin-console
 *     VIEW), so from the day they were added the owned-event purge failed in
 *     full and NONE of the birth data or the photo-delivery credential was ever
 *     cleared in production. The failure was swallowed into an
 *     `erasure_purge_failed` audit row by the (correct) best-effort design, so
 *     it never surfaced.
 *   • a column that is ADDED LATER is invisible — `vendor_profiles` grew 16
 *     further PII columns (hq_address, tin_number, registered_address, …) after
 *     the 10-column scrub was written, and none of them were ever erased.
 *
 * So the fix is not "add the missing names once". It is to make the target set
 * DATA that a test can hold against the real schema, and to make the same data
 * the thing the code actually executes — there is no second list to drift.
 *
 * Two consumers, deliberately:
 *   1. `lib/erasure/purge.ts` builds its update payloads FROM these constants.
 *   2. `lib/erasure/coverage-guardrail.test.ts` checks every name here against
 *      the schema parsed out of `supabase/migrations`, and every subject-bearing
 *      table against the three review buckets at the bottom of this file.
 *   3. `tests/db/erasure-completeness.db.test.ts` runs the REAL purge against the
 *      REAL replayed schema — the backstop that catches anything a static list
 *      cannot see.
 *
 * NO `server-only` / `next/*` import may enter this module (same rule as
 * `lib/account-erasure.ts`): the tests run under tsx, which cannot import them.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1 · wizard_state — the JSONB second copy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The ONLY keys allowed to survive erasure inside an `events.wizard_state` task
 * entry. Everything else in the entry is stripped.
 *
 * ── WHY AN ALLOW-LIST AND NOT A DENY-LIST ───────────────────────────────────
 * `WizardState` (lib/wizard.ts) declares two named fields plus an OPEN index
 * signature (`[key: string]: unknown`), and `markTaskInFlight` /
 * `markTaskComplete` (app/dashboard/[eventId]/wizard-actions.ts) copy ANY
 * `meta_*` form field straight into a nested `meta` object. The key set is
 * therefore unbounded and grows every time a card is added. A deny-list would
 * fail OPEN for every key someone adds after it is written — which is exactly
 * how this gap was born in the first place. An allow-list fails CLOSED: a new
 * card's payload is erased on day one, before anyone remembers this file.
 *
 * ── WHY THESE TWO, AND ONLY THESE TWO ───────────────────────────────────────
 * They are the progress spine, not payload. `isTaskComplete` / `isTaskInFlight`
 * (lib/wizard.ts) read `completed_at` and `in_flight_since` and nothing else, so
 * the sequence resolver still knows exactly where setup got to. Everything else
 * in an entry is a DUPLICATE of a first-class column or a personal payload:
 *   date / scheduled_date  → the wedding + prenup dates (also events.event_date)
 *   pax · centavos         → guest count + budget (also events.estimated_*)
 *   initials · style       → the couple's monogram
 *   slug · visibility      → the public site handle
 *   event_vendor_id · marketplace_vendor_id · palette_name · assigned_count ·
 *   total_rsvp_count · last_added_* · reasons_count
 *   meta { … }             → UNBOUNDED. Its target task ids are cenomar_bride,
 *                            cenomar_groom, church_paperwork and
 *                            marriage_license — slots designed to hold PSA and
 *                            CENOMAR reference numbers, i.e. Philippine civil-
 *                            registry document identifiers. Sensitive personal
 *                            information under RA 10173 §3(l).
 *
 * ── WHY STRIP, RATHER THAN DELETE THE COLUMN'S CONTENTS ─────────────────────
 * A wedding has two partners plus coordinators, and setup progress is SHARED
 * state. Blanking `wizard_state` would erase the co-partner's progress through
 * ~38 planning cards — over-deletion is a real harm, not a safe default. This
 * keeps the shared progress and removes the leaving user's personal payload,
 * which is the same line the column purge already draws (it clears BOTH
 * partners' birth data but leaves bride/groom names and venue).
 */
export const WIZARD_STATE_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  'completed_at',
  'in_flight_since',
]);

export type WizardScrubResult = {
  /** The scrubbed value, safe to write back to `events.wizard_state`. */
  next: Record<string, unknown>;
  /** `task_id.key` paths that were removed — audit detail, never the values. */
  strippedPaths: string[];
  /** False when the input was already clean (skip the write entirely). */
  changed: boolean;
};

/**
 * Strip every non-allow-listed key from every task entry in a `wizard_state`
 * JSONB value, keeping the task keys themselves and their progress stamps.
 *
 * Defensive about shape because this is erasure and the column is free-form
 * JSONB written by ~15 call sites: a non-object root, a null entry, or an entry
 * that is a scalar/array rather than an object all resolve to something safe
 * rather than throwing. A purge that crashes on a malformed row is a purge that
 * doesn't happen.
 *
 * Reports only key PATHS, never values — the audit row must not become a second
 * copy of the CENOMAR number we are erasing.
 */
export function scrubWizardState(raw: unknown): WizardScrubResult {
  if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
    return { next: {}, strippedPaths: [], changed: false };
  }

  const next: Record<string, unknown> = {};
  const strippedPaths: string[] = [];
  let changed = false;

  for (const [taskId, entry] of Object.entries(raw as Record<string, unknown>)) {
    // A null / non-object entry carries no personal payload — `parseWizardState`
    // tolerates it and the resolver treats it as pending. Preserve verbatim.
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      next[taskId] = entry;
      continue;
    }

    const kept: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(entry as Record<string, unknown>)) {
      if (WIZARD_STATE_ALLOWED_KEYS.has(key)) {
        kept[key] = value;
      } else {
        strippedPaths.push(`${taskId}.${key}`);
        changed = true;
      }
    }
    next[taskId] = kept;
  }

  return { next, strippedPaths, changed };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2 · Column write-maps
//
// Every constant below is BOTH the payload the purge executes and the input the
// guardrail checks against the migration-parsed schema. One source, so the
// guard can never disagree with the code.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `public.events` — the owner's OWN data carried on an event they own.
 *
 * ⚠ `owner_email` / `owner_display_name` were REMOVED 2026-07-26. They never
 * existed as columns (only as output aliases of the admin-intelligence view in
 * migration 20261202001000), so PostgREST rejected this entire statement and
 * the seven real columns below were never cleared in production. The guardrail
 * now makes that class of mistake fail in CI instead of in a swallowed audit row.
 *
 * SHARED fields (bride_name, groom_name, venue, and the ~20 other jointly
 * authored jsonb blobs on this row) are deliberately NOT here — see
 * DPO_QUESTIONS below.
 */
export const EVENTS_OWNER_PII_NULLS = {
  // BaZi date-check birth data. Both partners' — precedent set by the original
  // purge and kept: the owner supplied both, and it is sensitive PI (§3(l)).
  partner_a_birth_date: null,
  partner_a_birth_time: null,
  partner_b_birth_date: null,
  partner_b_birth_time: null,
  bazi_birthdata_consent_at: null,
  // The owner's Google account + the LIVE encrypted photo-delivery OAuth token.
  // A credential must not survive erasure.
  photo_delivery_account_email: null,
  photo_delivery_oauth_token_encrypted: null,
} as const;

/** Columns on `events` written with a computed value rather than NULL. */
export const EVENTS_COMPUTED_COLUMNS = ['wizard_state'] as const;

/**
 * `public.event_paperwork` — payload stripped, progress kept.
 *
 * This is the purpose-built home for PSA / CENOMAR / marriage-licence documents
 * (`document_type` ∈ cenomar/psa/marriage_license/…). `tracking_reference` is
 * the civil-registry reference number and `document_r2_key` points at the
 * scanned document itself; `notes` is free text beside them. All three are the
 * same class of sensitive PI as the birth data the purge already clears, and
 * `wizard_state.meta` is merely the informal copy of the same numbers — erasing
 * one without the other would be theatre.
 *
 * `document_type` and `status` stay (both NOT NULL): they are the co-partner's
 * shared checklist progress, the exact analogue of `completed_at` in
 * wizard_state. Same payload-vs-progress split, applied twice.
 *
 * ⚠ WHICH ROWS this is applied to changed 2026-07-26 (owner ruling): only rows
 * with `subject_user_id = <leaver>`, never the whole event. See
 * ERASURE_FILTER_COLUMNS and the per-partner scoping block in
 * `purge.ts › purgeOwnedEventData`. Eight of the fifteen `document_type` values
 * are per-partner (psa_birth_cert / cenomar / baptismal_cert /
 * confirmation_cert × partner_1|partner_2) and seven are joint (marriage_license,
 * pre_cana_certificate, banns_posted, canonical_interview_complete,
 * inc_counseling_complete, sharia_counseling_complete, cfo_counseling_complete);
 * a joint document has no single subject and so can never be attributed, which
 * means it is never erased while the event still has a remaining partner.
 */
export const EVENT_PAPERWORK_PII_NULLS = {
  tracking_reference: null,
  document_r2_key: null,
  notes: null,
} as const;

/**
 * `public.vendor_profiles` — the leaving user's OWN shop.
 *
 * The first 10 keys are the original scrub. The rest are the columns that were
 * added to the table AFTER it was written and never reached — the drift this PR
 * exists to close. Live proof at the time of writing: `hq_address` held a real
 * street address on a profile whose `business_owner_name` right beside it was
 * already being nulled.
 *
 * NOT NULL columns take their schema default rather than null (`microsite_
 * sections` '{}'::jsonb, `portfolio_r2_keys` / `gallery_video_links`
 * ARRAY[]::text[]).
 *
 * ⚠ `tin_number` / `tin_type` / `registration_number_*` are scrubbed here on
 * purpose: the BIR retention basis attaches to `receipts` and
 * `vendor_2307_filings` (both untouched by erasure), not to a marketplace
 * profile. Flagged in the PR body so the DPO can reverse it if counsel disagrees.
 */
export const VENDOR_PROFILE_PII_SCRUB = {
  // ── original 10 ──
  business_name: '',
  business_slug: null,
  tagline: null,
  website: null,
  contact_email: null,
  contact_phone: null,
  logo_url: null,
  business_owner_name: null,
  location_city: null,
  is_published: false,
  // ── missed by name-drift, added 2026-07-26 ──
  hq_address: null,
  hq_region: null,
  hq_latitude: null,
  hq_longitude: null,
  registered_business_name: null,
  registered_address: null,
  registered_zip: null,
  registration_number_raw: null,
  registration_number_normalized: null,
  tin_number: null,
  tin_type: null,
  screen_name: null,
  screen_name_slug: null,
  social_post_url: null,
  microsite_about: null,
  microsite_hero_photo_key: null,
  microsite_sections: [] as unknown as null,
  portfolio_r2_keys: [] as unknown as null,
  gallery_video_links: [] as unknown as null,
} as const;

/**
 * `public.users` — the identity row. NULL-valued columns only; `email`,
 * `deleted_at` and `updated_at` are computed and listed in
 * USERS_COMPUTED_COLUMNS.
 *
 * `public_profile_enabled` added 2026-07-26: `slug` was already nulled but the
 * flag stayed true, so a public profile route could still resolve to an empty
 * shell. `public_id` is retained — it is the join handle on retained business
 * records, not personal data on its own.
 *
 * ⚠ THREE MORE PHANTOMS REMOVED 2026-07-26: `venue_address`, `venue_name` and
 * `social_post_url` are NOT columns of `public.users` — `venue_*` live on
 * `events` and `social_post_url` lives on `vendor_profiles` (verified against
 * information_schema). Because PostgREST rejects the whole payload on one
 * unknown key, THIS ENTIRE STATEMENT failed, which meant no identity PII was
 * ever anonymized AND `deleted_at` was never stamped — so the middleware /
 * dashboard lockout that depends on it never engaged either. The intent behind
 * the three names is now served where the data actually lives:
 * `social_post_url` by VENDOR_PROFILE_PII_SCRUB, and the event venue by the
 * shared-record DPO question (it is the wedding's venue, not the user's).
 */
export const USERS_ANONYMIZE_NULLS = {
  display_name: null,
  phone: null,
  profile_photo_url: null,
  birth_date: null,
  slug: null,
  religion: null,
  religion_consent_at: null,
  civil_status: null,
  civil_status_consent_at: null,
  sex: null,
  sex_consent_at: null,
  address_normalized: null,
  last_login_at: null,
  last_ghost_check_at: null,
  public_profile_enabled: false,
} as const;

/** `users` columns written with a computed value (tombstone email, timestamps). */
export const USERS_COMPUTED_COLUMNS = ['email', 'deleted_at', 'updated_at'] as const;

/** `public.people` — the user's own durable identity node. */
export const PEOPLE_ANONYMIZE_NULLS = {
  display_name: null,
  first_name: null,
  last_name: null,
  email: null,
  phone: null,
  profile_photo_url: null,
  birth_date: null,
} as const;

/** `people` columns written with a computed value. */
export const PEOPLE_COMPUTED_COLUMNS = ['deleted_at'] as const;

/**
 * `public.event_moderators` — rows where the LEAVING USER is the moderator.
 *
 * `invitation_email` / `invitation_phone` are the contact details the invite was
 * sent TO, i.e. the subject's own; `invitation_token` is a live bearer secret
 * tied to them. `display_label` is deliberately NOT scrubbed — it is the host's
 * record of who their coordinator was, the same call the code already makes for
 * bride/groom names on a shared event row.
 *
 * Rows where the subject is the INVITER (`invited_by_user_id`) are left alone:
 * that is third-party PII the subject entered about someone else, excluded by
 * the same rule as `event_vendors` (see DPO_QUESTIONS).
 */
export const EVENT_MODERATOR_SELF_NULLS = {
  invitation_email: null,
  invitation_phone: null,
  invitation_token: null,
} as const;

/**
 * `public.scan_events` — rows the subject SCANNED.
 *
 * Surgical rather than a delete: the row is also the host's per-guest scan
 * record. Drop the scanner's identity + device trail, keep the scan.
 */
export const SCAN_EVENT_SCANNER_NULLS = {
  scanner_user_id: null,
  user_agent: null,
  ip_anon: null,
} as const;

/**
 * `public.vendor_verification_applications` — the government-ID payload.
 *
 * ── WHY THIS TABLE HAD NO ERASURE CODE AT ALL ───────────────────────────────
 * `doc_uploads` (JSONB) is where a vendor's uploaded GOVERNMENT ID, DTI/SEC
 * certificate, BIR 2303 and Mayor's Permit land — the heaviest identity
 * documents anywhere in the product — in the PRIVATE `setnayan-vendor-verification`
 * bucket. Account deletion never touched it, and could not be made to notice:
 * the table is keyed by `vendor_profile_id`, its only `*_user_id` column is
 * `admin_user_id` (a STAFF actor, which the guardrail's detector correctly
 * ignores), so `coverage-guardrail.test.ts`'s "unclassified subject-bearing
 * table" check was STRUCTURALLY incapable of ever flagging it. It is now pinned
 * in that file's `PURGED_WITHOUT_SUBJECT_COLUMN` so the blind spot stays counted
 * rather than being mistaken for coverage.
 *
 * ── WHY SCRUB THE JSONB RATHER THAN DELETE THE ROW ──────────────────────────
 * The row is also the verification DECISION record — `admin_user_id`,
 * `decision`, `decision_reason`, `decided_at`, the SLA timestamps. Deleting it
 * would destroy an admin accountability trail (the same reason
 * `vendor_verifications` sits in DELIBERATE_EXCLUSIONS), and it would do so to
 * satisfy a request that only concerns the documents. So: the documents go, the
 * decision stays. Identical shape to the `vendor_profiles` call — scrub the PII,
 * keep the shell.
 *
 * `docs_complete` is reset alongside because it is a cached derivative of
 * `doc_uploads`; leaving it TRUE over an empty map would put the application in
 * the admin's "ready to review" queue with nothing to review.
 */
export const VENDOR_VERIFICATION_DOC_SCRUB = {
  doc_uploads: {} as unknown as null,
  docs_complete: false,
} as const;

/**
 * Pull every R2 object reference out of a `doc_uploads` JSONB value.
 *
 * ── WHY A RECURSIVE WALK AND NOT A KNOWN-KEY LOOKUP ─────────────────────────
 * `DocUpload` (lib/vendor-verification.ts) is a SEVEN-MEMBER UNION and the shape
 * differs per slot: most slots are `{ r2_key, uploaded_at, notes }`, but
 * `portfolio_samples` is an ARRAY of `{ r2_key }`, `client_references` is an
 * array of structured objects, `social_media` is an open platform→link map with
 * an index signature, and `government_id` carries third-party verification ids.
 * Reading one fixed key off the top level would silently miss the array slots —
 * and a missed ref means the government ID stays in R2 with the row that named
 * it wiped, i.e. unreachable-but-retained, the worst of both outcomes (the same
 * failure the chat-attachment purge exists to avoid).
 *
 * So the walk is shape-agnostic: recurse the whole value and collect any string
 * that is an `r2://bucket/key` ref, whatever key or nesting depth it sits at.
 * That fails SAFE as the union grows — a slot shape added next year is covered
 * on the day it ships. Non-R2 strings (social links, Veriff session ids, ISO
 * timestamps) are ignored, and the storage adapter is the final arbiter of what
 * is deletable anyway.
 *
 * Deduplicated and depth-capped; defensive about shape because this is erasure
 * and a purge that throws on a malformed row is a purge that doesn't happen.
 */
export function collectStoredAssetRefs(raw: unknown, maxDepth = 8): string[] {
  const found = new Set<string>();
  const walk = (value: unknown, depth: number): void => {
    if (depth > maxDepth || value === null || value === undefined) return;
    if (typeof value === 'string') {
      if (value.startsWith('r2://') && value.length > 'r2://'.length) found.add(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const v of value) walk(v, depth + 1);
      return;
    }
    if (typeof value === 'object') {
      for (const v of Object.values(value as Record<string, unknown>)) walk(v, depth + 1);
    }
  };
  walk(raw, 0);
  return [...found];
}

// ─────────────────────────────────────────────────────────────────────────────
// 3 · Whole-row deletes, keyed by the subject's own FK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tables where the subject's rows are DELETED outright, keyed by the named
 * column. Every one is reachable only as the subject's own data.
 *
 * ── WHY THESE ROWS SURVIVED UNTIL NOW ───────────────────────────────────────
 * They were never "not covered" by choice. `eraseUserAccount` stopped issuing
 * `auth.admin.deleteUser` (it threw for any account with activity — see its
 * docstring), and with it the ~60 `ON DELETE CASCADE` foreign keys to
 * auth.users / public.users stopped firing. Nothing replaced them, and the
 * docstring recorded the RESTRICT-FK motivation without noting that the switch
 * also disarmed every CASCADE. This list restores the cleanup for the subset
 * that is unambiguously the subject's own personal data with no retention,
 * audit or shared-record role.
 *
 * Everything NOT here is either in DELIBERATE_EXCLUSIONS or KNOWN_GAPS below.
 */
export const OWN_ROW_DELETES: ReadonlyArray<{
  table: string;
  column: string;
  why: string;
}> = [
  {
    table: 'notifications',
    column: 'user_id',
    why: 'The subject’s own notification feed — titles/bodies quote payment amounts and deep-link into their dashboard.',
  },
  {
    table: 'api_keys',
    column: 'user_id',
    why: 'Bearer credential material issued to the subject. A credential must not outlive the account (same rule as the photo-delivery OAuth token).',
  },
  {
    table: 'chat_thread_reads',
    column: 'user_id',
    why: 'The subject’s own read cursors. Pseudonymous, no counterparty value — the thread itself is untouched.',
  },
  {
    table: 'guest_saved_vendors',
    column: 'user_id',
    why: 'The subject’s private saved-vendor list, keyed to them alone.',
  },
  {
    table: 'user_follows',
    column: 'follower_user_id',
    why: 'The subject’s OUTBOUND follow list. Inbound edges (followed_user_id) are another account’s list — left, and flagged in the PR.',
  },
  {
    table: 'vendor_follows',
    column: 'follower_user_id',
    why: 'The subject’s outbound vendor-follow list.',
  },
  {
    table: 'seating_editor_locks',
    column: 'holder_user_id',
    why: 'Ephemeral advisory lock that carries the subject’s display name in holder_label (NOT NULL).',
  },
  {
    table: 'oauth_state',
    column: 'initiated_by',
    why: 'Transient OAuth handshake token. Nothing expires these — 28 had accumulated for a single account.',
  },
  {
    table: 'vendor_ig_oauth_state',
    column: 'initiated_by',
    why: 'Transient OAuth handshake token (Instagram).',
  },
  {
    table: 'patiktok_oauth_state',
    column: 'initiated_by',
    why: 'Transient OAuth handshake token (Patiktok).',
  },
  {
    table: 'live_studio_channel_oauth_state',
    column: 'initiated_by',
    why: 'Transient OAuth handshake token (Live Studio channel).',
  },
  {
    table: 'event_day_requests',
    column: 'author_user_id',
    why: 'Free text the subject wrote on the day ("we are running late", "the cake is missing") in the day-of requests stream. Same call as chat_messages: authored prose is the author’s personal data, the event it coordinated is long over, and the coordinator’s remaining rows are unaffected. `resolved_by_user_id` needs no entry — it is ON DELETE SET NULL, so triage attribution detaches on its own.',
  },
];

/**
 * Pre-signup marketing captures. These have NO user FK at all — the only
 * identifier is the email address, so a user_id-driven erasure cannot reach them
 * by construction. Matched on the ORIGINAL email, which must be captured before
 * step 1 tombstones it.
 */
export const OWN_ROW_DELETES_BY_EMAIL: ReadonlyArray<{ table: string; why: string }> = [
  {
    table: 'couple_waitlist_signups',
    why: 'Pre-signup capture holding full_name, partner_name, ip_address and user_agent, with no user FK.',
  },
  {
    table: 'couple_event_type_notify_signups',
    why: 'Notify-me capture; user_id is nullable and often unset, so email is the only reliable key.',
  },
  {
    table: 'couple_wedding_type_notify_signups',
    why: 'Notify-me capture holding the ceremony type, region and expected wedding date against an email; user_id is nullable here too.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 4 · Derived: every column name erasure writes, per table
//
// Derived, never hand-listed, so it cannot disagree with the payloads above.
// Consumed by the guardrail's phantom-column check.
// ─────────────────────────────────────────────────────────────────────────────

export const ERASURE_COLUMN_WRITES: Readonly<Record<string, readonly string[]>> = {
  events: [...Object.keys(EVENTS_OWNER_PII_NULLS), ...EVENTS_COMPUTED_COLUMNS],
  event_paperwork: Object.keys(EVENT_PAPERWORK_PII_NULLS),
  vendor_profiles: Object.keys(VENDOR_PROFILE_PII_SCRUB),
  vendor_verification_applications: Object.keys(VENDOR_VERIFICATION_DOC_SCRUB),
  users: [...Object.keys(USERS_ANONYMIZE_NULLS), ...USERS_COMPUTED_COLUMNS],
  people: [...Object.keys(PEOPLE_ANONYMIZE_NULLS), ...PEOPLE_COMPUTED_COLUMNS],
  event_moderators: Object.keys(EVENT_MODERATOR_SELF_NULLS),
  scan_events: Object.keys(SCAN_EVENT_SCANNER_NULLS),
  // Written with literal payloads inside purge.ts (tombstone strings, not
  // reusable constants) — named here so the guardrail still checks them.
  guest_claims: ['claimer_name', 'claimer_email', 'otp_sent_to'],
  help_messages: ['sender_email', 'sender_name', 'subject', 'body'],
  guests: ['photo_url', 'photo_source', 'photo_updated_at'],
};

/** Tables erasure deletes rows from, with the column it filters on. */
export const ERASURE_ROW_DELETES: Readonly<Record<string, readonly string[]>> = {
  chat_messages: ['sender_user_id'],
  user_face_profiles: ['user_id'],
  push_subscriptions: ['user_id'],
  vendor_push_tokens: ['vendor_profile_id'],
  dependents: ['owner_user_id'],
  godparents: ['owner_user_id'],
  guest_face_enrollments: ['guest_id'],
  // ⚠ Was `event_id` — event-wide, which revoked the CO-PARTNER's Google
  // credential. Now the account that actually completed the consent.
  oauth_grants: ['granted_by_user_id'],
  ...Object.fromEntries(OWN_ROW_DELETES.map((d) => [d.table, [d.column]])),
  ...Object.fromEntries(OWN_ROW_DELETES_BY_EMAIL.map((d) => [d.table, ['email']])),
};

/**
 * Columns erasure FILTERS an UPDATE on, per table — the scoping half of a
 * column write.
 *
 * A third list is needed because G1/G2 only see what is WRITTEN and what
 * row-DELETES filter on. A phantom name in an `.eq()` on an update is the same
 * class of bug with the same blast radius: Postgres rejects the whole statement
 * (`column "x" does not exist`), the best-effort handler logs it, and the purge
 * quietly stops purging. `subject_user_id` is a brand-new column that exists in
 * exactly one migration, which is precisely the shape of name that goes stale
 * first — so it is checked rather than trusted.
 *
 * Only non-obvious scoping columns belong here; `user_id`-style filters are
 * already covered by the row-delete map.
 */
export const ERASURE_FILTER_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  // Per-partner paperwork scoping (owner ruling 2026-07-26) — fail closed.
  event_paperwork: ['event_id', 'subject_user_id'],
  // The fail-closed residue probe reads oauth_grants by event + attribution.
  oauth_grants: ['event_id', 'granted_by_user_id'],
};
