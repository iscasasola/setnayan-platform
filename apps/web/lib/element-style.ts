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

import { HUB_FONT_BY_KEY, HUB_FONTS, sanitizeHubFontKey, type HubFontKey } from '@/lib/hub-fonts';
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

/** What each element can take. The mark is a drawing: it has no font or colour of its own here. */
export const HUB_ELEMENT_FIELDS: Record<HubElementKey, readonly HubElementField[]> = {
  eyebrow: ['font', 'color', 'size', 'anim'],
  mark: ['size', 'anim'],
  names: ['font', 'color', 'size', 'anim'],
  line: ['font', 'color', 'size', 'anim'],
  date: ['font', 'color', 'size', 'anim'],
  time: ['font', 'color', 'size', 'anim'],
  label: ['font', 'color', 'size', 'anim'],
  heading: ['font', 'color', 'size', 'anim'],
  body: ['font', 'color', 'size', 'anim'],
};

/* ── THE FOUR CHOICES ───────────────────────────────────────────────────── */

export type HubElementField = 'font' | 'color' | 'size' | 'anim';

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

/**
 * THE ANIMATION — the scene presets' own four names (`HUB_MOTION_PRESETS` in
 * `lib/hub-canvas.ts`; `element-style.test.ts` holds the two lists equal). Kept
 * as its own constant so this module imports nothing from the canvas contract,
 * which imports this one.
 */
export const HUB_ELEMENT_ANIMS = ['still', 'calm', 'editorial', 'cinematic'] as const;
export type HubElementAnim = (typeof HUB_ELEMENT_ANIMS)[number];
export const HUB_ELEMENT_ANIM_LABEL: Record<HubElementAnim, string> = {
  still: 'Still',
  calm: 'Calm',
  editorial: 'Editorial',
  cinematic: 'Cinematic',
};

/**
 * What each animation does to ONE element — the scene presets' own arrivals
 * (`HUB_PRESET_BODY`): the same keyframes (`hub-in-*` in `globals.css`), the
 * same durations, the same ease. `still` is "this element does not move", which
 * also stops the page's own arrival on it.
 */
const ANIM_BODY: Record<HubElementAnim, { keyframe: string; duration: number } | null> = {
  still: null,
  calm: { keyframe: 'hub-in-fade', duration: 1.1 },
  editorial: { keyframe: 'hub-in-movefade-below', duration: 1.1 },
  cinematic: { keyframe: 'hub-in-movefade-left', duration: 1.8 },
};

/** One element, as the couple left it. Every field absent = the theme's own. */
export type HubElementStyle = {
  font?: HubFontKey;
  /** `#rrggbb`, lowercased. */
  color?: string;
  /** Never `m` — see `HUB_ELEMENT_SIZES`. */
  size?: Exclude<HubElementSize, 'm'>;
  anim?: HubElementAnim;
};

export type HubElementStyles = Partial<Record<HubElementKey, HubElementStyle>>;

const HEX = /^#[0-9a-f]{6}$/;

/** `#rrggbb`, or null. The only shape a colour may take. */
export function hubElementColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  return HEX.test(v) ? v : null;
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
  if (fields.includes('anim') && (HUB_ELEMENT_ANIMS as readonly unknown[]).includes(src.anim)) {
    out.anim = src.anim as HubElementAnim;
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
  field: HubElementField,
  value: string | null,
): HubElementStyles | null {
  const next: Record<string, unknown> = { ...(elements ?? {}) };
  const style: Record<string, unknown> = { ...(elements?.[key] ?? {}) };
  if (value === null || (field === 'size' && value === 'm')) delete style[field];
  else style[field] = value;
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

/**
 * The CSS declarations one style contributes, as `property → value` in CSS
 * spelling. An empty style contributes nothing, so an element the couple never
 * touched renders exactly as before.
 *
 * `zoom` for size: it scales the element from ITS OWN size (a 3rem heading
 * becomes 3.6rem at L) where `font-size: 1.2em` would scale from the parent's.
 *
 * The animation is scroll-driven where the browser can (`animation-timeline:
 * view()`) and plays once on arrival where it cannot. `backwards` fill only —
 * no transform is HELD once it lands (`an-identity-transform-unpins-every-
 * fixed-child.test.ts`), and a guest who asked for less motion gets the global
 * reduced-motion freeze in `globals.css`, whose `!important` lives in a layer
 * and so outranks anything written here.
 */
export function hubElementDeclarations(
  style: HubElementStyle | null | undefined,
  /**
   * Play once on arrival instead of following the scroll. The hero's parts ARE
   * the first screen (`data-pahina-first-screen`): already in view when the page
   * opens, so a scroll-driven entrance would sit finished and never be seen.
   */
  opts: { timed?: boolean } = {},
): Array<[string, string]> {
  if (!style) return [];
  const out: Array<[string, string]> = [];
  if (style.font) {
    const f = HUB_FONT_BY_KEY[style.font];
    out.push(['font-family', `var(${f.cssVar}), ${f.fallback}`]);
  }
  if (style.color) out.push(['color', style.color]);
  if (style.size) out.push(['zoom', String(HUB_ELEMENT_SIZE_SCALE[style.size])]);
  if (style.anim) {
    const body = ANIM_BODY[style.anim];
    if (!body) {
      out.push(['animation', 'none']);
    } else {
      out.push(['animation', `${body.keyframe} ${body.duration}s cubic-bezier(0.22, 0.61, 0.36, 1) backwards`]);
      if (!opts.timed) {
        out.push(['animation-timeline', 'view()']);
        out.push(['animation-range', 'entry 0% cover 30%']);
      }
    }
  }
  return out;
}

/** The same declarations as a React inline style (the hero's parts — timed, see above). */
export function hubElementInlineStyle(style: HubElementStyle | null | undefined): Record<string, string> | undefined {
  const decls = hubElementDeclarations(style, { timed: true });
  if (decls.length === 0) return undefined;
  const out: Record<string, string> = {};
  for (const [prop, value] of decls) {
    out[prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = value;
  }
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

/** The fonts the sheet offers — the library the app already ships, in its order. */
export const HUB_ELEMENT_FONTS = HUB_FONTS;

/**
 * Does this colour read on this ground? The WCAG body-text floor is 4.5:1. The
 * sheet WARNS below it and never blocks — the couple may want a quiet accent.
 */
export const HUB_ELEMENT_MIN_CONTRAST = 4.5;
export function hubElementContrast(color: string, ground: string): { ratio: number; ok: boolean } {
  const ratio = contrastRatio(color, ground);
  return { ratio, ok: ratio >= HUB_ELEMENT_MIN_CONTRAST };
}
