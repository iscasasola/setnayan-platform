/**
 * 📏 THE BIGGEST `events.rsvp_ask_config` THE APP'S OWN SHAPE ALLOWS — built from the app's own lists and caps, so the
 * size limits are measured against what can really be saved (`rsvp-ask-config-has-room.db.test.ts` measures it in
 * the database; `lib/the-rsvp-lines-have-a-look.test.ts` holds the app's number to it).
 *
 * Not a test and not app code: a fixture two tests share. Every list is the lib's (`RSVP_LOOK_LINES`,
 * `RSVP_LOOK_CARDS`, `RSVP_WORD_MAX`, the font keys, the motion sides, the caps) — add a line, a font with a longer
 * key or a higher cap and this grows with it.
 */
import { HUB_FONT_KEYS } from '@/lib/hub-fonts';
import { MOTION_DIRS, MOTION_SIZES } from '@/lib/motion-effects';
import { RSVP_ASK_FIELDS, RSVP_WORD_KEYS, RSVP_WORD_MAX, WHO_CAN_RSVP } from '@/lib/rsvp-ask';
import {
  RSVP_ADDED_MAX,
  RSVP_ADDED_PICTURE_MAX,
  RSVP_ADDED_TEXT_MAX,
  RSVP_GROUPS_MAX,
  RSVP_LOOK_BUTTON_LINES,
  RSVP_LOOK_CARDS,
  RSVP_LOOK_FEELS,
  RSVP_LOOK_LINES,
  RSVP_LOOK_SIZES,
} from '@/lib/rsvp-look';

const longest = (list: readonly string[]) => [...list].sort((a, b) => b.length - a.length)[0]!;

/** Every effect on, each at its longest name. */
const FX = { fade: true, move: longest(MOTION_DIRS), size: longest(MOTION_SIZES), blur: true } as const;
const FEEL = longest(RSVP_LOOK_FEELS);
/** One line, everything chosen. */
const LINE = { c: '#aabbcc', f: longest(HUB_FONT_KEYS), s: Math.max(...RSVP_LOOK_SIZES), i: FX, v: FEEL };
const BUTTON = { f: LINE.f, s: LINE.s, i: FX, v: FEEL };

export type WorstOptions = {
  /** The character every typed text is made of — 'a' is 1 byte a UTF-16 unit, 'ñ' 2, '漢' 3 (the most a unit can be). */
  ch?: string;
  /** No typed text at all: the config that is all structure (the worst stored-to-JSON ratio). */
  text?: boolean;
  /** Lines added to each screen, and what they are. 0: the shape as it was before ＋ (looks only). */
  added?: number;
  kind?: 'h' | 'm' | 'p';
  /** Groups on each screen. */
  groups?: number;
};

/**
 * The lines that have a PLACE in each screen's card — what an order and a group can name. Not the form's Hint: it
 * keeps its place at the card's foot (controller 2026-10-10), so no order and no group holds it.
 */
function screenLines(part: string): string[] {
  return RSVP_LOOK_LINES.filter((id) => id.startsWith(`${part}.`) && id !== 'rsvp.hint').map((id) => id.slice(part.length + 1));
}

export function worstRsvpAskConfig({ ch = '漢', text = true, added = RSVP_ADDED_MAX, kind = 'm', groups = RSVP_GROUPS_MAX }: WorstOptions = {}): Record<string, unknown> {
  const words: Record<string, string> = {};
  if (text) for (const key of RSVP_WORD_KEYS) words[key] = ch.repeat(RSVP_WORD_MAX[key]);
  const lines: Record<string, unknown> = {};
  for (const id of RSVP_LOOK_LINES) lines[id] = RSVP_LOOK_BUTTON_LINES.includes(id) ? BUTTON : LINE;
  const card: Record<string, unknown> = {};
  const addedBy: Record<string, unknown[]> = {};
  const order: Record<string, string[]> = {};
  const groupsBy: Record<string, unknown[]> = {};
  let n = 0;
  for (const part of RSVP_LOOK_CARDS) {
    const ids: string[] = [];
    addedBy[part] = [];
    for (let i = 0; i < added; i++) {
      const id = (36 ** 4 - 1 - n++).toString(36); // four characters, the longest an id is
      ids.push(`a:${id}`);
      lines[`a:${id}`] = LINE;
      addedBy[part]!.push(
        kind === 'p' ? { id, k: 'p', p: `r2://setnayan-media/${'x'.repeat(RSVP_ADDED_PICTURE_MAX - 20)}` } : { id, k: kind, t: text ? ch.repeat(RSVP_ADDED_TEXT_MAX[kind]) : 'x' },
      );
    }
    const all = [...screenLines(part), ...ids];
    order[part] = all;
    groupsBy[part] = [];
    /* Every line in a group, and as many groups as the cap allows (dealt round, so no group is empty). */
    for (let g = 0; g < Math.min(groups, all.length); g++) {
      groupsBy[part]!.push({ id: `g${part[0]}${g}`.padEnd(4, 'z'), of: all.filter((_, i) => i % groups === g), g: 'frost', i: FX, v: FEEL });
    }
    /* With a group on the screen the card stands aside (None) and remembers its ground (`w`); without, it wears one. */
    card[part] = groups > 0 ? { g: 'none', w: 'frost', i: FX, v: FEEL } : { g: 'frost', i: FX, v: FEEL };
  }
  const look: Record<string, unknown> = { lines, card };
  if (added > 0 || groups > 0) Object.assign(look, { added: addedBy, order, groups: groupsBy });
  const out: Record<string, unknown> = { whoCanRsvp: longest(WHO_CAN_RSVP), oneAtATime: true, guestReminders: false, guestsReply: false, approveEach: true, celebration: 'fireworks', look };
  for (const field of RSVP_ASK_FIELDS) out[field] = false;
  if (text) out.words = words;
  return out;
}

/** What the app counts: the config's bytes as JSON (`rsvpConfigBytes`). */
export const jsonBytes = (config: unknown) => new TextEncoder().encode(JSON.stringify(config)).length;
