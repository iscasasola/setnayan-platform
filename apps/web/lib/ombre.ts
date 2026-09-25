/**
 * apps/web/lib/ombre.ts — PLAIN OR OMBRÉ: the page's background, as the couple chose it.
 *
 * Owner, 2026-09-25 (DECISION_LOG "BACKGROUND COLOUR: PLAIN OR APPLE-STYLE
 * OMBRÉ"), verbatim: *"color setup can be like plain color or like apples ombe
 * style."* So the Maker's Colours panel offers two ways to colour the page:
 *
 *   PLAIN — one colour. `events.site_bg_color` holds `#rrggbb`, as it has since
 *           migration 20270930244819. Nothing about it changes here.
 *   OMBRÉ — a soft multi-stop gradient in the spirit of Apple's wallpapers:
 *           2–3 colours the couple picked (or one of the curated presets below),
 *           interpolated in OKLCH so the ramp stays luminous instead of greying
 *           through the middle, laid as one of three shapes.
 *
 * ── STORAGE: THE SAME COLUMN, A SMALL ENCODED SPEC, NO MIGRATION ──────────
 * `site_bg_color` is TEXT with no CHECK (`grep -n site_bg_color supabase/
 * migrations/20270930244819_events_site_custom_colors.sql`), already granted for
 * SELECT and UPDATE (20271005100000) and already in the draft
 * (`HUB_DRAFT_LOOK_COLUMNS`). An ombré is stored in it as
 *
 *     ombre:<shape>:<#rrggbb>,<#rrggbb>[,<#rrggbb>]      e.g. ombre:dawn:#fbf7ef,#ece1cf
 *
 * ≤ 40 characters, one grammar for presets and custom alike (a preset is stored
 * EXPANDED, so a guest render never depends on the preset list still holding
 * it). `parseSiteBackground` is the ONE reader of the column's two shapes; every
 * writer and sanitiser goes through it, so a malformed value is dropped, never
 * repaired — the canvas rule.
 *
 * ── HOW IT REACHES THE PAGE ───────────────────────────────────────────────
 * `guestLookFor` (`app/[slug]/_lib/loaders.ts`) asks `ombreLook(theme, spec)`
 * for the gradient CSS and the vars, and `GuestLookScope` paints the CSS on the
 * page's fixed paper (`GuestGround`) IN PLACE OF the theme's loop — an ombré is
 * a background, the loop is a background, and a guest's phone should not decode
 * a video to hide it behind a gradient (the same rule the couple's own Main
 * background keeps, Maker P10). The host's canvas shows a drafted ombré through
 * the same scope (`HostDraftLook`), so Apply shows nothing new.
 *
 * ── LEGIBILITY IS RE-MEASURED OVER THE WHOLE RAMP, FREE ───────────────────
 * The gradient is sampled at `OMBRE_RAMP_STEPS` points and handed to
 * `hubLegibility(theme, { kind: 'media', samples })` — the theme's two inks are
 * tried over the LIGHTEST and DARKEST sample and the one that needs the lighter
 * veil wins; when neither clears AA bare, the veil it asked for is baked into the
 * CSS as the top layer. Every curated preset is tuned so the veil is 0
 * (`lib/ombre.test.ts` holds it); a couple's own three colours may raise one.
 *
 * ── FREE, BEHIND ONE CONSTANT ─────────────────────────────────────────────
 * Plain colour is free (owner 2026-09-24). The owner has been asked whether the
 * ombré is free or Pro; the controller recommends free, so it ships FREE.
 * `OMBRE_IS_PRO` is the one switch: flip it and an ombré becomes a Pro look —
 * tried in the draft, refused at Apply for a free couple (`eventItemIsPro` in
 * `lib/hub-draft.ts`) and refused by the live writer (`ombreLookChange` in
 * `website/colors/actions.ts`) — with no other line changing.
 *
 * Pure. No I/O. Client-safe (the Maker panel draws the swatches with it).
 */
import { hexOfOklch, oklchOfHex, type Oklch } from '@/lib/color-space';
import { hubLegibility, type HubLegibility } from '@/lib/hub-legibility';
import { refChange, type LookChange } from '@/lib/hub-look-pro';
import type { InviteTheme, InviteThemeId } from '@/lib/invite-themes';

/* ═══════════════════════════════════════════════════════════════════════════
   THE ONE SWITCH
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Is an ombré background a Pro look? FALSE today (owner asked, controller
 * recommends free; plain colour is already free). Flip to `true` and the ombré
 * becomes try-in-draft, pay-at-Apply through the existing gate — nothing else
 * needs to change. ⚠ If it flips, `hub-look-is-pro.test.ts`'s "the background
 * colour must not feed the Pro decision" is the one guard that will (rightly)
 * ask to be re-read.
 */
export const OMBRE_IS_PRO = false;

/* ═══════════════════════════════════════════════════════════════════════════
   THE SPEC
   ═══════════════════════════════════════════════════════════════════════════ */

/** The three shapes — deliberately no more (owner: keep it simple). */
export const OMBRE_SHAPES = ['diagonal', 'glow', 'dawn'] as const;
export type OmbreShape = (typeof OMBRE_SHAPES)[number];

export const OMBRE_SHAPE_LABEL: Record<OmbreShape, string> = {
  diagonal: 'Soft diagonal',
  glow: 'Radial glow',
  dawn: 'Vertical dawn',
};

export const OMBRE_MIN_STOPS = 2;
export const OMBRE_MAX_STOPS = 3;

export type OmbreSpec = {
  shape: OmbreShape;
  /** 2–3 lowercase `#rrggbb`, first to last along the shape. */
  stops: readonly string[];
};

/** What `events.site_bg_color` can hold, read. */
export type SiteBackground = { kind: 'plain'; hex: string } | { kind: 'ombre'; ombre: OmbreSpec };

const HEX6 = /^#[0-9a-f]{6}$/i;
const OMBRE_PREFIX = 'ombre:';

/** A `#rrggbb` (either case) → lowercase, or null. */
export function normalizeHex(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  return HEX6.test(v) ? v.toLowerCase() : null;
}

/** The stored form of an ombré. Always canonical: lowercase, no spaces. */
export function encodeOmbre(spec: OmbreSpec): string {
  return `${OMBRE_PREFIX}${spec.shape}:${spec.stops.join(',')}`;
}

/** `ombre:<shape>:<hex>,<hex>[,<hex>]` → the spec, or null for anything else. */
export function parseOmbre(raw: unknown): OmbreSpec | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  if (!v.startsWith(OMBRE_PREFIX)) return null;
  const [shape, list, ...rest] = v.slice(OMBRE_PREFIX.length).split(':');
  if (rest.length > 0 || !shape || !list) return null;
  if (!(OMBRE_SHAPES as readonly string[]).includes(shape)) return null;
  const stops = list.split(',').map(normalizeHex);
  if (stops.length < OMBRE_MIN_STOPS || stops.length > OMBRE_MAX_STOPS) return null;
  if (stops.some((s) => s === null)) return null;
  return { shape: shape as OmbreShape, stops: stops as string[] };
}

/**
 * THE ONE READER of `site_bg_color`'s two shapes. `null` for a blank or a value
 * this product never wrote — dropped, never repaired.
 */
export function parseSiteBackground(raw: unknown): SiteBackground | null {
  const hex = normalizeHex(raw);
  if (hex) return { kind: 'plain', hex };
  const ombre = parseOmbre(raw);
  return ombre ? { kind: 'ombre', ombre } : null;
}

/** The stored form of either shape — what `parseSiteBackground` reads back. */
export function encodeSiteBackground(bg: SiteBackground): string {
  return bg.kind === 'plain' ? bg.hex : encodeOmbre(bg.ombre);
}

/** Is this stored value an ombré (and not a plain hex, a blank, or noise)? */
export function isOmbreValue(raw: unknown): boolean {
  return parseOmbre(raw) !== null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE RAMP — interpolated in OKLCH so it stays luminous
   ═══════════════════════════════════════════════════════════════════════════ */

/** How many colours the gradient is drawn and measured with. Odd, so t = 0.5 is a sample. */
export const OMBRE_RAMP_STEPS = 9;

/** Below this chroma a colour is grey and its hue is noise — take the other end's. */
const GREY_C = 0.02;

/** One point between two colours, in OKLCH: L and C linear, H along the shorter arc. */
function mixOklch(a: Oklch, b: Oklch, t: number): string {
  const L = a.L + (b.L - a.L) * t;
  const C = a.C + (b.C - a.C) * t;
  let H: number;
  if (a.C < GREY_C && b.C < GREY_C) H = 0;
  else if (a.C < GREY_C) H = b.H;
  else if (b.C < GREY_C) H = a.H;
  else {
    let d = b.H - a.H;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    H = a.H + d * t;
  }
  return hexOfOklch(L, C, H).toLowerCase();
}

/**
 * The gradient's colours from first stop to last, `steps` of them, endpoints
 * included; three stops are two half-ramps. These are BOTH what the CSS draws
 * and what legibility measures — one ramp, so the words are measured over the
 * exact colours the guest sees.
 */
export function ombreRamp(spec: OmbreSpec, steps = OMBRE_RAMP_STEPS): string[] {
  const anchors = spec.stops.map((h) => oklchOfHex(h));
  const segments = anchors.length - 1;
  const out: string[] = [];
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1);
    const seg = Math.min(segments - 1, Math.floor(t * segments));
    const local = t * segments - seg;
    // A sample that lands ON a stop is the couple's own colour exactly — a round
    // trip through OKLCH can move a channel by one, and the swatch they picked
    // should be the swatch they see at that point of the ramp.
    out.push(local === 0 ? spec.stops[seg]! : mixOklch(anchors[seg]!, anchors[seg + 1]!, local));
  }
  out[out.length - 1] = spec.stops[spec.stops.length - 1]!;
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE CSS
   ═══════════════════════════════════════════════════════════════════════════ */

/** `#rrggbb` → `r g b`, the channel triplet the Tailwind tokens hold. */
export function hexChannels(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

function rgba(hex: string, alpha: number): string {
  return `rgba(${hexChannels(hex).split(' ').join(', ')}, ${alpha.toFixed(2)})`;
}

function stopsList(ramp: readonly string[]): string {
  const last = ramp.length - 1;
  return ramp.map((c, i) => `${c} ${((i / last) * 100).toFixed(1)}%`).join(', ');
}

/**
 * The `background-image` value for an ombré — a gradient stack, top layer first.
 *
 *   diagonal — a 160° ramp with a soft light bloom from the top-left corner in
 *              the first colour, so it reads as lit, not as a two-tone fill;
 *   glow     — the ramp radiating from the top centre;
 *   dawn     — the ramp top to bottom.
 *
 * `veil`, when given, is laid over everything as a flat layer — the scrim the
 * legibility rule asked for, baked into the same value so a scene that reads the
 * paper reads the veiled paper. Every character here is a hex digit, a keyword
 * or a number: nothing a couple typed reaches the stylesheet unparsed.
 */
export function ombreCss(spec: OmbreSpec, veil?: { color: string; opacity: number }): string {
  const ramp = ombreRamp(spec);
  const layers: string[] = [];
  if (veil && veil.opacity > 0) {
    const v = rgba(veil.color, veil.opacity);
    layers.push(`linear-gradient(${v}, ${v})`);
  }
  switch (spec.shape) {
    case 'diagonal':
      layers.push(
        `radial-gradient(ellipse 110% 75% at 12% 0%, ${rgba(ramp[0]!, 0.55)} 0%, ${rgba(ramp[0]!, 0)} 65%)`,
        `linear-gradient(160deg, ${stopsList(ramp)})`,
      );
      break;
    case 'glow':
      layers.push(`radial-gradient(ellipse 140% 105% at 50% 0%, ${stopsList(ramp)})`);
      break;
    case 'dawn':
      layers.push(`linear-gradient(180deg, ${stopsList(ramp)})`);
      break;
  }
  return layers.join(', ');
}

/* ═══════════════════════════════════════════════════════════════════════════
   LEGIBILITY — the whole ramp, the theme's inks, a veil only when needed
   ═══════════════════════════════════════════════════════════════════════════ */

/** The theme's ink and veil over every colour of the ramp (`hub-legibility`'s media rule). */
export function ombreLegibility(theme: InviteTheme, spec: OmbreSpec): HubLegibility {
  return hubLegibility(theme, { kind: 'media', samples: ombreRamp(spec) });
}

export type OmbreLook = {
  /** The `background-image` for the page's paper, veil included. */
  css: string;
  /**
   * Inline custom properties for the look scope: the paper token moved to the
   * ramp's middle colour (so `bg-cream` chips and the sticky bar sit in the
   * gradient's own family) and the legibility answer on the channel tokens the
   * words are painted with — the same four `scene-legibility.ts` uses.
   */
  vars: Record<string, string>;
  legibility: HubLegibility;
};

/** Everything the guest page needs to wear one ombré under one theme. */
export function ombreLook(theme: InviteTheme, spec: OmbreSpec): OmbreLook {
  const ramp = ombreRamp(spec);
  const legibility = ombreLegibility(theme, spec);
  const mid = ramp[Math.floor(ramp.length / 2)]!;
  return {
    css: ombreCss(spec, legibility.scrim),
    vars: {
      '--color-cream': hexChannels(mid),
      '--color-ink': hexChannels(legibility.ink),
      '--color-ink-on-plate': hexChannels(legibility.ink),
      '--color-terracotta': hexChannels(legibility.accent),
      '--color-gild': hexChannels(legibility.accent),
    },
    legibility,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE PRO PLUMBING — inert while OMBRE_IS_PRO is false
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * One `site_bg_color` write, classified as a LOOK change ONLY for the ombré and
 * ONLY when `OMBRE_IS_PRO`. A plain colour is never Pro (owner 2026-09-24), so
 * it is read as "no ombré" on both sides: plain → plain is `'none'`, ombré →
 * plain is `'remove'`, plain → ombré is `'add'`. `undefined` = the form did not
 * carry the field.
 */
export function ombreLookChange(current: unknown, next: string | null | undefined): LookChange {
  if (!OMBRE_IS_PRO || next === undefined) return 'none';
  const ombre = (v: unknown) => (isOmbreValue(v) ? encodeOmbre(parseOmbre(v)!) : null);
  return refChange(ombre(current), ombre(next));
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE PRESETS — three or four per theme, tuned to its palette
   ═══════════════════════════════════════════════════════════════════════════ */

export type OmbrePreset = {
  /** Stable id — `<theme>-<slug>`. Never stored: the spec is stored expanded. */
  id: string;
  /** What the couple reads under the swatch. */
  name: string;
  theme: InviteThemeId;
  spec: OmbreSpec;
};

const p = (theme: InviteThemeId, slug: string, name: string, shape: OmbreShape, ...stops: string[]): OmbrePreset => ({
  id: `${theme}-${slug}`,
  name,
  theme,
  spec: { shape, stops: stops.map((s) => s.toLowerCase()) },
});

/**
 * Light themes take airy ombrés and keep their dark ink; the three dark themes
 * (Luxe · Great Gatsby · Cyber) take deep ones and keep their light ink. Every
 * preset clears AA for body text with NO veil — `lib/ombre.test.ts` measures it
 * over the whole ramp, and a preset that needed a veil would not be premium.
 */
export const OMBRE_PRESETS: readonly OmbrePreset[] = [
  // Classic — warm ivory, gold heading.
  p('house', 'linen', 'Morning linen', 'dawn', '#fbf7ef', '#ece1cf'),
  p('house', 'champagne', 'Champagne', 'diagonal', '#f9f2e5', '#e9d9b6'),
  p('house', 'blush', 'Blush', 'glow', '#fcf2ec', '#efd5cc'),
  p('house', 'sage', 'Sage', 'diagonal', '#f2f5ed', '#d8e1cd'),
  // Rustic — cream, terracotta accent.
  p('abaca', 'sunrise', 'Sunrise field', 'dawn', '#fdf4e7', '#f0cea6'),
  p('abaca', 'terracotta', 'Terracotta haze', 'diagonal', '#f9e7d5', '#e7b78f'),
  p('abaca', 'olive', 'Olive grove', 'glow', '#f4f2e4', '#cdd3a9'),
  p('abaca', 'dusk', 'Dusk', 'diagonal', '#f5e0d3', '#dbb3a7', '#efe2d1'),
  // Modern — stone, olive.
  p('galeriya', 'white', 'Gallery white', 'dawn', '#fafaf7', '#e6e4dd'),
  p('galeriya', 'stone', 'Stone', 'diagonal', '#f0ede6', '#cfcabf'),
  p('galeriya', 'moss', 'Moss', 'glow', '#eff2e7', '#c7d1b3'),
  p('galeriya', 'slate', 'Slate dawn', 'diagonal', '#e9ecef', '#c9d0d6', '#f2eee7'),
  // Cinderella — sky blue, silver.
  p('cinderella', 'sky', 'Sky', 'dawn', '#f4f8fc', '#cfdeea'),
  p('cinderella', 'pearl', 'Pearl', 'glow', '#fdfdff', '#dfe6f0'),
  p('cinderella', 'lilac', 'Lilac hour', 'diagonal', '#f1eef8', '#d4cfe6', '#e6eef8'),
  p('cinderella', 'silver', 'Silver', 'diagonal', '#f5f7fa', '#cbd5df'),
  // Luxe — near-black, copper foil.
  p('velvet', 'wine', 'Midnight wine', 'diagonal', '#1a0608', '#3a0f1a'),
  p('velvet', 'ember', 'Ember', 'glow', '#3a1a0e', '#0e0504'),
  p('velvet', 'gold', 'Black gold', 'diagonal', '#0e0504', '#2a1d0f', '#0e0504'),
  p('velvet', 'plum', 'Plum night', 'dawn', '#1e0a1d', '#0b0304'),
  // Vintage — parchment, sepia.
  p('vintage', 'paper', 'Old paper', 'dawn', '#f3e9d6', '#dcc7a6'),
  p('vintage', 'rose', 'Faded rose', 'diagonal', '#edd6cd', '#dab8ae'),
  p('vintage', 'sepia', 'Sepia', 'glow', '#efe3cf', '#cdb491'),
  p('vintage', 'tea', 'Tea', 'diagonal', '#e9ddc8', '#d0bd9d', '#ebe0cd'),
  // Whimsical — pastels.
  p('whimsical', 'candy', 'Cotton candy', 'diagonal', '#fde9ef', '#e7dcf5', '#dff0f7'),
  p('whimsical', 'peach', 'Peach cream', 'dawn', '#fff2e9', '#f6cfbb'),
  p('whimsical', 'meadow', 'Meadow', 'glow', '#f3fae9', '#d0e6c3'),
  p('whimsical', 'lavender', 'Lavender mist', 'diagonal', '#f4eefb', '#d8caee'),
  // Regency — wisteria, powder blue.
  p('regency', 'wisteria', 'Wisteria', 'diagonal', '#f1e9f3', '#d7c4de'),
  p('regency', 'powder', 'Powder blue', 'dawn', '#eef3f8', '#c9d8e6'),
  p('regency', 'apricot', 'Apricot', 'glow', '#fbeee1', '#efcba6'),
  p('regency', 'green', 'Regency green', 'diagonal', '#eef3ea', '#c6d7c2', '#f3efe4'),
  // Great Gatsby — black, brass, emerald.
  p('gatsby', 'gilded', 'Gilded night', 'diagonal', '#110504', '#3b2a12', '#110504'),
  p('gatsby', 'emerald', 'Emerald', 'glow', '#0f2a22', '#070f0c'),
  p('gatsby', 'jazz', 'Jazz', 'dawn', '#1a0b1f', '#0c0405'),
  p('gatsby', 'brass', 'Brass', 'diagonal', '#2a1a0a', '#0f0705'),
  // Cyber — neon on ink.
  p('cyber', 'dusk', 'Neon dusk', 'diagonal', '#1a0b2e', '#3a0f4a', '#0b0a12'),
  p('cyber', 'electric', 'Electric', 'glow', '#0b2a4a', '#0b0a12'),
  p('cyber', 'magenta', 'Magenta', 'dawn', '#2a0b26', '#0b0a12'),
  p('cyber', 'aurora', 'Aurora', 'diagonal', '#0b1a2a', '#0b2a24', '#1a0b2e'),
];

/** The curated ombrés for one theme, in the order they are shown. */
export function ombrePresetsFor(theme: InviteThemeId): OmbrePreset[] {
  return OMBRE_PRESETS.filter((x) => x.theme === theme);
}

/** The preset a stored spec IS, if it is one — for the picker's selected state. */
export function ombrePresetMatching(spec: OmbreSpec | null): OmbrePreset | null {
  if (!spec) return null;
  const encoded = encodeOmbre(spec);
  return OMBRE_PRESETS.find((x) => encodeOmbre(x.spec) === encoded) ?? null;
}
