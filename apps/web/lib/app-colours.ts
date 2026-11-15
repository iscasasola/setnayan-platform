/**
 * 🎨 THE APP'S COLOURS, BY JOB — Admin › Colours, wave 1 (owner approved the prototype 12 Nov 2026: corpus
 * `Design_App_Colours_2026-11-12/app-colours-admin.html`, element map in `…/map/README.md`; DECISION_LOG 2026-11-12).
 *
 * Pure. No I/O, no React, no `server-only`: the admin editor (client), the save action (server) and the root layout
 * all read the SAME rules from here, so what the editor calls readable is exactly what the server will save.
 *
 * ─── THE JOBS ───────────────────────────────────────────────────────────────────────────────────────────────────
 *   page        behind every screen                              → `--sn-page-bg`
 *   band        the coloured sweep at the top (from → to, angle) → `--sn-band-from/-to/-angle`, `--sn-on-band`  (wave 4)
 *   frame       the white card every section sits in             → `--sn-frame-bg/-radius/-shadow`                (wave 2)
 *   money       Pay · Confirm · Hold the price                   → `--color-ok`
 *   decision    the forward step — Next, Start, Add, Publish     → `--sn-decision` (+ `-600` hover, `-word`, `--sn-on-decision`)
 *   private     the 🔒 couple-only note                          → `--color-private`, `-text`, `-tint`
 *   toggle      a switch that is on, a picked pill               → `--sn-accent`, `--sn-on-accent`
 *   tiles       the four category colours                        → `--sn-cat-*`                                  (wave 6)
 *
 * 🔒 DEFAULTS ARE TODAY'S EXACT VALUES. `APP_COLOURS_DEFAULT` is the "Current" mood; an unset database (NULL) or a
 * saved set equal to it emits NO stylesheet at all (`appColoursToCss` → ''), so nothing moves until the owner saves.
 *
 * ─── THE GATES (the prototype's, ported line for line) ──────────────────────────────────────────────────────────
 *   · WCAG 2 contrast: a button's white label on its fill ≥ 4.5; its word on the 9% outlined wash ≥ 4.5; its icon
 *     circle on a white chip ≥ 3; words on the page and in a frame ≥ 4.5; a toggle's knob ≥ 3 and a picked pill's
 *     words ≥ 4.5; the private strip's words on its wash ≥ 4.5 and its outline on the frame ≥ 3; each tile glyph on
 *     its 12% tint ≥ 3.
 *   · THE BAND IS MEASURED AT ITS LIGHTEST POINT. CSS blends the two stops in sRGB; we sample the blend at 21 points
 *     and test WHITE words against the lightest one — text that passes there passes everywhere. The band's words are
 *     always white (owner rule 12 Nov: "a pale band stop is darkened until white words read"; the band's buttons are
 *     white chips), so a pale stop is refused and the one-tap fix darkens it.
 *   · TWO BUTTON KINDS THAT LOOK ALIKE REFUSE SAVE. Money, decision and the private Send are all filled buttons in a
 *     frame; if two of them sit closer than `LOOK_ALIKE_DELTA_E` (CIE76 ΔE*ab, `lib/color-space.ts`), people cannot
 *     tell "pay" from "next", so the set is refused. Toggle "on" is not a button: a toggle that matches a button is a
 *     warning, never a refusal ("Current" deliberately has toggle = decision).
 *   · Soft checks (the frame showing against the band) warn; they never refuse.
 */
import { labDistance, labOfHex } from '@/lib/color-space';

// ─── the shape ──────────────────────────────────────────────────────────────────────────────────────────────────

export const BAND_ANGLES = ['135deg', '90deg', '180deg', '160deg', '45deg'] as const;
export type BandAngle = (typeof BAND_ANGLES)[number];
export const BAND_ANGLE_LABEL: Record<BandAngle, string> = {
  '135deg': 'Top-left to bottom-right',
  '90deg': 'Left to right',
  '180deg': 'Top to bottom',
  '160deg': 'Steep',
  '45deg': 'Bottom-left to top-right',
};

export const FRAME_LIFTS = ['none', 'soft', 'medium', 'strong'] as const;
export type FrameLift = (typeof FRAME_LIFTS)[number];
export const FRAME_LIFT_LABEL: Record<FrameLift, string> = {
  none: 'None (a line instead)',
  soft: 'Soft',
  medium: 'Medium',
  strong: 'Strong',
};
/** The frame's lift, as a box-shadow (the prototype's `.pv[data-sh]` steps). `none` draws a line instead (wave 2). */
export const FRAME_LIFT_SHADOW: Record<FrameLift, string> = {
  none: 'none',
  soft: '0 1px 2px rgb(44 42 41 / 0.04), 0 8px 20px -14px rgb(44 42 41 / 0.25)',
  medium: '0 2px 4px rgb(44 42 41 / 0.04), 0 14px 34px -14px rgb(44 42 41 / 0.32)',
  strong: '0 2px 6px rgb(44 42 41 / 0.06), 0 22px 48px -16px rgb(44 42 41 / 0.4)',
};
export const FRAME_RADIUS_MIN = 8;
export const FRAME_RADIUS_MAX = 28;

export const TILE_KEYS = ['booked', 'schedule', 'asked', 'collect'] as const;
export type TileKey = (typeof TILE_KEYS)[number];
export const TILE_LABEL: Record<TileKey, string> = {
  booked: 'Booked',
  schedule: 'Schedules',
  asked: 'Asked',
  collect: 'To collect',
};

export const TOUCH_KEYS = ['wave', 'overlap', 'press'] as const;
export type TouchKey = (typeof TOUCH_KEYS)[number];

export type AppColours = {
  page: string;
  bandFrom: string;
  bandTo: string;
  bandAngle: BandAngle;
  frameFill: string;
  frameRadius: number;
  frameLift: FrameLift;
  money: string;
  decision: string;
  private: string;
  toggle: string;
  tiles: Record<TileKey, string>;
  /** "Liveliness, beyond colour" — saved now, drawn by the band/frame waves. */
  touches: Record<TouchKey, boolean>;
};

/** The colour keys a picker edits (tiles are addressed as `tiles.<key>`). */
export type ColourKey = 'page' | 'bandFrom' | 'bandTo' | 'frameFill' | 'money' | 'decision' | 'private' | 'toggle';

/** TODAY'S EXACT VALUES — the "Current" mood. Every one is a value globals.css paints now. */
export const APP_COLOURS_DEFAULT: AppColours = Object.freeze({
  page: '#FFFFFF', // --sn-page-bg 255 255 255
  bandFrom: '#C24E25', // --color-mulberry, flat
  bandTo: '#C24E25',
  bandAngle: '135deg',
  frameFill: '#FFFFFF', // --m-paper
  frameRadius: 14, // --m-r-md
  frameLift: 'none', // .sn-tile today: a line, not a float
  money: '#2B744A', // --color-ok 43 116 74
  decision: '#C24E25', // --color-mulberry 194 78 37
  private: '#0284C7', // --color-private 2 132 199
  toggle: '#C24E25', // --sn-accent = --color-mulberry
  tiles: Object.freeze({ booked: '#166B4A', schedule: '#2F6DB5', asked: '#C9471A', collect: '#A2457E' }),
  touches: Object.freeze({ wave: false, overlap: false, press: false }),
}) as AppColours;

/** The shipped private words + wash (globals.css) — what the one private colour derives to while it is the default. */
const PRIVATE_DEFAULT_TEXT = '#0369A1';
const PRIVATE_DEFAULT_TINT = '#E0F2FE';
/** The shipped decision hover + outlined word (`--color-mulberry-600/-700`). */
const DECISION_DEFAULT_HOVER = '#B04722';
const DECISION_DEFAULT_WORD = '#9D3F1E';

export type Mood = { id: 'current' | 'sunrise' | 'ocean' | 'dusk'; name: string; why: string; colours: AppColours };

const BASE = {
  page: '#FFFFFF',
  frameFill: '#FFFFFF',
  private: '#0284C7',
  tiles: APP_COLOURS_DEFAULT.tiles,
} as const;
const LIVELY = { wave: true, overlap: true, press: true } as const;

/** The four moods — hex for hex from the prototype's PRESETS. */
export const MOODS: readonly Mood[] = [
  {
    id: 'current',
    name: 'Current',
    why: 'The app today: white page, white cards with a line, flat terracotta band, toggle “on” the same terracotta as the decision button.',
    colours: APP_COLOURS_DEFAULT,
  },
  {
    id: 'sunrise',
    name: 'Sunrise',
    why: 'Coral into amber. Warm and celebratory; green money, terracotta next step, plum for what is on.',
    colours: { ...BASE, bandFrom: '#CC3D1C', bandTo: '#9E5E08', bandAngle: '135deg', frameRadius: 20, frameLift: 'medium', money: '#1F7A4A', decision: '#C2491F', toggle: '#8E2C5E', tiles: { ...BASE.tiles }, touches: { ...LIVELY } },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    why: 'Cyan into deep blue. Fresh and clear; emerald money, coral next step, violet for what is on.',
    colours: { ...BASE, bandFrom: '#0A72B5', bandTo: '#1E3A9E', bandAngle: '135deg', frameRadius: 20, frameLift: 'medium', money: '#1B7A5A', decision: '#C9471A', toggle: '#6B3FA0', tiles: { ...BASE.tiles }, touches: { ...LIVELY } },
  },
  {
    id: 'dusk',
    name: 'Dusk',
    why: 'Blue into violet. Evening and a little dressy; green money, violet next step, terracotta for what is on.',
    colours: { ...BASE, bandFrom: '#2F4FB8', bandTo: '#6B3FA0', bandAngle: '135deg', frameRadius: 22, frameLift: 'strong', money: '#1F7A4A', decision: '#6B3FA0', toggle: '#C9471A', tiles: { ...BASE.tiles }, touches: { ...LIVELY } },
  },
];

// ─── reading a stored value ─────────────────────────────────────────────────────────────────────────────────────

const HEX = /^#?([0-9a-f]{6})$/i;

/** `#rrggbb` (or `rrggbb`) → `#RRGGBB`; anything else → null. */
export function normaliseHex(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const m = HEX.exec(raw.trim());
  return m ? `#${m[1]!.toUpperCase()}` : null;
}

function rec(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

/**
 * Whatever the database holds → a whole `AppColours`, failing toward the default FIELD BY FIELD: one bad hex costs
 * that one job its colour, never the whole set. NULL / not an object → the defaults.
 */
export function parseAppColours(raw: unknown): AppColours {
  const r = rec(raw);
  const d = APP_COLOURS_DEFAULT;
  const hex = (v: unknown, fallback: string) => normaliseHex(v) ?? fallback;
  const tiles = rec(r.tiles);
  const touches = rec(r.touches);
  const radius = typeof r.frameRadius === 'number' ? r.frameRadius : Number.NaN;
  return {
    page: hex(r.page, d.page),
    bandFrom: hex(r.bandFrom, d.bandFrom),
    bandTo: hex(r.bandTo, d.bandTo),
    bandAngle: (BAND_ANGLES as readonly unknown[]).includes(r.bandAngle) ? (r.bandAngle as BandAngle) : d.bandAngle,
    frameFill: hex(r.frameFill, d.frameFill),
    frameRadius:
      Number.isInteger(radius) && radius >= FRAME_RADIUS_MIN && radius <= FRAME_RADIUS_MAX ? radius : d.frameRadius,
    frameLift: (FRAME_LIFTS as readonly unknown[]).includes(r.frameLift) ? (r.frameLift as FrameLift) : d.frameLift,
    money: hex(r.money, d.money),
    decision: hex(r.decision, d.decision),
    private: hex(r.private, d.private),
    toggle: hex(r.toggle, d.toggle),
    tiles: {
      booked: hex(tiles.booked, d.tiles.booked),
      schedule: hex(tiles.schedule, d.tiles.schedule),
      asked: hex(tiles.asked, d.tiles.asked),
      collect: hex(tiles.collect, d.tiles.collect),
    },
    touches: {
      wave: typeof touches.wave === 'boolean' ? touches.wave : d.touches.wave,
      overlap: typeof touches.overlap === 'boolean' ? touches.overlap : d.touches.overlap,
      press: typeof touches.press === 'boolean' ? touches.press : d.touches.press,
    },
  };
}

/**
 * The fields of a SUBMITTED set that are missing or malformed — the writer refuses rather than quietly defaulting
 * them (a read fails soft; a write says what is wrong). Empty = every field is well formed.
 */
export function invalidAppColourFields(raw: unknown): string[] {
  const r = rec(raw);
  const bad: string[] = [];
  for (const k of ['page', 'bandFrom', 'bandTo', 'frameFill', 'money', 'decision', 'private', 'toggle'] as const) {
    if (!normaliseHex(r[k])) bad.push(k);
  }
  if (!(BAND_ANGLES as readonly unknown[]).includes(r.bandAngle)) bad.push('bandAngle');
  const radius = r.frameRadius;
  if (!(typeof radius === 'number' && Number.isInteger(radius) && radius >= FRAME_RADIUS_MIN && radius <= FRAME_RADIUS_MAX)) bad.push('frameRadius');
  if (!(FRAME_LIFTS as readonly unknown[]).includes(r.frameLift)) bad.push('frameLift');
  const tiles = rec(r.tiles);
  for (const k of TILE_KEYS) if (!normaliseHex(tiles[k])) bad.push(`tiles.${k}`);
  const touches = rec(r.touches);
  for (const k of TOUCH_KEYS) if (typeof touches[k] !== 'boolean') bad.push(`touches.${k}`);
  return bad;
}

/** A stable string of a set — key order fixed by `parseAppColours`, so two equal sets compare equal. */
export function appColoursKey(c: AppColours): string {
  return JSON.stringify(parseAppColours(c));
}

export function appColoursEqual(a: AppColours, b: AppColours): boolean {
  return appColoursKey(a) === appColoursKey(b);
}

export function isDefaultAppColours(c: AppColours): boolean {
  return appColoursEqual(c, APP_COLOURS_DEFAULT);
}

// ─── colour maths (WCAG 2 relative luminance, sRGB mixing — the prototype's) ────────────────────────────────────

type Rgb = [number, number, number];
const WHITE = '#FFFFFF';
const BLACK = '#000000';
/** `--color-ink` #2C2A29 — the words on a page or in a frame. */
export const INK = '#2C2A29';

function rgbOf(hex: string): Rgb {
  const n = parseInt((normaliseHex(hex) ?? WHITE).slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hexOf([r, g, b]: Rgb): string {
  return `#${[r, g, b]
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}
function luminance(hex: string): number {
  const f = (c: number) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgbOf(hex);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** WCAG 2 contrast ratio, 1…21 (unrounded). #C24E25 on white → 4.757…; #2B744A on white → 5.68…. */
export function wcagRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The ratio as the page prints it — two decimals, like the prototype. */
export function shownRatio(r: number): number {
  return Math.round(r * 100) / 100;
}

/** `a` → `b` by `t` (0…1) in sRGB — what a CSS gradient paints. */
export function mixHex(a: string, b: string, t: number): string {
  const A = rgbOf(a);
  const B = rgbOf(b);
  return hexOf([0, 1, 2].map((i) => A[i]! * (1 - t) + B[i]! * t) as Rgb);
}
/** `c` laid at `p` over white — the 9% / 12% washes. */
export function tintOf(c: string, p: number): string {
  return mixHex(WHITE, c, p);
}

/** The lightest of 21 samples along the band's blend — where white words are hardest to read. */
export function lightestPoint(a: string, b: string): string {
  let best = a;
  let bl = -1;
  for (let i = 0; i <= 20; i++) {
    const c = mixHex(a, b, i / 20);
    const l = luminance(c);
    if (l > bl) {
      bl = l;
      best = c;
    }
  }
  return best;
}

/** Walk `start` toward `toward` in 2% steps; the first shade every test accepts (or `toward` itself). */
export function nearestShade(start: string, tests: ReadonlyArray<(c: string) => boolean>, toward = BLACK): string {
  for (let i = 0; i <= 50; i++) {
    const c = mixHex(start, toward, i * 0.02);
    if (tests.every((t) => t(c))) return c;
  }
  return normaliseHex(toward) ?? toward;
}

/** The colours a job DERIVES from its one picked colour (the prototype's `derive`). */
export const derive = {
  /** The decision button's outlined word, readable on its own 9% wash. Default → the shipped #9D3F1E. */
  decisionWord(c: string): string {
    if (normaliseHex(c) === APP_COLOURS_DEFAULT.decision) return DECISION_DEFAULT_WORD;
    return nearestShade(mixHex(c, BLACK, 0.19), [(x) => wcagRatio(x, tintOf(c, 0.09)) >= 4.5]);
  },
  /** The decision button's hover — the same step `--color-mulberry-600` takes. Default → the shipped #B04722. */
  decisionHover(c: string): string {
    if (normaliseHex(c) === APP_COLOURS_DEFAULT.decision) return DECISION_DEFAULT_HOVER;
    return mixHex(c, BLACK, 0.093);
  },
  /** The private strip's words. Default → the shipped #0369A1. */
  privateText(c: string): string {
    if (normaliseHex(c) === APP_COLOURS_DEFAULT.private) return PRIVATE_DEFAULT_TEXT;
    return nearestShade(mixHex(c, BLACK, 0.22), [
      (x) => wcagRatio(x, tintOf(c, 0.12)) >= 4.5,
      (x) => wcagRatio(x, WHITE) >= 4.5,
    ]);
  },
  /** The private bubble's wash. Default → the shipped #E0F2FE. */
  privateTint(c: string): string {
    if (normaliseHex(c) === APP_COLOURS_DEFAULT.private) return PRIVATE_DEFAULT_TINT;
    return tintOf(c, 0.12);
  },
};

// ─── the checks ─────────────────────────────────────────────────────────────────────────────────────────────────

export type JobKey = 'page' | 'band' | 'frame' | 'money' | 'decision' | 'private' | 'toggle' | 'tiles';

export const JOB_NAME: Record<JobKey, string> = {
  page: 'Page background',
  band: 'Header band',
  frame: 'Frame',
  money: 'Money button',
  decision: 'Decision button',
  private: 'Private chat',
  toggle: 'Toggle “on”',
  tiles: 'Icon tiles',
};

/** A set of field changes a "Use …" tap applies. */
export type ColourFix = Partial<Omit<AppColours, 'tiles' | 'touches'>> & { tiles?: Partial<Record<TileKey, string>> };

export type ColourCheck = {
  job: JobKey;
  label: string;
  /** Unrounded WCAG ratio. */
  ratio: number;
  need: number;
  pass: boolean;
  /** A soft check warns; it never refuses Save. */
  soft: boolean;
  /** The nearest readable shade, when it fails. */
  fix: ColourFix | null;
};

function check(job: JobKey, label: string, ratio: number, need: number, fix: () => ColourFix, soft = false): ColourCheck {
  const pass = ratio >= need;
  return { job, label, ratio, need, pass, soft, fix: pass ? null : fix() };
}

/** Every readability check of one set, in the prototype's order. */
export function readabilityChecks(c: AppColours): ColourCheck[] {
  const out: ColourCheck[] = [];
  // Page
  out.push(check('page', 'Words on the page', wcagRatio(INK, c.page), 4.5, () => ({ page: nearestShade(c.page, [(x) => wcagRatio(INK, x) >= 4.5], WHITE) })));
  // Band — white words at the lightest point
  const L = lightestPoint(c.bandFrom, c.bandTo);
  const bandR = wcagRatio(WHITE, L);
  const fixBand = (): ColourFix => {
    const t = (x: string) => wcagRatio(WHITE, x) >= 4.5;
    return { bandFrom: nearestShade(c.bandFrom, [t]), bandTo: nearestShade(c.bandTo, [t]) };
  };
  out.push(check('band', 'Small words on the band (lightest point)', bandR, 4.5, fixBand));
  out.push(check('band', 'Big number on the band (≥24px bold)', bandR, 3, fixBand));
  // Frame
  out.push(check('frame', 'Words on the frame', wcagRatio(INK, c.frameFill), 4.5, () => ({ frameFill: nearestShade(c.frameFill, [(x) => wcagRatio(INK, x) >= 4.5], WHITE) })));
  out.push(check('frame', 'Frame shows against the band', wcagRatio(c.frameFill, L), 1.5, () => ({ frameFill: WHITE }), true));
  // Money
  const moneyFix = (): ColourFix => ({ money: nearestShade(c.money, [(x) => wcagRatio(WHITE, x) >= 4.5, (x) => wcagRatio(x, tintOf(x, 0.09)) >= 4.5]) });
  out.push(check('money', 'White words on it', wcagRatio(WHITE, c.money), 4.5, moneyFix));
  out.push(check('money', 'Its word on the outlined button', wcagRatio(c.money, tintOf(c.money, 0.09)), 4.5, moneyFix));
  out.push(check('money', 'Icon circle on a white chip', wcagRatio(c.money, WHITE), 3, () => ({ money: nearestShade(c.money, [(x) => wcagRatio(x, WHITE) >= 3]) })));
  // Decision
  out.push(check('decision', 'White words on it', wcagRatio(WHITE, c.decision), 4.5, () => ({ decision: nearestShade(c.decision, [(x) => wcagRatio(WHITE, x) >= 4.5]) })));
  out.push(
    check('decision', 'Its word on the outlined button', wcagRatio(derive.decisionWord(c.decision), tintOf(c.decision, 0.09)), 4.5, () => ({
      decision: nearestShade(c.decision, [(x) => wcagRatio(derive.decisionWord(x), tintOf(x, 0.09)) >= 4.5]),
    })),
  );
  out.push(check('decision', 'Icon circle on a white chip', wcagRatio(c.decision, WHITE), 3, () => ({ decision: nearestShade(c.decision, [(x) => wcagRatio(x, WHITE) >= 3]) })));
  // Private
  out.push(
    check('private', 'Strip words on the wash', wcagRatio(derive.privateText(c.private), derive.privateTint(c.private)), 4.5, () => ({
      private: nearestShade(c.private, [(x) => wcagRatio(derive.privateText(x), derive.privateTint(x)) >= 4.5]),
    })),
  );
  out.push(check('private', 'Box outline on the frame', wcagRatio(c.private, c.frameFill), 3, () => ({ private: nearestShade(c.private, [(x) => wcagRatio(x, c.frameFill) >= 3]) })));
  // Toggle
  const toggleFix = (): ColourFix => ({ toggle: nearestShade(c.toggle, [(x) => wcagRatio(WHITE, x) >= 4.5]) });
  out.push(check('toggle', 'White knob on the track', wcagRatio(WHITE, c.toggle), 3, toggleFix));
  out.push(check('toggle', 'White words on a picked pill', wcagRatio(WHITE, c.toggle), 4.5, toggleFix));
  // Tiles
  for (const k of TILE_KEYS) {
    const t = c.tiles[k];
    out.push(check('tiles', `${TILE_LABEL[k]} glyph on its tint`, wcagRatio(t, tintOf(t, 0.12)), 3, () => ({ tiles: { [k]: nearestShade(t, [(x) => wcagRatio(x, tintOf(x, 0.12)) >= 3]) } })));
  }
  return out;
}

// ─── look-alikes ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Two kinds closer than this (CIE76 ΔE*ab, `labDistance`) "look the same". ~2.3 is a just-noticeable difference;
 * 20 is "the same colour family at a glance" — #C24E25 vs #C9471A (two terracottas) measure ≈ 7.5, the money green
 * #2B744A vs Sunrise's #1F7A4A ≈ 5.7, terracotta vs the money green ≈ 83, private blue vs Dusk's violet ≈ 47.5. The prototype used a raw RGB distance of 40, which treats a lightness step and a hue step alike;
 * Lab measures what a person sees.
 */
export const LOOK_ALIKE_DELTA_E = 20;

export type LookKind = 'money' | 'decision' | 'private' | 'toggle';
export const LOOK_KIND_NAME: Record<LookKind, string> = {
  money: 'the money button',
  decision: 'the decision button',
  private: 'private chat',
  toggle: 'toggle “on”',
};
/** The filled BUTTON kinds — two of these alike refuses Save. */
export const BUTTON_KINDS: readonly LookKind[] = ['money', 'decision', 'private'];

export type LookAlike = { a: LookKind; b: LookKind; deltaE: number; refuses: boolean };

export function deltaE(a: string, b: string): number {
  return labDistance(labOfHex(normaliseHex(a) ?? WHITE), labOfHex(normaliseHex(b) ?? WHITE));
}

/** Every pair among money · decision · private · toggle closer than `LOOK_ALIKE_DELTA_E`. */
export function lookAlikes(c: AppColours): LookAlike[] {
  const kinds: LookKind[] = ['money', 'decision', 'private', 'toggle'];
  const out: LookAlike[] = [];
  for (let i = 0; i < kinds.length; i++) {
    for (let j = i + 1; j < kinds.length; j++) {
      const a = kinds[i]!;
      const b = kinds[j]!;
      const d = deltaE(c[a], c[b]);
      if (d < LOOK_ALIKE_DELTA_E) out.push({ a, b, deltaE: d, refuses: BUTTON_KINDS.includes(a) && BUTTON_KINDS.includes(b) });
    }
  }
  return out;
}

// ─── the gate ───────────────────────────────────────────────────────────────────────────────────────────────────

export type ColoursVerdict = {
  checks: ColourCheck[];
  lookAlikes: LookAlike[];
  /** Why Save is refused, first reason first; empty = it may save. */
  refusals: string[];
};

export function refusalOfCheck(ch: ColourCheck): string {
  return `${JOB_NAME[ch.job]}: ${ch.label.toLowerCase()} reads at ${shownRatio(ch.ratio)}:1 and needs ${ch.need}:1.`;
}
export function refusalOfLookAlike(l: LookAlike): string {
  const name = (k: LookKind) => LOOK_KIND_NAME[k].replace(/^the /, '');
  return `${name(l.a)[0]!.toUpperCase()}${name(l.a).slice(1)} and ${name(l.b)} look the same (ΔE ${Math.round(l.deltaE)}, needs ${LOOK_ALIKE_DELTA_E}) — people will not tell them apart.`;
}

/** The one gate the editor shows and the server enforces. */
export function judgeAppColours(c: AppColours): ColoursVerdict {
  const checks = readabilityChecks(c);
  const alike = lookAlikes(c);
  const refusals = [
    ...checks.filter((ch) => !ch.pass && !ch.soft).map(refusalOfCheck),
    ...alike.filter((l) => l.refuses).map(refusalOfLookAlike),
  ];
  return { checks, lookAlikes: alike, refusals };
}

/** Apply a "Use …" fix to a set. */
export function applyFix(c: AppColours, fix: ColourFix): AppColours {
  const { tiles, ...rest } = fix;
  return { ...c, ...rest, tiles: { ...c.tiles, ...(tiles ?? {}) }, touches: { ...c.touches } };
}

// ─── the stylesheet ─────────────────────────────────────────────────────────────────────────────────────────────

/** `#rrggbb` → the `r g b` triple every colour token holds. */
export function tripleOf(hex: string): string {
  return rgbOf(hex).join(' ');
}

/** The token values a set paints, light mode. */
export function appColourTokens(c: AppColours): Record<string, string> {
  return {
    '--sn-page-bg': tripleOf(c.page),
    '--sn-band-from': tripleOf(c.bandFrom),
    '--sn-band-to': tripleOf(c.bandTo),
    '--sn-band-angle': c.bandAngle,
    '--sn-on-band': tripleOf(WHITE),
    '--sn-frame-bg': tripleOf(c.frameFill),
    '--sn-frame-radius': `${c.frameRadius}px`,
    '--sn-frame-shadow': FRAME_LIFT_SHADOW[c.frameLift],
    '--color-ok': tripleOf(c.money),
    '--sn-decision': tripleOf(c.decision),
    '--sn-decision-600': tripleOf(derive.decisionHover(c.decision)),
    '--sn-decision-word': tripleOf(derive.decisionWord(c.decision)),
    '--sn-on-decision': tripleOf(WHITE),
    '--sn-accent': tripleOf(c.toggle),
    '--sn-on-accent': tripleOf(WHITE),
    '--color-private': tripleOf(c.private),
    '--color-private-text': tripleOf(derive.privateText(c.private)),
    '--color-private-tint': tripleOf(derive.privateTint(c.private)),
    '--sn-cat-booked': tripleOf(c.tiles.booked),
    '--sn-cat-schedule': tripleOf(c.tiles.schedule),
    '--sn-cat-asked': tripleOf(c.tiles.asked),
    '--sn-cat-collect': tripleOf(c.tiles.collect),
  };
}

/**
 * The decision tokens are UNSET in globals.css on purpose: every consumer reads them with a fallback to what it read
 * before (`var(--sn-decision, var(--color-mulberry))`), because a Pro hub theme re-points `--color-mulberry` on its
 * own scope and a `:root` alias would freeze it to the house terracotta. Inside a guest island they are reset to
 * `initial` (guaranteed-invalid), which hands every consumer back its fallback.
 */
const UNSET_BY_DEFAULT = new Set(['--sn-decision', '--sn-decision-600', '--sn-decision-word', '--sn-on-decision']);

/**
 * The guest islands — the Event Hub's wrapper (`.sn-editorial`, worn on every page of `app/[slug]` by
 * `GuestLookScope`) and the pieces of a guest page drawn inside a dashboard. They wear the couple's colours, never the
 * admin's: the stylesheet puts the code defaults back inside them at ZERO specificity (`:where`), so any theme rule
 * or inline var still wins exactly as it did before.
 */
export const GUEST_ISLANDS = ['.sn-editorial', '[data-look-sample]', '[data-hub-theme]', '[data-art]'] as const;

/**
 * The `<style id="sn-app-colours">` body for a saved set, or '' when it is the default (no tag at all).
 *
 *   html:not(.dark) { …the set… }                       light only — dark keeps its own block untouched
 *   :where(html:not(.dark) .sn-editorial, …) { …defaults… }  the guest Event Hub keeps today's values
 *   html:not(.dark) body:has(.sn-editorial) { --sn-page-bg: default }  …and its page ground
 *
 * `html:not(.dark)` (0,1,1) out-ranks globals.css `:root` (0,1,0), and the tag sits after the stylesheet.
 */
export function appColoursToCss(input: AppColours): string {
  const c = parseAppColours(input);
  if (isDefaultAppColours(c)) return '';
  const set = appColourTokens(c);
  const back = appColourTokens(APP_COLOURS_DEFAULT);
  const decl = (o: Record<string, string>, reset: boolean) =>
    Object.entries(o)
      .map(([k, v]) => `${k}:${reset && UNSET_BY_DEFAULT.has(k) ? 'initial' : v}`)
      .join(';');
  const islands = GUEST_ISLANDS.map((s) => `html:not(.dark) ${s}`).join(',');
  return (
    `html:not(.dark){${decl(set, false)}}` +
    `:where(${islands}){${decl(back, true)}}` +
    `html:not(.dark) body:has(.sn-editorial){--sn-page-bg:${back['--sn-page-bg']}}`
  );
}
