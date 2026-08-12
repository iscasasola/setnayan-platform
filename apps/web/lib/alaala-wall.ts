/**
 * lib/alaala-wall.ts — Alaala's memories, as PHOTOS, cut five ways.
 *
 * ── WHAT WAS WRONG ─────────────────────────────────────────────────────────
 * Alaala is the account-level MEMORY dimension and the five lenses are owner-
 * approved (2026-07-15): Recent · Owned · Attended · People · With me. Until
 * now every one of them answered with EVENTS:
 *
 *   · the home tile's lens bodies were sentences, and "Owned" was literally a
 *     bulleted list of event names with dates;
 *   · "Attended" was a COUNT OF EVENTS;
 *   · the home's "Photos & videos" panel and `/dashboard/library` both rendered
 *     `PhotosTab` — one card per event with a photo count.
 *
 * So Alaala was a second list of events. **That is the board.** Events is for
 * DOING (one card per celebration, plan it, run it); Alaala is for KEEPING.
 * "With me" is every photo of you across six years and belongs to NO SINGLE
 * EVENT — which is exactly why it cannot live inside one, and why a per-event
 * album grid can never be its answer.
 *
 * ── WHAT THIS IS ───────────────────────────────────────────────────────────
 * A flat, newest-first list of the viewer's visible MEDIA across every event
 * they host or attend — photos, not occasions — plus the faces that appear in
 * them. Five lenses are five SELECTIONS over that one list:
 *
 *   recent   every visible frame, newest first, event boundaries erased
 *   owned    frames from the celebrations you host
 *   attended frames from celebrations you were a guest at (your tagged ones)
 *   people   NOT a wall — the faces, with how many events each kept showing up in
 *   with_me  every frame you are tagged in, wherever it was taken
 *
 * ── WHY A PURE CORE ────────────────────────────────────────────────────────
 * Same split as `life-story-moment-graph.ts`: this file is PURE (no Supabase,
 * no `server-only`, no React) so the node test runner can import it and prove
 * the five selections are five different answers. The reads live in
 * `lib/alaala-wall-data.ts`, which is the only half that can talk to a
 * database.
 *
 * 🪤 `unreadable` IS NOT `items.length === 0`. A rejected query and an empty
 * table are the same value out of PostgREST — a phantom column, a missing
 * grant or a stale enum all come back as `{ data: null, error }`, never a
 * throw. A wall that says "no photos yet" because a read was REFUSED is a lie
 * on somebody's memories, so the data layer sets `unreadable` and the UI says
 * so. (`count === null` means NOT MEASURED, not zero — 2026-08-05.)
 */

/** The owner-approved five (2026-07-15). Order is the tile's order. */
export type AlaalaLensKey = 'recent' | 'owned' | 'attended' | 'people' | 'with_me';

export const ALAALA_LENSES: ReadonlyArray<{ key: AlaalaLensKey; label: string }> = [
  { key: 'recent', label: 'Recent' },
  { key: 'owned', label: 'Owned' },
  { key: 'attended', label: 'Attended' },
  { key: 'people', label: 'People' },
  { key: 'with_me', label: 'With me' },
];

/** One frame on the wall. A PHOTO — the event is provenance, never the subject. */
export type WallItem = {
  /** `${sourceTable}:${sourceId}` — stable across recomputes, and the dedupe key. */
  key: string;
  /** Resolved, fetchable URL. Never a raw `r2://` ref — see lint-stored-asset-refs. */
  url: string;
  isClip: boolean;
  /** When it was SHOT. Null sorts last rather than poisoning the sort with NaN. */
  capturedAt: string | null;
  eventId: string;
  eventName: string;
  /** How the viewer stands to the event this came from. */
  role: 'couple' | 'guest';
  /** The viewer is tagged in this frame. The whole of the "With me" lens. */
  withMe: boolean;
};

/** A face in the memories — the People lens swaps the wall for these. */
export type WallFace = {
  /** `person:<id>` or `guest:<id>` — whichever identity we could resolve. */
  key: string;
  displayName: string;
  /** people.in_memoriam — the user's own opt-in ✦ flag. Never inferred. */
  inMemoriam: boolean;
  /** Distinct events this person appears in ("who kept showing up"). */
  eventCount: number;
};

export type AlaalaWall = {
  /** Newest first, deduped, across every event. */
  items: WallItem[];
  faces: WallFace[];
  /**
   * TRUE when any read failed or was refused. The UI must not print "nothing
   * here" while this is set — see the docblock above.
   */
  unreadable: boolean;
  /**
   * FALSE when the faces could not be measured at all (the moment graph is
   * behind the Life-Flash rollout switch). Distinct from "measured, and there
   * are none", which is `facesMeasured: true` with an empty `faces`.
   */
  facesMeasured: boolean;
};

export const EMPTY_WALL: AlaalaWall = {
  items: [],
  faces: [],
  unreadable: false,
  facesMeasured: false,
};

/** Epoch ms for sorting; an absent/─unparseable timestamp sorts LAST, not first. */
function whenMs(iso: string | null): number {
  if (!iso) return -Infinity;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : -Infinity;
}

/**
 * Dedupe by `key` (a frame reachable through two paths is ONE memory) and sort
 * newest first. Stable for equal timestamps: input order decides, so a re-render
 * never reshuffles the wall under the reader.
 */
export function orderWall(items: ReadonlyArray<WallItem>): WallItem[] {
  const seen = new Set<string>();
  const unique: WallItem[] = [];
  for (const item of items) {
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    unique.push(item);
  }
  return unique
    .map((item, i) => ({ item, i }))
    .sort((a, b) => whenMs(b.item.capturedAt) - whenMs(a.item.capturedAt) || a.i - b.i)
    .map(({ item }) => item);
}

/**
 * The lens, applied. `people` returns [] BY DESIGN — it is the one lens that is
 * not a wall, and a caller that renders its result as a grid is asking the wrong
 * question. Use `lensIsWall()` to branch.
 */
export function selectLens(
  wall: AlaalaWall,
  lens: AlaalaLensKey,
): WallItem[] {
  switch (lens) {
    case 'recent':
      return wall.items;
    case 'owned':
      return wall.items.filter((i) => i.role === 'couple');
    case 'attended':
      return wall.items.filter((i) => i.role === 'guest');
    case 'with_me':
      return wall.items.filter((i) => i.withMe);
    case 'people':
      return [];
  }
}

/** Does this lens answer with a wall of frames, or with something else? */
export function lensIsWall(lens: AlaalaLensKey): boolean {
  return lens !== 'people';
}

/**
 * How many memories each lens holds. `people` counts FACES, not frames — the
 * one place the unit differs, which is the point of the lens.
 *
 * Returns `null` for a lens we could not measure, so a caller never prints "0"
 * from a read that was refused. The same rule the admin work list learned the
 * hard way: an unmeasured queue filed under "clear" looks completely fine.
 */
export function lensCounts(
  wall: AlaalaWall,
): Record<AlaalaLensKey, number | null> {
  const frames = wall.unreadable
    ? { recent: null, owned: null, attended: null, with_me: null }
    : {
        recent: wall.items.length,
        owned: selectLens(wall, 'owned').length,
        attended: selectLens(wall, 'attended').length,
        with_me: selectLens(wall, 'with_me').length,
      };
  return {
    ...frames,
    people: wall.facesMeasured ? wall.faces.length : null,
  } as Record<AlaalaLensKey, number | null>;
}
