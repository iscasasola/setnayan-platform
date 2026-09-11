/**
 * "MAKE IT YOURS" — THE EDITOR, AS PURE MOVES
 * (`10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md` steps 4 and 6 · `prototypes/story_make_it_yours_2026-09-10.html`).
 *
 * Every change the host can make — photos (step 4); words and their looks, moments added,
 * named, removed and reordered, named photo sets (step 6) — is one function here, and every one
 * of them ends in `settle`, which runs the state back through the SAME `resolveArrangement` the
 * server reads with. So the editor never keeps a second idea of the rules:
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
  GRID,
  MOMENTS_MAX,
  MOMENT_NAME_MAX,
  OBJECTS_PER_MOMENT_MAX,
  NEW_MOMENT_NAME,
  PHOTO_H,
  PHOTO_W,
  SET_NAME_MAX,
  SHEET_MAX_Y,
  SHEET_WIDTH,
  WORDS_TEXT_MAX,
  WORD_COLORS,
  WORD_SIZE,
  contentBottom,
  freeSlot,
  newArrangementId,
  resolveArrangement,
  storedFromResolved,
  turnedBox,
  unturnedWordsBox,
  type PhotoSet,
  type PoolItem,
  type ResolvedArrangement,
  type ResolvedMoment,
  type ResolvedObject,
  type ResolvedPhoto,
  type RunOfShowMoment,
  type StoredWords,
  type WordColor,
} from './story-arrangement';

export type MakeItYoursWorld = {
  runOfShow: readonly RunOfShowMoment[];
  pool: readonly PoolItem[];
};

/** Why a move did nothing — each one is said to the host, never swallowed. */
export type Refusal =
  | 'automatic'
  | 'already_placed'
  | 'not_in_pool'
  | 'no_moment'
  | 'no_photos'
  | 'no_name'
  | 'last_moment'
  | 'no_change'
  | 'too_few'
  | 'no_set'
  | 'all_placed'
  | 'full';

export type Move =
  | { ok: true; state: ResolvedArrangement }
  | { ok: false; refusal: Refusal; state: ResolvedArrangement };

/** A move that made something new, and says what it made. */
export type Made =
  | { ok: true; state: ResolvedArrangement; id: string }
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
  if (moment.objects.length >= OBJECTS_PER_MOMENT_MAX) return { ok: false, refusal: 'full', state };
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
  opts: { toFront?: boolean; measured?: Measured } = {},
): Move {
  if (state.mode !== 'hand') return { ok: false, refusal: 'automatic', state };
  const moment = momentById(state, momentId);
  const found = moment?.objects.find((o) => o.id === objectId);
  if (!moment || !found) return { ok: false, refusal: 'no_moment', state };
  // Words wrap to the room they have, so they are measured again where they landed.
  const target: ResolvedObject = isPhoto(found) ? found : { ...found, ...measuredOf(opts.measured) };
  const at = isPhoto(target)
    ? clampPosition(to.x, to.y, target.w)
    : clampWords({ ...target, x: to.x, y: to.y });
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

/* ══════════════════════════════════════════════════════════════════════════
   WORDS (step 6)
   ══════════════════════════════════════════════════════════════════════════ */

/** How far below everything a new box lands — the prototype's `contentBottom(c)+14`. */
export const NEW_WORDS_GAP = 14;
/** One press of − or + on the words toolbar — a font-size stepper's step. */
export const WORD_SIZE_STEP = 2;
/** One press of turn left / turn right. */
export const WORD_TURN_STEP = 15;
/** A turn this close to straight snaps straight (the round handle). */
export const WORD_TURN_SNAP = 5;

export const isWords = (o: ResolvedObject): o is StoredWords => o.kind === 'words';

/**
 * Where words may sit: the whole TURNED box inside the sheet's sides and top — it may go past
 * the bottom, where the sheet grows to meet it. The stored x stays inside the store's own range
 * (0…659), so what is saved is exactly what reads back.
 */
export function clampWords(o: Pick<StoredWords, 'x' | 'y' | 'turn'> & { w?: number; h?: number; text: string }): {
  x: number;
  y: number;
} {
  const raw = unturnedWordsBox({ ...o, id: '', kind: 'words', size: 0, color: 'ink', backing: false });
  const tb = turnedBox(raw, o.turn);
  const offX = tb.x - raw.x;
  const offY = tb.y - raw.y;
  const lo = Math.max(0, -offX);
  const hi = Math.min(SHEET_WIDTH - 1, SHEET_WIDTH - offX - tb.w);
  const x = hi < lo ? lo : Math.min(hi, Math.max(lo, o.x));
  const y = Math.min(SHEET_MAX_Y, Math.max(Math.max(0, -offY), o.y));
  return { x: Math.round(x), y: Math.round(y) };
}

/**
 * + WORDS — an EMPTY box, placed BELOW everything already on the page, never on top of a photo
 * (10a RL-12: dropped at a fixed spot, it covered a photo's × and the next tap deleted the words).
 * The editor shows it a placeholder; an empty box is never a caption on its own.
 */
export function addWords(state: ResolvedArrangement, world: MakeItYoursWorld, momentId: string): Made {
  if (state.mode !== 'hand') return { ok: false, refusal: 'automatic', state };
  const moment = momentById(state, momentId);
  if (!moment) return { ok: false, refusal: 'no_moment', state };
  // The save's own ceiling — found by the monkey: past it, the WHOLE story would stop saving.
  if (moment.objects.length >= OBJECTS_PER_MOMENT_MAX) return { ok: false, refusal: 'full', state };
  const id = newArrangementId('words');
  const words: StoredWords = {
    id,
    kind: 'words',
    text: '',
    x: GRID.pad,
    y: Math.min(SHEET_MAX_Y, Math.max(GRID.top, Math.round(contentBottom(moment.objects) + NEW_WORDS_GAP))),
    size: WORD_SIZE.default,
    color: 'ink',
    backing: false,
    turn: 0,
  };
  const next = withMoment(state, momentId, (m) => ({ ...m, objects: [...m.objects, words] }));
  return { ok: true, id, state: settle(next, world) };
}

/** What the editor measured the words at — sheet units, before any turn. */
export type Measured = { w: number; h: number };

const measuredOf = (m: Measured | undefined) =>
  m && Number.isFinite(m.w) && Number.isFinite(m.h)
    ? { w: Math.max(1, Math.min(SHEET_WIDTH, Math.round(m.w))), h: Math.max(1, Math.round(m.h)) }
    : {};

function changeWords(
  state: ResolvedArrangement,
  world: MakeItYoursWorld,
  momentId: string,
  wordsId: string,
  change: (w: StoredWords) => StoredWords,
): Move {
  if (state.mode !== 'hand') return { ok: false, refusal: 'automatic', state };
  const moment = momentById(state, momentId);
  const target = moment?.objects.find((o) => o.id === wordsId);
  if (!moment || !target || !isWords(target)) return { ok: false, refusal: 'no_moment', state };
  const changed = change(target);
  // Whatever changed its size or its turn, the whole turned box stays on the sheet.
  const at = clampWords(changed);
  const next = withMoment(state, momentId, (m) => ({
    ...m,
    objects: m.objects.map((o) => (o.id === wordsId ? { ...changed, x: at.x, y: at.y } : o)),
  }));
  return { ok: true, state: settle(next, world) };
}

/** Typing. The text is the host's own — line breaks kept, capped only. */
export function editWords(
  state: ResolvedArrangement,
  world: MakeItYoursWorld,
  momentId: string,
  wordsId: string,
  text: string,
  measured?: Measured,
): Move {
  return changeWords(state, world, momentId, wordsId, (w) => ({
    ...w,
    text: text.slice(0, WORDS_TEXT_MAX),
    ...measuredOf(measured),
  }));
}

export type WordsLook = { size?: number; color?: WordColor; backing?: boolean; turn?: number };

/** A look from the words toolbar or the round handle: size, colour, background, turn. */
export function styleWords(
  state: ResolvedArrangement,
  world: MakeItYoursWorld,
  momentId: string,
  wordsId: string,
  look: WordsLook,
  measured?: Measured,
): Move {
  return changeWords(state, world, momentId, wordsId, (w) => ({
    ...w,
    ...(look.size !== undefined
      ? { size: Math.round(Math.min(WORD_SIZE.max, Math.max(WORD_SIZE.min, look.size))) }
      : {}),
    ...(look.color !== undefined && (WORD_COLORS as readonly string[]).includes(look.color)
      ? { color: look.color }
      : {}),
    ...(look.backing !== undefined ? { backing: look.backing } : {}),
    ...(look.turn !== undefined && Number.isFinite(look.turn)
      ? { turn: Math.round(Math.max(-3_600, Math.min(3_600, look.turn))) }
      : {}),
    ...measuredOf(measured),
  }));
}

/** The round handle's turn: within 5° of straight it IS straight. */
export function snapTurn(deg: number): number {
  const n = ((deg % 360) + 360) % 360;
  return n < WORD_TURN_SNAP || n > 360 - WORD_TURN_SNAP ? 0 : Math.round(deg);
}

/* ══════════════════════════════════════════════════════════════════════════
   MOMENTS (step 6) — + New, ✎, row ×, the grip and Alt+Arrow
   ══════════════════════════════════════════════════════════════════════════ */

/** + NEW — a moment of the host's own, at the end, named until they name it. */
export function addMoment(state: ResolvedArrangement, world: MakeItYoursWorld): Made {
  if (state.mode !== 'hand') return { ok: false, refusal: 'automatic', state };
  // The save's own ceiling — found by the monkey: past it, the WHOLE story would stop saving.
  if (state.moments.length >= MOMENTS_MAX) return { ok: false, refusal: 'full', state };
  const id = newArrangementId('own');
  const moment: ResolvedMoment = {
    id,
    source: 'host',
    name: NEW_MOMENT_NAME,
    startMs: null,
    mode: state.mode,
    objects: [],
  };
  return { ok: true, id, state: settle({ ...state, moments: [...state.moments, moment] }, world) };
}

/** ✎ — an empty name is not a name: the moment keeps the one it had. */
export function renameMoment(
  state: ResolvedArrangement,
  world: MakeItYoursWorld,
  momentId: string,
  name: string,
): Move {
  if (state.mode !== 'hand') return { ok: false, refusal: 'automatic', state };
  const moment = momentById(state, momentId);
  if (!moment) return { ok: false, refusal: 'no_moment', state };
  const v = name.trim().slice(0, MOMENT_NAME_MAX);
  if (!v) return { ok: false, refusal: 'no_name', state };
  if (v === moment.name) return { ok: false, refusal: 'no_change', state };
  return { ok: true, state: settle(withMoment(state, momentId, (m) => ({ ...m, name: v })), world) };
}

/**
 * Row × — the moment goes, and its photos go back to the tray, never with it (the tray is
 * recomputed by `settle`). Its words go with it; the editor offers Undo, which brings them back.
 * The last moment stays: a story needs one page to put things on.
 */
export function removeMoment(state: ResolvedArrangement, world: MakeItYoursWorld, momentId: string): Move {
  if (state.mode !== 'hand') return { ok: false, refusal: 'automatic', state };
  if (!momentById(state, momentId)) return { ok: false, refusal: 'no_moment', state };
  if (state.moments.length < 2) return { ok: false, refusal: 'last_moment', state };
  return {
    ok: true,
    state: settle(
      { ...state, handTouched: true, moments: state.moments.filter((m) => m.id !== momentId) },
      world,
    ),
  };
}

/**
 * The grip, finished. The order is taken by ID from what the list shows, and every moment the
 * state holds appears in it EXACTLY ONCE — an id the list no longer has is dropped, a moment the
 * list did not show keeps its place at the end. So a key that redraws the page while a grip is
 * still held can never list one moment twice (10a r3 chaos-r3-10).
 */
export function reorderMoments(
  state: ResolvedArrangement,
  world: MakeItYoursWorld,
  order: readonly string[],
): Move {
  if (state.mode !== 'hand') return { ok: false, refusal: 'automatic', state };
  const byId = new Map(state.moments.map((m) => [m.id, m] as const));
  const seen = new Set<string>();
  const moments: ResolvedMoment[] = [];
  for (const id of order) {
    const m = byId.get(id);
    if (!m || seen.has(id)) continue;
    seen.add(id);
    moments.push(m);
  }
  for (const m of state.moments) if (!seen.has(m.id)) moments.push(m);
  if (moments.every((m, i) => m.id === state.moments[i]?.id)) {
    return { ok: false, refusal: 'no_change', state };
  }
  return { ok: true, state: settle({ ...state, handTouched: true, moments }, world) };
}

/** Alt+Arrow — one place up or down. */
export function moveMoment(
  state: ResolvedArrangement,
  world: MakeItYoursWorld,
  momentId: string,
  delta: -1 | 1,
): Move {
  const ids = state.moments.map((m) => m.id);
  const i = ids.indexOf(momentId);
  const j = i + delta;
  if (i < 0) return { ok: false, refusal: 'no_moment', state };
  if (j < 0 || j >= ids.length) return { ok: false, refusal: 'no_change', state };
  [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  return reorderMoments(state, world, ids);
}

/* ══════════════════════════════════════════════════════════════════════════
   NAMED SETS (step 6) — "Name these photos", one chip per name
   ══════════════════════════════════════════════════════════════════════════ */

/** The photographs on one page, in page order, once each. */
export function refsOn(m: ResolvedMoment | undefined): string[] {
  if (!m) return [];
  const out: string[] = [];
  for (const o of m.objects) if (isPhoto(o) && !out.includes(o.ref)) out.push(o.ref);
  return out;
}

/**
 * NAME THESE PHOTOS — the photos on this page, under one name. ONE CHIP PER NAME: naming a
 * second set the same thing replaces the first (the prototype's `saveSet`). It places nothing,
 * so it is never a second place for a photograph.
 */
export function nameSet(
  state: ResolvedArrangement,
  world: MakeItYoursWorld,
  momentId: string,
  name: string,
): Made {
  if (state.mode !== 'hand') return { ok: false, refusal: 'automatic', state };
  const moment = momentById(state, momentId);
  if (!moment) return { ok: false, refusal: 'no_moment', state };
  const refs = refsOn(moment);
  if (refs.length < 2) return { ok: false, refusal: 'too_few', state };
  const v = name.trim().slice(0, SET_NAME_MAX);
  if (!v) return { ok: false, refusal: 'no_name', state };
  const sets: PhotoSet[] = [...state.sets.filter((s) => s.name !== v), { name: v, refs }];
  return { ok: true, id: v, state: settle({ ...state, sets }, world) };
}

/** Chip × — the name is forgotten; every photo stays exactly where it is. */
export function forgetSet(state: ResolvedArrangement, world: MakeItYoursWorld, name: string): Move {
  if (!state.sets.some((s) => s.name === name)) return { ok: false, refusal: 'no_set', state };
  return { ok: true, state: settle({ ...state, sets: state.sets.filter((s) => s.name !== name) }, world) };
}

/** What a chip says: how many of its photos are still free to place, of how many. */
export function setFree(state: ResolvedArrangement, set: PhotoSet): { free: string[]; total: number } {
  const placed = new Set(placedRefs(state));
  return { free: set.refs.filter((r) => !placed.has(r)), total: set.refs.length };
}

/** A chip's press — every one of its photos still in the tray lands on this page. */
export function placeSet(
  state: ResolvedArrangement,
  world: MakeItYoursWorld,
  momentId: string,
  name: string,
): Move {
  if (state.mode !== 'hand') return { ok: false, refusal: 'automatic', state };
  const set = state.sets.find((s) => s.name === name);
  if (!set) return { ok: false, refusal: 'no_set', state };
  if (!momentById(state, momentId)) return { ok: false, refusal: 'no_moment', state };
  const { free } = setFree(state, set);
  if (free.length === 0) return { ok: false, refusal: 'all_placed', state };
  let cur = state;
  for (const ref of free) {
    const move = placePhoto(cur, world, momentId, ref);
    if (move.ok) cur = move.state;
  }
  return cur === state ? { ok: false, refusal: 'all_placed', state } : { ok: true, state: cur };
}
