/**
 * apps/web/lib/element-style.ts
 *
 * ONE ELEMENT'S OWN LOOK — font · colour · size · animation, per element.
 *
 * Owner, 2026-09-26: *"they can set universal font across the website. but if
 * they press an element in the scene, then that font will be bypassed just like
 * on keynote, word, pages"* · *"tapping element, changes fonts, color, size,
 * animation"*. 2026-09-27: *"we want the font color size and animation. that is
 * the point we want to edit the event hub."*
 *
 * So the theme (or the couple's one Event Hub font) dresses every scene, and an
 * element the couple tapped may carry its OWN choice, which wins for that
 * element only. Every choice has a reset ("↺ use the Event Hub font", "↺ use the
 * theme colour"), and a reset is an ABSENCE — the same "Auto is an absence"
 * rule `lib/hub-canvas.ts` states at its top: storing the theme's value would
 * freeze today's theme into the couple's page.
 *
 * ── WHERE IT LIVES ─────────────────────────────────────────────────────────
 * `invitation_widgets.config_json.canvas.elements` — the scene's EXISTING
 * canvas (`HubSectionCanvas.elements`), for the hero on the hero row. No table,
 * no column, no migration. Drafted like every other canvas key, and Pro at
 * Apply like every other look key (`canvasLookChange` in `lib/hub-draft.ts`).
 *
 * ── WHICH ELEMENTS (v1) ────────────────────────────────────────────────────
 * The hero's six parts (the invitation card: eyebrow · mark · names · the
 * "invite you to…" line · date · time) and, in every other scene, its label,
 * heading and words. ⛔ The RSVP form is NOT element-editable — it stays the
 * standard form (DECISION_LOG 2026-09-27, "the RSVP form stays standard").
 *
 * 🔑 THE SCENE PARTS ARE FOUND BY ONE SELECTOR, NOT BY MARKING WIDGETS.
 * `every-widget-is-one-section.test.ts` holds that widgets stay ignorant of the
 * canvas, so no widget carries an element key. The SAME selector list below is
 * what the Maker canvas stamps `data-el` on (`editor-bridge.tsx`) and what the
 * guest page's scoped style targets (`hub-canvas-frame.tsx`) — so the thing the
 * couple tapped is exactly the thing guests see restyled. Two lists would drift.
 *
 * 🔒 EVERY VALUE THAT REACHES CSS IS FROM A CLOSED SET. A font is a key into
 * `HUB_FONTS` (each one proven loaded by `hub-fonts-are-loaded.test.ts`), a
 * colour is six hex digits, a size and an animation are enum members. The
 * guest page writes these into a `<style>` element, so nothing a couple typed
 * can ever become CSS text.
 *
 * Pure. No I/O.
 */

import { HUB_FONT_BY_KEY, hubFontsForPicker, sanitizeHubFontKey, type HubFontKey } from '@/lib/hub-fonts';
import { contrastRatio } from '@/lib/hub-legibility';

/* ── THE ELEMENTS ───────────────────────────────────────────────────────── */

/**
 * 🔗 THE JOINER (owner 2026-09-27, "MAKER TOOLBARS (KEYNOTE + PAGES) APPROVED",
 * answer 2: *"okay"* to "build the Joiner part") — the word between the two
 * names ("and" · "&" · "+" · their own word), a part like any other: its own
 * font · colour · size · motion, and its WORD (`HubElementStyle.word`). Before
 * it, the "and" was made for the couple from the display name and could not be
 * edited. Only on a two-person hero — a solo name has no joiner to draw.
 */
export const HUB_HERO_ELEMENT_KEYS = ['eyebrow', 'mark', 'names', 'joiner', 'line', 'date', 'time'] as const;
export const HUB_SCENE_ELEMENT_KEYS = ['label', 'heading', 'body'] as const;
export const HUB_ELEMENT_KEYS = [...HUB_HERO_ELEMENT_KEYS, ...HUB_SCENE_ELEMENT_KEYS] as const;
export type HubHeroElementKey = (typeof HUB_HERO_ELEMENT_KEYS)[number];
export type HubSceneElementKey = (typeof HUB_SCENE_ELEMENT_KEYS)[number];
export type HubElementKey = (typeof HUB_ELEMENT_KEYS)[number];

export const HUB_ELEMENT_LABEL: Record<HubElementKey, string> = {
  eyebrow: 'Small line on top',
  mark: 'Your mark',
  names: 'Names',
  joiner: 'Joiner',
  line: 'Invitation line',
  date: 'Date',
  time: 'Time',
  label: 'Label',
  heading: 'Heading',
  body: 'Words',
};

export function isHubElementKey(v: unknown): v is HubElementKey {
  return typeof v === 'string' && (HUB_ELEMENT_KEYS as readonly string[]).includes(v);
}

/**
 * THE ONE SELECTOR PER SCENE PART — read by the canvas stamp AND the guest style.
 *
 * Measured on the widgets (`app/[slug]/_components/*-widget.tsx`): a scene's
 * small label is `.pahina-eyebrow`; its heading is an `h1`–`h3` or a template
 * scene's `.hub-tpl-h`; its words are every other paragraph.
 */
export const HUB_SCENE_ELEMENT_SELECTOR: Record<HubSceneElementKey, string> = {
  label: '.pahina-eyebrow',
  heading: 'h1, h2, h3, .hub-tpl-h',
  body: 'p:not(.pahina-eyebrow):not(.hub-tpl-h)',
};

/**
 * The scenes whose parts are NOT tappable. The RSVP form stays the standard
 * form (owner, 2026-09-27) — its labels and questions are a form, not a page.
 */
export const HUB_ELEMENT_EXCLUDED_WIDGETS: readonly string[] = ['rsvp'];

/**
 * What each element can take. The mark is a drawing: it has no font, colour or
 * text of its own here — size, motion and show/hide only (the approved
 * prototype: *"“Your mark” has size and motion only"*).
 *
 * The TEXT tab's Pages-style rows (2026-09-27, `prototypes/maker_toolbars_
 * keynote_pages_2026-09-27.html`, frame B): weight where the face has weights ·
 * B · I · U · alignment · line and letter spacing. The ARRANGE tab's show/hide
 * (`hidden`). The joiner's `word`.
 */
const TEXT_FIELDS = [
  'font',
  'weight',
  'italic',
  'underline',
  'color',
  'size',
  'align',
  'leading',
  'tracking',
  'motion',
  'hidden',
] as const satisfies readonly HubElementField[];
export const HUB_ELEMENT_FIELDS: Record<HubElementKey, readonly HubElementField[]> = {
  eyebrow: TEXT_FIELDS,
  mark: ['size', 'motion', 'hidden'],
  names: TEXT_FIELDS,
  // One word between two lines: no alignment or spacing of its own — it sits
  // where the names put it — but the word itself is the couple's.
  joiner: ['word', 'font', 'weight', 'italic', 'underline', 'color', 'size', 'motion', 'hidden'],
  line: TEXT_FIELDS,
  date: TEXT_FIELDS,
  time: TEXT_FIELDS,
  label: TEXT_FIELDS,
  heading: TEXT_FIELDS,
  body: TEXT_FIELDS,
};

/**
 * ✍ THE ELEMENTS WHOSE TEXT CAN CARRY RUNS (one letter, one word in its own
 * font · colour · size — owner 2026-09-27: *"they can take 1 letter and change
 * the font"*). Only the hero's parts: their words are drawn HERE
 * (`PahinaMasthead`), so the guest page can render the runs as spans, server-
 * side, exactly as the canvas shows them. A scene's label / heading / words are
 * drawn by widgets that must stay ignorant of the canvas
 * (`every-widget-is-one-section.test.ts`), so a run there could not reach a
 * guest — offering it would be a control that moves no guest's pixels.
 */
export const HUB_ELEMENT_RUN_KEYS: readonly HubElementKey[] = ['eyebrow', 'names', 'line', 'date', 'time'];

/* ── THE CHOICES ────────────────────────────────────────────────────────── */

export type HubElementField =
  | 'font'
  | 'color'
  | 'size'
  | 'motion'
  | 'weight'
  | 'italic'
  | 'underline'
  | 'align'
  | 'leading'
  | 'tracking'
  | 'hidden'
  | 'word';

/**
 * SIZE, AS A BOUNDED SCALE RELATIVE TO THE ELEMENT'S OWN SIZE — a − / +
 * stepper, never a number the couple reads (owner 2026-09-27, answer 3:
 * *"-+ only"*; and before it, *"Stepper with safe limits"*). It replaced
 * S · M · L · XL.
 *
 * A step is a PERCENT of the size the theme gave the element; 100 is the
 * element as the theme set it, so 100 is an ABSENCE and is never stored.
 *
 * 🔑 RELATIVE, NEVER PIXELS — "rails on" (owner 2026-09-23). A heading is 30px
 * on a phone and 60px on a laptop; 120 is 1.2× of whichever it is, so the phone
 * and the laptop scale together and no step can outgrow one of them alone.
 *
 * 🛤 THE BOUNDS ARE PER ELEMENT (`HUB_ELEMENT_SIZE_BOUNDS`): words people must
 * read never go below 85% (unreadable on a phone), the names and the heading
 * never above 145% (past the scene's edge on a phone), the mark and the joiner
 * — drawings and one small word — a little further each way.
 *
 * ♻ EVERY SIZE ALREADY SAVED KEEPS ITS LOOK. The old S · L · XL were exactly
 * 0.85 · 1.2 · 1.45, so they map onto 85 · 120 · 145 — three of the steps — and
 * every element's bounds contain all three (`element-size-scale.test.ts`).
 */
export const HUB_ELEMENT_SIZE_STEPS = [70, 78, 85, 92, 100, 110, 120, 132, 145, 160] as const;
export type HubElementSizeStep = (typeof HUB_ELEMENT_SIZE_STEPS)[number];
/** The theme's own size — an absence. */
export const HUB_ELEMENT_SIZE_BASE = 100;
/** S · L · XL as they were stored before the stepper (M was never stored). */
export const HUB_ELEMENT_LEGACY_SIZE: Readonly<Record<'s' | 'l' | 'xl', HubElementSizeStep>> = { s: 85, l: 120, xl: 145 };
export const HUB_ELEMENT_SIZE_BOUNDS: Readonly<Record<HubElementKey, { min: HubElementSizeStep; max: HubElementSizeStep }>> = {
  eyebrow: { min: 85, max: 145 },
  mark: { min: 70, max: 160 },
  names: { min: 70, max: 145 },
  joiner: { min: 70, max: 160 },
  line: { min: 85, max: 145 },
  date: { min: 85, max: 145 },
  time: { min: 85, max: 145 },
  label: { min: 85, max: 145 },
  heading: { min: 70, max: 145 },
  body: { min: 85, max: 145 },
};

/**
 * A stored size, or null (= the theme's own). Accepts a step, or one of the old
 * S · L · XL; a step outside the element's bounds is pulled to the nearest
 * bound (only a hand-made POST can carry one — the stepper never offers it).
 */
export function sanitizeHubElementSize(raw: unknown, key: HubElementKey): HubElementSizeStep | null {
  let pct: number | null = null;
  if (raw === 's' || raw === 'l' || raw === 'xl') pct = HUB_ELEMENT_LEGACY_SIZE[raw];
  else if (typeof raw === 'number' && (HUB_ELEMENT_SIZE_STEPS as readonly number[]).includes(raw)) pct = raw;
  if (pct === null) return null;
  const { min, max } = HUB_ELEMENT_SIZE_BOUNDS[key];
  const kept = Math.min(max, Math.max(min, pct)) as HubElementSizeStep;
  return kept === HUB_ELEMENT_SIZE_BASE ? null : kept;
}

/**
 * The percent a size draws at — a step as stored, or one of the old S · L · XL
 * met unsanitized (a draft written before the stepper): never NaN, never CSS
 * from anything else. Null = the theme's own.
 */
export function hubElementSizePct(size: unknown): number | null {
  if (size === 's' || size === 'l' || size === 'xl') return HUB_ELEMENT_LEGACY_SIZE[size];
  return typeof size === 'number' && (HUB_ELEMENT_SIZE_STEPS as readonly number[]).includes(size) && size !== HUB_ELEMENT_SIZE_BASE
    ? size
    : null;
}

/**
 * One press of − or + — the next step inside the element's bounds, or `false`
 * when the press would leave them (the button is then disabled). `null` = back
 * to the theme's own size.
 */
export function stepHubElementSize(
  current: number | null | undefined,
  dir: 1 | -1,
  key: HubElementKey,
): HubElementSizeStep | null | false {
  const steps = HUB_ELEMENT_SIZE_STEPS as readonly number[];
  const at = steps.indexOf(current ?? HUB_ELEMENT_SIZE_BASE);
  const from = at >= 0 ? at : steps.indexOf(HUB_ELEMENT_SIZE_BASE);
  const next = steps[from + dir];
  const { min, max } = HUB_ELEMENT_SIZE_BOUNDS[key];
  if (next === undefined || next < min || next > max) return false;
  return next === HUB_ELEMENT_SIZE_BASE ? null : (next as HubElementSizeStep);
}

/* ── THE TEXT TAB'S OTHER ROWS (Pages' Text inspector) ──────────────────── */

/** Weight — offered only where the face has more than one loaded (`HUB_FONT_BY_KEY[k].weights`). */
export const HUB_ELEMENT_WEIGHTS = [300, 400, 500, 600, 700] as const;
export type HubElementWeight = (typeof HUB_ELEMENT_WEIGHTS)[number];
export const HUB_ELEMENT_WEIGHT_LABEL: Record<HubElementWeight, string> = {
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'Semibold',
  700: 'Bold',
};
export const HUB_ELEMENT_ALIGNS = ['left', 'center', 'right'] as const;
export type HubElementAlign = (typeof HUB_ELEMENT_ALIGNS)[number];
export const HUB_ELEMENT_ALIGN_LABEL: Record<HubElementAlign, string> = { left: 'Left', center: 'Centre', right: 'Right' };
/** Line spacing, as a line-height. Absent = the theme's own ("Auto"). */
export const HUB_ELEMENT_LEADING_STEPS = [0.9, 1, 1.1, 1.2, 1.35, 1.5, 1.75] as const;
export type HubElementLeading = (typeof HUB_ELEMENT_LEADING_STEPS)[number];
/** Letter spacing, in percent of the letter — the prototype's −2% · 0% · +8%. Absent = the theme's own. */
export const HUB_ELEMENT_TRACKING_STEPS = [-2, 0, 8] as const;
export type HubElementTracking = (typeof HUB_ELEMENT_TRACKING_STEPS)[number];

/** Where − / + starts from while a spacing is still the theme's own. */
const DISPLAY_KEYS: readonly HubElementKey[] = ['names', 'heading', 'joiner', 'mark'];
function leadingStart(key: HubElementKey): HubElementLeading {
  return DISPLAY_KEYS.includes(key) ? 1.1 : 1.5;
}

/** One press on a spacing stepper — the next step, or `false` at the end. From "Auto" it starts at the element's usual spacing. */
export function stepHubSpacing(
  kind: 'leading' | 'tracking',
  current: number | null | undefined,
  dir: 1 | -1,
  key: HubElementKey,
): number | false {
  const steps: readonly number[] = kind === 'leading' ? HUB_ELEMENT_LEADING_STEPS : HUB_ELEMENT_TRACKING_STEPS;
  if (current === null || current === undefined) {
    if (kind === 'tracking') return dir < 0 ? steps[0]! : steps[steps.length - 1]!;
    const start = steps.indexOf(leadingStart(key));
    const next = steps[start + dir];
    return next === undefined ? false : next;
  }
  const at = steps.indexOf(current);
  const next = at >= 0 ? steps[at + dir] : undefined;
  return next === undefined ? false : next;
}

/** "−2%" · "0%" · "+8%" · "1.05" — what a spacing stepper shows; "Auto" while it is the theme's. */
export function hubSpacingLabel(kind: 'leading' | 'tracking', value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Auto';
  if (kind === 'leading') return value.toFixed(2).replace(/0$/, '');
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value)}%`;
}

/**
 * THE JOINER'S WORD. Three made for them, or their own — a short word, letters
 * only (any script), never markup: it is drawn as React text, so nothing typed
 * can become HTML or CSS. Absent = the word taken from the display name, as
 * before the Joiner existed.
 */
export const HUB_JOINER_WORDS = ['and', '&', '+'] as const;
export const HUB_JOINER_MAX = 12;
export function sanitizeHubJoinerWord(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const w = raw.replace(/\s+/g, ' ').trim();
  if (w.length === 0 || w.length > HUB_JOINER_MAX) return null;
  if ((HUB_JOINER_WORDS as readonly string[]).includes(w)) return w;
  return /^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u.test(w) ? w : null;
}

/* ── HOW ONE ELEMENT MOVES — Transition In · Animation During · Transition Out
   Owner, 2026-09-27: *"each element can have a transition and animation.
   Transition in and out. Animation During. we already discussed this."* The
   model is the 2026-09-23 hero-canvas editor's
   (`prototypes/hero-canvas-editor-2026-09-23.html`):

     · IN (how it arrives) — Rise · Fade · None
     · DURING (while they read) — Drift · Still for words; Ken Burns · Parallax
       are for a photo, and no element here is a photo, so they are dropped
     · OUT (the hand-off to the next scene) — Fade away · Lift away · Settle
       back · Stay put — ONLY when the element follows the scroll
     · PLAYS ONCE / FOLLOWS THE SCROLL above all three: once → Duration and
       Delay apply and there is no Out; scroll → distance is the control
       (`animation-timeline: view()`, `entry` / `exit` ranges, no script).

   🔑 IN AND DURING ARE NOT ALTERNATIVES. They are two comma-separated
   animations on the same element, and choosing one never clears the other.
   Every value is a closed-set key; none of it is CSS text from input. */
export const HUB_EL_IN = ['rise', 'fade', 'none'] as const;
export const HUB_EL_DURING = ['drift', 'still', 'kenburns', 'parallax'] as const;
export const HUB_EL_DURING_WORDS = ['drift', 'still'] as const;
export const HUB_EL_OUT = ['fade', 'lift', 'settle', 'stay'] as const;
export const HUB_EL_TIMELINE = ['once', 'scroll'] as const;
export const HUB_EL_DURATION = ['quick', 'normal', 'slow'] as const;
export const HUB_EL_DELAY = ['none', 'short', 'long'] as const;
export type HubElIn = (typeof HUB_EL_IN)[number];
export type HubElDuring = (typeof HUB_EL_DURING)[number];
export type HubElOut = (typeof HUB_EL_OUT)[number];
export type HubElTimeline = (typeof HUB_EL_TIMELINE)[number];
export type HubElDuration = (typeof HUB_EL_DURATION)[number];
export type HubElDelay = (typeof HUB_EL_DELAY)[number];

export const HUB_EL_IN_LABEL: Record<HubElIn, string> = { rise: 'Rise', fade: 'Fade', none: 'None' };
export const HUB_EL_DURING_LABEL: Record<HubElDuring, string> = {
  drift: 'Drift',
  still: 'Still',
  kenburns: 'Ken Burns',
  parallax: 'Parallax',
};
export const HUB_EL_OUT_LABEL: Record<HubElOut, string> = {
  fade: 'Fade away',
  lift: 'Lift away',
  settle: 'Settle back',
  stay: 'Stay put',
};
export const HUB_EL_TIMELINE_LABEL: Record<HubElTimeline, string> = { once: 'Plays once', scroll: 'Follows the scroll' };
export const HUB_EL_DURATION_LABEL: Record<HubElDuration, string> = { quick: 'Quick', normal: 'Normal', slow: 'Slow' };
export const HUB_EL_DELAY_LABEL: Record<HubElDelay, string> = { none: 'None', short: 'Short', long: 'Long' };
const DURATION_S: Record<HubElDuration, number> = { quick: 0.6, normal: 1.1, slow: 1.8 };
const DELAY_S: Record<HubElDelay, number> = { none: 0, short: 0.3, long: 0.8 };

/** One element's motion. Every field absent = its default (In none · Still · Plays once). */
export type HubElementMotion = {
  in?: Exclude<HubElIn, 'none'>;
  during?: Exclude<HubElDuring, 'still'>;
  /** Only beside `timeline: 'scroll'` — a timed element has no Out. */
  out?: Exclude<HubElOut, 'stay'>;
  timeline?: 'scroll';
  /** Only beside a timed In. */
  duration?: Exclude<HubElDuration, 'normal'>;
  /** Only beside a timed In. */
  delay?: Exclude<HubElDelay, 'none'>;
};

/**
 * The OLD single "Animation" row (#6019: Still · Calm · Editorial · Cinematic)
 * mapped onto the model — the nearest In + During pair — so a choice a couple
 * already made is carried, never dropped.
 */
const LEGACY_ANIM: Record<string, HubElementMotion | null> = {
  still: null,
  calm: { in: 'fade' },
  editorial: { in: 'rise' },
  cinematic: { in: 'rise', during: 'drift', timeline: 'scroll' },
};

/**
 * ✍ ONE RUN — a range of the element's text (a word, ONE letter) in its own
 * font · colour · size. `start`/`end` are offsets into the element's text as
 * drawn; `of` on the element says WHICH text they were made on.
 */
export type HubElementRun = {
  start: number;
  end: number;
  font?: HubFontKey;
  color?: string;
  /** A step of `HUB_ELEMENT_SIZE_STEPS`, never 100. */
  size?: HubElementSizeStep;
};

/** One element, as the couple left it. Every field absent = the theme's own. */
export type HubElementStyle = {
  font?: HubFontKey;
  /** `#rrggbb`, or `#rrggbbaa` below full opacity — lowercased. */
  color?: string;
  /** A step of `HUB_ELEMENT_SIZE_STEPS`, never 100 — see there. */
  size?: HubElementSizeStep;
  weight?: HubElementWeight;
  italic?: true;
  underline?: true;
  align?: HubElementAlign;
  leading?: HubElementLeading;
  tracking?: HubElementTracking;
  /**
   * Arrange → Show: Hidden. Guests never see the part; the Maker canvas draws
   * it ghosted so it can be brought back (the prototype's frame B).
   */
  hidden?: true;
  /** The joiner's word only — `sanitizeHubJoinerWord`. */
  word?: string;
  motion?: HubElementMotion;
  /** Runs, sorted, never overlapping — only with `of`. */
  runs?: HubElementRun[];
  /** The hash (`hubTextHash`) of the text the runs were made on. */
  of?: string;
};

export type HubElementStyles = Partial<Record<HubElementKey, HubElementStyle>>;

const HEX = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/;
const HASH = /^[0-9a-f]{8}$/;
/** Runs per element, and the longest text a run may reach into. */
export const HUB_ELEMENT_MAX_RUNS = 24;
const MAX_OFFSET = 400;

/**
 * `#rrggbb` — or `#rrggbbaa` when the Colour panel's Opacity is below 100% —
 * or null. The only shapes a colour may take. A fully opaque `…ff` is stored as
 * its six digits, so one colour has one spelling.
 */
export function hubElementColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  if (!HEX.test(v)) return null;
  return v.length === 9 && v.endsWith('ff') ? v.slice(0, 7) : v;
}

/**
 * The text's fingerprint (FNV-1a, 32-bit, hex). A run is kept only while the
 * element's text still hashes to the `of` it was made on — if the couple
 * rewrites the names, a run on "I" must not land on a different letter.
 */
export function hubTextHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const isIn = <T,>(list: readonly T[], v: unknown): v is T => (list as readonly unknown[]).includes(v);

/** A motion, or null. Drops what the model does not allow (an Out on a timed element). */
export function sanitizeHubElementMotion(raw: unknown): HubElementMotion | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const out: HubElementMotion = {};
  if (isIn(HUB_EL_IN, src.in) && src.in !== 'none') out.in = src.in;
  // Words drift or stay still; Ken Burns and Parallax are for a photo.
  if (isIn(HUB_EL_DURING_WORDS, src.during) && src.during !== 'still') out.during = src.during;
  const scroll = src.timeline === 'scroll';
  if (scroll) out.timeline = 'scroll';
  if (scroll && isIn(HUB_EL_OUT, src.out) && src.out !== 'stay') out.out = src.out;
  if (!scroll && out.in && isIn(HUB_EL_DURATION, src.duration) && src.duration !== 'normal') out.duration = src.duration;
  if (!scroll && out.in && isIn(HUB_EL_DELAY, src.delay) && src.delay !== 'none') out.delay = src.delay;
  return Object.keys(out).length > 0 ? out : null;
}

/** Runs, or null — sorted, clipped to the closed sets, overlaps dropped. */
export function sanitizeHubElementRuns(raw: unknown, key: HubElementKey = 'names'): HubElementRun[] | null {
  if (!Array.isArray(raw)) return null;
  const runs: HubElementRun[] = [];
  for (const r of raw.slice(0, HUB_ELEMENT_MAX_RUNS)) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) continue;
    const s = r as Record<string, unknown>;
    const start = s.start;
    const end = s.end;
    if (typeof start !== 'number' || typeof end !== 'number') continue;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > MAX_OFFSET) continue;
    const run: HubElementRun = { start, end };
    const font = sanitizeHubFontKey(s.font);
    if (font) run.font = font;
    const color = hubElementColor(s.color);
    if (color) run.color = color;
    const size = sanitizeHubElementSize(s.size, key);
    if (size) run.size = size;
    if (run.font || run.color || run.size) runs.push(run);
  }
  runs.sort((a, b) => a.start - b.start || a.end - b.end);
  const kept: HubElementRun[] = [];
  for (const r of runs) if (!kept.length || r.start >= kept[kept.length - 1]!.end) kept.push(r);
  return kept.length > 0 ? kept : null;
}

/**
 * One element's style, or null when nothing survives.
 *
 * Drops rather than repairs — the rule every sanitizer in `lib/hub-canvas.ts`
 * follows. A field the element cannot take (a colour on the mark) is dropped
 * too, so no stored value can be one that moves no pixels.
 */
export function sanitizeHubElementStyle(raw: unknown, key: HubElementKey): HubElementStyle | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const fields = HUB_ELEMENT_FIELDS[key];
  const out: HubElementStyle = {};
  const font = fields.includes('font') ? sanitizeHubFontKey(src.font) : null;
  if (font) out.font = font;
  const color = fields.includes('color') ? hubElementColor(src.color) : null;
  if (color) out.color = color;
  const size = fields.includes('size') ? sanitizeHubElementSize(src.size, key) : null;
  if (size) out.size = size;
  if (fields.includes('weight') && isIn(HUB_ELEMENT_WEIGHTS, src.weight)) out.weight = src.weight;
  if (fields.includes('italic') && src.italic === true) out.italic = true;
  if (fields.includes('underline') && src.underline === true) out.underline = true;
  if (fields.includes('align') && isIn(HUB_ELEMENT_ALIGNS, src.align)) out.align = src.align;
  if (fields.includes('leading') && isIn(HUB_ELEMENT_LEADING_STEPS, src.leading)) out.leading = src.leading;
  if (fields.includes('tracking') && isIn(HUB_ELEMENT_TRACKING_STEPS, src.tracking)) out.tracking = src.tracking;
  if (fields.includes('hidden') && src.hidden === true) out.hidden = true;
  const word = fields.includes('word') ? sanitizeHubJoinerWord(src.word) : null;
  if (word) out.word = word;
  if (fields.includes('motion')) {
    const motion =
      src.motion !== undefined
        ? sanitizeHubElementMotion(src.motion)
        : typeof src.anim === 'string'
          ? (LEGACY_ANIM[src.anim] ?? null)
          : null;
    if (motion) out.motion = motion;
  }
  if (HUB_ELEMENT_RUN_KEYS.includes(key) && typeof src.of === 'string' && HASH.test(src.of)) {
    const runs = sanitizeHubElementRuns(src.runs, key);
    if (runs) {
      out.runs = runs;
      out.of = src.of;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Every element's style, or null. Unknown element keys are dropped. */
export function sanitizeHubElements(raw: unknown): HubElementStyles | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const out: HubElementStyles = {};
  // In the fixed key order, so two equal choices always serialise identically
  // (the draft compares canvases as JSON).
  for (const key of HUB_ELEMENT_KEYS) {
    const style = sanitizeHubElementStyle(src[key], key);
    if (style) out[key] = style;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * THE ELEMENTS WITH ONE CHOICE CHANGED — what the sheet sends. `value: null` is
 * the reset (↺): the field goes back to an absence, and an element with no
 * field left disappears, and elements with none left return null.
 */
export type HubElementChoiceValue = string | number | boolean | null;

export function withElementChoice(
  elements: HubElementStyles | null | undefined,
  key: HubElementKey,
  field: Exclude<HubElementField, 'motion'>,
  value: HubElementChoiceValue,
): HubElementStyles | null {
  const next: Record<string, unknown> = { ...(elements ?? {}) };
  const style: Record<string, unknown> = { ...(elements?.[key] ?? {}) };
  if (value === null || value === false || (field === 'size' && value === HUB_ELEMENT_SIZE_BASE)) delete style[field];
  else style[field] = value;
  next[key] = style;
  return sanitizeHubElements(next);
}

/**
 * THE WHOLE HERO TAKES ONE ALIGNMENT (the prototype: *"alignment moves the
 * whole hero"*) — a left-aligned name over a centred date reads as a mistake,
 * so aligning any of the hero's words aligns all of them. A scene's own label,
 * heading and words align one by one.
 */
export function withElementAlign(
  elements: HubElementStyles | null | undefined,
  key: HubElementKey,
  value: HubElementAlign | null,
): HubElementStyles | null {
  const hero = (HUB_HERO_ELEMENT_KEYS as readonly HubElementKey[]).includes(key);
  const keys = hero ? HUB_HERO_ELEMENT_KEYS.filter((k) => HUB_ELEMENT_FIELDS[k].includes('align')) : [key];
  let next: HubElementStyles | null = elements ?? null;
  for (const k of keys) next = withElementChoice(next, k, 'align', value);
  return next;
}

/**
 * "↺ Use the Event Hub style" — every Text-tab choice on this element back to
 * the theme's own, in one tap (motion, show/hide and the joiner's word are the
 * other tabs' and stay). One word per concept: this is THE text reset.
 */
export const HUB_ELEMENT_TEXT_FIELDS = [
  'font',
  'weight',
  'italic',
  'underline',
  'color',
  'size',
  'align',
  'leading',
  'tracking',
] as const satisfies readonly HubElementField[];
export function withoutTextStyle(elements: HubElementStyles | null | undefined, key: HubElementKey): HubElementStyles | null {
  const next: Record<string, unknown> = { ...(elements ?? {}) };
  const style: Record<string, unknown> = { ...(elements?.[key] ?? {}) };
  for (const f of HUB_ELEMENT_TEXT_FIELDS) delete style[f];
  delete style.runs;
  delete style.of;
  next[key] = style;
  let out = sanitizeHubElements(next);
  // The hero's alignment is one choice for the whole hero — taken off together.
  if (elements?.[key]?.align && (HUB_HERO_ELEMENT_KEYS as readonly HubElementKey[]).includes(key)) {
    out = withElementAlign(out, key, null);
  }
  return out;
}

/** Does this element carry any Text-tab choice of its own? */
export function hasTextStyle(style: HubElementStyle | null | undefined): boolean {
  if (!style) return false;
  return HUB_ELEMENT_TEXT_FIELDS.some((f) => style[f] !== undefined) || Boolean(style.runs?.length);
}

/** One motion choice changed (`null` = back to its default). In and During never clear each other. */
export function withElementMotion(
  elements: HubElementStyles | null | undefined,
  key: HubElementKey,
  part: keyof HubElementMotion,
  value: string | null,
): HubElementStyles | null {
  const next: Record<string, unknown> = { ...(elements ?? {}) };
  const style: Record<string, unknown> = { ...(elements?.[key] ?? {}) };
  const motion: Record<string, unknown> = { ...((elements?.[key]?.motion as Record<string, unknown>) ?? {}) };
  if (value === null) delete motion[part];
  else motion[part] = value;
  style.motion = motion;
  next[key] = style;
  return sanitizeHubElements(next);
}

/**
 * ✍ A RANGE OF THE ELEMENT'S TEXT GETS ONE CHOICE. A run with exactly this
 * range is updated; runs that overlap it partly are replaced by it (a letter
 * never belongs to two runs). `of` is the hash of the text the range was
 * measured on — the element's runs are re-anchored to THAT text, and any run
 * made on older text is dropped rather than moved onto the wrong letters.
 */
export function withRunChoice(
  elements: HubElementStyles | null | undefined,
  key: HubElementKey,
  range: { start: number; end: number; of: string },
  field: 'font' | 'color' | 'size',
  value: string | number | null,
): HubElementStyles | null {
  const style: HubElementStyle = { ...(elements?.[key] ?? {}) };
  const current = style.of === range.of ? (style.runs ?? []) : [];
  const same = current.find((r) => r.start === range.start && r.end === range.end);
  const others = current.filter((r) => r.end <= range.start || r.start >= range.end);
  const run: Record<string, unknown> = { ...(same ?? {}), start: range.start, end: range.end };
  if (value === null || (field === 'size' && value === HUB_ELEMENT_SIZE_BASE)) delete run[field];
  else run[field] = value;
  const next: Record<string, unknown> = { ...(elements ?? {}) };
  next[key] = { ...style, runs: [...others, run], of: range.of };
  return sanitizeHubElements(next);
}

/** Every run on this range (or overlapping it) gone. */
export function withoutRuns(
  elements: HubElementStyles | null | undefined,
  key: HubElementKey,
  range: { start: number; end: number } | null,
): HubElementStyles | null {
  const style: HubElementStyle = { ...(elements?.[key] ?? {}) };
  const runs = range ? (style.runs ?? []).filter((r) => r.end <= range.start || r.start >= range.end) : [];
  const next: Record<string, unknown> = { ...(elements ?? {}) };
  next[key] = { ...style, runs };
  return sanitizeHubElements(next);
}

/** The element's own motion gone — it moves with its scene again. */
export function withoutMotion(elements: HubElementStyles | null | undefined, key: HubElementKey): HubElementStyles | null {
  const next: Record<string, unknown> = { ...(elements ?? {}) };
  const style: Record<string, unknown> = { ...(elements?.[key] ?? {}) };
  delete style.motion;
  next[key] = style;
  return sanitizeHubElements(next);
}

/** Every override on one element gone — "↺ use the Event Hub's own". */
export function withoutElement(elements: HubElementStyles | null | undefined, key: HubElementKey): HubElementStyles | null {
  const next: Record<string, unknown> = { ...(elements ?? {}) };
  delete next[key];
  return sanitizeHubElements(next);
}

/* ── WHAT THE PAGE DRAWS ────────────────────────────────────────────────── */

const EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)';
/** In, During and Out keyframes (`globals.css`, "ELEMENT MOTION"). `-p` twins replay In. */
const IN_KF: Record<Exclude<HubElIn, 'none'>, string> = { rise: 'el-in-rise', fade: 'el-in-fade' };
const DURING_KF: Record<'drift', string> = { drift: 'el-during-drift' };
const OUT_KF: Record<Exclude<HubElOut, 'stay'>, string> = {
  fade: 'el-out-fade',
  lift: 'el-out-lift',
  settle: 'el-out-settle',
};

/**
 * The element's animations as ONE declaration set — In, During and Out are
 * comma-separated animations that run together. Returns nothing for an element
 * with no motion of its own (it then moves with its scene).
 */
export function hubElementMotionDeclarations(motion: HubElementMotion | undefined): Array<[string, string]> {
  if (!motion) return [];
  const scroll = motion.timeline === 'scroll';
  const anims: Array<{ a: string; timeline: string; range: string }> = [];
  if (motion.in) {
    const dur = scroll ? 1 : DURATION_S[motion.duration ?? 'normal'];
    const delay = scroll ? 0 : DELAY_S[motion.delay ?? 'none'];
    anims.push({
      a: `${IN_KF[motion.in]} ${dur}s ${scroll ? 'linear' : EASE} ${delay}s backwards`,
      timeline: scroll ? 'view()' : 'auto',
      range: scroll ? 'entry 0% cover 30%' : 'normal',
    });
  }
  if (motion.during === 'drift') {
    anims.push({ a: `${DURING_KF.drift} 7s ease-in-out 0s infinite alternate`, timeline: 'auto', range: 'normal' });
  }
  if (scroll && motion.out) {
    anims.push({ a: `${OUT_KF[motion.out]} 1s linear both`, timeline: 'view()', range: 'exit 0% exit 100%' });
  }
  if (anims.length === 0) return [['animation', 'none']];
  const out: Array<[string, string]> = [['animation', anims.map((x) => x.a).join(', ')]];
  if (anims.some((x) => x.timeline !== 'auto')) {
    out.push(['animation-timeline', anims.map((x) => x.timeline).join(', ')]);
    out.push(['animation-range', anims.map((x) => x.range).join(', ')]);
  }
  return out;
}

/**
 * The CSS declarations one style contributes, as `property → value` in CSS
 * spelling. An empty style contributes nothing, so an element the couple never
 * touched renders exactly as before.
 *
 * `zoom` for size: it scales the element from ITS OWN size (a 3rem heading
 * becomes 3.6rem at L) where `font-size: 1.2em` would scale from the parent's.
 *
 * No transform is HELD once an arrival lands (`backwards` fill,
 * `an-identity-transform-unpins-every-fixed-child.test.ts`); Drift moves the
 * separate `translate` property, so it composes with an In's transform instead
 * of replacing it. A guest who asked for less motion gets the global
 * reduced-motion freeze in `globals.css`, whose `!important` lives in a layer
 * and so outranks anything written here.
 */
export function hubElementDeclarations(
  style: HubElementStyle | null | undefined,
  opts: { editor?: boolean } = {},
): Array<[string, string]> {
  if (!style) return [];
  const out: Array<[string, string]> = [];
  if (style.font) {
    const f = HUB_FONT_BY_KEY[style.font];
    out.push(['font-family', `var(${f.cssVar}), ${f.fallback}`]);
  }
  if (style.weight) out.push(['font-weight', String(style.weight)]);
  if (style.italic) out.push(['font-style', 'italic']);
  if (style.underline) out.push(['text-decoration-line', 'underline']);
  if (style.color) out.push(['color', style.color]);
  const pct = hubElementSizePct(style.size);
  if (pct) out.push(['zoom', String(pct / 100)]);
  if (style.align) {
    // `justify-content` too: the card's date is a flex row (rules either side).
    out.push(['text-align', style.align]);
    out.push(['justify-content', style.align === 'left' ? 'flex-start' : style.align === 'right' ? 'flex-end' : 'center']);
  }
  if (style.leading) out.push(['line-height', String(style.leading)]);
  if (style.tracking !== undefined) out.push(['letter-spacing', `${style.tracking / 100}em`]);
  // Hidden: never drawn for a guest; ghosted in the Maker so it can come back.
  if (style.hidden) out.push(opts.editor ? ['opacity', '0.3'] : ['display', 'none']);
  out.push(...hubElementMotionDeclarations(style.motion));
  return out;
}

const camel = (prop: string) => prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** The same declarations as a React inline style (the hero's parts). */
export function hubElementInlineStyle(
  style: HubElementStyle | null | undefined,
  opts: { editor?: boolean } = {},
): Record<string, string> | undefined {
  const decls = hubElementDeclarations(style, opts);
  if (decls.length === 0) return undefined;
  const out: Record<string, string> = {};
  for (const [prop, value] of decls) out[camel(prop)] = value;
  return out;
}

/** A run's inline style — font · colour · size (`em`, so it scales from the element's own size). */
export function hubRunInlineStyle(run: HubElementRun): Record<string, string> {
  const out: Record<string, string> = {};
  if (run.font) {
    const f = HUB_FONT_BY_KEY[run.font];
    out.fontFamily = `var(${f.cssVar}), ${f.fallback}`;
  }
  if (run.color) out.color = run.color;
  const pct = hubElementSizePct(run.size);
  if (pct) out.fontSize = `${pct / 100}em`;
  return out;
}

/**
 * ✍ THE TEXT, CUT INTO SEGMENTS BY ITS RUNS — what the guest page renders.
 *
 * `segmentStart` is where this piece of text sits inside the element's whole
 * text (the names are three pieces: first · joiner · second). Runs are applied
 * ONLY while `style.of` is the hash of the element's whole text — otherwise
 * the text changed after they were made, and every run is dropped rather than
 * landing on different letters.
 */
export function hubTextSegments(
  text: string,
  style: HubElementStyle | null | undefined,
  whole: { text: string; segmentStart: number },
): Array<{ text: string; run: HubElementRun | null }> {
  const runs = style?.runs && style.of === hubTextHash(whole.text) ? style.runs : null;
  if (!runs) return [{ text, run: null }];
  const from = whole.segmentStart;
  const to = from + text.length;
  const out: Array<{ text: string; run: HubElementRun | null }> = [];
  let at = from;
  for (const r of runs) {
    const s = Math.max(r.start, from);
    const e = Math.min(r.end, to);
    if (e <= s) continue;
    if (s > at) out.push({ text: text.slice(at - from, s - from), run: null });
    out.push({ text: text.slice(s - from, e - from), run: r });
    at = e;
  }
  if (at < to) out.push({ text: text.slice(at - from), run: null });
  return out;
}

/** A scene's scope token: its widget type, held to `[a-z0-9_]`. */
export function hubElementScope(widgetType: string): string | null {
  return /^[a-z0-9_]{1,40}$/.test(widgetType) ? widgetType : null;
}

/**
 * THE GUEST PAGE'S STYLE FOR ONE SCENE — CSS text, or null when there is none.
 *
 * Rendered as `<style hidden data-hub-els="<scope>">` IMMEDIATELY AFTER the
 * scene, and addressed with `:has(+ style[data-hub-els="…"])`, so no widget is
 * wrapped or edited and the scene keeps its place as its parent's direct child
 * (`.hub-scene > section` draws the card). `!important` because this is the
 * element's OWN choice: the Keynote rule is that it wins over the theme's.
 */
export function hubElementSceneCss(
  scope: string,
  elements: HubElementStyles | null | undefined,
  opts: { editor?: boolean } = {},
): string | null {
  const safe = hubElementScope(scope);
  if (!safe || !elements) return null;
  const rules: string[] = [];
  for (const key of HUB_SCENE_ELEMENT_KEYS) {
    const style = elements[key];
    const target = `:is(${HUB_SCENE_ELEMENT_SELECTOR[key]})`;
    /* 🙈 A HIDDEN PART: gone for a guest, ghosted in the Maker's canvas. The
       canvas is told apart by the navigator's markers, which exist ONLY there
       (`data-maker-section`, `site-body.tsx`) — no editor flag reaches a frame. */
    if (style?.hidden) {
      const at = `:has(+ style[data-hub-els="${safe}"]) ${target}`;
      if (opts.editor === undefined) {
        rules.push(`:root:not(:has([data-maker-section])) ${at}{display:none !important}`);
        rules.push(`:root:has([data-maker-section]) ${at}{opacity:0.3 !important}`);
      } else {
        rules.push(`${at}{${opts.editor ? 'opacity:0.3' : 'display:none'} !important}`);
      }
    }
    const decls = hubElementDeclarations(style ? { ...style, hidden: undefined } : style, opts);
    if (decls.length === 0) continue;
    // Every LOOK wins over the theme (the Keynote rule); the motion does not
    // need to, and `!important` on an animation would outrank the guest's
    // reduced-motion freeze.
    const body = decls
      .map(([p, v]) => `${p}:${v}${p.startsWith('animation') ? '' : ' !important'}`)
      .join(';');
    rules.push(`:has(+ style[data-hub-els="${safe}"]) ${target}{${body}}`);
  }
  return rules.length > 0 ? rules.join('\n') : null;
}

/* ── THE SHEET'S HELPERS ────────────────────────────────────────────────── */

/**
 * The fonts the sheet offers — EVERY face the app ships (owner 2026-09-27: "use
 * all our fonts on the dropdown"), the five most used first, then Serif ·
 * Script · Sans · Display. `pickGroup` is the dropdown's group heading.
 */
export const HUB_ELEMENT_FONTS = hubFontsForPicker();

/**
 * Does this colour read on this ground? The WCAG body-text floor is 4.5:1. The
 * sheet WARNS below it and never blocks — the couple may want a quiet accent.
 */
export const HUB_ELEMENT_MIN_CONTRAST = 4.5;
export function hubElementContrast(color: string, ground: string): { ratio: number; ok: boolean } {
  const ratio = contrastRatio(hubColorOver(color, ground), ground.slice(0, 7));
  return { ratio, ok: ratio >= HUB_ELEMENT_MIN_CONTRAST };
}

/**
 * A `#rrggbbaa` colour as it is SEEN over its ground (`#rrggbb`) — what the
 * contrast warning must measure. A six-digit colour is returned as it is.
 */
export function hubColorOver(color: string, ground: string): string {
  if (color.length !== 9) return color.slice(0, 7);
  const a = parseInt(color.slice(7, 9), 16) / 255;
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const g = ground.length >= 7 ? ground : '#ffffff';
  const mix = [0, 1, 2].map((i) => Math.round(ch(color, i) * a + ch(g, i) * (1 - a)));
  return `#${mix.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}
