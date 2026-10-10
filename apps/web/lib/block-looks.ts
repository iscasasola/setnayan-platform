/**
 * 🧱 THE LOOK OF A FIXED BLOCK OF THE EVENT HUB — how it MOVES, and its BACKGROUND.
 *
 * Owner's rule (2026-10-09): *"there should always be animate and background?"* → *"yes that is what we are doing.
 * giving the freedom to fix their event hub."* — Animate for every element, Background for every block. The fixed
 * blocks (the Wedding March, The details, E-Gifts, Happening now …) had neither: they have no section row, so no
 * canvas to keep one in (`lib/fixed-scene-styles.ts` says the same of their Style picks).
 *
 * WHERE IT LIVES — beside those picks, in the event's own look object, with NO migration:
 *
 *     events.style_preferences.block_looks = { entourage: { motion: …, g: 'frost' }, details: { … }, … }
 *
 * (Proved on the replayed schema, 2026-10-10: 90 CHECKs on `events`, none on `style_preferences`, and no trigger
 * touches it.) Drafted through the Maker's one draft door as a part of `style_preferences`, live on Apply, written
 * by the existing merge. The Event Hub page already reads the column — no extra read for a guest.
 *
 * ONE STRICT READER. `readBlockLooks` keeps only the blocks listed here and, for each, only what the Event Hub's own
 * closed-set reader keeps (`sanitizeHubElementMotion` — the motion a cover line has: Build in · Action · Build out,
 * on arrival or following the scroll) and a background from the fixed three (`BLOCK_GROUNDS`). The first-load draft
 * cleaner only carries the key through.
 *
 * 🃏 BACKGROUND (2026-10-10) — `g`: the RSVP card's own three, **None · Plain · Frosted** (`lib/rsvp-look.ts`). It
 * lands on the block's ONE card, wherever that is today, so a guest never sees two frames:
 *   · Happening now — the block IS a card: it goes bare, or to glass.
 *   · E-Gifts, The details (its plate) — the card INSIDE the block goes bare or to glass; nothing is put round it.
 *   · The Wedding March, and The details drawn with no plate (Big date · Card) — bare today: the block itself takes
 *     the hub's paper (the plate's own) or the glass.
 * Absent = today's look, exactly. The tile that equals today's look stores nothing.
 *
 * WHICH BLOCKS. Only the ones a guest's page draws from ONE real root (controller 2026-10-10). The others the
 * canvas frames — Photos of you · Announcements · Live hub · Digital pass · What to wear — are SAMPLES
 * there; each guest sees their own, drawn elsewhere. A look kept for a sample would show in the Maker and never
 * reach a guest, so those stay grey and say why (`BLOCK_SAMPLE_WHY`).
 *
 * 🪑 A SAMPLE MADE REAL (2026-10-10) — Your seat. The canvas still draws a SAMPLE of it (no guest, no table), but
 * each guest's own is ONE root in one place in the page (`site-body.tsx` `seatBlock` → `YourSeatBlock`, on Welcome
 * or inside Me — never both), so the look is kept against THAT: the mark stands before the real block, and before
 * the canvas's sample too, and the same rules address both. So the sample wears what the real one wears — its
 * plate where the real one is a plate (Map), a card where it has one (Place card), bare where it is bare (Table
 * number) — and what the couple picks in the Maker is what the guest gets.
 */
import { hubElementMotionDeclarations, sanitizeHubElementMotion, type HubElementMotion } from './element-style';

/** The key inside `events.style_preferences`. */
export const BLOCK_LOOKS_PREF_KEY = 'block_looks';

/** The blocks that take a look — each is its canvas key without the `f:` (`lib/maker-parts.ts`). */
export const BLOCK_LOOK_BLOCKS = ['entourage', 'details', 'gifts', 'spotlight', 'find_your_seat'] as const;
export type BlockLookBlock = (typeof BLOCK_LOOK_BLOCKS)[number];
/** A block's background — the RSVP card's three (`RSVP_CARD_TILES`), in its order and words. */
export const BLOCK_GROUNDS = ['none', 'plain', 'frost'] as const;
export type BlockGround = (typeof BLOCK_GROUNDS)[number];
export const BLOCK_GROUND_NAME: Readonly<Record<BlockGround, string>> = { none: 'None', plain: 'Plain', frost: 'Frosted' };
/** The one sentence under the tiles — the RSVP card's, said of a block. */
export const BLOCK_GROUND_LINE = 'Behind this block is the Look’s background — the same one every page wears.';
export type BlockLook = { motion?: HubElementMotion; g?: BlockGround };
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
  'f:photos_of_you': 'This is a sample. Each guest sees their own photos here.',
  'f:announcements': 'This is a sample. Guests see your announcements here as you send them.',
  'f:live_hub': 'This is a sample. Guests see the live hub here on the day.',
  'f:pass': 'This is a sample. Each guest sees their own pass here.',
  'f:look': 'This is a sample. Each guest sees what they wear here.',
};

/**
 * WHAT EACH BLOCK WEARS TODAY, with nothing stored — the tile shown picked, and the value that is never kept (it
 * would serve a guest a mark for no change). The details has no one answer: its plate is a card, its other two
 * drawings are bare — asked of the block itself (`blockGroundToday`). Nor has Your seat: the Map is a plate, the
 * Place card holds a card, the Table number is bare.
 */
export const BLOCK_GROUND_TODAY: Readonly<Record<BlockLookBlock, BlockGround | null>> = { entourage: 'none', details: null, gifts: 'plain', spotlight: 'plain', find_your_seat: null };
/**
 * The block's own card, from its root ('' = the root is the card; null = it has none in any drawing). A list where
 * its drawings keep it in different places — Your seat: the root when it is a plate (Map), the place card inside
 * (Place card), and that card as the canvas's sample holds it (one level down, in the sample's own box).
 */
const SEAT_CARDS = ['.pahina-plate', ' > .bg-paper-deep', ' > [data-maker-sample] > .bg-paper-deep'] as const;
const GROUND_CARD: Readonly<Record<BlockLookBlock, string | readonly string[] | null>> = { entourage: null, details: ' > .pahina-plate', gifts: ' > a', spotlight: '', find_your_seat: SEAT_CARDS };
/** The root where it stands bare ('' = always; null = never) — there the root itself takes the paper or the glass. */
const GROUND_BARE: Readonly<Record<BlockLookBlock, string | null>> = {
  entourage: '',
  details: ':not(:has(> .pahina-plate))',
  gifts: null,
  spotlight: null,
  find_your_seat: ':not(.pahina-plate):not(:has(> .bg-paper-deep, > [data-maker-sample] > .bg-paper-deep))',
};
const cardsOf = (block: BlockLookBlock): readonly string[] => {
  const card = GROUND_CARD[block];
  return card === null ? [] : typeof card === 'string' ? [card] : card;
};

/** Today's background of a block as it is DRAWN (`root`: the element after its mark, or null when it cannot be asked). */
export function blockGroundToday(block: BlockLookBlock, root: Element | null): BlockGround {
  /* Asked with the block's own card selectors: on the root itself, or from it (`:scope`). */
  const hasCard = (el: Element) => cardsOf(block).some((card) => (card.startsWith(' ') ? el.querySelector(`:scope${card}`) !== null : el.matches(card || '*')));
  return BLOCK_GROUND_TODAY[block] ?? (root && !hasCard(root) ? 'none' : 'plain');
}

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
    /* A background from the fixed three — and never the one the block wears anyway (nothing would change). */
    const g = isObject(v) && (BLOCK_GROUNDS as readonly unknown[]).includes(v.g) && v.g !== BLOCK_GROUND_TODAY[block] ? (v.g as BlockGround) : null;
    if (motion || g) out[block] = { ...(motion ? { motion } : {}), ...(g ? { g } : {}) };
  }
  return out;
}

/**
 * The whole `block_looks` value with one block's motion changed (`null` = still, as today) — what the toolbar saves
 * as `{ events: { style_preferences: { block_looks: … } } }`. Built on the RAW value, so a key this build does not
 * know is carried, and so is the block's background; an empty object when nothing is left (the draft's part is merged over the
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

/**
 * The whole `block_looks` value with one block's BACKGROUND changed — `null`, or the one the block wears today
 * (`BLOCK_GROUND_TODAY`; for The details the caller asks the block, `blockGroundToday`), takes the key away. The
 * block's motion and every other block are carried as they are.
 */
export function blockLooksWithGround(stylePreferences: unknown, block: BlockLookBlock, ground: BlockGround | null): Record<string, unknown> {
  const raw = isObject(stylePreferences) && isObject(stylePreferences[BLOCK_LOOKS_PREF_KEY]) ? { ...stylePreferences[BLOCK_LOOKS_PREF_KEY] } : {};
  const one: Record<string, unknown> = isObject(raw[block]) ? { ...raw[block] } : {};
  if (ground && (BLOCK_GROUNDS as readonly unknown[]).includes(ground) && ground !== BLOCK_GROUND_TODAY[block]) one.g = ground;
  else delete one.g;
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
/**
 * 👤 BLOCKS A GUEST'S PAGE CAN DRAW OUTSIDE ITS CHAPTERS. Me is not a chapter (`site-body.tsx`: a sibling of the
 * chapters article, so nothing in it sits under the reveal's transform), and the page's one observer marks only
 * chapters and scenes `.pahina-in` — so a timed Build in on a block drawn in Me would wait for a mark that never
 * comes: seen in the Maker, never by a guest. For these blocks the timed rule is ALSO bound wherever the block has
 * no chapter round it: it plays as the block is first drawn (Me is hidden until its tab is opened, and an animation
 * starts when its element is first rendered). Inside a chapter it waits for the observer, like every other block.
 */
const OFF_CHAPTERS: readonly BlockLookBlock[] = ['find_your_seat'];
const NO_CHAPTER = ':not([data-pahina-chapters] *)';
const decl = (d: Array<[string, string]>) => d.map(([p, v]) => `${p}:${v}`).join(';');
const sideways = (m: HubElementMotion) => [m.in?.move, m.out?.move].some((d) => Boolean(d) && d !== 'above' && d !== 'below');

/* 🃏 The grounds, written as the RSVP card's are (`lib/rsvp-look.ts` `CARD_GROUND`, word for word — held equal by the
   guard): nothing at all, or the app's own glass (`--sn-glass-*`, globals.css). A card that gives up its paper also
   gives up the plate's printed inner frame and the plate's own ink, so the words read on the page's ground. */
const GROUND_NONE = 'background:transparent!important;border-color:transparent!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;';
const GROUND_FROST = 'background:var(--sn-glass-bg)!important;border-color:var(--sn-glass-line)!important;backdrop-filter:var(--sn-glass-blur)!important;-webkit-backdrop-filter:var(--sn-glass-blur)!important;';
const NO_INNER_FRAME = '--pahina-frame-opacity:0!important;';
/* The glass needs its hairline to be seen at all on a light page (globals.css: its fill alone measures 1.03–1.05:1),
   and the plate has no edge of its own to recolour (measured 2026-10-10: `border-top-style: none`) — so a card that
   turns to glass is given the one-pixel edge outright. The door and Happening now already have exactly that edge. */
const CARD_EDGE = 'border-width:1px!important;border-style:solid!important;';
const PAGE_INK = '--color-ink:inherit!important;color:inherit!important;';
/**
 * The hub's paper, as its plate wears it (`.sn-editorial .pahina-plate`, globals.css): the same paper, edge and room —
 * and the plate's own ink (`--color-ink-on-plate`, set when a couple's dark page turns the ink light), so the words
 * stay readable on paper that never darkens.
 *
 * ⚠ NOT the plate's own two ink lines copied. `--color-ink:var(--color-ink-on-plate, var(--color-ink))` names itself;
 * on this block the engine threw the whole value away, and with it every `rgb(var(--color-ink) / …)` beside it — the
 * edge computed to no border at all (measured in the Maker lab, 2026-10-10: `border-top-width: 0px`). So the ink is
 * read ONCE into a name of the block's own (`--block-ink`, no loop), and handed to what is INSIDE the block.
 */
const ROOT_PLAIN = '--block-ink:var(--color-ink-on-plate, var(--color-ink));color:rgb(var(--block-ink));background:rgb(var(--color-paper-deep))!important;border:1px solid rgb(var(--block-ink) / 0.1)!important;padding:1.25rem!important;';
const ROOT_PLAIN_INSIDE = '--color-ink:var(--block-ink);';
const ROOT_FROST = `border:1px solid var(--sn-glass-line)!important;padding:1.25rem!important;${GROUND_FROST}`;

/**
 * 🃏 THE BACKGROUND RULES — at most three per block, each on a selector from the fixed tables above; the value picks
 * between fixed strings and is never written. NOT inside the motion's gates: a background is not a movement, so it
 * shows on every engine and for a guest who asked for less motion.
 */
function blockGroundRules(looks: BlockLooks): string[] {
  const rules: string[] = [];
  for (const block of BLOCK_LOOK_BLOCKS) {
    const g = looks[block]?.g;
    if (!g) continue;
    const root = blockSelector(block);
    const cards = cardsOf(block);
    if (cards.length > 0 && g !== 'plain') rules.push(`${cards.map((card) => `${root}${card}`).join(',')}{${g === 'none' ? `${GROUND_NONE}${PAGE_INK}` : `${GROUND_FROST}${CARD_EDGE}`}${NO_INNER_FRAME}}`);
    const bare = GROUND_BARE[block];
    if (bare !== null && g !== 'none') rules.push(`${root}${bare}{${g === 'plain' ? ROOT_PLAIN : ROOT_FROST}}`);
    if (bare !== null && g === 'plain') rules.push(`${root}${bare} > *{${ROOT_PLAIN_INSIDE}}`);
  }
  return rules;
}

/**
 * THE RULES THE PAGE DRAWS — the background of each block that has one (`blockGroundRules`), then the motion of
 * each block that has one, written exactly as a scene's own part is
 * (`hubElementSceneCss`): inside both gates; a timed Build in waits for the page's one observer to mark the chapter
 * the block sits in (`.pahina-in`), so it plays when the guest GETS there (a block Me draws has no chapter: it plays
 * as Me is opened — `OFF_CHAPTERS`); one that follows the scroll follows the
 * block's own trip across the screen. Every value comes from the Event Hub's closed sets. '' when no block has a look.
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
    rules.push(`.pahina-in ${sel},.pahina-in${sel}${OFF_CHAPTERS.includes(block) ? `,${sel}${NO_CHAPTER}` : ''}{${decl(hubElementMotionDeclarations(motion, 'page', true))}}`);
  }
  return [...blockGroundRules(looks), ...(rules.length > 0 ? [`${BLOCK_GATE_OPEN}\n${rules.join('\n')}\n}}`] : [])].join('\n');
}
