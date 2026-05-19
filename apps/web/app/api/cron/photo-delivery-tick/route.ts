import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { processBatchForEvent } from '@/lib/photo-delivery-release';

// 0009 Photo Delivery — sweep tick.
//
// POST /api/cron/photo-delivery-tick
// Header: x-cron-secret: <OAUTH_REFRESH_CRON_SECRET> (reused; same secret
//   already guards the OAuth refresh sweep — single secret for V1, can be
//   split later if either gets a different rotation cadence).
//
// Picks up to 5 events with photo_delivery_status ∈ {'releasing','uploading'}
// and processes one batch of artifacts per event. Single function
// invocation must finish under the Vercel function timeout (60s on Pro
// tier); cap is enforced by batchSize per event × max events per tick.
//
// Cron cadence: 1-2 minute interval is the right shape. External cron
// runner (Cloudflare Cron Triggers or Vercel Cron) POSTs against this
// endpoint with the shared secret.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_EVENTS_PER_TICK = 5;
const BATCH_SIZE_PER_EVENT = 6;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function POST(req: NextRequest) {
  const provided = req.headers.get('x-cron-secret') ?? '';
  const expected = process.env.OAUTH_REFRESH_CRON_SECRET ?? '';
  if (!expected || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();

  // Find events with work to do. Order by the oldest-started release so
  // long-running deliveries finish before younger ones cut in line.
  const { data: events, error } = await admin
    .from('events')
    .select('event_id, photo_delivery_started_at')
    .in('photo_delivery_status', ['releasing', 'uploading'])
    .order('photo_delivery_started_at', { ascending: true, nullsFirst: false })
    .limit(MAX_EVENTS_PER_TICK);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const summaries = [] as Array<{
    event_id: string;
    uploaded: number;
    failed: number;
    remaining: number;
    status: string;
  }>;

  for (const ev of events ?? []) {
    const r = await processBatchForEvent({
      eventId: ev.event_id as string,
      batchSize: BATCH_SIZE_PER_EVENT,
    });
    summaries.push({
      event_id: r.eventId,
      uploaded: r.uploaded,
      failed: r.failed,
      remaining: r.remaining,
      status: r.status,
    });
  }

  return NextResponse.json({
    scanned: events?.length ?? 0,
    summaries,
  });
}
