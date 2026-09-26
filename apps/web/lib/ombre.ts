/**
 * apps/web/lib/ombre.ts — ONE COLOUR, ONE EFFECT: the page's background, as the couple chose it.
 *
 * Owner, 2026-09-25 (DECISION_LOG "BACKGROUND COLOUR: PLAIN OR APPLE-STYLE
 * OMBRÉ"), verbatim: *"color setup can be like plain color or like apples ombe
 * style."* — then, the same day, simplifying it ("COLOUR SETUP = PICK ONE
 * COLOUR + ONE EFFECT"), verbatim: *"so the pick a color, and you apply either
 * plain, dawn, diagonal or glow effect. that's it"*.
 *
 * So the Maker's Colours panel is: the couple PICKS ONE COLOUR, then one of
 * four effects —
 *
 *   PLAIN    — the flat colour. `events.site_bg_color` holds `#rrggbb`, as it
 *              has since migration 20270930244819. Nothing about it changes.
 *   DAWN     — a vertical ombré, darker at the top and lighter at the horizon.
 *   DIAGONAL — a soft 160° ombré with a light bloom in the top-left corner.
 *   GLOW     — a radial ombré, lit from the top centre.
 *
 * The three ombrés are DERIVED FROM THAT ONE COLOUR in OKLCH: a lighter step
 * above it and a darker step below it (lightness moved, chroma kept alive, the
 * hue turned a few degrees each way), then interpolated in OKLCH so the ramp
 * stays luminous instead of greying through the middle — the Apple-wallpaper
 * softness, from one swatch. There is no preset gallery and no multi-colour
 * builder: one colour, one effect, that's it.
 *
 * ── STORAGE: THE SAME COLUMN, A SMALL ENCODED SPEC, NO MIGRATION ──────────
 * `site_bg_color` is TEXT with no CHECK (`grep -n site_bg_color supabase/
 * migrations/20270930244819_events_site_custom_colors.sql`), already granted for
 * SELECT and UPDATE (20271005100000) and already in the draft
 * (`HUB_DRAFT_LOOK_COLUMNS`). An ombré is stored in it as
 *
 *     ombre:<effect>:<#rrggbb>          e.g. ombre:dawn:#f4ecdd     (≤ 22 chars)
 *
 * `parseSiteBackground` is the ONE reader of the column's two shapes; every
 * writer and sanitiser goes through it, so a malformed value is dropped, never
 * repaired — the canvas rule.
 *
 * ── HOW IT REACHES THE PAGE ───────────────────────────────────────────────
 * `guestLookFrom` (`app/[slug]/_lib/loaders.ts`) asks `ombreLook(theme, spec)`
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
 * veil wins; when neither clears AA bare (a mid-tone colour), the veil it asked
 * for is baked into the CSS as the top layer. `lib/ombre.test.ts` measures it
 * over every theme's own colours and a sweep of a couple's possible picks.
 *
 * ── FREE, BEHIND ONE CONSTANT ─────────────────────────────────────────────
 * Plain colour is free (owner 2026-09-24). The owner has been asked whether the
 * ombré is free or Pro; the controller recommends free, so it ships FREE.
 * `OMBRE_IS_PRO` is the one switch: flip it and an ombré becomes a Pro look —
 * tried in the draft, refused at Apply for a free couple (`eventItemIsPro` in
 * `lib/hub-draft.ts`) and refused by the live writer (`ombreLookChange` in
 * `website/colors/actions.ts`) — with no other line changing.
 *
 * Pure. No I/O. Client-safe (the Maker panel draws the effect swatches with it).
 */
import { hexOfOklch, oklchOfHex, type Oklch } from '@/lib/color-space';
import { hubLegibility, type HubLegibility } from '@/lib/hub-legibility';
import { refChange, type LookChange } from '@/lib/hub-look-pro';
import type { InviteTheme } from '@/lib/invite-themes';

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

/** The three ombré effects — with Plain, the owner's four. No more. */
export const OMBRE_SHAPES = ['dawn', 'diagonal', 'glow'] as const;
export type OmbreShape = (typeof OMBRE_SHAPES)[number];

/** The four effects as the couple reads them, in the panel's order. */
export const BACKGROUND_EFFECTS = ['plain', ...OMBRE_SHAPES] as const;
export type BackgroundEffect = (typeof BACKGROUND_EFFECTS)[number];

export const BACKGROUND_EFFECT_LABEL: Record<BackgroundEffect, string> = {
  plain: 'Plain',
  dawn: 'Dawn',
  diagonal: 'Diagonal',
  glow: 'Glow',
};

export type OmbreSpec = {
  shape: OmbreShape;
  /** The one colour the couple picked, lowercase `#rrggbb`. */
  base: string;
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
  return `${OMBRE_PREFIX}${spec.shape}:${spec.base}`;
}

/** `ombre:<effect>:<hex>` → the spec, or null for anything else. */
export function parseOmbre(raw: unknown): OmbreSpec | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  if (!v.startsWith(OMBRE_PREFIX)) return null;
  const [shape, hex, ...rest] = v.slice(OMBRE_PREFIX.length).split(':');
  if (rest.length > 0 || !shape || !hex) return null;
  if (!(OMBRE_SHAPES as readonly string[]).includes(shape)) return null;
  const base = normalizeHex(hex);
  return base ? { shape: shape as OmbreShape, base } : null;
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

/** One colour + one effect → the stored form (`''` when there is no colour). */
export function encodeBackgroundChoice(hex: string | null, effect: BackgroundEffect): string {
  const base = normalizeHex(hex);
  if (!base) return '';
  return effect === 'plain' ? base : encodeOmbre({ shape: effect, base });
}

/** Is this stored value an ombré (and not a plain hex, a blank, or noise)? */
export function isOmbreValue(raw: unknown): boolean {
  return parseOmbre(raw) !== null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE RAMP — three OKLCH anchors from one colour, interpolated in OKLCH
   ═══════════════════════════════════════════════════════════════════════════ */

/** How many colours the gradient is drawn and measured with. Odd, so the base sits at t = 0.5. */
export const OMBRE_RAMP_STEPS = 9;

/** How far the lighter and darker anchors sit from the colour, in OKLCH lightness. */
export const OMBRE_LIFT = 0.1;
export const OMBRE_DROP = 0.12;
/** The lightest and darkest an anchor may go — a pure white or black end bands and glares. */
const L_MAX = 0.975;
const L_MIN = 0.06;
/** A few degrees of hue turn each way — what keeps a one-colour ombré from reading as a tint. */
const HUE_TURN = 6;

/** Below this chroma a colour is grey and its hue is noise — take the other end's. */
const GREY_C = 0.02;

/** The least a step must move to be worth drawing; under it the anchor is dropped, not faked. */
const MIN_STEP = 0.03;

/**
 * The anchors, lightest first — lighter · the colour · darker — as `#rrggbb`.
 * The couple's colour is ALWAYS one of them. When it is already at an edge
 * (near-white, near-black) the step that cannot move is dropped and its room
 * is given to the other side, so the colour becomes that end of the ramp and
 * the ramp still spans the full `OMBRE_LIFT + OMBRE_DROP` of lightness — never
 * a flat fill, never a step too small to see followed by a cliff.
 */
export function ombreAnchors(base: string): string[] {
  const hex = base.toLowerCase();
  const c = oklchOfHex(base);
  const span = OMBRE_LIFT + OMBRE_DROP;
  // Lighter tones carry a little less chroma, darker ones a little more —
  // the way a lit surface actually reads. `hexOfOklch` clamps to the gamut.
  const lighter = (L: number) => hexOfOklch(L, c.C * 0.85, c.H - HUE_TURN).toLowerCase();
  const darker = (L: number) => hexOfOklch(L, c.C * 1.1, c.H + HUE_TURN).toLowerCase();
  let lightL = Math.min(L_MAX, c.L + OMBRE_LIFT);
  let darkL = Math.max(L_MIN, c.L - OMBRE_DROP);
  // Room a clamped side lost goes to the other side, so the full span is kept.
  const lostLift = c.L + OMBRE_LIFT - lightL;
  const lostDrop = darkL - (c.L - OMBRE_DROP);
  lightL = Math.min(L_MAX, lightL + lostDrop);
  darkL = Math.max(L_MIN, darkL - lostLift);
  const canLift = lightL - c.L >= MIN_STEP;
  const canDrop = c.L - darkL >= MIN_STEP;
  if (!canLift) return [hex, darker(Math.max(L_MIN, c.L - span))];
  if (!canDrop) return [lighter(Math.min(L_MAX, c.L + span)), hex];
  return [lighter(lightL), hex, darker(darkL)];
}

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
 * The gradient's colours from lightest to darkest, `steps` of them, anchors
 * included (the couple's own colour is one of them — the middle, or an end
 * when the colour is already near white or black). These are BOTH what the
 * CSS draws and what legibility measures — one ramp, so the words are
 * measured over the exact colours the guest sees.
 */
export function ombreRamp(spec: OmbreSpec, steps = OMBRE_RAMP_STEPS): string[] {
  const stops = ombreAnchors(spec.base);
  const anchors = stops.map((h) => oklchOfHex(h));
  const segments = anchors.length - 1;
  const out: string[] = [];
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1);
    const seg = Math.min(segments - 1, Math.floor(t * segments));
    const local = t * segments - seg;
    // A sample that lands ON an anchor is that anchor exactly — a round trip
    // through OKLCH can move a channel by one, and the swatch the couple picked
    // should be the swatch they see where it sits in the ramp.
    out.push(local === 0 ? stops[seg]! : mixOklch(anchors[seg]!, anchors[seg + 1]!, local));
  }
  out[out.length - 1] = stops[stops.length - 1]!;
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
 *   dawn     — the ramp top to bottom, DARK above and LIGHT at the horizon;
 *   diagonal — a 160° ramp, light to dark, with a soft bloom of the light end
 *              in the top-left corner so it reads as lit, not as a two-tone fill;
 *   glow     — the ramp radiating from the top centre, light to dark.
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
    case 'dawn':
      layers.push(`linear-gradient(180deg, ${stopsList([...ramp].reverse())})`);
      break;
    case 'diagonal':
      layers.push(
        `radial-gradient(ellipse 110% 75% at 12% 0%, ${rgba(ramp[0]!, 0.55)} 0%, ${rgba(ramp[0]!, 0)} 65%)`,
        `linear-gradient(160deg, ${stopsList(ramp)})`,
      );
      break;
    case 'glow':
      layers.push(`radial-gradient(ellipse 140% 105% at 50% 0%, ${stopsList(ramp)})`);
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
   * couple's colour (the ramp's middle — so `bg-cream` chips and the sticky bar
   * sit in the gradient's own family) and the legibility answer on the channel
   * tokens the words are painted with (`scene-legibility.ts`'s tokens).
   *
   * 🔴 EXCEPT `--color-ink-on-plate`, WHICH IS PINNED TO THE THEME'S OWN INK.
   * A `.pahina-plate` (the When/Where box, the reply card) keeps its own light
   * paper whatever the page does, and its CSS reads
   * `var(--color-ink-on-plate, var(--color-ink))` — a fallback to the page
   * ink. Over a DARK ombré the page ink flips light; left to the fallback,
   * every plate's words would be light on the plate's still-light paper —
   * blank. The ten theme blocks in `globals.css` pin it to the theme's `ink`
   * for exactly this reason, and so does the free-background fix
   * (`pro-site-vars.ts`); this pins the same value inline so Classic, which
   * has no theme block, is covered too.
   */
  vars: Record<string, string>;
  legibility: HubLegibility;
};

/** Everything the guest page needs to wear one ombré under one theme. */
export function ombreLook(theme: InviteTheme, spec: OmbreSpec): OmbreLook {
  const legibility = ombreLegibility(theme, spec);
  return {
    css: ombreCss(spec, legibility.scrim),
    vars: {
      '--color-cream': hexChannels(spec.base),
      '--color-ink': hexChannels(legibility.ink),
      '--color-ink-on-plate': hexChannels(theme.palette.ink),
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
