import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { GUEST_SESSION_COOKIE_NAME, verifyGuestSessionToken } from '@/lib/guest-session';
import { canViewSlugEvent } from '@/lib/slug-access';
import { openToStrangers } from '@/lib/event-visibility';
import { resolveEffectiveVisibility } from '@/lib/launch-save-the-date';
import { onlyWhatGuestsMaySee } from '@/lib/schedule';
import { liveEdgeHeaders, NOT_HELD, rememberedLiveRead } from '@/lib/live-day-cache';
import type { RunOfShowBlock, RunState } from '@/lib/run-of-show';

/**
 * GET /api/live/run-of-show/[eventId] — the guests' run of show, asked on a timer instead of a Realtime socket
 * (EV1 · owner 2026-10-28, DECISION_LOG "NO EVENT HUB MAY CRASH": *guests never hold a live connection*).
 *
 * The guests' schedule header (`RunOfShowHeader forGuests`) used to hold a `postgres_changes` channel per phone —
 * Realtime then evaluates the row's RLS for EVERY subscriber on EVERY advance, and the 2026-10-18 audit measured
 * Realtime's WAL polling at >10× all other database time. A guest's phone now asks this every ~30 s while it is looked
 * at, on the day. The coordinators, hosts and suppliers (a handful of screens) keep their socket.
 *
 * 🧯 ONE ANSWER PER EVENT. The guests' lines are the same for every guest: read the way a cookie-only guest's own read
 * reads them (the anonymous policy + `onlyWhatGuestsMaySee`, exactly `fetchRunOfShowBlocks(eventId, true)` for a guest
 * — never the service role), remembered per event (`rememberedLiveRead`), and for an event open to strangers handed
 * to the CDN for a few seconds.
 *
 * 🔒 A CLOSED EVENT ASKS THE SAME DOOR ITS PAGES ASK — `live-pulse/route.ts`'s rule: this event's guest pass
 * (signature-checked) or `canViewSlugEvent`. Refused → 404, never cached. A refused read → 503 (the header keeps what it
 * shows and asks again later).
 */

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EDGE = liveEdgeHeaders(5, 10);

async function holdsThisEventsPass(eventId: string): Promise<boolean> {
  const token = (await cookies()).get(GUEST_SESSION_COOKIE_NAME)?.value;
  if (!token) return false;
  const verified = await verifyGuestSessionToken(token);
  return verified?.payload.event_id === eventId && verified.expiresAtSeconds > Date.now() / 1000;
}

/** The guests' lines, read as a cookie-only guest reads them (the anonymous client — no session, no cookies). */
async function guestLines(eventId: string): Promise<RunOfShowBlock[]> {
  const anon = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => [], setAll() {} },
  });
  const read = anon
    .from('event_schedule_blocks')
    .select('block_id, label, start_at, end_at, location, run_state, actual_start_at, block_type, is_public')
    .eq('event_id', eventId);
  const { data, error } = await onlyWhatGuestsMaySee(read).order('start_at', { ascending: true }).order('sort_order', { ascending: true });
  // A refused read throws: nothing is remembered, and this phone is answered 503 (it keeps what it shows).
  if (error) throw error;
  return (data ?? []).map((b) => ({
    block_id: b.block_id as string,
    label: b.label as string,
    start_at: b.start_at as string,
    end_at: (b.end_at as string | null) ?? null,
    location: (b.location as string | null) ?? null,
    run_state: (b.run_state as RunState) ?? 'upcoming',
    actual_start_at: (b.actual_start_at as string | null) ?? null,
    block_type: (b.block_type as string | null) ?? '',
    is_public: (b.is_public as boolean | null) ?? true,
  }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  if (!UUID.test(eventId)) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NOT_HELD });
  const { data: event, error } = await createAdminClient()
    .from('events')
    .select('event_id, landing_page_visibility, launch_mode, scheduled_launch_at')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NOT_HELD });
  if (!event) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NOT_HELD });
  const visibility = resolveEffectiveVisibility(event as Parameters<typeof resolveEffectiveVisibility>[0]);
  const open = openToStrangers(visibility);
  if (!open && !(await holdsThisEventsPass(eventId)) && !(await canViewSlugEvent(eventId, visibility))) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NOT_HELD });
  }
  try {
    const blocks = await rememberedLiveRead(`run-of-show-guests-v1:${eventId}`, eventId, () => guestLines(eventId));
    return NextResponse.json({ blocks }, { headers: open ? EDGE : NOT_HELD });
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NOT_HELD });
  }
}
