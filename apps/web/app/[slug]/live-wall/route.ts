import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getWallSnapshot, guestWallMirrorActive } from '@/lib/live-wall';

/**
 * GET /[slug]/live-wall — the freshness feed for the guest-page LiveWallBlock
 * (polled every 25s while the tab is visible during the wedding).
 *
 * Returns ONLY what the venue projector already shows: screened wall-safe
 * derivatives via getWallSnapshot (service-role; NSFW-gated, FaceBlock
 * fail-closed, couple-curatable) + the newest approved Kwento caption.
 * Gate = guestWallMirrorActive: the LIVE_WALL activation AND the couple's
 * choice to mirror the wall onto guests' phones at all. Without either, a quiet
 * 404-shaped JSON (no oracle about whether the event exists).
 *
 * This route matters more than it looks. It is a freshness feed, so hiding the
 * block on the page while leaving this open would mean the wall was still one
 * URL away from anyone holding the couple's slug — and the block itself would
 * keep repopulating. Turning the mirror off has to close the data, not the
 * component.
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
  // old event_software_activations_v2 read had no payment-path writer. Fused
  // with the couple's guest-mirror choice so the permissive half of the
  // question is not reachable on its own from a guest surface.
  if (!(await guestWallMirrorActive(admin, event.event_id))) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const snapshot = await getWallSnapshot(event.event_id, null, { limit: 24 });
  return NextResponse.json({
    tiles: snapshot.tiles,
    count: snapshot.count,
    caption: snapshot.caption
      ? { text: snapshot.caption.text, author: snapshot.caption.author }
      : null,
    challenge: snapshot.challenge,
    challengeMeasured: snapshot.challengeMeasured,
  });
}
