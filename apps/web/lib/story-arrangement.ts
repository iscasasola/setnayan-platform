/**
 * THE ARRANGEMENT — what a host lays out in the Story Maker's "Make it yours", and how it is
 * read back.
 *
 * `10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md` step 3 · the owner-passed prototype
 * `prototypes/story_make_it_yours_2026-09-10.html` · `DECISION_LOG.md` 2026-09-10 (🧩, the
 * stickers-off row, the toolbar row).
 *
 * Pure + total — no network, no `server-only`, no React. The editor (step 4), the public page
 * (step 5) and the prints (step 7) all import THIS, so the shape a host saves and the shape a
 * guest is shown come from one definition. The reads that feed it live in
 * `story-arrangement-store.ts`; the one door that writes it is `save_story_arrangement`.
 *
 * ── WHAT IS STORED, AND WHAT IS NOT ────────────────────────────────────────────
 *   stored   · the mode (Automatic | I choose) — ONE switch for the whole story, because the
 *              prototype the owner passed has one ("How moments are made"), not one per moment
 *            · every moment the host kept, in the host's order, with any name they typed
 *            · on every page: words (text, colour, backing, size, turn) at x, y in SHEET UNITS
 *            · in "I choose": every photo and snippet on a page, by its capture id, at x, y
 *            · named photo sets
 *   derived  · 🔑 AUTOMATIC. Which photograph is in which moment, and where it sits, is
 *              recomputed from the run of show and the capture minutes on EVERY read — so a
 *              photo that arrives tomorrow sorts itself, and a run-of-show moment the host
 *              removed in "I choose" is back the moment they return to Automatic.
 *
 * ── THE TWO RULES A READ ENFORCES, whatever was stored ─────────────────────────
 *  1. ONE PHOTOGRAPH, ONE PLACE. A save that puts a capture in two moments (or twice in one)
 *     is REFUSED. A read of a stored document that somehow holds one anyway — the couple can
 *     reach their own row — keeps the first and drops the rest.
 *  2. ONLY WHAT THIS VIEWER MAY SEE. A photo reference is kept only if it is in the POOL the
 *     caller hands in, and the store builds that pool through the story's own gates: screened
 *     clean, not hidden, the consent veto (S14 — a guest who took their photo back), and the
 *     guests' layer (S3 — nothing guest-made reaches a stranger before publish). A reference
 *     that fails is dropped from the page it was on; the stored document is left alone, so a
 *     guest who gives consent back gets their photograph back where the host put it.
 */

import { guestLayerAdmits } from './the-guests-layer-is-theirs-until-you-publish';
import type { StoryAudience, StoryViewer } from './who-can-see-your-story';

/* ══════════════════════════════════════════════════════════════════════════
   THE SHEET — the prototype's page geometry, in page units
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The page is a FIXED 660-unit sheet scaled to fit, never re-flowed — owner-passed design
 * call ⓶. What a host arranges on a laptop is what a phone shows, smaller. Every x, y, w, h in
 * this file is in these units.
 */
export const SHEET_WIDTH = 660;
/** The sheet never draws shorter than this; it grows downward to meet its lowest object. */
export const SHEET_MIN_HEIGHT = 360;
/** Room kept under the lowest object — the prototype's `fitStage`. */
export const SHEET_BOTTOM_ROOM = 28;
/** How far down a sheet may grow. A ceiling on a hand-made request, not a design limit. */
export const SHEET_MAX_Y = 20_000;

/** A photograph or snippet as it lands on a page. */
export const PHOTO_W = 146;
export const PHOTO_H = 100;

/** Four columns of photos: 20 + 3×158 + 146 = 640 ≤ 660. */
export const GRID = { pad: 20, top: 16, stepX: 158, stepY: 128, columns: 4 } as const;

/** Words wrap at this width (at the default size). */
export const WORDS_MAX_WIDTH = 400;
export const WORD_SIZE = { min: 12, max: 64, default: 19 } as const;

/**
 * The four word colours the prototype offers — Ink · Terracotta · Blue · Gold. Stored by NAME,
 * not by CSS variable, so a theme change can never re-colour a saved caption into something
 * the host did not pick.
 */
export const WORD_COLORS = ['ink', 'terracotta', 'blue', 'gold'] as const;
export type WordColor = (typeof WORD_COLORS)[number];

/** The same 60 the prototype's name fields allow. */
export const MOMENT_NAME_MAX = 60;
export const SET_NAME_MAX = 60;
export const WORDS_TEXT_MAX = 2_000;

/* Ceilings for a hand-made request. Far above anything the editor produces. */
export const MOMENTS_MAX = 80;
export const OBJECTS_PER_MOMENT_MAX = 400;
export const SETS_MAX = 60;
export const SET_REFS_MAX = 1_000;
/** The whole document, serialised. */
export const ARRANGEMENT_BYTES_MAX = 512_000;

/**
 * With no run of show there is nothing to sort BY, so the page opens in "I choose" on one
 * page — the prototype's `?noschedule` start. The id is fixed so a reload finds the same page.
 */
export const THE_DAY_MOMENT = { id: 'own:the-day', name: 'The day' } as const;
/** What a host-made moment is called when it reaches the server with no name at all. */
export const NEW_MOMENT_NAME = 'New moment';

/* ══════════════════════════════════════════════════════════════════════════
   THE STORED SHAPE
   ══════════════════════════════════════════════════════════════════════════ */

export type ArrangementMode = 'auto' | 'hand';

/** A photograph or snippet on a page. `ref` is `papic_photos.photo_id`. */
export type StoredPhoto = {
  id: string;
  kind: 'photo';
  ref: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

/**
 * Words on a page.
 *
 * `w`/`h` are the size the editor last MEASURED them at, in sheet units — optional, because a
 * box that has never been drawn has no measurement. They exist so a photo dealt by Automatic is
 * never dealt on top of the host's caption (10a M-R3-17), and so a sheet can know its height
 * without a font.
 */
export type StoredWords = {
  id: string;
  kind: 'words';
  text: string;
  x: number;
  y: number;
  size: number;
  color: WordColor;
  backing: boolean;
  /** Degrees. Kept as the host left it, never folded into ±180, so a save reads back exactly. */
  turn: number;
  w?: number;
  h?: number;
};

export type StoredObject = StoredPhoto | StoredWords;

/**
 * One moment. The id says where it came from:
 *   `ros:<event_schedule_blocks.public_id>` — a run-of-show moment
 *   `own:<token>`                           — a moment the host added
 *
 * ⚠ `name` ON A RUN-OF-SHOW MOMENT IS THE HOST'S RENAME ONLY. Its name otherwise comes from
 * the live run of show on every read, which is what keeps a block the couple later marks
 * PRIVATE from publishing its label here: the label is simply never copied in.
 */
export type StoredMoment = {
  id: string;
  name?: string;
  objects: StoredObject[];
};

/** A named set of photographs — one chip per name. */
export type PhotoSet = { name: string; refs: string[] };

export type StoredArrangement = {
  /** The shape of this document, so a later one can be read without guessing. */
  shape: 1;
  mode: ArrangementMode;
  /**
   * Is there hand work that going back to Automatic would re-sort? Saved because a reload
   * that forgot it let Automatic replace a hand arrangement with no Undo (10a
   * R5-reload-forgets-hand-changes · F2 · chaos-r3-02).
   */
  handTouched: boolean;
  moments: StoredMoment[];
  sets: PhotoSet[];
};

/* ══════════════════════════════════════════════════════════════════════════
   IDS
   ══════════════════════════════════════════════════════════════════════════ */

const MOMENT_ID = /^(ros|own):[A-Za-z0-9_-]{1,64}$/;
const OBJECT_ID = /^[A-Za-z0-9:_-]{1,96}$/;
const CAPTURE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isRunOfShowMomentId(id: string): boolean {
  return id.startsWith('ros:');
}

/** The moment id of a run-of-show block. */
export function runOfShowMomentId(blockPublicId: string): string {
  return `ros:${blockPublicId}`;
}

/**
 * A fresh id for a moment (`own`) or an object.
 *
 * 🔑 RANDOM, NEVER A COUNTER. The prototype numbered its ids and, after a reload, handed a new
 * moment the id of one already saved — naming it renamed the old one and Escape deleted it
 * with no Undo (10a R8-new-moment-id-collision-after-reload · F11 · chaos-r3-03). A save with
 * a repeated id is refused below, so a collision can no longer be silent; this makes one
 * vanishingly unlikely in the first place.
 */
export function newArrangementId(prefix: 'own' | 'photo' | 'words'): string {
  const bytes = new Uint8Array(9);
  globalThis.crypto.getRandomValues(bytes);
  let token = '';
  for (const b of bytes) token += (b % 36).toString(36);
  return `${prefix}:${token}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   READING A DOCUMENT — the save is strict, the read repairs
   ══════════════════════════════════════════════════════════════════════════ */

export type ArrangementProblem =
  | 'not_an_arrangement'
  | 'too_big'
  | 'no_moments'
  | 'bad_id'
  | 'duplicate_moment'
  | 'duplicate_object'
  | 'photo_in_two_places';

/**
 * What a host is told when a save is refused. The editor never produces these (they are a
 * client bug or a hand-made request), so each one says what to do, not what went wrong inside.
 */
export const ARRANGEMENT_PROBLEM_MESSAGE: Record<ArrangementProblem, string> = {
  not_an_arrangement: 'That could not be saved. Reload the page and try again.',
  too_big: 'That is more than one story can hold. Take something off a page and try again.',
  no_moments: 'A story needs at least one moment to put things on.',
  bad_id: 'That could not be saved. Reload the page and try again.',
  duplicate_moment: 'Two moments got mixed up. Reload the page and try again.',
  duplicate_object: 'Two things on a page got mixed up. Reload the page and try again.',
  photo_in_two_places:
    'A photo can only be in one moment. Take it off one page, then save again.',
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

function text(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

type Normalized = { doc: StoredArrangement | null; problem: ArrangementProblem | null };

/**
 * ONE normaliser, two strictnesses — so "what a save accepts" and "what a read keeps" cannot
 * drift into two definitions.
 *
 *   strict  (a save)  — a structural fault REFUSES the whole document
 *   lenient (a read)  — a structural fault is REPAIRED: the first of a repeated id or photo is
 *                       kept and the rest dropped, an unreadable id drops its thing
 *
 * Either way, numbers are rounded and clamped, text trimmed and capped, unknown keys dropped,
 * unknown object kinds dropped (the prototype's old stickers among them — off for now, owner
 * 2026-09-10), and in Automatic every photo object is dropped: Automatic is derived, not stored.
 */
function normalize(input: unknown, strict: boolean): Normalized {
  const fail = (problem: ArrangementProblem): Normalized => ({ doc: null, problem });
  if (!isRecord(input)) return fail('not_an_arrangement');
  if (!Array.isArray(input.moments)) return fail('not_an_arrangement');
  if (input.moments.length > MOMENTS_MAX) return fail('too_big');

  const mode: ArrangementMode = input.mode === 'auto' ? 'auto' : 'hand';
  const momentIds = new Set<string>();
  const objectIds = new Set<string>();
  const placed = new Set<string>();
  const moments: StoredMoment[] = [];

  for (const rawMoment of input.moments) {
    if (!isRecord(rawMoment)) {
      if (strict) return fail('not_an_arrangement');
      continue;
    }
    const id = typeof rawMoment.id === 'string' ? rawMoment.id : '';
    if (!MOMENT_ID.test(id)) {
      if (strict) return fail('bad_id');
      continue;
    }
    if (momentIds.has(id)) {
      if (strict) return fail('duplicate_moment');
      continue;
    }
    momentIds.add(id);

    const rawObjects = Array.isArray(rawMoment.objects) ? rawMoment.objects : [];
    if (rawObjects.length > OBJECTS_PER_MOMENT_MAX) {
      if (strict) return fail('too_big');
    }
    const objects: StoredObject[] = [];
    for (const raw of rawObjects.slice(0, OBJECTS_PER_MOMENT_MAX)) {
      if (!isRecord(raw)) continue;
      if (raw.kind !== 'photo' && raw.kind !== 'words') continue; // stickers are off for now
      const oid = typeof raw.id === 'string' ? raw.id : '';
      if (!OBJECT_ID.test(oid)) {
        if (strict) return fail('bad_id');
        continue;
      }
      if (objectIds.has(oid)) {
        if (strict) return fail('duplicate_object');
        continue;
      }

      if (raw.kind === 'photo') {
        const ref = typeof raw.ref === 'string' ? raw.ref.toLowerCase() : '';
        if (!CAPTURE_ID.test(ref)) {
          if (strict) return fail('bad_id');
          continue;
        }
        /*
          ONE PHOTOGRAPH, ONE PLACE — owner-passed design call ⓵. Checked across the WHOLE
          document, not per page: a photo in two moments and a photo twice on one page are the
          same fault, and a tap that lands twice produces the second.
        */
        if (placed.has(ref)) {
          if (strict) return fail('photo_in_two_places');
          continue;
        }
        placed.add(ref);
        objectIds.add(oid);
        // Automatic is derived, not stored — the photo is checked above and then left out.
        if (mode === 'auto') continue;
        const w = num(raw.w, 40, SHEET_WIDTH, PHOTO_W);
        objects.push({
          id: oid,
          kind: 'photo',
          ref,
          x: num(raw.x, 0, SHEET_WIDTH - w, 0),
          y: num(raw.y, 0, SHEET_MAX_Y, 0),
          w,
          h: num(raw.h, 30, 2_000, PHOTO_H),
        });
        continue;
      }

      objectIds.add(oid);
      const words: StoredWords = {
        id: oid,
        kind: 'words',
        // Not trimmed: a line break the host typed is the host's. Capped only.
        text: typeof raw.text === 'string' ? raw.text.slice(0, WORDS_TEXT_MAX) : '',
        x: num(raw.x, 0, SHEET_WIDTH - 1, 0),
        y: num(raw.y, 0, SHEET_MAX_Y, 0),
        size: num(raw.size, WORD_SIZE.min, WORD_SIZE.max, WORD_SIZE.default),
        color: (WORD_COLORS as readonly string[]).includes(raw.color as string)
          ? (raw.color as WordColor)
          : 'ink',
        backing: raw.backing === true,
        turn: num(raw.turn, -3_600, 3_600, 0),
      };
      if (typeof raw.w === 'number' && Number.isFinite(raw.w)) {
        words.w = num(raw.w, 1, SHEET_WIDTH, 1);
      }
      if (typeof raw.h === 'number' && Number.isFinite(raw.h)) {
        words.h = num(raw.h, 1, 5_000, 1);
      }
      objects.push(words);
    }

    const name = text(rawMoment.name, MOMENT_NAME_MAX);
    const moment: StoredMoment = { id, objects };
    if (isRunOfShowMomentId(id)) {
      if (name) moment.name = name;
    } else {
      // A moment the host made always has a name; the prototype calls a nameless one this.
      moment.name = name || NEW_MOMENT_NAME;
    }
    moments.push(moment);
  }

  if (moments.length === 0) return fail('no_moments');

  // One chip per name — a later set of the same name replaces the earlier (the prototype's
  // `saveSet`). A set carries capture ids only; it places nothing, so it is not a second
  // place for a photograph.
  const rawSets = Array.isArray(input.sets) ? input.sets : [];
  if (rawSets.length > SETS_MAX && strict) return fail('too_big');
  const byName = new Map<string, PhotoSet>();
  for (const raw of rawSets.slice(0, SETS_MAX)) {
    if (!isRecord(raw)) continue;
    const name = text(raw.name, SET_NAME_MAX);
    if (!name) continue;
    const refs: string[] = [];
    for (const r of Array.isArray(raw.refs) ? raw.refs.slice(0, SET_REFS_MAX) : []) {
      const ref = typeof r === 'string' ? r.toLowerCase() : '';
      if (CAPTURE_ID.test(ref) && !refs.includes(ref)) refs.push(ref);
    }
    if (refs.length === 0) continue;
    byName.delete(name);
    byName.set(name, { name, refs });
  }

  return {
    doc: {
      shape: 1,
      mode,
      handTouched: input.handTouched === true,
      moments,
      sets: [...byName.values()],
    },
    problem: null,
  };
}

/**
 * A document arriving to be SAVED. Refuses rather than repairs, so an editor bug is loud.
 */
export function sanitizeArrangementForSave(
  input: unknown,
): { ok: true; doc: StoredArrangement } | { ok: false; problem: ArrangementProblem } {
  let size = 0;
  try {
    size = JSON.stringify(input ?? null).length;
  } catch {
    return { ok: false, problem: 'not_an_arrangement' };
  }
  if (size > ARRANGEMENT_BYTES_MAX) return { ok: false, problem: 'too_big' };
  const { doc, problem } = normalize(input, true);
  if (!doc) return { ok: false, problem: problem ?? 'not_an_arrangement' };
  return { ok: true, doc };
}

/**
 * A document READ from the database. Never throws and never refuses — a stored document the
 * couple edited by hand is repaired, and one that cannot be read at all is `null`, which
 * resolves exactly like a story nobody has arranged.
 */
export function readStoredArrangement(raw: unknown): StoredArrangement | null {
  try {
    return normalize(raw, false).doc;
  } catch {
    return null;
  }
}

/** Every capture id placed on a page. */
export function placedRefsOf(doc: StoredArrangement | null): string[] {
  if (!doc) return [];
  const out: string[] = [];
  for (const m of doc.moments) {
    for (const o of m.objects) if (o.kind === 'photo') out.push(o.ref);
  }
  return out;
}

/**
 * Every capture id the document mentions — placed or named in a set. The ids a save must prove
 * belong to this celebration.
 */
export function mentionedRefsOf(doc: StoredArrangement): string[] {
  const all = new Set(placedRefsOf(doc));
  for (const s of doc.sets) for (const r of s.refs) all.add(r);
  return [...all];
}

/**
 * Take out every capture id the caller could not prove belongs to this celebration — a photo
 * from somebody else's day is never stored against this one. Returns a new document.
 */
export function keepOnlyRefs(doc: StoredArrangement, known: ReadonlySet<string>): StoredArrangement {
  return {
    ...doc,
    moments: doc.moments.map((m) => ({
      ...m,
      objects: m.objects.filter((o) => o.kind !== 'photo' || known.has(o.ref)),
    })),
    sets: doc.sets
      .map((s) => ({ ...s, refs: s.refs.filter((r) => known.has(r)) }))
      .filter((s) => s.refs.length > 0),
  };
}

/**
 * A run-of-show moment whose "name" is just its block's label is not a rename. Dropping it here
 * is what lets the name keep following the run of show — and what stops the label being frozen
 * into a public page after the couple marks the block private.
 */
export function dropNamesThatAreLabels(
  doc: StoredArrangement,
  runOfShow: readonly RunOfShowMoment[],
): StoredArrangement {
  const label = new Map(runOfShow.map((b) => [b.id, b.label] as const));
  return {
    ...doc,
    moments: doc.moments.map((m) => {
      if (!isRunOfShowMomentId(m.id) || m.name === undefined) return m;
      if (label.get(m.id) !== m.name) return m;
      return { id: m.id, objects: m.objects };
    }),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   WHERE THINGS SIT — the prototype's geometry, ported
   ══════════════════════════════════════════════════════════════════════════ */

export type Box = { x: number; y: number; w: number; h: number };

/** The k-th slot of the photo grid. */
export function slotXY(k: number): { x: number; y: number } {
  return {
    x: GRID.pad + (k % GRID.columns) * GRID.stepX,
    y: GRID.top + Math.floor(k / GRID.columns) * GRID.stepY,
  };
}

/** Two boxes overlap by more than a 6-unit sliver. */
export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w - 6 && b.x < a.x + a.w - 6 && a.y < b.y + b.h - 6 && b.y < a.y + a.h - 6;
}

/**
 * The box an object takes up. Words use the size they were last drawn at; before that, the
 * prototype's estimate from the text alone.
 */
export function boxOf(o: StoredObject): Box {
  if (o.kind === 'photo') return { x: o.x, y: o.y, w: o.w, h: o.h };
  if (o.w !== undefined && o.h !== undefined) return { x: o.x, y: o.y, w: o.w, h: o.h };
  const lines = o.text.split('\n');
  const longest = Math.max(0, ...lines.map((l) => l.length));
  const w = Math.min(WORDS_MAX_WIDTH, 34 + longest * 9.4);
  const per = Math.max(1, Math.floor((w - 34) / 9.4));
  const n = lines.reduce((a, l) => a + Math.max(1, Math.ceil(l.length / per)), 0);
  return { x: o.x, y: o.y, w, h: 16 + n * 24 };
}

/** The first grid slot nothing is sitting in — a photo is never dealt onto the host's words. */
export function freeSlot(objects: readonly StoredObject[]): { x: number; y: number } {
  const boxes = objects.map(boxOf);
  for (let k = 0; k < 400; k += 1) {
    const p = slotXY(k);
    const r = { x: p.x, y: p.y, w: PHOTO_W, h: PHOTO_H };
    if (!boxes.some((b) => overlaps(r, b))) return p;
  }
  return slotXY(objects.length);
}

/** The lowest edge of anything on the page. */
export function contentBottom(objects: readonly StoredObject[]): number {
  return objects.reduce((m, o) => {
    const b = boxOf(o);
    return Math.max(m, b.y + b.h);
  }, 0);
}

/** How tall the sheet draws — it grows downward to meet its lowest object. */
export function sheetHeight(objects: readonly StoredObject[]): number {
  return Math.max(SHEET_MIN_HEIGHT, Math.ceil(contentBottom(objects)) + SHEET_BOTTOM_ROOM);
}

/* ══════════════════════════════════════════════════════════════════════════
   RESOLVING — what a reader is actually shown
   ══════════════════════════════════════════════════════════════════════════ */

/** One run-of-show block, as a moment. Public blocks only — see the store. */
export type RunOfShowMoment = {
  /** `ros:<public_id>` */
  id: string;
  label: string;
  /** The block's start as a REAL instant (the wall-clock trap is lifted by the store). */
  startMs: number;
};

/**
 * One capture a reader may see — already through every gate. Anything not in the pool does not
 * reach a page, whatever the stored document says.
 */
export type PoolItem = {
  ref: string;
  media: 'photo' | 'snippet';
  capturedAtMs: number | null;
  /** The image to draw (a snippet's still). After the consent veto — possibly a blurred copy. */
  stillKey: string | null;
  /** A snippet's playable copy. Null for a photograph. */
  playKey: string | null;
};

export type ResolvedPhoto = StoredPhoto & {
  media: PoolItem['media'];
  capturedAtMs: number | null;
  stillKey: string | null;
  playKey: string | null;
};
export type ResolvedObject = ResolvedPhoto | StoredWords;

export type ResolvedMoment = {
  id: string;
  source: 'run_of_show' | 'host';
  /**
   * The host's rename, else the run of show's label, else null — a run-of-show moment whose
   * block was deleted or made private keeps its page but never borrows a hidden label.
   */
  name: string | null;
  /** When its block starts, as a real instant. Null for a host's moment or a block now gone. */
  startMs: number | null;
  /** How this moment's photos were placed. Every moment carries the story's one mode. */
  mode: ArrangementMode;
  objects: ResolvedObject[];
};

export type ResolvedArrangement = {
  mode: ArrangementMode;
  handTouched: boolean;
  /** Automatic needs a run of show; without one the story is "I choose" only. */
  hasRunOfShow: boolean;
  moments: ResolvedMoment[];
  /** The tray — every capture in the pool that is on no page. */
  unplaced: PoolItem[];
  /** Named sets, each reduced to the photos this reader may see. */
  sets: PhotoSet[];
  /**
   * The guests' layer is not this reader's yet (S3), so NOTHING of the arrangement is handed
   * over — see `resolveArrangementForViewer`.
   */
  withheld: boolean;
};

const pagePhoto = (o: StoredPhoto, item: PoolItem): ResolvedPhoto => ({
  ...o,
  media: item.media,
  capturedAtMs: item.capturedAtMs,
  stillKey: item.stillKey,
  playKey: item.playKey,
});

/**
 * The arrangement a reader sees, built from what was stored, the live run of show, and the
 * pool of captures this reader may see.
 *
 * `dropBlankWords` — a public reader gets no empty caption box (an empty box with a backing
 * would draw a blank coloured pill). The host's editor keeps them: a box they just added is
 * empty until they type.
 */
export function resolveArrangement(args: {
  stored: StoredArrangement | null;
  runOfShow: readonly RunOfShowMoment[];
  pool: readonly PoolItem[];
  dropBlankWords?: boolean;
}): ResolvedArrangement {
  const { stored, runOfShow, dropBlankWords = false } = args;
  const hasRunOfShow = runOfShow.length > 0;
  const blockById = new Map(runOfShow.map((b) => [b.id, b] as const));
  const poolByRef = new Map(args.pool.map((p) => [p.ref, p] as const));

  /*
    The mode a reader actually gets. Automatic without a run of show would leave every photo
    with no moment to go to, so it reads as "I choose" — the prototype opens that way too.
    Nothing stored at all is Automatic when there is a run of show to sort by.
  */
  const mode: ArrangementMode = stored
    ? stored.mode === 'auto' && hasRunOfShow
      ? 'auto'
      : 'hand'
    : hasRunOfShow
      ? 'auto'
      : 'hand';

  const words = (objects: readonly StoredObject[]): StoredWords[] =>
    objects.filter(
      (o): o is StoredWords => o.kind === 'words' && (!dropBlankWords || o.text.trim() !== ''),
    );

  const shell = (m: StoredMoment): ResolvedMoment => {
    const block = blockById.get(m.id);
    return {
      id: m.id,
      source: isRunOfShowMomentId(m.id) ? 'run_of_show' : 'host',
      name: m.name ?? block?.label ?? null,
      startMs: block?.startMs ?? null,
      mode,
      objects: [],
    };
  };

  const storedMoments: StoredMoment[] = stored?.moments.length
    ? stored.moments
    : hasRunOfShow
      ? []
      : [{ id: THE_DAY_MOMENT.id, name: THE_DAY_MOMENT.name, objects: [] }];

  let moments: ResolvedMoment[];
  const placed = new Set<string>();

  if (mode === 'auto') {
    /*
      ══ AUTOMATIC IS DERIVED, NOT STORED ═══════════════════════════════════
      The prototype's `ensureRunOfShow` + `autoArrange`, ported. Every run-of-show moment is
      present — one the host removed in "I choose" comes back — and every capture goes to the
      last moment that had already started when it was taken (the first, if it was taken
      before any). The host's own moments and ALL words are left exactly where they are.
    */
    const kept = storedMoments.filter(
      (m) =>
        // A run-of-show moment whose block is gone no longer derives; it stays only if the
        // host wrote on it, and then as a page of their own words.
        !isRunOfShowMomentId(m.id) || blockById.has(m.id) || words(m.objects).length > 0,
    );
    for (const b of runOfShow) {
      if (!kept.some((m) => m.id === b.id)) kept.push({ id: b.id, objects: [] });
    }
    const order = new Map(runOfShow.map((b, i) => [b.id, i] as const));
    const timed = kept
      .filter((m) => blockById.has(m.id))
      .sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    const untimed = kept.filter((m) => !blockById.has(m.id));

    moments = [...timed, ...untimed].map((m) => ({ ...shell(m), objects: [...words(m.objects)] }));
    const timedResolved = moments.slice(0, timed.length);

    const byTime = [...args.pool].sort((a, b) => {
      const at = a.capturedAtMs ?? Number.POSITIVE_INFINITY;
      const bt = b.capturedAtMs ?? Number.POSITIVE_INFINITY;
      return at !== bt ? at - bt : a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0;
    });
    for (const item of byTime) {
      let home: ResolvedMoment | undefined;
      for (const m of timedResolved) {
        if (item.capturedAtMs !== null && m.startMs !== null && item.capturedAtMs >= m.startMs) {
          home = m;
        }
      }
      home ??= timedResolved[0];
      if (!home) continue;
      const at = freeSlot(home.objects);
      home.objects.push(
        pagePhoto(
          { id: `auto:${item.ref}`, kind: 'photo', ref: item.ref, x: at.x, y: at.y, w: PHOTO_W, h: PHOTO_H },
          item,
        ),
      );
      placed.add(item.ref);
    }
  } else {
    /*
      ══ I CHOOSE — the host's pages, exactly as kept ══════════════════════
      Both rules, again, on the way OUT: a capture outside this reader's pool is dropped from
      the page it was on, and a capture that appears twice is shown once.
    */
    moments = storedMoments.map((m) => {
      const objects: ResolvedObject[] = [];
      for (const o of m.objects) {
        if (o.kind === 'words') {
          if (!dropBlankWords || o.text.trim() !== '') objects.push(o);
          continue;
        }
        const item = poolByRef.get(o.ref);
        if (!item || placed.has(o.ref)) continue;
        placed.add(o.ref);
        objects.push(pagePhoto(o, item));
      }
      return { ...shell(m), objects };
    });
  }

  return {
    mode,
    handTouched: stored?.handTouched ?? false,
    hasRunOfShow,
    moments,
    unplaced: args.pool.filter((p) => !placed.has(p.ref)),
    sets: (stored?.sets ?? [])
      .map((s) => ({ name: s.name, refs: s.refs.filter((r) => poolByRef.has(r)) }))
      .filter((s) => s.refs.length > 0),
    withheld: false,
  };
}

/**
 * The arrangement as THIS VIEWER may have it — the ONE entry a reader should use.
 *
 * 🔒 THE GUESTS' LAYER (S3). The moments are the minute sheet's source, and every photograph
 * on them is guest-made — so, exactly as `redactStoryLayers` empties `dayChapters`, a reader
 * the guests' layer does not admit gets NO moments and an empty pool: not the pages with the
 * photos taken off, which would still publish the day's shape. It can only ever show less.
 *
 * The consent veto (S14) is not decided here — it is decided when the POOL is built, through
 * `publicKeyForCapture`, the one gate every public surface uses.
 */
export function resolveArrangementForViewer(args: {
  stored: StoredArrangement | null;
  runOfShow: readonly RunOfShowMoment[];
  pool: readonly PoolItem[];
  status: StoryAudience;
  viewer: StoryViewer;
}): ResolvedArrangement {
  if (!guestLayerAdmits(args.status, args.viewer)) {
    return {
      mode: 'hand',
      handTouched: false,
      hasRunOfShow: args.runOfShow.length > 0,
      moments: [],
      unplaced: [],
      sets: [],
      withheld: true,
    };
  }
  return resolveArrangement({
    stored: args.stored,
    runOfShow: args.runOfShow,
    pool: args.pool,
    dropBlankWords: !args.viewer.isHost,
  });
}

/**
 * The document to SAVE, taken from what the editor is showing.
 *
 * 🔑 THE EDITOR SAVES WHAT IT SHOWS, NEVER THE RAW STORED DOCUMENT. So a capture a guest took
 * back — already off every page the host can see — leaves the stored document on the host's
 * next change as well, rather than riding along invisibly forever. In Automatic the photos are
 * left out (they are re-derived on the next read).
 */
export function storedFromResolved(r: ResolvedArrangement): StoredArrangement {
  return {
    shape: 1,
    mode: r.mode,
    handTouched: r.handTouched,
    moments: r.moments.map((m) => {
      const objects: StoredObject[] = [];
      for (const o of m.objects) {
        if (o.kind === 'words') {
          objects.push({ ...o });
        } else if (r.mode === 'hand') {
          objects.push({ id: o.id, kind: 'photo', ref: o.ref, x: o.x, y: o.y, w: o.w, h: o.h });
        }
      }
      const out: StoredMoment = { id: m.id, objects };
      // A host's moment always carries its name; a run-of-show one only if renamed, which the
      // save works out against the live label (`dropNamesThatAreLabels`).
      if (m.name !== null) out.name = m.name;
      return out;
    }),
    sets: r.sets.map((s) => ({ name: s.name, refs: [...s.refs] })),
  };
}
