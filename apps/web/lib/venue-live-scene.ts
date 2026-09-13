/**
 * venue-live-scene — the PURE half of "the room you are standing in keeps up".
 *
 * Owner 2026-09-06: "seating can always change in the last minute and even
 * during the event." Until now the guest walk fetched the scene ONCE, on the
 * server, and a seat moved at 6pm was what a guest saw the next time they
 * opened the page — never under their feet. `public_venue_scene` is anon-
 * callable (the same RPC the page calls with the admin client), so the browser
 * can ask it again. This module decides WHEN to ask and WHETHER the answer is
 * news; the hook in app/[slug]/venue/_components/use-live-scene.ts does the I/O.
 *
 * Deliberately a POLL, not a Postgres-changes subscription: the tables that
 * change (`event_seat_assignments`, `event_tables`, `event_floor_plan`) are
 * couple-private under RLS, so an anon guest's realtime subscription would
 * deliver nothing and render exactly like "no changes" — the disease. A poll
 * through the SECURITY DEFINER RPC sees what the RPC is allowed to say.
 *
 * Pure — no React, no DOM — so `venue-live-scene.test.ts` runs under tsx.
 */

/** How often a VISIBLE room re-asks. One minute: a seat moved during dinner
 *  is on every guest's phone before the next course, and 200 guests polling
 *  is ~3 RPC/s, well inside what the same RPC already serves on page opens. */
export const LIVE_SCENE_POLL_MS = 60_000;

/** A hidden tab never polls — it cannot show anything, and a phone in a
 *  pocket should not spend its battery on a room nobody is looking at. */
export function shouldPollScene(visibilityState: string | null | undefined): boolean {
  return visibilityState === 'visible';
}

/**
 * The parts of the scene that MOVE and matter to a person inside the room.
 * Palette, monogram and decor are excluded on purpose: they are the couple's
 * to re-style and a re-tint under a guest's feet is not "my seat moved".
 * Stable-ordered by construction (arrays as served; the RPC orders them), so
 * two identical answers produce one signature and no re-render.
 */
export function sceneSignature(scene: {
  published?: boolean;
  tables?: unknown;
  occupancy?: unknown;
  booths?: unknown;
  you?: unknown;
  floor?: unknown;
  photos?: unknown;
  [extra: string]: unknown;
}): string {
  return JSON.stringify([
    scene.published ?? true,
    scene.tables ?? null,
    scene.occupancy ?? null,
    scene.booths ?? null,
    scene.you ?? null,
    scene.floor ?? null,
    scene.photos ?? null,
  ]);
}

/** The RPC's "not published" answer — `{published:false}` and nothing else.
 *  Distinct from a failed call (which is NOT news and keeps the last scene). */
export function sceneWasTakenDown(payload: unknown): boolean {
  return !!payload && typeof payload === 'object' && (payload as { published?: unknown }).published === false;
}
