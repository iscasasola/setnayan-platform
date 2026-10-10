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
 * 🧱 ＋ · DRAG · GROUP (owner's ruling 2026-10-09) — three more keys beside `lines` and `card`, so nothing stored
 * before them had to move: `added` (the lines a couple ADDED to a screen), `order` (the screen's lines in their
 * order) and `groups` (lines that share one background). They are read HERE, by the same one reader, and turned into
 * the list a page draws by `rsvpScreenLayout` — which answers `null` for a screen that stored none of it, and a page
 * given `null` draws exactly what it drew before. The whole config is capped by the database
 * (`events_rsvp_ask_config_shape`, `RSVP_CONFIG_CHECK` bytes AS STORED): `rsvpConfigFits` is asked before a save, so
 * a couple is told in a sentence instead of at Apply (`RSVP_CONFIG_ROOM` — the two numbers and their measurement are
 * at the foot of this file).
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
/** `w`: the ground the card wore BEFORE a group stood it aside (`rsvpGroupMade`) — put back by the last Ungroup. */
export const RSVP_CARD_WAS = ['plain', 'none', 'frost'] as const;
export type RsvpCardWas = (typeof RSVP_CARD_WAS)[number];
export type RsvpCardLook = { g?: RsvpCardGround; w?: RsvpCardWas } & RsvpMotion;

/**
 * ＋ A LINE THE COUPLE ADDED to a screen: a Heading (`h`) or a Message (`m`), its words (`t` — typed, so cleaned and
 * capped here on every read, and drawn as TEXT, never as markup). `id`: the app's own short one (`RSVP_LAYOUT_ID`),
 * unique in the whole config. On the page, in the order and in `lines` it goes by `a:<id>` (`rsvpAddedName`).
 * (A Picture, `p`, is measured for and not read yet — its own step.)
 */
export type RsvpAddedLine = { id: string; k: 'h' | 'm'; t?: string };
export const RSVP_ADDED_PREFIX = 'a:';
export type RsvpAddedName = `a:${string}`;
export const rsvpAddedName = (id: string): RsvpAddedName => `${RSVP_ADDED_PREFIX}${id}`;
/** The id of an added line's name — null for a line that is the page's own, or a name that is not one. */
export function rsvpAddedId(line: string | null | undefined): string | null {
  const id = line?.startsWith(RSVP_ADDED_PREFIX) ? line.slice(RSVP_ADDED_PREFIX.length) : null;
  return id && RSVP_LAYOUT_ID.test(id) ? id : null;
}

/**
 * 🫧 A GROUP: lines of ONE screen that share ONE background and move as one. `of`: its lines, by name. `g`: its
 * background — None or Frosted; **Plain** is the absence of the key (as the card's). `i` / `v`: RESERVED — read by
 * the same closed sets a card's Build in is, so the shape can take them later; nothing offers or draws them yet
 * (owner's prototype: "The group arrives with the page").
 */
export type RsvpGroup = { id: string; of: string[]; g?: RsvpCardGround } & RsvpMotion;

/**
 * THE LINES THAT HAVE A PLACE IN EACH SCREEN'S CARD, in the page's own order, by the name the page gives each
 * (`data-rsvp-line`). Two lines are NOT here, on purpose:
 *   · the form's **Hint** — for a guest it is not a line of the card: the one-question flow draws it in the bar at the
 *     card's foot (where Next stands on the later screens), only while no answer is tapped. It keeps that place
 *     (controller 2026-10-10: not movable, not groupable);
 *   · the pass's **Save button** — the pass is each guest's own ticket, not a line of a note.
 */
export const RSVP_SCREEN_LINES: Readonly<Record<RsvpLookCard, readonly string[]>> = {
  rsvp: ['eyebrow', 'question', 'yes', 'no'],
  yesnote: ['heading', 'message'],
  nonote: ['heading', 'message'],
};

export type RsvpLook = {
  lines?: Partial<Record<RsvpLookLine | RsvpAddedName, RsvpLineLook>>;
  card?: Partial<Record<RsvpLookCard, RsvpCardLook>>;
  added?: Partial<Record<RsvpLookCard, RsvpAddedLine[]>>;
  order?: Partial<Record<RsvpLookCard, string[]>>;
  groups?: Partial<Record<RsvpLookCard, RsvpGroup[]>>;
};
/** What a look is kept FOR: a line (the page's own, or one the couple added), or a screen's card. */
export type RsvpLookTarget = RsvpLookLine | RsvpAddedName | { card: RsvpLookCard };

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

/** One line's look, read strictly. A button has no colour of its own (Look › Buttons'). */
function readLineLook(v: Record<string, unknown>, button: boolean): RsvpLineLook {
  const look: RsvpLineLook = readMotion(v);
  const colour = button ? null : (RSVP_LOOK_SLOTS as readonly unknown[]).includes(v.c) ? (v.c as RsvpLookSlot) : hubElementColor(v.c);
  if (colour) look.c = colour;
  const font = sanitizeHubFontKey(v.f);
  if (font) look.f = font;
  if ((RSVP_LOOK_SIZES as readonly unknown[]).includes(v.s) && v.s !== 100) look.s = v.s as RsvpLookSize;
  return look;
}

/** Words a person typed for an added line: one line of plain text, control characters out, spaces folded, capped. */
export function cleanRsvpAddedText(kind: 'h' | 'm', raw: unknown): string {
  if (typeof raw !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, RSVP_ADDED_TEXT_MAX[kind]);
}

/**
 * THE ONE READER — over the RAW `rsvp_ask_config`. Only known lines and cards, only values from the lists above.
 *
 * ＋ And the three keys of the ＋, drag and Group, each kept only in its own shape:
 *   · `added` — per screen, at most `RSVP_ADDED_MAX` lines; an id the app could have made, used once in the whole
 *     config; a kind it draws; words cleaned and capped;
 *   · `order` — per screen, names of lines that screen HAS (its own, or added to it), each once. It is a HINT:
 *     `rsvpScreenOrder` puts back any line it does not name, so no stored order can lose a line;
 *   · `groups` — per screen, at most `RSVP_GROUPS_MAX`; a line is in ONE group (the first that names it), a group is
 *     never in a group, and a group left with no line is not kept.
 */
export function readRsvpLook(config: unknown): RsvpLook {
  const raw = isObject(config) ? config.look : null;
  if (!isObject(raw)) return {};
  const out: RsvpLook = {};
  const lines = isObject(raw.lines) ? raw.lines : {};
  for (const id of RSVP_LOOK_LINES) {
    const v = lines[id];
    if (!isObject(v)) continue;
    const look = readLineLook(v, RSVP_LOOK_BUTTON_LINES.includes(id));
    if (Object.keys(look).length > 0) (out.lines ??= {})[id] = look;
  }
  const cards = isObject(raw.card) ? raw.card : {};
  for (const id of RSVP_LOOK_CARDS) {
    const v = cards[id];
    if (!isObject(v)) continue;
    const look: RsvpCardLook = readMotion(v);
    if ((RSVP_CARD_GROUNDS as readonly unknown[]).includes(v.g)) look.g = v.g as RsvpCardGround;
    if ((RSVP_CARD_WAS as readonly unknown[]).includes(v.w)) look.w = v.w as RsvpCardWas;
    if (Object.keys(look).length > 0) (out.card ??= {})[id] = look;
  }
  const addedBy = isObject(raw.added) ? raw.added : {};
  const orderBy = isObject(raw.order) ? raw.order : {};
  const groupsBy = isObject(raw.groups) ? raw.groups : {};
  const usedLine = new Set<string>();
  const usedGroup = new Set<string>();
  for (const part of RSVP_LOOK_CARDS) {
    const added: RsvpAddedLine[] = [];
    for (const v of Array.isArray(addedBy[part]) ? (addedBy[part] as unknown[]) : []) {
      if (added.length >= RSVP_ADDED_MAX) break;
      if (!isObject(v) || typeof v.id !== 'string' || !RSVP_LAYOUT_ID.test(v.id) || usedLine.has(v.id)) continue;
      if (v.k !== 'h' && v.k !== 'm') continue;
      usedLine.add(v.id);
      const text = cleanRsvpAddedText(v.k, v.t);
      added.push(text ? { id: v.id, k: v.k, t: text } : { id: v.id, k: v.k });
      const own = lines[rsvpAddedName(v.id)];
      const look = isObject(own) ? readLineLook(own, false) : {};
      if (Object.keys(look).length > 0) (out.lines ??= {})[rsvpAddedName(v.id)] = look;
    }
    if (added.length > 0) (out.added ??= {})[part] = added;
    /* The names this screen holds: its own, and the ones added to it. */
    const has = new Set<string>([...RSVP_SCREEN_LINES[part], ...added.map((a) => rsvpAddedName(a.id))]);
    const order: string[] = [];
    for (const name of Array.isArray(orderBy[part]) ? (orderBy[part] as unknown[]) : []) {
      if (typeof name === 'string' && has.has(name) && !order.includes(name)) order.push(name);
    }
    if (order.length > 0) (out.order ??= {})[part] = order;
    const groups: RsvpGroup[] = [];
    const grouped = new Set<string>();
    for (const v of Array.isArray(groupsBy[part]) ? (groupsBy[part] as unknown[]) : []) {
      if (groups.length >= RSVP_GROUPS_MAX) break;
      if (!isObject(v) || typeof v.id !== 'string' || !RSVP_LAYOUT_ID.test(v.id) || usedGroup.has(v.id)) continue;
      const of: string[] = [];
      for (const name of Array.isArray(v.of) ? (v.of as unknown[]) : []) {
        if (typeof name === 'string' && has.has(name) && !grouped.has(name) && !of.includes(name)) of.push(name);
      }
      if (of.length === 0) continue;
      for (const name of of) grouped.add(name);
      usedGroup.add(v.id);
      const group: RsvpGroup = { id: v.id, of, ...readMotion(v) };
      if ((RSVP_CARD_GROUNDS as readonly unknown[]).includes(v.g)) group.g = v.g as RsvpCardGround;
      groups.push(group);
    }
    if (groups.length > 0) (out.groups ??= {})[part] = groups;
  }
  return out;
}

/* ── the list a page draws ─────────────────────────────────────────────────── */

/** One line in its place: its name (`data-rsvp-line`) — and, for a line the couple added, what it is. */
export type RsvpLayoutLine = { line: string; added: RsvpAddedLine | null };
/** One thing in a screen's card, top to bottom: a line, or a group of lines. */
export type RsvpLayoutItem = RsvpLayoutLine | { group: RsvpGroup; lines: RsvpLayoutLine[] };
export const rsvpLayoutIsGroup = (item: RsvpLayoutItem): item is { group: RsvpGroup; lines: RsvpLayoutLine[] } => 'group' in item;

/**
 * 🔒 EVERY LINE OF A SCREEN, EXACTLY ONCE, IN THE COUPLE'S ORDER — the stored order is only a HINT. A line it does
 * not name is put back: one of the page's own right after the nearest of the page's lines that comes before it on
 * an untouched page (or first), a line the couple added at the end. So whatever is stored — an empty list, half a
 * list, somebody else's list — the form's Yes and No are both in the answer. (A reply must never be made impossible
 * by an edit: `the-reply-is-never-lost.test.ts`.)
 */
export function rsvpScreenOrder(look: RsvpLook, part: RsvpLookCard): string[] {
  const own = RSVP_SCREEN_LINES[part];
  const added = (look.added?.[part] ?? []).map((a) => rsvpAddedName(a.id) as string);
  const has = new Set<string>([...own, ...added]);
  const out: string[] = [];
  for (const name of look.order?.[part] ?? []) if (has.has(name) && !out.includes(name)) out.push(name);
  own.forEach((name, i) => {
    if (out.includes(name)) return;
    let at = 0;
    for (let before = i - 1; before >= 0; before--) {
      const placed = out.indexOf(own[before]!);
      if (placed >= 0) {
        at = placed + 1;
        break;
      }
    }
    out.splice(at, 0, name);
  });
  for (const name of added) if (!out.includes(name)) out.push(name);
  return out;
}

/**
 * THE LIST A PAGE DRAWS FOR ONE SCREEN — or `null` when the couple stored nothing that changes it (no added line, no
 * group, the page's own order): a page given `null` draws exactly what it drew before any of this existed.
 * A group stands where the first of its lines stands; its lines keep the order they have among themselves.
 */
export function rsvpScreenLayout(look: RsvpLook, part: RsvpLookCard): RsvpLayoutItem[] | null {
  const own = RSVP_SCREEN_LINES[part];
  const added = new Map((look.added?.[part] ?? []).map((a) => [rsvpAddedName(a.id) as string, a]));
  const groups = look.groups?.[part] ?? [];
  const order = rsvpScreenOrder(look, part);
  if (added.size === 0 && groups.length === 0 && order.every((name, i) => name === own[i])) return null;
  const lineOf = (name: string): RsvpLayoutLine => ({ line: name, added: added.get(name) ?? null });
  const groupOf = new Map<string, RsvpGroup>();
  for (const group of groups) for (const name of group.of) groupOf.set(name, group);
  const drawn = new Set<RsvpGroup>();
  const out: RsvpLayoutItem[] = [];
  for (const name of order) {
    const group = groupOf.get(name);
    if (!group) out.push(lineOf(name));
    else if (!drawn.has(group)) {
      drawn.add(group);
      out.push({ group, lines: order.filter((n) => groupOf.get(n) === group).map(lineOf) });
    }
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
  return rsvpLookStored(rest, { ...read, [home]: all });
}

/**
 * What is KEPT for a look: every home this build reads is rewritten from the STRICT reading (so what it cannot read
 * is not kept inside one), an empty home is not kept at all, and a key it does not know (a later build's) is
 * carried. `undefined` when nothing is left, so an event back to the page's own stores no `look`.
 */
function rsvpLookStored(rest: Record<string, unknown>, read: RsvpLook): Record<string, unknown> | undefined {
  for (const key of ['lines', 'card', 'added', 'order', 'groups'] as const) {
    const v = read[key];
    if (v && Object.keys(v).length > 0) rest[key] = v;
    else delete rest[key];
  }
  return Object.keys(rest).length > 0 ? rest : undefined;
}

/** A group's wrapper on the page — its value is the group's id (the app's own short one, checked by the reader). */
export const RSVP_GROUP_ATTR = 'data-rsvp-group';
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
 * 🧾 WHERE A REPLY IS DRAWN — AND WHAT THE CARD'S LOOK MEANS THERE (controller's ruling 2026-10-10). A guest replies
 * in two places, and a look set on the Maker's RSVP stage must reach both (it reached only the first — a dead
 * setting for every guest who changed a reply inside the Event Hub):
 *
 *   · `door`  — the invitation's reply page and the page after a reply. The reply sits in the door's CARD, on the
 *               Look's background: the card's Background (None · Plain · Frosted) and its Build in are that card's.
 *   · `sheet` — the Event Hub's own reply sheet (`rsvp-sheet.tsx`): a sheet that rises OVER the invitation. The sheet
 *               is its own surface, so THE ONE MAPPING, HERE AND NOWHERE ELSE (`rsvpCardGroundOn`):
 *                 Plain   → the sheet's own paper (as it always was);
 *                 Frosted → the sheet's paper becomes the app's glass (a sheet over a page is where glass reads best);
 *                 None    → shown as Plain: a sheet with no ground, over the invitation, cannot be read.
 *               And the card's Build in is NOT drawn there — the sheet has its own way of arriving.
 *
 * Everything else is the same on both: each line's Font · Colour · Size · Build in, the lines the couple added, their
 * order, and a group's own background (a group sits on the sheet's paper as it sits on the card).
 */
export type RsvpReplySurface = 'door' | 'sheet';
export function rsvpCardGroundOn(surface: RsvpReplySurface, ground: RsvpCardGround | undefined): 'plain' | RsvpCardGround {
  if (surface === 'sheet') return ground === 'frost' ? 'frost' : 'plain';
  return ground ?? 'plain';
}
/** The Event Hub's reply sheet (`rsvp-sheet.tsx` names it for every guest) — and the band that holds its title. */
export const RSVP_SHEET_SELECTOR = '[data-rsvp-sheet]';
export const RSVP_SHEET_HEAD_SELECTOR = '[data-rsvp-sheet]>div:first-of-type';

/**
 * EVERY RULE A PAGE DRAWS, AS DATA — for the parts it shows (`['rsvp']` the form · `['yesnote', 'pass']` ·
 * `['nonote']`). `selector` is ALWAYS a plain selector the page can be asked for (a named line, the card, the inner
 * note card) — never an at-rule: the keyframe and the reduced-motion block are `rsvpLookCss`'s own tail and are not
 * in this list. (The canvas once split the finished CSS text to find what to replay, and handed
 * `@media (prefers-reduced-motion:reduce)` to `querySelectorAll` — a thrown error on every Move.)
 */
export function rsvpLookRules(look: RsvpLook, parts: readonly string[], board: readonly string[], surface: RsvpReplySurface = 'door'): LookRule[] {
  const out: LookRule[] = [];
  for (const id of RSVP_LOOK_CARDS) {
    const v = look.card?.[id];
    if (!v || !parts.includes(id)) continue;
    if (surface === 'sheet') {
      /* The sheet is its own surface (`rsvpCardGroundOn`): Frosted is its paper as glass — and the band that holds
         its title lets that glass show; None and Plain are its own paper; no Build in. */
      if (rsvpCardGroundOn('sheet', v.g) === 'frost') {
        out.push({ selector: RSVP_SHEET_SELECTOR, rules: CARD_GROUND.frost, moves: false });
        out.push({ selector: RSVP_SHEET_HEAD_SELECTOR, rules: 'background:transparent!important;', moves: false });
      }
      continue;
    }
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
  for (const part of RSVP_LOOK_CARDS) {
    if (!parts.includes(part)) continue;
    /* ＋ A line the couple added: the same four things a line of the page's own has. Its name is the app's own short
       id, checked by the reader (`RSVP_LAYOUT_ID`) — the only thing of it that reaches a selector. */
    for (const a of look.added?.[part] ?? []) {
      const name = rsvpAddedName(a.id);
      const v = look.lines?.[name];
      if (!v) continue;
      const colour = hubElementColor(typeof v.c === 'number' ? board[v.c - 1] : v.c);
      const font = sanitizeHubFontKey(v.f);
      const face = font ? `font-family:var(${HUB_FONT_BY_KEY[font].cssVar}), ${HUB_FONT_BY_KEY[font].fallback};` : '';
      const rules = `${colour ? `color:${colour};` : ''}${face}${v.s ? `zoom:${v.s / 100};` : ''}${motionRules(v)}`;
      if (rules) out.push({ selector: `[data-rsvp-line="${name}"][data-rsvp-line]`, rules, moves: Boolean(v.i) });
    }
    /* 🫧 A group's background, when it is not Plain (its own paper, the wrapper's classes — `rsvp-lines.tsx`). */
    for (const group of look.groups?.[part] ?? []) {
      if (group.g) out.push({ selector: `[${RSVP_GROUP_ATTR}="${group.id}"]`, rules: CARD_GROUND[group.g], moves: false });
    }
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
export function rsvpLookCss(look: RsvpLook, parts: readonly string[], board: readonly string[], surface: RsvpReplySurface = 'door'): string {
  const all = rsvpLookRules(look, parts, board, surface);
  const css = all.map((r) => `${r.selector}{${r.rules}}`).join('');
  return all.some((r) => r.moves) ? css + KEYFRAMES : css;
}

/**
 * 📏 THE TWO LIMITS ON THE WHOLE CONFIG — AND WHY THEY ARE NOT THE SAME NUMBER.
 *
 *   · `RSVP_CONFIG_CHECK` — the database's: `pg_column_size(rsvp_ask_config) <= 24576`, the bytes of the value AS
 *     STORED (jsonb), in migration `20271267092468`. Never changed here alone: it is the migration's number, held to
 *     it by `lib/the-rsvp-lines-have-a-look.test.ts` § 5.
 *   · `RSVP_CONFIG_ROOM` — the app's: the bytes of the config AS JSON, asked before every save (`rsvpConfigFits`),
 *     so a couple is refused in a sentence and never by the database.
 *
 * 🔬 THEY COUNT DIFFERENT THINGS, AND THE STORED FORM IS THE BIGGER ONE. jsonb spends four bytes on every key and
 * every value, so structure (looks, order, groups) costs more stored than as JSON, and typed words cost the same.
 * MEASURED (2026-10-10, `tests/db/rsvp-ask-config-has-room.db.test.ts`, which repeats it on the replayed schema):
 * the worst this file's shape allows is 17,327 JSON bytes → 19,025 stored (1,698 over); with no typed words it is
 * 5,845 → 7,505, the worst RATIO (×1.284). So two things hold, and the test holds both:
 *   · for this shape the stored form is never more than `RSVP_CONFIG_STORED_OVER` bytes over its JSON, and
 *     room + that is under the check (19,000 + 2,048 = 21,048 < 24,576);
 *   · even if every byte the app let through were structure, room × `RSVP_CONFIG_STORED_RATIO` is under the check
 *     (19,000 × 1.29 = 24,510 < 24,576).
 *
 * 🩹 The pair this replaced (1,900 and 2,048) did not hold that line: every line and card fully styled was 1,941 JSON
 * bytes but 2,424 stored, so a look-heavy config a little under 1,900 passed here and was refused by the database
 * at Apply.
 */
export const RSVP_CONFIG_CHECK = 24576;
export const RSVP_CONFIG_ROOM = 19000;
/** The most bytes the stored form of THIS shape may weigh over its JSON (measured: 1,698). */
export const RSVP_CONFIG_STORED_OVER = 2048;
/** The most the stored form may weigh against its JSON when it is all structure (measured: ×1.284). */
export const RSVP_CONFIG_STORED_RATIO = 1.29;

/**
 * 🧱 THE CAPS THE ROOM WAS MEASURED FOR (the ＋, drag and Group — owner's ruling 2026-10-09). A screen (`rsvp` the
 * form · `yesnote` · `nonote`) takes at most this many lines the couple ADDED and this many groups; an added line's
 * words are capped as the screen's own are (a heading 80, a message 240 — `RSVP_WORD_MAX`); an added line's or a
 * group's id is the app's own short one. Raise one of these and the measurement must be run again
 * (`tests/db/rsvp-ask-config-worst.ts` builds the worst case FROM them).
 */
export const RSVP_ADDED_MAX = 4;
export const RSVP_GROUPS_MAX = 4;
export const RSVP_ADDED_KINDS = ['h', 'm', 'p'] as const;
export type RsvpAddedKind = (typeof RSVP_ADDED_KINDS)[number];
export const RSVP_ADDED_TEXT_MAX: Record<'h' | 'm', number> = { h: 80, m: 240 };
/** A picture's reference (`r2://setnayan-media/…`) is never longer than this. */
export const RSVP_ADDED_PICTURE_MAX = 200;
export const RSVP_LAYOUT_ID = /^[a-z0-9]{1,4}$/;
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
