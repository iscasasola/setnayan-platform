/**
 * apps/web/lib/monogram-ink.ts
 *
 * WHOSE COLOURS DOES AN UPLOADED MARK WEAR — the couple's file, or their
 * mood board? (owner 2026-09-20: "this needs to toggle so they can choose and
 * compare which one to use".)
 *
 * ── WHY THE POLICY LIVES IN THE SVG, NOT IN A COLUMN ───────────────────────
 * The mark is read by a dozen surfaces (hero · QR centre · save-the-date ·
 * seating lab · panood · social cards · account switcher · album shelf), and
 * they do not agree on which `events` columns they SELECT. A policy stored in
 * a new column — or in `monogram_studio_config` — would therefore be invisible
 * to every surface whose select does not list it, and the mark would follow
 * the mood board on some screens and not others. That is the exact failure
 * this repo keeps re-learning: two mechanisms that disagree about one fact.
 *
 * So the policy rides ON THE MARK, as `data-ink` on the root `<svg>`:
 *
 *     data-ink="file"     → render the file's own colours (the DEFAULT, and
 *                           what an absent attribute means, so every mark
 *                           uploaded before today is byte-identical)
 *     data-ink="palette"  → every fill/stroke becomes `currentColor`, so the
 *                           mark inherits whatever ink the surface around it
 *                           is already themed with. The couple site already
 *                           re-skins its `--color-*` tokens from the mood-board
 *                           palette (lib/site-palette.ts), so "follow our
 *                           colours" needs NO caller to pass a palette down.
 *
 * The stored bytes keep the ORIGINAL colours either way. Nothing is destroyed
 * by choosing palette, so the toggle is lossless in both directions — which is
 * what makes "compare which one to use" honest rather than a one-way door.
 *
 * ⚠ This module is PURE and has no imports on purpose: the upload preview
 * (client), the save action (server) and the read-time resolver must apply one
 * rule, and a rule that exists in three places is three rules.
 */

/** The two answers to "whose colours?". `file` is the default everywhere. */
export const MARK_INK_MODES = ['file', 'palette'] as const;
export type MarkInkMode = (typeof MARK_INK_MODES)[number];

export function isMarkInkMode(v: unknown): v is MarkInkMode {
  return typeof v === 'string' && (MARK_INK_MODES as readonly string[]).includes(v);
}

/* A colour VALUE we are willing to repaint. Deliberately narrow: `none`,
 * `currentColor`, `inherit`, `transparent` and `url(#…)` gradient refs are all
 * left exactly as they are — repainting `fill="none"` would flood a hollow
 * counter, and repainting a gradient ref would erase the gradient. */
const COLOR_VALUE = /^(?:#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))$/;

/** `fill="…"` / `stroke="…"` — `\b` before the name so `fill-rule`, `fill-opacity`
 *  and `stroke-width` can never match (they carry no colour and breaking them
 *  would silently change the SHAPE, not the colour). */
const PAINT_ATTR = /\b(fill|stroke)="([^"]*)"/g;
/** The same two properties inside an inline `style="…"`. `<style>` ELEMENTS are
 *  rejected by the sanitizer, but a per-element `style` attribute survives it —
 *  an Illustrator export routinely writes `style="fill:#1A1A1A"`, and a rule
 *  that only reads attributes would leave those marks stubbornly un-recoloured.
 *
 * ⚠ The leading class MUST include the quote characters. Written as `[;\s]` it
 *  could not match the FIRST declaration in `style="fill:#1A1A1A;…"` — the
 *  character before `fill` there is `"` — so a one-colour Illustrator mark
 *  reported zero colours and the toggle silently did nothing. */
const PAINT_STYLE = /(^|[;\s"'])(fill|stroke)\s*:\s*([^;"']+)/gi;

function normalizeColor(raw: string): string | null {
  const v = raw.trim();
  if (!COLOR_VALUE.test(v)) return null;
  return v.toLowerCase();
}

/**
 * Every distinct colour the mark actually paints with, in first-seen order.
 *
 * Used for the two honest numbers the upload screen shows: how many colours a
 * file carries (so a couple knows what "follow our colours" would flatten), and
 * whether a traced mark came back single-colour. Counting is why the toggle can
 * explain itself instead of just offering two unlabelled swatches.
 */
export function markInks(svg: string): string[] {
  if (!svg) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const c = normalizeColor(raw);
    if (!c || seen.has(c)) return;
    seen.add(c);
    out.push(c);
  };
  for (const m of svg.matchAll(PAINT_ATTR)) push(m[2] ?? '');
  for (const m of svg.matchAll(PAINT_STYLE)) push(m[3] ?? '');
  return out;
}

/**
 * Rewrite every paintable fill/stroke to `currentColor`.
 *
 * Structural paint keywords are preserved (see COLOR_VALUE): a mark whose
 * counters are cut with `fill="none"` keeps its holes, and a gradient ref keeps
 * its gradient. The returned string is still a valid member of the sanitizer's
 * allowlist — `currentColor` introduces no element, no attribute and no URL.
 */
export function markToCurrentColor(svg: string): string {
  if (!svg) return svg;
  return svg
    .replace(PAINT_ATTR, (whole, prop: string, value: string) =>
      normalizeColor(value) ? `${prop}="currentColor"` : whole,
    )
    .replace(PAINT_STYLE, (whole, lead: string, prop: string, value: string) =>
      normalizeColor(value) ? `${lead}${prop}:currentColor` : whole,
    );
}

/** Read the ink policy a mark carries. Absent/unknown → `file`, so a mark saved
 *  before this feature existed renders exactly as it always did. */
export function readMarkInkMode(svg: string | null | undefined): MarkInkMode {
  if (!svg) return 'file';
  const m = svg.match(/^<svg[^>]*\sdata-ink="([^"]*)"/i);
  const v = m?.[1];
  return isMarkInkMode(v) ? v : 'file';
}

/**
 * Stamp the policy onto the root tag, replacing any previous stamp.
 *
 * Only the FIRST `<svg` is touched (`^<svg[^>]*>`): a nested `<svg>` inside the
 * artwork must not be able to carry its own competing policy.
 */
export function writeMarkInkMode(svg: string, mode: MarkInkMode): string {
  if (!svg) return svg;
  return svg.replace(/^<svg([^>]*)>/i, (_m, attrs: string) => {
    const cleaned = attrs.replace(/\sdata-ink="[^"]*"/gi, '');
    return `<svg${cleaned} data-ink="${mode}">`;
  });
}

/**
 * The one call every RENDER path makes: give me this mark as it should be
 * painted right now.
 *
 * `file` returns the stored bytes untouched; `palette` returns the
 * currentColor form. The caller supplies the ink simply by being a themed
 * container — no palette is threaded through, which is what keeps this from
 * needing a change at twelve read sites.
 */
export function applyMarkInk(svg: string | null | undefined, mode?: MarkInkMode): string | null {
  if (!svg) return null;
  const m = mode ?? readMarkInkMode(svg);
  return m === 'palette' ? markToCurrentColor(svg) : svg;
}
