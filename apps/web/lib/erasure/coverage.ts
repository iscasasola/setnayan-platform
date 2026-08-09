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
  // Added with the column (2026-08-10). It is a role attached to a NAMED
  // person — leaving "Owner" behind on a profile whose owner name has just
  // been erased is the same name-drift gap the block below records.
  business_owner_position: null,
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
 * ELEVEN TABLES WHERE THE SUBJECT'S UUID SURVIVED ERASURE (settled 2026-08-02).
 *
 * ── WHY THEY WERE ALL MISSED THE SAME WAY ──────────────────────────────────
 * Nine of the eleven declare `ON DELETE SET NULL` on the subject column, and
 * that clause reads like the problem is already handled. It is not:
 *
 *   🔑 ERASURE ISSUES NO DELETE. `purge.ts` anonymizes the auth user in place
 *   via `auth.admin.updateUserById` — it never calls `auth.admin.deleteUser` —
 *   so `ON DELETE SET NULL` NEVER FIRES on the erasure path. The subject's uuid
 *   is still sitting in the column after their erasure request completes.
 *
 * SET NULL fires only for a hard delete (the anon-draft sweep). Reading it as
 * "self-de-identifying" is what excluded these tables in the first place.
 *
 * ⚠ Two of them are worse: `vendor_change_orders` and
 * `vendor_feature_recommendations` carry the uuid with **no FK at all**, so no
 * clause exists to fire under any circumstance.
 *
 * ── WHY COLUMN-NULL AND NOT ROW-DELETE, FOR MOST ───────────────────────────
 * These rows are read by EVENT or by VENDOR, not by their author — a shared
 * agenda, a playlist, a walkthrough note, a call log. Deleting rows keyed on
 * the author would strip the co-partner's or the vendor's own records because
 * the person who typed them left. Nulling the author costs nothing: none of
 * these columns is selected by any reader, none carries a label, and no RLS
 * policy consults it. Same call already made for `scan_events.scanner_user_id`.
 *
 * ── HOW THIS SET WAS ARRIVED AT ────────────────────────────────────────────
 * An earlier bulk pass over the whole 78-table backlog was 53% wrong, in the
 * direction of under-erasure, because it reasoned from `CREATE TABLE` text that
 * migration 20271032282809 had already invalidated. These eleven were re-settled
 * one table per agent against `tests/db/user-fk-behaviour.generated.txt`, then
 * each settlement attacked by an independent reader: 10 of 11 survived
 * unchanged, and the eleventh came back "keep the disposition, fix the wording".
 * Every column below is exact-matched against `prod-schema.snapshot.txt`.
 */
export const AUTHOR_UUID_NULLS: ReadonlyArray<{
  table: string;
  /** The column holding the subject's uuid. Nulled, and filtered on. */
  column: string;
  why: string;
}> = [
  {
    table: 'event_preparation_items',
    column: 'created_by',
    why: 'The shared preparation agenda. Read by event, so the row is the co-partner’s and the booked vendor’s too — the author’s uuid goes, the item stays.',
  },
  {
    table: 'event_playlist_picks',
    column: 'created_by_user_id',
    why: 'The couple’s shared playlist. Made nullable by 20271032282809, so it CAN be de-identified in place — the earlier pass excluded it believing it was still NOT NULL.',
  },
  {
    table: 'vendor_reuse_requests',
    column: 'requested_by_user_id',
    why: 'A couple↔vendor re-booking request. Its subjects are the target event and the vendor profile (both CASCADE); this column is only the stamp of who pressed the button, so erasing that person must not delete the vendor’s pending request. Made nullable + ON DELETE SET NULL on 2026-08-04 — it shipped NOT NULL with no foreign key at all, which left a dangling uuid on deletion and stated no verdict for G6 to read. Both consumers use it solely to address a notification and now skip when it is NULL, so an erased person is never emailed.',
  },
  {
    table: 'event_walkthrough_zones',
    column: 'uploaded_by_user_id',
    why: 'Venue walkthrough notes belonging to the event. Deleting them would erase the co-partner’s record of the venue.',
  },
  {
    table: 'editorial_vendor_media',
    column: 'created_by',
    why: 'The vendor shop’s day-of submission must outlive the team member who pressed submit — the same call vendor_profiles makes in keeping the profile shell.',
  },
  {
    table: 'kwento_assignments',
    column: 'assigned_by_user_id',
    why: 'Who handed out a story assignment. The assignment belongs to the event and is read by it.',
  },
  {
    table: 'thread_calls',
    column: 'started_by_user_id',
    why: 'Who opened a call on a shared thread. The call log is the counterparty’s record as much as the subject’s.',
  },
  {
    table: 'social_posts',
    column: 'created_by',
    why: 'The staff author of an announcement. The announcement is platform content and survives; the stamp does not.',
  },
  {
    table: 'vendor_change_orders',
    column: 'proposed_by_user_id',
    why: '⚠ NO FK AT ALL — a raw uuid that no ON DELETE clause can ever clear. The change order is the contract record and stays.',
  },
  {
    table: 'vendor_change_orders',
    column: 'acknowledged_by_user_id',
    why: '⚠ NO FK AT ALL, same table, the counter-signature side. Nulled on the same pass.',
  },

  // ── batch 2, settled 2026-08-02 ──────────────────────────────────────────
  // 🔑 THE SCHEMA ITSELF SORTS THESE. Where a column is CASCADE + NOT NULL the
  // row is ABOUT the person (it belongs in SUBJECT_ROW_DELETES); where it is
  // SET NULL + nullable it is an ACTOR STAMP and belongs here. That is the same
  // actor-or-subject test migration 20271032282809 applied to 30 FKs, read back
  // out of tests/db/user-fk-behaviour.generated.txt rather than re-argued.
  {
    table: 'guest_checkins',
    column: 'checked_in_by_user_id',
    why: 'Whoever worked the door. The row’s subject is the arriving GUEST; the couple’s desk list reads it by event, never by its author.',
  },
  {
    table: 'guest_souvenir_claims',
    column: 'claimed_by_user_id',
    why: 'The crew member handing out the souvenir, not the guest receiving it. Same object as a scan_events row with a different noun.',
  },
  {
    table: 'event_blocked_users',
    column: 'blocked_by_user_id',
    why: 'Who applied the block. The block protects the EVENT and must outlive the organiser who set it, or it silently lifts.',
  },
  {
    table: 'vendor_client_notes',
    column: 'author_user_id',
    why: 'The shop’s working notes on a client. The note belongs to the vendor business and is read by it; only the staff author’s identity goes.',
  },
  {
    table: 'person_connections',
    column: 'created_by_user_id',
    why: 'Who recorded that two people are related. The relationship is the OTHER two people’s, so the edge stays and the recorder’s stamp goes.',
  },
  {
    table: 'vendor_reviews',
    column: 'couple_user_id',
    why: 'Nulling anonymises the review; deleting it would silently move a vendor’s public star rating, which is a third party’s commercial record erasure does not reach.',
  },
  {
    table: 'event_delegates',
    column: 'granted_by_user_id',
    why: 'SET NULL + nullable ⇒ an actor stamp. Deleting a delegation because the subject GRANTED it would revoke the coordinator’s access — someone else’s row.',
  },
  {
    table: 'event_delegates',
    column: 'revoked_by_user_id',
    why: 'Same table, the revocation side. Also an actor stamp.',
  },
  {
    table: 'event_vendors',
    column: 'lock_requested_by_user_id',
    why: 'Who ASKED the vendor to hold the date (lock handshake, 2026-08-04). SET NULL + nullable ⇒ an actor stamp. The row’s subject is the BOOKING between a couple and a vendor; deleting it because one member of the couple requested the lock would erase the vendor’s commercial record and the other partner’s booking.',
  },
  {
    table: 'event_vendors',
    column: 'lock_answered_by_user_id',
    why: 'The vendor-side twin: whichever team member agreed or declined. Same actor-stamp test, and deleting on it would destroy the couple’s booking because a vendor’s staffer answered it.',
  },
  {
    table: 'person_stewardships',
    column: 'created_by_user_id',
    why: 'Who recorded the stewardship. Deleting on this column would destroy a THIRD PARTY’s stewardship because the subject happened to set it up.',
  },

  // ── batch 3, settled 2026-08-02 · every split is the FK map's own verdict ──
  {
    table: 'event_appointments',
    column: 'proposed_by_user_id',
    why: 'Who proposed the meeting time. Nullable with NO FK, so nothing could ever clear it. The appointment belongs to both parties and is read by event.',
  },
  {
    table: 'feature_reviews',
    column: 'couple_user_id',
    why: 'Nulling anonymises the feedback; the review itself is product data the platform acts on, not a record about the person.',
  },
  {
    table: 'vendor_disputes',
    column: 'opened_by_user_id',
    why: 'Who raised the dispute. The dispute is a two-party record and the vendor’s side of it must survive the complainant leaving.',
  },
  {
    table: 'vendor_correction_requests',
    column: 'resolved_by',
    why: 'The staff member who resolved it. An admin actor stamp on someone else’s correction request.',
  },
  {
    table: 'vendor_creator_offers',
    column: 'holder_user_id',
    why: 'The member who pays for the offer. SET NULL ⇒ actor stamp; the offer belongs to the store, and its creator side is handled separately below.',
  },
  {
    table: 'vendor_invites',
    column: 'claimed_by_user_id',
    why: 'The vendor who accepted an invitation. SET NULL ⇒ a stamp on the STORE’s invite; the store keeps its record when a staff member leaves.',
  },

  // ── batch 4, settled 2026-08-02 ──
  {
    table: 'event_journey_steps',
    column: 'completed_by',
    why: 'Who ticked a planning step. Twin of event_preparation_items.created_by — the shared journey belongs to the event, the tick’s author does not.',
  },
  {
    table: 'event_meaningful_dates',
    column: 'created_by_user_id',
    why: 'Who added an anniversary or milestone. The date is the couple’s shared record; only the recorder’s identity goes.',
  },
  {
    table: 'proposal_amendments',
    column: 'proposed_by_user_id',
    why: '⚠ NO FK — a raw uuid nothing can clear. Successor table to vendor_change_orders and takes the identical call: the amendment is the contract record and stays.',
  },
  {
    table: 'stewardship_transfers',
    column: 'created_by_user_id',
    why: 'Who recorded the handover. The transfer audit is the ward’s protection and must outlive every party to it.',
  },
  {
    table: 'stewardship_transfers',
    column: 'from_user_id',
    why: 'The outgoing steward. SET NULL ⇒ a party stamp; the purge is subject-scoped, so only the leaver’s own occurrence is cleared and the counterparty’s stays.',
  },
  {
    table: 'stewardship_transfers',
    column: 'to_user_id',
    why: 'The incoming steward, same shape as from_user_id. Nulling one side never touches the other.',
  },
  {
    table: 'vendor_meetings',
    column: 'created_by_user_id',
    why: 'Who booked the meeting. The meeting is a two-party record read by the vendor; the booker’s identity goes and the slot stays.',
  },

  // ── batch 5, settled 2026-08-02 · mostly STAFF stamps on platform content ──
  {
    table: 'concierge_brain_chunks',
    column: 'last_verified_by_user_id',
    why: 'Which staff member last checked a knowledge-base entry. The entry is Setnayan-authored platform content; only the reviewer’s identity is personal.',
  },
  {
    table: 'concierge_plan_templates',
    column: 'admin_edited_by_user_id',
    why: 'Staff edit stamp on a platform planning template.',
  },
  {
    table: 'concierge_response_cache',
    column: 'admin_edited_by_user_id',
    why: 'Staff edit stamp on a cached answer. The cache row holds no person’s data.',
  },
  {
    table: 'discount_codes',
    column: 'created_by_admin_id',
    why: 'Which admin minted the code. The code is a platform pricing object with no subject.',
  },
  {
    table: 'discount_code_eligible_users',
    column: 'added_by_admin_id',
    why: 'Which admin granted eligibility. ⚠ The row’s own user_id is retained — see PARTIALLY_PURGED; this entry covers only the staff stamp.',
  },
  {
    table: 'event_feature_policy_override',
    column: 'set_by_admin_id',
    why: 'Which admin flipped a per-event feature. The override belongs to the event.',
  },
  {
    table: 'event_inspiration_assets',
    column: 'added_by_user_id',
    why: 'Who pinned an inspiration image. The mood board is the couple’s shared work.',
  },
  // ── final batch, settled 2026-08-02 · closes the 78-table backlog ──
  {
    table: 'vendor_release_history',
    column: 'host_user_id',
    why: 'The host side of a release record. Both parties are SET NULL stamps on a two-party event; the purge is subject-scoped so only the leaver’s own side is cleared.',
  },
  {
    table: 'vendor_release_history',
    column: 'vendor_user_id',
    why: 'The vendor side of the same record. The release itself — reason, notes, snapshots — is the counterparty’s business history and stays.',
  },
  {
    table: 'photo_delivery_jobs',
    column: 'triggered_by_user_id',
    why: 'Who pressed “Release to Drive”. The job row is about the EVENT — file counters and a status — not about a person.',
  },
  {
    table: 'platform_compliance_facts',
    column: 'updated_by',
    why: 'Which admin last saved Setnayan’s own DPO/NPC registration facts. A singleton config row with a staff stamp.',
  },
  {
    table: 'platform_expenses',
    column: 'created_by',
    why: 'Which admin logged an internal expense. Setnayan’s own money-out ledger; the entry stays, the clerk goes.',
  },
  {
    table: 'promo_free_windows',
    column: 'created_by',
    why: 'Which admin scheduled a free-services window. Platform promo config.',
  },
  {
    table: 'reveal_studio_config',
    column: 'updated_by_admin_id',
    why: 'Staff stamp on a five-column singleton config row.',
  },
  {
    table: 'setnayan_pay_methods',
    column: 'updated_by_user_id',
    why: 'Which admin last edited a payment-rail row. Every rail is inactive in V1; the config is not a person’s record.',
  },
  {
    table: 'site_widgets',
    column: 'updated_by_admin_id',
    why: 'Staff stamp on a homepage widget slug.',
  },
  {
    table: 'vendor_self_comp_caps',
    column: 'raised_by_admin',
    why: 'Which admin raised a store’s quarterly comp ceiling. The cap belongs to the store.',
  },
  {
    table: 'vendor_recommendations',
    column: 'recommended_by_user_id',
    why: 'Who recommended a vendor. The row is ABOUT the vendor; only the authorship is about the subject.',
  },
  {
    table: 'vendor_locked_qr_tokens',
    column: 'claimed_by_user_id',
    why: 'The couple’s “this account consumed the token” stamp. #4032 settled the TOKEN separately — single use is enforced by the claim RPC’s conditional UPDATE, so rotation buys nothing; this covers the identity half it left open.',
  },
  {
    table: 'vendor_review_appeals',
    column: 'decided_by_admin',
    why: 'Which admin ruled on the appeal. A staff stamp; the appeal itself is the reviewer’s and is deleted.',
  },
  {
    table: 'vendor_event_access_grants',
    column: 'granted_by',
    why: 'Who issued the access grant. Deleting on this would revoke a THIRD PARTY’s access — the event_delegates lesson.',
  },

  // ── batch 6, settled 2026-08-02 · mostly staff stamps on platform config ──
  {
    table: 'event_schedule_suggestions',
    column: 'resolved_by_user_id',
    why: 'Who accepted or declined a vendor’s timeline suggestion. The couple’s decision stamp; the suggestion itself is handled separately.',
  },
  {
    table: 'feature_policy',
    column: 'updated_by_admin_id',
    why: 'Which admin last changed a feature’s policy. One row per feature slug — platform config with a staff stamp on it.',
  },
  {
    table: 'force_majeure_flags',
    column: 'couple_user_id',
    why: 'Who raised the force-majeure flag. The flag is a two-party dispute record and the vendor’s side must survive.',
  },
  {
    table: 'force_majeure_flags',
    column: 'admin_handler_user_id',
    why: 'Which admin handled it. A staff stamp on the same record.',
  },
  {
    table: 'founder_seats',
    column: 'granted_by',
    why: 'Who granted the seat. An actor stamp — the seat itself is the holder’s and is deleted separately.',
  },
  {
    table: 'homepage_background_videos',
    column: 'updated_by_admin_id',
    why: 'Which admin last swapped a homepage clip. Six seeded rows of marketing config.',
  },
  {
    table: 'manpower_gigs',
    column: 'posted_by_user_id',
    why: 'Who posted the gig. A host↔vendor business record read by both; only the poster’s identity goes.',
  },
  {
    table: 'moodboard_library_assets',
    column: 'uploaded_by',
    why: 'Who contributed an asset to the SHARED platform library. The asset stays for everyone else.',
  },
  {
    table: 'owner_alerts',
    column: 'acknowledged_by',
    why: 'Which staff member acknowledged an internal ops alert. The alert is about the PLATFORM, not a person.',
  },
  {
    table: 'event_egift_methods',
    column: 'created_by_user_id',
    why: '⚠ This stamp records WHO FIRST PRESSED ADD, not whose account it is — the update path rewrites the handle and account name but never this column. So a row now holding the OTHER partner’s GCash number still carries the leaver’s uuid. Nulling is the only safe move; see PARTIALLY_PURGED for what is deliberately retained.',
  },
] as const;

/**
 * Rows whose whole reason for existing is the subject, keyed by a column the
 * generic OWN_ROW_DELETES list cannot express (a non-`user_id` name, or no FK).
 * Deleting the row IS the erasure here — keeping it would be keeping a dossier
 * on someone who asked to be forgotten.
 */
export const SUBJECT_ROW_DELETES: ReadonlyArray<{
  table: string;
  column: string;
  why: string;
}> = [
  {
    table: 'vendor_lock_proposals',
    column: 'proposed_by_user_id',
    why: 'A proposal the subject personally raised. NOT NULL and ON DELETE CASCADE — the schema’s own answer is that it dies with the account; erasure just never issued the delete that would have fired it.',
  },
  {
    table: 'vendor_feature_recommendations',
    column: 'recommended_by_user_id',
    why: '⚠ NOT NULL with NO FK — nothing can null it and nothing would cascade it. The row is the subject’s own suggestion, authored by them and about their own opinion.',
  },
  {
    table: 'vendor_web_dossiers',
    column: 'requested_by',
    why: 'A verbatim snapshot of the subject’s own vendor profile, taken at their request. The row is ABOUT them, so it goes with them.',
  },
  {
    table: 'event_delegates',
    column: 'delegate_user_id',
    why: 'CASCADE + NOT NULL — the schema’s own verdict that the row dies with the account. It is the record of THIS person’s access; erasure just never issued the delete that would have fired it. ⚠ Only this column: granted_by/revoked_by are actor stamps and are nulled instead.',
  },
  {
    table: 'person_stewardships',
    column: 'steward_user_id',
    why: 'CASCADE + NOT NULL — the row records that THIS person stewards someone. The ward’s own record lives on people.claimed_by_user_id and is untouched; the transfer audit survives via ON DELETE SET NULL.',
  },

  // ── batch 3 · every one of these is CASCADE + NOT NULL, or has no FK at all ──
  {
    table: 'creator_chapters',
    column: 'user_id',
    why: 'CASCADE + NOT NULL. A creator chapter is the subject’s own body of work on the platform.',
  },
  {
    table: 'lead_token_holds',
    column: 'holder_user_id',
    why: 'CASCADE + NOT NULL. A hold the subject personally placed; it expires on its own and holds no counterparty record.',
  },
  {
    table: 'vendor_date_waitlist',
    column: 'user_id',
    why: 'CASCADE + NOT NULL. The subject asked to be told when a date frees up — a standing request to CONTACT them, which must not outlive the account. Leaving it would email an erased person.',
  },
  {
    table: 'vendor_creator_offers',
    column: 'creator_user_id',
    why: 'CASCADE + NOT NULL — the offer is addressed TO this creator, so the row is about them. Its holder side is an actor stamp and is nulled instead.',
  },
  {
    table: 'vendor_invites',
    column: 'invited_by_user_id',
    why: 'CASCADE + NOT NULL — the schema’s own verdict that an invitation dies with whoever sent it. The claimed side is a stamp and is nulled, so a store that already accepted keeps its record.',
  },
  {
    table: 'coordinator_broadcasts',
    column: 'sender_user_id',
    why: '⚠ NOT NULL with NO FK — nulling is impossible (Postgres rejects it and voids the whole statement) and nothing would cascade. The row is 1–500 chars of prose the subject typed to the couple’s guests on a day now long past; same call as chat_messages, where authored prose goes and the thread stays.',
  },

  // ── batch 4, settled 2026-08-02 ──
  {
    table: 'event_vendor_working_notes',
    column: 'author_user_id',
    why: '⚠ NOT NULL with NO FK — nulling would be rejected and would void the statement. The row is free prose the subject wrote about a booking; same call as chat_messages and coordinator_broadcasts.',
  },
  {
    table: 'referral_codes',
    column: 'owner_user_id',
    why: 'CASCADE + NOT NULL, and UNIQUE — one code per account, so the row is strictly 1:1 with the subject and co-owned by nobody.',
  },
  {
    table: 'referral_redemptions',
    column: 'referred_user_id',
    why: 'CASCADE + NOT NULL. The row cannot exist without both parties, and the schema says it dies with either.',
  },
  {
    table: 'referral_redemptions',
    column: 'referrer_user_id',
    why: 'CASCADE + NOT NULL, the other side of the same row. Both are subject columns; neither could be nulled even as a fallback.',
  },
  {
    table: 'vendor_admin_motion_votes',
    column: 'voter_user_id',
    why: 'CASCADE + NOT NULL, and half the PRIMARY KEY — a row IS one named person’s single ballot, with no shared payload in it.',
  },
  // ── final batch ──
  {
    table: 'vendor_team_members',
    column: 'user_id',
    why: 'CASCADE + NOT NULL — the row IS this person’s seat in a store, and a seat is a credential that must not outlive the account. ⚠ Collides with the open VENDOR_LAST_ADMIN question: a store whose only admin leaves. That is a product decision about the STORE, not a reason to keep a departed person’s access.',
  },
  {
    table: 'vendor_member_token_wallets',
    column: 'user_id',
    why: 'CASCADE + NOT NULL — a personal, non-transferable balance mixing purchases, admin comps and escrow refunds. An earlier pass called it “lawful retention (a token purchase)” and was refuted: the money history lives in vendor_token_purchases and the redemption logs, which are untouched.',
  },
  {
    table: 'vendor_review_appeals',
    column: 'reviewer_user_id',
    why: 'CASCADE + NOT NULL — the appeal is a dossier about this reviewer’s own review. Nulling is impossible and would void the statement.',
  },
  {
    table: 'vendor_event_access_grants',
    column: 'grantee_user_id',
    why: 'CASCADE + NOT NULL — the row is THIS person’s access to an event. Its granted_by side is an actor stamp and is nulled instead, so nobody else loses access.',
  },

  // ── batch 6 ──
  {
    table: 'event_schedule_suggestions',
    column: 'suggested_by_user_id',
    why: '⚠ NOT NULL with NO FK — nulling is rejected and would void the statement. The row is the vendor’s own proposal; its resolution stamp is nulled instead, so the couple’s decision record is not disturbed.',
  },
  {
    table: 'founder_seats',
    column: 'user_id',
    why: 'CASCADE + NOT NULL — a founder seat is a per-person entitlement, not config. The row is the record that THIS person holds one.',
  },
  {
    table: 'founder_time_log',
    column: 'user_id',
    why: 'CASCADE + NOT NULL — hours logged BY this person. An internal-team member’s erasure request reaches their own timesheet like anyone else’s.',
  },
  {
    table: 'community_members',
    column: 'user_id',
    why: 'CASCADE + NOT NULL — a membership row is the record of THIS person belonging to a community.',
  },
  {
    table: 'coordinator_feature_recommendations',
    column: 'recommended_by_user_id',
    why: '⚠ NOT NULL with NO FK — nulling is rejected by Postgres and would void the whole statement, and no clause could ever clear it. The row is the subject’s own suggestion.',
  },
  {
    table: 'vendor_admin_motions',
    column: 'target_user_id',
    why: 'CASCADE + NOT NULL — the motion is ABOUT this person’s admin standing. ⚠ DELIBERATELY NOT proposed_by, which is also CASCADE + NOT NULL: deleting a motion because the subject PROPOSED it would destroy a governance record about a THIRD PARTY. The cost is recorded honestly — see the residual note below.',
  },
] as const;

/**
 * ⚠ RESIDUAL, KNOWN AND ACCEPTED: `vendor_admin_motions.proposed_by`.
 *
 * It is CASCADE + NOT NULL like `target_user_id`, so the schema's own verdict is
 * that the motion dies with its proposer too. We deliberately do NOT delete on
 * it, because a motion is a governance record ABOUT its target — removing it
 * because the PROPOSER left would erase a third party's record of a demotion
 * that happened. That is the `event_delegates` over-deletion in a different suit.
 *
 * The cost: after erasure, a motion the subject proposed still carries their
 * uuid, and NOT NULL means it cannot be nulled instead. Neither option is clean.
 * Written down rather than quietly picked, because a silent residual is how the
 * first 78 got classified wrong.
 */
export const KNOWN_RESIDUAL_SUBJECT_UUIDS: ReadonlyArray<{ column: string; why: string }> = [
  {
    column: 'vendor_admin_motions.proposed_by',
    why: 'Deleting on it would destroy a governance record about the motion’s TARGET; NOT NULL forecloses nulling. Needs a product/DPO call on whether a proposer’s identity may be retained in a peer-governance record.',
  },
] as const;

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
/**
 * SEATS LEFT PERMANENTLY TAKEN BY A GHOST — and why freeing them REQUIRES
 * rotating the token in the same statement.
 *
 * ── THE DEFECT ─────────────────────────────────────────────────────────────
 * Erasure names neither of these tables (verified — they had zero references
 * in this file), so `claimer_user_id` survives as a dangling uuid pointing at
 * a deleted account. Both claim paths refuse a row that already has a claimer:
 *
 *     if (seat.claimer_user_id) return 'taken';     // app/papic/actions.ts
 *     if (cam.claimer_user_id)  return 'taken';     // app/panood/actions.ts
 *
 * So the couple paid for a Papic seat that NOBODY can ever claim again. It is
 * held by someone who no longer exists, and RA 10173 obliges us to clear that
 * reference regardless.
 *
 * ── ⚠ WHY THE OBVIOUS FIX IS THE ACTUAL SECURITY DEFECT ────────────────────
 * Nulling `claimer_user_id` alone — the one-line fix, and what every other
 * construct in this file would do — flips the row back to `claimable`. The
 * erased person's QR is still printed and still in their hands, and it points
 * at this exact token. Freeing the seat WITHOUT rotating hands it back to them.
 *
 * The rotation is therefore not the fix. It is the PRECONDITION that makes the
 * fix safe, and the two must land in one statement or the row is briefly a live
 * door. That is why this is neither a null-map nor a row-delete.
 *
 * ⚠ THE TOKEN IS REPLACED, NOT NULLED. Nulling leaves a seat that can never be
 * re-issued, and `claim_qr_token` is NOT NULL on both tables, so it would throw.
 * `reissuePanoodCameraToken()` (lib/panood-camera-seats.ts) already did exactly
 * this pairing for one table; this puts it on the erasure path, where it was
 * missing.
 *
 * ── WHY ONLY TWO TABLES ────────────────────────────────────────────────────
 * `vendor_invites` and `vendor_locked_qr_tokens` carry claim tokens too and were
 * in the first draft. They are excluded for DIFFERENT reasons, and an earlier
 * version of this comment gave a wrong one for both — see the PR.
 *
 * `vendor_locked_qr_tokens` — SETTLED. Single-use is enforced by the conditional
 * `UPDATE … WHERE token = p_token AND status = 'pending'` inside
 * `vendor_claim_locked_qr` (20270427212060), so a claimed token cannot re-grant
 * the entitlement to any bearer no matter who holds it. Rotation buys nothing.
 * (`page.tsx:94`'s status check is real but is only ONE of four token-keyed
 * readers — it was never what made the token safe.)
 *
 * `vendor_invites` — UNRESOLVED, deliberately out of scope here. A claimed
 * invite token is NOT dead: `resolveClaimContextForService`
 * (lib/vendor-invite-actions.ts) takes a claimed token as its INTENDED input and
 * returns the couple's `coupleDisplayName` through the RLS-bypassing admin
 * client. So a residual credential does survive erasure. It is left alone
 * because rotating it changes the guided first-service flow, which is a product
 * decision and not this change's to make — and because clearing
 * `claimed_by_user_id`, which the first draft did, would not have closed it
 * anyway while breaking the vendor's "Already locked in" branch and orphaning
 * `claimed_event_id`.
 *
 * ⚠ THE DATABASE CAN PERFORM THE UNCLAIM WITHOUT US. `paparazzi_seats
 * .claimer_user_id` is `REFERENCES auth.users(id) ON DELETE SET NULL` and
 * `claim_qr_token` is not in that clause, so ANY hard-delete of the auth row
 * unclaims the seat and leaves the printed QR live. `runAnonDraftSweep()`
 * (lib/anon-draft-sweep.ts) does exactly that to login-free claimers after 30
 * days; it now rotates through this same constant BEFORE deleting. Any future
 * caller of `auth.admin.deleteUser` must do the same.
 *
 * Found 2026-08-01.
 */
export const CLAIM_TOKEN_ROTATIONS: ReadonlyArray<{
  table: string;
  /** The column holding the printed credential. Replaced, never nulled. */
  tokenColumn: string;
  /** How the erased subject is linked to the row. */
  subjectColumn: string;
  /**
   * Primary key, used to rotate ONE ROW AT A TIME. Both token columns are
   * UNIQUE, so a single table-wide update would write one value to every row
   * the person claimed and trip the index the moment they held two seats.
   */
  idColumn: string;
  /** Columns returning the row to an unclaimed state alongside the rotation. */
  clear: Readonly<Record<string, null>>;
  reason: string;
}> = [
  {
    table: 'paparazzi_seats',
    tokenColumn: 'claim_qr_token',
    idColumn: 'id',
    subjectColumn: 'claimer_user_id',
    clear: { claimer_user_id: null, claimed_at: null },
    reason:
      'A Papic crew seat \u2014 the couple\u2019s paid entitlement, so the row must survive. seatClaimability() returns \u201ctaken\u201d while claimer_user_id is set, so erasure left the seat unclaimable forever; freeing it without rotating would hand it back to the erased person\u2019s printed QR.',
  },
  {
    table: 'panood_camera_operators',
    tokenColumn: 'claim_qr_token',
    idColumn: 'id',
    subjectColumn: 'claimer_user_id',
    clear: { claimer_user_id: null, claimed_at: null },
    reason:
      'A Live Studio camera slot. Identical shape and identical cameraClaimability() gate, and reissuePanoodCameraToken() already paired the unclaim with a rotation \u2014 erasure simply never called it.',
  },
] as const;

/**
 * A fresh URL-safe claim token — 24 random bytes, base64url, unpadded. Matches
 * the format `generateCameraClaimToken()` produces, so a rotated value is
 * indistinguishable from a freshly issued one to every reader.
 */
export function freshClaimToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

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
    table: 'event_access_requests',
    column: 'requester_user_id',
    why: 'The subject’s own asks for access to an event, including a free-text note they wrote. Their request, their words — and the grant it may have produced lives in event_moderators, which erasure handles separately. `decided_by_user_id` needs no entry: it is ON DELETE SET NULL, and answering someone else’s request is an action ON their record, not personal data OF the answerer.',
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
  // DERIVED from AUTHOR_UUID_NULLS — one entry per table, columns merged, so a
  // typo is a G1 phantom-column failure instead of a silent PGRST204 that voids
  // the whole update and gets swallowed by the best-effort step().
  ...AUTHOR_UUID_NULLS.reduce<Record<string, string[]>>((acc, r) => {
    (acc[r.table] ??= []).push(r.column);
    return acc;
  }, {}),
  // Written with literal payloads inside purge.ts (tombstone strings, not
  // reusable constants) — named here so the guardrail still checks them.
  guest_claims: ['claimer_name', 'claimer_email', 'otp_sent_to'],
  help_messages: ['sender_email', 'sender_name', 'subject', 'body'],
  guests: ['photo_url', 'photo_source', 'photo_updated_at'],
  // DERIVED from CLAIM_TOKEN_ROTATIONS, never re-typed. Hand-copying the column
  // names here would make the guardrail compare two hand-typed lists, which
  // drift together and stay green — the exact failure G1 exists to catch. This
  // way a typo in the rotation is a phantom-column failure, not a silent
  // PGRST204 that the best-effort purge logs and walks past.
  ...Object.fromEntries(
    CLAIM_TOKEN_ROTATIONS.map((r) => [
      r.table,
      [r.tokenColumn, ...Object.keys(r.clear)],
    ]),
  ),
};

/** Tables erasure deletes rows from, with the column it filters on. */
export const ERASURE_ROW_DELETES: Readonly<Record<string, readonly string[]>> = {
  // DERIVED from SUBJECT_ROW_DELETES — see the note on ERASURE_COLUMN_WRITES.
  ...Object.fromEntries(SUBJECT_ROW_DELETES.map((r) => [r.table, [r.column]])),
  chat_messages: ['sender_user_id'],
  user_face_profiles: ['user_id'],
  push_subscriptions: ['user_id'],
  vendor_push_tokens: ['vendor_profile_id'],
  // Purged inline in purge.ts through the subject's vendor profile — it has NO
  // user column, so the generic .eq(column, targetUserId) loop cannot reach it.
  vendor_ig_connections: ['vendor_profile_id'],
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
  // DERIVED — every column the eleven-leak purge filters on.
  ...AUTHOR_UUID_NULLS.reduce<Record<string, string[]>>((acc, r) => {
    (acc[r.table] ??= []).push(r.column);
    return acc;
  }, {}),
  ...Object.fromEntries(SUBJECT_ROW_DELETES.map((r) => [r.table, [r.column]])),
  // DERIVED — the rotation filters on the subject to FIND rows and on the
  // primary key to rotate each one. Both must be real columns or the select
  // returns nothing and the whole step silently no-ops.
  ...Object.fromEntries(
    CLAIM_TOKEN_ROTATIONS.map((r) => [r.table, [r.subjectColumn, r.idColumn]]),
  ),
  // Per-partner paperwork scoping (owner ruling 2026-07-26) — fail closed.
  event_paperwork: ['event_id', 'subject_user_id'],
  // The fail-closed residue probe reads oauth_grants by event + attribution.
  oauth_grants: ['event_id', 'granted_by_user_id'],
};
