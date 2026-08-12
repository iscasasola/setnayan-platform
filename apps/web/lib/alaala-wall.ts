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
  /**
   * The frames a surface can actually show: the UNION of each lens's OWN newest
   * slice, newest first. Not "the newest N overall" — see `surfaceBudget`.
   */
  items: WallItem[];
  /**
   * How many frames each lens really has, measured from the UNCAPPED read —
   * never from `items`, which is a display budget. `null` = not measured.
   */
  totals: Record<AlaalaLensKey, number | null>;
  /**
   * A source hit its fetch ceiling, so `totals` are "AT LEAST this many". The
   * UI must render `N+`; printing a ceiling as a total is the same class of lie
   * as printing 0 for a read that never ran.
   */
  partial: boolean;
  /** Is the viewer a guest at any event at all? Distinct from "has frames". */
  hasAttendedEvents: boolean;
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

export const ZERO_TOTALS: Record<AlaalaLensKey, number | null> = {
  recent: 0,
  owned: 0,
  attended: 0,
  people: 0,
  with_me: 0,
};

export const EMPTY_WALL: AlaalaWall = {
  items: [],
  totals: ZERO_TOTALS,
  partial: false,
  hasAttendedEvents: false,
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
  if (lens === 'people') return [];
  return wall.items.filter((i) => matchesLens(i, lens));
}

/** The four lenses that answer with frames. `people` answers with faces. */
export const FRAME_LENSES: ReadonlyArray<AlaalaLensKey> = [
  'recent',
  'owned',
  'attended',
  'with_me',
];

/**
 * EVERY LENS GETS ITS OWN BUDGET.
 *
 * 🚨 THE BUG THIS EXISTS TO PREVENT — it shipped, and it was measured, not
 * reasoned about. The first cut took the newest N of the MERGED list and only
 * then filtered per lens. So a couple with 60 frames from their own wedding
 * last month and 24 they are tagged in from a friend's wedding two years ago
 * got:
 *
 *     recent  48   owned 48   attended 0   with_me 0        (real: 84/60/24/24)
 *
 * Attended and With me rendered EMPTY over twenty-four photographs that had
 * been read successfully and then thrown away — and the page then printed
 * "No events attended yet", a false statement about somebody's life, with a
 * MEASURED 0 on the chip. That is the exact harm this whole surface was built
 * to end, reintroduced by a display cap.
 *
 * 🔑 A GLOBAL CAP OVER A FILTERED VIEW IS A SILENT FILTER OF ITS OWN. Raising
 * the number does not fix it; it only moves the wedding size at which it bites.
 *
 * Returns the union of the newest `perLens` of each frame lens, in wall order,
 * deduped — so a frame that serves several lenses is signed once.
 */
export function surfaceBudget(
  ordered: ReadonlyArray<WallItem>,
  perLens: number,
): WallItem[] {
  const keep = new Set<string>();
  for (const lens of FRAME_LENSES) {
    let taken = 0;
    for (const item of ordered) {
      if (taken >= perLens) break;
      if (!matchesLens(item, lens)) continue;
      keep.add(item.key);
      taken++;
    }
  }
  return ordered.filter((i) => keep.has(i.key));
}

/**
 * What each lens really holds, from the UNCAPPED read. Never count `items` for
 * this — `items` is a display budget, and counting it is how a lens reports a
 * confident 0 over frames it simply did not have room to show.
 */
export function lensTotals(
  ordered: ReadonlyArray<WallItem>,
  faceCount: number,
): Record<AlaalaLensKey, number | null> {
  return {
    recent: ordered.length,
    owned: ordered.filter((i) => matchesLens(i, 'owned')).length,
    attended: ordered.filter((i) => matchesLens(i, 'attended')).length,
    with_me: ordered.filter((i) => matchesLens(i, 'with_me')).length,
    people: faceCount,
  };
}

/** The one place a lens's membership rule is written. */
function matchesLens(item: WallItem, lens: AlaalaLensKey): boolean {
  switch (lens) {
    case 'recent':
      return true;
    case 'owned':
      return item.role === 'couple';
    case 'attended':
      return item.role === 'guest';
    case 'with_me':
      return item.withMe;
    case 'people':
      return false;
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
        recent: wall.totals.recent,
        owned: wall.totals.owned,
        attended: wall.totals.attended,
        with_me: wall.totals.with_me,
      };
  return {
    ...frames,
    people: wall.facesMeasured ? wall.faces.length : null,
  } as Record<AlaalaLensKey, number | null>;
}

/**
 * What an EMPTY lens says.
 *
 * 🔑 AN EMPTY LENS IS A CLAIM, SO IT MUST ONLY CLAIM WHAT WAS MEASURED. The
 * first cut said "No events attended yet" whenever the ATTENDED lens held no
 * frames — a statement about MEMBERSHIPS made from an absence of PHOTOS. Every
 * guest is in exactly that state until the photographers work through the
 * album, so somebody who joined a friend's wedding by QR yesterday was told
 * they had attended nothing. `hasAttended` is measured separately, from the
 * event list, and is the only thing allowed to license that sentence.
 *
 * Lives here, not in the component, for the same reason
 * `lifeFlashSummaryLine` does: an async JSX file cannot be imported by the
 * unit runner, and a sentence nothing can import is a sentence nothing can
 * check.
 */
export function lensEmptyLine(lens: AlaalaLensKey, hasAttended: boolean): string {
  switch (lens) {
    case 'recent':
      return 'Your story starts with a celebration — photos and clips land here as they happen.';
    case 'owned':
      return 'The events you host become memories here — every frame your cameras catch.';
    case 'attended':
      return hasAttended
        ? 'No photos of you yet from the events you attended — they gather here as they are tagged.'
        : 'No events attended yet. When you are a guest somewhere, the photos you are in gather here too.';
    case 'with_me':
      return 'Photos and clips you appear in gather here — wherever they were taken, whoever took them.';
    case 'people':
      return 'Family, godparents and friends appear here as they show up in your photos.';
  }
}
