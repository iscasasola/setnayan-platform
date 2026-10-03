/**
 * lib/hub-buttons.ts — LOOK › BUTTONS: THE HOST STYLES THE EVENT HUB'S BUTTONS.
 *
 * Owner, 2026-10-04 (DECISION_LOG "LOOK › BUTTONS — THE HOST STYLES THE EVENT
 * HUB'S BUTTONS"), verbatim: *"yes we have buttons because the buttons for
 * reply your answer, or other buttons that may be part of the event hub."* →
 * *"create them."*
 *
 * ONE choice for the whole Event Hub, three dropdowns in the Maker's Look:
 *
 *   · Shape  — Theme’s · Square · Rounded · Pill
 *   · Fill   — Theme’s · Solid · Outline
 *   · Colour — Theme’s · one of the event's palette colours
 *
 * ── WHERE EACH ONE IS STORED ────────────────────────────────────────────────
 *   · Shape + Fill → `events.site_button_style`, ONE text column holding
 *     `<shape>-<fill>` (e.g. `pill-outline`, `theme-solid`). NULL = both the
 *     theme's — "Auto is an absence" (`lib/hub-canvas.ts`), so an event that never
 *     chose renders byte-identically. `theme-theme` is never stored.
 *   · Colour → `events.site_button_color`, the column the Colours section has
 *     written since 2026-09-11. 🔑 NOT A SECOND COLUMN: the button colour is one
 *     fact, and two homes for it would be two mechanisms that disagree.
 *
 * Both are drafted (`lib/hub-draft.ts`, `HUB_DRAFT_LOOK_COLUMNS`) and go live at
 * Apply. Both are FREE (`HUB_FREE_LOOK_EVENT_COLUMNS`): the owner's 2026-09-28
 * line — *"free to change design … color … only when you start adding themes
 * will it be pro"* — and a button's shape is design.
 *
 * ── LEGIBILITY: NEVER OFFERED, NEVER RENDERED ───────────────────────────────
 *   · A solid button's LABEL is picked by the shipped rule (`hubLegibility`'s
 *     flat-colour branch — the theme's own ink when it clears AA, else the
 *     extreme `readableTextOn` chose). Black or white always clears 4.5:1 on
 *     some side of any colour, so a label is always found; `buttonLabelOn` still
 *     measures, and a colour whose label would not reach AA is dropped.
 *   · An OUTLINE button draws its label and border in the colour itself, so the
 *     COLOUR must clear AA against the ground the button sits on — the page's
 *     paper and its plates, as the page actually paints them. When it cannot,
 *     the button is drawn SOLID instead (`resolveHubButtons`), and the Maker does
 *     not offer Outline for that colour (`hubButtonOffers`).
 *
 * Pure. No I/O. Type-only theme import, so the Maker's lazy chunk and the Node
 * test runner can both load it.
 */
import { AA_BODY, contrastRatio, hubLegibility } from '@/lib/hub-legibility';
import { HOUSE_PAPER, hubThemePageTokens } from '@/lib/hub-theme-tokens';
import type { InviteTheme } from '@/lib/invite-themes';

export const HUB_BUTTON_SHAPES = ['theme', 'square', 'rounded', 'pill'] as const;
export type HubButtonShape = (typeof HUB_BUTTON_SHAPES)[number];

export const HUB_BUTTON_FILLS = ['theme', 'solid', 'outline'] as const;
export type HubButtonFill = (typeof HUB_BUTTON_FILLS)[number];

export const HUB_BUTTON_SHAPE_LABEL: Readonly<Record<HubButtonShape, string>> = {
  theme: 'Theme’s',
  square: 'Square',
  rounded: 'Rounded',
  pill: 'Pill',
};

export const HUB_BUTTON_FILL_LABEL: Readonly<Record<HubButtonFill, string>> = {
  theme: 'Theme’s',
  solid: 'Solid',
  outline: 'Outline',
};

/** The corner each chosen shape draws. "Theme’s" draws nothing — the button keeps its own. */
export const HUB_BUTTON_RADIUS: Readonly<Record<Exclude<HubButtonShape, 'theme'>, string>> = {
  square: '0px',
  rounded: '12px',
  pill: '999px',
};

export type HubButtonStyle = { shape: HubButtonShape; fill: HubButtonFill };

/**
 * Every value `events.site_button_style` may hold — the CHECK's vocabulary. The
 * migration's IN list is compared with this by `hub-buttons.test.ts`.
 */
export const HUB_BUTTON_STYLE_VALUES: readonly string[] = HUB_BUTTON_SHAPES.flatMap((s) =>
  HUB_BUTTON_FILLS.map((f) => `${s}-${f}`),
).filter((v) => v !== 'theme-theme');

const isShape = (v: unknown): v is HubButtonShape => (HUB_BUTTON_SHAPES as readonly unknown[]).includes(v);
const isFill = (v: unknown): v is HubButtonFill => (HUB_BUTTON_FILLS as readonly unknown[]).includes(v);

/** The stored value → a style. Absent, junk or `theme-theme` → both the theme's. */
export function parseHubButtonStyle(raw: unknown): HubButtonStyle {
  if (typeof raw === 'string' && HUB_BUTTON_STYLE_VALUES.includes(raw)) {
    const [shape, fill] = raw.split('-');
    if (isShape(shape) && isFill(fill)) return { shape, fill };
  }
  return { shape: 'theme', fill: 'theme' };
}

/** A style → the stored value, or null for "both the theme's" (Auto is an absence). */
export function encodeHubButtonStyle(style: HubButtonStyle): string | null {
  const v = `${style.shape}-${style.fill}`;
  return v === 'theme-theme' ? null : v;
}

/**
 * The draft's parse (`sanitizeHubDraftEventValue`): a known value, `null` to go
 * back to the theme's, or `undefined` — dropped, never repaired.
 */
export function sanitizeHubButtonStyle(raw: unknown): string | null | undefined {
  if (raw === null || raw === '' || raw === 'theme-theme') return null;
  return typeof raw === 'string' && HUB_BUTTON_STYLE_VALUES.includes(raw) ? raw : undefined;
}

/* ── colours ─────────────────────────────────────────────────────────────── */

const HEX6 = /^#[0-9a-f]{6}$/i;

/** `"r g b"` channels (a `--color-*` token) or `#rrggbb` → `#rrggbb`, or null. */
export function hexOfToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (HEX6.test(v)) return v.toLowerCase();
  const parts = v.split(/\s+/).map(Number);
  if (parts.length !== 3 || !parts.every((p) => Number.isInteger(p) && p >= 0 && p <= 255)) return null;
  return `#${parts.map((p) => p.toString(16).padStart(2, '0')).join('')}`;
}

/** House's own button (`--color-mulberry` at the root: #C24E25) and paper. */
export const HOUSE_BUTTON_FILL = '#c24e25';
const HOUSE_PLATE = '#f1f1f0';

/**
 * What the page paints, as the page paints it: the composed custom properties
 * the guest scope wears (mood-board palette → the couple's colours → ombré →
 * plate ink), read for the three facts a button needs. Missing = the theme's own.
 */
export type HubButtonPage = {
  /** The fill a button wears today when the host chose no colour. */
  fill: string;
  /** The grounds a button sits on: the page's paper and its plates. */
  grounds: readonly string[];
};

export function hubButtonPage(theme: InviteTheme, vars: Readonly<Record<string, string>> | null): HubButtonPage {
  const house = theme.id === 'house';
  const tokens = house ? null : hubThemePageTokens(theme);
  const fill = hexOfToken(vars?.['--color-mulberry']) ?? tokens?.cta ?? HOUSE_BUTTON_FILL;
  const paper = hexOfToken(vars?.['--color-cream']) ?? (house ? HOUSE_PAPER : theme.palette.canvas);
  const plate = hexOfToken(vars?.['--color-paper-deep']) ?? (house ? HOUSE_PLATE : theme.palette.surface);
  return { fill, grounds: paper === plate ? [paper] : [paper, plate] };
}

/**
 * The label a SOLID button of `fill` wears — the shipped rule's ink, measured.
 * Null when nothing reaches AA (the colour is then never offered or rendered).
 */
export function buttonLabelOn(theme: InviteTheme, fill: string): string | null {
  const rule = hubLegibility(theme, { kind: 'color', hex: fill }).ink;
  if (contrastRatio(rule, fill) >= AA_BODY) return rule;
  const best = contrastRatio('#000000', fill) >= contrastRatio('#ffffff', fill) ? '#000000' : '#ffffff';
  return contrastRatio(best, fill) >= AA_BODY ? best : null;
}

/** Does `colour` read as an OUTLINE button's label on every ground the page paints? */
export function outlineReads(colour: string, grounds: readonly string[]): boolean {
  return grounds.length > 0 && grounds.every((g) => contrastRatio(colour, g) >= AA_BODY);
}

/** The worst contrast of `colour` over `grounds` (for the Maker's sample and the guard). */
export function worstOn(colour: string, grounds: readonly string[]): number {
  return Math.min(...grounds.map((g) => contrastRatio(colour, g)));
}

/**
 * A solid fill's hover: moved AWAY from its label (darker under a light label,
 * lighter under a dark one), so a thumb resting on it can only make the pair
 * read better — the rule `lib/invite-button-color.ts` measured for the doors.
 */
export function hoverAwayFrom(fill: string, label: string): string {
  // A dark label (it reads best on white) → lighten the fill; a light label → darken it.
  const toward = contrastRatio(label, '#ffffff') > contrastRatio(label, '#000000') ? 255 : 0;
  const n = parseInt(fill.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c * 0.86 + toward * 0.14));
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/* ── what the page wears ─────────────────────────────────────────────────── */

/**
 * What the guest scope wears for the buttons: two attributes and their custom
 * properties. Null = nothing chosen — the page renders exactly as before.
 *
 *   · `shape` → `data-hub-btn-shape` + `--hub-btn-radius`;
 *   · `paint` → `data-hub-btn-paint` + `--hub-btn-fill` · `--hub-btn-label` ·
 *     `--hub-btn-border` · `--hub-btn-hover`, plus the SOLID pair
 *     (`--hub-btn-solid` · `--hub-btn-solid-label`) the RSVP's picked answer
 *     wears, which is always a fill — a picked answer must look picked.
 */
export type HubButtonsLook = {
  shape: Exclude<HubButtonShape, 'theme'> | null;
  paint: 'solid' | 'outline' | null;
  vars: Record<string, string>;
};

export function resolveHubButtons(input: {
  style: unknown;
  colour: unknown;
  theme: InviteTheme;
  page: HubButtonPage;
}): HubButtonsLook | null {
  const { shape, fill } = parseHubButtonStyle(input.style);
  const vars: Record<string, string> = {};
  const look: HubButtonsLook = { shape: null, paint: null, vars };

  if (shape !== 'theme') {
    look.shape = shape;
    vars['--hub-btn-radius'] = HUB_BUTTON_RADIUS[shape];
  }

  const chosen = typeof input.colour === 'string' && HEX6.test(input.colour.trim()) ? input.colour.trim().toLowerCase() : null;
  if (fill !== 'theme' || chosen) {
    // The host's colour when its label reaches AA; else the page's own fill.
    const ownLabel = chosen ? buttonLabelOn(input.theme, chosen) : null;
    const colour = chosen && ownLabel ? chosen : input.page.fill;
    const label = (chosen && ownLabel) || buttonLabelOn(input.theme, colour);
    if (label) {
      vars['--hub-btn-solid'] = colour;
      vars['--hub-btn-solid-label'] = label;
      if (fill === 'outline' && outlineReads(colour, input.page.grounds)) {
        look.paint = 'outline';
        vars['--hub-btn-fill'] = 'transparent';
        vars['--hub-btn-label'] = colour;
        vars['--hub-btn-border'] = colour;
        vars['--hub-btn-hover'] = 'transparent';
      } else {
        // Solid — chosen, the theme's fill with a chosen colour, or an Outline that would not read.
        look.paint = 'solid';
        vars['--hub-btn-fill'] = colour;
        vars['--hub-btn-label'] = label;
        vars['--hub-btn-border'] = colour;
        vars['--hub-btn-hover'] = hoverAwayFrom(colour, label);
      }
    }
  }

  return look.shape || look.paint ? look : null;
}

/* ── what the Maker offers ───────────────────────────────────────────────── */

export type HubButtonColourOffer = { hex: string; label: string };

/**
 * The colours Look › Buttons › Colour offers, besides "Theme’s": the event's
 * palette colours whose solid label reaches AA — and, when Fill is Outline,
 * only those that also read as an outline on the page. The saved colour stays
 * listed when it qualifies, so opening the menu never hides what is chosen.
 */
export function hubButtonColourOffers(input: {
  theme: InviteTheme;
  palette: readonly string[];
  saved: string | null;
  fill: HubButtonFill;
  page: HubButtonPage;
}): HubButtonColourOffer[] {
  const seen = new Set<string>();
  const out: HubButtonColourOffer[] = [];
  const all = [...input.palette, ...(input.saved ? [input.saved] : [])];
  for (const raw of all) {
    const hex = typeof raw === 'string' && HEX6.test(raw.trim()) ? raw.trim().toLowerCase() : null;
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);
    if (!buttonLabelOn(input.theme, hex)) continue;
    if (input.fill === 'outline' && !outlineReads(hex, input.page.grounds)) continue;
    out.push({ hex, label: hex.toUpperCase() });
  }
  return out;
}

/** Is Outline offered for this colour (or the theme's own fill, when none is chosen)? */
export function hubButtonOutlineOffered(input: { colour: string | null; page: HubButtonPage }): boolean {
  return outlineReads(input.colour ?? input.page.fill, input.page.grounds);
}
