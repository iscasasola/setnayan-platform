import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { displayUrlsForStoredAssets } from '@/lib/uploads';

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
 * companion guardrail (lib/export-coverage-guardrail.test.ts) now fails the
 * build when a new user-identifying table is neither exported nor explicitly
 * classified, so this class of silent omission cannot recur unreviewed.
 *
 * Not in scope for V1:
 *   • Audit log of past API access (no user-scoped access-log table — the
 *     0033 gateway ships api_keys only, consistent with "no public endpoints").
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
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
    coordinatorConsentsRes,
    marketingShareConsentsRes,
    workingNotesRes,
    broadcastsSentRes,
  ] = await Promise.all([
    supabase.from('users').select('*').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('event_members')
      .select('event_id, member_type, joined_via, created_at, events(public_id, display_name, event_date, slug)')
      .eq('user_id', user.id),
    // RA 10173 completeness (PR-G) — events the user OWNS (member_type='couple')
    // carry sensitive per-partner birth date/time + consent for the BaZi
    // date-check. The membership join above under-exports events (public_id /
    // display_name / event_date / slug only), so the opt-in birth fields would
    // be invisible without this owner-scoped select. RLS-enforced reads via the
    // user-session client (couple_can read their own event), so a user only ever
    // exports their OWN event birth data. Kept to the couple grain: a
    // coordinator on someone else's event must NOT export the couple's birth data.
    supabase
      .from('event_members')
      .select(
        'event_id, events(public_id, display_name, event_date, ceremony_type, secondary_ceremony_type, ' +
          'partner_a_birth_date, partner_a_birth_time, partner_b_birth_date, ' +
          'partner_b_birth_time, bazi_birthdata_consent_at)',
      )
      .eq('user_id', user.id)
      .eq('member_type', 'couple'),
    supabase
      .from('vendor_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle(),
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
    // RA 10173 (2026-07-19) — coordinator-access consent receipts the subject
    // GAVE as the couple/host (Coordinator_Role_Feature_Spec_2026-07-18.md § 3a):
    // their explicit decision to share event planning data (guest list · seating
    // · schedule · vendor chats) with a coordinator, plus any later revocation.
    // RLS is event-scoped (hosts + admin), so we filter explicitly to
    // consented_by_user_id — the export ships only consents the SUBJECT gave,
    // not other hosts' consent rows on shared events. Internal bigserial id and
    // moderator FK stay out; coordinator email/label are the denormalised
    // self-describing audit fields.
    supabase
      .from('coordinator_access_consents')
      .select(
        'event_id, coordinator_email, coordinator_label, scope_version, granted_at, revoked_at',
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
    supabase
      .from('event_vendor_working_notes')
      .select('note_id, event_id, event_vendor_id, author_role, visibility, body, created_at')
      .eq('author_user_id', user.id)
      .order('created_at', { ascending: true }),
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
    supabase
      .from('coordinator_broadcasts')
      .select('broadcast_id, event_id, sender_role, body, created_at')
      .eq('sender_user_id', user.id)
      .order('created_at', { ascending: true }),
  ]);

  // Resolve the vendor's own media to usable URLs (additive — the raw r2:// keys
  // remain inside vendor_profile.* and each media row). RLS-enforced reads, so
  // a vendor only ever exports their OWN media.
  const vp = vendorProfileRes.data as
    | {
        vendor_profile_id?: string;
        logo_url?: string | null;
        portfolio_r2_keys?: string[] | null;
      }
    | null;

  let vendorPortfolioMedia: string[] = [];
  let vendorSubmittedMedia: unknown[] = [];
  if (vp) {
    vendorPortfolioMedia = await displayUrlsForStoredAssets([
      vp.logo_url ?? null,
      ...(vp.portfolio_r2_keys ?? []),
    ]);
    if (vp.vendor_profile_id) {
      const { data: mediaRows } = await supabase
        .from('editorial_vendor_media')
        .select(
          'public_id, event_id, media_type, still_r2_key, boomerang_r2_key, caption, moderation_state, created_at',
        )
        .eq('vendor_profile_id', vp.vendor_profile_id);
      vendorSubmittedMedia = await Promise.all(
        (mediaRows ?? []).map(async (m) => ({
          ...m,
          media_urls: await displayUrlsForStoredAssets([
            (m.still_r2_key as string | null) ?? null,
            (m.boomerang_r2_key as string | null) ?? null,
          ]),
        })),
      );
    }
  }

  const exported = {
    exported_at: new Date().toISOString(),
    note: 'RA 10173 personal data export · Setnayan V1',
    media_note:
      'Media links are time-limited (presigned). The durable record is the r2:// keys inside vendor_profile / vendor_submitted_media.',
    auth: {
      user_id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
    },
    profile: profileRes.data ?? null,
    event_memberships: eventsRes.data ?? [],
    // RA 10173 (PR-G) — the sensitive birth fields the user opted in to (BaZi
    // date-check), for events they own. The `events` join shape is the owner's
    // own row; flatten to the birth-relevant fields so the export is explicit
    // about what sensitive data Setnayan holds.
    owned_event_birth_data: (ownedEventsRes.data ?? []).map((row) => {
      // Supabase types a to-one embed as an object, but can surface it as a
      // single-element array depending on the relationship hint — normalize both.
      const rawEv = (row as { events?: unknown }).events;
      const ev = (Array.isArray(rawEv) ? rawEv[0] : rawEv) as Record<string, unknown> | null;
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
    vendor_profile: vendorProfileRes.data ?? null,
    vendor_portfolio_media: vendorPortfolioMedia,
    vendor_submitted_media: vendorSubmittedMedia,
    chat_messages_authored: messagesRes.data ?? [],
    // RA 10173 (2026-07-05) — the subject's own commerce + biometric records.
    orders: ordersRes.data ?? [],
    payments: paymentsRes.data ?? [],
    // Biometric CONSENT metadata only — raw face_vector embeddings are
    // intentionally excluded from the export.
    face_enrollments: faceEnrollmentsRes.data ?? [],
    // RA 10173 (2026-07-17) — Alaga records (guardian-stored, claimed-as-own,
    // and handed-over history) + godparent edges. Consent stamps included.
    alaga_dependents: dependentsRes.data ?? [],
    alaga_godparents: godparentsRes.data ?? [],
    // Samahan memberships — group name (user-chosen), role, joined_at.
    samahan_memberships: communityMembershipsRes.data ?? [],
    // RA 10173 (2026-07-19) — consent receipts the subject gave: coordinator
    // data-sharing consents (grant + revocation stamps) and marketing-share
    // consents (per-artifact FB-feature grants incl. post/take-down evidence).
    coordinator_access_consents: coordinatorConsentsRes.data ?? [],
    marketing_share_consents: marketingShareConsentsRes.data ?? [],
    // RA 10173 (2026-07-21) — coordinator-workspace prose the subject AUTHORED.
    // Author-scoped, never event-scoped (see the WHY blocks at each select).
    vendor_working_notes_authored: workingNotesRes.data ?? [],
    coordinator_broadcasts_sent: broadcastsSentRes.data ?? [],
    not_included: [
      'audit_log (API access — no user-scoped access-log table in V1)',
      'face_vector embeddings (biometric raw data — metadata only is exported)',
      'active alaga claim_token values (live bearer secrets — never exported)',
      'working notes + day-of broadcasts authored by OTHERS (third-party personal data — the export ships what the subject wrote, not what they received)',
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
