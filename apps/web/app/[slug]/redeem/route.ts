import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { setGuestSession } from '@/lib/guest-session';

// Resolves an `?invite=<token>` link by validating the token, signing the
// guest-session cookie, recording a scan_events row, and redirecting to
// the clean /[slug] URL. Lives as a Route Handler because Next.js only
// permits cookie writes inside Route Handlers + Server Actions.

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug') ?? '';
  const token = url.searchParams.get('token') ?? '';
  const target = slug ? new URL(`/${slug}`, url.origin) : new URL('/', url.origin);

  if (!slug || !token) {
    target.searchParams.set('invite_error', 'missing');
    return NextResponse.redirect(target);
  }

  const admin = createAdminClient();

  const { data: event } = await admin
    .from('events')
    .select('event_id, slug')
    .ilike('slug', slug)
    .maybeSingle();

  if (!event) {
    return NextResponse.redirect(target);
  }

  const { data: guest } = await admin
    .from('guests')
    .select('guest_id, event_id, qr_token')
    .eq('qr_token', token)
    .is('deleted_at', null)
    .maybeSingle();

  if (!guest || guest.event_id !== event.event_id) {
    target.searchParams.set('invite_error', 'invalid_token');
    return NextResponse.redirect(target);
  }

  await setGuestSession({
    guest_id: guest.guest_id,
    event_id: guest.event_id,
    qr_token: guest.qr_token,
  });

  // Record the scan. Best-effort; failures don't block the redirect.
  const userAgent = request.headers.get('user-agent') ?? null;
  const xff = request.headers.get('x-forwarded-for') ?? '';
  const ipFull = xff.split(',')[0]?.trim() ?? '';
  const ipAnon = ipFull ? ipFull.split('.').slice(0, 3).join('.') + '.0' : null;
  await admin.from('scan_events').insert({
    event_id: guest.event_id,
    guest_id: guest.guest_id,
    source: 'browser',
    user_agent: userAgent,
    ip_anon: ipAnon,
    context: { entry: 'invite_link' },
  });

  return NextResponse.redirect(target);
}
