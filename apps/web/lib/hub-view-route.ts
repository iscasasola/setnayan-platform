import type { NextRequest } from 'next/server';
import { RESERVED_SLUGS } from '@/lib/reserved-slugs';
import { isUserNestingCutoverEnabled } from '@/lib/public-event-url';
import { envFlagEnabled } from '@/lib/env-flag';
import { GUEST_SESSION_COOKIE_NAME, resolveGuestSessionSecret, verifyGuestSessionToken } from '@/lib/guest-session';
import { STORE_SHELL_CLIENT_TYPE_COOKIE } from '@/lib/store-shell';
import {
  HUB_BUST_COOKIE,
  HUB_VIEW_SEGMENT,
  formatHubViewKey,
  hubPassMac,
  hubRequestShape,
  hubUaFacts,
  type HubUaFacts,
  type HubViewer,
} from '@/lib/hub-view-key';
import { clockCode, clockRowOf, eventClock, type EventClockRow } from '@/lib/event-clock';
import { venueZoneFromCoords } from '@/lib/venue-zone';

/**
 * lib/hub-view-route.ts — THE MIDDLEWARE'S HALF OF THE CACHED EVENT HUB (EV1, 2026-10-28). See `lib/hub-view-key.ts`.
 *
 * For a request a cached copy may answer (`hubRequestShape`), it asks the database ONE question — "is this address an
 * event, and what is its stamp?" (`event_public_stamp`, the guest page's own stamp, service role) — remembered on this
 * instance for `STAMP_MEMO_MS`, so a venue full of phones opening the hub costs it one tiny read per few seconds. Then
 * it names the viewer from the pass cookie (signature only — the route checks the seal against the database before it
 * draws a guest's page) and returns the address to rewrite to. Anything uncertain — not an event, a failed stamp read,
 * a pass for ANOTHER event, the switch off — returns null: the live render, exactly as before. It never throws.
 *
 * ⏱ THE CLOCK IS IN THE KEY (owner ruling, 10 Nov 2026 — "every part follows ONE clock"). The event's stage flips at
 * an instant with no write, so the key carries `clockCode(eventClock(…))` too, computed HERE, per request, from the
 * clock's columns (`eventClockInputs`). Those columns are part of the event row, and any write to it moves the stamp,
 * so they are remembered per (event, stamp) — read once per stamp, not per request. The first request after 06:00 on
 * the day names a new key; nothing has to run at 06:00.
 *
 * ⏻ `HUB_CACHE_DISABLED=1` switches the whole thing off (every request takes the live render) without a deploy of code.
 */

const STAMP_MEMO_MS = 3_000;
const STAMP_TIMEOUT_MS = 1_500;
const MEMO_MAX = 2_000;
type Stamp = { eventId: string; rev: string } | null;
const stampMemo = new Map<string, { at: number; value: Stamp }>();
type ClockInputs = EventClockRow & { venue_latitude: number | null; venue_longitude: number | null };
/** The clock's columns, per `{eventId}:{rev}` — a write to the event moves the stamp, so a remembered row never lies. */
const clockMemo = new Map<string, ClockInputs>();
/** `EVENT_CLOCK_COLUMNS` without `cleared_at` (the dashboard's, never the guests' page). */
const CLOCK_SELECT = 'event_date,event_end_date,launch_mode,manual_phase,std_invitation_launch_date,venue_latitude,venue_longitude';

/** TEST ONLY. */
export function forgetHubStampsForTest(): void {
  stampMemo.clear();
  clockMemo.clear();
}

/** The clock's columns for this event at this stamp — `undefined` when they could not be read (→ the live render). */
async function eventClockInputs(stamp: { eventId: string; rev: string }, fetcher: typeof fetch): Promise<ClockInputs | undefined> {
  const key = `${stamp.eventId}:${stamp.rev}`;
  const hit = clockMemo.get(key);
  if (hit) return hit;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return undefined;
  try {
    const res = await fetcher(
      `${url.replace(/\/$/, '')}/rest/v1/events?event_id=eq.${encodeURIComponent(stamp.eventId)}&select=${CLOCK_SELECT}`,
      {
        method: 'GET',
        headers: { apikey: service, Authorization: `Bearer ${service}` },
        signal: AbortSignal.timeout(STAMP_TIMEOUT_MS),
        cache: 'no-store',
      },
    );
    if (!res.ok) return undefined;
    const rows = (await res.json()) as unknown[] | null;
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return undefined;
    const value = clockRowOf(row);
    if (clockMemo.size >= MEMO_MAX) clockMemo.delete(clockMemo.keys().next().value as string);
    clockMemo.set(key, value);
    return value;
  } catch {
    return undefined;
  }
}

async function hubStamp(slug: string, fetcher: typeof fetch): Promise<Stamp | undefined> {
  const key = slug.toLowerCase();
  const hit = stampMemo.get(key);
  if (hit && Date.now() - hit.at < STAMP_MEMO_MS) return hit.value;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return undefined;
  try {
    const res = await fetcher(`${url.replace(/\/$/, '')}/rest/v1/rpc/event_public_stamp`, {
      method: 'POST',
      headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_slug: key }),
      signal: AbortSignal.timeout(STAMP_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) return undefined; // a refused read is never remembered
    const rows = (await res.json()) as Array<{ event_id?: string | null; rev?: number | string | null }> | null;
    const row = Array.isArray(rows) ? rows[0] : null;
    const value: Stamp = row?.event_id ? { eventId: row.event_id, rev: String(row.rev ?? 0) } : null;
    if (stampMemo.size >= MEMO_MAX) stampMemo.delete(stampMemo.keys().next().value as string);
    stampMemo.set(key, { at: Date.now(), value });
    return value;
  } catch {
    return undefined;
  }
}

/** The pathname to rewrite this request to (`/{slug}/cached/{key}`), or null for the live render. Never throws. */
export async function hubViewRewritePath(request: NextRequest, fetcher: typeof fetch = fetch): Promise<string | null> {
  try {
    if (envFlagEnabled(process.env.HUB_CACHE_DISABLED)) return null;
    if (isUserNestingCutoverEnabled()) return null; // the bare root redirects to /u/… — that is the live page's call
    const shape = hubRequestShape({
      method: request.method,
      pathname: request.nextUrl.pathname,
      searchParams: request.nextUrl.searchParams,
      cookieNames: request.cookies.getAll().map((c) => c.name),
      clientTypeCookie: request.cookies.get(STORE_SHELL_CLIENT_TYPE_COOKIE)?.value ?? null,
      userAgent: request.headers.get('user-agent'),
      isServerAction: request.headers.has('next-action'),
      reserved: (s) => RESERVED_SLUGS.has(s),
    });
    if (!shape) return null;
    // `?demo=` is the middleware's own flag (it sets a cookie and redirects) — never answered from a cache.
    if (request.nextUrl.searchParams.has('demo')) return null;
    const stamp = await hubStamp(shape.slug, fetcher);
    if (!stamp) return null;
    // ⏱ The event's stage and day-of phase NOW, at the venue — the one clock (lib/event-clock.ts), on the zone the page
    // itself uses. Unreadable → the live render, never a key that cannot move when the stage does.
    const inputs = await eventClockInputs(stamp, fetcher);
    if (!inputs) return null;
    const clock = clockCode(
      eventClock({ event: inputs, tz: venueZoneFromCoords(inputs.venue_latitude, inputs.venue_longitude) }),
    );

    let viewer: HubViewer = { kind: 'anonymous' };
    let ua: HubUaFacts | null = null;
    const token = request.cookies.get(GUEST_SESSION_COOKIE_NAME)?.value;
    if (token) {
      const verified = await verifyGuestSessionToken(token);
      // A forged / expired pass is no pass — the live render reads it as nobody too.
      if (verified && verified.expiresAtSeconds > Date.now() / 1000) {
        // Another event's pass: the live page has its own rules for that ("set aside", the pass book) — leave it live.
        if (verified.payload.event_id !== stamp.eventId) return null;
        const secret = resolveGuestSessionSecret();
        if (!secret.ok) return null;
        viewer = {
          kind: 'guest',
          guestId: verified.payload.guest_id,
          mac: await hubPassMac(secret.material, verified.payload.guest_id, verified.payload.qr_token),
        };
        ua = hubUaFacts(request.headers.get('user-agent'));
      }
    }
    const bustRaw = request.cookies.get(HUB_BUST_COOKIE)?.value ?? null;
    const bust = bustRaw && /^[a-z0-9]{1,16}$/.test(bustRaw) ? bustRaw : null;
    const key = formatHubViewKey({ rev: stamp.rev, clock, viewer, ua, tab: shape.tab, bust });
    return `/${shape.slug}/${HUB_VIEW_SEGMENT}/${key}`;
  } catch {
    return null;
  }
}
