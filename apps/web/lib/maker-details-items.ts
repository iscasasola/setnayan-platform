/**
 * lib/maker-details-items.ts — the ITEMS of the Maker's Details page, and how
 * an address picks one (owner 2026-09-28: "THE DETAILS PAGE WEARS THE MAKER'S
 * THREE COLUMNS" + "PRINTS & TICKETS FOLDS INTO DETAILS").
 *
 * Details is a navigator of items — the Event Hub's own (theme, address, QR),
 * every piece of the invitation set, and the free prints for the day — each
 * with its picture in the body and its editor beside it. Pure: no I/O, no
 * React, so the rules are held as functions.
 *
 * ── OLD LINKS LAND ON THE SAME PIECE ───────────────────────────────────────
 * Prints & Tickets was its own Maker page (`?tool=prints`). It is now Details,
 * so every old address resolves here: `?tool=prints` → Details (its size
 * params are kept by the caller — they are read as they always were);
 * `print_theme` → the Theme item; the Menu editor's save flash → the Menu;
 * nothing named → the first print. `?tool=details&item=<key>` names one.
 */
import { PRINT_PIECES, PRINT_SET_KEYS, type PrintSetKey } from '@/lib/print-pieces';
import type { FreePrint } from '@/lib/free-prints';
import type { MakerSelection } from '@/app/dashboard/[eventId]/launch/_components/maker-context';
import type { WidgetType } from '@/lib/invitation-widgets';
import { stagesOfScene } from '@/lib/stage-scenes';
import { PUBLIC_STAGE_LABELS } from '@/lib/public-site-stage-labels';

export type HubItemKey = 'address' | 'qr';
export type FreePrintKey = FreePrint['key'];
/** The whole invitation set in one download — every piece, every guest's pass. */
export type DownloadItemKey = 'download';
/** Words (Details part 2b): every line of wording, typed once. */
export type WordsItemKey = 'special-message' | 'thank-you' | 'opening-line' | 'kindly-reply';
/** Story & plans (Details part 2b): the Love Story, Schedule and RSVP pages, moved in whole. */
export type StoryItemKey = 'love-story' | 'schedule' | 'rsvp';
export type DetailsItemKey = 'theme' | HubItemKey | WordsItemKey | StoryItemKey | PrintSetKey | FreePrintKey | DownloadItemKey;

export const HUB_ITEM_KEYS: readonly HubItemKey[] = ['address', 'qr'];
export const WORDS_ITEM_KEYS: readonly WordsItemKey[] = ['special-message', 'thank-you', 'opening-line', 'kindly-reply'];
export const STORY_ITEM_KEYS: readonly StoryItemKey[] = ['love-story', 'schedule', 'rsvp'];
export const FREE_PRINT_KEYS: readonly FreePrintKey[] = [
  'guest-registry',
  'qr-codes',
  'seat-plan',
  'seating-pack',
  'caterer',
  'event-qr',
];

/**
 * The navigator's groups, in the owner's FINAL order (2026-09-28, DECISION_LOG
 * "OPTION B — EVERYTHING MADE ONCE LIVES IN DETAILS…"):
 *
 *   Look (Theme · Logo · Hero · Reveal) · Your event · Words · Story & plans
 *   (Love Story · Schedule · RSVP) · Your Event Hub (Address · QR) ·
 *   Invitation set · For the day · Download the set
 *
 * DATA, not markup. Part 1 (this build) fills Theme, Your Event Hub, the
 * Invitation set, For the day and Download; Details parts 2 and 3 add their
 * items to these rows (and their bodies and editors) — nothing else moves. A
 * group with no items yet is simply not drawn.
 */
export type DetailsItemGroup = 'look' | 'event' | 'words' | 'story' | 'hub' | 'set' | 'day' | 'download';
export const DETAILS_ITEM_GROUPS: ReadonlyArray<{ group: DetailsItemGroup; label: string; keys: readonly DetailsItemKey[] }> = [
  { group: 'look', label: 'Look', keys: ['theme'] },
  { group: 'event', label: 'Your event', keys: [] },
  { group: 'words', label: 'Words', keys: WORDS_ITEM_KEYS },
  { group: 'story', label: 'Story & plans', keys: STORY_ITEM_KEYS },
  { group: 'hub', label: 'Your Event Hub', keys: HUB_ITEM_KEYS },
  { group: 'set', label: 'Invitation set', keys: PRINT_SET_KEYS },
  { group: 'day', label: 'For the day', keys: FREE_PRINT_KEYS },
  { group: 'download', label: 'Download the set', keys: ['download'] },
];

export const DETAILS_ITEM_KEYS: readonly DetailsItemKey[] = DETAILS_ITEM_GROUPS.flatMap((g) => g.keys);

export function isDetailsItemKey(v: unknown): v is DetailsItemKey {
  return typeof v === 'string' && (DETAILS_ITEM_KEYS as readonly string[]).includes(v);
}

/** Details opens on its first item — Theme, the first choice (owner-approved
 *  prototype); an old Prints & Tickets link on the first print. */
export const DETAILS_FIRST_ITEM: DetailsItemKey = 'theme';
export const DETAILS_FIRST_PRINT: DetailsItemKey = PRINT_SET_KEYS[0];

/**
 * 📦 THE MAKER PAGES THAT MOVED INTO DETAILS WHOLE (Details part 2b, DECISION_LOG
 * "OPTION B — EVERYTHING MADE ONCE LIVES IN DETAILS"): the Love Story page and
 * the RSVP page are Details items now — the same components, inside the three
 * columns. Every old door to them (`?tool=love-story`, `?tool=rsvp-page`, a
 * scene's "Open … editor", a saved selection) lands on its item.
 */
export const TOOLS_IN_DETAILS = { 'love-story': 'love-story', 'rsvp-page': 'rsvp' } as const satisfies Record<string, DetailsItemKey>;
type ToolInDetails = keyof typeof TOOLS_IN_DETAILS;

function isToolInDetails(v: unknown): v is ToolInDetails {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(TOOLS_IN_DETAILS, v);
}

/**
 * Which Maker page an old `?tool=` means now — Prints & Tickets, Love Story
 * and RSVP are Details. Anything else is returned as it came.
 */
export function makerToolFor(tool: string | null | undefined): string | null {
  if (!tool) return null;
  return tool === 'prints' || isToolInDetails(tool) ? 'details' : tool;
}

/**
 * A Maker selection, with a page that moved into Details landing on its item.
 * The ONE place the old tool keys are translated — the shell runs every
 * selection through it (a bar press, a scene's button, a restored tab).
 */
export function landInDetails(sel: MakerSelection): MakerSelection {
  if (sel?.kind === 'tool' && isToolInDetails(sel.key)) return { kind: 'tool', key: 'details', item: TOOLS_IN_DETAILS[sel.key] };
  return sel;
}

/** The Details item a selection names, or null (Details with none named, or not Details). */
export function detailsItemOfSelection(sel: MakerSelection): DetailsItemKey | null {
  return sel?.kind === 'tool' && sel.key === 'details' && isDetailsItemKey(sel.item) ? sel.item : null;
}

/**
 * The item a Details address opens. `tool` is the RAW `?tool=` (before
 * `makerToolFor`), so an old Prints & Tickets link is told apart.
 */
export function detailsItemFor(search: {
  tool?: string | null;
  item?: string | null;
  printTheme?: string | null;
  menuFlash?: boolean;
}): DetailsItemKey {
  if (isDetailsItemKey(search.item)) return search.item;
  if (isToolInDetails(search.tool)) return TOOLS_IN_DETAILS[search.tool];
  if (search.menuFlash) return 'menu';
  if (search.printTheme) return 'theme';
  return search.tool === 'prints' ? DETAILS_FIRST_PRINT : DETAILS_FIRST_ITEM;
}

/**
 * ONE ITEM, AS THE NAVIGATOR DRAWS IT — every builder's items carry the same
 * shape: its label, its small picture, whether it is DONE (derived from data
 * that already exists — never a new column), and where it is USED (the stages
 * and prints that read it).
 */
export type DetailsItemModel = {
  key: DetailsItemKey;
  group: DetailsItemGroup;
  label: string;
  sub?: string;
  /** Filled in, as the data already says — undefined when "done" means nothing for it. */
  done?: boolean;
  /** Where it shows — "Every stage", "The Invitation", "Every pass". */
  usedOn?: readonly string[];
};

export function groupOfItem(key: DetailsItemKey): DetailsItemGroup {
  return DETAILS_ITEM_GROUPS.find((g) => g.keys.includes(key))!.group;
}

/** The address of one item — every link into Details names its item this way. */
export function detailsItemHref(eventId: string, item: DetailsItemKey, extra = ''): string {
  return `/dashboard/${eventId}/launch?tool=details&item=${item}${extra}`;
}

/* ══ WORDS · STORY & PLANS (Details part 2b) ═══════════════════════════════ */

/**
 * 🎉 EVERY EVENT TYPE (DECISION_LOG 2026-09-29 "THE PLAN ADAPTS TO EVERY EVENT
 * TYPE — BUILT IN, NOT BOLTED ON"): each item says which event types it is for,
 * asked of the shipped word system (`EventWords`, `app/[slug]/_lib/event-words.ts`)
 * — never a typed "wedding".
 *
 *   · Words — a special message, a thank-you, an opening line and a "Kindly
 *     reply" are every event's: a birthday and a wake write them too.
 *   · Schedule · RSVP — every event's (the schedule seeds a non-wedding
 *     run-of-show; a wake's RSVP asks "Will you be with us?").
 *   · Love Story — only where the type has TWO NAMED PEOPLE, the same question
 *     the guest page asks before it draws a story (`resolveWeddingOnlyParts`
 *     `love_story`: `two_named_people`). A seven-year-old's birthday and a wake
 *     have no love story, so the item is not drawn — never re-worded.
 */
export type DetailsItemFit = { twoPeople: boolean; solemn: boolean };

export function detailsItemApplies(key: DetailsItemKey, fit: DetailsItemFit): boolean {
  if (key === 'love-story') return fit.twoPeople;
  return true;
}

/** The stages a scene is drawn on, in the stages' own words. */
function stagesOf(type: WidgetType): string[] {
  return stagesOfScene(type).map((s) => PUBLIC_STAGE_LABELS[s]);
}

/**
 * What the navigator shows for a Words or Story & plans item — its label, one
 * line under it, whether it is DONE (from what is already saved, never a new
 * column) and where it is USED (the stages that draw it — `stagesOfScene`, the
 * one table — and the prints whose switch is on). Plain words; nothing here
 * names a wedding or a couple, so a birthday and a wake read it as it is.
 */
export type WordsAndPlansInput = {
  specialMessage: string | null;
  thankYou: string | null;
  openingLine: string | null;
  /** "Kindly reply" has an answer (a host, or typed words). */
  kindlyReply: boolean;
  /** The print switches (`print_details.include`) that carry each one. */
  include: { specialMessage: boolean; thankYou: boolean; openingLine: boolean; rsvp: boolean; loveStory: boolean; schedule: boolean };
  /** Moments in the Love Story (drafted over live). */
  loveStoryMoments: number;
  /** Moments on the schedule; null = could not be read (never "0"). */
  scheduleMoments: number | null;
};

export function wordsAndPlansItem(
  key: WordsItemKey | StoryItemKey,
  input: WordsAndPlansInput,
): Pick<DetailsItemModel, 'label' | 'sub' | 'done' | 'usedOn'> {
  const has = (v: string | null) => Boolean(v && v.trim());
  const finer = PRINT_PIECES.details.label;
  const not = 'Not written yet';
  switch (key) {
    case 'special-message':
      return {
        label: 'Special message',
        sub: has(input.specialMessage) ? input.specialMessage!.trim() : not,
        done: has(input.specialMessage),
        usedOn: [...stagesOf('special_message'), ...(input.include.specialMessage ? [finer] : [])],
      };
    case 'thank-you':
      return {
        label: 'Thank-you message',
        sub: has(input.thankYou) ? input.thankYou!.trim() : not,
        done: has(input.thankYou),
        usedOn: ['E-Gifts', ...(input.include.thankYou ? [finer] : [])],
      };
    case 'opening-line':
      return {
        label: 'Opening line',
        sub: has(input.openingLine) ? input.openingLine!.trim() : not,
        done: has(input.openingLine),
        usedOn: input.include.openingLine ? [PRINT_PIECES.invitation.label] : [],
      };
    case 'kindly-reply':
      return {
        label: 'Kindly reply',
        sub: input.kindlyReply ? 'Who guests reply to' : 'Not set yet',
        done: input.kindlyReply,
        usedOn: input.include.rsvp ? [finer] : [],
      };
    case 'love-story':
      return {
        label: 'Love Story',
        sub: input.loveStoryMoments > 0 ? `${input.loveStoryMoments} ${input.loveStoryMoments === 1 ? 'moment' : 'moments'}` : not,
        done: input.loveStoryMoments > 0,
        usedOn: [...stagesOf('our_love_story'), ...(input.include.loveStory ? [finer] : [])],
      };
    case 'schedule':
      return {
        label: 'Schedule',
        sub:
          input.scheduleMoments === null
            ? 'Could not be read just now'
            : input.scheduleMoments > 0
              ? `${input.scheduleMoments} ${input.scheduleMoments === 1 ? 'moment' : 'moments'}`
              : 'No moments yet',
        done: input.scheduleMoments === null ? undefined : input.scheduleMoments > 0,
        usedOn: [...stagesOf('schedule'), ...(input.include.schedule ? [finer] : [])],
      };
    case 'rsvp':
      return { label: 'RSVP', sub: 'Questions · who can reply · reply by', usedOn: [PUBLIC_STAGE_LABELS.rsvp] };
  }
}

/**
 * ✍ TAP A FACT ON A STAGE → THE SAME DETAILS FIELD, ON THE RIGHT (owner
 * 2026-09-28, DECISION_LOG "DETAILS IS THE ONE FILL-IN AREA; STAGES ARE LOOK
 * AND MOTION; TAP IS A SHORTCUT": *"tapping a fact on a stage opens the SAME
 * Details field on the right, never a copy; design words (the joiner, the hero
 * link, scene headings) stay on the part"*).
 *
 * What a tap on the canvas names (the bridge's `edit` message: the section's
 * key and the part tapped, `editor-bridge.tsx`) → the Details item whose
 * editor opens. A FACT is the words themselves (`body`, or the scene tapped
 * where it has no parts); a heading or a label is a DESIGN word and is not
 * here, so it keeps its own part sheet. Data, so each Details part adds its own
 * rows — "Your event" adds the hero's names and date when its items exist.
 */
export const STAGE_FACT_TAPS: ReadonlyArray<{ key: string; els: ReadonlyArray<string | null>; item: DetailsItemKey }> = [
  { key: 'w:special_message', els: ['body', null], item: 'special-message' },
  { key: 'w:our_love_story', els: ['body', null], item: 'love-story' },
  { key: 'f:story', els: ['body', null], item: 'love-story' },
];

/** The Details item a canvas tap names, or null (a design word, or no fact there). */
export function detailsItemForTap(key: string, el: unknown): DetailsItemKey | null {
  const part = typeof el === 'string' ? el : null;
  return STAGE_FACT_TAPS.find((t) => t.key === key && t.els.includes(part))?.item ?? null;
}

/** The fact a section's words ARE, whole (its Content) — the same table, read for the scene. */
export function detailsItemForSection(key: string): DetailsItemKey | null {
  return STAGE_FACT_TAPS.find((t) => t.key === key && t.els.includes('body'))?.item ?? null;
}
