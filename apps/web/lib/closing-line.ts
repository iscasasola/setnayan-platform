/**
 * 🕯 THE CLOSING'S LINE — "See you soon.", the couple's own words and look (owner 2026-10-17, verbatim: *"and also allow
 * styles on the see you soon and customization. so we can edit the text there."*).
 *
 * The closing (#6595) is its own Maker part (`closing`, canvas `f:closing`) whose Style was ONE Accent ◆ ▾ and whose
 * words were fixed. Its line is now a part like a cover word, on the SAME machinery (`lib/element-style.ts`):
 *
 *   WHERE IT LIVES   the hero row's canvas, `elements.closing` — beside the cover's words, so it is drafted under the
 *                    hero's one write key, sanitised by the one sanitiser, and gated by the one Pro comparison
 *                    (`canvasLookFacets`: its motion is Pro at Apply, its words · colour · size · font · width are free —
 *                    exactly as a cover word's are today). No table, no column, no migration.
 *   WHAT IT TAKES    its words (absent or empty = `HUB_CLOSING_DEFAULT_WORDS`, never a blank band), a cover word's
 *                    Colour · Size · Width (and a stored font), and Animate — Build in, Drift · Shimmer · Glow ◆.
 *   WHAT IT DOES NOT the band's names and date are the couple's FACTS (Details · the cover's Event title), and "Powered
 *                    by" is Setnayan's — none is typed here. It cannot be hidden.
 *
 * 🧭 ITS BUILD IN WAITS FOR THE GUEST. The line sits at the page's FOOT, so a Build in "On arrival" on the clock (the
 * cover's way — the cover IS the first screen) would play at load, out of sight, and the guest would scroll down to a
 * line that had already arrived: a choice that renders exactly like no choice. Here "On arrival" is the guest ARRIVING
 * AT IT — the In follows the line's own view as it comes on screen (`view()`, the page's own range); an engine without
 * scroll timelines plays it on the clock (`hubElementArrivalOnly`), as every part does there. Words ▾ (Word by word ·
 * Spread) is not offered for the same reason — it is a clock (`hubElementTakesGlow`).
 *
 * Pure. No I/O. Read by the guest page (`app/[slug]/_components/closing-line.tsx`) and by the Maker canvas's instant
 * preview (`editor-bridge.tsx`), so the two cannot disagree.
 */
import {
  HUB_CLOSING_DEFAULT_WORDS,
  hubElementArrivalOnly,
  hubElementDeclarations,
  hubElementFxVars,
  hubElementMotionDeclarations,
  sanitizeHubElementMotion,
  type HubElementMotion,
  type HubElementStyle,
} from './element-style';

/** The part key — the Maker part, its canvas key and the element are all `closing`. */
export const CLOSING_EL = 'closing' as const;
export const CLOSING_CANVAS_KEY = 'f:closing' as const;
/** The row whose canvas holds the closing's line. */
export const CLOSING_STORED_ON = 'hero' as const;

/**
 * The widget type whose canvas holds a section's parts: the cover's and the closing's are the hero row's
 * (`f:hero` · `f:closing`), a scene's are its own (`w:<type>`). The ONE answer every door that opens a part asks.
 */
export function elementCanvasOwner(canvasKey: string): string {
  if (canvasKey === 'f:hero' || canvasKey === CLOSING_CANVAS_KEY) return 'hero';
  return canvasKey.slice(2);
}

/** The words the line draws: the couple's, or "See you soon." — never empty. */
export function closingLineWords(style: HubElementStyle | null | undefined): string {
  const w = style?.word?.replace(/\s+/g, ' ').trim();
  return w ? w : HUB_CLOSING_DEFAULT_WORDS;
}

/** The motion as the line plays it: a Build in "On arrival" follows the line's own view (it is at the page's foot). */
export function closingLineMotion(motion: HubElementMotion | null | undefined): HubElementMotion | null {
  const m = sanitizeHubElementMotion(motion);
  if (!m) return null;
  if (!m.in || m.timeline === 'scroll') return m;
  /* "On arrival" has no Build out (it never follows the scroll) — none is carried across. */
  const { out: _out, outSpeed: _outSpeed, delay: _delay, ...rest } = m;
  return { ...rest, timeline: 'scroll' };
}

/**
 * The line's motion as the custom properties the ONE gated `[data-el-motion]` rule reads (`globals.css`) — the
 * cover's own (`hubElementHeroMotionVars`), laid for the page (`view()`) instead of the cover's first screen.
 */
export function closingLineMotionVars(style: HubElementStyle | null | undefined): Array<[string, string]> {
  const seen = closingLineMotion(style?.motion);
  if (!seen) return [];
  const decl = hubElementMotionDeclarations(seen, 'page');
  const motion = Object.fromEntries(decl);
  if (!motion.animation) return [];
  const arrival = hubElementArrivalOnly(style?.motion);
  return [
    ...decl.filter(([p]) => p.startsWith('--el-')),
    ...hubElementFxVars(style?.motion),
    ['--el-anim', motion.animation],
    ['--el-tl', motion['animation-timeline'] ?? 'auto'],
    ['--el-range', motion['animation-range'] ?? 'normal'],
    ...(arrival ? ([['--el-anim-t', arrival]] as Array<[string, string]>) : []),
  ];
}

const camel = (prop: string) => prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** The line's inline style — its look, then its motion's properties. Undefined for a line the couple never touched. */
export function closingLineInlineStyle(style: HubElementStyle | null | undefined): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const [prop, value] of hubElementDeclarations(style)) out[camel(prop)] = value;
  for (const [prop, value] of closingLineMotionVars(style)) out[prop] = value;
  return Object.keys(out).length > 0 ? out : undefined;
}
