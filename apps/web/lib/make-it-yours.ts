/**
 * "MAKE IT YOURS" — THE PHOTO HALF OF THE EDITOR, AS PURE MOVES
 * (`10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md` step 4 · `prototypes/story_make_it_yours_2026-09-10.html`).
 *
 * Every change the host can make to a page in step 4 is one function here, and every one of them
 * ends in `settle` — which runs the state back through the SAME `resolveArrangement` the server
 * reads with. So the editor never keeps a second idea of the rules:
 *
 *   • AUTOMATIC IS DERIVED — in Automatic, `settle` re-sorts every photograph from the run of show
 *     exactly as a reload would. The editor cannot drift from what the next read will say.
 *   • THE TRAY IS WHAT IS ON NO PAGE — `unplaced` is recomputed from the pool on every change, never
 *     patched by hand, so (photos on pages + tray) is always the pool.
 *   • ONE PHOTOGRAPH, ONE PLACE — checked against the DATA before a photo is placed, not against
 *     the button that asked (10a R10/G1: a second Enter, a held key or a double tap all reach the
 *     handler, and a button's look cannot stop a key).
 *
 * Pure + total, no React, so the moves are tested without a browser and the component is only the
 * pointer and the pixels.
 */

import {
  PHOTO_H,
  PHOTO_W,
  SHEET_MAX_Y,
  SHEET_WIDTH,
  freeSlot,
  newArrangementId,
  resolveArrangement,
  storedFromResolved,
  type PoolItem,
  type ResolvedArrangement,
  type ResolvedMoment,
  type ResolvedObject,
  type ResolvedPhoto,
  type RunOfShowMoment,
} from './story-arrangement';

export type MakeItYoursWorld = {
  runOfShow: readonly RunOfShowMoment[];
  pool: readonly PoolItem[];
};

/** Why a move did nothing — each one is said to the host, never swallowed. */
export type Refusal = 'automatic' | 'already_placed' | 'not_in_pool' | 'no_moment' | 'no_photos';

export type Move =
  | { ok: true; state: ResolvedArrangement }
  | { ok: false; refusal: Refusal; state: ResolvedArrangement };

/**
 * The state after any change: stored the way a save would store it, then read back the way the
 * next load would read it. Idempotent — `settle(settle(x))` is `settle(x)`.
 */
export function settle(state: ResolvedArrangement, world: MakeItYoursWorld): ResolvedArrangement {
  return resolveArrangement({
    stored: storedFromResolved(state),
    runOfShow: world.runOfShow,
    pool: world.pool,
  });
}

export const isPhoto = (o: ResolvedObject): o is ResolvedPhoto => o.kind === 'photo';

/** Every capture on a page, in page order. */
export function placedRefs(state: ResolvedArrangement): string[] {
  const out: string[] = [];
  for (const m of state.moments) for (const o of m.objects) if (isPhoto(o)) out.push(o.ref);
  return out;
}

export function momentById(state: ResolvedArrangement, id: string): ResolvedMoment | undefined {
  return state.moments.find((m) => m.id === id);
}

const withMoment = (
  state: ResolvedArrangement,
  id: string,
  change: (m: ResolvedMoment) => ResolvedMoment,
): ResolvedArrangement => ({
  ...state,
  moments: state.moments.map((m) => (m.id === id ? change(m) : m)),
});

/**
 * A TAP IS THE ADD — the photo lands in the first grid slot nothing is sitting in, never on the
 * host's words (`freeSlot` — the prototype's; 10a M-R3-17).
 */
export function placePhoto(
  state: ResolvedArrangement,
  world: MakeItYoursWorld,
  momentId: string,
  ref: string,
): Move {
  if (state.mode !== 'hand') return { ok: false, refusal: 'automatic', state };
  const moment = momentById(state, momentId);
  if (!moment) return { ok: false, refusal: 'no_moment', state };
  if (placedRefs(state).includes(ref)) return { ok: false, refusal: 'already_placed', state };
  const item = world.pool.find((p) => p.ref === ref);
  if (!item) return { ok: false, refusal: 'not_in_pool', state };
  const at = freeSlot(moment.objects);
  const photo: ResolvedPhoto = {
    id: newArrangementId('photo'),
    kind: 'photo',
    ref,
    x: at.x,
    y: at.y,
    w: PHOTO_W,
    h: PHOTO_H,
    media: item.media,
    capturedAtMs: item.capturedAtMs,
    stillKey: item.stillKey,
    playKey: item.playKey,
  };
  const next = withMoment(state, momentId, (m) => ({ ...m, objects: [...m.objects, photo] }));
  return { ok: true, state: settle({ ...next, handTouched: true }, world) };
}

/** × — the photo goes back to the tray. */
export function removeObject(
  state: ResolvedArrangement,
  world: MakeItYoursWorld,
  momentId: string,
  objectId: string,
): Move {
  if (state.mode !== 'hand') return { ok: false, refusal: 'automatic', state };
  const moment = momentById(state, momentId);
  const target = moment?.objects.find((o) => o.id === objectId);
  if (!moment || !target) return { ok: false, refusal: 'no_moment', state };
  const next = withMoment(state, momentId, (m) => ({
    ...m,
    objects: m.objects.filter((o) => o.id !== objectId),
  }));
  return {
    ok: true,
    state: settle({ ...next, handTouched: state.handTouched || isPhoto(target) }, world),
  };
}

/** PUT ALL BACK — every photo on this page returns to the tray; words stay, they are not photos. */
export function putAllBack(
  state: ResolvedArrangement,
  world: MakeItYoursWorld,
  momentId: string,
): Move {
  if (state.mode !== 'hand') return { ok: false, refusal: 'automatic', state };
  const moment = momentById(state, momentId);
  if (!moment) return { ok: false, refusal: 'no_moment', state };
  if (!moment.objects.some(isPhoto)) return { ok: false, refusal: 'no_photos', state };
  const next = withMoment(state, momentId, (m) => ({
    ...m,
    objects: m.objects.filter((o) => !isPhoto(o)),
  }));
  return { ok: true, state: settle({ ...next, handTouched: true }, world) };
}

/**
 * Where a thing may sit: never off the sheet's sides or top. It MAY go past the bottom — the
 * sheet grows downward to meet it — up to the store's own ceiling.
 */
export function clampPosition(x: number, y: number, w: number): { x: number; y: number } {
  return {
    x: Math.round(Math.max(0, Math.min(x, SHEET_WIDTH - w))),
    y: Math.round(Math.max(0, Math.min(y, SHEET_MAX_Y))),
  };
}

/**
 * A DRAG (or an arrow key) ends here. What was just DRAGGED comes to the FRONT — it is re-appended
 * to its page, which is also its drawing order. An arrow key nudges in place (`toFront: false`),
 * as the prototype's does: re-appending would move the focused element in the DOM, and a moved
 * element loses the keyboard's focus.
 */
export function moveObject(
  state: ResolvedArrangement,
  world: MakeItYoursWorld,
  momentId: string,
  objectId: string,
  to: { x: number; y: number },
  opts: { toFront?: boolean } = {},
): Move {
  if (state.mode !== 'hand') return { ok: false, refusal: 'automatic', state };
  const moment = momentById(state, momentId);
  const target = moment?.objects.find((o) => o.id === objectId);
  if (!moment || !target) return { ok: false, refusal: 'no_moment', state };
  const w = isPhoto(target) ? target.w : (target.w ?? 1);
  const at = clampPosition(to.x, to.y, w);
  const moved = { ...target, x: at.x, y: at.y } as ResolvedObject;
  const next = withMoment(state, momentId, (m) => ({
    ...m,
    objects:
      opts.toFront === false
        ? m.objects.map((o) => (o.id === objectId ? moved : o))
        : [...m.objects.filter((o) => o.id !== objectId), moved],
  }));
  return {
    ok: true,
    state: settle({ ...next, handTouched: state.handTouched || isPhoto(target) }, world),
  };
}

/**
 * I CHOOSE starts from what Automatic made — the host needs no tap to get their photos onto the
 * page before they can change it. Nothing moves; the pages simply become the host's.
 */
export function toHand(state: ResolvedArrangement, world: MakeItYoursWorld): ResolvedArrangement {
  if (state.mode === 'hand') return state;
  return settle({ ...state, mode: 'hand' }, world);
}

/**
 * Back to AUTOMATIC — every photograph is re-sorted by the run of show, a run-of-show moment that
 * was removed comes back, words stay where they are. `lostHandWork` says whether there was
 * anything of the host's to lose, which is when the editor offers Undo (never a pop-up).
 */
export function toAutomatic(
  state: ResolvedArrangement,
  world: MakeItYoursWorld,
): { state: ResolvedArrangement; lostHandWork: boolean; refused: boolean } {
  if (world.runOfShow.length === 0) return { state, lostHandWork: false, refused: true };
  if (state.mode === 'auto') return { state, lostHandWork: false, refused: false };
  return {
    state: settle({ ...state, mode: 'auto', handTouched: false }, world),
    lostHandWork: state.handTouched,
    refused: false,
  };
}

/** The count every moment row's pill shows. */
export function photoCount(m: ResolvedMoment): number {
  return m.objects.filter(isPhoto).length;
}
