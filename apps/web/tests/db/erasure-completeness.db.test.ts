/**
 * RA 10173 — "delete my account" actually finishes.
 *
 * Runs the REAL `lib/erasure/purge.ts` (the same function the admin Delete
 * button and the self-serve erasure queue both call) against the REAL schema,
 * every migration replayed into PGlite, and then checks three things that pull
 * in opposite directions:
 *
 *   1. the leaving user's own data is GONE;
 *   2. the co-partner's and the host's shared data SURVIVES — over-deletion is a
 *      real harm too, and it is the failure mode nobody writes a test for;
 *   3. a failing step still lets the account delete, and still leaves an audit
 *      row.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠ WHY THIS TEST EXISTS AT ALL — the bug it is built around
 *
 * `eraseUserAccount` addressed columns by name through an untyped client. FIVE
 * of those names were not columns:
 *   · events.owner_email, events.owner_display_name (aliases of an admin VIEW)
 *   · users.venue_address, users.venue_name (they live on `events`)
 *   · users.social_post_url (it lives on `vendor_profiles`)
 * PostgREST rejects the WHOLE update on one unknown key, so BOTH statements
 * failed in full, in production, from the day the names were added:
 *   · no birth data, photo-delivery email or OAuth token was ever cleared;
 *   · no identity PII was ever anonymized — and `deleted_at`, which the
 *     middleware and dashboard layouts use to lock the account out, was NEVER
 *     STAMPED. The account stayed live.
 * Nothing surfaced it: best-effort logged `erasure_purge_failed` and moved on,
 * and no account has ever actually been deleted in prod (1 signup, 0 deletion
 * requests), so it was latent rather than exploited.
 *
 * ⇒ ASSERTION 1 BELOW — "zero erasure_*_failed rows after a full run" — is the
 *   regression test for that entire class, and it only works because the purge
 *   here is the real one hitting the real schema.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ── WHY THIS TEST IS NOT VACUOUS ────────────────────────────────────────────
 * This repo has shipped vacuous DB tests twice, so the defences are stated and
 * checked, not assumed. Note the vacuity risk here is NOT the usual one: the
 * erasure path runs as `service_role` BY DESIGN (documented in purge.ts — it
 * must not be subject to the leaving user's half-torn-down RLS), so "the
 * connection owns the table and skips RLS" is the intended production
 * behaviour, not a harness artifact. META-1 pins that explicitly so nobody
 * later reads a passing run as evidence about RLS. The risks that DO apply
 * here are a harness that silently swallows errors, or a seed that never wrote
 * — both are directly disproved:
 *
 *   META-1 · the session is service_role, is a BYPASSRLS superuser-equivalent,
 *            and that is DELIBERATE. Recorded so the test's scope is unambiguous.
 *   META-2 · the adapter really REJECTS an unknown column, returning it as an
 *            error rather than throwing or ignoring it. If this ever passes an
 *            unknown column, assertion 1 becomes meaningless and every phantom
 *            column walks straight through.
 *   META-3 · the seed really landed — every table asserted "empty after" is
 *            asserted NON-empty before. A purge of nothing passes trivially.
 *   META-4 · the purge really executed — it issued statements against the
 *            tables in question.
 *
 * ── NEUTRALISATION PROOF (run 2026-07-26; each mutation reverted + re-verified) ─
 *   Baseline: 32 subtests, 32 pass (and 293/293 for the whole test:db suite).
 *   N1–N4 were run against the 25-subtest baseline; N5–N8 against 32.
 *
 *   N1 · THE WHOLE POINT — re-create the shipped bug. Put all five phantom
 *        columns back: `owner_email` + `owner_display_name` into
 *        EVENTS_OWNER_PII_NULLS, `venue_address` + `venue_name` +
 *        `social_post_url` into USERS_ANONYMIZE_NULLS.
 *        → 4 of 25 FAIL: [1] the zero-failed-audit-rows assertion,
 *          [2a] the events birth-data + credential assertion, [2e] the users
 *          anonymize + deleted_at assertion, and [4] the resilience test (whose
 *          precondition is that the first run left no failures).
 *        → the STATIC guardrail also goes red: G1 fails naming all five columns.
 *        → the unit suite also goes red: "the phantom columns are GONE".
 *        Three independent layers catch it; none of them existed before.
 *
 *        Worth noting WHY only 4 and not more: [2b] (wizard_state) still passes
 *        under N1. That is the step-splitting doing its job — wizard_state is
 *        now its own statement, so a phantom column in the sibling update no
 *        longer voids it. Before the split, one bad name took everything with it.
 *
 *   N2 · Neuter the wizard scrub — make `scrubWizardState` return its input.
 *        → 1 of 25 FAIL here ([2b], the CENOMAR + payload-key assertion), and
 *          7 of 11 in lib/erasure/coverage.test.ts. Every SURVIVAL subtest still
 *          passes, which is the proof they assert preservation rather than
 *          quietly re-asserting deletion.
 *
 *   N3 · Neuter the SURVIVAL side — make the scrub return `{}` for every entry
 *        (the scorched-earth version a careless fix would ship).
 *        → 1 of 25 FAILS, and it is [3b] "the CO-PARTNER'S setup progress
 *          survives". Every deletion assertion still passes. This is the control
 *          that matters most: over-deletion is invisible to a suite that only
 *          ever checks that data is gone, and here it is not.
 *
 *   N4 · Neuter the harness — make the adapter's catch block return
 *        `{ data: [], error: null }` instead of surfacing the error.
 *        → 2 of 25 FAIL: META-2 and [4]. Everything else stays green, which is
 *          exactly why META-2 has to exist: a swallow-everything adapter would
 *          make assertion [1] green forever and this whole file worthless.
 *
 *   ── added 2026-07-26 with per-partner scoping ──
 *
 *   N5 · Re-create the OVER-DELETION bug: drop
 *        `.eq('subject_user_id', targetUserId)` from both the paperwork lookup
 *        and the paperwork update, leaving `.in('event_id', eventIds)` — the
 *        shipped filter.
 *        → 3 of 32 FAIL, and all three are SURVIVAL assertions: [3g] the
 *          co-partner's CENOMAR reference and scan pointer are destroyed
 *          (expected 'PSA-CENOMAR-2026-0044556', actual null), [3h] the
 *          unattributed PSA row is destroyed, [3i] the couple's joint marriage
 *          licence is destroyed. Every DELETION assertion still passes — which
 *          is the point: the old code looked completely correct to a suite that
 *          only checks that the leaver's data is gone.
 *
 *   N6 · Re-create the same bug on credentials: move the grant delete back
 *        below the owned-event lookup and scope it `.in('event_id', eventIds)`.
 *        → 2 of 32 FAIL: [3j] the co-partner's Google refresh token is revoked
 *          (expected 'PARTNER-REFRESH-TOKEN', actual null), and [3l], because
 *          with every grant deleted there is no unattributed row left to report
 *          as retained — the audit note and the survival it describes are the
 *          same fact seen twice.
 *
 *   N7 · Remove the `purgeVendorVerificationDocuments` call from
 *        `eraseUserAccount`.
 *        → 1 of 32 FAILS: [2n]. This is the state the codebase shipped in — a
 *          vendor's government ID, DTI certificate and BIR 2303 surviving
 *          account deletion in the private bucket — and it is worth noting that
 *          the erasure GUARDRAIL stays green under N7. It cannot see this
 *          table (no subject column), so this db test is the only layer that
 *          catches it.
 *
 *   N8 · Neuter `collectStoredAssetRefs` to the obvious implementation: read
 *        `r2_key` off each top-level slot object.
 *        → 1 of 32 FAILS: [2n], naming portfolio-1.jpg. The nested array slots
 *          (`portfolio_samples`) are exactly what a known-key read misses, and
 *          the missed refs are R2 objects left in the private bucket with the
 *          row that named them wiped.
 *
 * If N1 or N5 ever passes, this suite has gone vacuous — stop and fix the
 * harness before touching the purge.
 *
 * Run: npm run test:db  (or npx tsx --test tests/db/erasure-completeness.db.test.ts)
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { createPgliteRestClient, type PgliteRestClient } from './pglite-postgrest';
import { eraseUserAccount, type ErasureIo } from '../../lib/erasure/purge';

let replay: ReplayResult;
let db: PGlite;
let rest: PgliteRestClient;

/** Everything the erasure handed to storage for deletion. */
let deletedStoredAssets: string[] = [];
let deletedPublicUrls: string[] = [];
let sessionRevokedFor: string[] = [];

const SUBJECT = '2a000000-0000-4000-8000-000000000001';
const PARTNER = '2a000000-0000-4000-8000-000000000002';
const OUTSIDER = '2a000000-0000-4000-8000-000000000003';
const ADMIN = '2a000000-0000-4000-8000-0000000000ad';
const EVENT = '2b000000-0000-4000-8000-000000000001';
const VENDOR_PROFILE = '2c000000-0000-4000-8000-000000000001';
const THREAD = '2d000000-0000-4000-8000-000000000001';
const SUBJECT_GUEST = '2e000000-0000-4000-8000-000000000001';
const OUTSIDER_VENDOR_PROFILE = '2c000000-0000-4000-8000-000000000002';

const SUBJECT_EMAIL = 'leaving.person@example.com';
const CENOMAR_REF = 'PSA-CENOMAR-2026-0099887';
const SELFIE_REF = 'r2://setnayan-media/faces/subject-selfie.jpg';
const PAPERWORK_REF = 'r2://setnayan-media/paperwork/cenomar-scan.pdf';
const PROFILE_PHOTO_REF = 'r2://setnayan-media/profile/subject.jpg';
const CHAT_ATTACHMENT_URL = 'https://media.setnayan.com/chat/thread-1/contract-draft.pdf';

// ── the CO-PARTNER'S civil-registry documents · MUST SURVIVE ────────────────
// The whole point of per-partner scoping. These belong to the person who is
// STAYING; an event-wide purge destroyed them, and nothing brings a PSA
// document back.
const PARTNER_CENOMAR_REF = 'PSA-CENOMAR-2026-0044556';
const PARTNER_PAPERWORK_REF = 'r2://setnayan-media/paperwork/partner-cenomar-scan.pdf';
// A per-partner document nobody attributed, and a JOINT one that by definition
// has no single subject. Both must survive: an unattributable row is not ours
// to destroy.
const UNATTRIBUTED_PSA_REF = 'PSA-BIRTH-2026-0011223';
const JOINT_LICENCE_REF = 'LGU-ML-2026-0055';

// ── vendor verification: the heaviest identity documents in the product ─────
const GOV_ID_REF = 'r2://setnayan-vendor-verification/leaving-shop/government-id.jpg';
const DTI_REF = 'r2://setnayan-vendor-verification/leaving-shop/dti-certificate.pdf';
// Nested one array deep — the shape a known-key read would silently miss.
const PORTFOLIO_REF_A = 'r2://setnayan-vendor-verification/leaving-shop/portfolio-1.jpg';
const PORTFOLIO_REF_B = 'r2://setnayan-vendor-verification/leaving-shop/portfolio-2.jpg';
// Another vendor's government ID, on the same table. MUST SURVIVE.
const OUTSIDER_GOV_ID_REF = 'r2://setnayan-vendor-verification/outsider-shop/government-id.jpg';

const SUBJECT_DOC_UPLOADS = {
  government_id: { r2_key: GOV_ID_REF, uploaded_at: '2026-02-01T00:00:00Z' },
  dti_certificate: { r2_key: DTI_REF, uploaded_at: '2026-02-02T00:00:00Z' },
  bir_2303: null,
  portfolio_samples: [{ r2_key: PORTFOLIO_REF_A }, { r2_key: PORTFOLIO_REF_B }],
  social_media: { instagram: 'https://instagram.com/manila-lens' },
  client_references: [{ name: 'Prior Client', contact: '+63 917 222 2222' }],
};

/** A wizard_state carrying one of EVERY key shape the writers can produce. */
const SEEDED_WIZARD_STATE = {
  set_wedding_date: { completed_at: '2026-01-02T00:00:00Z', date: '2027-05-05', reasons_count: 3 },
  set_estimated_pax: { completed_at: '2026-01-03T00:00:00Z', pax: 180 },
  set_estimated_budget: { completed_at: '2026-01-04T00:00:00Z', centavos: 93_000_000 },
  monogram: { completed_at: '2026-01-05T00:00:00Z', style: 'serif', initials: 'A & B' },
  create_website: { completed_at: '2026-01-06T00:00:00Z', slug: 'anna-and-ben', visibility: 'public' },
  mood_board: { completed_at: '2026-01-07T00:00:00Z', palette_name: 'Dusty Rose' },
  finalize_seatplan: { completed_at: '2026-01-08T00:00:00Z', assigned_count: 150, total_rsvp_count: 180 },
  engagement_prenup_shoot: { completed_at: '2026-01-09T00:00:00Z', scheduled_date: '2027-02-14' },
  reception_venue: {
    completed_at: '2026-01-10T00:00:00Z',
    event_vendor_id: 'ev-1',
    marketplace_vendor_id: 'mv-1',
  },
  draft_guest_list: { in_flight_since: '2026-01-11T00:00:00Z', last_added_at: '2026-01-11T00:00:00Z', last_added_count: 42 },
  // ── the ones that started this: civil-registry references in `meta` ──
  cenomar_bride: { in_flight_since: '2026-01-12T00:00:00Z', meta: { reference_no: CENOMAR_REF, requested_at_branch: 'PSA Quezon City' } },
  marriage_license: { in_flight_since: '2026-01-13T00:00:00Z', meta: { psa_ref: 'PSA-ML-2026-77', officiant_contact: '+63 917 000 0000' } },
  // ── a key nobody has invented yet: the allow-list must strip it too ──
  church_paperwork: { in_flight_since: '2026-01-14T00:00:00Z', meta_some_future_field: 'a value added long after this test was written' },
};

const io: ErasureIo = {
  deleteStoredAsset: async (ref) => {
    deletedStoredAssets.push(ref);
  },
  deletePublicAssetUrl: async (url) => {
    deletedPublicUrls.push(url);
  },
  revokeAllSessions: async (userId) => {
    sessionRevokedFor.push(userId);
    return { ok: true, sessionsRevoked: 1 };
  },
  now: () => new Date('2026-07-26T12:00:00.000Z'),
};

/** Scalar helper. */
async function one<T = unknown>(sql: string, params: unknown[] = []): Promise<T> {
  const res = await db.query<Record<string, T>>(sql, params);
  const row = res.rows[0];
  return row ? (Object.values(row)[0] as T) : (undefined as T);
}
async function count(sql: string, params: unknown[] = []): Promise<number> {
  return Number(await one<string | number>(sql, params));
}

/** Row counts captured BEFORE the purge, so META-3 can prove the seed landed. */
const before_: Record<string, number> = {};
/** How many wizard TASKS the seed wrote — the survival check compares against it. */
let seededWizardTaskCount = 0;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
      ('${SUBJECT}', '${SUBJECT_EMAIL}',
       '{"full_name":"Leaving Person","email":"${SUBJECT_EMAIL}","avatar_url":"https://lh3.googleusercontent.com/a/subject","sub":"google-oauth2|1234"}'::jsonb),
      ('${PARTNER}', 'partner@example.com', '{"full_name":"Staying Partner"}'::jsonb),
      ('${OUTSIDER}', 'outsider@example.com', '{}'::jsonb),
      ('${ADMIN}',   'admin@setnayan.com',  '{}'::jsonb);

    -- public.users rows already exist: the on_auth_user_created trigger mints one
    -- per auth.users insert. Upsert the PII on top rather than fighting it.
    INSERT INTO public.users (user_id, email, display_name, phone, profile_photo_url, slug,
                              religion, civil_status, sex, address_normalized, public_profile_enabled)
    VALUES
      ('${SUBJECT}', '${SUBJECT_EMAIL}', 'Leaving Person', '+63 917 111 1111',
       '${PROFILE_PHOTO_REF}', 'leaving-person', 'catholic', 'single', 'female',
       '12 sampaguita st quezon city', TRUE),
      ('${PARTNER}', 'partner@example.com', 'Staying Partner', NULL, NULL, 'staying-partner',
       NULL, NULL, NULL, NULL, TRUE),
      ('${OUTSIDER}', 'outsider@example.com', 'Someone Else', NULL, NULL, NULL, NULL, NULL, NULL, NULL, TRUE),
      ('${ADMIN}', 'admin@setnayan.com', 'HQ', NULL, NULL, NULL, NULL, NULL, NULL, NULL, FALSE)
    ON CONFLICT (user_id) DO UPDATE SET
      email = EXCLUDED.email, display_name = EXCLUDED.display_name, phone = EXCLUDED.phone,
      profile_photo_url = EXCLUDED.profile_photo_url, slug = EXCLUDED.slug,
      religion = EXCLUDED.religion, civil_status = EXCLUDED.civil_status, sex = EXCLUDED.sex,
      address_normalized = EXCLUDED.address_normalized,
      public_profile_enabled = EXCLUDED.public_profile_enabled;

    -- ── the shared wedding ───────────────────────────────────────────────────
    INSERT INTO public.events (event_id, display_name, event_type, ceremony_type, venue_setting,
                               bride_name, groom_name, venue_name, venue_address,
                               partner_a_birth_date, partner_a_birth_time,
                               partner_b_birth_date, partner_b_birth_time,
                               bazi_birthdata_consent_at,
                               photo_delivery_account_email, photo_delivery_oauth_token_encrypted,
                               wizard_state)
    VALUES ('${EVENT}', 'Anna & Ben', 'wedding', 'civil', 'banquet_hall',
            'Anna', 'Ben', 'Blue Leaf Filipinas', '12 McKinley Rd, Taguig',
            '1994-03-02', '07:30', '1993-11-19', '21:05', now(),
            '${SUBJECT_EMAIL}', 'ENCRYPTED-GOOGLE-TOKEN',
            '${JSON.stringify(SEEDED_WIZARD_STATE)}'::jsonb);

    INSERT INTO public.event_members (event_id, user_id, member_type, guest_id) VALUES
      ('${EVENT}', '${SUBJECT}', 'couple', NULL),
      ('${EVENT}', '${PARTNER}', 'couple', NULL);

    -- ── civil-registry paperwork · FOUR rows, one per scoping case ──────────
    -- The table is keyed by event_id only, so before subject_user_id existed
    -- the purge took all four. Rows 2-4 are the harm that caused.
    INSERT INTO public.event_paperwork (event_id, document_type, status, tracking_reference,
                                        document_r2_key, notes, subject_user_id)
    VALUES
      -- (a) the LEAVER's own document → must be erased
      ('${EVENT}', 'cenomar_partner_1', 'in_processing', '${CENOMAR_REF}', '${PAPERWORK_REF}',
       'Picked up by Anna on the 14th', '${SUBJECT}'),
      -- (b) the CO-PARTNER's own document → must SURVIVE
      ('${EVENT}', 'cenomar_partner_2', 'received', '${PARTNER_CENOMAR_REF}', '${PARTNER_PAPERWORK_REF}',
       'Ben collected his on the 20th', '${PARTNER}'),
      -- (c) a per-partner document nobody attributed → must SURVIVE (fail closed)
      ('${EVENT}', 'psa_birth_cert_partner_1', 'requested', '${UNATTRIBUTED_PSA_REF}', NULL,
       'Requested online, unclear who filed it', NULL),
      -- (d) a JOINT document — no single subject exists → must SURVIVE
      ('${EVENT}', 'marriage_license', 'in_processing', '${JOINT_LICENCE_REF}', NULL,
       'Both partners appeared at the LGU', NULL);

    -- ── LIVE Google credentials · three attributions on one event ───────────
    -- UNIQUE (event_id, provider) forces distinct providers; the attribution,
    -- not the provider, is what erasure keys on.
    INSERT INTO public.oauth_grants (event_id, provider, scopes, refresh_token, access_token,
                                     external_account_id, external_account_display, metadata,
                                     granted_by_user_id)
    VALUES
      -- the LEAVER consented → the credential must not outlive the account
      ('${EVENT}', 'drive_photo_delivery', ARRAY['drive.file'], 'REFRESH-TOKEN-STILL-VALID', 'ACCESS-TOKEN',
       'google-subject-1234', '${SUBJECT_EMAIL}',
       '{"account_name":"Leaving Person","picture_url":"https://lh3.googleusercontent.com/a/subject"}'::jsonb,
       '${SUBJECT}'),
      -- the CO-PARTNER's own Google account → must SURVIVE
      ('${EVENT}', 'drive', ARRAY['drive.file'], 'PARTNER-REFRESH-TOKEN', 'PARTNER-ACCESS-TOKEN',
       'google-subject-5678', 'partner@example.com',
       '{"account_name":"Staying Partner"}'::jsonb, '${PARTNER}'),
      -- a pre-attribution grant, and note external_account_display here is a
      -- CHANNEL TITLE, not an email — the concrete reason it is not a user key
      ('${EVENT}', 'youtube', ARRAY['youtube.upload'], 'LEGACY-REFRESH-TOKEN', 'LEGACY-ACCESS-TOKEN',
       'UC_channel_id', 'Anna & Ben Wedding', '{}'::jsonb, NULL);

    INSERT INTO public.oauth_state (state_token, event_id, provider, initiated_by)
    VALUES ('state-abc', '${EVENT}', 'drive_photo_delivery', '${SUBJECT}');

    -- ── the subject's shop ──────────────────────────────────────────────────
    INSERT INTO public.vendor_profiles (vendor_profile_id, user_id, business_name, business_owner_name,
                                        contact_email, hq_address, hq_region, registered_business_name,
                                        registered_address, tin_number, tin_type, screen_name,
                                        screen_name_slug, social_post_url, microsite_about,
                                        registration_number_raw, is_published)
    VALUES ('${VENDOR_PROFILE}', '${SUBJECT}', 'Leaving Person Studio', 'Leaving Person',
            'shop@example.com', '76 sampaguita avenue', 'NCR', 'LP Studio Sole Prop',
            '76 sampaguita avenue, QC', '123-456-789-000', 'individual', 'Manila Lens',
            'manila-lens', 'https://instagram.com/p/abc', 'We shoot weddings in Metro Manila.',
            'DTI-998877', TRUE);

    INSERT INTO public.vendor_push_tokens (vendor_profile_id, token, platform)
    VALUES ('${VENDOR_PROFILE}', 'push-token-xyz', 'web');

    -- ── an UNRELATED vendor's shop, so over-deletion has something to hit ───
    INSERT INTO public.vendor_profiles (vendor_profile_id, user_id, business_name, is_published)
    VALUES ('${OUTSIDER_VENDOR_PROFILE}', '${OUTSIDER}', 'Someone Else Studio', TRUE);

    -- ── vendor verification: government ID / DTI / portfolio, private bucket ─
    -- Keyed by vendor_profile_id. Its only *_user_id column is admin_user_id
    -- (the reviewing STAFF member), which is why the coverage guardrail's
    -- subject detector can never flag this table — see its docstring.
    INSERT INTO public.vendor_verification_applications
      (vendor_profile_id, application_type, status, doc_uploads, docs_complete)
    VALUES
      ('${VENDOR_PROFILE}', 'initial', 'pending_review',
       '${JSON.stringify(SUBJECT_DOC_UPLOADS)}'::jsonb, TRUE),
      ('${OUTSIDER_VENDOR_PROFILE}', 'initial', 'pending_review',
       '{"government_id":{"r2_key":"${OUTSIDER_GOV_ID_REF}"}}'::jsonb, FALSE);

    -- ── chat: the subject's message (with an attachment) + the partner's ────
    INSERT INTO public.chat_threads (thread_id, event_id, vendor_profile_id)
    VALUES ('${THREAD}', '${EVENT}', '${VENDOR_PROFILE}');

    INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, sender_user_id,
                                      sender_role, body, attachment_url, attachment_name)
    VALUES
      ('${THREAD}', '${EVENT}', '${VENDOR_PROFILE}', '${SUBJECT}', 'couple',
       'Here is our budget and the guest list.', '${CHAT_ATTACHMENT_URL}', 'contract-draft.pdf'),
      ('${THREAD}', '${EVENT}', '${VENDOR_PROFILE}', '${PARTNER}', 'couple',
       'Adding my notes on the menu.', NULL, NULL);

    INSERT INTO public.chat_thread_reads (thread_id, user_id) VALUES ('${THREAD}', '${SUBJECT}');

    -- ── guest-side identity + biometrics ────────────────────────────────────
    INSERT INTO public.guests (guest_id, event_id, first_name, last_name, side, group_category,
                               email, photo_url, photo_source)
    VALUES ('${SUBJECT_GUEST}', '${EVENT}', 'Leaving', 'Person', 'bride', 'family',
            '${SUBJECT_EMAIL}', '${SELFIE_REF}', 'selfie');
    UPDATE public.event_members SET guest_id = '${SUBJECT_GUEST}'
      WHERE event_id = '${EVENT}' AND user_id = '${SUBJECT}';

    INSERT INTO public.guest_face_enrollments (event_id, guest_id, asset_url, consent_at)
    VALUES ('${EVENT}', '${SUBJECT_GUEST}', '${SELFIE_REF}', now());

    INSERT INTO public.scan_events (event_id, guest_id, source, scanner_user_id, user_agent, ip_anon)
    VALUES ('${EVENT}', '${SUBJECT_GUEST}', 'browser', '${SUBJECT}', 'Mozilla/5.0 iPhone', '138.84.140.0');

    INSERT INTO public.event_moderators (event_id, user_id, role_subtype, permissions_json,
                                         display_label, invitation_email, invitation_phone)
    VALUES ('${EVENT}', '${SUBJECT}', 'wedding_planner_external', '{}'::jsonb, 'Day-of Coordinator',
            '${SUBJECT_EMAIL}', '+63 917 111 1111');

    -- ── tables whose only cleanup was the (now disarmed) CASCADE ────────────
    INSERT INTO public.notifications (user_id, type, title, body, related_url) VALUES
      ('${SUBJECT}',  'payment_matched', 'Payment of PHP 99 matched', 'The Setnayan team confirmed your payment.', '/dashboard/x/orders/y'),
      ('${OUTSIDER}', 'payment_matched', 'Someone else’s notification', 'Not the subject’s.', '/dashboard/z');

    INSERT INTO public.api_keys (user_id, name, key_prefix, key_hash)
    VALUES ('${SUBJECT}', 'my integration', 'sk_live_ab', 'hash-of-the-key');

    INSERT INTO public.guest_saved_vendors (user_id, vendor_profile_id)
    VALUES ('${SUBJECT}', '${VENDOR_PROFILE}');

    INSERT INTO public.user_follows (follower_user_id, followed_user_id) VALUES
      ('${SUBJECT}',  '${OUTSIDER}'),   -- the subject's OWN outbound list → deleted
      ('${OUTSIDER}', '${SUBJECT}');    -- someone else's list → must SURVIVE

    INSERT INTO public.seating_editor_locks (event_id, holder_user_id, holder_label)
    VALUES ('${EVENT}', '${SUBJECT}', 'Leaving Person');

    INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES ('${SUBJECT}', 'https://push.example/1', 'p256', 'auth');

    INSERT INTO public.user_face_profiles (user_id) VALUES ('${SUBJECT}');

    -- ── pre-signup capture: reachable ONLY by email, no user FK at all ──────
    INSERT INTO public.couple_waitlist_signups (email, full_name, partner_name, ip_address, user_agent)
    VALUES ('${SUBJECT_EMAIL}', 'Leaving Person', 'Staying Partner', '138.84.140.5', 'Mozilla/5.0');
    INSERT INTO public.couple_waitlist_signups (email, full_name)
    VALUES ('someone.else@example.com', 'Someone Else');

    -- A people node already exists for every signed-up account (claimed_by_user_id
    -- is UNIQUE and a signup trigger mints it) — fill in the PII rather than insert.
    UPDATE public.people
       SET display_name = 'Leaving Person', first_name = 'Leaving', last_name = 'Person',
           email = '${SUBJECT_EMAIL}', phone = '+63 917 111 1111'
     WHERE claimed_by_user_id = '${SUBJECT}';
  `);

  before_.notifications = await count(`SELECT count(*) FROM public.notifications WHERE user_id = $1`, [SUBJECT]);
  before_.api_keys = await count(`SELECT count(*) FROM public.api_keys WHERE user_id = $1`, [SUBJECT]);
  before_.oauth_grants = await count(`SELECT count(*) FROM public.oauth_grants WHERE event_id = $1`, [EVENT]);
  before_.paperwork = await count(
    `SELECT count(*) FROM public.event_paperwork WHERE event_id = $1 AND tracking_reference IS NOT NULL`, [EVENT]);
  before_.subjectPaperwork = await count(
    `SELECT count(*) FROM public.event_paperwork WHERE subject_user_id = $1`, [SUBJECT]);
  before_.partnerPaperwork = await count(
    `SELECT count(*) FROM public.event_paperwork WHERE subject_user_id = $1`, [PARTNER]);
  before_.unattributedPaperwork = await count(
    `SELECT count(*) FROM public.event_paperwork WHERE event_id = $1 AND subject_user_id IS NULL`, [EVENT]);
  before_.subjectGrants = await count(
    `SELECT count(*) FROM public.oauth_grants WHERE granted_by_user_id = $1`, [SUBJECT]);
  before_.partnerGrants = await count(
    `SELECT count(*) FROM public.oauth_grants WHERE granted_by_user_id = $1`, [PARTNER]);
  before_.unattributedGrants = await count(
    `SELECT count(*) FROM public.oauth_grants WHERE granted_by_user_id IS NULL`);
  before_.verificationDocs = await count(
    `SELECT count(*) FROM public.vendor_verification_applications
      WHERE vendor_profile_id = $1 AND doc_uploads <> '{}'::jsonb`, [VENDOR_PROFILE]);
  before_.waitlist = await count(`SELECT count(*) FROM public.couple_waitlist_signups WHERE email = $1`, [SUBJECT_EMAIL]);
  before_.subjectMessages = await count(`SELECT count(*) FROM public.chat_messages WHERE sender_user_id = $1`, [SUBJECT]);
  before_.enrollments = await count(`SELECT count(*) FROM public.guest_face_enrollments WHERE guest_id = $1`, [SUBJECT_GUEST]);
  before_.wizardKeys = await count(
    `SELECT count(*) FROM jsonb_object_keys((SELECT wizard_state FROM public.events WHERE event_id = $1))`, [EVENT]);
  seededWizardTaskCount = before_.wizardKeys ?? 0;

  rest = await createPgliteRestClient(db);

  // ── THE RUN ───────────────────────────────────────────────────────────────
  await eraseUserAccount(
    rest as unknown as Parameters<typeof eraseUserAccount>[0],
    SUBJECT,
    ADMIN,
    io,
  );
});

after(async () => {
  await db?.close?.();
});

// ─────────────────────────────────────────────────────────────────────────────
// META — prove the suite can fail before trusting that it passed
// ─────────────────────────────────────────────────────────────────────────────

test('META-1 · the purge ran as service_role, and that is BY DESIGN', async () => {
  // Erasure deliberately uses the service-role client so it is not subject to
  // the leaving user's partially torn-down RLS (purge.ts docstring). So unlike
  // an RLS test, a privileged connection here is the PRODUCTION behaviour, not a
  // harness artifact. Stated explicitly so a green run is never mis-read as
  // evidence that RLS permits any of this.
  const roleExists = await count(`SELECT count(*) FROM pg_roles WHERE rolname = 'service_role'`);
  assert.equal(roleExists, 1, 'service_role missing from the replay harness');
  const bypass = await one<boolean>(`SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role'`);
  assert.equal(bypass, true, 'service_role should be BYPASSRLS, mirroring Supabase');
  assert.deepEqual(sessionRevokedFor, [SUBJECT], 'sessions were not revoked for the subject');
});

test('META-2 · the adapter REJECTS an unknown column (this is what makes the run meaningful)', async () => {
  const probe = await rest.from('events').update({ column_that_does_not_exist: null }).eq('event_id', EVENT);
  assert.ok(probe.error, 'an unknown column was ACCEPTED — every phantom-column assertion below is now vacuous');
  assert.match(
    probe.error?.message ?? '',
    /does not exist/i,
    `expected a "column does not exist" rejection, got: ${probe.error?.message}`,
  );
  // …and it is returned as data, not thrown — the exact shape that let the real
  // bug hide inside a best-effort handler.
  assert.equal(probe.data, null);
});

test('META-3 · the seed really landed (a purge of nothing passes trivially)', () => {
  for (const [k, v] of Object.entries(before_)) {
    assert.ok((v ?? 0) > 0, `seed check: ${k} was ${v} BEFORE the purge — nothing to erase`);
  }
  assert.ok(seededWizardTaskCount >= 13, `expected a fully-populated wizard_state, got ${seededWizardTaskCount} tasks`);
});

test('META-4 · the purge actually issued statements against the tables under test', () => {
  const sql = rest.statements.join('\n');
  for (const t of ['events', 'event_paperwork', 'oauth_grants', 'vendor_profiles', 'notifications', 'chat_messages']) {
    assert.match(sql, new RegExp(`"${t}"`), `no statement was issued against ${t}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 1 · THE HEADLINE — a full run must produce NO failed steps
// ─────────────────────────────────────────────────────────────────────────────

test('1 · a full erasure logs ZERO failures (the phantom-column regression test)', async () => {
  const rows = await db.query<{ action: string; metadata: Record<string, unknown> }>(
    `SELECT action, metadata FROM public.admin_audit_log
      WHERE action IN ('erasure_purge_failed','erasure_step_failed') ORDER BY action`,
  );
  assert.deepEqual(
    rows.rows.map((r) => `${r.action}: ${JSON.stringify(r.metadata)}`),
    [],
    'Erasure reported failed steps against the REAL schema. Every one of these is a column or ' +
      'table the purge names but the database does not have — exactly the defect that left ' +
      'events.owner_email and users.venue_address silently failing in production.',
  );
  const ok = await count(`SELECT count(*) FROM public.admin_audit_log WHERE action = 'user_erased'`);
  assert.equal(ok, 1, 'the success audit row was not written');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2 · DELETION — each newly-covered location is actually emptied
// ─────────────────────────────────────────────────────────────────────────────

test('2a · events — birth data and the photo-delivery credential are cleared', async () => {
  const row = await db.query<Record<string, unknown>>(
    `SELECT partner_a_birth_date, partner_a_birth_time, partner_b_birth_date, partner_b_birth_time,
            bazi_birthdata_consent_at, photo_delivery_account_email, photo_delivery_oauth_token_encrypted
       FROM public.events WHERE event_id = $1`, [EVENT]);
  for (const [col, val] of Object.entries(row.rows[0] ?? {})) {
    assert.equal(val, null, `events.${col} survived erasure`);
  }
});

test('2b · events.wizard_state — the personal payload is stripped, INCLUDING the CENOMAR number', async () => {
  const ws = await one<Record<string, Record<string, unknown>>>(
    `SELECT wizard_state FROM public.events WHERE event_id = $1`, [EVENT]);
  const asText = JSON.stringify(ws);

  // The thing that started all this.
  assert.ok(!asText.includes(CENOMAR_REF), 'the CENOMAR reference number survived in wizard_state');
  assert.ok(!asText.includes('PSA-ML-2026-77'), 'the marriage-licence PSA reference survived');
  assert.ok(!asText.includes('+63 917 000 0000'), 'an officiant phone number survived in meta');

  // Every payload key, including one nobody has invented yet — the allow-list
  // must fail CLOSED, which a deny-list could not.
  for (const key of ['date', 'pax', 'centavos', 'initials', 'style', 'slug', 'visibility',
    'palette_name', 'assigned_count', 'total_rsvp_count', 'scheduled_date', 'event_vendor_id',
    'marketplace_vendor_id', 'reasons_count', 'last_added_count', 'meta', 'meta_some_future_field']) {
    const present = Object.values(ws).some((entry) => entry !== null && typeof entry === 'object' && key in entry);
    assert.equal(present, false, `wizard_state still carries the personal key "${key}"`);
  }
  assert.ok(!asText.includes('anna-and-ben'), 'the site slug survived in wizard_state');
  assert.ok(!asText.includes('A & B'), 'the monogram initials survived in wizard_state');
});

test('2c · event_paperwork — the LEAVER’S OWN civil-registry document is cleared', async () => {
  const row = (await db.query<Record<string, unknown>>(
    `SELECT tracking_reference, document_r2_key, notes FROM public.event_paperwork
      WHERE event_id = $1 AND document_type = 'cenomar_partner_1'`, [EVENT])).rows[0];
  assert.equal(row?.tracking_reference, null, 'the PSA/CENOMAR tracking reference survived');
  assert.equal(row?.document_r2_key, null, 'the scanned-document pointer survived');
  assert.equal(row?.notes, null, 'the free-text note survived');
  assert.ok(deletedStoredAssets.includes(PAPERWORK_REF), 'the scanned document was not handed to storage for deletion');
});

test('2d · oauth_grants — the LEAVER’S OWN live Google refresh token is gone', async () => {
  assert.equal(
    await count(`SELECT count(*) FROM public.oauth_grants WHERE granted_by_user_id = $1`, [SUBJECT]), 0,
    'a credential the subject consented to outlived their account');
  // …and specifically the row, not just the attribution.
  assert.equal(
    await count(
      `SELECT count(*) FROM public.oauth_grants WHERE event_id = $1 AND provider = 'drive_photo_delivery'`,
      [EVENT]),
    0,
  );
});

test('2n · vendor verification — the government ID and every doc ref are purged', async () => {
  // The R2 objects first: a cleared JSONB with the file still in the private
  // bucket is unreachable-but-retained, the worst of both outcomes.
  for (const ref of [GOV_ID_REF, DTI_REF, PORTFOLIO_REF_A, PORTFOLIO_REF_B]) {
    assert.ok(
      deletedStoredAssets.includes(ref),
      `${ref} was never handed to storage — a government ID / DTI / portfolio file survived erasure ` +
        'in the private setnayan-vendor-verification bucket',
    );
  }
  const row = (await db.query<Record<string, unknown>>(
    `SELECT doc_uploads, docs_complete, status FROM public.vendor_verification_applications
      WHERE vendor_profile_id = $1`, [VENDOR_PROFILE])).rows[0];
  assert.deepEqual(row?.doc_uploads, {}, 'doc_uploads still holds the subject’s identity documents');
  assert.equal(row?.docs_complete, false,
    'docs_complete stayed TRUE over an empty map — the application would sit in the admin review queue with nothing to review');
  // The row survives: it is also the admin verification DECISION record.
  assert.equal(row?.status, 'pending_review', 'the application row was deleted, not scrubbed');
});

test('2e · users — the identity row is anonymized AND the lockout is stamped', async () => {
  const row = (await db.query<Record<string, unknown>>(
    `SELECT email, display_name, phone, profile_photo_url, slug, religion, civil_status, sex,
            address_normalized, public_profile_enabled, deleted_at
       FROM public.users WHERE user_id = $1`, [SUBJECT])).rows[0];
  assert.equal(row?.display_name, null);
  assert.equal(row?.phone, null);
  assert.equal(row?.profile_photo_url, null);
  assert.equal(row?.slug, null);
  assert.equal(row?.religion, null);
  assert.equal(row?.civil_status, null);
  assert.equal(row?.sex, null);
  assert.equal(row?.address_normalized, null);
  assert.equal(row?.public_profile_enabled, false, 'the public profile flag stayed on with a nulled slug');
  assert.ok(row?.deleted_at, 'deleted_at was NOT stamped — the account is not locked out');
  assert.match(String(row?.email), /@erased\.setnayan\.invalid$/);
});

test('2f · auth.users — the GoTrue metadata copy of name/email/avatar is scrubbed', async () => {
  const meta = await one<Record<string, unknown>>(`SELECT raw_user_meta_data FROM auth.users WHERE id = $1`, [SUBJECT]);
  assert.deepEqual(meta, {}, 'auth.users.raw_user_meta_data still holds the subject’s name/email/avatar');
  const email = await one<string>(`SELECT email FROM auth.users WHERE id = $1`, [SUBJECT]);
  assert.match(email, /@erased\.setnayan\.invalid$/);
  assert.equal(rest.authUpdates.length, 1);
  assert.deepEqual(rest.authUpdates[0]?.attrs.user_metadata, {});
});

test('2g · vendor_profiles — the columns lost to name-drift are now scrubbed', async () => {
  const row = (await db.query<Record<string, unknown>>(
    `SELECT hq_address, hq_region, registered_business_name, registered_address, tin_number, tin_type,
            screen_name, screen_name_slug, social_post_url, microsite_about, registration_number_raw,
            business_owner_name, contact_email, is_published, portfolio_r2_keys
       FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [VENDOR_PROFILE])).rows[0];
  for (const col of ['hq_address', 'hq_region', 'registered_business_name', 'registered_address',
    'tin_number', 'tin_type', 'screen_name', 'screen_name_slug', 'social_post_url',
    'microsite_about', 'registration_number_raw', 'business_owner_name', 'contact_email']) {
    assert.equal(row?.[col], null, `vendor_profiles.${col} survived erasure`);
  }
  assert.equal(row?.is_published, false, 'the shop was left published');
});

test('2h · chat — the subject’s own messages AND their R2 attachments are gone', async () => {
  assert.equal(await count(`SELECT count(*) FROM public.chat_messages WHERE sender_user_id = $1`, [SUBJECT]), 0);
  assert.ok(
    deletedPublicUrls.includes(CHAT_ATTACHMENT_URL),
    'the chat attachment object was not handed to storage — deleting the row alone leaves the file ' +
      'addressable with nothing left to say it was theirs',
  );
});

test('2i · biometrics — enrolment, R2 selfie and the selfie display photo are gone', async () => {
  assert.equal(await count(`SELECT count(*) FROM public.guest_face_enrollments WHERE guest_id = $1`, [SUBJECT_GUEST]), 0);
  assert.ok(deletedStoredAssets.includes(SELFIE_REF), 'the R2 selfie was not handed to storage');
  const photo = await one(`SELECT photo_url FROM public.guests WHERE guest_id = $1`, [SUBJECT_GUEST]);
  assert.equal(photo, null);
});

test('2j · the disarmed-CASCADE tables are finally cleaned up', async () => {
  const empty: Array<[string, string, string]> = [
    ['notifications', 'user_id', SUBJECT],
    ['api_keys', 'user_id', SUBJECT],
    ['chat_thread_reads', 'user_id', SUBJECT],
    ['guest_saved_vendors', 'user_id', SUBJECT],
    ['user_follows', 'follower_user_id', SUBJECT],
    ['seating_editor_locks', 'holder_user_id', SUBJECT],
    ['oauth_state', 'initiated_by', SUBJECT],
    ['push_subscriptions', 'user_id', SUBJECT],
    ['user_face_profiles', 'user_id', SUBJECT],
    ['vendor_push_tokens', 'vendor_profile_id', VENDOR_PROFILE],
    ['couple_waitlist_signups', 'email', SUBJECT_EMAIL],
  ];
  for (const [table, column, value] of empty) {
    const n = await count(`SELECT count(*) FROM public."${table}" WHERE "${column}" = $1`, [value]);
    assert.equal(n, 0, `${table} still holds ${n} row(s) for the erased subject`);
  }
});

test('2k · scan_events — the scanner’s identity and device trail are nulled', async () => {
  const row = (await db.query<Record<string, unknown>>(
    `SELECT scanner_user_id, user_agent, ip_anon FROM public.scan_events WHERE event_id = $1`, [EVENT])).rows[0];
  assert.equal(row?.scanner_user_id, null);
  assert.equal(row?.user_agent, null);
  assert.equal(row?.ip_anon, null);
});

test('2l · event_moderators — the subject’s invitation contact + bearer token are nulled', async () => {
  const row = (await db.query<Record<string, unknown>>(
    `SELECT invitation_email, invitation_phone, invitation_token FROM public.event_moderators WHERE user_id = $1`,
    [SUBJECT])).rows[0];
  assert.equal(row?.invitation_email, null);
  assert.equal(row?.invitation_phone, null);
  assert.equal(row?.invitation_token, null);
});

test('2m · the subject’s own uploaded profile photo is handed to storage', () => {
  assert.ok(deletedStoredAssets.includes(PROFILE_PHOTO_REF));
});

// ─────────────────────────────────────────────────────────────────────────────
// 3 · SURVIVAL — over-deletion is a real harm, and nobody tests for it
// ─────────────────────────────────────────────────────────────────────────────

test('3a · the shared wedding record survives', async () => {
  const row = (await db.query<Record<string, unknown>>(
    `SELECT display_name, bride_name, groom_name, venue_name, venue_address
       FROM public.events WHERE event_id = $1`, [EVENT])).rows[0];
  assert.equal(row?.bride_name, 'Anna', 'the co-partner’s name was destroyed');
  assert.equal(row?.groom_name, 'Ben');
  assert.equal(row?.venue_name, 'Blue Leaf Filipinas', 'the shared venue was destroyed');
  assert.equal(row?.venue_address, '12 McKinley Rd, Taguig');
  assert.equal(row?.display_name, 'Anna & Ben');
});

test('3b · the CO-PARTNER’S setup progress survives the wizard_state scrub', async () => {
  const ws = await one<Record<string, Record<string, unknown>>>(
    `SELECT wizard_state FROM public.events WHERE event_id = $1`, [EVENT]);

  // Every task the couple had reached is still there, with its progress stamp.
  assert.equal(Object.keys(ws).length, seededWizardTaskCount,
    'wizard tasks were DROPPED — the co-partner lost their place in the planner');
  assert.equal(ws.set_wedding_date?.completed_at, '2026-01-02T00:00:00Z');
  assert.equal(ws.monogram?.completed_at, '2026-01-05T00:00:00Z');
  assert.equal(ws.finalize_seatplan?.completed_at, '2026-01-08T00:00:00Z');
  assert.equal(ws.draft_guest_list?.in_flight_since, '2026-01-11T00:00:00Z');
  assert.equal(ws.cenomar_bride?.in_flight_since, '2026-01-12T00:00:00Z',
    'the in-flight stamp was lost — the paperwork card would reset to pending');
});

test('3c · event_paperwork keeps its checklist progress', async () => {
  const row = (await db.query<Record<string, unknown>>(
    `SELECT document_type, status FROM public.event_paperwork
      WHERE event_id = $1 AND document_type = 'cenomar_partner_1'`, [EVENT])).rows[0];
  assert.equal(row?.document_type, 'cenomar_partner_1', 'the paperwork row was destroyed, not scrubbed');
  assert.equal(row?.status, 'in_processing');
});

test('3g · THE CO-PARTNER’S PSA / CENOMAR DOCUMENT SURVIVES INTACT', async () => {
  // The defect this scoping exists to fix. Before the subject_user_id filter,
  // `.in('event_id', eventIds)` erased this row too: one partner deleting their
  // account destroyed the other partner's civil-registry documents — a third
  // party's sensitive PI (§3(l)), removed by someone with no standing to ask,
  // and irreversible. Nothing else in this suite catches it, because every
  // other assertion is checking that data is GONE.
  const row = (await db.query<Record<string, unknown>>(
    `SELECT tracking_reference, document_r2_key, notes, status FROM public.event_paperwork
      WHERE event_id = $1 AND document_type = 'cenomar_partner_2'`, [EVENT])).rows[0];
  assert.equal(row?.tracking_reference, PARTNER_CENOMAR_REF,
    'the CO-PARTNER’S CENOMAR reference was destroyed by the other partner’s account deletion');
  assert.equal(row?.document_r2_key, PARTNER_PAPERWORK_REF,
    'the CO-PARTNER’S scanned document pointer was destroyed');
  assert.equal(row?.notes, 'Ben collected his on the 20th');
  assert.equal(row?.status, 'received');
  assert.ok(
    !deletedStoredAssets.includes(PARTNER_PAPERWORK_REF),
    'the CO-PARTNER’S scanned PSA document was handed to storage for DELETION — the R2 object is gone ' +
      'and no amount of DB repair brings a civil-registry scan back',
  );
});

test('3h · an UNATTRIBUTED document survives — fail closed, never guess', async () => {
  const row = (await db.query<Record<string, unknown>>(
    `SELECT tracking_reference, subject_user_id FROM public.event_paperwork
      WHERE event_id = $1 AND document_type = 'psa_birth_cert_partner_1'`, [EVENT])).rows[0];
  assert.equal(row?.tracking_reference, UNATTRIBUTED_PSA_REF,
    'a row with subject_user_id IS NULL was erased. Unattributable is not the same as the leaver’s — ' +
      'the purge must keep what it cannot prove, and audit the shortfall instead');
  assert.equal(row?.subject_user_id, null);
});

test('3i · a JOINT document type survives while the other partner remains', async () => {
  // marriage_license / pre_cana_certificate / banns_posted and the four
  // counselling records have no single data subject by construction — they are
  // the couple's, and one partner leaving does not make them erasable.
  const row = (await db.query<Record<string, unknown>>(
    `SELECT tracking_reference, notes, status FROM public.event_paperwork
      WHERE event_id = $1 AND document_type = 'marriage_license'`, [EVENT])).rows[0];
  assert.equal(row?.tracking_reference, JOINT_LICENCE_REF, 'the couple’s joint marriage licence was erased');
  assert.equal(row?.notes, 'Both partners appeared at the LGU');
  assert.equal(row?.status, 'in_processing');
  // And the row count itself: 4 seeded, 1 scrubbed in place, 0 deleted.
  assert.equal(await count(`SELECT count(*) FROM public.event_paperwork WHERE event_id = $1`, [EVENT]), 4,
    'paperwork rows were DELETED rather than scrubbed — the couple lost checklist entries');
});

test('3j · the CO-PARTNER’S Google credential and the unattributed grant survive', async () => {
  const partnerGrant = (await db.query<Record<string, unknown>>(
    `SELECT refresh_token, external_account_display FROM public.oauth_grants
      WHERE event_id = $1 AND provider = 'drive'`, [EVENT])).rows[0];
  assert.equal(partnerGrant?.refresh_token, 'PARTNER-REFRESH-TOKEN',
    'the CO-PARTNER’S Google Drive connection was revoked by the other partner’s account deletion');
  assert.equal(partnerGrant?.external_account_display, 'partner@example.com');

  const legacyGrant = (await db.query<Record<string, unknown>>(
    `SELECT refresh_token, granted_by_user_id FROM public.oauth_grants
      WHERE event_id = $1 AND provider = 'youtube'`, [EVENT])).rows[0];
  assert.equal(legacyGrant?.refresh_token, 'LEGACY-REFRESH-TOKEN',
    'a grant with granted_by_user_id IS NULL was deleted — it may be the co-partner’s account, and ' +
      'the purge has no way to know');
  assert.equal(legacyGrant?.granted_by_user_id, null);
});

test('3k · another VENDOR’S government ID is untouched', async () => {
  const row = (await db.query<Record<string, unknown>>(
    `SELECT doc_uploads FROM public.vendor_verification_applications WHERE vendor_profile_id = $1`,
    [OUTSIDER_VENDOR_PROFILE])).rows[0];
  assert.deepEqual(row?.doc_uploads, { government_id: { r2_key: OUTSIDER_GOV_ID_REF } },
    'an unrelated vendor’s verification documents were wiped');
  assert.ok(
    !deletedStoredAssets.includes(OUTSIDER_GOV_ID_REF),
    'an unrelated vendor’s government ID was handed to storage for deletion',
  );
});

test('3l · what fail-closed KEPT is audit-logged, not silently dropped', async () => {
  // Fail-closed is only defensible if the residue is countable. Without this
  // row, "erasure completed" would also mean "…except for N documents and M
  // credentials nobody counted", and the DPO could not tell a clean run from a
  // run that skipped everything.
  const rows = await db.query<{ metadata: Record<string, unknown> }>(
    `SELECT metadata FROM public.admin_audit_log
      WHERE action = 'erasure_unattributed_retained' AND target_id = $1`, [SUBJECT]);
  const byStage = new Map(rows.rows.map((r) => [String(r.metadata?.stage), r.metadata]));
  assert.deepEqual(
    [...byStage.keys()].sort(),
    ['oauth-grants-unattributed', 'paperwork-unattributed'],
    `expected both retention notes, got: ${JSON.stringify([...byStage.keys()])}`,
  );
  assert.equal(byStage.get('paperwork-unattributed')?.retained_count, before_.unattributedPaperwork);
  assert.equal(byStage.get('oauth-grants-unattributed')?.retained_count, before_.unattributedGrants);
  // Counts and reasons only — never the reference numbers being retained.
  const asText = JSON.stringify([...byStage.values()]);
  assert.ok(!asText.includes(UNATTRIBUTED_PSA_REF), 'the audit row leaked the PSA reference it is reporting on');
  assert.ok(!asText.includes(JOINT_LICENCE_REF), 'the audit row leaked the marriage-licence reference');
});

test('3d · the co-partner’s chat message and the thread survive', async () => {
  assert.equal(await count(`SELECT count(*) FROM public.chat_messages WHERE sender_user_id = $1`, [PARTNER]), 1);
  assert.equal(await count(`SELECT count(*) FROM public.chat_threads WHERE thread_id = $1`, [THREAD]), 1);
  assert.equal(deletedPublicUrls.length, 1, 'more attachments were deleted than the subject authored');
});

test('3e · other people’s rows are untouched', async () => {
  assert.equal(await count(`SELECT count(*) FROM public.notifications WHERE user_id = $1`, [OUTSIDER]), 1,
    'another account’s notifications were deleted');
  assert.equal(await count(
    `SELECT count(*) FROM public.user_follows WHERE follower_user_id = $1 AND followed_user_id = $2`,
    [OUTSIDER, SUBJECT]), 1,
    'an INBOUND follow edge was deleted — that row is the other account’s list, not the subject’s');
  assert.equal(await count(`SELECT count(*) FROM public.couple_waitlist_signups WHERE email = $1`,
    ['someone.else@example.com']), 1, 'an unrelated waitlist signup was deleted');
  const partner = (await db.query<Record<string, unknown>>(
    `SELECT display_name, deleted_at FROM public.users WHERE user_id = $1`, [PARTNER])).rows[0];
  assert.equal(partner?.display_name, 'Staying Partner', 'the co-partner’s account was anonymized');
  assert.equal(partner?.deleted_at, null, 'the co-partner’s account was locked out');
});

test('3f · the scan record and the moderator seat are SCRUBBED, not deleted', async () => {
  assert.equal(await count(`SELECT count(*) FROM public.scan_events WHERE event_id = $1`, [EVENT]), 1,
    'the host lost their attendance record');
  assert.equal(await count(`SELECT count(*) FROM public.event_moderators WHERE event_id = $1`, [EVENT]), 1);
  const label = await one(`SELECT display_label FROM public.event_moderators WHERE user_id = $1`, [SUBJECT]);
  assert.equal(label, 'Day-of Coordinator',
    'display_label was scrubbed — that is the host’s record of who their coordinator was, and it is ' +
      'the same shared-record call the code makes for bride/groom names');
});

// ─────────────────────────────────────────────────────────────────────────────
// 4 · RESILIENCE — a broken step must never trap an account undeletable
//
// Registered LAST because it mutates the schema. node:test runs top-level tests
// in registration order within a file, so everything above has already asserted.
// ─────────────────────────────────────────────────────────────────────────────

test('4 · a FAILING purge step still deletes the account, and still audits the miss', async () => {
  // Simulate the real-world failure mode exactly: schema drift renames a column
  // out from under the purge, so PostgREST rejects that statement. This is the
  // shipped bug in miniature — and the property under test is that it stays
  // survivable rather than becoming silent.
  await db.exec(`ALTER TABLE public.notifications RENAME COLUMN user_id TO user_id_renamed`);
  await db.exec(`
    INSERT INTO public.notifications (user_id_renamed, type, title)
    VALUES ('${PARTNER}', 'payment_matched', 'Partner notification');
  `);

  const before = await count(
    `SELECT count(*) FROM public.admin_audit_log WHERE action IN ('erasure_purge_failed','erasure_step_failed')`);
  assert.equal(before, 0, 'precondition: the first run left no failures');

  let threw: unknown = null;
  try {
    await eraseUserAccount(
      rest as unknown as Parameters<typeof eraseUserAccount>[0],
      PARTNER,
      ADMIN,
      io,
    );
  } catch (e) {
    threw = e;
  }

  // (a) it did not throw — a stuck purge must never trap an account.
  assert.equal(threw, null, 'a failing purge step THREW; the account would be undeletable');

  // (b) the deletion still completed: locked out + tombstoned.
  const row = (await db.query<Record<string, unknown>>(
    `SELECT deleted_at, email, display_name FROM public.users WHERE user_id = $1`, [PARTNER])).rows[0];
  assert.ok(row?.deleted_at, 'deleted_at was not stamped, so the account is not locked out');
  assert.match(String(row?.email), /@erased\.setnayan\.invalid$/);
  assert.equal(row?.display_name, null);

  // (c) the success audit still landed.
  assert.equal(
    await count(`SELECT count(*) FROM public.admin_audit_log WHERE action = 'user_erased' AND target_id = $1`, [PARTNER]),
    1,
  );

  // (d) …AND the miss is recoverable: a durable audit row naming the stage.
  const failures = await db.query<{ metadata: Record<string, unknown> }>(
    `SELECT metadata FROM public.admin_audit_log
      WHERE action = 'erasure_step_failed' AND target_id = $1`, [PARTNER]);
  assert.ok(failures.rows.length > 0, 'the failed step produced NO audit row — the miss is undiscoverable');
  const stages = failures.rows.map((r) => r.metadata?.stage);
  assert.ok(
    stages.includes('notifications-delete'),
    `expected a 'notifications-delete' failure stage, got: ${JSON.stringify(stages)}`,
  );

  await db.exec(`ALTER TABLE public.notifications RENAME COLUMN user_id_renamed TO user_id`);
});
