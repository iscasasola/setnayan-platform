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
 * The hero's parts (the invitation card: eyebrow · mark · names · joiner · the
 * "invite you to…" line · date · time · the link down; the plain masthead's
 * venue) and, in every other scene, its label, heading and words. ⛔ The RSVP form is NOT element-editable — it stays the
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

import { HUB_FONT_BY_KEY, sanitizeHubFontKey, type HubFontKey } from '@/lib/hub-fonts';
import { contrastRatio } from '@/lib/hub-legibility';
import { adaptHubRuns } from '@/lib/element-runs-adapt';
import { isHubDateFormat, isHubTimeFormat } from '@/lib/hub-part-words';
import { motionFxVars, sameMotionFx, sanitizeMotionFx, type MotionFx, type MotionSpeed } from '@/lib/motion-effects';

/* ── THE ELEMENTS ───────────────────────────────────────────────────────── */

/**
 * 🔗 THE JOINER (owner 2026-09-27, "MAKER TOOLBARS (KEYNOTE + PAGES) APPROVED",
 * answer 2: *"okay"* to "build the Joiner part") — the word between the two
 * names ("and" · "&" · "+" · their own word), a part like any other: its own
 * font · colour · size · motion, and its WORD (`HubElementStyle.word`). Before
 * it, the "and" was made for the couple from the display name and could not be
 * edited. Only on a two-person hero — a solo name has no joiner to draw.
 */
/**
 * 🔗 THE LINK DOWN (owner 2026-09-28, tapping "the day, the place, the story ↓"
 * in the Maker: *"why can't i update the text"*) — the card's link into the
 * hub, a part like any other: its own font · colour · size · motion, and its
 * WORDS (`HubElementStyle.word`, `sanitizeHubPartLine`). Absent = the words
 * the card was always drawn with (`HUB_LINK_DEFAULT_WORDS`). Only on the card.
 *
 * 📍 THE VENUE — the plain (hero-photo) masthead's venue line. Its words are
 * the event's own venue (Details), never free text here, so it takes STYLE
 * only: no `word`. Only on the plain masthead.
 *
 * 🖼 THE PHOTO CAPTION — the small line under the hero photo (owner
 * 2026-09-28: *"make it editable"*). Its words are the couple's (`word`);
 * absent = the venue it has always repeated. Only under a hero photo/video.
 */
export const HUB_HERO_ELEMENT_KEYS = ['eyebrow', 'mark', 'names', 'joiner', 'line', 'date', 'time', 'link', 'venue', 'caption'] as const;
/**
 * Which hero parts the masthead can draw, by its shape: the invitation CARD
 * draws its line, time and link; the PLAIN masthead (a hero photo, or the
 * solemn register) draws the venue instead (`PahinaMasthead`). The Part ▾ lists
 * only the parts its hero draws — a part it does not draw is a control that
 * moves no pixels.
 */
export const HUB_HERO_CARD_ONLY_KEYS: readonly HubHeroElementKey[] = ['line', 'time', 'link'];
export const HUB_HERO_PLAIN_ONLY_KEYS: readonly HubHeroElementKey[] = ['venue', 'caption'];
/** The parts drawn only under a hero photo/video (the cover plate). */
export const HUB_HERO_PHOTO_ONLY_KEYS: readonly HubHeroElementKey[] = ['caption'];
export function heroPartsFor(
  card: boolean | null | undefined,
  twoPeople: boolean | null | undefined,
  photo?: boolean | null,
): HubHeroElementKey[] {
  return HUB_HERO_ELEMENT_KEYS.filter((k) => {
    if (k === 'joiner' && twoPeople === false) return false;
    if (photo === false && HUB_HERO_PHOTO_ONLY_KEYS.includes(k)) return false;
    if (card === true && HUB_HERO_PLAIN_ONLY_KEYS.includes(k)) return false;
    if (card === false && HUB_HERO_CARD_ONLY_KEYS.includes(k)) return false;
    return true;
  });
}
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
  link: 'Details link',
  venue: 'Venue',
  caption: 'Photo caption',
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
  // ✍ Its words are the couple's (`word`, absent = the card's own) — typed in
  // place on the canvas (tap-to-type, `lib/type-in-place.ts`).
  eyebrow: ['word', ...TEXT_FIELDS],
  mark: ['size', 'motion', 'hidden'],
  names: TEXT_FIELDS,
  // One word between two lines: no alignment or spacing of its own — it sits
  // where the names put it — but the word itself is the couple's.
  joiner: ['word', 'font', 'weight', 'italic', 'underline', 'color', 'size', 'motion', 'hidden'],
  line: ['word', ...TEXT_FIELDS],
  // 🗓 How the fact is written (`format`, Format ▾ — `lib/hub-date-formats.ts`);
  // the fact itself is Details'.
  date: [...TEXT_FIELDS, 'format'],
  time: [...TEXT_FIELDS, 'format'],
  // Its words are the couple's (`word`, absent = the card's own words).
  link: ['word', ...TEXT_FIELDS],
  // The event's own venue — style only; the words live in Details.
  venue: TEXT_FIELDS,
  // Its words are the couple's (`word`, absent = the venue it repeats).
  caption: ['word', ...TEXT_FIELDS],
  label: TEXT_FIELDS,
  heading: TEXT_FIELDS,
  body: TEXT_FIELDS,
};

/**
 * ✍ THE ELEMENTS WHOSE TEXT CAN CARRY RUNS (one letter, one word in its own
 * font · colour · size — owner 2026-09-27: *"they can take 1 letter and change
 * the font"*). Every part with words: the hero's and every scene's.
 *
 * ONE MECHANISM, TWO PLACES IT IS LAID. The hero's words are drawn HERE
 * (`PahinaMasthead`), so its runs are cut into spans server-side. A scene's
 * label / heading / words are drawn by widgets that must stay ignorant of the
 * canvas (`every-widget-is-one-section.test.ts`), so the scene's runs ride on
 * its scoped `<style data-hub-runs>` (`hubSceneRunsAttr`) and are cut into the
 * SAME `<span data-el-run>` by the SAME segmenter (`hubTextSegments`) once the
 * page is in the browser (`HubSceneRuns`, `app/[slug]/_components/part-runs.ts`). A page
 * whose script never runs shows the scene's words whole, in the part's own
 * look — every letter readable, none on a wrong style.
 *
 * A scene key addresses EVERY heading (every paragraph) of its scene, so a
 * scene's runs are laid on the one part whose words they were made on
 * (`hubRunsTarget`), never on each of them.
 */
export const HUB_ELEMENT_RUN_KEYS: readonly HubElementKey[] = [
  'eyebrow',
  'names',
  'line',
  'date',
  'time',
  'link',
  'venue',
  'caption',
  'label',
  'heading',
  'body',
];

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
  | 'word'
  | 'format';

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
  link: { min: 85, max: 145 },
  venue: { min: 85, max: 145 },
  caption: { min: 85, max: 160 },
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

/**
 * 🔗 ONE LINE OF THE COUPLE'S OWN WORDS — the link's (in place of "the day,
 * the place, the story") and the photo caption's (in place of the venue).
 * Words, never markup: drawn as React text, so nothing typed can
 * become HTML or CSS; control and format characters are refused, spaces
 * collapse, and it stays one short line.
 *
 * 🧹 CLEARED = THE CARD'S OWN WORDS BACK — the joiner's rule: an empty word is
 * an absence (`sanitizeHubJoinerWord('')` → null), and an absence draws the
 * default. Taking the link off the page is Arrange → Hidden, never empty text.
 */
export const HUB_PART_LINE_MAX = 60;
/** The card's link as it has always read — the words while the couple wrote none. */
export const HUB_LINK_DEFAULT_WORDS = 'the day, the place, the story';
/** What the words box shows while empty — the words the part draws then. */
export const HUB_PART_WORDS_HINT: Partial<Record<HubElementKey, string>> = {
  link: HUB_LINK_DEFAULT_WORDS,
  caption: 'The venue',
};
export function sanitizeHubPartLine(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const w = raw.replace(/\s+/g, ' ').trim();
  if (w.length === 0 || w.length > HUB_PART_LINE_MAX) return null;
  if (/[\p{Cc}\p{Cf}\p{Co}\p{Cn}]/u.test(w)) return null;
  return w;
}

/**
 * ✍ ONE SENTENCE OF THE COUPLE'S OWN — the small line on top and the
 * invitation line (tap-to-type). The same rule as a line, a little longer: the
 * printed invitation's opening lines run to ~85 letters and are offered there.
 */
export const HUB_PART_SENTENCE_MAX = 120;
export function sanitizeHubPartSentence(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const w = raw.replace(/\s+/g, ' ').trim();
  if (w.length === 0 || w.length > HUB_PART_SENTENCE_MAX) return null;
  if (/[\p{Cc}\p{Cf}\p{Co}\p{Cn}]/u.test(w)) return null;
  return w;
}

/** A part's own words, by the part — the joiner's word, one line (the link, the caption) or one sentence. */
export function sanitizeHubElementWord(raw: unknown, key: HubElementKey): string | null {
  if (key === 'joiner') return sanitizeHubJoinerWord(raw);
  if (key === 'link' || key === 'caption') return sanitizeHubPartLine(raw);
  if (key === 'eyebrow' || key === 'line') return sanitizeHubPartSentence(raw);
  return null;
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
   Every value is a closed-set key; none of it is CSS text from input.

   🎛 2026-10-04 — IN AND OUT ARE NOW FOUR EFFECTS THAT COMBINE (Fade · Move
   from 8 directions · Size · Blur, `lib/motion-effects.ts`) plus Speed ▾ =
   Fast · Regular · Gentle. `HUB_EL_IN` / `HUB_EL_OUT` / `HUB_EL_DURATION`
   below are the SHIPPED single choices, kept because drafts and live pages
   still hold them: `sanitizeHubElementMotion` maps each one onto the four on
   read, and the page draws the mapped value with the very keyframe it drew
   before (`IN_LEGACY_KF`), so nothing a couple already chose moves a pixel. */
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

/** Fast · Gentle (Regular is the absence) — the shipped quick · slow. */
export type HubElSpeed = Exclude<MotionSpeed, 'regular'>;

/**
 * One element's motion. Every field absent = its default (In none · Still ·
 * Plays once · Regular). `in` / `out` are the FOUR EFFECTS (`MotionFx`): absent
 * = every one None.
 */
export type HubElementMotion = {
  in?: MotionFx;
  during?: Exclude<HubElDuring, 'still'>;
  /** Only beside `timeline: 'scroll'` — a timed element has no Out. */
  out?: MotionFx;
  timeline?: 'scroll';
  /** The In's speed — only beside an In. On the clock a duration; following the scroll, how far the thumb travels. */
  speed?: HubElSpeed;
  /** The Out's own speed — only beside an Out. */
  outSpeed?: HubElSpeed;
  /** Only beside a timed In. */
  delay?: Exclude<HubElDelay, 'none'>;
};

/** The shipped single In / Out choices, as the four effects (`sanitizeHubElementMotion`). */
export const HUB_EL_IN_AS_FX: Record<Exclude<HubElIn, 'none'>, MotionFx> = {
  rise: { fade: true, move: 'below' },
  fade: { fade: true },
};
export const HUB_EL_OUT_AS_FX: Record<Exclude<HubElOut, 'stay'>, MotionFx> = {
  fade: { fade: true },
  lift: { fade: true, move: 'above' },
  settle: { fade: true, size: 'settle' },
};

/**
 * The OLD single "Animation" row (#6019: Still · Calm · Editorial · Cinematic)
 * mapped onto the model — the nearest In + During pair — so a choice a couple
 * already made is carried, never dropped. Written in the shipped words and
 * read through `sanitizeHubElementMotion` like any other stored value.
 */
const LEGACY_ANIM: Record<string, Record<string, string> | null> = {
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
  /**
   * The part's own words, where its words are the couple's: the joiner's word
   * (`sanitizeHubJoinerWord`), the link's and the photo caption's line
   * (`sanitizeHubPartLine`).
   */
  word?: string;
  /**
   * 🗓 How the date or the time is written (Format ▾): one of the closed
   * lists in `lib/hub-part-words.ts`; absent = the page's own words.
   */
  format?: string;
  motion?: HubElementMotion;
  /** Runs, sorted, never overlapping — only with `of`. */
  runs?: HubElementRun[];
  /** The hash (`hubTextHash`) of the text the runs were made on. */
  of?: string;
  /**
   * ✍ The text the runs were made on, itself — only with `of`, and only while
   * it still hashes to it. With it, a run ADAPTS when the words change
   * (`adaptHubRuns`: kept letters keep their style); without it (a run made
   * before 2026-09-29, or on text longer than `HUB_ELEMENT_RUN_TEXT_MAX`) a
   * run on changed words is dropped, as it always was.
   */
  was?: string;
};

export type HubElementStyles = Partial<Record<HubElementKey, HubElementStyle>>;

const HEX = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/;
const HASH = /^[0-9a-f]{8}$/;
/** Runs per element, and the longest text a run may reach into. */
export const HUB_ELEMENT_MAX_RUNS = 24;
const MAX_OFFSET = 400;
/** The longest text kept as `was` — a run cannot reach past it anyway. */
export const HUB_ELEMENT_RUN_TEXT_MAX = MAX_OFFSET;

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

/** `raw` as a run's own text: a string no longer than a run can reach, that hashes to `of`. */
function runText(raw: unknown, of: unknown): string | null {
  if (typeof raw !== 'string' || typeof of !== 'string') return null;
  if (raw.length > HUB_ELEMENT_RUN_TEXT_MAX) return null;
  return hubTextHash(raw) === of ? raw : null;
}

const ADAPTED = new WeakMap<HubElementStyle, Map<string, HubElementRun[] | null>>();

/**
 * ✍ THE ELEMENT'S RUNS, AS THEY FALL ON `text` — the part's WHOLE text as it
 * is drawn now. The ONE place a run meets its words (the guest page, the Maker
 * canvas and the sheet all read through here):
 *
 *   · the text is the one the runs were made on (`of`) → the runs, as stored;
 *   · it changed, and the old text is known (`was`) → the runs ADAPTED onto it
 *     (`adaptHubRuns`: kept letters keep their style, inserted ones are plain,
 *     deleted ones drop theirs) — so a name edited in Details, or words edited
 *     in place, keep every style that still has its letter;
 *   · otherwise → null. A run is never laid on offsets into different words.
 */
export function hubRunsOn(style: HubElementStyle | null | undefined, text: string): HubElementRun[] | null {
  const runs = style?.runs;
  if (!style || !runs || runs.length === 0 || !style.of) return null;
  if (style.of === hubTextHash(text)) return runs;
  const was = runText(style.was, style.of);
  if (was === null) return null;
  let memo = ADAPTED.get(style);
  if (!memo) ADAPTED.set(style, (memo = new Map()));
  if (memo.has(text)) return memo.get(text) ?? null;
  const adapted = adaptHubRuns(runs, was, text);
  const out = adapted.length > 0 ? adapted : null;
  memo.set(text, out);
  return out;
}

/**
 * ✍ WHICH OF A SCENE'S PARTS ITS RUNS BELONG TO. A scene key addresses every
 * heading (every paragraph) of its scene, but the runs were made on ONE of
 * them: the part whose words still hash to `of`, else — the words changed —
 * the part whose words keep the most of `was` (at least half of its letters),
 * else none. `texts` are the parts' whole texts, in page order; -1 = none.
 */
export function hubRunsTarget(texts: readonly string[], style: HubElementStyle | null | undefined): number {
  if (!style?.runs?.length || !style.of) return -1;
  const exact = texts.findIndex((t) => hubTextHash(t) === style.of);
  if (exact >= 0) return exact;
  const was = runText(style.was, style.of);
  if (was === null || was.length === 0) return -1;
  const whole = [{ start: 0, end: was.length }];
  let best = -1;
  let bestKept = 0;
  texts.forEach((t, i) => {
    if (t.length > HUB_ELEMENT_RUN_TEXT_MAX * 2) return;
    const kept = adaptHubRuns(whole, was, t).reduce((n, r) => n + (r.end - r.start), 0);
    if (kept > bestKept) {
      bestKept = kept;
      best = i;
    }
  });
  return bestKept * 2 >= was.length ? best : -1;
}

const isIn = <T,>(list: readonly T[], v: unknown): v is T => (list as readonly unknown[]).includes(v);

/** A stored In — the four effects, or a shipped single choice mapped onto them. */
function readElIn(raw: unknown): MotionFx | null {
  if (typeof raw === 'string') return isIn(HUB_EL_IN, raw) && raw !== 'none' ? { ...HUB_EL_IN_AS_FX[raw] } : null;
  return sanitizeMotionFx(raw);
}
/** A stored Out — the four effects (Settle back carried), or a shipped single choice. */
function readElOut(raw: unknown): MotionFx | null {
  if (typeof raw === 'string') return isIn(HUB_EL_OUT, raw) && raw !== 'stay' ? { ...HUB_EL_OUT_AS_FX[raw] } : null;
  return sanitizeMotionFx(raw, { settle: true });
}
/** A stored speed — Fast · Gentle, or the shipped Duration's quick · slow. */
function readElSpeed(raw: unknown, legacyDuration?: unknown): HubElSpeed | null {
  if (raw === 'fast' || raw === 'gentle') return raw;
  if (legacyDuration === 'quick') return 'fast';
  if (legacyDuration === 'slow') return 'gentle';
  return null;
}

/**
 * A motion, or null. Drops what the model does not allow (an Out on a timed
 * element, a Delay beside no timed In, a Speed beside nothing that moves).
 * 🔁 A SHIPPED VALUE IS MAPPED ON READ (`rise` → Fade + Move from below,
 * `lift` → Fade + Move to the top, `settle` → Fade + Settle back, Duration
 * quick · slow → Speed Fast · Gentle) — no data migration: what the page draws
 * for the mapped value is byte-for-byte what it drew for the old one.
 */
export function sanitizeHubElementMotion(raw: unknown): HubElementMotion | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const out: HubElementMotion = {};
  const scroll = src.timeline === 'scroll';
  const fxIn = readElIn(src.in);
  if (fxIn) out.in = fxIn;
  // Words drift or stay still; Ken Burns and Parallax are for a photo.
  if (isIn(HUB_EL_DURING_WORDS, src.during) && src.during !== 'still') out.during = src.during;
  if (scroll) out.timeline = 'scroll';
  const fxOut = scroll ? readElOut(src.out) : null;
  if (fxOut) out.out = fxOut;
  /* The shipped Duration only ever lived beside a timed In. */
  const speed = out.in ? readElSpeed(src.speed, scroll ? undefined : src.duration) : null;
  if (speed) out.speed = speed;
  const outSpeed = out.out ? readElSpeed(src.outSpeed) : null;
  if (outSpeed) out.outSpeed = outSpeed;
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
  const word = fields.includes('word') ? sanitizeHubElementWord(src.word, key) : null;
  if (word) out.word = word;
  if (fields.includes('format') && (key === 'date' ? isHubDateFormat(src.format) : isHubTimeFormat(src.format))) {
    out.format = src.format as string;
  }
  if (fields.includes('motion')) {
    const motion =
      src.motion !== undefined
        ? sanitizeHubElementMotion(src.motion)
        : typeof src.anim === 'string'
          ? sanitizeHubElementMotion(LEGACY_ANIM[src.anim] ?? null)
          : null;
    if (motion) out.motion = motion;
  }
  if (HUB_ELEMENT_RUN_KEYS.includes(key) && typeof src.of === 'string' && HASH.test(src.of)) {
    const runs = sanitizeHubElementRuns(src.runs, key);
    if (runs) {
      out.runs = runs;
      out.of = src.of;
      const was = runText(src.was, src.of);
      if (was !== null) out.was = was;
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
  delete style.was;
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

/**
 * One motion choice changed (`null` = back to its default). In and During never
 * clear each other. `in` / `out` take the WHOLE effect set (`withMotionFx`
 * builds it from one effect's pick); the rest take their closed-set key.
 */
export function withElementMotion(
  elements: HubElementStyles | null | undefined,
  key: HubElementKey,
  part: keyof HubElementMotion,
  value: string | MotionFx | null,
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
 * ✍ WHERE A RANGE WAS MEASURED — the offsets, the hash of the part's whole
 * text (`of`), and that text itself (`was`) when the canvas sent it
 * (`selectionInPart`).
 */
export type HubRunRange = { start: number; end: number; of: string; was?: string };

/**
 * The element's runs as they fall on the text a range was measured on: as
 * stored when that is still their text, ADAPTED onto it when the words changed
 * and both texts are known (`hubRunsOn`), and none otherwise — a run is never
 * left on the offsets of words that are gone.
 */
export function hubRunsForRange(style: HubElementStyle, range: HubRunRange): HubElementRun[] {
  if (style.of === range.of) return style.runs ?? [];
  const now = runText(range.was, range.of);
  return (now !== null ? hubRunsOn(style, now) : null) ?? [];
}

/** `{ of, was }` for the text a range was measured on — `was` only when it may be kept. */
function anchorOf(range: HubRunRange): { of: string; was?: string } {
  const was = runText(range.was, range.of);
  return was !== null ? { of: range.of, was } : { of: range.of };
}

/**
 * ✍ A RANGE OF THE ELEMENT'S TEXT GETS ONE CHOICE. A run with exactly this
 * range is updated; runs that overlap it partly are replaced by it (a letter
 * never belongs to two runs). `of` is the hash of the text the range was
 * measured on — the element's runs are re-anchored to THAT text: ADAPTED onto
 * it when the words changed since they were made and both texts are known
 * (`adaptHubRuns` — the save-side half of "styles adapt"), dropped otherwise,
 * never moved onto the wrong letters.
 */
export function withRunChoice(
  elements: HubElementStyles | null | undefined,
  key: HubElementKey,
  range: HubRunRange,
  field: 'font' | 'color' | 'size',
  value: string | number | null,
): HubElementStyles | null {
  const style: HubElementStyle = { ...(elements?.[key] ?? {}) };
  const current = hubRunsForRange(style, range);
  const same = current.find((r) => r.start === range.start && r.end === range.end);
  const others = current.filter((r) => r.end <= range.start || r.start >= range.end);
  const run: Record<string, unknown> = { ...(same ?? {}), start: range.start, end: range.end };
  if (value === null || (field === 'size' && value === HUB_ELEMENT_SIZE_BASE)) delete run[field];
  else run[field] = value;
  const next: Record<string, unknown> = { ...(elements ?? {}) };
  const { was: _was, ...rest } = style;
  next[key] = { ...rest, runs: [...others, run], ...anchorOf(range) };
  return sanitizeHubElements(next);
}

/**
 * Every run on this range (or overlapping it) gone. The range is measured on
 * the text as drawn now, so the runs are first laid on THAT text (adapted, as
 * `withRunChoice` does) — never filtered by offsets into words that changed.
 */
export function withoutRuns(
  elements: HubElementStyles | null | undefined,
  key: HubElementKey,
  range: HubRunRange | { start: number; end: number } | null,
): HubElementStyles | null {
  const style: HubElementStyle = { ...(elements?.[key] ?? {}) };
  const next: Record<string, unknown> = { ...(elements ?? {}) };
  if (range && 'of' in range) {
    const runs = hubRunsForRange(style, range).filter((r) => r.end <= range.start || r.start >= range.end);
    const { was: _was, ...rest } = style;
    next[key] = { ...rest, runs, ...anchorOf(range) };
    return sanitizeHubElements(next);
  }
  const runs = range ? (style.runs ?? []).filter((r) => r.end <= range.start || r.start >= range.end) : [];
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
const DURING_KF: Record<'drift', string> = { drift: 'el-during-drift' };
/** Fast · Regular · Gentle on the clock — the shipped quick · normal · slow. Gentle is the slow, eased one. */
const SPEED_DURATION: Record<MotionSpeed, HubElDuration> = { fast: 'quick', regular: 'normal', gentle: 'slow' };
/** How far a part travels: 18px in, 22px out — the distances `el-in-rise` / `el-out-lift` shipped with. */
const EL_IN_DIST = [18, 18] as const;
const EL_OUT_DIST = [22, 22] as const;

/**
 * 🔁 A COMBINATION THAT SHIPPED KEEPS ITS SHIPPED KEYFRAME. Fade alone, Fade +
 * Move from below (Rise), Fade + Move to the top (Lift away), Fade + Settle back
 * are drawn by the very `@keyframes` they were drawn by before — so every value
 * already stored renders exactly as it did. Any other combination is ONE
 * composed keyframe, `el-in-mix` / `el-out-mix`, whose far end is three custom
 * properties built from closed-set keys (`motionFxVars`).
 */
const IN_LEGACY_KF: ReadonlyArray<[MotionFx, string]> = [
  [HUB_EL_IN_AS_FX.fade, 'el-in-fade'],
  [HUB_EL_IN_AS_FX.rise, 'el-in-rise'],
];
const OUT_LEGACY_KF: ReadonlyArray<[MotionFx, string]> = [
  [HUB_EL_OUT_AS_FX.fade, 'el-out-fade'],
  [HUB_EL_OUT_AS_FX.lift, 'el-out-lift'],
  [HUB_EL_OUT_AS_FX.settle, 'el-out-settle'],
];
/** The In's keyframe name, and the custom properties a composed one reads. */
export function hubElInKeyframe(fx: MotionFx): { name: string; vars: Array<[string, string]> } {
  const legacy = IN_LEGACY_KF.find(([f]) => sameMotionFx(f, fx));
  return legacy ? { name: legacy[1], vars: [] } : { name: 'el-in-mix', vars: motionFxVars(fx, 'in', '--el-in', EL_IN_DIST) };
}
export function hubElOutKeyframe(fx: MotionFx): { name: string; vars: Array<[string, string]> } {
  const legacy = OUT_LEGACY_KF.find(([f]) => sameMotionFx(f, fx));
  return legacy ? { name: legacy[1], vars: [] } : { name: 'el-out-mix', vars: motionFxVars(fx, 'out', '--el-out', EL_OUT_DIST) };
}

/**
 * 🧭 WHERE THE ELEMENT SITS decides which scroll its "Follows the scroll" follows.
 *
 *   page   an ordinary scene — `view()`, the element's own trip across the screen.
 *   hero   the invitation card. It is ON SCREEN WHEN THE PAGE OPENS, so there is
 *          no scroll for an In to follow: a `view()` In had already finished
 *          before the guest saw anything (measured: `finished` at load). Its In
 *          plays on arrival instead — exactly what the Maker's Play button
 *          shows — and its Out still follows the scroll.
 *   scrub  a pinned Scrub scene. Its frame is PINNED (sticky) and, when a
 *          scene follows it in the run, a SCROLL CONTAINER too (`overflow-y:
 *          auto`, so a tall scene can scroll inside itself before it hands
 *          over). `view()` binds to the NEAREST scroll container — one that
 *          never scrolls — and a pinned box does not travel anyway. Measured:
 *          the part's In read `none` at every position through the run. So it
 *          follows the scene's own named timeline (`--hub-tl`, the spacer that
 *          drives the hold) instead.
 *   auto   an armed Auto run — its scenes are scroll containers too, for the
 *          same reason; it follows the run's timeline (`--hub-tl`).
 */
export type HubElementPlace = 'page' | 'hero' | 'scrub' | 'auto';

/**
 * 🧩 A PART THE COUPLE GAVE NO In (or no Out) STILL MOVES WITH ITS SCENE.
 * The element's own In · During · Out win; what it did NOT choose is the
 * scene's. The scene's per-part arrival and hand-off travel as custom
 * properties (`--hub-part-*`, set in `globals.css` "ONE PART AFTER ANOTHER"),
 * so the element's rule — which must out-rank the scene's — can put the
 * scene's slot back into its own list. Before this, Drift on a part of a
 * one-after-another scene REPLACED the part's arrival (measured: the part
 * carried `el-during-drift` and nothing else). Unset anywhere else → `none`.
 */
const SCENE_IN_SLOT: MotionSlot = {
  a: 'var(--hub-part-dur, 1s) var(--hub-part-ease, linear) var(--hub-part-delay, 0s) both var(--hub-part-in, none)',
  timeline: 'var(--hub-part-in-tl, auto)',
  range: 'var(--hub-part-in-range, normal)',
};
const SCENE_OUT_SLOT: MotionSlot = {
  a: '1s linear 0s backwards var(--hub-part-out, none)',
  timeline: 'var(--hub-part-out-tl, auto)',
  range: 'var(--hub-part-out-range, normal)',
};

/**
 * One comma-separated animation. 🪤 THE NAME IS WRITTEN LAST, after the fill
 * mode: `none` is a valid fill mode AND a valid name, and the shorthand gives
 * an ambiguous keyword to the fill mode first. Written name-first, a slot whose
 * `var()` fell back to `none` handed its `none` to the fill mode and its real
 * fill (`backwards`) became the NAME — measured, `animation-name` read
 * "none, backwards".
 */
type MotionSlot = { a: string; timeline: string; range: string };

/**
 * ⏩ SPEED, FOLLOWING THE SCROLL — the thumb sets the pace, so Speed is how far
 * it travels: Fast finishes sooner, Gentle stretches it. Regular is exactly the
 * shipped range. Only the ordinary page's `view()` ranges take it: a pinned
 * Scrub scene's ranges are tied to its hold and stay as shipped.
 */
const SCROLL_IN_RANGE: Record<HubElSpeed, string> = { fast: 'entry 0% entry 100%', gentle: 'entry 0% cover 50%' };
const SCROLL_OUT_RANGE: Record<HubElSpeed, string> = { fast: 'exit 0% exit 50%', gentle: 'cover 50% exit 100%' };

/** The timeline and ranges a part's OWN scroll-linked In and Out take, by where it sits. */
const OWN_SCROLL: Record<Exclude<HubElementPlace, 'hero'>, { tl: string; in: string; out: string }> = {
  page: { tl: 'view()', in: 'entry 0% cover 30%', out: 'exit 0% exit 100%' },
  /* On the spacer's timeline, measured from the pin line (`--hub-at` = the
     spacer's top on it; globals.css "A SCENE IS AS TALL AS ITS CONTENT — SCRUB
     TOO"): the scene fades in while that top is 0.6 → 0.1 step below the line
     and hands over from half a step past it. The part arrives as the scene
     settles and leaves exactly as the hand-over begins. */
  scrub: {
    tl: 'var(--hub-tl)',
    in: 'cover calc(var(--hub-at) - 0.1 * var(--hub-step)) cover calc(var(--hub-at) + 0.3 * var(--hub-step))',
    out: 'cover calc(var(--hub-at) + 0.25 * var(--hub-step)) cover calc(var(--hub-at) + 0.5 * var(--hub-step))',
  },
  auto: { tl: 'var(--hub-tl)', in: 'entry 0% cover 30%', out: 'exit 0% exit 100%' },
};

/** A part's In · During · Out as animation slots, and whether any slot is its own scroll-linked one. */
function motionSlots(
  motion: HubElementMotion,
  place: HubElementPlace,
  approached: boolean,
): { slots: MotionSlot[]; timedIn: boolean; ownScroll: boolean; vars: Array<[string, string]> } {
  const scroll = motion.timeline === 'scroll';
  const slots: MotionSlot[] = [];
  const vars: Array<[string, string]> = [];
  let timedIn = false;
  let ownScroll = false;
  if (motion.in) {
    const kf = hubElInKeyframe(motion.in);
    vars.push(...kf.vars);
    if (scroll && place !== 'hero') {
      const r = OWN_SCROLL[place];
      ownScroll = true;
      const range = place === 'scrub' || !motion.speed ? r.in : SCROLL_IN_RANGE[motion.speed];
      slots.push({ a: `1s linear 0s backwards ${kf.name}`, timeline: r.tl, range });
    } else {
      timedIn = true;
      const dur = scroll ? DURATION_S.normal : DURATION_S[SPEED_DURATION[motion.speed ?? 'regular']];
      const delay = scroll ? 0 : DELAY_S[motion.delay ?? 'none'];
      /* 🔑 fill `none`, NOT `backwards`: words move but are NEVER hidden while
         they wait. `backwards` painted the from-keyframe (opacity 0) for the
         whole Delay — measured, the hero's names read opacity 0 for 0.8 s.
         ⏳ And a scene's timed In waits for the guest to GET there: until the
         page's observer marks the scene `.pahina-in` the slot is `none`, and
         the part rests where it is, visible. */
      slots.push({
        a: approached || place === 'hero' ? `${dur}s ${EASE} ${delay}s none ${kf.name}` : '0s none none',
        timeline: 'auto',
        range: 'normal',
      });
    }
  } else if (place !== 'hero') {
    slots.push(SCENE_IN_SLOT);
  }
  if (motion.during === 'drift') {
    slots.push({ a: `7s ease-in-out 0s infinite alternate ${DURING_KF.drift}`, timeline: 'auto', range: 'normal' });
  }
  if (scroll && motion.out) {
    const r = OWN_SCROLL[place === 'hero' ? 'page' : place];
    const kf = hubElOutKeyframe(motion.out);
    vars.push(...kf.vars);
    const range = place === 'scrub' || !motion.outSpeed ? r.out : SCROLL_OUT_RANGE[motion.outSpeed];
    ownScroll = true;
    /* 🔑 `backwards`, NOT `both`. An Out that HOLDS its end state stays gone
       whenever the timeline stops driving it — exactly what an engine without
       scroll timelines did: it ran the Out on a one-second clock and held
       opacity 0 for good. The gate keeps that engine away entirely; this makes
       the Out incapable of it even so. */
    slots.push({ a: `1s linear 0s backwards ${kf.name}`, timeline: r.tl, range });
  } else if (place !== 'hero') {
    slots.push(SCENE_OUT_SLOT);
  }
  return { slots, timedIn, ownScroll, vars };
}

/**
 * The element's animations as ONE declaration set — In, During and Out are
 * comma-separated animations that run together. Returns nothing for an element
 * with no motion of its own (it then moves with its scene).
 *
 * 🔑 ALWAYS ALL THREE PROPERTIES — `animation`, `animation-timeline`,
 * `animation-range`. The shorthand alone left the SCENE's more specific
 * `animation-timeline: view()` in charge: a part set to "Plays once" inside an
 * Editorial scene silently became scroll-driven (measured: `ViewTimeline`,
 * `finished`, on a part meant to play on the clock).
 *
 * ⛔ NEVER WRITTEN BARE. The guest page only ever puts these inside
 * `@supports (animation-timeline: view())` AND
 * `@media (prefers-reduced-motion: no-preference)` — `hubElementSceneCss` for a
 * scene, the `[data-el-motion]` rule in `globals.css` for the hero.
 */
export function hubElementMotionDeclarations(
  motion: HubElementMotion | undefined,
  place: HubElementPlace = 'page',
  approached = true,
): Array<[string, string]> {
  /* 🔁 Read again at the door — a shipped value that reached here unread
     (`rise`, `lift` …) still draws its shipped keyframe, never nothing. */
  if (!motion) return [];
  const { slots, vars } = motionSlots(sanitizeHubElementMotion(motion) ?? {}, place, approached);
  if (slots.length === 0) {
    return [
      ['animation', 'none'],
      ['animation-timeline', 'auto'],
      ['animation-range', 'normal'],
    ];
  }
  /* A composed In / Out's far end rides beside it — closed-set values the one
     `el-in-mix` / `el-out-mix` keyframe reads (`hubElInKeyframe`). */
  return [
    ...vars,
    ['animation', slots.map((x) => x.a).join(', ')],
    ['animation-timeline', slots.map((x) => x.timeline).join(', ')],
    ['animation-range', slots.map((x) => x.range).join(', ')],
  ];
}

/**
 * The element's LOOK — font · colour · size — as `property → value` in CSS
 * spelling. An empty style contributes nothing, so an element the couple never
 * touched renders exactly as before. Its MOTION is deliberately not here: it
 * is only ever written behind the two gates (`hubElementMotionDeclarations`).
 *
 * `zoom` for size: it scales the element from ITS OWN size (a 3rem heading
 * becomes 3.6rem at L) where `font-size: 1.2em` would scale from the parent's.
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
  return out;
}

const camel = (prop: string) => prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/**
 * The hero part's inline style: its look, plus its motion as THREE CUSTOM
 * PROPERTIES — `--el-anim` · `--el-tl` · `--el-range`.
 *
 * 🔑 WHY PROPERTIES AND NOT `animation`: an inline style cannot sit inside
 * `@supports`, and an ungated inline animation is what made words VANISH on
 * older iPhones. An engine without scroll timelines drops
 * `animation-timeline`, plays every animation on a one-second clock, and the
 * Out's old `both` fill then held opacity 0 for good (measured: the date, the
 * line and the time at opacity 0 at rest). A custom property does nothing by
 * itself; ONE gated rule in `globals.css` (`[data-el-motion]`) turns it into
 * motion, so an engine that fails the gate simply shows the words.
 * The part carries `data-el-motion` (`hubElementMotionAttr`) for that rule.
 */
export function hubElementInlineStyle(
  style: HubElementStyle | null | undefined,
  opts: { editor?: boolean } = {},
): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const [prop, value] of hubElementDeclarations(style, opts)) out[camel(prop)] = value;
  for (const [prop, value] of hubElementHeroMotionVars(style)) out[prop] = value;
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * A hero part's motion as the three custom properties the gated
 * `[data-el-motion]` rule reads — ONE list, written by the guest page
 * (`hubElementInlineStyle`) and by the Maker canvas's instant preview
 * (`editor-bridge.tsx`), so the two cannot disagree. Empty when the part has no
 * motion of its own.
 */
export function hubElementHeroMotionVars(style: HubElementStyle | null | undefined): Array<[string, string]> {
  const decl = hubElementMotionDeclarations(style?.motion, 'hero');
  const motion = Object.fromEntries(decl);
  if (!motion.animation) return [];
  return [
    ...decl.filter(([p]) => p.startsWith('--el-')),
    ['--el-anim', motion.animation],
    ['--el-tl', motion['animation-timeline'] ?? 'auto'],
    ['--el-range', motion['animation-range'] ?? 'normal'],
  ];
}

/** `data-el-motion` on a hero part that moves on its own — the hook the one gated rule reads. */
export function hubElementMotionAttr(style: HubElementStyle | null | undefined): { 'data-el-motion'?: '' } {
  return style?.motion ? { 'data-el-motion': '' } : {};
}

/**
 * A run's declarations — font · colour · size (`em`, so it scales from the
 * element's own size). ONE list, read by the guest page (`hubRunInlineStyle`)
 * and by the Maker canvas's instant preview (`editor-bridge.tsx`).
 */
export function hubRunDeclarations(run: HubElementRun): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (run.font) {
    const f = HUB_FONT_BY_KEY[run.font];
    out.push(['font-family', `var(${f.cssVar}), ${f.fallback}`]);
  }
  if (run.color) out.push(['color', run.color]);
  const pct = hubElementSizePct(run.size);
  if (pct) out.push(['font-size', `${pct / 100}em`]);
  return out;
}

/** A run's inline style — `hubRunDeclarations` as a React style. */
export function hubRunInlineStyle(run: HubElementRun): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [prop, value] of hubRunDeclarations(run)) out[camel(prop)] = value;
  return out;
}

/**
 * ⚡ EVERY PROPERTY A HERO PART'S INLINE STYLE CAN CARRY, split into the look
 * (`hubElementDeclarations`) and the motion (`hubElementHeroMotionVars` — custom
 * properties since the motion moved behind the gate; the old `animation`
 * longhands stay listed so a canvas still holding one from before is cleared
 * too). The Maker canvas's instant preview (`editor-bridge.tsx`)
 * clears exactly these before it lays a new choice on a part, so a choice taken
 * away (↺) leaves nothing behind — and it touches the motion ones ONLY when the
 * motion changed, because re-writing an animation restarts it, and a font
 * change must not replay the part's entrance. `element-preview.test.ts` holds
 * that the two lists cover every property the declarations can emit.
 */
export const HUB_ELEMENT_LOOK_PROPS = [
  'font-family',
  'font-weight',
  'font-style',
  'text-decoration-line',
  'color',
  'zoom',
  'text-align',
  'justify-content',
  'line-height',
  'letter-spacing',
  'opacity',
  'display',
] as const;
export const HUB_ELEMENT_MOTION_PROPS = [
  '--el-anim',
  '--el-tl',
  '--el-range',
  '--el-in-o',
  '--el-in-t',
  '--el-in-f',
  '--el-out-o',
  '--el-out-t',
  '--el-out-f',
  'animation',
  'animation-timeline',
  'animation-range',
] as const;

/**
 * ✍ THE TEXT, CUT INTO SEGMENTS BY ITS RUNS — what the guest page renders.
 *
 * `segmentStart` is where this piece of text sits inside the element's whole
 * text (the names are three pieces: first · joiner · second). The runs are the
 * ones `hubRunsOn` lays on that whole text: as made while it is unchanged,
 * ADAPTED when it changed and the old text is known, none otherwise — never on
 * different letters.
 */
export function hubTextSegments(
  text: string,
  style: HubElementStyle | null | undefined,
  whole: { text: string; segmentStart: number },
): Array<{ text: string; run: HubElementRun | null }> {
  const runs = hubRunsOn(style, whole.text);
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
 * 🎯 THE ELEMENT'S MOTION OUT-RANKS EVERY SCENE RULE — by one ID's worth of
 * specificity, from a `:not()` of an id nothing carries.
 *
 * The scene addresses the same parts with rules up to (0,5,0) — the Scrub
 * run's first-child `animation: none`, the one-after-another nth-child
 * ranges — and the element's rule was (0,2,1). Measured, three ways the
 * couple's own choice lost: a part's own In inside a Scrub scene was switched
 * off, "Plays once" inside Editorial followed the scroll, and Drift replaced a
 * part's arrival. `!important` is NOT the fix: it would also beat the Maker's
 * Play button, which replays an element by writing its inline style.
 */
const OWN = ':not(#el-own)';
const sideways = (fx: MotionFx | undefined) => Boolean(fx?.move && fx.move !== 'above' && fx.move !== 'below');
const GATE_OPEN = '@supports (animation-timeline: view()){@media (prefers-reduced-motion: no-preference){';
const SCENES_GATE_OPEN = '@supports (animation-range: entry 0% exit 100%) and (timeline-scope: none){';

/**
 * THE GUEST PAGE'S STYLE FOR ONE SCENE — CSS text, or null when there is none.
 *
 * Rendered as `<style hidden data-hub-els="<scope>">` IMMEDIATELY AFTER the
 * scene, and addressed with `:has(+ style[data-hub-els="…"])`, so no widget is
 * wrapped or edited and the scene keeps its place as its parent's direct child
 * (`.hub-scene > section` draws the card). The LOOK is `!important` because it
 * is the element's OWN choice: the Keynote rule is that it wins over the
 * theme's.
 *
 * 🔒 THE MOTION IS WRITTEN ONLY INSIDE BOTH GATES — `@supports
 * (animation-timeline: view())` and `prefers-reduced-motion: no-preference` —
 * the canvas's own fail-visible rule (`globals.css`, "THE EVENT HUB CANVAS").
 * An engine that fails either shows every word, at rest. Then, per place:
 *
 *   · a timed In waits for `.pahina-in` — the page's one observer
 *     (`PahinaMotionObserver`) marks the scene as the guest reaches it;
 *   · inside a pinned Scrub scene or an armed Auto run, the part's own
 *     scroll-linked In and Out follow `--hub-tl` (`HubElementPlace`).
 */
export function hubElementSceneCss(
  scope: string,
  elements: HubElementStyles | null | undefined,
  opts: { editor?: boolean } = {},
): string | null {
  const safe = hubElementScope(scope);
  if (!safe || !elements) return null;
  const host = `:has(+ style[data-hub-els="${safe}"])`;
  const looks: string[] = [];
  const moving: string[] = [];
  const scenes: string[] = [];
  const decl = (d: Array<[string, string]>) => d.map(([p, v]) => `${p}:${v}`).join(';');
  let clipX = false;
  for (const key of HUB_SCENE_ELEMENT_KEYS) {
    const style = elements[key];
    const target = `:is(${HUB_SCENE_ELEMENT_SELECTOR[key]})`;
    /* 🙈 A HIDDEN PART: gone for a guest, ghosted in the Maker's canvas. The
       canvas is told apart by the navigator's markers, which exist ONLY there
       (`data-maker-section`, `site-body.tsx`) — no editor flag reaches a frame. */
    if (style?.hidden) {
      const at = `${host} ${target}`;
      if (opts.editor === undefined) {
        looks.push(`:root:not(:has([data-maker-section])) ${at}{display:none !important}`);
        looks.push(`:root:has([data-maker-section]) ${at}{opacity:0.3 !important}`);
      } else {
        looks.push(`${at}{${opts.editor ? 'opacity:0.3' : 'display:none'} !important}`);
      }
    }
    const look = hubElementDeclarations(style ? { ...style, hidden: undefined } : style, opts);
    if (look.length > 0) looks.push(`${host} ${target}{${look.map(([p, v]) => `${p}:${v} !important`).join(';')}}`);
    const motion = style?.motion ? (sanitizeHubElementMotion(style.motion) ?? {}) : null;
    if (!motion) continue;
    /* ↔ A part that travels SIDEWAYS must not widen the page — the scene's own
       rule (`.hub-in-move > .hub-canvas-body`, globals.css), for a part's move. */
    if (sideways(motion.in) || sideways(motion.out)) clipX = true;
    const { timedIn, ownScroll } = motionSlots(motion, 'page', true);
    const at = (place: HubElementPlace, approached: boolean) => decl(hubElementMotionDeclarations(motion, place, approached));
    moving.push(`${host} ${target}${OWN}{${at('page', false)}}`);
    if (timedIn) moving.push(`.pahina-in${host} ${target}${OWN}{${at('page', true)}}`);
    if (!ownScroll) continue;
    for (const [place, prefix] of [
      ['scrub', '.hub-scrub > '],
      ['auto', '.hub-arun[data-armed] > .hub-auto > '],
    ] as const) {
      scenes.push(`${prefix}${host} ${target}${OWN}{${at(place, false)}}`);
      if (timedIn) scenes.push(`${prefix}.pahina-in${host} ${target}${OWN}{${at(place, true)}}`);
    }
  }
  const css = [...looks];
  if (clipX) moving.unshift(`${host}{overflow-x:clip}`);
  if (moving.length > 0 || scenes.length > 0) {
    css.push(
      `${GATE_OPEN}\n${moving.join('\n')}${scenes.length > 0 ? `\n${SCENES_GATE_OPEN}\n${scenes.join('\n')}\n}` : ''}\n}}`,
    );
  }
  return css.length > 0 ? css.join('\n') : null;
}

/**
 * ✍ A SCENE'S RUNS, AS THE GUEST PAGE CARRIES THEM — the value of the scene's
 * `<style data-hub-runs>` (`HubCanvasFrame`), or null when no part of the scene
 * has a run. Only what laying a run needs: its runs, `of` and `was`, per part.
 * Read back through `readHubSceneRuns`, which sanitizes it again — the page
 * never trusts its own markup to be a closed set.
 */
export function hubSceneRunsAttr(elements: HubElementStyles | null | undefined): string | null {
  if (!elements) return null;
  const out: Partial<Record<HubSceneElementKey, Pick<HubElementStyle, 'runs' | 'of' | 'was'>>> = {};
  for (const key of HUB_SCENE_ELEMENT_KEYS) {
    const style = elements[key];
    if (!style?.runs?.length || !style.of) continue;
    out[key] = { runs: style.runs, of: style.of, ...(style.was !== undefined ? { was: style.was } : {}) };
  }
  return Object.keys(out).length > 0 ? JSON.stringify(out) : null;
}

/** `hubSceneRunsAttr`'s value, read back and sanitized; null when unusable. */
export function readHubSceneRuns(raw: string | null | undefined): HubElementStyles | null {
  if (!raw) return null;
  try {
    return sanitizeHubElements(JSON.parse(raw));
  } catch {
    return null;
  }
}

/* ── THE SHEET'S HELPERS ────────────────────────────────────────────────── */

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
