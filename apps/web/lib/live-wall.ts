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
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { resolveCapturerNames } from '@/lib/capture-credit';
import { getDayOfPhase, type DayOfPhase } from '@/lib/day-of-mode';
import { eventSkuActive } from '@/lib/entitlements';
import { eventPapicActive } from '@/lib/papic-seats';
import {
  displayCodeFrom,
  resolveWallMode,
  wallGuestMirrorOn,
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
  /** Which capture table the frame came from — `wall_visible_photos` returns
   *  SETOF wall_feed, so these have always been on the row; the credit is the
   *  first thing to read them. */
  source_table?: string | null;
  source_id?: string | null;
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
 * Attach the per-tile credit to a snapshot's tiles.
 *
 * Two reads, both keyed on ids that are already on the feed rows: the capture
 * tables for the capturer, then `resolveCapturerNames` for the words. Returns
 * the tiles unchanged on any trouble — a wall that cannot name its cameras is a
 * wall without credits, never a wall that fails to draw.
 */
async function attachWallCredits(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  rows: WallFeedRow[],
  tiles: WallTile[],
): Promise<WallTile[]> {
  try {
    const bySource = new Map<string, WallFeedRow>();
    for (const r of rows) bySource.set(r.feed_id, r);

    const photoIds = [
      ...new Set(
        rows
          .filter((r) => r.source_table === 'papic_photos' && r.source_id)
          .map((r) => r.source_id as string),
      ),
    ];
    const captureIds = [
      ...new Set(
        rows
          .filter((r) => r.source_table === 'papic_guest_captures' && r.source_id)
          .map((r) => r.source_id as string),
      ),
    ];
    if (photoIds.length === 0 && captureIds.length === 0) return tiles;

    const [photoRes, captureRes] = await Promise.all([
      photoIds.length
        ? admin
            .from('papic_photos')
            .select('photo_id, paparazzi_seat_id, captured_by_person_id, captured_at')
            .in('photo_id', photoIds)
        : Promise.resolve({ data: [], error: null }),
      captureIds.length
        ? admin
            .from('papic_guest_captures')
            .select('capture_id, guest_id, captured_by_person_id, captured_at')
            .in('capture_id', captureIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    type Origin = {
      person: string | null;
      guest: string | null;
      seat: string | null;
      capturedAt: string | null;
    };
    const originById = new Map<string, Origin>();
    for (const p of (photoRes.error ? [] : (photoRes.data ?? [])) as Record<string, unknown>[]) {
      originById.set(p.photo_id as string, {
        person: (p.captured_by_person_id as string | null) ?? null,
        guest: null,
        seat: (p.paparazzi_seat_id as string | null) ?? null,
        capturedAt: (p.captured_at as string | null) ?? null,
      });
    }
    for (const c of (captureRes.error ? [] : (captureRes.data ?? [])) as Record<string, unknown>[]) {
      originById.set(c.capture_id as string, {
        person: (c.captured_by_person_id as string | null) ?? null,
        guest: (c.guest_id as string | null) ?? null,
        seat: null,
        capturedAt: (c.captured_at as string | null) ?? null,
      });
    }

    const seatIds = [
      ...new Set([...originById.values()].map((o) => o.seat).filter((v): v is string => !!v)),
    ];
    const seatRows = seatIds.length
      ? ((
          await admin
            .from('paparazzi_seats')
            .select('seat_id, claimer_user_id, guest_id')
            .eq('event_id', eventId)
            .in('seat_id', seatIds)
        ).data ?? [])
      : [];
    const seatById = new Map(
      (seatRows as { seat_id: string; claimer_user_id: string | null; guest_id: string | null }[]).map(
        (r) => [r.seat_id, r],
      ),
    );

    const credits = await resolveCapturerNames(eventId, {
      personIds: [...originById.values()].map((o) => o.person),
      guestIds: [
        ...[...originById.values()].map((o) => o.guest),
        ...[...seatById.values()].map((r) => r.guest_id),
      ],
      userIds: [...seatById.values()].map((r) => r.claimer_user_id),
    });

    return tiles.map((tile) => {
      const row = bySource.get(tile.feedId);
      const origin = row?.source_id ? originById.get(row.source_id) : undefined;
      if (!origin) return tile;
      const seat = origin.seat ? seatById.get(origin.seat) : undefined;
      const hidden =
        (origin.person && credits.hidden.has(origin.person)) ||
        (origin.guest && credits.hidden.has(origin.guest)) ||
        (seat?.guest_id ? credits.hidden.has(seat.guest_id) : false);
      const name = hidden
        ? null
        : ((origin.person ? credits.byPerson.get(origin.person) : undefined) ??
          (origin.guest ? credits.byGuest.get(origin.guest) : undefined) ??
          (seat?.guest_id ? credits.byGuest.get(seat.guest_id) : undefined) ??
          (seat?.claimer_user_id ? credits.byUser.get(seat.claimer_user_id) : undefined) ??
          null);
      return { ...tile, capturedBy: name, capturedAt: origin.capturedAt };
    });
  } catch {
    return tiles;
  }
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

/**
 * THE ONE DOOR EVERY GUEST-FACING WALL SURFACE GOES THROUGH.
 *
 * Owning the wall is not the same question as showing it on guests' phones, and
 * for nine months the product only ever asked the first one. Three separate
 * guest surfaces — the slug page loader, the guest hub, and the /[slug]/live-wall
 * poll route — each called `eventSkuActive(…, 'LIVE_WALL')` and nothing else, so
 * a couple who revoked every venue screen code still had the wall running in
 * every guest's hand. The setting that should have stopped it,
 * events.live_photo_wall_visibility, had zero readers and zero writers.
 *
 * The fix is not "check the column in three places" — that is three chances to
 * forget, and the next guest surface makes four. Ownership and the couple's
 * choice are fused into one call, so on a guest surface the permissive half is
 * no longer reachable on its own.
 *
 * NOT for the venue projection. `/wall/[eventId]` and `/api/wall/[eventId]/feed`
 * keep calling `eventSkuActive` directly: the venue screen projects regardless
 * (owner-locked 2026-06-11) and is gated by its own single-use screen code.
 *
 * Fails CLOSED on a read error — if we cannot tell whether the couple said no,
 * we do not put their wedding on a hundred phones. That asymmetry is deliberate
 * and is the opposite of `asWallGuestVisibility`'s fail-open narrowing, which
 * handles a value we DID read and merely did not recognise.
 *
 * ─── WHY PAPIC IS PART OF THIS GATE (added when the wall went free) ─────────
 *
 * The wall used to be a paid purchase that nobody had made, so this gate was
 * effectively closed everywhere. On 2026-08-12 the owner made it FREE FOR EVERY
 * EVENT (`FREE_FOR_ALL_SKUS`), and `eventSkuActive` began returning true
 * unconditionally. That turned one question into two problems:
 *
 *  1. A wedding with no Papic at all would render the wall block through its
 *     whole live window showing "the wall is warming up — photos appear here the
 *     moment they're taken". Nothing was ever coming. The wall projects Papic
 *     captures, so with no cameras there is no wall — only the promise of one.
 *
 *  2. Worse, and the reason this is a correctness fix rather than a cosmetic
 *     one: LiveWallCard — where the couple's on/off switch lives — renders only
 *     when Papic is active. So on exactly those events the mirror ran and THE
 *     COUPLE HAD NO SWITCH. A control that is not reachable on every surface
 *     the thing runs on is not a control.
 *
 * So the guest gate now asks the SAME preconditions as the couple's card, and
 * `wall-guest-mirror.test.ts` asserts that they cannot drift apart. Whenever a
 * feature can be turned off, the "is it on?" test and the "can they turn it
 * off?" test have to be the same test.
 */
export async function guestWallMirrorActive(
  client: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  // Both halves of the couple's own card: the wall is available for this event,
  // AND there is Papic to project. eventPapicActive fails OPEN on a genuine read
  // failure (its own documented behaviour) — that is its call to make, not this
  // gate's to second-guess; the couple's choice below still fails CLOSED.
  const [wallAvailable, papicActive] = await Promise.all([
    eventSkuActive(client, eventId, 'LIVE_WALL'),
    eventPapicActive(client, eventId),
  ]);
  if (!wallAvailable || !papicActive) return false;

  // Supabase resolves with { error }, it does not throw — a phantom column or a
  // pre-migration schema comes back as `error`, not an exception. Treating that
  // as "no objection" is exactly how a guard ends up unable to fire.
  const { data, error } = await client
    .from('events')
    .select('live_photo_wall_visibility, archived')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error || !data) return false;

  const row = data as {
    live_photo_wall_visibility?: string | null;
    archived?: boolean | null;
  };

  /*
    PUT AWAY = the wall goes quiet (owner 2026-08-16). Folded into the read this
    gate ALREADY makes rather than added as a second query — one column on an
    existing select, no extra round trip on a feed that re-asks every 25s.

    ⚠ Unlike the capture gate, this half fails CLOSED, and that is not an
    inconsistency: the surrounding function already returns false on an
    unreadable row, and the harm here is the opposite shape. A wall that will
    not paint is a disappointment; a wall still playing a celebration somebody
    put away is the thing the couple thought they had stopped.

    🔒 The VENUE projection is deliberately untouched (owner-locked 2026-06-11).
    This gate governs the mirror onto guests' phones only.
  */
  if (row.archived === true) return false;

  return wallGuestMirrorOn(row.live_photo_wall_visibility);
}

export interface WallSnapshot {
  tiles: WallTile[];
  count: number;
  mode: WallMode;
  displayName: string | null;
  eventDate: string | null;
  /** The latest one-tap-approved Kwento for the lower-third (P1: newest wins). */
  caption: { text: string; author: string; atIso: string } | null;
}

/** The projection read: visible tiles since a cursor + count + mode. */
export async function getWallSnapshot(
  eventId: string,
  sinceIso?: string | null,
  opts?: {
    /**
     * Keep only the NEWEST N tiles (rows arrive ascending by sort_at). Used by
     * the guest-page live-wall block (a phone shows ~a dozen tiles, the venue
     * projector wants everything) — sliced BEFORE presigning so a wall with
     * hundreds of tiles doesn't burn hundreds of R2 signatures per page view.
     */
    limit?: number;
  },
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

  let rows = (Array.isArray(feedData) ? feedData : []) as WallFeedRow[];
  if (opts?.limit && rows.length > opts.limit) rows = rows.slice(-opts.limit);
  const tiles = (await Promise.all(rows.map(rowToTile))).filter(
    (t): t is WallTile => Boolean(t),
  );

  // ── WHO TOOK EACH TILE ──────────────────────────────────────────────────
  //
  // Gallery archetype § 2: every tile names its camera. Resolved here, once per
  // snapshot, from the source rows the feed already points at — never per tile.
  //
  // 🔒 Faceblocked guests are dropped by `resolveCapturerNames`, which is the
  // same rule the caption author below already obeys.
  // ⚠ Best-effort: a failed lookup leaves the credits empty and the wall draws
  // exactly as it does today.
  const credited = await attachWallCredits(admin, eventId, rows, tiles);

  // Hero counter = TOTAL visible on the wall (not just the since-cursor
  // delta). Cheap head-count on the feed mirror; the reader's per-row
  // re-checks govern what actually renders.
  const { count: visibleCount } = await admin
    .from('wall_feed')
    .select('feed_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .is('wall_hidden_at', null);

  // The lower-third: the newest approved + wall-eligible Kwento (owner-locked
  // one-tap gate; flagged can never reach here — DB CHECK).
  let caption: WallSnapshot['caption'] = null;
  try {
    const { data: msg } = await admin
      .from('photo_messages')
      .select('body_text, guest_id, updated_at')
      .eq('event_id', eventId)
      .eq('status', 'approved')
      .eq('wall_eligible', true)
      .eq('hide_from_wall', false)
      .eq('author_publicly_hidden', false)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (msg) {
      const { data: author } = await admin
        .from('guests')
        .select('first_name, display_name, faceblock_enabled')
        .eq('guest_id', msg.guest_id as string)
        .maybeSingle();
      if (!author?.faceblock_enabled) {
        caption = {
          text: msg.body_text as string,
          author: (author?.display_name as string) || (author?.first_name as string) || 'A guest',
          atIso: msg.updated_at as string,
        };
      }
    }
  } catch {
    caption = null; // pre-migration env — the wall simply has no captions
  }

  const phase: DayOfPhase = event?.event_date ? getDayOfPhase(event.event_date) : 'inactive';
  const mode = resolveWallMode(
    (event?.live_mode_override as WallMode | null) ?? null,
    phase,
  );

  return {
    tiles: credited,
    caption,
    count: visibleCount ?? tiles.length,
    mode,
    displayName: (event?.display_name as string) ?? null,
    eventDate: (event?.event_date as string) ?? null,
  };
}
