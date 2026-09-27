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

export const HUB_HERO_ELEMENT_KEYS = ['eyebrow', 'mark', 'names', 'line', 'date', 'time'] as const;
export const HUB_SCENE_ELEMENT_KEYS = ['label', 'heading', 'body'] as const;
export const HUB_ELEMENT_KEYS = [...HUB_HERO_ELEMENT_KEYS, ...HUB_SCENE_ELEMENT_KEYS] as const;
export type HubHeroElementKey = (typeof HUB_HERO_ELEMENT_KEYS)[number];
export type HubSceneElementKey = (typeof HUB_SCENE_ELEMENT_KEYS)[number];
export type HubElementKey = (typeof HUB_ELEMENT_KEYS)[number];

export const HUB_ELEMENT_LABEL: Record<HubElementKey, string> = {
  eyebrow: 'Small line on top',
  mark: 'Your mark',
  names: 'Names',
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

/** What each element can take. The mark is a drawing: it has no font, colour or text of its own here. */
export const HUB_ELEMENT_FIELDS: Record<HubElementKey, readonly HubElementField[]> = {
  eyebrow: ['font', 'color', 'size', 'motion'],
  mark: ['size', 'motion'],
  names: ['font', 'color', 'size', 'motion'],
  line: ['font', 'color', 'size', 'motion'],
  date: ['font', 'color', 'size', 'motion'],
  time: ['font', 'color', 'size', 'motion'],
  label: ['font', 'color', 'size', 'motion'],
  heading: ['font', 'color', 'size', 'motion'],
  body: ['font', 'color', 'size', 'motion'],
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

export type HubElementField = 'font' | 'color' | 'size' | 'motion';

/**
 * SIZE, AS A STEP RELATIVE TO THE ELEMENT'S OWN SIZE. `m` is the element as
 * the theme set it, so `m` is an ABSENCE and is never stored.
 *
 * 🔑 RELATIVE, NEVER PIXELS — "rails on" (owner 2026-09-23). A heading is 30px
 * on a phone and 60px on a laptop; "L" is 1.2× of whichever it is.
 */
export const HUB_ELEMENT_SIZES = ['s', 'm', 'l', 'xl'] as const;
export type HubElementSize = (typeof HUB_ELEMENT_SIZES)[number];
export const HUB_ELEMENT_SIZE_LABEL: Record<HubElementSize, string> = { s: 'S', m: 'M', l: 'L', xl: 'XL' };
export const HUB_ELEMENT_SIZE_SCALE: Record<HubElementSize, number> = { s: 0.85, m: 1, l: 1.2, xl: 1.45 };

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
  size?: Exclude<HubElementSize, 'm'>;
};

/** One element, as the couple left it. Every field absent = the theme's own. */
export type HubElementStyle = {
  font?: HubFontKey;
  /** `#rrggbb`, lowercased. */
  color?: string;
  /** Never `m` — see `HUB_ELEMENT_SIZES`. */
  size?: Exclude<HubElementSize, 'm'>;
  motion?: HubElementMotion;
  /** Runs, sorted, never overlapping — only with `of`. */
  runs?: HubElementRun[];
  /** The hash (`hubTextHash`) of the text the runs were made on. */
  of?: string;
};

export type HubElementStyles = Partial<Record<HubElementKey, HubElementStyle>>;

const HEX = /^#[0-9a-f]{6}$/;
const HASH = /^[0-9a-f]{8}$/;
/** Runs per element, and the longest text a run may reach into. */
export const HUB_ELEMENT_MAX_RUNS = 24;
const MAX_OFFSET = 400;

/** `#rrggbb`, or null. The only shape a colour may take. */
export function hubElementColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  return HEX.test(v) ? v : null;
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
export function sanitizeHubElementRuns(raw: unknown): HubElementRun[] | null {
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
    if (s.size === 's' || s.size === 'l' || s.size === 'xl') run.size = s.size;
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
  if (fields.includes('size') && (src.size === 's' || src.size === 'l' || src.size === 'xl')) out.size = src.size;
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
    const runs = sanitizeHubElementRuns(src.runs);
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
export function withElementChoice(
  elements: HubElementStyles | null | undefined,
  key: HubElementKey,
  field: Exclude<HubElementField, 'motion'>,
  value: string | null,
): HubElementStyles | null {
  const next: Record<string, unknown> = { ...(elements ?? {}) };
  const style: Record<string, unknown> = { ...(elements?.[key] ?? {}) };
  if (value === null || (field === 'size' && value === 'm')) delete style[field];
  else style[field] = value;
  next[key] = style;
  return sanitizeHubElements(next);
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
  value: string | null,
): HubElementStyles | null {
  const style: HubElementStyle = { ...(elements?.[key] ?? {}) };
  const current = style.of === range.of ? (style.runs ?? []) : [];
  const same = current.find((r) => r.start === range.start && r.end === range.end);
  const others = current.filter((r) => r.end <= range.start || r.start >= range.end);
  const run: Record<string, unknown> = { ...(same ?? {}), start: range.start, end: range.end };
  if (value === null || (field === 'size' && value === 'm')) delete run[field];
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
export function hubElementDeclarations(style: HubElementStyle | null | undefined): Array<[string, string]> {
  if (!style) return [];
  const out: Array<[string, string]> = [];
  if (style.font) {
    const f = HUB_FONT_BY_KEY[style.font];
    out.push(['font-family', `var(${f.cssVar}), ${f.fallback}`]);
  }
  if (style.color) out.push(['color', style.color]);
  if (style.size) out.push(['zoom', String(HUB_ELEMENT_SIZE_SCALE[style.size])]);
  out.push(...hubElementMotionDeclarations(style.motion));
  return out;
}

const camel = (prop: string) => prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** The same declarations as a React inline style (the hero's parts). */
export function hubElementInlineStyle(style: HubElementStyle | null | undefined): Record<string, string> | undefined {
  const decls = hubElementDeclarations(style);
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
  if (run.size) out.fontSize = `${HUB_ELEMENT_SIZE_SCALE[run.size]}em`;
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
export function hubElementSceneCss(scope: string, elements: HubElementStyles | null | undefined): string | null {
  const safe = hubElementScope(scope);
  if (!safe || !elements) return null;
  const rules: string[] = [];
  for (const key of HUB_SCENE_ELEMENT_KEYS) {
    const decls = hubElementDeclarations(elements[key]);
    if (decls.length === 0) continue;
    const target = `:is(${HUB_SCENE_ELEMENT_SELECTOR[key]})`;
    const body = decls
      .map(([p, v]) => `${p}:${v}${p === 'font-family' || p === 'color' || p === 'zoom' ? ' !important' : ''}`)
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
  const ratio = contrastRatio(color, ground);
  return { ratio, ok: ratio >= HUB_ELEMENT_MIN_CONTRAST };
}
