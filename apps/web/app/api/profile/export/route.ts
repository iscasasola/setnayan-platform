import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlsForStoredAssets } from '@/lib/uploads';
import { listOutcome, singleOutcome, collectIncomplete } from '@/lib/export-integrity';
import { VENDOR_PROFILE_EXPORT_SELECT } from '@/lib/export-vendor-profile-columns';

/**
 * RA 10173 data-export endpoint (V1 slice).
 *
 * Bundles the current user's PERSONAL data plus the rows they own or
 * authored across the app into a single JSON file. Auth-gated via the
 * Supabase session cookie. The user can only export their OWN data.
 *
 * Includes (for vendor accounts) the vendor's portfolio + day-of media,
 * resolved to usable URLs — the raw r2:// keys also stay inside
 * `vendor_profile` / `vendor_submitted_media` as the durable record, since the
 * resolved URLs are presigned and time-limited.
 *
 * Includes (2026-07-05 NPC/RA 10173 completeness) the subject's own order +
 * payment records (iteration 0034) and their own face-enrollment CONSENT
 * metadata (iteration 0012) — raw face_vector embeddings are excluded.
 *
 * Includes (2026-07-19 completeness) the subject's consent RECEIPTS:
 * coordinator-access data-sharing consents and marketing-share (social
 * sharing program) per-artifact consents, each with grant + revocation stamps.
 *
 * Includes (2026-07-21 completeness) the coordinator-workspace prose the
 * subject AUTHORED: per-vendor working notes and day-of broadcasts. Both are
 * author-scoped, never event-scoped — see the WHY blocks at each select. A
 * companion guardrail (lib/export-coverage-guardrail.test.ts) fails the build
 * when a new user-identifying table is neither exported nor explicitly
 * classified, so this class of silent omission cannot recur unreviewed.
 *
 * ── NO SILENT EMPTIES (2026-07-21 fix-forward) ───────────────────────────────
 * Every read below is unwrapped through lib/export-integrity, not `?? []`.
 * A failed or un-attempted read now becomes a NAMED line in `not_included`
 * and flips `export_complete` to false. Rationale: an empty array in a
 * subject-access file reads as the assertion "you have no such records", and
 * making that assertion when we simply failed to look is a false statement of
 * fact to a data subject under the very law this endpoint serves.
 *
 * ── WHY THREE SECTIONS USE THE SERVICE-ROLE CLIENT ───────────────────────────
 * Every other read on this route uses the RLS-enforced session client, and
 * that is right: for those tables a policy the subject already satisfies also
 * returns exactly the subject's own rows, so RLS and completeness agree.
 *
 * They DISAGREE for the two author-scoped coordinator tables:
 *
 *   • event_vendor_working_notes (migration 20270825279091) has NO author
 *     SELECT policy. Its only author-keyed policy is `evwn_author_delete`, a
 *     DELETE policy — and a filter is not a grant. Reads are granted only by
 *     `evwn_moderator_select` (current_moderator_event_ids) and
 *     `evwn_couple_select` (current_couple_event_ids AND visibility='shared').
 *   • coordinator_broadcasts (migration 20270825364600) grants SELECT only via
 *     `current_event_ids()` (event_members) and `current_moderator_event_ids()`.
 *     There is no sender policy at all.
 *
 * `removeHost` (app/dashboard/[eventId]/hosts/actions.ts) stamps
 * event_moderators.removed_at AND deletes the event_members row — closing BOTH
 * grants at once. A departed coordinator therefore reads ZERO rows from both
 * tables. That is precisely the person most likely to file a subject-access
 * request, and under the old `?? []` unwrap they received a file asserting they
 * had written nothing. A coordinator who authored 'coordinator_private' notes
 * and later lost the grant is in the same position.
 *
 * Error-surfacing alone cannot fix this: RLS-filtered-to-zero is NOT an error,
 * it is an ordinary successful empty result, indistinguishable at the client
 * from a true zero. Completeness therefore has to come from a read RLS cannot
 * narrow.
 *
 * The THIRD table, `vendor_profiles` (added 2026-07-27), is here for a related
 * but distinct reason — not RLS, but COLUMN privileges. Its subject-facing
 * columns include the vendor's BIR tax identity (tin_number, tin_type,
 * registered_*) and DTI/SEC registration numbers, which a logged-in NON-OWNER
 * can currently read off any verified vendor because `authenticated` holds
 * table-level SELECT on all 93 columns. The fix for that is a column-level
 * REVOKE — and column privileges are ROLE-level, not row-level, so the moment
 * they land the VENDOR CANNOT READ THEIR OWN tin_number either. PostgREST
 * fails the whole statement (42501), not the one column, so the subject's
 * entire `vendor_profile` section would vanish from their own RA 10173 export.
 * Reading it service-role, filtered to `user_id = auth.uid()`, is what keeps
 * the subject's own record whole while the role loses access to everyone
 * else's. (The cleaner shape is a `security_definer` self-view, exactly as
 * SEC-2b did with `public.events_host` — see the closing note below on why a
 * migration is not bundled into this route's change.)
 *
 * WHAT BOUNDS THE BYPASS — four properties, all of which must keep holding:
 *   1. The filter value is `user.id` from `supabase.auth.getUser()`, a
 *      server-verified session identity. It is NEVER taken from the request
 *      body, query string, or a header — this route accepts no input at all,
 *      so there is no parameter for a caller to tamper with.
 *   2. The filter column is the AUTHOR column (author_user_id / sender_user_id)
 *      — or, for vendor_profiles, the OWNER column `user_id` — i.e. the
 *      identity itself. The widest possible result set is "rows this exact
 *      authenticated uid wrote or owns" — definitionally the subject's own
 *      personal data, and exactly what the export exists to return.
 *   3. Scope is three tables and a fixed column projection. No `select('*')`,
 *      no joins that could pull a third party's row in behind the bypass.
 *      ⚠ THIS PROPERTY WAS NOT ACTUALLY TRUE UNTIL 2026-07-27. The rule was
 *      stated here from the start, but `vendor_profiles` was read `select('*')`
 *      one screen below — on the session client at the time, so the stated rule
 *      and the code did not visibly collide. Moving that read behind the bypass
 *      forced the collision, and it was resolved in the rule's favour: the
 *      wildcard is gone, replaced by the named projection in
 *      `lib/export-vendor-profile-columns`. There is now no `select('*')`
 *      anywhere on this route, privileged or not.
 *   4. Read-only. No write ever uses this client on this route.
 * If a future edit loosens (1) or (2) — an event_id filter, a caller-supplied
 * id, a widened select — the bypass stops being bounded and this pattern must
 * be REMOVED rather than extended.
 *
 * WHAT IS ACTUALLY PINNED BY TESTS (do not overstate this):
 *   • T6 (lib/export-coverage-guardrail) is a TEXT-PROXIMITY match asserting the
 *     author/sender column name appears near each table name. It catches a flip
 *     to .eq('event_id', …). It does NOT see which client issues the read.
 *   • T11 (same file) is the one that pins the client: it asserts all three
 *     reads are issued from `admin`, never from the RLS session client. Without
 *     it the whole fix could be reverted by a drive-by refactor with a green
 *     build — mutation-tested, it was.
 *   • T12 (same file) pins the HALF of property 3 that a human reviewer is
 *     worst at: that the vendor_profiles projection is COMPLETE. It asserts the
 *     named columns are exactly the table's column set minus an explicit,
 *     reasoned deny-list, so a column added by a future migration cannot
 *     silently drop out of a data subject's export. The "no joins" half of
 *     property 3, and property 4, are still reviewed by humans only.
 *
 * The cleaner long-term shape is author SELECT policies added by migration,
 * which would let the session client do this. It is not bundled here because a
 * migration only takes effect once pushed to prod and its failure mode if
 * unpushed is the same undetectable silent empty — flagged for owner sign-off.
 *
 * Not in scope for V1: see `not_included` in the payload below.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Privileged read client for the two author-scoped sections above.
  //
  // We gate on SUPABASE_SERVICE_ROLE_KEY being PRESENT rather than on
  // createAdminClient() throwing. That is not belt-and-braces, it is the whole
  // point: lib/supabase/admin.ts has a documented dev-only fallback that swaps
  // in NEXT_PUBLIC_SUPABASE_ANON_KEY when the service key is unset under
  // NODE_ENV==='development'. Construction then SUCCEEDS, so the catch below
  // never fires — but the returned client carries no user session, auth.uid()
  // is NULL, both coordinator policies match nothing, and the read comes back
  // as zero rows with error null. That is indistinguishable from a true empty:
  // the export would ship empty author sections with export_complete: true,
  // i.e. the exact silent empty this route exists to kill, on the one surface
  // (a local dev server) anybody would use to hand-verify the fix.
  // Absent the key we take NO privileged read at all and mark both sections
  // NOT READ, in dev and in prod alike.
  let admin: ReturnType<typeof createAdminClient> | null = null;
  let adminUnavailable: string | undefined;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      admin = createAdminClient();
    } catch {
      admin = null;
    }
  }
  if (!admin) {
    adminUnavailable =
      'The privileged read client required to guarantee completeness for author-scoped ' +
      'coordinator records was unavailable on this run.';
  }

  const [
    profileRes,
    eventsRes,
    ownedEventsRes,
    vendorProfileRes,
    messagesRes,
    ordersRes,
    paymentsRes,
    faceEnrollmentsRes,
    dependentsRes,
    godparentsRes,
    communityMembershipsRes,
    samahanStoriesRes,
    samahanMessagesRes,
    coordinatorConsentsRes,
    marketingShareConsentsRes,
    vendorReuseRequestsRes,
    workingNotesRes,
    broadcastsSentRes,
    dayRequestsRes,
    accessRequestsRes,
    eventRemovalReasonsRes,
    eventClustersRes,
    ownCostsRes,
    ownRendersRes,
    ownShareConsentsRes,
  ] = await Promise.all([
    supabase.from('users').select('*').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('event_members')
      // ⚠ `joined_at`, NOT `created_at` — public.event_members has no
      // `created_at`. PostgREST 42703s the whole query, so `event_memberships`
      // was ALWAYS an empty section in the RA 10173 subject-access export: the
      // data subject was told, in writing, that they belong to no events. The
      // route's own listOutcome() machinery did flag it in `not_included`, but
      // the wrong column meant the section could never populate at all.
      .select('event_id, member_type, joined_via, joined_at, events(public_id, display_name, event_date, slug)')
      .eq('user_id', user.id),
    // RA 10173 completeness (PR-G) — events the user OWNS (member_type='couple')
    // carry sensitive per-partner birth date/time + consent for the BaZi
    // date-check. The membership join above under-exports events (public_id /
    // display_name / event_date / slug only), so the opt-in birth fields would
    // be invisible without this owner-scoped select. Kept to the couple grain: a
    // coordinator on someone else's event must NOT export the couple's birth data.
    //
    // SEC-2b (20271008731642): the birth columns are SELECT-denied to
    // `authenticated` on public.events, so the old
    // `event_members → events(…birth…)` EMBED now 42501s for EVERYONE — it was
    // also the one embed in the codebase through which a plain GUEST could pull
    // the couple's birth data. Split in two: the membership query resolves the
    // caller's OWN couple event ids, then public.events_host (host-scoped
    // definer view) returns the private columns for exactly those. The
    // member_type='couple' filter is what keeps this at the couple grain —
    // events_host by itself would also admit an accepted moderator.
    (async () => {
      const owned = await supabase
        .from('event_members')
        .select('event_id')
        .eq('user_id', user.id)
        .eq('member_type', 'couple');
      // ERROR FIRST, before a single row is touched. The rejected shape here
      // was `const ids = (owned.data ?? []) …` with the error checked two
      // lines later: harmless as written, but it is the exact silhouette this
      // route was hardened against, and it puts the unwrap of a possibly-null
      // `data` UPSTREAM of the only thing that distinguishes "the read failed"
      // from "you own no events". One reordered edit and a 42501 on
      // event_members becomes a subject-access file that silently asserts the
      // couple has no birth data on record. Checking the error first is also
      // what removes the need for `?? []` at all — supabase-js settles to a
      // discriminated union, so past this guard `owned.data` is an array.
      //
      // The error is handed straight through: listOutcome() names
      // `owned_event_birth_data` in `not_included` and flips export_complete.
      if (owned.error) {
        return { data: [] as unknown[], error: owned.error };
      }
      const ids = owned.data
        .map((r) => (r as { event_id?: string }).event_id)
        .filter((id): id is string => typeof id === 'string');
      // A genuine empty: the subject holds no member_type='couple' row, so
      // there is no host-scoped birth data to fetch. Not a failure — the only
      // branch on this route entitled to return an empty with error null.
      if (ids.length === 0) {
        return { data: [] as unknown[], error: null };
      }
      return supabase
        .from('events_host')
        .select(
          'event_id, public_id, display_name, event_date, ceremony_type, secondary_ceremony_type, ' +
            'partner_a_birth_date, partner_a_birth_time, partner_b_birth_date, ' +
            'partner_b_birth_time, bazi_birthdata_consent_at',
        )
        .in('event_id', ids);
    })(),
    // RA 10173 — the subject's OWN vendor business record. Read PRIVILEGED and
    // with an EXPLICIT projection; both halves are load-bearing and neither is
    // cosmetic. See lib/export-vendor-profile-columns for the full argument:
    //   • the wildcard had to go because `select('*')` demands SELECT on every
    //     one of the 93 columns, which pinned the whole table open to
    //     `authenticated` and made a column-level revoke unexpressible;
    //   • the client had to change because once that revoke lands, column
    //     privileges being role-level means the vendor loses their own
    //     tin_number too, and PostgREST 42501s the entire row rather than
    //     omitting one field.
    // Bounded exactly as the two coordinator reads below are: .eq on the OWNER
    // column with a server-verified session identity, fixed projection, no
    // joins, read-only. When the service key is absent the read is NOT taken at
    // all and `not_included` says so — an empty vendor_profile must never be
    // mistaken for "you have no vendor record".
    admin
      ? admin
          .from('vendor_profiles')
          .select(VENDOR_PROFILE_EXPORT_SELECT)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve(null),
    supabase
      .from('chat_messages')
      .select('message_id, thread_id, sender_role, body, created_at')
      .eq('sender_user_id', user.id)
      .order('created_at', { ascending: true }),
    // RA 10173 completeness (2026-07-05) — the subject's OWN order records
    // (iteration 0034). Self-scoped: orders_owner_read RLS is widened to
    // co-hosts, so we add an explicit user_id filter to keep the export to the
    // subject's own orders only. Admin-only fields (admin_notes) are dropped.
    supabase
      .from('orders')
      .select(
        'public_id, event_id, service_key, description, requested_total_php, ' +
          'confirmed_total_php, status, reference_code, created_at, updated_at',
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    // The subject's OWN payment records. payments_owner_read scopes to
    // user_id = auth.uid(); we filter explicitly for defense in depth. Admin
    // reconciliation fields (admin_notes, reviewed_by_user_id) are dropped.
    supabase
      .from('payments')
      .select(
        'payment_id, order_id, amount_php, channel, reference_number, ' +
          'paid_at, status, created_at, updated_at',
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    // The subject's OWN biometric face-enrollment METADATA (iteration 0012).
    // guest_reads_own_face_enrollment RLS scopes SELECT to guest rows the
    // subject owns via event_members. We deliberately EXCLUDE face_vector (the
    // raw embedding) — the export ships consent/provenance metadata only, per
    // RA 10173 (disclose what biometric data we hold, not the biometric itself).
    supabase
      .from('guest_face_enrollments')
      .select(
        'enrollment_id, event_id, source, consent_at, consent_source, ' +
          'revoked_at, quality_score, vector_model, created_at, updated_at',
      )
      .order('created_at', { ascending: true }),
    // RA 10173 (2026-07-17) — Alaga (dependents) records: what the subject
    // stores as a guardian, what they claimed as their own profile, and what
    // they handed over (read-only history). Spouse-SHARED rows the OTHER
    // guardian owns are deliberately excluded — that's the other guardian's
    // stored data, not the subject's. Active claim_token values are excluded
    // (a live token is redeemable — exporting it would leak a bearer secret);
    // the consent stamps ARE included (durable RA 10173 proof).
    supabase
      .from('dependents')
      .select(
        'public_id, dependent_kind, name, birth_date, sex, religion, relationship, ' +
          'shared_with_spouse, birth_date_consent_at, religion_consent_at, ' +
          'handed_over_at, owner_user_id, claimed_user_id, handed_over_by_user_id, created_at, updated_at',
      )
      .or(
        `owner_user_id.eq.${user.id},claimed_user_id.eq.${user.id},handed_over_by_user_id.eq.${user.id}`,
      )
      .order('created_at', { ascending: true }),
    // Godparent (ninong/ninang) edges — the subject's own rows as guardian
    // plus, via godparents_subject_read, the edges on a profile they claimed.
    supabase
      .from('godparents')
      .select('godparent_id, dependent_id, godparent_name, godparent_email, role, created_at')
      .order('created_at', { ascending: true }),
    // RA 10173 (2026-07-17) — samahan memberships: the group's user-chosen
    // name, the subject's role, and when they joined. No kind/category exists
    // by design (owner 2026-07-17 — the platform never classifies groups).
    supabase
      .from('community_members')
      .select('role, joined_at, communities(public_id, name)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true }),
    // RA 10173 (2026-08-24) — samahan stories the subject posted that are
    // still LIVE. Scoped to the AUTHOR, never the community: another
    // member's stories are their data, not this subject's. Metadata only —
    // the clip itself expires within 24 hours and is deleted, so the export
    // records that a story existed, not the video. Reads through the
    // subject's own session; RLS already hides expired rows.
    supabase
      .from('samahan_stories')
      .select('story_id, community_id, duration_ms, created_at, expires_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    // RA 10173 (2026-08-24) — Usapan messages the subject WROTE, body
    // included (their own words are their data). Scoped to the author:
    // other members' messages are theirs, not this subject's. Soft-deleted
    // ones are included — the subject wrote them, and a take-down hides a
    // message from the group, it does not unwrite it.
    supabase
      .from('samahan_messages')
      .select('message_id, community_id, body, created_at, deleted_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    // RA 10173 (2026-07-19) — coordinator-access consent receipts the subject
    // GAVE as the couple/host (Coordinator_Role_Feature_Spec_2026-07-18.md § 3a):
    // their explicit decision to share event planning data (guest list · seating
    // · schedule · vendor chats) with a coordinator, plus any later revocation.
    // RLS is event-scoped (hosts + admin), so we filter explicitly to
    // consented_by_user_id — the export ships only consents the SUBJECT gave,
    // not other hosts' consent rows on shared events. Internal bigserial id and
    // moderator FK stay out; coordinator email/label are the denormalised
    // self-describing audit fields. `scopes` (the {vendor_lock,checkout} money
    // powers the subject granted, added 2026-07-19) is included so the export
    // reflects WHAT was consented to, not just the scope_version — RA 10173
    // completeness (the version string alone doesn't tell the subject which
    // authorities they gave).
    supabase
      .from('coordinator_access_consents')
      .select(
        'event_id, coordinator_email, coordinator_label, scope_version, scopes, granted_at, revoked_at',
      )
      .eq('consented_by_user_id', user.id)
      .order('granted_at', { ascending: true }),
    // RA 10173 (2026-07-19) — marketing-share consent receipts (social sharing
    // program): the subject's per-artifact grants for Setnayan to feature their
    // creation on its Facebook page, incl. credit mode, revocation, and (if
    // posted) the post evidence + take-down stamp. RLS scopes to the couple's
    // own events; we filter explicitly to customer_id for defense in depth so
    // only consents the SUBJECT granted are exported.
    supabase
      .from('marketing_share_consents')
      .select(
        'consent_id, event_id, artifact_type, artifact_ref, credit_mode, ' +
          'consented_at, revoked_at, posted_at, post_url, taken_down_at, created_at, updated_at',
      )
      .eq('customer_id', user.id)
      .order('created_at', { ascending: true }),
    // RA 10173 (2026-08-04) — RE-BOOKING REQUESTS the subject initiated
    // (migration 20271103100614). AUTHOR-scoped on requested_by_user_id, not
    // event-scoped: the row records a request THIS person made, and a co-host
    // who did not make it is not its data subject.
    // `quoted_total_php` is included deliberately — it is the price quoted TO
    // the subject, so it is their own data, not the vendor's private figure.
    // `scope_snapshot` is the sanitized, price-free, PII-free inclusions list
    // the migration guarantees never carries the SOURCE couple's data.
    supabase
      .from('vendor_reuse_requests')
      .select(
        'request_id, target_event_id, vendor_profile_id, vendor_name, category, ' +
          'status, scope_snapshot, quoted_total_php, quoted_at, decline_reason, ' +
          'created_at, updated_at',
      )
      .eq('requested_by_user_id', user.id)
      .order('created_at', { ascending: true }),
    // RA 10173 (2026-07-21) — per-vendor WORKING NOTES the subject AUTHORED
    // (coordinator P4, migration 20270825279091). AUTHOR-scoped on purpose;
    // event-scoping would be both incomplete AND a third-party disclosure:
    //   • a 'coordinator_private' note is the COORDINATOR's own working prep
    //     about a vendor. That migration deliberately inverts Pattern B —
    //     policy evwn_couple_select predicates on visibility = 'shared', so the
    //     couple cannot read private notes even on their own event. An
    //     event-scoped export would therefore hand a couple a silently PARTIAL
    //     set (RLS quietly filters it) and, for a coordinator working several
    //     events, would sweep in notes authored by other people.
    //   • even a 'shared' note has exactly ONE author; the other party only
    //     READS it. Event-scoping would drop the coordinator's words into the
    //     couple's subject-access file — a third-party disclosure, precisely
    //     the leak this endpoint must never commit.
    // Author-scoping is both COMPLETE (the subject gets every note they wrote,
    // at either visibility) and SAFE. Same grain as chat_messages_authored.
    // Read via the SERVICE-ROLE client because this table has no author SELECT
    // policy — see the bounded-bypass block at the top of this file.
    admin
      ? admin
          .from('event_vendor_working_notes')
          .select('note_id, event_id, event_vendor_id, author_role, visibility, body, created_at')
          .eq('author_user_id', user.id)
          .order('created_at', { ascending: true })
      : Promise.resolve(null),
    // RA 10173 (2026-07-21) — day-of BROADCASTS the subject SENT (coordinator
    // P3, migration 20270825364600). SENDER-scoped, for the same reason
    // chat_messages is scoped to sender_user_id: the export ships what the
    // subject WROTE, not what they received. A broadcast is one-author-to-many-
    // readers (policy coordinator_broadcasts_member_read gives every event
    // member read), so the message text is the SENDER's personal data. An
    // event-scoped read on a recipient's subject-access request would return
    // the couple's and coordinator's announcements as if they were the
    // recipient's own — disclosing a third party's data to every guest.
    // sender_role is exported as provenance only: the migration's own
    // COMMENT ON COLUMN says authority comes from RLS, never from this label.
    // Read via the SERVICE-ROLE client because this table has no sender SELECT
    // policy — see the bounded-bypass block at the top of this file.
    admin
      ? admin
          .from('coordinator_broadcasts')
          .select('broadcast_id, event_id, sender_role, body, created_at')
          .eq('sender_user_id', user.id)
          .order('created_at', { ascending: true })
      : Promise.resolve(null),
    // RA 10173 (2026-07-27) — the day-of requests stream (§10 #2/#6).
    // Scoped to author_user_id for the same reason chat_messages is scoped to
    // sender_user_id: the subject's data is what they WROTE. An event-scoped
    // read would hand a supplier the couple's private issue log and every other
    // supplier's reports on their own subject-access request. `resolved_by_
    // user_id` is deliberately not a second lane — clearing someone else's item
    // is an action ON their record, not personal data OF the person who cleared
    // it. Mirrors the erasure decision in lib/erasure/coverage.ts.
    supabase
      .from('event_day_requests')
      .select('request_id, event_id, origin, kind, status, body, preset_key, created_at')
      .eq('author_user_id', user.id)
      .order('created_at', { ascending: true }),
    // RA 10173 (2026-07-27) — the subject's own asks for event access, scoped
    // to requester_user_id. `decided_by_user_id` is deliberately not a second
    // lane: answering someone else's request is an action ON their record.
    supabase
      .from('event_access_requests')
      .select('request_id, event_id, requested_areas, note, status, decisions, created_at')
      .eq('requester_user_id', user.id)
      .order('created_at', { ascending: true }),
    /*
      RA 10173 (2026-08-28) — why the subject removed a celebration, in their
      own words, plus any note they wrote asking us to remove one money was
      holding. Free text they typed about themselves: it belongs in their
      export.

      ⚖ `reviewed_by` and `admin_note` are deliberately NOT selected. The note
      is OUR answer written by a member of staff — an action ON their record,
      not personal data OF them — the same line already drawn for
      `event_day_requests` and `event_access_requests` above. They do receive
      that answer, as a notification, at the moment it is written.

      🔑 SCOPED TO `user_id`, THE AUTHOR — never to the celebration. A
      co-organiser's reason for removing a shared celebration is their record,
      not this person's.
    */
    supabase
      .from('event_deletion_requests')
      .select('event_name, reason_code, reason, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    /*
      RA 10173 (2026-09-02) — the "years" the subject grouped their own
      celebrations into (item 7 phase 7a, migration 20271189765490). The name
      is free text they typed and the grouping is their own organising work,
      so it is personal data OF them and belongs in their export.

      🔑 SCOPED TO `owner_user_id`, THE OWNER — never to the celebration. A
      cluster is readable by nobody but the person who made it, and a
      co-organiser's grouping of a shared wedding is THEIR record, not this
      person's. Same line already drawn for `event_deletion_requests` above.

      ⚠ The MEMBER rows are deliberately not a second lane. Which celebrations
      sit in the year is already answerable from `event_memberships` above, and
      a membership row's `event_id` would export a bare uuid the subject cannot
      resolve — no added transparency, one more identifier on the page.
    */
    supabase
      .from('event_clusters')
      .select('public_id, display_name, created_at')
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: true }),
    // RA 10173 (2026-09-03) — costs the subject RECORDED THEMSELVES (BA7,
    // migration 20271193967957). `event_costs` is the couple's own spending
    // with no supplier on the other side of it: the rings, the marriage
    // licence, tips, ang pao.
    //
    // AUTHOR-scoped, not event-scoped, for the same reason
    // `event_vendor_working_notes` is. A wedding budget is jointly authored:
    // an event-scoped read would drop the OTHER partner's entries into this
    // subject's access file, which is a third-party disclosure — precisely
    // what this endpoint must never commit. `created_by_user_id` is the one
    // column that says who typed a row, so it is the one the export follows.
    //
    // Read through the AUTHED client: `event_costs_couple_read` already scopes
    // the table to the caller's own events, so the eq() narrows an already-safe
    // set rather than bypassing anything. No service-role read is warranted.
    supabase
      .from('event_costs')
      .select('cost_id, event_id, plan_group_id, label, amount_php, paid_php, due_date, note, created_at')
      .eq('created_by_user_id', user.id)
      .order('created_at', { ascending: true }),
    // RA 10173 (2026-09-03) — the "Make it real" renders the subject REQUESTED
    // (MB2, migration 20271200273322). A render is an activity record about the
    // person who asked for it and spent the credit, so it is theirs to see.
    //
    // AUTHOR-scoped for the same reason `event_costs` is: a mood board is
    // jointly authored, and an event-scoped read would hand this subject the
    // other partner's renders — a third-party disclosure this route must never
    // commit.
    //
    // `prompt` and `design_snapshot` are DELIBERATELY OMITTED. Neither is
    // personal data about the subject: one is the machine brief assembled from
    // the shared board, the other is the board itself, and both belong to the
    // event rather than to whoever pressed the button. `note` IS included —
    // that is the subject's own words.
    supabase
      .from('event_renders')
      .select('render_id, event_id, part_id, image_key, note, credits_debited, created_at, completed_at')
      .eq('created_by_user_id', user.id)
      .order('created_at', { ascending: true }),
    // RA 10173 (MB8) — the share-consent decisions this subject PERSONALLY made.
    //
    // The consent belongs to the EVENT, but the ACT of giving it is this
    // person's: they were offered a bonus render in exchange for allowing
    // their creations to be featured, and they answered. That answer, and when
    // they gave or withdrew it, is exactly the kind of thing a data subject is
    // entitled to see — and it is the only reason the table carries a uuid at
    // all.
    //
    // AUTHOR-scoped, like `event_renders` above and for the same reason: an
    // event-scoped read would disclose a consent the OTHER partner gave.
    supabase
      .from('event_render_share_consent')
      .select('event_id, consented, consented_at, withdrawn_at, updated_at')
      .eq('consented_by_user_id', user.id)
      .order('updated_at', { ascending: true }),
  ]);

  // ── Unwrap every read through the integrity helper ──────────────────────────
  // `?? []` is banned on this route: it turns "the read failed" into the
  // assertion "you have no such records".
  const profile = singleOutcome('profile (users)', profileRes);
  const events = listOutcome('event_memberships', eventsRes);
  const ownedEvents = listOutcome<Record<string, unknown>>('owned_event_birth_data', ownedEventsRes);
  // `adminUnavailable` is passed for the same reason it is passed to the two
  // coordinator sections: without it, a run with no service key would ship
  // `vendor_profile: null` with `export_complete: true` — i.e. tell a vendor in
  // writing that Setnayan holds no business record for them, when in fact we
  // simply did not look.
  const vendorProfile = singleOutcome<{
    vendor_profile_id?: string;
    logo_url?: string | null;
    portfolio_r2_keys?: string[] | null;
  }>('vendor_profile', vendorProfileRes, adminUnavailable);
  const messages = listOutcome('chat_messages_authored', messagesRes);
  const orders = listOutcome('orders', ordersRes);
  const payments = listOutcome('payments', paymentsRes);
  const faceEnrollments = listOutcome('face_enrollments', faceEnrollmentsRes);
  const dependents = listOutcome('alaga_dependents', dependentsRes);
  const godparents = listOutcome('alaga_godparents', godparentsRes);
  const communityMemberships = listOutcome('samahan_memberships', communityMembershipsRes);
  const samahanStories = listOutcome('samahan_stories', samahanStoriesRes);
  const samahanMessages = listOutcome('samahan_messages', samahanMessagesRes);
  const coordinatorConsents = listOutcome('coordinator_access_consents', coordinatorConsentsRes);
  const marketingShareConsents = listOutcome('marketing_share_consents', marketingShareConsentsRes);
  const vendorReuseRequests = listOutcome('vendor_reuse_requests', vendorReuseRequestsRes);
  const workingNotes = listOutcome(
    'vendor_working_notes_authored',
    workingNotesRes,
    adminUnavailable,
  );
  const broadcastsSent = listOutcome(
    'coordinator_broadcasts_sent',
    broadcastsSentRes,
    adminUnavailable,
  );
  const dayRequests = listOutcome('day_requests_authored', dayRequestsRes);
  const accessRequests = listOutcome('event_access_requests_made', accessRequestsRes);
  const eventRemovalReasons = listOutcome(
    'event_removals_asked_for',
    eventRemovalReasonsRes,
  );
  const eventClusters = listOutcome('years_you_grouped', eventClustersRes);
  const ownCosts = listOutcome('own_costs_recorded', ownCostsRes);
  const ownRenders = listOutcome('own_renders_requested', ownRendersRes);
  const ownShareConsents = listOutcome('own_share_consents_given', ownShareConsentsRes);

  // Resolve the vendor's own media to usable URLs (additive — the raw r2:// keys
  // remain inside vendor_profile.* and each media row). RLS-enforced reads, so
  // a vendor only ever exports their OWN media.
  const vp = vendorProfile.row;

  let vendorPortfolioMedia: string[] = [];
  let vendorSubmittedMedia: unknown[] = [];
  let vendorMediaIncomplete: string | null = null;
  // Both media sections hang off `vp`, so when the profile read did not happen
  // they resolve to `[]` with nothing said — the silent empty, one level down.
  // A vendor whose portfolio is 40 photos would be handed two empty arrays and
  // `export_complete: true`. Named here through the same helper so the wording
  // matches every other NOT READ notice on this route.
  if (!vp && vendorProfile.incomplete) {
    vendorMediaIncomplete = listOutcome(
      'vendor_portfolio_media + vendor_submitted_media',
      null,
      adminUnavailable,
    ).incomplete;
  }
  if (vp) {
    vendorPortfolioMedia = await displayUrlsForStoredAssets([
      vp.logo_url ?? null,
      ...(vp.portfolio_r2_keys ?? []),
    ]);
    if (vp.vendor_profile_id) {
      const mediaRes = await supabase
        .from('editorial_vendor_media')
        .select(
          'public_id, event_id, media_type, still_r2_key, boomerang_r2_key, caption, moderation_state, created_at',
        )
        .eq('vendor_profile_id', vp.vendor_profile_id);
      const media = listOutcome<Record<string, unknown>>('vendor_submitted_media', mediaRes);
      vendorMediaIncomplete = media.incomplete;
      vendorSubmittedMedia = await Promise.all(
        media.rows.map(async (m) => ({
          ...m,
          media_urls: await displayUrlsForStoredAssets([
            (m.still_r2_key as string | null) ?? null,
            (m.boomerang_r2_key as string | null) ?? null,
          ]),
        })),
      );
    }
  }

  // Sections that FAILED or were NOT READ. Empty on a clean run — which is what
  // lets `export_complete` below be a true assertion rather than a hope.
  const incompleteSections = collectIncomplete([
    profile,
    events,
    ownedEvents,
    vendorProfile,
    { incomplete: vendorMediaIncomplete },
    messages,
    orders,
    payments,
    faceEnrollments,
    dependents,
    godparents,
    communityMemberships,
    coordinatorConsents,
    marketingShareConsents,
    workingNotes,
    broadcastsSent,
    dayRequests,
    accessRequests,
    ownCosts,
    ownRenders,
  ]);

  const exported = {
    exported_at: new Date().toISOString(),
    note: 'RA 10173 personal data export · Setnayan V1',
    // TRUE only when every section below was read without error. When false,
    // the failed sections are named at the end of `not_included` and their
    // empty arrays must NOT be read as "no such records exist".
    export_complete: incompleteSections.length === 0,
    media_note:
      'Media links are time-limited (presigned). The durable record is the r2:// keys inside vendor_profile / vendor_submitted_media.',
    auth: {
      user_id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
    },
    profile: profile.row,
    event_memberships: events.rows,
    // RA 10173 (PR-G) — the sensitive birth fields the user opted in to (BaZi
    // date-check), for events they own. Flattened to the birth-relevant fields
    // so the export is explicit about what sensitive data Setnayan holds.
    // SEC-2b: rows now come FLAT off public.events_host (the host-scoped view)
    // rather than as an `events` embed under an event_members row — see the
    // query above. Kept tolerant of either shape so the mapping is not the
    // thing that breaks if the query is ever restructured again.
    owned_event_birth_data: ownedEvents.rows.map((row) => {
      const rawEv = (row as { events?: unknown }).events;
      const embedded = (Array.isArray(rawEv) ? rawEv[0] : rawEv) as Record<string, unknown> | null;
      const ev = embedded ?? (row as Record<string, unknown>);
      return {
        event_id: (row as { event_id?: string }).event_id ?? null,
        public_id: (ev?.public_id as string | null) ?? null,
        display_name: (ev?.display_name as string | null) ?? null,
        event_date: (ev?.event_date as string | null) ?? null,
        ceremony_type: (ev?.ceremony_type as string | null) ?? null,
        secondary_ceremony_type: (ev?.secondary_ceremony_type as string | null) ?? null,
        partner_a_birth_date: (ev?.partner_a_birth_date as string | null) ?? null,
        partner_a_birth_time: (ev?.partner_a_birth_time as string | null) ?? null,
        partner_b_birth_date: (ev?.partner_b_birth_date as string | null) ?? null,
        partner_b_birth_time: (ev?.partner_b_birth_time as string | null) ?? null,
        bazi_birthdata_consent_at: (ev?.bazi_birthdata_consent_at as string | null) ?? null,
      };
    }),
    vendor_profile: vendorProfile.row,
    vendor_portfolio_media: vendorPortfolioMedia,
    vendor_submitted_media: vendorSubmittedMedia,
    chat_messages_authored: messages.rows,
    // RA 10173 (2026-07-05) — the subject's own commerce + biometric records.
    orders: orders.rows,
    payments: payments.rows,
    // Biometric CONSENT metadata only — raw face_vector embeddings are
    // intentionally excluded from the export.
    face_enrollments: faceEnrollments.rows,
    // RA 10173 (2026-07-17) — Alaga records (guardian-stored, claimed-as-own,
    // and handed-over history) + godparent edges. Consent stamps included.
    alaga_dependents: dependents.rows,
    alaga_godparents: godparents.rows,
    // Samahan memberships — group name (user-chosen), role, joined_at.
    samahan_memberships: communityMemberships.rows,
    // Samahan stories the subject posted that are still live (24-hour
    // lifetime) — metadata only; the clip file itself is deleted at expiry.
    samahan_stories: samahanStories.rows,
    // Usapan messages the subject wrote, including ones they took down.
    samahan_messages: samahanMessages.rows,
    // RA 10173 (2026-07-19) — consent receipts the subject gave: coordinator
    // data-sharing consents (grant + revocation stamps) and marketing-share
    // consents (per-artifact FB-feature grants incl. post/take-down evidence).
    coordinator_access_consents: coordinatorConsents.rows,
    marketing_share_consents: marketingShareConsents.rows,
    vendor_reuse_requests: vendorReuseRequests.rows,
    // RA 10173 (2026-07-21) — coordinator-workspace prose the subject AUTHORED.
    // Author-scoped, never event-scoped (see the WHY blocks at each select).
    // Read privileged so a coordinator whose grant was later revoked still
    // receives the words they wrote (see the bounded-bypass block above).
    vendor_working_notes_authored: workingNotes.rows,
    coordinator_broadcasts_sent: broadcastsSent.rows,
    // The day-of notes the subject wrote (§10 #2/#6), author-scoped.
    day_requests_authored: dayRequests.rows,
    // Access the subject ASKED for (not what they were granted — that lives on
    // the moderator record).
    event_access_requests_made: accessRequests.rows,
    event_removals_asked_for: eventRemovalReasons.rows,
    // The costs the subject recorded themselves — author-scoped, so a shared
    // wedding budget never hands one partner the other's entries.
    own_costs_recorded: ownCosts.rows,
    // The mood-board renders the subject asked for, author-scoped. The prompt
    // and the design snapshot are the shared board's, not this person's.
    own_renders_requested: ownRenders.rows,
    // The "let Setnayan feature your creation" answers this subject gave, with
    // the dates they gave or withdrew them. See the read above.
    own_share_consents_given: ownShareConsents.rows,
    // The years the subject grouped their own celebrations into, owner-scoped.
    years_you_grouped: eventClusters.rows,
    not_included: [
      // CORRECTED 2026-07-21 — the previous single line claimed "no user-scoped
      // access-log table in V1". That was FALSE: supabase/migrations/
      // 20270212405352 creates public.admin_data_access_log with an
      // `accessed_user_id` column and an index its own comment labels
      // "(subject-access)". The two claims are now separated and each is true.
      'API-access audit log — genuinely does not exist: the 0033 gateway ships api_keys only and V1 has no public API endpoints, so no per-request access trail was ever recorded.',
      'admin_data_access_log — this DOES exist and IS keyed to you (accessed_user_id): it records which Setnayan admin viewed your account, when, and on which surface. It is not shipped in this file because each row also names the admin who looked, and the disclosure shape for that is pending DPO review. Request it from the DPO and it will be provided.',
      'face_vector embeddings (biometric raw data — metadata only is exported)',
      'active alaga claim_token values (live bearer secrets — never exported)',
      'working notes + day-of broadcasts authored by OTHERS (third-party personal data — the export ships what the subject wrote, not what they received)',
      // Anything that failed or went unread on THIS run, named. Empty on a
      // clean export; `export_complete` above is the machine-readable twin.
      ...incompleteSections,
    ],
  };

  return new NextResponse(JSON.stringify(exported, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="setnayan-data-${user.id}.json"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
