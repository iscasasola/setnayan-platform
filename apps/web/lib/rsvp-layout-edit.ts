/**
 * ＋ ↕ 🫧 THE EDITS OF A REPLY SCREEN'S LIST — add a line, take an added one off, type its words, move a line or a
 * group one place or to a place, group lines, ungroup, give a group its background (owner's ruling 2026-10-09;
 * approved prototype `prototypes/maker_rsvp_add_drag_group_2026-10-09.html`).
 *
 * PURE: `rsvpLayoutEdit(config, edit)` takes the RAW `rsvp_ask_config` and answers the `look` to store — built on
 * the one strict reading (`readRsvpLook`), so nothing this build cannot read is written back inside a home it
 * knows, and a key it does not know is carried (`rsvpLookStored`). The Maker's RSVP panel saves it through its ONE
 * save (the size check, the draft door, the page told first — `maker-rsvp-ask.tsx`).
 *
 * What an edit can never do — by what it is built on, not by care at each call:
 *   · lose a line of the page's own: every edit ends by writing the screen's WHOLE order (`rsvpScreenOrder` of what
 *     it made), and only a line the couple ADDED can be removed;
 *   · put a group in a group, or a line in two;
 *   · move the Hint or the pass's Save button — they are in no screen's list (`RSVP_SCREEN_LINES`).
 *
 * Loaded with the lazy RSVP panel and toolbar only (the Maker's first load does not know it).
 */
import { formatCount } from './format-number';
import {
  RSVP_ADDED_MAX,
  RSVP_GROUPS_MAX,
  RSVP_LAYOUT_ID,
  RSVP_SCREEN_LINES,
  cleanRsvpAddedText,
  readRsvpLook,
  rsvpAddedId,
  rsvpAddedName,
  rsvpLayoutIsGroup,
  rsvpLookStored,
  rsvpPictureRef,
  rsvpScreenLayout,
  rsvpScreenOrder,
  type RsvpAddedLine,
  type RsvpCardGround,
  type RsvpCardLook,
  type RsvpGroup,
  type RsvpLook,
  type RsvpLookCard,
} from './rsvp-look';

/** A group, by the name the toolbar and the page's tap give it: `g:<its id>`. */
export const RSVP_GROUP_PREFIX = 'g:';
export const rsvpGroupName = (id: string) => `${RSVP_GROUP_PREFIX}${id}`;
export function rsvpGroupId(name: string | null | undefined): string | null {
  const id = name?.startsWith(RSVP_GROUP_PREFIX) ? name.slice(RSVP_GROUP_PREFIX.length) : null;
  return id && RSVP_LAYOUT_ID.test(id) ? id : null;
}

export type RsvpLayoutEdit =
  /** ＋ on `anchor`'s frame: a new, EMPTY line above or below it — inside its group when the anchor is in one. A
   *  PICTURE is never empty: it is added with its uploaded file's ref (`p`), or not at all. */
  | { do: 'add'; part: RsvpLookCard; kind: RsvpAddedLine['k']; anchor: string; where: 'above' | 'below'; p?: string }
  /** 🖼 A picture line's file, replaced (Edit › Replace) — one edit, one undo step. */
  | { do: 'picture'; part: RsvpLookCard; line: string; p: string }
  | { do: 'remove'; part: RsvpLookCard; line: string }
  | { do: 'words'; part: RsvpLookCard; line: string; text: string }
  /** ↑ Earlier · ↓ Later: one place among what stands beside it (a line in a group moves inside its group). */
  | { do: 'step'; part: RsvpLookCard; name: string; dir: -1 | 1 }
  /** A drop: to stand before `before` among what stands beside it — null: last. */
  | { do: 'place'; part: RsvpLookCard; name: string; before: string | null }
  | { do: 'group'; part: RsvpLookCard; lines: readonly string[] }
  | { do: 'ungroup'; part: RsvpLookCard; group: string }
  | { do: 'ground'; part: RsvpLookCard; group: string; ground: RsvpCardGround | null };

export type RsvpLayoutEdited =
  | { ok: true; look: Record<string, unknown> | undefined; /** What to pick now (a line's or a group's name) — null: let go. */ pick: string | null }
  | { ok: false; why: RsvpLayoutRefusal };
/** Why an edit was not made — the toolbar says each in its own sentence (`rsvp-line-place.tsx`). */
export type RsvpLayoutRefusal = 'full' | 'own-line' | 'in-group' | 'is-group' | 'too-few' | 'groups-full' | 'edge' | 'not-there' | 'no-picture';

/** A screen as it is edited: its top row, each place a line's name or a group with the names it holds. */
type Place = string | { group: RsvpGroup; lines: string[] };
const isGroup = (p: Place): p is { group: RsvpGroup; lines: string[] } => typeof p !== 'string';

function placesOf(look: RsvpLook, part: RsvpLookCard): Place[] {
  const list = rsvpScreenLayout(look, part) ?? RSVP_SCREEN_LINES[part].map((line) => ({ line, added: null }));
  return list.map((item) => (rsvpLayoutIsGroup(item) ? { group: item.group, lines: item.lines.map((l) => l.line) } : item.line));
}

/** Where a name stands: in the top row, or in a group of it. */
function find(places: Place[], name: string): { list: Place[] | string[]; at: number; group: { group: RsvpGroup; lines: string[] } | null } | null {
  const top = places.findIndex((p) => (isGroup(p) ? rsvpGroupName(p.group.id) === name : p === name));
  if (top >= 0) return { list: places, at: top, group: null };
  for (const p of places) {
    if (!isGroup(p)) continue;
    const at = p.lines.indexOf(name);
    if (at >= 0) return { list: p.lines, at, group: p };
  }
  return null;
}

/** The shortest id the app has not used yet, in the alphabet the reader takes (`RSVP_LAYOUT_ID`). */
function freshId(used: ReadonlySet<string>): string {
  for (let n = 1; ; n++) {
    const id = n.toString(36);
    if (!used.has(id)) return id;
  }
}

/** The places written back as the three stored keys' share of one screen. */
function store(look: RsvpLook, part: RsvpLookCard, places: Place[], added: RsvpAddedLine[]): RsvpLook {
  const order = places.flatMap((p) => (isGroup(p) ? p.lines : [p]));
  const groups = places.filter(isGroup).filter((p) => p.lines.length > 0).map((p) => ({ ...p.group, of: [...p.lines] }));
  const next: RsvpLook = { ...look, added: { ...look.added }, order: { ...look.order }, groups: { ...look.groups } };
  if (added.length > 0) next.added![part] = added;
  else delete next.added![part];
  if (groups.length > 0) next.groups![part] = groups;
  else delete next.groups![part];
  /* The page's own order with nothing added is "nothing stored": no order is kept for it. */
  const own = RSVP_SCREEN_LINES[part];
  if (order.length === own.length && order.every((name, i) => name === own[i])) delete next.order![part];
  else next.order![part] = order;
  return next;
}

/**
 * 🃏 THE CARD STANDS ASIDE FOR A GROUP (the locked record §3: "When a group is made the big RSVP card switches to
 * None, so the group's background shows"). Made on a screen that had none: the card's ground is remembered (`w`) and
 * goes to None. The LAST group of a screen ungrouped (or emptied): it is put back. A ground the couple picked for the
 * card in between stands — picking one forgets `w` (`rsvpLookWith`), so there is nothing to put back.
 */
function cardFor(look: RsvpLook, part: RsvpLookCard, had: boolean, has: boolean): RsvpLook {
  if (had === has) return look;
  const card: RsvpCardLook = { ...look.card?.[part] };
  if (has) {
    card.w = card.g ?? 'plain';
    card.g = 'none';
  } else if (card.w) {
    if (card.w === 'plain') delete card.g;
    else card.g = card.w;
    delete card.w;
  }
  const cards = { ...look.card };
  if (Object.keys(card).length > 0) cards[part] = card;
  else delete cards[part];
  return { ...look, card: cards };
}

export function rsvpLayoutEdit(config: unknown, edit: RsvpLayoutEdit): RsvpLayoutEdited {
  const look = readRsvpLook(config);
  const rest: Record<string, unknown> = config && typeof config === 'object' && !Array.isArray(config) && (config as { look?: unknown }).look && typeof (config as { look?: unknown }).look === 'object' ? { ...((config as { look: Record<string, unknown> }).look) } : {};
  const { part } = edit;
  const places = placesOf(look, part);
  let added = [...(look.added?.[part] ?? [])];
  const hadGroup = places.some(isGroup);
  let lines = { ...look.lines };
  let pick: string | null = null;
  const refuse = (why: RsvpLayoutRefusal): RsvpLayoutEdited => ({ ok: false, why });

  if (edit.do === 'add') {
    if (added.length >= RSVP_ADDED_MAX) return refuse('full');
    const used = new Set<string>();
    for (const p of ['rsvp', 'yesnote', 'nonote'] as const) for (const a of look.added?.[p] ?? []) used.add(a.id);
    const id = freshId(used);
    const name = rsvpAddedName(id);
    if (edit.kind === 'p') {
      const picture = rsvpPictureRef(edit.p);
      if (!picture) return refuse('no-picture');
      added.push({ id, k: 'p', p: picture });
    } else added.push({ id, k: edit.kind });
    const at = find(places, edit.anchor);
    /* An anchor with no place in the list (the Hint, at the card's foot): the new line is the list's last. */
    if (!at) places.push(name);
    else (at.list as Place[]).splice(edit.where === 'above' ? at.at : at.at + 1, 0, name);
    pick = name;
  } else if (edit.do === 'remove') {
    const id = rsvpAddedId(edit.line);
    if (!id || !added.some((a) => a.id === id)) return refuse('own-line');
    const at = find(places, edit.line);
    if (!at) return refuse('not-there');
    at.list.splice(at.at, 1);
    added = added.filter((a) => a.id !== id);
    delete lines[rsvpAddedName(id)];
  } else if (edit.do === 'words') {
    const id = rsvpAddedId(edit.line);
    const line = added.find((a) => a.id === id);
    if (!line) return refuse('not-there');
    /* A picture has no words of its own (decorative — DECISION_LOG 2026-10-12). */
    if (line.k === 'p') return refuse('not-there');
    const text = cleanRsvpAddedText(line.k, edit.text);
    added = added.map((a) => (a.id === id ? (text ? { id: a.id, k: line.k, t: text } : { id: a.id, k: line.k }) : a));
    pick = edit.line;
  } else if (edit.do === 'picture') {
    const id = rsvpAddedId(edit.line);
    const line = added.find((a) => a.id === id);
    if (!line || line.k !== 'p') return refuse('not-there');
    const picture = rsvpPictureRef(edit.p);
    if (!picture) return refuse('no-picture');
    added = added.map((a) => (a.id === id ? { id: a.id, k: 'p', p: picture } : a));
    pick = edit.line;
  } else if (edit.do === 'step') {
    const at = find(places, edit.name);
    if (!at) return refuse('not-there');
    const to = at.at + edit.dir;
    if (to < 0 || to >= at.list.length) return refuse('edge');
    const [moved] = (at.list as Place[]).splice(at.at, 1);
    (at.list as Place[]).splice(to, 0, moved!);
    pick = edit.name;
  } else if (edit.do === 'place') {
    const at = find(places, edit.name);
    if (!at) return refuse('not-there');
    const [moved] = (at.list as Place[]).splice(at.at, 1);
    const before = edit.before === null ? -1 : (at.list as Place[]).findIndex((p) => (isGroup(p) ? rsvpGroupName(p.group.id) : p) === edit.before);
    (at.list as Place[]).splice(before < 0 ? at.list.length : before, 0, moved!);
    pick = edit.name;
  } else if (edit.do === 'group') {
    const picks = places.filter((p): p is string => !isGroup(p) && edit.lines.includes(p));
    if (edit.lines.some((name) => rsvpGroupId(name))) return refuse('is-group');
    if (edit.lines.some((name) => find(places, name)?.group)) return refuse('in-group');
    if (picks.length < 2) return refuse('too-few');
    if (places.filter(isGroup).length >= RSVP_GROUPS_MAX) return refuse('groups-full');
    const used = new Set<string>();
    for (const p of ['rsvp', 'yesnote', 'nonote'] as const) for (const g of look.groups?.[p] ?? []) used.add(g.id);
    const group = { group: { id: freshId(used), of: [...picks] } as RsvpGroup, lines: [...picks] };
    const first = places.indexOf(picks[0]!);
    const kept = places.filter((p) => isGroup(p) || !picks.includes(p));
    /* It stands where the first of its lines stood. */
    kept.splice(places.slice(0, first).filter((p) => isGroup(p) || !picks.includes(p)).length, 0, group);
    places.length = 0;
    places.push(...kept);
    pick = rsvpGroupName(group.group.id);
  } else if (edit.do === 'ungroup') {
    const id = rsvpGroupId(edit.group);
    const at = places.findIndex((p) => isGroup(p) && p.group.id === id);
    if (at < 0) return refuse('not-there');
    const freed = (places[at] as { lines: string[] }).lines;
    places.splice(at, 1, ...freed);
    pick = freed[0] ?? null;
  } else {
    const id = rsvpGroupId(edit.group);
    const place = places.find((p): p is { group: RsvpGroup; lines: string[] } => isGroup(p) && p.group.id === id);
    if (!place) return refuse('not-there');
    const group: RsvpGroup = { ...place.group };
    if (edit.ground) group.g = edit.ground;
    else delete group.g;
    place.group = group;
    pick = edit.group;
  }

  /* A group the last line left is gone with it. */
  const live = places.filter((p) => !isGroup(p) || p.lines.length > 0);
  let next = store({ ...look, lines }, part, live, added);
  next = cardFor(next, part, hadGroup, live.some(isGroup));
  /* 🔒 The belt: what was made is read back, and every line of the screen is still in it exactly once. */
  const check = rsvpScreenOrder(next, part);
  const want = [...RSVP_SCREEN_LINES[part], ...added.map((a) => rsvpAddedName(a.id))];
  if (check.length !== want.length || want.some((name) => !check.includes(name))) return refuse('not-there');
  return { ok: true, look: rsvpLookStored(rest, next), pick };
}

/**
 * WHERE A NAME STANDS on a screen — for Edit's last row (which of ↑ Earlier · ↓ Later · Group · Remove can be taken)
 * and for the sentences that say what happened. Null: it has no place in the list (the Hint, the pass's Save button,
 * a name that is not there).
 */
export type RsvpPlaceOf = {
  /** Its place among what stands beside it, and how many stand there (itself counted). */
  at: number;
  beside: number;
  /** A line inside a group — and that group's name. */
  group: string | null;
  /** A line the couple added (the only kind that can be removed) — and what it is. */
  added: RsvpAddedLine | null;
  /** A group: how many lines it holds, and its background (null: Plain). */
  holds: number | null;
  ground: RsvpCardGround | null;
};
export function rsvpPlaceOf(config: unknown, part: RsvpLookCard, name: string | null | undefined): RsvpPlaceOf | null {
  if (!name) return null;
  const look = readRsvpLook(config);
  const places = placesOf(look, part);
  const at = find(places, name);
  if (!at) return null;
  const self = at.list[at.at]!;
  const id = rsvpAddedId(name);
  return {
    at: at.at,
    beside: at.list.length,
    group: at.group ? rsvpGroupName(at.group.group.id) : null,
    added: (id && (look.added?.[part] ?? []).find((a) => a.id === id)) || null,
    holds: typeof self === 'string' ? null : self.lines.length,
    ground: typeof self === 'string' ? null : (self.group.g ?? null),
  };
}
/** How many lines a screen has had added, and how many groups it holds — for the two caps. */
export function rsvpScreenCounts(config: unknown, part: RsvpLookCard): { added: number; groups: number } {
  const look = readRsvpLook(config);
  return { added: look.added?.[part]?.length ?? 0, groups: look.groups?.[part]?.length ?? 0 };
}

/* ── ✋ a drop ─────────────────────────────────────────────────────────────── */

/**
 * WHERE A HELD LINE WOULD LAND — the opening nearest the finger among the rows it stands beside, measured on the page
 * AS LAID OUT AT THE LIFT (so the room an opening has just been given never flips the answer under a resting
 * finger — the prototype's own rule). `tops` / `ends`: each row's top and bottom; `at`: the held row's own place.
 * Opening `s` is "before row `s`"; `tops.length` is "after the last". Null: no opening within reach — or one of
 * ITS OWN two (before itself, after itself), where it would only settle back.
 */
export function rsvpDropSlot(tops: readonly number[], ends: readonly number[], at: number, y: number, reach: number): number | null {
  let best: number | null = null;
  let near = reach;
  for (let s = 0; s <= tops.length; s++) {
    const edge = s < tops.length ? tops[s]! : ends[ends.length - 1]!;
    const d = Math.abs(y - edge);
    if (d < near) {
      near = d;
      best = s;
    }
  }
  return best === null || best === at || best === at + 1 ? null : best;
}
/** That opening as the list's own word for a place (`do: 'place'`): the name it lands BEFORE — null: last;
 *  undefined: nowhere (it goes back where it was, and nothing is asked). */
export function rsvpDropBefore(names: readonly string[], slot: number | null): string | null | undefined {
  return slot === null ? undefined : slot < names.length ? names[slot]! : null;
}

/* ── what the stage says ──────────────────────────────────────────────────── */

/** What ＋ offers on a reply page, in the sheet's order — the owner's ruling, word for word: "Heading · Message ·
 *  Picture". A Picture uploads FIRST (`RsvpPictureSheet`) and is then added with its file in one edit. */
export const RSVP_ADD_KINDS = ['h', 'm', 'p'] as const;

const lines = (n: number) => (n === 1 ? `${formatCount(1)} line` : `${formatCount(n)} lines`);

/**
 * THE STAGE'S OWN SENTENCES — the approved prototype's, word for word
 * (`prototypes/maker_rsvp_add_drag_group_2026-10-09.html`), and the controller's four (2026-10-10: the two caps, the
 * Hint, the pass's Save button). The caps' number is the rule's own (`RSVP_ADDED_MAX`, `RSVP_GROUPS_MAX`) — read
 * here, never typed.
 */
export const RSVP_LIST_WORDS = {
  added: (name: string, where: 'above' | 'below', anchor: string, inGroup: boolean) => `${name} added ${where} ${anchor}${inGroup ? ' — inside its group' : ''}.`,
  removed: (name: string) => `${name} removed.`,
  first: (inGroup: boolean) => `Already first ${inGroup ? 'in its group' : 'on this screen'}.`,
  last: (inGroup: boolean) => `Already last ${inGroup ? 'in its group' : 'on this screen'}.`,
  ownLine: 'This line is part of the RSVP — it stays. Lines you add can be removed.',
  inGroup: 'This line is already in a group. Open the group, then Ungroup.',
  inGroupPick: 'That line is already in a group — ungroup it first.',
  isGroup: 'A group cannot go inside another group.',
  tooFew: 'Pick at least two lines.',
  full: `A screen takes up to ${formatCount(RSVP_ADDED_MAX)} added lines. Remove one to add another.`,
  groupsFull: `A screen takes up to ${formatCount(RSVP_GROUPS_MAX)} groups. Ungroup one to make another.`,
  hint: 'The hint stays at the foot of the card.',
  save: 'The Save button stays under the ticket.',
  noAutomatic: 'This one has no automatic words — it shows only what you write.',
  noPicture: 'That picture did not upload. Please try again.',
  grouped: (n: number) => `Grouped — one background for all ${formatCount(n)}. Choose it below.`,
  ungrouped: 'Ungrouped — each line sits on the RSVP card again.',
  groupHolds: (n: number) => `This group holds ${lines(n)}. They share one background and move as one. Tap a line inside to change its words.`,
  groupGround: (n: number) => `One background for all ${lines(n)} in this group. Behind it is the RSVP card.`,
  groupStyle: 'The group’s own look is its background — open Background.',
  groupAnimate: 'The group arrives with the page. Its lines each have their own Animate — tap one.',
  onGroup: 'This sits on its group’s background.',
  openGroup: 'Open the group',
  pickTitle: 'Group · pick the lines',
  pickHow: 'Tap each line that should share one background. Tap it again to let it go.',
  picked: (n: number) => `${formatCount(n)} picked`,
} as const;

/** Why an edit was refused, in the stage's own sentence. */
export function rsvpRefusalWords(why: RsvpLayoutRefusal, inGroup = false, dir: -1 | 1 = -1): string {
  if (why === 'full') return RSVP_LIST_WORDS.full;
  if (why === 'groups-full') return RSVP_LIST_WORDS.groupsFull;
  if (why === 'own-line') return RSVP_LIST_WORDS.ownLine;
  if (why === 'in-group') return RSVP_LIST_WORDS.inGroup;
  if (why === 'is-group') return RSVP_LIST_WORDS.isGroup;
  if (why === 'too-few') return RSVP_LIST_WORDS.tooFew;
  if (why === 'no-picture') return RSVP_LIST_WORDS.noPicture;
  if (why === 'edge') return dir < 0 ? RSVP_LIST_WORDS.first(inGroup) : RSVP_LIST_WORDS.last(inGroup);
  return RSVP_LIST_WORDS.ownLine;
}

/* ── the stage's own window events (never in `rsvp-stage-shared.ts`: that file is in the Maker's first load) ── */

/** The toolbar asks the RSVP panel to make an edit of the list — `detail: RsvpLayoutEdit`. The panel saves it through
 *  its ONE save and answers on `RSVP_LIST_DONE_EVENT`. */
export const RSVP_LIST_EDIT_EVENT = 'setnayan:rsvp-list-edit';
/** The panel's answer — `detail: { edit, ok, pick?, why? }`: what to pick now, or the reason it was not made. */
export const RSVP_LIST_DONE_EVENT = 'setnayan:rsvp-list-done';
/** One sentence for the toolbar's toast — a grey button's reason (`detail: string`). */
export const RSVP_LIST_SAY_EVENT = 'setnayan:rsvp-list-say';
/** The toolbar is asked to let the couple pick lines for a group, starting from this one — `detail: { part, line }`. */
export const RSVP_GROUP_PICK_EVENT = 'setnayan:rsvp-group-pick';
/** Pick this thing of a screen's list (a group, from a line inside it: "Open the group") — `detail: { part, name, tool? }`. */
export const RSVP_LIST_PICK_EVENT = 'setnayan:rsvp-list-pick';
export type RsvpListPick = { part: RsvpLookCard; name: string; tool?: 'edit' | 'bg' };
export type RsvpListDone =
  | { edit: RsvpLayoutEdit; ok: true; /** What to pick now — null: let go. */ pick: string | null; /** What happened, to say (or nothing). */ said: string | null }
  | { edit: RsvpLayoutEdit; ok: false; said: string };
