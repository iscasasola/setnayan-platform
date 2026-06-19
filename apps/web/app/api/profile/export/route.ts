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
 * Not in scope for V1:
 *   • Audit log of past API access (no user-scoped access-log table — the
 *     0033 gateway ships api_keys only, consistent with "no public endpoints").
 *   • Payment records (waits on 0034).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const [profileRes, eventsRes, vendorProfileRes, messagesRes] = await Promise.all([
    supabase.from('users').select('*').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('event_members')
      .select('event_id, member_type, joined_via, created_at, events(public_id, display_name, event_date, slug)')
      .eq('user_id', user.id),
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
    vendor_profile: vendorProfileRes.data ?? null,
    vendor_portfolio_media: vendorPortfolioMedia,
    vendor_submitted_media: vendorSubmittedMedia,
    chat_messages_authored: messagesRes.data ?? [],
    not_included: [
      'audit_log (API access — no user-scoped access-log table in V1)',
      'payment records (iteration 0034)',
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
