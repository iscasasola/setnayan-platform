/**
 * apps/web/lib/live-wall.ts — server-side I/O for the Salamisim Live Photo
 * Wall (P1: feed + projection; dark-launched).
 *
 * Pieces:
 *  - ingestToWall(): the after()-hook both capture paths call once the NSFW
 *    screen settles — runs the wall_ingest gate chain (service-role) and
 *    broadcasts the cleared tile on the event's wall channel (fast path; the
 *    projector's reconcile timer is the guaranteed path).
 *  - getWallSnapshot(): the reader for the projection routes — wall_visible_
 *    photos (service-role) + presigned URLs + the lifecycle mode.
 *  - Display-session JWT (cookie) for claimed venue screens — mirrors the
 *    shipped lib/guest-session.ts pattern (jose HS256; the projector is an
 *    anonymous screen, never a Supabase auth user).
 *
 * Security invariant (P0): no anon client ever reads wall_feed — every
 * projection read flows through these service-role helpers behind a
 * display-session JWT minted by a single-use claim code.
 */

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { getDayOfPhase, type DayOfPhase } from '@/lib/day-of-mode';
import {
  displayCodeFrom,
  resolveWallMode,
  type WallMode,
  type WallTile,
} from '@/lib/live-wall-logic';

const COOKIE_NAME = 'setnayan_wall_display';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24; // one venue day, generous overrun
/** Long enough that a tile rotated back hours later still renders. */
const TILE_URL_TTL_SECONDS = 60 * 60 * 12;

function getSecret(): Uint8Array {
  const secret =
    process.env.GUEST_SESSION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!secret) throw new Error('GUEST_SESSION_SECRET (or fallback) not configured');
  return new TextEncoder().encode(secret);
}

export type WallDisplaySession = { session_id: string; event_id: string };

export async function setWallDisplayCookie(payload: WallDisplaySession): Promise<void> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
  const cookieStore = await cookies();
  cookieStore.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export async function readWallDisplayCookie(): Promise<WallDisplaySession | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;
  try {
    const { payload } = await jwtVerify(cookie.value, getSecret());
    if (typeof payload.session_id !== 'string' || typeof payload.event_id !== 'string') {
      return null;
    }
    return { session_id: payload.session_id, event_id: payload.event_id };
  } catch {
    return null;
  }
}

/** A claimed screen is valid while its session row is unrevoked. */
export async function isWallSessionLive(session: WallDisplaySession): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('wall_display_sessions')
    .select('session_id, revoked_at')
    .eq('session_id', session.session_id)
    .eq('event_id', session.event_id)
    .maybeSingle();
  return Boolean(data && !data.revoked_at);
}

export function generateDisplayCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return displayCodeFrom(bytes);
}

/** The wall's realtime broadcast channel for an event. */
export function wallChannelName(eventId: string): string {
  return `wall:${eventId}`;
}

/**
 * Fast-path broadcast of a cleared tile via Supabase Realtime's HTTP
 * broadcast endpoint (no socket from the server). STRICTLY best-effort: any
 * failure is swallowed — the projector's reconcile timer is the guaranteed
 * delivery path (treat realtime as a wake-up nudge, never the source of
 * truth).
 */
async function broadcastTile(eventId: string, tile: WallTile): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: [
          { topic: wallChannelName(eventId), event: 'tile', payload: tile, private: false },
        ],
      }),
    });
  } catch {
    // best-effort — the reconcile timer covers it
  }
}

type WallFeedRow = {
  feed_id: string;
  event_id: string;
  wall_safe_r2_key: string;
  width_px: number | null;
  height_px: number | null;
  sort_at: string;
};

async function rowToTile(row: WallFeedRow): Promise<WallTile | null> {
  const url = await displayUrlForStoredAsset(row.wall_safe_r2_key, {
    ttlSeconds: TILE_URL_TTL_SECONDS,
  });
  if (!url) return null;
  return {
    feedId: row.feed_id,
    url,
    widthPx: row.width_px,
    heightPx: row.height_px,
    sortAt: row.sort_at,
  };
}

/**
 * Run the wall gate chain for one capture and broadcast on success. Call from
 * after() once the NSFW screen has settled (the gate is an allowlist —
 * 'unscreened' never projects). Never throws.
 */
export async function ingestToWall(
  sourceTable: 'papic_photos' | 'papic_guest_captures',
  sourceId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.rpc('wall_ingest', {
      p_source_table: sourceTable,
      p_source_id: sourceId,
    });
    const row = (Array.isArray(data) ? data[0] : data) as WallFeedRow | undefined;
    if (!row) return;
    const tile = await rowToTile(row);
    if (tile) await broadcastTile(row.event_id, tile);
  } catch {
    // never let wall ingest break a capture path
  }
}

export interface WallSnapshot {
  tiles: WallTile[];
  count: number;
  mode: WallMode;
  displayName: string | null;
  eventDate: string | null;
}

/** The projection read: visible tiles since a cursor + count + mode. */
export async function getWallSnapshot(
  eventId: string,
  sinceIso?: string | null,
): Promise<WallSnapshot> {
  const admin = createAdminClient();

  const [{ data: feedData }, { data: event }] = await Promise.all([
    admin.rpc('wall_visible_photos', {
      p_event_id: eventId,
      p_since: sinceIso ?? '-infinity',
    }),
    admin
      .from('events')
      .select('display_name, event_date, live_mode_override')
      .eq('event_id', eventId)
      .maybeSingle(),
  ]);

  const rows = (Array.isArray(feedData) ? feedData : []) as WallFeedRow[];
  const tiles = (await Promise.all(rows.map(rowToTile))).filter(
    (t): t is WallTile => Boolean(t),
  );

  // Hero counter = TOTAL visible on the wall (not just the since-cursor
  // delta). Cheap head-count on the feed mirror; the reader's per-row
  // re-checks govern what actually renders.
  const { count: visibleCount } = await admin
    .from('wall_feed')
    .select('feed_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .is('wall_hidden_at', null);

  const phase: DayOfPhase = event?.event_date ? getDayOfPhase(event.event_date) : 'inactive';
  const mode = resolveWallMode(
    (event?.live_mode_override as WallMode | null) ?? null,
    phase,
  );

  return {
    tiles,
    count: visibleCount ?? tiles.length,
    mode,
    displayName: (event?.display_name as string) ?? null,
    eventDate: (event?.event_date as string) ?? null,
  };
}
