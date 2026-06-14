import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventOwnsSku } from '@/lib/entitlements';
import { getWallSnapshot } from '@/lib/live-wall';

/**
 * GET /[slug]/live-wall — the freshness feed for the guest-page LiveWallBlock
 * (polled every 25s while the tab is visible during the wedding).
 *
 * Returns ONLY what the venue projector already shows: screened wall-safe
 * derivatives via getWallSnapshot (service-role; NSFW-gated, FaceBlock
 * fail-closed, couple-curatable) + the newest approved Kwento caption.
 * Gate = the LIVE_WALL activation, mirroring /wall/[eventId]'s door: without
 * it, a quiet 404-shaped JSON (no oracle about whether the event exists).
 *
 * Request-driven only — the client timer stops when the tab hides; there is
 * no server-side schedule (house no-cron rule).
 */

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!slug) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const admin = createAdminClient();
  const { data: event } = await admin
    .from('events')
    .select('event_id')
    .ilike('slug', slug)
    .maybeSingle();
  if (!event) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Ownership reads off orders.status via eventOwnsSku() (PR4 dead-unlock
  // repair, 2026-06-15) — bundle-aware, mirroring /wall/[eventId]'s door. The
  // old event_software_activations_v2 read had no payment-path writer.
  const owns = await eventOwnsSku(admin, event.event_id, 'LIVE_WALL');
  if (!owns) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const snapshot = await getWallSnapshot(event.event_id, null, { limit: 24 });
  return NextResponse.json({
    tiles: snapshot.tiles,
    count: snapshot.count,
    caption: snapshot.caption
      ? { text: snapshot.caption.text, author: snapshot.caption.author }
      : null,
  });
}
