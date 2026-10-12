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
 * canvas frames — Announcements · Live hub · What to wear — were SAMPLES
 * there; each guest sees their own, drawn elsewhere. A look kept for a sample would show in the Maker and never
 * reach a guest, so those stayed grey and said why (`BLOCK_SAMPLE_WHY`) — until each was kept against its real block
 * (2026-10-12, below).
 *
 * 🪑 A SAMPLE MADE REAL (2026-10-10) — Your seat. The canvas still draws a SAMPLE of it (no guest, no table), but
 * each guest's own is ONE root in one place in the page (`site-body.tsx` `seatBlock` → `YourSeatBlock`, on Welcome
 * or inside Me — never both), so the look is kept against THAT: the mark stands before the real block, and before
 * the canvas's sample too, and the same rules address both. So the sample wears what the real one wears — its
 * plate where the real one is a plate (Map), a card where it has one (Place card), bare where it is bare (Table
 * number) — and what the couple picks in the Maker is what the guest gets.
 *
 * 🎫 …AND THE DIGITAL PASS (2026-10-10). Each guest's own is `GuestTicket` (`guest-ticket.tsx`), drawn first on Me:
 * one root, already named (`id=PASS_ANCHOR`, `data-motion="pass"`). The mark rides with the TICKET — handed to the
 * component, which puts it right before its root only when it draws a ticket (a guest who has not replied sees the
 * reply button there, one who cannot come sees one line: neither is a pass, and neither is dressed or moved). The
 * ticket's picture is drawn on the server (a PNG); a Background stands BEHIND it — the block's root takes the paper
 * or the glass — and never re-draws it. Bare today, like the March.
 * ⚓ THE DOOR'S OWN LIFT STAYS. When the day's "Show your ticket" lands on the pass (`#site-pass`),
 * `[data-motion='pass']:target` (globals.css) lifts it so it reads as the thing to show at the door. A block's motion
 * would out-rank that rule, so the pass's is written for every moment BUT that one (`:not(:target)`).
 *
 * 🖼 …AND PHOTOS OF YOU — ANIMATE ONLY (owner 2026-10-10, verbatim: *"animate only"*). Each guest's own is
 * `PhotosOfYouGallery` (`photos-of-you-gallery.tsx`): ONE root (`<section aria-label="Photos of you" class="sn-gal">`),
 * mounted once by `site-body.tsx` — on The Day and after it, the same mount. That root is the gallery's dark card,
 * whose words are light by its own tokens (`--sn-ob-*`), so it takes NO Background: no tile is offered, a stored `g`
 * is refused by the reader, and no ground rule is ever written for it (`BLOCK_MOTION_ONLY`). It moves, and that is
 * all. An opened photo is drawn INSIDE that root, over the whole screen — see `HOLDS_STILL_WHILE`.
 *
 * 📣 …AND THE SAMPLES MADE REAL (2026-10-12, owner's go: "sample blocks"). Each guest's own is ONE root, and the mark
 * stands right before it only where it draws:
 *   · ANNOUNCEMENTS — `DayOfAnnouncement` (`day-of-announcement.tsx`), drawn by the guest tree's LAYOUT
 *     (`app/[slug]/layout.tsx`), not by `SiteBody`: the layout carries the block's own mark and its own `<style>`
 *     (`announcement-look.tsx`), from the column it already reads. Its root is the `<aside>`; the card is the one
 *     `<div>` inside it (Banner · Notice), and the Line has none (the root stands bare). ⚫ On the day the Notice is
 *     the INK card — light words on dark, by its own classes — so, as with Photos of you, it is never given a ground:
 *     that one card is left out of every rule (`:not(.bg-ink)`), and it keeps its own. 📌 On the day the block rides
 *     STUCK to the top of the screen (`sticky top-0`): a motion that follows the scroll would hold it half-gone the
 *     whole time it rides there, so while it is stuck only what has an end plays (`STILL_WHERE`). It is never in a
 *     chapter (`OFF_CHAPTERS`).
 *   · WHAT TO WEAR — the dress code's own "you" panel, `DressCodeWidget` (`part="you"` on Welcome, `part="wear"` in
 *     Me — a guest gets one or the other, never both: `meParts` decides). The mark is HANDED to the widget, which puts
 *     it before its root only when it draws one (a guest with nothing personal gets nothing — and no mark pointing at
 *     the NEXT part). Words on the page, no card: bare, like the March.
 *   · LIVE HUB — ANIMATE ONLY, by the same reason as Photos of you: the live wall IS the gallery's dark card
 *     (`sn-gal`) and the player is the ink card (`bg-ink`), light words on both. Drawn ONE way per arrangement:
 *     Theatre and Wall first are one `<section>` (`LiveHubArrangement`), Player and wall is the two pieces, each in
 *     its own place on the page (on a guest's own page the run of show stands between them) — so each piece takes
 *     the mark, and the one look moves both. NO WRAPPER: one would move the wall for every guest. The wall opens a
 *     photo inside itself, like the gallery (`HOLDS_STILL_WHILE`).
 * With the Live hub, no part of the canvas is a sample any more (`BLOCK_SAMPLE_WHY` is empty).
 */
import { hubElementMotionDeclarations, sanitizeHubElementMotion, type HubElementMotion } from './element-style';

/** The key inside `events.style_preferences`. */
export const BLOCK_LOOKS_PREF_KEY = 'block_looks';

/** The blocks that take a look — each is its canvas key without the `f:` (`lib/maker-parts.ts`). */
export const BLOCK_LOOK_BLOCKS = ['entourage', 'details', 'gifts', 'spotlight', 'find_your_seat', 'pass', 'photos_of_you', 'announcements', 'look', 'live_hub'] as const;
export type BlockLookBlock = (typeof BLOCK_LOOK_BLOCKS)[number];
/**
 * 🖼 THE BLOCKS THAT ONLY MOVE — Animate, and no Background (owner 2026-10-10 of Photos of you: *"animate only"*; its
 * root is the gallery's own dark card). Everything about a ground below is asked of the OTHER blocks alone
 * (`BlockGroundBlock`), so one of these can be given none by the reader, by the save or by a rule.
 */
export const BLOCK_MOTION_ONLY = ['photos_of_you', 'live_hub'] as const satisfies readonly BlockLookBlock[];
export type BlockGroundBlock = Exclude<BlockLookBlock, (typeof BLOCK_MOTION_ONLY)[number]>;
export const blockTakesGround = (block: BlockLookBlock): block is BlockGroundBlock => !(BLOCK_MOTION_ONLY as readonly string[]).includes(block);
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
 * 📣 2026-10-12: EMPTY — the last three (Announcements · Live hub · What to wear) took their real block's look. Kept
 * (the toolbar still asks it) so a future sample has one place to say so.
 */
export const BLOCK_SAMPLE_WHY: Readonly<Record<string, string>> = {};

/**
 * WHAT EACH BLOCK WEARS TODAY, with nothing stored — the tile shown picked, and the value that is never kept (it
 * would serve a guest a mark for no change). The details has no one answer: its plate is a card, its other two
 * drawings are bare — asked of the block itself (`blockGroundToday`). Nor has Your seat: the Map is a plate, the
 * Place card holds a card, the Table number is bare.
 */
export const BLOCK_GROUND_TODAY: Readonly<Record<BlockGroundBlock, BlockGround | null>> = { entourage: 'none', details: null, gifts: 'plain', spotlight: 'plain', find_your_seat: null, pass: 'none', announcements: null, look: 'none' };
/**
 * The block's own card, from its root ('' = the root is the card; null = it has none in any drawing). A list where
 * its drawings keep it in different places — Your seat: the root when it is a plate (Map), the place card inside
 * (Place card), and that card as the canvas's sample holds it (one level down, in the sample's own box).
 */
const SEAT_CARDS = ['.pahina-plate', ' > .bg-paper-deep', ' > [data-maker-sample] > .bg-paper-deep'] as const;
/** 📣 Announcements: the one `<div>` card inside a guest's `<aside>` (Banner · Notice) — never the day's INK Notice,
 *  whose words are light on its own dark (`announcement-styles.tsx`: `bg-ink text-cream`) — and, on the canvas, the
 *  sample's card shape (`maker-fixed-parts.tsx`: `data-sample-card`). */
const ANNOUNCE_CARDS = [' > div:not(.bg-ink):not([data-maker-sample])', ' > [data-maker-sample] > [data-sample-card]'] as const;
const GROUND_CARD: Readonly<Record<BlockGroundBlock, string | readonly string[] | null>> = { entourage: null, details: ' > .pahina-plate', gifts: ' > a', spotlight: '', find_your_seat: SEAT_CARDS, pass: null, announcements: ANNOUNCE_CARDS, look: null };
/** The root where it stands bare ('' = always; null = never) — there the root itself takes the paper or the glass. */
const GROUND_BARE: Readonly<Record<BlockGroundBlock, string | null>> = {
  entourage: '',
  details: ':not(:has(> .pahina-plate))',
  gifts: null,
  spotlight: null,
  find_your_seat: ':not(.pahina-plate):not(:has(> .bg-paper-deep, > [data-maker-sample] > .bg-paper-deep))',
  pass: '',
  /* The Line (a guest's, or the sample's) has no card: the root takes it. The day's INK Notice has its card, so it
     is not bare either — it is reached by no rule at all. */
  announcements: ':not(:has(> div:not([data-maker-sample]), > [data-maker-sample] > [data-sample-card]))',
  look: '',
};
const cardsOf = (block: BlockGroundBlock): readonly string[] => {
  const card = GROUND_CARD[block];
  return card === null ? [] : typeof card === 'string' ? [card] : card;
};

/** Today's background of a block as it is DRAWN (`root`: the element after its mark, or null when it cannot be asked). */
export function blockGroundToday(block: BlockGroundBlock, root: Element | null): BlockGround {
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
    /* A background from the fixed three — and never the one the block wears anyway (nothing would change). A block
       that only moves (`BLOCK_MOTION_ONLY`) is given none, whatever is stored. */
    const g = blockTakesGround(block) && isObject(v) && (BLOCK_GROUNDS as readonly unknown[]).includes(v.g) && v.g !== BLOCK_GROUND_TODAY[block] ? (v.g as BlockGround) : null;
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
  /* A block that only moves keeps no background — one found in the raw value is not carried on. */
  if (!blockTakesGround(block)) delete one.g;
  if (Object.keys(one).length > 0) raw[block] = one;
  else delete raw[block];
  return raw;
}

/**
 * The whole `block_looks` value with one block's BACKGROUND changed — `null`, or the one the block wears today
 * (`BLOCK_GROUND_TODAY`; for The details the caller asks the block, `blockGroundToday`), takes the key away. The
 * block's motion and every other block are carried as they are.
 */
export function blockLooksWithGround(stylePreferences: unknown, block: BlockGroundBlock, ground: BlockGround | null): Record<string, unknown> {
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
const OFF_CHAPTERS: readonly BlockLookBlock[] = ['find_your_seat', 'pass', 'announcements', 'look', 'live_hub'];
const NO_CHAPTER = ':not([data-pahina-chapters] *)';
/** ⚓ The pass, while the address points at it: the door's own lift plays (`[data-motion='pass']:target`), not this. */
const NOT_THE_DOOR: Readonly<Partial<Record<BlockLookBlock, string>>> = { pass: ':not(:target)' };
/**
 * 🖼 A BLOCK THAT OPENS SOMETHING OVER THE WHOLE SCREEN FROM INSIDE ITSELF — Photos of you: a tapped photo opens in
 * the gallery's own lightbox, drawn INSIDE the block's root (`gallery-lightbox.tsx`: `fixed inset-0`, its card
 * `aria-modal="true"`). An element whose `transform` / `translate` / `filter` is being animated becomes the box its
 * `fixed` children are measured from — so while the block Drifts, or follows the scroll (both run for as long as the
 * block is on the page), an opened photo would be drawn inside the card, and move with it, instead of over the page.
 * So WHILE something modal is open in the block, what keeps moving is taken out (`settled`): the Action, and whatever
 * is bound to the scroll. A timed Build in is left in the list — it has ended by then (its fill is `none`: it holds
 * nothing), and taking it out would play it again each time a photo is closed. Nothing is written when nothing keeps
 * moving. (`:has()` is in every engine that passes the motion's own gate; one that lacked it would drop the rule.)
 */
const HOLDS_STILL_WHILE: Readonly<Partial<Record<BlockLookBlock, string>>> = { photos_of_you: ':has([aria-modal="true"])', live_hub: ':has([aria-modal="true"])' };
/**
 * 📌 A BLOCK THAT RIDES STUCK TO THE SCREEN — Announcements on the day (`app/[slug]/layout.tsx`: the block's root is
 * the direct child of `sticky top-0`). Its trip across the screen stops while it rides there, so a motion that
 * follows the scroll would hold it wherever that trip stopped — a Build out half-done, the coordinator's words half
 * gone, for as long as the guest reads the page. While it is stuck, what follows the scroll is taken out (a timed
 * Build in and Drift stay: they do not depend on the scroll). Before the day the block is in the page's flow and this
 * matches nothing.
 */
const STILL_WHERE: Readonly<Partial<Record<BlockLookBlock, string>>> = { announcements: ':is(.sticky > *)' };
/** A motion with what FOLLOWS THE SCROLL taken out — null when nothing does. */
const unscrolled = (motion: HubElementMotion): HubElementMotion | null => (motion.timeline === 'scroll' ? {} : null);
/** A motion with what KEEPS moving taken out — null when nothing does (a timed Build in alone ends by itself). */
function settled(motion: HubElementMotion): HubElementMotion | null {
  if (motion.timeline === 'scroll') return {};
  if (!motion.during) return null;
  const rest = { ...motion };
  delete rest.during;
  return rest;
}
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
    /* A block that only moves has no card to dress and takes no ground of its own (`BLOCK_MOTION_ONLY`). */
    if (!blockTakesGround(block)) continue;
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
    const sel = `${blockSelector(block)}${OWN}${NOT_THE_DOOR[block] ?? ''}`;
    /* ↔ A block that travels sideways must not widen the page. */
    if (sideways(motion)) rules.push(`:has(> [${BLOCK_MARK_ATTR}="${block}"]){overflow-x:clip}`);
    rules.push(`${sel}{${decl(hubElementMotionDeclarations(motion, 'page', false))}}`);
    rules.push(`.pahina-in ${sel},.pahina-in${sel}${OFF_CHAPTERS.includes(block) ? `,${sel}${NO_CHAPTER}` : ''}{${decl(hubElementMotionDeclarations(motion, 'page', true))}}`);
    /* 🖼 …and while the block has something open over the whole screen, only what has an end is left (`HOLDS_STILL_WHILE`).
       Written AFTER the two above, on the same selector and one step more exact: it wins for that moment alone. */
    const open = HOLDS_STILL_WHILE[block];
    const still = open ? settled(motion) : null;
    if (open && still) {
      rules.push(`${sel}${open}{${decl(hubElementMotionDeclarations(still, 'page', false))}}`);
      /* (A block drawn outside the chapters — the live hub's pieces can be — keeps its no-chapter arm here too, or the
         ended Build in would be swapped out while a photo is open and play again as it closes.) */
      rules.push(`.pahina-in ${sel}${open},.pahina-in${sel}${open}${OFF_CHAPTERS.includes(block) ? `,${sel}${open}${NO_CHAPTER}` : ''}{${decl(hubElementMotionDeclarations(still, 'page', true))}}`);
    }
    /* 📌 …and while it rides stuck to the screen, nothing follows the scroll (`STILL_WHERE`) — the same place as above. */
    const where = STILL_WHERE[block];
    const fixed = where ? unscrolled(motion) : null;
    if (where && fixed) {
      const at = `${sel}${where}`;
      rules.push(`${at}{${decl(hubElementMotionDeclarations(fixed, 'page', false))}}`);
      rules.push(`.pahina-in ${at},.pahina-in${at}${OFF_CHAPTERS.includes(block) ? `,${at}${NO_CHAPTER}` : ''}{${decl(hubElementMotionDeclarations(fixed, 'page', true))}}`);
    }
  }
  return [...blockGroundRules(looks), ...(rules.length > 0 ? [`${BLOCK_GATE_OPEN}\n${rules.join('\n')}\n}}`] : [])].join('\n');
}
