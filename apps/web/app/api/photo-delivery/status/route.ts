import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// 0009 Photo Delivery — panel polling endpoint.
//
// GET /api/photo-delivery/status?event_id=<uuid>
//
// Couple-authenticated. Returns the event's panel-facing fields plus the
// newest photo_delivery_jobs row (if any). The panel polls this every
// ~2s while a release is in flight; SSE could replace this later but
// polling is the simpler V1 shape and Vercel handles bursty traffic well.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get('event_id');
  if (!eventId) {
    return NextResponse.json({ error: 'event_id required' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || membership.member_type !== 'couple') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Service role for the join: oauth_grants is server-role-only.
  const admin = createAdminClient();
  const { data: ev } = await admin
    .from('events')
    .select(
      'photo_delivery_status, photo_delivery_progress_pct, photo_delivery_folder_id, photo_delivery_folder_name, photo_delivery_account_email, photo_delivery_started_at, photo_delivery_completed_at, photo_delivery_failed_count, photos_released_at',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (!ev) {
    return NextResponse.json({ error: 'event_not_found' }, { status: 404 });
  }

  const { data: latestJob } = await admin
    .from('photo_delivery_jobs')
    .select(
      'job_id, status, total_files, uploaded_files, failed_files, total_bytes, uploaded_bytes, current_file, started_at, completed_at',
    )
    .eq('event_id', eventId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    event: ev,
    job: latestJob,
  });
}
