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
 * silently never painted for a guest. Button colour, the couple's font and
 * (elsewhere) Candlelight/face/magic-move all stay Pro-only, unchanged below.
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
  // FREE, for every event: the background colour itself, plus the page ink
  // that keeps text legible on it, plus a PINNED plate ink so a plate's own
  // still-light paper never inherits that adapted (possibly light) page ink.
  const bgVars = buildCustomSiteColorVars(bgHex, null) ?? {};
  const inkHex =
    bgHex && Object.keys(bgVars).length > 0 ? hubLegibility(theme, { kind: 'color', hex: bgHex }).ink : null;
  const inkVars = inkHex
    ? { '--color-ink': channels(inkHex), '--color-ink-on-plate': channels(theme.palette.ink) }
    : {};

  // 🔤 THE COUPLE'S OWN TYPEFACE RIDES THE SAME BAG AND THE SAME GATE AS THE
  // BUTTON. `hubFontVars` contributes `--pahina-face` / `--font-display`, which
  // `globals.css` and `tailwind.config.ts` already read; a theme's MATERIAL
  // (its colour tokens) is untouched, because a theme carries colour and this
  // carries type. One bag rather than two: it is delivered to the same
  // element, under the same Pro check, and a second would be a second place
  // for the two to disagree.
  // ⛔ An unset face contributes `{}`, so a couple who never chose one gets
  // markup byte-identical to before this existed — and `null` still means
  // "add no style attribute at all".
  const proOnlyVars = proWatermarkHidden
    ? {
        ...(buildCustomSiteColorVars(null, event.site_button_color as string | null) ?? {}),
        ...hubFontVars(event.site_font_key),
      }
    : {};

  const proSiteVars = { ...bgVars, ...inkVars, ...proOnlyVars };
  return Object.keys(proSiteVars).length > 0 ? proSiteVars : null;
}
