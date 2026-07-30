/**
 * papic-home-tile.ts — the ONE read behind Papic's two appearances on event-home.
 *
 * Papic promotion BUILD SPEC PR-G (owner picked options A + B on 2026-07-30 from
 * `06_Prototypes/Papic_Home_Presence_2026-07-30.html`):
 *   A · a mini-tile in the at-a-glance 2×2, carrying what the event actually holds.
 *   B · a one-time "your free camera is ready" nudge in `slotAfterBento`.
 *
 * Both need the same three facts, so they share one resolver and event-home pays
 * for one batch of reads, folded into the dashboard's existing `Promise.all`.
 *
 * ── WHY THE GAP EXISTED ──────────────────────────────────────────────────────
 * Every event is armed at creation with a free shared pool of shots AND one free
 * dedicated camera (`ensureFreePapicPoolGrantAdmin` + `ensureFreePapicOneCameraAdmin`
 * in create-event/actions.ts). The couple was never told so from home: Papic had
 * zero presence on `dashboard/[eventId]`, which is the only home surface that
 * exists — `today/page.tsx` (retired 2026-06-03) and `for-you/page.tsx` (retired
 * 2026-06-04) are redirect stubs, so the BUILD SPEC's "three surfaces" is one.
 *
 * ── DERIVED, NEVER TYPED ─────────────────────────────────────────────────────
 * No shot count, camera count or peso figure is written here. Shots come from
 * `papic_event_pool_status` (the same RPC the capture path meters against, so the
 * tile and the fence can never disagree), cameras from live `paparazzi_seats`
 * rows, photos from the two capture tables. The point currency, where copy needs
 * it, renders through `papicPointCurrencyTerms()`.
 *
 * ── FAILS QUIET ──────────────────────────────────────────────────────────────
 * Returns `null` when the event has no Papic signal at all, and every read
 * degrades on its own. `null` means BOTH surfaces render nothing — event-home
 * must never be the page that 500s, and the bento's own law is
 * "real-data-or-nothing: each tile renders only when its own data exists".
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchEventPoolStatus } from '@/lib/papic-event-pool';
import { countEventGuestCaptures } from '@/lib/papic-guest';

export type PapicHomeTile = {
  /** Shots left in the shared pool. */
  shotsLeft: number;
  /** Shots the event has ever held (free grant + every top-up). */
  shotsTotal: number;
  /** Live (non-revoked) cameras handed out — the free One camera counts. */
  cameras: number;
  /** Photos + clips captured so far, crew and guests together. */
  photosGathered: number;
  /**
   * TRUE while nothing has been shot yet. This is the single signal that splits
   * the two surfaces' jobs, and it is why they share a reader:
   *   • the NUDGE renders only while true  ("you already have this")
   *   • the TILE leads with shots-left while true, and flips to photos-gathered
   *     the moment it goes false ("here is where it stands")
   * A couple who has already started shooting does not need to be told they own
   * a camera, so the nudge retires itself on the first capture — no TTL, no
   * second dismissal.
   */
  preCapture: boolean;
};

/** Live cameras on the event. A missing/legacy table is a clean zero, not a throw. */
async function countLiveCameras(
  db: SupabaseClient,
  eventId: string,
): Promise<number> {
  try {
    const { count, error } = await db
      .from('paparazzi_seats')
      .select('seat_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .is('revoked_at', null);
    return error ? 0 : count ?? 0;
  } catch {
    return 0;
  }
}

/** Crew captures. Mirrors the galleries hub's own `countPapicPhotos`. */
async function countCrewPhotos(
  db: SupabaseClient,
  eventId: string,
): Promise<number> {
  try {
    const { count, error } = await db
      .from('papic_photos')
      .select('photo_id', { count: 'exact', head: true })
      .eq('event_id', eventId);
    return error ? 0 : count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Crew + guest captures on this event, together. The one number both the tile
 * and the nudge pivot on.
 */
export async function countPapicCaptures(
  db: SupabaseClient,
  eventId: string,
): Promise<number> {
  if (!eventId) return 0;
  const [crew, guest] = await Promise.all([
    countCrewPhotos(db, eventId),
    countEventGuestCaptures(db, eventId).catch(() => 0),
  ]);
  return crew + guest;
}

/**
 * Should the "your free camera is ready" nudge mount at all?
 *
 * DELIBERATELY NOT the full resolver. The Home page mounts the nudge through
 * `slotAfterBento` while `<EventDashboard>` owns the tile's read, so the two live
 * in different components — and calling `resolvePapicHomeTile` twice per request
 * would buy four duplicate queries for a boolean. The nudge's decision needs
 * exactly one fact ("has anything been shot yet?"), which is two indexed
 * head-counts, so that is all this asks for. The POOL read is not needed here at
 * all: the nudge quotes no figure.
 *
 * Fails to `false` — an unreadable count must not conjure a nudge onto the page.
 */
export async function papicNudgeShouldShow(
  db: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  try {
    return (await countPapicCaptures(db, eventId)) === 0;
  } catch {
    return false;
  }
}

/**
 * Resolve both surfaces' view-model in one batch.
 *
 * @param admin  service-role client — REQUIRED for the pool status: the ledger
 *   tables carry no read policy on purpose (see lib/papic-event-pool.ts), so the
 *   couple's session cannot read their own balance.
 * @param db     the request-scoped (couple / coordinator) client for the capture
 *   counts and the camera count, matching how the galleries hub reads them.
 */
export async function resolvePapicHomeTile(
  admin: SupabaseClient,
  db: SupabaseClient,
  eventId: string,
): Promise<PapicHomeTile | null> {
  if (!eventId) return null;

  const [pool, cameras, photosGathered] = await Promise.all([
    fetchEventPoolStatus(admin, eventId),
    countLiveCameras(db, eventId),
    countPapicCaptures(db, eventId),
  ]);

  const shotsLeft = pool.applies ? pool.remainingPoints : 0;
  const shotsTotal = pool.applies ? pool.totalPoints : 0;

  // No pool, no cameras, no photos ⇒ this event has no Papic story to tell, so
  // neither surface renders. In practice the free grant means we never take this
  // branch, but a pre-arming event (or an unreadable ledger) must degrade to
  // silence rather than to a tile reading "0 shots ready".
  if (shotsTotal === 0 && cameras === 0 && photosGathered === 0) return null;

  return {
    shotsLeft,
    shotsTotal,
    cameras,
    photosGathered,
    preCapture: photosGathered === 0,
  };
}
