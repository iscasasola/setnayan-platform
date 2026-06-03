import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runDriveCopyBatch } from '@/lib/drive-copy';

// Drive-copy layer — drain tick (Phase 2).
//
// POST /api/cron/drive-copy-tick
// Header: x-cron-secret: <OAUTH_REFRESH_CRON_SECRET> (reused; the same secret
//   already guards the OAuth-refresh + photo-delivery sweeps — one secret for
//   V1, can be split later).
//
// The feeders (papic auto-sync today; patiktok / pabati / pakanta / monogram /
// qr as their pipelines land) only ENQUEUE a drive_copy_artifacts row when an
// artifact finalizes — keeping the hot capture/render paths fast. THIS tick
// does the actual R2 -> Drive upload: it finds events with un-copied artifacts
// and copies one batch each into the couple's Google Drive.
//
// Owner action: point an external cron (Cloudflare Cron Trigger / Vercel Cron)
// at this endpoint on a 1-2 minute cadence with the shared secret. Until then
// the layer enqueues but doesn't copy — graceful, same as Drive-not-connected.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_EVENTS_PER_TICK = 5;
const BATCH_SIZE_PER_EVENT = 6;
const MAX_ATTEMPTS = 5;

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

  // Distinct events with un-copied artifacts still under the retry cap. Pull a
  // wide page of pending rows and dedupe event_ids in order (oldest first).
  const { data: pending } = await admin
    .from('drive_copy_artifacts')
    .select('event_id')
    .is('drive_file_id', null)
    .lt('attempt_count', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(200);

  const eventIds: string[] = [];
  for (const row of pending ?? []) {
    const id = row.event_id as string;
    if (!eventIds.includes(id)) eventIds.push(id);
    if (eventIds.length >= MAX_EVENTS_PER_TICK) break;
  }

  const results: Array<{ eventId: string; uploaded: number; failed: number; remaining: number }> = [];
  for (const eventId of eventIds) {
    const r = await runDriveCopyBatch({ eventId, batchSize: BATCH_SIZE_PER_EVENT });
    results.push({ eventId, ...r });
  }

  return NextResponse.json({ ok: true, events: results.length, results });
}
