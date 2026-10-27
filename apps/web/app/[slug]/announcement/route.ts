import { NextResponse } from 'next/server';
import { loadEventShell } from '../_lib/loaders';
import { holdsThisEventsCurrentPass, latestAnnouncementFor } from '../_lib/latest-announcement.server';
import { announcementStageOf } from '../_lib/announcement-stage';
import { NOT_HELD } from '@/lib/live-day-cache';

/**
 * GET /[slug]/announcement — the coordinator's latest words, for a guest of this event (EV1, 2026-10-28).
 *
 * Asked by the announcement card (`_components/day-of-announcement.tsx`, mounted once by `[slug]/layout.tsx` on every
 * guest page) when the page opens and every ~30 s while it is looked at. It replaces the layout's own read — which
 * made every page under it render per request — and the per-guest Realtime channel (owner 2026-10-28: guests never
 * hold a live connection). The words are one remembered answer per event; the gate is per phone. See
 * `_lib/latest-announcement.server.ts`.
 *
 * Answers `{ body, createdAt, stage }` or `{ body: null }` — the SAME answer for "not a guest of this event", "no
 * announcement" and "the event is over", so it says nothing about who is on the list. No event → 404. A refused read
 * → 503 (the card keeps whatever it shows and asks again later — an unreadable answer is never "nothing was said").
 * Never cached anywhere (`private, no-store`): the answer depends on the phone's pass.
 */

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let event: Awaited<ReturnType<typeof loadEventShell>>;
  try {
    event = await loadEventShell(slug);
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NOT_HELD });
  }
  if (!event?.event_id) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NOT_HELD });

  const stage = announcementStageOf(event);
  if (stage === 'after') return NextResponse.json({ body: null }, { headers: NOT_HELD });
  try {
    if (!(await holdsThisEventsCurrentPass(event.event_id))) return NextResponse.json({ body: null }, { headers: NOT_HELD });
    const latest = await latestAnnouncementFor(event.event_id);
    return NextResponse.json(latest ? { ...latest, stage } : { body: null }, { headers: NOT_HELD });
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NOT_HELD });
  }
}
