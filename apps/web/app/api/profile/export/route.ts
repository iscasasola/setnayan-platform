import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * RA 10173 data-export endpoint (V1 slice).
 *
 * Bundles the current user's PERSONAL data plus the rows they own or
 * authored across the app into a single JSON file. Auth-gated via the
 * Supabase session cookie. The user can only export their OWN data.
 *
 * Not in scope for V1:
 *   • Audit log of past API access (audit_log table not yet built)
 *   • Vendor portfolio + media uploads (R2 wiring not yet built)
 *   • Payment records (waits on 0034)
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

  const exported = {
    exported_at: new Date().toISOString(),
    note: 'RA 10173 personal data export · Setnayan V1',
    auth: {
      user_id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
    },
    profile: profileRes.data ?? null,
    event_memberships: eventsRes.data ?? [],
    vendor_profile: vendorProfileRes.data ?? null,
    chat_messages_authored: messagesRes.data ?? [],
    not_included: [
      'audit_log (not yet built)',
      'vendor portfolio + media uploads (R2 wiring not yet built)',
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
