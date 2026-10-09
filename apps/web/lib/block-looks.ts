/**
 * 🧱 THE LOOK OF A FIXED BLOCK OF THE EVENT HUB — how it MOVES (and, next, its background).
 *
 * Owner's rule (2026-10-09): *"there should always be animate and background?"* → *"yes that is what we are doing.
 * giving the freedom to fix their event hub."* — Animate for every element, Background for every block. The fixed
 * blocks (the Wedding March, The details, E-Gifts, Happening now …) had neither: they have no section row, so no
 * canvas to keep one in (`lib/fixed-scene-styles.ts` says the same of their Style picks).
 *
 * WHERE IT LIVES — beside those picks, in the event's own look object, with NO migration:
 *
 *     events.style_preferences.block_looks = { entourage: { motion: … }, details: { … }, … }
 *
 * (Proved on the replayed schema, 2026-10-10: 90 CHECKs on `events`, none on `style_preferences`, and no trigger
 * touches it.) Drafted through the Maker's one draft door as a part of `style_preferences`, live on Apply, written
 * by the existing merge. The Event Hub page already reads the column — no extra read for a guest.
 *
 * ONE STRICT READER. `readBlockLooks` keeps only the blocks listed here and, for each, only what the Event Hub's own
 * closed-set reader keeps (`sanitizeHubElementMotion` — the motion a cover line has: Build in · Action · Build out,
 * on arrival or following the scroll). The first-load draft cleaner only carries the key through.
 *
 * WHICH BLOCKS. Only the ones a guest's page draws from ONE real root (controller 2026-10-10). The other six the
 * canvas frames — Your seat · Photos of you · Announcements · Live hub · Digital pass · What to wear — are SAMPLES
 * there; each guest sees their own, drawn elsewhere. A look kept for a sample would show in the Maker and never
 * reach a guest, so those stay grey and say why (`BLOCK_SAMPLE_WHY`).
 */
import { hubElementMotionDeclarations, sanitizeHubElementMotion, type HubElementMotion } from './element-style';

/** The key inside `events.style_preferences`. */
export const BLOCK_LOOKS_PREF_KEY = 'block_looks';

/** The blocks that take a look — each is its canvas key without the `f:` (`lib/maker-parts.ts`). */
export const BLOCK_LOOK_BLOCKS = ['entourage', 'details', 'gifts', 'spotlight'] as const;
export type BlockLookBlock = (typeof BLOCK_LOOK_BLOCKS)[number];
export type BlockLook = { motion?: HubElementMotion };
export type BlockLooks = Partial<Record<BlockLookBlock, BlockLook>>;

/** The block a canvas key names, or null (a scene with its own canvas, a sample, anything else). */
export function blockOfCanvas(canvas: string | null | undefined): BlockLookBlock | null {
  const name = canvas?.startsWith('f:') ? canvas.slice(2) : null;
  return (BLOCK_LOOK_BLOCKS as readonly unknown[]).includes(name) ? (name as BlockLookBlock) : null;
}

/**
 * The canvas's SAMPLES — what each guest sees there is their own. Said when Background or Animate is tapped on one
 * (the couple's words; each names the thing).
 */
export const BLOCK_SAMPLE_WHY: Readonly<Record<string, string>> = {
  'f:find_your_seat': 'This is a sample. Each guest sees their own seat here.',
  'f:photos_of_you': 'This is a sample. Each guest sees their own photos here.',
  'f:announcements': 'This is a sample. Guests see your announcements here as you send them.',
  'f:live_hub': 'This is a sample. Guests see the live hub here on the day.',
  'f:pass': 'This is a sample. Each guest sees their own pass here.',
  'f:look': 'This is a sample. Each guest sees what they wear here.',
};

/** E-Gifts with no gift details yet: the canvas draws a Maker-only empty card, and a guest sees nothing to move. */
export const BLOCK_EMPTY_WHY = 'Guests see nothing here until you add your gift details.';

const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/** THE ONE READER — over the RAW `style_preferences` (live, or with the draft laid on it). */
export function readBlockLooks(stylePreferences: unknown): BlockLooks {
  const raw = isObject(stylePreferences) ? stylePreferences[BLOCK_LOOKS_PREF_KEY] : null;
  if (!isObject(raw)) return {};
  const out: BlockLooks = {};
  for (const block of BLOCK_LOOK_BLOCKS) {
    const v = raw[block];
    const motion = isObject(v) ? sanitizeHubElementMotion(v.motion) : null;
    if (motion) out[block] = { motion };
  }
  return out;
}

/**
 * The whole `block_looks` value with one block's motion changed (`null` = still, as today) — what the toolbar saves
 * as `{ events: { style_preferences: { block_looks: … } } }`. Built on the RAW value, so a key this build does not
 * know (the background, next) is carried; an empty object when nothing is left (the draft's part is merged over the
 * live blob, so the key cannot be taken away — `{}` reads as no look at all).
 */
export function blockLooksWith(stylePreferences: unknown, block: BlockLookBlock, motion: HubElementMotion | null): Record<string, unknown> {
  const raw = isObject(stylePreferences) && isObject(stylePreferences[BLOCK_LOOKS_PREF_KEY]) ? { ...stylePreferences[BLOCK_LOOKS_PREF_KEY] } : {};
  const one: Record<string, unknown> = isObject(raw[block]) ? { ...raw[block] } : {};
  const clean = motion ? sanitizeHubElementMotion(motion) : null;
  if (clean) one.motion = clean;
  else delete one.motion;
  if (Object.keys(one).length > 0) raw[block] = one;
  else delete raw[block];
  return raw;
}

/* ── drawing ─────────────────────────────────────────────────────────────── */

/** The hidden mark the page puts BEFORE a block that has a look (and before every one on the Maker's canvas). */
export const BLOCK_MARK_ATTR = 'data-block-mark';
/** The `<style>` the page carries its blocks' looks in — the Maker's canvas redraws it as a look is picked. */
export const BLOCK_LOOKS_STYLE_ATTR = 'data-block-looks';
/** The bridge message's `t` — `{ source, t: 'blockLooks', looks }`: the RAW `block_looks`, read strictly by the page. */
export const BLOCK_LOOKS_MESSAGE = 'blockLooks';

/**
 * A block, addressed from its mark: the element right after it — or, on the Maker's canvas, right after the Maker's
 * own marker that stands between (`data-maker-section`). No block grows an attribute of its own, and whichever
 * arrangement the block is drawn in (the March has three) is the one that is found.
 */
export function blockSelector(block: BlockLookBlock): string {
  const mark = `[${BLOCK_MARK_ATTR}="${block}"]`;
  return `:is(${mark} + :not([data-maker-section]), ${mark} + [data-maker-section] + *)`;
}

/** The Event Hub's two gates for any motion (`lib/element-style.ts` `GATE_OPEN`, word for word): an engine that
 *  fails either shows every block, at rest. */
export const BLOCK_GATE_OPEN = '@supports (animation-timeline: view()){@media (prefers-reduced-motion: no-preference){';
/** One id's worth of specificity from an id nothing carries — the block's own choice beats the page's arrival. */
const OWN = ':not(#el-own)';
const decl = (d: Array<[string, string]>) => d.map(([p, v]) => `${p}:${v}`).join(';');
const sideways = (m: HubElementMotion) => [m.in?.move, m.out?.move].some((d) => Boolean(d) && d !== 'above' && d !== 'below');

/**
 * THE RULES THE PAGE DRAWS — the motion of each block that has one, written exactly as a scene's own part is
 * (`hubElementSceneCss`): inside both gates; a timed Build in waits for the page's one observer to mark the chapter
 * the block sits in (`.pahina-in`), so it plays when the guest GETS there; one that follows the scroll follows the
 * block's own trip across the screen. Every value comes from the Event Hub's closed sets. '' when nothing moves.
 */
export function blockLooksCss(looks: BlockLooks): string {
  const rules: string[] = [];
  for (const block of BLOCK_LOOK_BLOCKS) {
    const motion = looks[block]?.motion;
    if (!motion) continue;
    const sel = `${blockSelector(block)}${OWN}`;
    /* ↔ A block that travels sideways must not widen the page. */
    if (sideways(motion)) rules.push(`:has(> [${BLOCK_MARK_ATTR}="${block}"]){overflow-x:clip}`);
    rules.push(`${sel}{${decl(hubElementMotionDeclarations(motion, 'page', false))}}`);
    rules.push(`.pahina-in ${sel},.pahina-in${sel}{${decl(hubElementMotionDeclarations(motion, 'page', true))}}`);
  }
  return rules.length > 0 ? `${BLOCK_GATE_OPEN}\n${rules.join('\n')}\n}}` : '';
}
