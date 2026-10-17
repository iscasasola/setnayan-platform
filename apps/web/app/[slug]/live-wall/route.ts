import { NextResponse } from 'next/server';
import { partDoorHidden } from '../_lib/part-door.server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getWallSnapshot, guestWallMirrorActive } from '@/lib/live-wall';
import { liveEdgeHeaders, NOT_HELD, notRemembered, rememberedLiveRead } from '@/lib/live-day-cache';

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
 * no server-side schedule (house no-cron rule). Remembered per EVENT for a few
 * seconds — see the note below `dynamic`.
 */

export const dynamic = 'force-dynamic';

/*
  🧯 ONE ANSWER PER EVENT, NOT PER PHONE (2026-10-18, live-day polling).

  Every open guest phone asks this every ~25 s, and the answer above is the same for all of them — nothing here reads
  who is asking (the snapshot is read with `null` for the viewer). It used to be ~10 database reads PER PHONE PER POLL.
  The whole answer is now remembered for the event for `LIVE_DAY_SECONDS` (`lib/live-day-cache.ts`), so the database
  is asked once per event per window however many guests are watching; and a remembered answer is also handed to the
  CDN for a few seconds (`liveEdgeHeaders`), so most polls never reach a function at all.

  ⛔ ONLY AN OPEN WALL IS REMEMBERED. A "closed" answer (404) is never stored and never cached at the edge: the block
  STOPS POLLING FOR GOOD on a 404 (it is a refusal — see live-wall-block.tsx), and `guestWallMirrorActive` and the
  part-door read both close on a failed read. Remembering one guest's blip as "closed" would switch the wall off on
  every phone at the venue, permanently. An event read that FAILED answers 503 (an outage the block retries), not 404.
  A refused challenge read (`challengeMeasured: false`) is honest for this guest and is not handed to the others.
*/
const EDGE = liveEdgeHeaders(5, 10);

type WallAnswer = { status: 200 | 404 | 503; body: Record<string, unknown> };

const NOT_FOUND: WallAnswer = { status: 404, body: { error: 'not_found' } };

async function wallAnswer(slug: string): Promise<WallAnswer> {
  const admin = createAdminClient();
  const { data: event, error } = await admin
    .from('events')
    .select('event_id')
    .ilike('slug', slug)
    .maybeSingle();
  if (error) return notRemembered<WallAnswer>({ status: 503, body: { error: 'unavailable' } });
  if (!event) return notRemembered(NOT_FOUND);

  // Ownership reads off orders.status via eventOwnsSku() (PR4 dead-unlock
  // repair, 2026-06-15) — bundle-aware, mirroring /wall/[eventId]'s door. The
  // old event_software_activations_v2 read had no payment-path writer. Fused
  // with the couple's guest-mirror choice so the permissive half of the
  // question is not reachable on its own from a guest surface.
  if (!(await guestWallMirrorActive(admin, event.event_id))) {
    return notRemembered(NOT_FOUND);
  }
  // 👁 The couple hid Live on the stage the event is at ("What guests see"): the block is not drawn, and its data
  // closes with it — the same answer as a closed mirror. A read that failed closes too; the block simply stops asking.
  if (await partDoorHidden(admin, event.event_id, 'live').catch(() => true)) {
    return notRemembered(NOT_FOUND);
  }

  const snapshot = await getWallSnapshot(event.event_id, null, { limit: 24 });
  const answer: WallAnswer = {
    status: 200,
    body: {
      tiles: snapshot.tiles,
      count: snapshot.count,
      caption: snapshot.caption
        ? { text: snapshot.caption.text, author: snapshot.caption.author }
        : null,
      challenge: snapshot.challenge,
      challengeMeasured: snapshot.challengeMeasured,
    },
  };
  return snapshot.challengeMeasured ? answer : notRemembered(answer);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!slug) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const key = slug.toLowerCase();
  const answer = await rememberedLiveRead(`live-wall-v1:${key}`, key, () => wallAnswer(key));
  return NextResponse.json(answer.body, {
    status: answer.status,
    headers: answer.status === 200 && answer.body.challengeMeasured !== false ? EDGE : NOT_HELD,
  });
}
