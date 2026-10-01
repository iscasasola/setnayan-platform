/**
 * apps/web/app/[slug]/_lib/pro-site-vars.ts
 *
 * `proSiteVarsFor` — split out of `loaders.ts` (owner 2026-09-25 bg-colour
 * fix) so the couple's-colours math can be exercised directly in a test
 * without pulling in `loaders.ts`'s own import graph (the admin Supabase
 * client, `next/server`, and everything else a request-scoped loader needs).
 * Pure. No I/O, no `server-only` — every import below is a pure lib module.
 *
 * `loaders.ts` re-exports this so `proSiteVarsFor` stays a named export of
 * that module for any existing caller/comment that names it there.
 */
import { hubFontVars } from '@/lib/hub-fonts';
import { buildCustomSiteColorVars } from '@/lib/site-palette';
import { INVITE_THEMES, type InviteThemeId } from '@/lib/invite-themes';
import { hubLegibility } from '@/lib/hub-legibility';

/** `#rrggbb` → the `r g b` triplet every `--color-*` custom property holds —
 *  the same tiny formatter `lib/scene-legibility.ts` keeps privately, copied
 *  rather than imported so this stays a self-contained, directly-testable
 *  module (see the file docblock). */
function channels(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1]!, 16) : 0;
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/**
 * The couple's Event Hub colours and face, as inline custom properties — or
 * `null` when there is nothing to add.
 *
 * Website Pro net-new manual site colours (Launch settings §4.4 · PR-C).
 *
 * ⚠ owner 2026-09-25 "okay drop the numbers" / bg-colour fix: background
 * colour is FREE and paints for EVERY event (Event Hub Pro feature list:
 * "Free: … bg colour") — it used to be gated behind `proWatermarkHidden` along
 * with everything else here, so a free couple's saved `site_bg_color` was
 * silently never painted for a guest. The BUTTON colour joined it 2026-09-28
 * (the free-vs-Pro redraw). The couple's font and (elsewhere) Candlelight /
 * magic move stay Pro-only, unchanged below.
 *
 * 🔑 TEXT COLOUR ADAPTS TO THE COUPLE'S OWN BACKGROUND TOO (lib/hub-legibility.ts
 * — owner 2026-09-25: *"did you already make the font color adapt also based
 * on the background?"*, ruled free for everyone). `buildSitePaletteVars` keeps
 * `--color-ink` a fixed espresso on purpose ("always dark → always high-
 * contrast on a light page") — safe only because a Mood-Board paper is always
 * near-white. A couple's own hex has no such guarantee, so once a background
 * colour is set, `hubLegibility`'s already-shipped flat-colour rule (the same
 * one the theme ground and the Maker's scene canvas already use) picks the
 * readable ink instead, keyed to the couple's active theme (Classic/House when
 * they have none).
 *
 * 🔴 AND `--color-ink-on-plate` MUST STAY PINNED, OR A PLATE GOES BLANK THE
 * OTHER WAY. `.pahina-plate` (the "When/Where" box, the reply card, …) keeps
 * its OWN light paper background regardless of the page's — `buildSitePaletteVars`
 * never darkens `--color-paper-deep`, and this function never touches it
 * either. `.pahina-plate`'s CSS reads `color: rgb(var(--color-ink-on-plate,
 * var(--color-ink)))` — a FALLBACK to the page ink. Screenshotted while
 * building this fix: once `--color-ink` above flips light (for a couple's
 * dark background), that fallback made every plate's "WHEN"/"WHERE" value
 * light text on the plate's OWN still-light paper — invisible, the same shape
 * `the-site-wears-the-doors-theme.test.ts` already guards for the ten themes
 * ("`--color-ink` must also declare `--color-ink-on-plate`, or the card
 * inherits the ground's ink and goes blank"). The fix there is NOT to reuse
 * the adapted page ink (that IS the bug): a plate is always light paper, so
 * its ink is pinned to the theme's own — the SAME dark ink every plate has
 * always used, decoupled from whatever the page background does.
 */
export function proSiteVarsFor(
  event: { site_bg_color?: unknown; site_button_color?: unknown; site_font_key?: unknown },
  proWatermarkHidden: boolean,
  themeId: InviteThemeId = 'house',
): Record<string, string> | null {
  const bgHex = typeof event.site_bg_color === 'string' ? event.site_bg_color : null;
  const theme = INVITE_THEMES[themeId] ?? INVITE_THEMES.house;
  // Built by plain assignment, never by spreading a conditional object —
  // a `cond ? {a} : {}` ternary infers a union where `a` is optional/undefined
  // on the empty branch, which `Record<string, string>` below then refuses.
  const proSiteVars: Record<string, string> = {};

  // FREE, for every event: the background colour itself, plus the page ink
  // that keeps text legible on it, plus a PINNED plate ink so a plate's own
  // still-light paper never inherits that adapted (possibly light) page ink.
  // 🎨 AND THE BUTTON COLOUR, since 2026-09-28 (owner: *"free to change …
  // color, background color, only when you start adding themes will it be
  // pro"*) — built in the same call as the background, for every event.
  const bgVars = buildCustomSiteColorVars(bgHex, (event.site_button_color as string | null) ?? null);
  if (bgVars) {
    Object.assign(proSiteVars, bgVars);
    if (bgHex) {
      const inkHex = hubLegibility(theme, { kind: 'color', hex: bgHex }).ink;
      proSiteVars['--color-ink'] = channels(inkHex);
      proSiteVars['--color-ink-on-plate'] = channels(theme.palette.ink);
    }
  }

  // 🔤 THE COUPLE'S OWN TYPEFACE RIDES THE SAME BAG, BEHIND THE PRO GATE (the
  // button colour shared this gate until 2026-09-28). `hubFontVars` contributes `--pahina-face` / `--font-display`, which
  // `globals.css` and `tailwind.config.ts` already read; a theme's MATERIAL
  // (its colour tokens) is untouched, because a theme carries colour and this
  // carries type. One bag rather than two: it is delivered to the same
  // element, under the same Pro check, and a second would be a second place
  // for the two to disagree.
  // ⛔ An unset face contributes `{}`, so a couple who never chose one gets
  // markup byte-identical to before this existed — and `null` still means
  // "add no style attribute at all".
  if (proWatermarkHidden) {
    Object.assign(proSiteVars, hubFontVars(event.site_font_key));
  }

  return Object.keys(proSiteVars).length > 0 ? proSiteVars : null;
}

// ── THE PLATE KEEPS A READABLE INK (owner 2026-09-30, "I cannot see the venues") ──
//
// Measured on the live page (`cale-ice`, 390 px, 2026-09-30): the venue plates
// painted their NAME in rgb(243 231 220) on their own paper, rgb(240 237 232) —
// 1.1 : 1, i.e. invisible. Two layers disagreed about one fact:
//
//   · the theme (`[data-hub-theme='velvet']`, a DARK theme) pins the plate ink
//     LIGHT — right for velvet's own dark plate (`--color-paper-deep: 52 19 12`);
//   · the couple's mood-board palette (`buildSitePaletteVars`, spread inline on
//     the SAME element, so it wins) repaints the plate paper LIGHT and never
//     names a plate ink — so the theme's light one leaked onto light paper.
//
// No one layer is wrong on its own; the COMBINATION is. So the answer is taken
// where every layer has already been spread: `pinPlateInk` looks at the plate
// paper that will actually paint and keeps the plate ink only if it reads on
// it; otherwise it takes the first readable ink the theme itself offers. An
// event whose plate already reads is returned UNCHANGED (byte-identical).
//
// 🔒 Held by `lib/the-venue-cards-are-readable.test.ts`, which runs every
// theme × every colour source through `guestLookFrom` (the function the guest
// page itself calls) and measures the blended pixel of every venue word.

/** `r g b` channels (or `#rrggbb`) → relative luminance. */
function luminanceOf(value: string): number | null {
  const rgb = rgbOf(value);
  if (!rgb) return null;
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

/** `"r g b"` or `#rrggbb` → [r, g, b], or null. */
export function rgbOf(value: string): [number, number, number] | null {
  const v = value.trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const parts = v.split(/\s+/).map(Number);
  return parts.length === 3 && parts.every((p) => Number.isFinite(p)) ? (parts as [number, number, number]) : null;
}

/** WCAG contrast of two colours (channels or hex). 1 when either is unreadable. */
export function contrastOf(a: string, b: string): number {
  const la = luminanceOf(a);
  const lb = luminanceOf(b);
  if (la == null || lb == null) return 1;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The pixel `ink` at `alpha` paints over an opaque `ground`, as channels. */
export function blendOver(ink: string, ground: string, alpha: number): string {
  const i = rgbOf(ink);
  const g = rgbOf(ground);
  if (!i || !g) return ink;
  return i.map((c, k) => Math.round(c * alpha + g[k]! * (1 - alpha))).join(' ');
}

/**
 * The faintest a plate's words are drawn: `text-ink/65` (a venue's address, the
 * "When"/"Where" small print). An ink that reads at this alpha reads at every
 * stronger one (the name, the buttons).
 */
export const PLATE_MUTED_ALPHA = 0.65;
/** WCAG AA for body text. */
export const PLATE_MIN_CONTRAST = 4.5;

/** Does `ink` read on `plate` even at the faintest alpha a plate uses? */
export function plateInkReads(ink: string, plate: string): boolean {
  return contrastOf(blendOver(ink, plate, PLATE_MUTED_ALPHA), plate) >= PLATE_MIN_CONTRAST;
}

/**
 * The composed vars with `--color-ink-on-plate` guaranteed readable on the plate
 * paper that will actually paint (`--color-paper-deep` from `vars`, else the
 * theme's own surface). Unchanged when it already reads.
 */
export function pinPlateInk(
  vars: Record<string, string> | null,
  themeId: InviteThemeId = 'house',
): Record<string, string> | null {
  if (!vars) return vars;
  const theme = INVITE_THEMES[themeId] ?? INVITE_THEMES.house;
  const plate = vars['--color-paper-deep'] ?? channels(theme.palette.surface);
  const current = vars['--color-ink-on-plate'] ?? channels(theme.palette.ink);
  if (plateInkReads(current, plate)) return vars;
  const candidates = [
    channels(theme.palette.ink),
    channels(theme.palette.darkInk),
    channels(theme.palette.lightInk),
    ...(vars['--color-ink'] ? [vars['--color-ink']] : []),
    '17 17 17',
    '255 255 255',
  ];
  const readable = candidates.find((c) => plateInkReads(c, plate));
  const best =
    readable ?? candidates.reduce((a, b) => (contrastOf(b, plate) > contrastOf(a, plate) ? b : a));
  return { ...vars, '--color-ink-on-plate': best };
}
