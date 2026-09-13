/**
 * THE SHEET, AS A READER SEES IT — one moment the host arranged by hand, drawn at any width.
 *
 * `10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md` step 5 · the owner-passed prototype
 * `prototypes/story_make_it_yours_2026-09-10.html` (its `.canvas`, `.obj.ph`, `.obj.tx`,
 * `applyLook`, `fitStage`) · design call ⓶: "the page is a FIXED SHEET SCALED TO FIT — what you
 * arrange on a laptop is what a phone shows, smaller."
 *
 * Pure + total — no React, no network. The public story (step 5) renders from THIS, and the prints
 * (step 7) must too: a second renderer is a second opinion about where the host put something.
 * The geometry itself (660 wide, the photo box, `sheetHeight`) is `story-arrangement.ts`'s and is
 * imported, never copied.
 *
 * ── HOW "SCALED TO FIT" IS DONE WITHOUT A SCRIPT ─────────────────────────────
 * Every length on the sheet is written as `calc(var(--sn-u) * N)`, where `--sn-u` is one sheet
 * unit: `100cqw / 660` of the sheet's own width (a CSS container). So the composition is decided
 * by the stored numbers alone and is the same at 1280 and at 390 — on the server's first byte,
 * with JavaScript off, in a screenshot and on paper. Nothing re-flows; the prototype's `fitStage`
 * scaled with a transform for the same reason (re-flowing piled photos on a phone).
 *
 * 🔒 WHAT A READER GETS IS ALREADY GATED. This module is handed a `ResolvedArrangement` that came
 * through `loadStoryArrangement` — the guests' layer (S3) and the consent veto (S14) have already
 * taken out everything this reader may not have. It adds nothing and re-asks nothing.
 */

import {
  PHOTO_H,
  PHOTO_W,
  SHEET_BOTTOM_ROOM,
  SHEET_WIDTH,
  boxOf,
  WORD_SIZE,
  sheetHeight,
  wordsMaxWidth,
  type ResolvedArrangement,
  type ResolvedMoment,
  type WordColor,
} from './story-arrangement';
import { manilaDayOf } from './story-day-window';

/* ══════════════════════════════════════════════════════════════════════════
   THE LOOK — the prototype's light palette, by the NAME the host picked
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The four word colours, as the prototype draws them on paper (`--ink`, `--act`, `--link`,
 * `--tgold`). Fixed values rather than theme tokens: the sheet is a printed page, and a saved
 * caption must never be re-coloured into something the host did not pick.
 */
export const WORD_COLOR_HEX: Record<WordColor, string> = {
  ink: '#2C2A29',
  terracotta: '#C24E25',
  blue: '#3B4E67',
  gold: '#8A6B39',
};

/** The sheet's paper — the prototype's `--paper`. Words with a backing use it as their ink. */
export const SHEET_PAPER = '#FFFFFF';

/**
 * The words' face — the prototype's `--f-d` (Fraunces), loaded app-wide as
 * `--font-pahina-display`. The editor must set words in this same face, or a line that wraps in
 * one place for the host wraps somewhere else for a guest.
 */
export const SHEET_WORDS_FONT = 'var(--font-pahina-display), Fraunces, Georgia, serif';

/** One sheet unit, as CSS. Every length below is a multiple of it. */
export const SHEET_UNIT_VAR = '--sn-u';
export const u = (n: number): string => `calc(var(${SHEET_UNIT_VAR}) * ${n})`;

/** The prototype's `.obj.tx` padding (7 10 7 24) and minimum width, in sheet units. */
export const WORDS_PAD = { top: 7, right: 10, bottom: 7, left: 24 } as const;
export const WORDS_MIN_WIDTH = 90;
export const WORDS_LINE_HEIGHT = 1.25;
/** `.obj.tx.pill .ed` — a backing's own padding and roundness. */
export const BACKING_PAD = { y: 2, x: 10, radius: 10 } as const;
/** `.obj.ph` — the white mount round a photograph, and the rounding inside it. */
export const PHOTO_MOUNT = 3;
export const PHOTO_RADIUS = 9;
export const PHOTO_INNER_RADIUS = 6;

/* ══════════════════════════════════════════════════════════════════════════
   WHAT ONE SHEET DRAWS
   ══════════════════════════════════════════════════════════════════════════ */

export type SheetPhoto = {
  kind: 'photo' | 'snippet';
  id: string;
  ref: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Stored keys, as the pool resolved them (after the veto). Turned into URLs by the loader. */
  stillKey: string | null;
  playKey: string | null;
};

export type SheetWords = {
  kind: 'words';
  id: string;
  text: string;
  x: number;
  y: number;
  size: number;
  /** Words wrap at this width — the prototype's `WMAX * size / 19`. */
  maxWidth: number;
  color: string;
  backing: boolean;
  turn: number;
};

export type SheetObject = SheetPhoto | SheetWords;

export type Sheet = {
  momentId: string;
  /** The host's name for it, else the run of show's; null when neither may be shown. */
  name: string | null;
  /** When its block starts, as a real instant; null for a moment the host added. */
  startMs: number | null;
  height: number;
  /** In the host's order — later draws over earlier, and words over photos (`.obj.tx` z 3). */
  objects: SheetObject[];
};

function toSheetObject(o: ResolvedMoment['objects'][number]): SheetObject | null {
  if (o.kind === 'words') {
    if (o.text.trim() === '') return null;
    const size = o.size || WORD_SIZE.default;
    return {
      kind: 'words',
      id: o.id,
      text: o.text,
      x: o.x,
      y: o.y,
      size,
      maxWidth: wordsMaxWidth(size),
      color: WORD_COLOR_HEX[o.color] ?? WORD_COLOR_HEX.ink,
      backing: o.backing,
      turn: o.turn,
    };
  }
  // A photo whose image cannot be drawn is not drawn — an empty white frame on a guest's page
  // says "something was here" about a photograph that is, for this reader, not there.
  if (!o.stillKey && !o.playKey) return null;
  return {
    kind: o.media === 'snippet' ? 'snippet' : 'photo',
    id: o.id,
    ref: o.ref,
    x: o.x,
    y: o.y,
    w: o.w || PHOTO_W,
    h: o.h || PHOTO_H,
    stillKey: o.stillKey,
    playKey: o.playKey,
  };
}

/**
 * The sheets a reader is shown — one per moment the host ARRANGED BY HAND that still has
 * something on it for this reader.
 *
 * 🔑 AUTOMATIC IS "EXACTLY AS TODAY". In Automatic the story's minutes are the page, as they have
 * been since S9, so this returns nothing and the public story does not change by a byte. The mode
 * is one switch for the story (step 3's ruling), but it is asked PER MOMENT here, so the day the
 * owner rules a per-moment switch nothing below has to change.
 *
 * A by-hand moment with nothing left on it for this reader — every photo taken back, or never
 * anything but an empty caption — draws no sheet at all rather than a blank page.
 */
export function sheetsOf(arrangement: ResolvedArrangement | null): Sheet[] {
  if (!arrangement || arrangement.withheld) return [];
  const out: Sheet[] = [];
  for (const m of arrangement.moments) {
    if (m.mode !== 'hand') continue;
    const objects = m.objects.map(toSheetObject).filter((o): o is SheetObject => o !== null);
    if (objects.length === 0) continue;
    const drawn = new Set(objects.map((o) => o.id));
    out.push({
      momentId: m.id,
      name: m.name,
      startMs: m.startMs,
      // Measured from what is actually drawn, so a photo that was taken back no longer holds
      // the sheet open below the last thing a reader can see.
      height: heightOf(m.objects.filter((o) => drawn.has(o.id))),
      objects,
    });
  }
  return out;
}

/**
 * `sheetHeight`, plus one allowance it cannot make: words the editor never measured are
 * estimated at the DEFAULT size there, so large words would run off the bottom of the paper.
 * Here the estimate is scaled by the size the host chose. Measured words are taken as measured.
 */
function heightOf(objects: ResolvedMoment['objects']): number {
  let bottom = 0;
  for (const o of objects) {
    if (o.kind !== 'words' || o.h !== undefined) continue;
    const b = boxOf(o);
    bottom = Math.max(bottom, b.y + b.h * Math.max(1, o.size / WORD_SIZE.default));
  }
  return Math.max(sheetHeight(objects), Math.ceil(bottom) + SHEET_BOTTOM_ROOM);
}

/**
 * Every capture a sheet shows. The day's minutes leave these out of their own media, so a
 * photograph the host placed is on the page once — the same "one photo, one place" rule the
 * editor enforces, carried onto the page a guest reads.
 */
export function refsOnSheets(
  sheets: ReadonlyArray<{
    objects: ReadonlyArray<SheetWords | { kind: 'photo' | 'snippet'; ref: string }>;
  }>,
): Set<string> {
  const out = new Set<string>();
  for (const s of sheets) {
    for (const o of s.objects) if (o.kind !== 'words') out.add(o.ref.toLowerCase());
  }
  return out;
}

/** The sheet's own aspect, for a box that must hold its place before anything loads. */
export function sheetAspect(sheet: Pick<Sheet, 'height'>): string {
  return `${SHEET_WIDTH} / ${sheet.height}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   WHERE A SHEET GOES ON THE DAY'S SPINE
   ══════════════════════════════════════════════════════════════════════════ */

export type PlacedSheet<S> = {
  sheet: S;
  /** The Manila calendar day whose section it is drawn in. */
  day: string;
  /** Where it sorts among that day's minutes. Null only when nothing on the story has a time. */
  atMs: number | null;
  /**
   * TRUE only for a moment that starts at `atMs` itself — a run-of-show moment. A moment the
   * host added has no time of its own: it is drawn next to the moment the host put it after,
   * and it carries NO clock stamp, because a stamp would claim a time nobody set.
   */
  timed: boolean;
};

/**
 * Put each sheet on the spine.
 *
 *   • a run-of-show moment → at its block's start, on that block's Manila day;
 *   • a moment the host added → right after the moment before it in the HOST'S order (or before
 *     the first timed one, when it leads), so the order the host chose survives on the page;
 *   • nothing timed at all (no run of show) → the top of the first day.
 *
 * A day the celebration's own dates do not include is moved to the nearest one that is drawn —
 * a block typed on the wrong date must not make a moment vanish from the page.
 */
export function placeSheetsOnDays<S extends { startMs: number | null }>(
  sheets: readonly S[],
  dayDates: readonly string[],
): PlacedSheet<S>[] {
  const days = [...dayDates].sort();
  const snap = (day: string | null): string | null => {
    if (days.length === 0) return day;
    if (!day) return days[0] ?? null;
    if (days.includes(day)) return day;
    let best = days[0]!;
    for (const d of days) if (d <= day) best = d;
    return best;
  };

  // A host's moment borrows the instant of the nearest timed moment BEFORE it, else after it.
  const borrowed: Array<number | null> = sheets.map((s) => s.startMs);
  let last: number | null = null;
  for (let i = 0; i < sheets.length; i += 1) {
    if (sheets[i]!.startMs !== null) last = sheets[i]!.startMs;
    else borrowed[i] = last;
  }
  let next: number | null = null;
  for (let i = sheets.length - 1; i >= 0; i -= 1) {
    if (sheets[i]!.startMs !== null) next = sheets[i]!.startMs;
    else if (borrowed[i] === null) borrowed[i] = next;
  }

  const out: PlacedSheet<S>[] = [];
  sheets.forEach((sheet, i) => {
    const atMs = borrowed[i] ?? null;
    const day = snap(atMs === null ? null : manilaDayOf(new Date(atMs).toISOString()));
    if (!day) return;
    out.push({ sheet, day, atMs, timed: sheet.startMs !== null });
  });
  return out;
}

/**
 * A minute's media without the photographs a sheet already shows — one photo, one place on the
 * page. The minute itself is kept (its words and its layers are not the host's to lose by moving
 * a photograph); only the repeated media leaves it. Returns the SAME object when nothing moved.
 */
export function withoutPlacedMedia<C extends { media: ReadonlyArray<{ id?: string | null }> }>(
  chapter: C,
  onSheets: ReadonlySet<string>,
): C {
  if (onSheets.size === 0) return chapter;
  const media = chapter.media.filter((m) => !m.id || !onSheets.has(m.id.toLowerCase()));
  return media.length === chapter.media.length ? chapter : { ...chapter, media };
}
