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
    not_included: [
      'audit_log (API access — no user-scoped access-log table in V1)',
      'face_vector embeddings (biometric raw data — metadata only is exported)',
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
