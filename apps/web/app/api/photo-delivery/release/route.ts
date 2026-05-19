import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enqueueRelease } from '@/lib/photo-delivery-release';

// 0009 Photo Delivery — release producer.
//
// POST /api/photo-delivery/release
// Body: { event_id: string }
//
// Couple-authenticated. Validates the event has a connected Drive grant,
// creates a photo_delivery_jobs row + photo_delivery_artifacts rows, and
// flips events.photo_delivery_status='releasing'. The actual uploads are
// processed by the /api/cron/photo-delivery-tick sweep.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: { event_id?: string };
  try {
    body = (await req.json()) as { event_id?: string };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const eventId = body.event_id;
  if (!eventId) {
    return NextResponse.json({ error: 'event_id required' }, { status: 400 });
  }

  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || membership.member_type !== 'couple') {
    return NextResponse.json(
      { error: 'only couples can release photos for this event' },
      { status: 403 },
    );
  }

  const result = await enqueueRelease({ eventId, userId: user.id });
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }
  return NextResponse.json({
    job_id: result.jobId,
    total_files: result.totalFiles,
    already_complete: result.alreadyComplete,
  });
}
