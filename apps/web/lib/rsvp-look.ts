/**
 * 🎨 THE LOOK OF EACH LINE OF THE REPLY PAGES — one optional object inside `events.rsvp_ask_config` (`look`).
 *
 * Owner, on the live Maker's RSVP stage (2026-10-09): "shouldn't it be per element?" — every line is its own part,
 * so Style is the picked line's. Controller's conditions, all held here:
 *   · ABSENT = TODAY'S LOOK. No key, no rule: a page that never met the Maker draws exactly as it did.
 *   · EVERY STORED VALUE IS CHECKED — a size is one of six named steps, a font is a key of the app's own font list
 *     (`HUB_FONTS`), and a colour is what the app's ONE colour picker hands back: `#rrggbb`, kept only through the
 *     app's own colour gate (`hubElementColor`, the one a cover line's colour goes through). Nothing a person typed
 *     ever reaches CSS unchecked: `readRsvpLook` keeps only those, and it is the ONLY way a page or the Maker reads
 *     the object.
 *
 * 🎨 ONE COLOUR, FROM THE ONE PICKER (owner 2026-10-10: *"i thought our plan for colour is just 1 colour with a color
 * picker pop up?"*) — the same shape a cover line's colour is stored in. It was a SLOT (1–5) of the event's five
 * colours for one day: a stored slot is still read and still drawn from the event's colours, and is never written
 * again. 🔤 A FONT OF ITS OWN (*"Should be Font instead of Look and should be drop down"*): a part's own font, as the
 * Event Hub's parts have it — a key into `HUB_FONTS`, drawn through that face's own variable.
 *   · It rides the same object, the same draft and the same Apply as the words — no new read for a guest.
 *
 * The first-load sanitiser (`sanitizeRsvpAskConfig`, read by `lib/hub-draft.ts`) only carries `look` through, so an
 * older panel's save can never drop it; the strict reading is here, in a module that loads with the pages (on the
 * server), with the lazy panel, and — on the Maker's canvas only — when a look is first picked (the bridge imports it
 * on that message, so a guest's bundle never carries it).
 *
 * 🧱 ROOM FOR WHAT COMES NEXT (the ＋, drag and Group — owner's ruling 2026-10-09): `look` is an object of named
 * keys. `lines` and `card` are here now; the order of the lines, added lines and groups each take a key of their
 * own beside them, so nothing stored today has to move. The whole config is capped at 2,048 bytes by the
 * database (`events_rsvp_ask_config_shape`): `rsvpConfigFits` is asked before a save, so a couple is told in a
 * sentence instead of at Apply.
 */

import { FEEL_SECONDS } from './animate-feel';
import { hubElementColor } from './element-style';
import { HUB_FONT_BY_KEY, sanitizeHubFontKey, type HubFontKey } from './hub-fonts';
import { motionFxFrame, sanitizeMotionFx, type MotionFx } from './motion-effects';
import { RSVP_LOOK_MESSAGE, RSVP_LOOK_STYLE_ATTR } from './rsvp-stage-shared';

export { RSVP_LOOK_MESSAGE, RSVP_LOOK_STYLE_ATTR };

/** Every line that can be styled: `<the Maker part>.<the line's name>` (`RSVP_SECTION_LINES`, `rsvp-canvas-parts.ts`). */
export const RSVP_LOOK_LINES = [
  'rsvp.eyebrow',
  'rsvp.question',
  'rsvp.yes',
  'rsvp.no',
  'rsvp.hint',
  'yesnote.heading',
  'yesnote.message',
  'pass.save',
  'nonote.heading',
  'nonote.message',
] as const;
export type RsvpLookLine = (typeof RSVP_LOOK_LINES)[number];

/** A BUTTON line: its colours are Look › Buttons' (one set for every button of the event) — its font and size are its own. */
export const RSVP_LOOK_BUTTON_LINES: readonly RsvpLookLine[] = ['rsvp.yes', 'rsvp.no', 'pass.save'];

/** The six sizes, as % of the line's own size — a subset of the Event Hub's steps (`HUB_ELEMENT_SIZE_STEPS`). */
export const RSVP_LOOK_SIZES = [85, 92, 100, 110, 120, 132] as const;
export type RsvpLookSize = (typeof RSVP_LOOK_SIZES)[number];
/** The colour slots: the event's own five colours, in their order. READ ONLY since 2026-10-10 — see the top. */
export const RSVP_LOOK_SLOTS = [1, 2, 3, 4, 5] as const;
export type RsvpLookSlot = (typeof RSVP_LOOK_SLOTS)[number];
/** A line's colour: what the one picker handed back (`#rrggbb`, through `hubElementColor`) — or an older slot. */
export type RsvpLookColour = RsvpLookSlot | string;

/**
 * ✨ HOW A LINE (OR THE CARD) ARRIVES — its Build in. `i`: the Event Hub's own effects, in its own stored shape
 * (`MotionFx`, `lib/motion-effects.ts`: Fade · Blur · Move from a side · Size) and read by its own closed-set reader
 * (`sanitizeMotionFx`). `v`: how it moves — Quick or Cinematic; Calm is the absence of the key.
 * A reply page is ONE screen a guest leaves by answering: it has no scroll to follow and no exit, so there is no
 * Action and no Build out to store.
 */
export const RSVP_LOOK_FEELS = ['quick', 'cinematic'] as const;
export type RsvpLookFeel = (typeof RSVP_LOOK_FEELS)[number];
export type RsvpMotion = { i?: MotionFx; v?: RsvpLookFeel };

/** One line's look. `c` a colour · `f` a font · `s` a size · its Build in. Short keys: the object lives under a 2 KB cap. */
export type RsvpLineLook = { c?: RsvpLookColour; f?: HubFontKey; s?: RsvpLookSize } & RsvpMotion;

/**
 * 🃏 THE CARD — each screen's group of lines is one block (`RSVP_CARD_GROUPS`, `rsvp-canvas-parts.ts`), keyed by the
 * Maker part it holds. `g`: its background — **None** (the page's own ground shows through) or **Frosted** (the
 * app's glass); **Plain**, today's card, is the absence of the key. And its own Build in.
 */
export const RSVP_LOOK_CARDS = ['rsvp', 'yesnote', 'nonote'] as const;
export type RsvpLookCard = (typeof RSVP_LOOK_CARDS)[number];
export const RSVP_CARD_GROUNDS = ['none', 'frost'] as const;
export type RsvpCardGround = (typeof RSVP_CARD_GROUNDS)[number];
export type RsvpCardLook = { g?: RsvpCardGround } & RsvpMotion;

export type RsvpLook = { lines?: Partial<Record<RsvpLookLine, RsvpLineLook>>; card?: Partial<Record<RsvpLookCard, RsvpCardLook>> };
/** What a look is kept FOR: a line, or a screen's card. */
export type RsvpLookTarget = RsvpLookLine | { card: RsvpLookCard };

export function rsvpLookCard(part: string | null | undefined): RsvpLookCard | null {
  return (RSVP_LOOK_CARDS as readonly unknown[]).includes(part) ? (part as RsvpLookCard) : null;
}

export function rsvpLookLine(part: string | null | undefined, line: string | null | undefined): RsvpLookLine | null {
  const id = `${part}.${line}`;
  return (RSVP_LOOK_LINES as readonly string[]).includes(id) ? (id as RsvpLookLine) : null;
}

const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/** A Build in, read strictly: the Event Hub's closed sets (four effects, eight sides, two sizes), two feels. */
function readMotion(v: Record<string, unknown>): RsvpMotion {
  const out: RsvpMotion = {};
  const fx = sanitizeMotionFx(v.i);
  if (fx) {
    out.i = fx;
    if ((RSVP_LOOK_FEELS as readonly unknown[]).includes(v.v)) out.v = v.v as RsvpLookFeel;
  }
  return out;
}

/**
 * 🚫 DOES STYLE HAVE A ROW FOR THIS PICK ON THE REPLY PAGES? ONE answer, asked by the toolbar (a tool with nothing to
 * change is grey and says so — `stage-tools.tsx`) and held to what the panel really draws
 * (`the-rsvp-tools-stand-in-the-four-rows.test.ts`): a LINE with a look has Font · Colour · Size; the When-yes card has
 * its Celebration ▾. Nothing else has: the form's card (its settings are Edit's), the When-no card, the couple's
 * mark, their names, the date, the place, a guest's own name and ticket.
 */
export function rsvpStyleHasRows(part: string | null, line: string | null): boolean {
  return rsvpLookLine(part, line) !== null || (part === 'yesnote' && line === null);
}

/** THE ONE READER — over the RAW `rsvp_ask_config`. Only known lines and cards, only values from the lists above. */
export function readRsvpLook(config: unknown): RsvpLook {
  const raw = isObject(config) ? config.look : null;
  if (!isObject(raw)) return {};
  const out: RsvpLook = {};
  const lines = isObject(raw.lines) ? raw.lines : {};
  for (const id of RSVP_LOOK_LINES) {
    const v = lines[id];
    if (!isObject(v)) continue;
    const look: RsvpLineLook = readMotion(v);
    const colour = RSVP_LOOK_BUTTON_LINES.includes(id) ? null : (RSVP_LOOK_SLOTS as readonly unknown[]).includes(v.c) ? (v.c as RsvpLookSlot) : hubElementColor(v.c);
    if (colour) look.c = colour;
    const font = sanitizeHubFontKey(v.f);
    if (font) look.f = font;
    if ((RSVP_LOOK_SIZES as readonly unknown[]).includes(v.s) && v.s !== 100) look.s = v.s as RsvpLookSize;
    if (Object.keys(look).length > 0) (out.lines ??= {})[id] = look;
  }
  const cards = isObject(raw.card) ? raw.card : {};
  for (const id of RSVP_LOOK_CARDS) {
    const v = cards[id];
    if (!isObject(v)) continue;
    const look: RsvpCardLook = readMotion(v);
    if ((RSVP_CARD_GROUNDS as readonly unknown[]).includes(v.g)) look.g = v.g as RsvpCardGround;
    if (Object.keys(look).length > 0) (out.card ??= {})[id] = look;
  }
  return out;
}

/**
 * The stored `look` with one line's or one card's look changed — what the panel saves. A key set to `null` goes back
 * to the page's own. Built on the RAW `look`, so a key this build does not know (a later one's) is carried, never
 * dropped; `undefined` when nothing is left, so an event back to its own look stores no `look` at all.
 */
export function rsvpLookWith(
  config: unknown,
  target: RsvpLookTarget,
  patch: { c?: RsvpLookColour | null; f?: HubFontKey | null; s?: RsvpLookSize | null; g?: RsvpCardGround | null; i?: MotionFx | null; v?: RsvpLookFeel | null },
): Record<string, unknown> | undefined {
  const rest: Record<string, unknown> = isObject(config) && isObject(config.look) ? { ...config.look } : {};
  const read = readRsvpLook(config);
  const one: Record<string, unknown> = { ...(typeof target === 'string' ? read.lines?.[target] : read.card?.[target.card]) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value === null || (key === 's' && value === 100)) delete one[key];
    /* A picked colour is stored as the app's colour gate hands it back — or not at all. */
    else if (key === 'c' && typeof value === 'string') {
      const colour = hubElementColor(value);
      if (colour) one.c = colour;
    } else one[key] = value;
  }
  if (!one.i) delete one.v; /* a feel times an effect: with none there is nothing to keep */
  const all: Record<string, unknown> = { ...(typeof target === 'string' ? read.lines : read.card) };
  const id = typeof target === 'string' ? target : target.card;
  if (Object.keys(one).length > 0) all[id] = one;
  else delete all[id];
  const home = typeof target === 'string' ? 'lines' : 'card';
  /* Each home is rewritten from the STRICT reading, so what this build cannot read is not kept inside it. */
  for (const [k, v] of [['lines', home === 'lines' ? all : read.lines], ['card', home === 'card' ? all : read.card]] as const) {
    if (v && Object.keys(v).length > 0) rest[k] = v;
    else delete rest[k];
  }
  return Object.keys(rest).length > 0 ? rest : undefined;
}

/** The door's card, for every guest: the block that holds the masthead (`DoorShell`). No attribute is served for it. */
export const RSVP_CARD_SELECTOR = 'div:has(>[data-door-header])';
/** How far a Move travels in, in px — a line's short step, the same on both axes. */
const MOVE_PX = [24, 24] as const;
/** One keyframe for every Build in (the Event Hub's `el-in-mix` idea): three values the rule sets, read once. */
const KEYFRAMES =
  '@keyframes rsvp-in{from{opacity:var(--rl-o);transform:var(--rl-t);filter:var(--rl-f)}}' +
  `@media (prefers-reduced-motion:reduce){[data-rsvp-line],${RSVP_CARD_SELECTOR}{animation:none!important}}`;

/** A Build in as declarations — every value from the Event Hub's own frame (`motionFxFrame`) and its feel's seconds. */
function motionRules(m: RsvpMotion): string {
  if (!m.i) return '';
  const f = motionFxFrame(m.i, 'in', MOVE_PX);
  return `--rl-o:${f.opacity};--rl-t:${f.transform};--rl-f:${f.filter};animation:rsvp-in ${FEEL_SECONDS[m.v ?? 'calm']}s cubic-bezier(.16,1,.3,1) both;`;
}

/** The card's two grounds that are not today's: nothing at all, or the app's own glass (`--sn-glass-*`, globals.css). */
const CARD_GROUND: Record<RsvpCardGround, string> = {
  none: 'background:transparent!important;border-color:transparent!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;',
  frost:
    'background:var(--sn-glass-bg)!important;border-color:var(--sn-glass-line)!important;backdrop-filter:var(--sn-glass-blur)!important;-webkit-backdrop-filter:var(--sn-glass-blur)!important;',
};

/**
 * 🃏 ONE CARD, NOT TWO (owner 2026-10-09, on When no: *"why do i see a rounded edge frame as well?"*). The When-no
 * note sits in a card of its own INSIDE the door's card. With nothing chosen, today's look stays exactly — both. Once
 * the couple gives the card a ground (None or Frosted), the inner note gives up its own paper, border and shadow, so
 * only one card (or none) shows.
 */
export const RSVP_INNER_CARD_SELECTOR = '[data-landing-missed]';
const INNER_CARD_PLAIN = 'background:transparent!important;border-color:transparent!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;';

/** One thing a page draws a look on: how it is addressed, what is declared for it, and whether that is a Build in. */
type LookRule = { selector: string; rules: string; moves: boolean };

/**
 * EVERY RULE A PAGE DRAWS, AS DATA — for the parts it shows (`['rsvp']` the form · `['yesnote', 'pass']` ·
 * `['nonote']`). `selector` is ALWAYS a plain selector the page can be asked for (a named line, the card, the inner
 * note card) — never an at-rule: the keyframe and the reduced-motion block are `rsvpLookCss`'s own tail and are not
 * in this list. (The canvas once split the finished CSS text to find what to replay, and handed
 * `@media (prefers-reduced-motion:reduce)` to `querySelectorAll` — a thrown error on every Move.)
 */
export function rsvpLookRules(look: RsvpLook, parts: readonly string[], board: readonly string[]): LookRule[] {
  const out: LookRule[] = [];
  for (const id of RSVP_LOOK_CARDS) {
    const v = look.card?.[id];
    if (!v || !parts.includes(id)) continue;
    const rules = `${v.g ? CARD_GROUND[v.g] : ''}${motionRules(v)}`;
    if (rules) out.push({ selector: RSVP_CARD_SELECTOR, rules, moves: Boolean(v.i) });
    if (v.g && id === 'nonote') out.push({ selector: RSVP_INNER_CARD_SELECTOR, rules: INNER_CARD_PLAIN, moves: false });
  }
  for (const id of RSVP_LOOK_LINES) {
    const [part, line] = id.split('.') as [string, string];
    const v = look.lines?.[id];
    if (!v || !parts.includes(part)) continue;
    /* Its own colour, or an older slot's (the event's colour in that place) — either way through the one gate. */
    const colour = hubElementColor(typeof v.c === 'number' ? board[v.c - 1] : v.c);
    const font = sanitizeHubFontKey(v.f);
    const face = font ? `font-family:var(${HUB_FONT_BY_KEY[font].cssVar}), ${HUB_FONT_BY_KEY[font].fallback};` : '';
    const rules = `${colour ? `color:${colour};` : ''}${face}${v.s ? `zoom:${v.s / 100};` : ''}${motionRules(v)}`;
    if (rules) out.push({ selector: `[data-rsvp-line="${line}"][data-rsvp-line]`, rules, moves: Boolean(v.i) });
  }
  return out;
}

/**
 * THE RULES A PAGE DRAWS, as the text of its one `<style>`. `board`: the event's five colours
 * (`celebrationColours(boardSwatches(role_palette))`, the same list the Maker's swatches show). Every value written
 * is from a fixed list or a checked colour (`hubElementColor`); a slot the board does not hold draws nothing. A font
 * is written as the Event Hub writes a part's (`hubElementDeclarations`): the face's own variable, then its
 * fallback. `zoom` is how the Event Hub sizes a part (`lib/element-style.ts`): the line's own size ×.
 */
export function rsvpLookCss(look: RsvpLook, parts: readonly string[], board: readonly string[]): string {
  const all = rsvpLookRules(look, parts, board);
  const css = all.map((r) => `${r.selector}{${r.rules}}`).join('');
  return all.some((r) => r.moves) ? css + KEYFRAMES : css;
}

/** The database's cap on the whole config, with room left for how it is stored — asked before a save. */
export const RSVP_CONFIG_ROOM = 1900;
export function rsvpConfigBytes(config: unknown): number {
  return new TextEncoder().encode(JSON.stringify(config ?? {})).length;
}
/**
 * May `next` be saved over `was`? Yes while it fits — and yes whenever it is no bigger than what is already kept, so
 * an event already over the line can always be made shorter (or left as it is) and is never locked.
 */
export function rsvpConfigFits(next: unknown, was?: unknown): boolean {
  const bytes = rsvpConfigBytes(next);
  return bytes <= RSVP_CONFIG_ROOM || (was !== undefined && bytes <= rsvpConfigBytes(was));
}
/** Said — by the row that asked, or under the list — when a save would not fit. Words and looks alike. */
export const RSVP_CONFIG_FULL = 'It is too long to keep: your RSVP’s words and looks are at their limit. Shorten a message, then try again.';
