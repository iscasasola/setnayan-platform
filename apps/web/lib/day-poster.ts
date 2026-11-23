/**
 * lib/day-poster.ts — 🖼 THE "OUR DAY" POSTER, the pure half: its six templates, its two size lists, its seven switches,
 * the record the builder saves, and the ONE rule for what saves free.
 *
 * Owner rulings, DECISION_LOG 2026-11-13 (every "OUR DAY POSTER" row, read together, the newest winning):
 *   · a keepsake, not a summary: no counts, no schedule — names · date · place · their own line, the photos the COUPLE
 *     picks (never an automatic pick), the entourage with every principal sponsor where the template shows it, and the
 *     event's ONE Event Hub QR, always printed;
 *   · the couple chooses a TEMPLATE (six, below), then a STYLE (photo print or canvas), then a SIZE — two size lists;
 *   · approved drawing v4 (`prototypes/approved_2026-11-13/our-day-poster-fable.html`): Collage is the photo print's
 *     default, One photo the canvas's; supporting ranges Collage 4–16 · Film strip 3–8 · Magazine cover 0–3 · Three
 *     moments 2 · Words + one photo 0–2; sponsors and entourage only on Collage and Words + one photo (both photo print
 *     only); supplier credits a switch, off to start; QR always on;
 *   · "CLASSIC SAVES FREE UP TO A4; LARGER SIZES AND THE PRO LOOKS NEED EVENT PRO" (amends "free in Classic"): A4 in the
 *     Classic look saves free for every event; every larger photo-print size, every canvas size and the event's own
 *     look need Event Pro ("Event Pro", never the retired "Event Hub Pro" — the 13 Nov name fix);
 *   · "THE FREE A4 FILE IS BUILT SO IT PRINTS SOFT IF ENLARGED": a flattened raster at A4 ≈ 200 dpi, no watermark
 *     (`DAY_POSTER_FREE_PX`); a Pro file is drawn at its size with vector type and the full-size photos;
 *   · "CRISP PRINTS ONLY UNTIL THE PHOTOS ARE COMPRESSED": the full-quality date is the shipped one
 *     (`FULL_RES_POST_EVENT_GRACE_DAYS` after the event's last day). After it the sizes above A4 lock — no special keep.
 *
 * The one-time large-download fee (13 Nov) has no price yet: the owner names it in the catalogue. Nothing here offers it.
 *
 * PURE. No I/O — the route, the loader, the builder and the tests all read it.
 */
/* Type-only: `lib/print-pieces.ts` reads this module (the record lives in its `print_details`), so nothing is imported back at run time. */
import type { PosterPhoto } from '@/lib/print-pieces';

import { eventLastDay } from '@/lib/face-data-retention-core';
import { addDays, fullSizeKeptUntil, originalsKeptUntil } from '@/lib/papic-originals-reminder-core';

const PT_PER_MM = 72 / 25.4;

/** The piece's key in `PRINT_PIECES` and in every address (`/api/hub-print/day-poster`). */
export const DAY_POSTER_KEY = 'day-poster' as const;

// ─── Styles and sizes ───────────────────────────────────────────────────────

export type DayPosterStyle = 'photo' | 'canvas';
export const DAY_POSTER_STYLES: readonly DayPosterStyle[] = ['photo', 'canvas'];
export const DAY_POSTER_STYLE_LABEL: Record<DayPosterStyle, string> = { photo: 'Photo print', canvas: 'Canvas' };

export type DayPosterSizeId =
  | 'a4'
  | 'a3plus'
  | 'p16x20'
  | 'a2'
  | 'p20x24'
  | 'p20x30'
  | 'a1'
  | 'p24x30'
  | 'c11x14'
  | 'c12x18'
  | 'c14x17'
  | 'c16x20'
  | 'c20x24';

export type DayPosterSize = { id: DayPosterSizeId; style: DayPosterStyle; label: string; wMm: number; hMm: number };

const IN = 25.4;

/**
 * THE TWO SIZE LISTS, written once (DECISION_LOG 2026-11-13 "TWO STYLES, TWO SIZE LISTS" + "CLASSIC SAVES FREE UP TO A4").
 * Portrait, trim size. A canvas's face is its size; the gallery wrap is added around it (`CANVAS_WRAP_MM`).
 */
export const DAY_POSTER_SIZES: Record<DayPosterSizeId, DayPosterSize> = {
  a4: { id: 'a4', style: 'photo', label: 'A4 · 210 × 297 mm', wMm: 210, hMm: 297 },
  a3plus: { id: 'a3plus', style: 'photo', label: 'A3+ · 13 × 19 in', wMm: 13 * IN, hMm: 19 * IN },
  p16x20: { id: 'p16x20', style: 'photo', label: '16 × 20 in', wMm: 16 * IN, hMm: 20 * IN },
  a2: { id: 'a2', style: 'photo', label: 'A2 · 420 × 594 mm', wMm: 420, hMm: 594 },
  p20x24: { id: 'p20x24', style: 'photo', label: '20 × 24 in', wMm: 20 * IN, hMm: 24 * IN },
  p20x30: { id: 'p20x30', style: 'photo', label: '20 × 30 in', wMm: 20 * IN, hMm: 30 * IN },
  a1: { id: 'a1', style: 'photo', label: 'A1 · 594 × 841 mm', wMm: 594, hMm: 841 },
  p24x30: { id: 'p24x30', style: 'photo', label: '24 × 30 in', wMm: 24 * IN, hMm: 30 * IN },
  c11x14: { id: 'c11x14', style: 'canvas', label: '11 × 14 in', wMm: 11 * IN, hMm: 14 * IN },
  c12x18: { id: 'c12x18', style: 'canvas', label: '12 × 18 in', wMm: 12 * IN, hMm: 18 * IN },
  c14x17: { id: 'c14x17', style: 'canvas', label: '14 × 17 in', wMm: 14 * IN, hMm: 17 * IN },
  c16x20: { id: 'c16x20', style: 'canvas', label: '16 × 20 in', wMm: 16 * IN, hMm: 20 * IN },
  c20x24: { id: 'c20x24', style: 'canvas', label: '20 × 24 in', wMm: 20 * IN, hMm: 24 * IN },
};

/** The one size every event saves free (Classic only). */
export const DAY_POSTER_FREE_SIZE: DayPosterSizeId = 'a4';

/**
 * THE FREE FILE'S PIXELS — A4 at ≈ 200 dpi, flattened (DECISION_LOG 2026-11-13 "THE FREE A4 FILE IS BUILT SO IT PRINTS
 * SOFT IF ENLARGED"). The build guard: the free export never exceeds this.
 */
export const DAY_POSTER_FREE_PX = { w: 1654, h: 2339 } as const;

/** A canvas's gallery wrap — about 2 in per side, folded over the stretcher (drawing v4 §2c, build notes "Canvas"). */
export const CANVAS_WRAP_MM = 2 * IN;

/** The smallest type a canvas prints — larger than paper's `PRINT_MIN_BODY_PT`, for the weave (build notes "Canvas"). */
export const CANVAS_MIN_BODY_PT = 11;

export function dayPosterSizesFor(style: DayPosterStyle): DayPosterSize[] {
  return Object.values(DAY_POSTER_SIZES).filter((s) => s.style === style);
}

export function isDayPosterSizeId(v: unknown): v is DayPosterSizeId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(DAY_POSTER_SIZES, v);
}

/** Points, trim (the canvas's face). */
export function dayPosterTrimPt(size: DayPosterSize): { w: number; h: number } {
  return { w: size.wMm * PT_PER_MM, h: size.hMm * PT_PER_MM };
}

// ─── Templates ──────────────────────────────────────────────────────────────

export type DayPosterTemplateKey = 'one-photo' | 'collage' | 'film-strip' | 'magazine' | 'three-moments' | 'words';

export type DayPosterTemplate = {
  key: DayPosterTemplateKey;
  name: string;
  /** The menu's line under the name (drawing v4 §2d). */
  line: string;
  /** How many SUPPORTING photos it takes (the main photo is always one). */
  min: number;
  max: number;
  /** Does it print the name rolls (principal sponsors · the entourage)? */
  rolls: boolean;
  styles: readonly DayPosterStyle[];
  /** The smallest size it is drawn at, by area — "A2 and larger" for Words + one photo. Null = every size. */
  minSize: DayPosterSizeId | null;
};

/** THE TEMPLATE REGISTRY, written once — the builder's menu, the photo count, the size list and the route read it. */
export const DAY_POSTER_TEMPLATES: Record<DayPosterTemplateKey, DayPosterTemplate> = {
  'one-photo': { key: 'one-photo', name: 'One photo', line: 'Main photo only · a big photo, names below.', min: 0, max: 0, rolls: false, styles: ['photo', 'canvas'], minSize: null },
  collage: { key: 'collage', name: 'Collage', line: '1 main + 4 to 16 · the layout adjusts to the count.', min: 4, max: 16, rolls: true, styles: ['photo'], minSize: null },
  'film-strip': { key: 'film-strip', name: 'Film strip', line: '1 main + 3 to 8 · a big photo over a film strip.', min: 3, max: 8, rolls: false, styles: ['photo', 'canvas'], minSize: null },
  magazine: { key: 'magazine', name: 'Magazine cover', line: '1 main + 0 to 3 · full photo, a masthead, names over it.', min: 0, max: 3, rolls: false, styles: ['photo', 'canvas'], minSize: null },
  'three-moments': { key: 'three-moments', name: 'Three moments', line: '1 main + 2 · a triptych: three tall photos.', min: 2, max: 2, rolls: false, styles: ['photo', 'canvas'], minSize: null },
  words: { key: 'words', name: 'Words + one photo', line: '1 main + 0 to 2 · your people first, large type.', min: 0, max: 2, rolls: true, styles: ['photo'], minSize: 'a2' },
};

export const DAY_POSTER_TEMPLATE_KEYS: readonly DayPosterTemplateKey[] = ['one-photo', 'collage', 'film-strip', 'magazine', 'three-moments', 'words'];

/** Collage for a photo print, One photo for a canvas (drawing v4, "Approved 13 Nov"). */
export const DEFAULT_DAY_POSTER_TEMPLATE: Record<DayPosterStyle, DayPosterTemplateKey> = { photo: 'collage', canvas: 'one-photo' };

export function isDayPosterTemplateKey(v: unknown): v is DayPosterTemplateKey {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(DAY_POSTER_TEMPLATES, v);
}

const area = (s: DayPosterSize) => s.wMm * s.hMm;

/** May this template be drawn at this size, in its style? */
export function templateFitsSize(t: DayPosterTemplate, size: DayPosterSize): boolean {
  if (!t.styles.includes(size.style)) return false;
  if (!t.minSize) return true;
  return area(size) >= area(DAY_POSTER_SIZES[t.minSize]) - 1;
}

/** The sizes a template may take in a style, in the list's order. */
export function sizesForTemplate(t: DayPosterTemplate, style: DayPosterStyle): DayPosterSize[] {
  return dayPosterSizesFor(style).filter((s) => templateFitsSize(t, s));
}

// ─── What to show ───────────────────────────────────────────────────────────

/** The seven switches (drawing v4 build notes "Templates"). The QR is not one: it is always printed. */
export type DayPosterShow = {
  names: boolean;
  date: boolean;
  place: boolean;
  line: boolean;
  sponsors: boolean;
  entourage: boolean;
  credits: boolean;
};
export const DAY_POSTER_SHOW_KEYS: readonly (keyof DayPosterShow)[] = ['names', 'date', 'place', 'line', 'sponsors', 'entourage', 'credits'];
export const DAY_POSTER_SHOW_LABEL: Record<keyof DayPosterShow, string> = {
  names: 'Your names',
  date: 'The date',
  place: 'The place',
  line: 'Your line',
  sponsors: 'Principal sponsors',
  entourage: 'The entourage',
  credits: 'Supplier credits',
};
/** Supplier credits start OFF; everything else on (approved 13 Nov). */
export const DEFAULT_DAY_POSTER_SHOW: DayPosterShow = { names: true, date: true, place: true, line: true, sponsors: true, entourage: true, credits: false };

/** Switches that mean nothing on this template (no name rolls) — the builder says so instead of offering them. */
export function showKeyApplies(k: keyof DayPosterShow, t: DayPosterTemplate): boolean {
  return k === 'sponsors' || k === 'entourage' ? t.rolls : true;
}

// ─── The saved record ───────────────────────────────────────────────────────

export const DAY_POSTER_LINE_MAX = 160;

/**
 * 🗂 THE BUILDER'S RECORD, saved in `events.print_details.day_poster` beside the Our Story poster's `poster_photo` — the
 * route draws the saved PDF from the SAME record the preview was drawn from. No new table (drawing v4 build notes).
 */
export type DayPoster = {
  template: DayPosterTemplateKey;
  main: PosterPhoto | null;
  /** In order; trimmed to the template's max only when drawn, so switching templates never loses a pick. */
  supporting: PosterPhoto[];
  show: DayPosterShow;
  /** The couple's own line; null = their closing words (`events.special_message`). */
  line: string | null;
  style: DayPosterStyle;
  size: DayPosterSizeId;
  /** The design was stamped final (Finalize) — ISO time; null = a draft. */
  finalizedAt: string | null;
};

export const DEFAULT_DAY_POSTER: DayPoster = {
  template: 'collage',
  main: null,
  supporting: [],
  show: DEFAULT_DAY_POSTER_SHOW,
  line: null,
  style: 'photo',
  size: DAY_POSTER_FREE_SIZE,
  finalizedAt: null,
};

/** The most photos a record carries: 1 main + the largest template's 16. */
export const DAY_POSTER_MAX_SUPPORTING = 16;

function parsePhoto(raw: unknown): PosterPhoto | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.ref !== 'string' || !r.ref.startsWith('r2://') || r.ref.length > 600) return null;
  const px = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 100_000 ? Math.round(v) : null);
  return { ref: r.ref, w: px(r.w), h: px(r.h) };
}

const cleanLine = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim().slice(0, DAY_POSTER_LINE_MAX);
  return s || null;
};

/**
 * Stored (or posted) JSON → the record. Anything unknown is DROPPED, never repaired; a size that does not belong to the
 * style, or a template that cannot take the style, falls back to that style's default — never a mismatched pair.
 */
export function parseDayPoster(raw: unknown): DayPoster {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_DAY_POSTER, show: { ...DEFAULT_DAY_POSTER_SHOW } };
  const r = raw as Record<string, unknown>;
  const style: DayPosterStyle = r.style === 'canvas' ? 'canvas' : 'photo';
  let template: DayPosterTemplateKey = isDayPosterTemplateKey(r.template) ? r.template : DEFAULT_DAY_POSTER_TEMPLATE[style];
  if (!DAY_POSTER_TEMPLATES[template].styles.includes(style)) template = DEFAULT_DAY_POSTER_TEMPLATE[style];
  const t = DAY_POSTER_TEMPLATES[template];
  const fits = sizesForTemplate(t, style);
  const asked = isDayPosterSizeId(r.size) ? DAY_POSTER_SIZES[r.size] : null;
  const size = asked && fits.some((s) => s.id === asked.id) ? asked.id : fits[0]!.id;
  const s = r.show && typeof r.show === 'object' && !Array.isArray(r.show) ? (r.show as Record<string, unknown>) : {};
  const show = Object.fromEntries(DAY_POSTER_SHOW_KEYS.map((k) => [k, typeof s[k] === 'boolean' ? s[k] : DEFAULT_DAY_POSTER_SHOW[k]])) as DayPosterShow;
  const seen = new Set<string>();
  const main = parsePhoto(r.main);
  if (main) seen.add(main.ref);
  const supporting: PosterPhoto[] = [];
  for (const p of Array.isArray(r.supporting) ? r.supporting : []) {
    const ph = parsePhoto(p);
    if (!ph || seen.has(ph.ref)) continue;
    seen.add(ph.ref);
    supporting.push(ph);
    if (supporting.length >= DAY_POSTER_MAX_SUPPORTING) break;
  }
  const fin = typeof r.finalized_at === 'string' && !Number.isNaN(Date.parse(r.finalized_at)) ? r.finalized_at : null;
  return { template, main, supporting, show, line: cleanLine(r.line), style, size, finalizedAt: fin };
}

/** The stored shape (snake_case, like every key of `print_details`). */
export function serializeDayPoster(d: DayPoster): Record<string, unknown> {
  const ph = (p: PosterPhoto) => ({ ref: p.ref, w: p.w, h: p.h });
  return {
    template: d.template,
    main: d.main ? ph(d.main) : null,
    supporting: d.supporting.map(ph),
    show: d.show,
    line: d.line,
    style: d.style,
    size: d.size,
    finalized_at: d.finalizedAt,
  };
}

/** The supporting photos a template draws: the picks in order, up to its max. */
export function drawnSupporting(d: Pick<DayPoster, 'template' | 'supporting'>): PosterPhoto[] {
  return d.supporting.slice(0, DAY_POSTER_TEMPLATES[d.template].max);
}

/**
 * Is the poster ready to save? The main photo is picked and the template has at least its fewest supporting photos.
 * A poster is never saved with an empty photo box. Null = ready; else the plain reason.
 */
export function dayPosterNotReady(d: Pick<DayPoster, 'template' | 'main' | 'supporting'>): string | null {
  const t = DAY_POSTER_TEMPLATES[d.template];
  if (!d.main) return 'Pick your main photo first.';
  if (d.supporting.length < t.min) return `${t.name} needs ${t.min} supporting photo${t.min === 1 ? '' : 's'} — you have ${d.supporting.length}.`;
  return null;
}

/** "5 of 4–16" · "2 of 2" · "None on this template" — the builder's step line. */
export function supportingCountLine(d: Pick<DayPoster, 'template' | 'supporting'>): string {
  const t = DAY_POSTER_TEMPLATES[d.template];
  if (t.max === 0) return 'None on this template';
  const n = Math.min(d.supporting.length, t.max);
  return `${n} of ${t.min === t.max ? t.max : `${t.min}–${t.max}`}`;
}

// ─── The gate ───────────────────────────────────────────────────────────────

/** The look a file is saved in: Classic (free at A4) or the event's own look ("Save in your theme ◆", Event Pro). */
export type DayPosterLook = 'classic' | 'theme';

/** Why a choice cannot be saved — each with its own Problem → Solution in the builder and its own 403 at the route. */
export type DayPosterLock = 'pro-size' | 'pro-canvas' | 'pro-look' | 'kept' | 'store';

/**
 * 🔒 THE ONE RULE (DECISION_LOG 2026-11-13 "CLASSIC SAVES FREE UP TO A4…" + "CRISP PRINTS ONLY UNTIL THE PHOTOS ARE
 * COMPRESSED"), read by the builder, the Prints row and the route alike:
 *   · Classic · photo print · A4 — free for every event, store shell included;
 *   · every larger photo-print size, every canvas, the event's own look — Event Pro;
 *   · in the app-store shell the Pro path is ABSENT (App Review 3.1.1): only the free file;
 *   · after the full-quality date every size above A4 locks, Pro or not — the originals are gone.
 * Null = may be saved.
 */
export function dayPosterLock(input: {
  ownsPro: boolean;
  storeShell: boolean;
  style: DayPosterStyle;
  size: DayPosterSizeId;
  look: DayPosterLook;
  /** True once today is past the full-quality date (`dayPosterFullQualityEnded`). */
  fullQualityEnded: boolean;
}): DayPosterLock | null {
  const free = input.style === 'photo' && input.size === DAY_POSTER_FREE_SIZE && input.look === 'classic';
  if (free) return null;
  if (input.storeShell) return 'store';
  if (input.size !== DAY_POSTER_FREE_SIZE && input.fullQualityEnded) return 'kept';
  if (!input.ownsPro) return input.style === 'canvas' ? 'pro-canvas' : input.look === 'theme' ? 'pro-look' : 'pro-size';
  return null;
}

/** Does this saved file need Event Pro (the gate's question without the date) — the ◆ beside a choice. */
export function dayPosterChoiceIsPro(style: DayPosterStyle, size: DayPosterSizeId, look: DayPosterLook): boolean {
  return !(style === 'photo' && size === DAY_POSTER_FREE_SIZE && look === 'classic');
}

/**
 * Is this file the FLAT one (one raster page at A4 ≈ 200 dpi) or the crisp one (vector type at size)? Flat exactly when
 * the event has no Event Pro — a Pro event's A4 Classic is crisp too ("Pro and paid files are 300 dpi at size").
 */
export function dayPosterFileIsFlat(ownsPro: boolean): boolean {
  return !ownsPro;
}

/**
 * The Problem → Solution words for a lock (drawing v4 §3 and build notes "The gate"). The plan's name is handed in
 * (`paidMarkLabel`), never typed here.
 */
export function dayPosterLockWords(lock: DayPosterLock, plan: string, keptUntil: string | null): { title: string; problem: string; solution: string } {
  switch (lock) {
    case 'pro-size':
      return { title: 'Larger prints come with ' + plan, problem: 'A4 in Classic saves free. Wall sizes need full-size files.', solution: `Get ${plan}, or save A4 free.` };
    case 'pro-canvas':
      return { title: 'Canvas comes with ' + plan, problem: 'A canvas is printed large, with a gallery wrap.', solution: `Get ${plan}, or save A4 free.` };
    case 'pro-look':
      return { title: 'Your theme comes with ' + plan, problem: 'Classic saves free. Your Event Hub look on paper is Pro.', solution: `Get ${plan}, or save Classic free.` };
    case 'kept':
      return {
        title: 'This size would print soft',
        problem: keptUntil ? `Your full-size photos were kept until ${keptUntil}.` : 'Your full-size photos are no longer kept.',
        solution: 'Print A4, or use your own full-size photo.',
      };
    case 'store':
      return { title: 'Not available here', problem: 'Larger sizes and your theme are saved on the web.', solution: 'Save A4 free here.' };
  }
}

/** The route's 403 words — the same lock, in one sentence. */
export function dayPosterRefusal(lock: DayPosterLock, plan: string, keptUntil: string | null): string {
  if (lock === 'store') return 'Not available here.';
  const w = dayPosterLockWords(lock, plan, keptUntil);
  return `${w.title}. ${w.problem}`;
}

// ─── Photos and paper ───────────────────────────────────────────────────────

/**
 * Is this photo too small for the slot it fills at this size? 150 dpi over the slot's long edge is the floor a print
 * shop accepts (`POSTER_PHOTO_MIN_PX` is A3's, at the same 150 dpi — this takes the size). Unknown pixels: never warn.
 */
export function photoTooSmallFor(p: PosterPhoto | null | undefined, slotMm: { w: number; h: number }): boolean {
  if (!p || !p.w || !p.h) return false;
  const need = (mm: number) => Math.round((mm / IN) * 150);
  const short = Math.min(p.w, p.h);
  const long = Math.max(p.w, p.h);
  return short < need(Math.min(slotMm.w, slotMm.h)) || long < need(Math.max(slotMm.w, slotMm.h));
}

/** The main photo's share of the sheet, per template — the slot `photoTooSmallFor` measures. */
export function mainSlotMm(t: DayPosterTemplateKey, size: DayPosterSize): { w: number; h: number } {
  const f: Record<DayPosterTemplateKey, [number, number]> = {
    'one-photo': [0.86, 0.62],
    collage: [0.66, 0.32],
    'film-strip': [0.86, 0.42],
    magazine: [1, 1],
    'three-moments': [0.3, 0.6],
    words: [0.42, 0.24],
  };
  const [fw, fh] = f[t];
  return { w: size.wMm * fw, h: size.hMm * fh };
}

/**
 * A choice's preview address (`v`) — 16 hex, the shape `previewCacheControl` caches `immutable` (`printInputsVersion`'s
 * pattern: each change is a new address). Two FNV-1a passes over the record's stored shape and `salt` — the event's
 * own `printInputsVersion`, so a renamed sponsor is a new picture too. Stable across runs.
 */
export function dayPosterHash(d: DayPoster, salt = ''): string {
  const s = `${salt}|${JSON.stringify(serializeDayPoster({ ...d, finalizedAt: null }))}`;
  const pass = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  };
  return pass(0x811c9dc5) + pass(0x9e3779b9);
}

/** The poster's one address — the shipped print route (`app/api/hub-print/[piece]/route.ts`). */
export const DAY_POSTER_ROUTE = `/api/hub-print/${DAY_POSTER_KEY}`;

/**
 * The address of a day poster file: `mode=screen` the preview picture, `mode=print` the saved PDF. `base` is the route —
 * the shipped one always, except the dev lab's sample-data stand-in (`app/dev/day-poster-lab`).
 */
export function dayPosterHref(eventId: string, mode: 'screen' | 'print', look: DayPosterLook, extra = '', base: string = DAY_POSTER_ROUTE): string {
  return `${base}?event=${eventId}&mode=${mode}&look=${look}${extra}`;
}

// ─── The full-quality date ──────────────────────────────────────────────────

/**
 * 📅 "PRINT IN FULL QUALITY UNTIL <date>" (DECISION_LOG 2026-11-13 "CRISP PRINTS ONLY UNTIL THE PHOTOS ARE COMPRESSED").
 * The SAME clock the "Keep your photos" screen reads (`fullSizeKeptUntil`, lib/papic-originals-reminder-core.ts):
 * `FULL_RES_POST_EVENT_GRACE_DAYS` after the event's last day (`eventLastDay`: the end date, else the date). `until` is
 * the last day the originals are kept, as the couple reads it; `ended` once that day has passed. No date → no clock.
 */
export function dayPosterFullQuality(
  eventDate: string | null | undefined,
  eventEndDate: string | null | undefined,
  nowMs: number,
): { until: string | null; ended: boolean } {
  const last = eventLastDay(eventDate, eventEndDate);
  if (!last) return { until: null, ended: false };
  const open = fullSizeKeptUntil(eventDate, eventEndDate, nowMs);
  if (open) return { until: open.label, ended: false };
  const day = addDays(originalsKeptUntil(last), -1);
  const label = new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${day}T00:00:00Z`));
  return { until: label, ended: true };
}
