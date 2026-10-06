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
import type { WidgetType } from '@/lib/invitation-widgets';
import { stagesOfScene } from '@/lib/stage-scenes';
import { PUBLIC_STAGE_LABELS } from '@/lib/public-site-stage-labels';
import type { EventTypeProfile } from '@/lib/event-type-profile';
import { resolveRoleSet } from '@/lib/role-sets';
import { hasTwoNamedPeople } from '@/lib/two-named-people';
import { yourEventItems, type YourEventKind } from '@/lib/details-your-event';

export type HubItemKey = 'address' | 'qr';
/**
 * 🎨 THE LOOK — Mood Board · Logo · Hero · Reveal (Details part 3, owner
 * 2026-09-28/29: "OPTION B — EVERYTHING MADE ONCE LIVES IN DETAILS" and
 * "SCHEDULE, MOOD BOARD AND SEAT PLAN MOVE INSIDE…"). Each is a SHIPPED page
 * moved in whole — the Mood Board studio, the Logo studio, the Hero and the
 * Reveal pages — never redrawn.
 */
export type LookItemKey = 'mood-board' | 'logo' | 'hero' | 'reveal';
/**
 * Details part 2a — "Your event" (owner 2026-09-28, DECISION_LOG "OPTION B…"):
 * Names · Date · Venues · Parents & hosts · the march. Which of them an event
 * shows is decided per event type (`lib/details-your-event.ts`), never here.
 */
export type EventItemKey = 'names' | 'date' | 'venues' | 'parents' | 'march';
export const EVENT_ITEM_KEYS: readonly EventItemKey[] = ['names', 'date', 'venues', 'parents', 'march'];
/**
 * 🪑 Details part 4 — the Seat plan (owner 2026-09-28, DECISION_LOG "THE SEAT
 * PLAN MOVES INTO DETAILS AND WEARS THE THREE COLUMNS"): the last item of Your
 * event. Its own key (not an `EventItemKey`): it is the shipped seating editor
 * moved in, not one of part 2a's facts.
 */
export type SeatPlanItemKey = 'seating';
export type FreePrintKey = FreePrint['key'];
/** The whole invitation set in one download — every piece, every guest's pass. */
export type DownloadItemKey = 'download';
/** Words (Details part 2b): every line of wording, typed once. */
export type WordsItemKey = 'special-message' | 'thank-you' | 'opening-line' | 'kindly-reply';
/** Story & plans (Details part 2b): the Love Story, Schedule and RSVP pages, moved in whole. */
export type StoryItemKey = 'love-story' | 'schedule' | 'rsvp';
/**
 * 🙋 "Plan it myself" (owner 2026-10-02, tracker d4: *"one free 'Plan it
 * myself' switch in Your info for every host"*) — in Your event, just before the
 * Seat plan (which stays the group's last item, owner 2026-09-28).
 * It is the SAME switch the Setnayan AI page flips (`events.planning_mode`,
 * `setPlanningMode`), never a second store: on = 'manual', and the automatic
 * help (supplier matching, deadlines, reminders) stops — `isSetnayanAiActive`.
 */
export type PlanItemKey = 'plan-myself';
/**
 * 🗂 EVERY ANSWER ABOUT AN EVENT LIVES IN YOUR INFO (owner 2026-10-02,
 * DECISION_LOG "EVERY ANSWER ABOUT AN EVENT LIVES IN EVENT DETAILS ("YOUR INFO")
 * — ONE HOME, MAPPED"), in Your event, after the march:
 *   · (Event settings was here from #6280 and LEFT the Maker 2026-10-02 —
 *     its three editors save live through their own actions, which breaks
 *     "nothing in the Maker takes effect until Apply". They live on the Event
 *     Details page (`details/page.tsx`), in place, outside the Maker.)
 *   · `papic` — "Photos from your guests?" (`events.papic_on`);
 *   · `gifts` — "Accept gifts?" in the type's word (`events.gifts_on`).
 * The logo and the event-photo answers are not rows of their own: each is
 * changed on the item it is about (Logo · Hero — `lib/event-answers.ts`).
 */
export type AnswerItemKey = 'papic' | 'gifts';
export const ANSWER_ITEM_KEYS: readonly AnswerItemKey[] = ['papic', 'gifts'];
/**
 * 🎨 THE LOOK'S OWN SECTIONS AS ITEMS (owner 2026-10-06, DECISION_LOG "APPROVED —
 * EVENT DETAILS IS REBUILT: ONE BUTTON, OWN-EDITOR ITEMS, ONE 'YOUR EVENT' FORM"):
 * Background · Colours · Font · Music each a row of the Look group. Each opens
 * the SAME Look panel (`LookPanel`) on its one section — never a second control.
 * `theme` stays an item (hidden from the list) — the whole panel the guided
 * "Look" step and an old `?item=theme` open.
 */
export type LookSectionItemKey = 'background' | 'colours' | 'font' | 'music';
export const LOOK_SECTION_ITEM_KEYS: readonly LookSectionItemKey[] = ['background', 'colours', 'font', 'music'];
export type DetailsItemKey = 'theme' | LookSectionItemKey | LookItemKey | EventItemKey | AnswerItemKey | SeatPlanItemKey | PlanItemKey | HubItemKey | WordsItemKey | StoryItemKey | PrintSetKey | FreePrintKey | DownloadItemKey;

export const HUB_ITEM_KEYS: readonly HubItemKey[] = ['address', 'qr'];
/** The Look after Theme, in the owner's order: Theme · Mood Board · Logo · Hero · Reveal. */
export const LOOK_ITEM_KEYS: readonly LookItemKey[] = ['mood-board', 'logo', 'hero', 'reveal'];
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
 *   Look (Theme · Mood Board · Logo · Hero · Reveal) · Your event · Words · Story & plans
 *   (Love Story · Schedule · RSVP) · Your Event Hub (Address · QR) ·
 *   Invitation set · For the day · Download the set
 *
 * DATA, not markup. Part 1 filled Theme, Your Event Hub, the Invitation set,
 * For the day and Download; part 3 adds the Look (Mood Board · Logo · Hero ·
 * Reveal); part 2 adds its items to its rows (and their bodies and editors) —
 * nothing else moves. A group with no items yet is simply not drawn.
 */
export type DetailsItemGroup = 'look' | 'story' | 'event' | 'elsewhere' | 'set' | 'day' | 'download';
/**
 * 🗂 THE LIST, AS THE OWNER APPROVED IT (2026-10-06, "EVENT DETAILS IS REBUILT"):
 *
 *   Look          — Background · Colours · Font · Music · Mood Board · Logo · Cover page · Reveal
 *   Story & plans — the items with an editor of their own: Wedding March (it holds
 *                   Parents & hosts too) · Love Story · Schedule · Seat plan
 *   Your event    — ONE scrolling form (`form: true` — one row; its items' editors
 *                   drawn one under the other): Event Name · Date · Venue · E-Gifts
 *                   (with the thank-you message) · Opening Line · Special Message ·
 *                   Event Hub Address · QR Code settings
 *   Prints        — the invitation set, the prints for the day, the download (unchanged)
 *
 * `elsewhere` (`hidden: true`) holds items that are PRESENT — the guided flow's
 * steps and old addresses still open them — but are not rows of the list: the
 * whole Look panel (`theme`), and the items that moved out to their own homes
 * (Parents & hosts → the Wedding March; Photos from guests → The Day; Plan it
 * myself → the event's Settings; Kindly reply · RSVP → the RSVP stage).
 */
export const DETAILS_ITEM_GROUPS: ReadonlyArray<{
  group: DetailsItemGroup;
  label: string;
  keys: readonly DetailsItemKey[];
  /** One row in the list; picking it shows every item's editor, one under the other. */
  form?: true;
  /** Present (the guided flow and old addresses open them) but never a row of the list. */
  hidden?: true;
}> = [
  { group: 'look', label: 'Look', keys: [...LOOK_SECTION_ITEM_KEYS, ...LOOK_ITEM_KEYS] },
  { group: 'story', label: 'Story & plans', keys: ['march', 'love-story', 'schedule', 'seating'] },
  {
    group: 'event',
    label: 'Your event',
    keys: ['names', 'date', 'venues', 'gifts', 'thank-you', 'opening-line', 'special-message', 'address', 'qr'],
    form: true,
  },
  { group: 'elsewhere', label: 'Elsewhere', keys: ['theme', 'parents', 'papic', 'plan-myself', 'kindly-reply', 'rsvp'], hidden: true },
  { group: 'set', label: 'Invitation set', keys: PRINT_SET_KEYS },
  { group: 'day', label: 'For the day', keys: FREE_PRINT_KEYS },
  { group: 'download', label: 'Download the set', keys: ['download'] },
];

export const DETAILS_ITEM_KEYS: readonly DetailsItemKey[] = DETAILS_ITEM_GROUPS.flatMap((g) => g.keys);

export function isDetailsItemKey(v: unknown): v is DetailsItemKey {
  return typeof v === 'string' && (DETAILS_ITEM_KEYS as readonly string[]).includes(v);
}

/** Details opens on its first item — Background, the Look's first row (owner
 *  2026-10-06); an old Prints & Tickets link on the first print. */
export const DETAILS_FIRST_ITEM: DetailsItemKey = 'background';
export const DETAILS_FIRST_PRINT: DetailsItemKey = PRINT_SET_KEYS[0];

/**
 * 🧭 THE PAGES THAT MOVED INTO DETAILS (owner 2026-09-28, DECISION_LOG "OPTION B
 * — EVERYTHING MADE ONCE LIVES IN DETAILS; THE TOP MENU IS THE FOUR STAGES +
 * DETAILS"): Logo, Hero, Reveal, Love Story and RSVP left the Maker's place
 * menu; each is an item of Details, and an old `?tool=<page>` (a bookmark, a
 * save's return address, a door elsewhere in the app) lands on that item.
 *
 * A page moves ONLY once its Details item exists (`isDetailsItemKey`): Logo,
 * Hero and Reveal are items since part 3; Love Story and RSVP are part 2's
 * (`love-story`, `rsvp`) — until their items land, their old address keeps
 * opening their own page, so no door leads nowhere.
 */
const MOVED_PAGE_ITEM: Readonly<Record<string, string>> = {
  logo: 'logo',
  hero: 'hero',
  reveal: 'reveal',
  'love-story': 'love-story',
  'rsvp-page': 'rsvp',
};

/**
 * 🖨 The items the bar's Prints door lives on — the invitation set, the free
 * prints for the day and the whole-set download (the navigator's `set`, `day`
 * and `download` groups). Derived from `DETAILS_ITEM_GROUPS`, never a second list.
 */
export const PRINTS_ITEM_KEYS: readonly DetailsItemKey[] = DETAILS_ITEM_GROUPS.filter(
  (g) => g.group === 'set' || g.group === 'day' || g.group === 'download',
).flatMap((g) => g.keys);

export function isPrintsItem(key: unknown): boolean {
  return typeof key === 'string' && (PRINTS_ITEM_KEYS as readonly string[]).includes(key);
}

/** The Details item a moved page's `?tool=` (or a Maker selection's key) now opens, or null. */
export function movedPageItem(tool: string | null | undefined): DetailsItemKey | null {
  if (!tool) return null;
  const item = MOVED_PAGE_ITEM[tool];
  return isDetailsItemKey(item) ? item : null;
}

/**
 * Which Maker page an old `?tool=` means now — Prints & Tickets is Details, and
 * so is every page that moved in (`movedPageItem`). Anything else is returned
 * as it came.
 */
export function makerToolFor(tool: string | null | undefined): string | null {
  if (!tool) return null;
  return tool === 'prints' || movedPageItem(tool) ? 'details' : tool;
}

/**
 * The item a Details address opens. `tool` is the RAW `?tool=` (before
 * `makerToolFor`), so an old Prints & Tickets link — or an old Logo, Hero or
 * Reveal link — is told apart.
 */
export function detailsItemFor(search: {
  tool?: string | null;
  item?: string | null;
  printTheme?: string | null;
  menuFlash?: boolean;
}): DetailsItemKey {
  if (isDetailsItemKey(search.item)) return search.item;
  if (search.menuFlash) return 'menu';
  if (search.printTheme) return 'background';
  const moved = movedPageItem(search.tool);
  if (moved) return moved;
  return search.tool === 'prints' ? DETAILS_FIRST_PRINT : DETAILS_FIRST_ITEM;
}

/**
 * HOW AN ITEM'S PAGE SITS IN THE BODY. Default ('flow'): a picture in the
 * scrolling column, its editor on the right. The pages that moved in keep the
 * split they shipped with:
 *   · 'fill'  — the tool's picked piece fills the body (the Hero, the Reveal
 *               playing, a part of the Mood Board); that piece's controls are
 *               the editor on the right, its pieces listed in the navigator
 *               (DECISION_LOG "A TOOL MOVED INTO THE MAKER IS REBUILT INTO THE
 *               THREE PARTS");
 *   · 'whole' — the Logo studio, which already IS the three parts (its layers,
 *               the logo, the layer's tools), so no second editor column is
 *               drawn beside it.
 */
export type DetailsItemLayout = 'flow' | 'fill' | 'whole';
const ITEM_LAYOUT: Partial<Record<DetailsItemKey, DetailsItemLayout>> = {
  /* 🎨 Look (2026-10-02, `lib/maker-look-sections.ts`): the couple's own page
     fills the body, so every Look change shows on it; Look is the right column. */
  theme: 'fill',
  background: 'fill',
  colours: 'fill',
  font: 'fill',
  music: 'fill',
  hero: 'fill',
  reveal: 'fill',
  logo: 'whole',
  'mood-board': 'fill',
  /* Part 2b: the guest's RSVP is a live page that fills the body, its settings
     on the right. (The Schedule is 'flow': its rail is the picture, the picked
     moment's fields the right column.) */
  rsvp: 'fill',
  /* Part 4: the floor plan fills the middle; the place's elements are the
     navigator's pieces and the guests are the right column. */
  seating: 'fill',
};
export function detailsItemLayout(key: DetailsItemKey): DetailsItemLayout {
  return ITEM_LAYOUT[key] ?? 'flow';
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

/**
 * 🎂 THE PLAN ADAPTS TO EVERY EVENT TYPE — BUILT IN, NOT BOLTED ON (owner
 * 2026-09-29, DECISION_LOG row of that name). Which items and switches a
 * celebration gets is decided HERE, from the shipped event-type data (the
 * type's `EventTypeProfile` and the role set it names) — never by a
 * "wedding" test sprinkled through the page. The words are the type's own
 * (`EventWords`); no item of part 1 types "wedding" or "couple".
 */
export type DetailsItemContext = {
  profile: EventTypeProfile;
  /** The event's words (`eventWordsFromProfile`) — for the solemn register. */
  solemn: boolean;
};

/**
 * An item that does not suit every celebration names its rule here; an item
 * with no rule applies to all. Part 1's items — the theme, the address, the QR,
 * every print — suit every type (the prints already follow the type's words).
 * Parts 2–5 add rules for theirs (e.g. Love Story).
 */
export const DETAILS_ITEM_APPLIES: Partial<Record<DetailsItemKey, (c: DetailsItemContext) => boolean>> = {
  /* 💌 Part 2b. Words (a special message, a thank-you, an opening line, "Kindly
     reply"), the Schedule and RSVP are every celebration's — a birthday and a
     wake write them too (a wake's RSVP asks "Will you be with us?"). The Love
     Story exists only where the type has TWO NAMED PEOPLE — the very rule the
     guest page draws the story by (`resolveWeddingOnlyParts` `love_story` →
     `hasTwoNamedPeople`). A seven-year-old's birthday and a wake have no love
     story, so the item is not drawn — never re-worded. */
  'love-story': (c) => hasTwoNamedPeople(c.profile),
  // The Our Story poster prints that Love Story — so it is offered only where
  // the Love Story is (a birthday's set has no poster it could never fill).
  'story-poster': (c) => hasTwoNamedPeople(c.profile),
  // Part 2a · Your event — the rule is `yourEventItems` (lib/details-your-event.ts):
  // the march where its role set prints an entourage. Names (two people) or
  // Name (one), date, venues and parents & hosts suit every type.
  march: (c) => yourEventItems(yourEventKindOf(c)).includes('march'),
  // 🪑 Part 4 · the Seat plan — only where the type has a seat plan at all (its
  // profile's 'seating' surface: the same rule the seating page and the guest
  // seat rooms are gated by — `surfaceEnabled(profile, 'seating')`, read here
  // from the profile itself so this file stays client-safe).
  seating: (c) => c.profile.enabledSurfaces.includes('seating'),
};

/** The type's own facts, as `lib/details-your-event.ts` asks them. */
function yourEventKindOf(c: DetailsItemContext): YourEventKind {
  const t = c.profile.terminology;
  return {
    words: {
      twoPeople: hasTwoNamedPeople(c.profile),
      solemn: c.solemn,
      eventWord: t.eventWord?.trim() || 'event',
    },
    offeredRoles: resolveRoleSet(c.profile.roleSetKey).offeredRoles,
  };
}

export function detailsItemApplies(key: DetailsItemKey, ctx: DetailsItemContext): boolean {
  return DETAILS_ITEM_APPLIES[key]?.(ctx) ?? true;
}

/** The navigator's rows for this celebration — the groups in order, each with the items that apply. */
export function detailsNavigatorKeys(
  ctx: DetailsItemContext,
  present: ReadonlySet<DetailsItemKey>,
): Array<{ group: DetailsItemGroup; label: string; keys: DetailsItemKey[]; form?: true; hidden?: true }> {
  return DETAILS_ITEM_GROUPS.map((g) => ({
    group: g.group,
    label: g.label,
    keys: g.keys.filter((k) => present.has(k) && detailsItemApplies(k, ctx)),
    ...(g.form ? { form: true as const } : {}),
    ...(g.hidden ? { hidden: true as const } : {}),
  })).filter((g) => g.keys.length > 0);
}

/**
 * The switches that depend on the type. "Parents on the invitation" exists
 * only where the type's role set offers a parent role (a wedding's Parents of
 * the Bride / of the Groom) — a birthday or a wake has no such role, so it has
 * no such switch, and no "Parent of the Bride" dropdown.
 */
export function detailsSwitchesFor(ctx: DetailsItemContext): { parents: boolean } {
  const offered = resolveRoleSet(ctx.profile.roleSetKey).offeredRoles as readonly string[];
  return { parents: offered.includes('bride_parents') || offered.includes('groom_parents') };
}

export function groupOfItem(key: DetailsItemKey): DetailsItemGroup {
  return DETAILS_ITEM_GROUPS.find((g) => g.keys.includes(key))!.group;
}

/** The group an item (or any string) is in — null for a key no group holds. */
export function groupOfItemSafe(key: string): DetailsItemGroup | null {
  return DETAILS_ITEM_GROUPS.find((g) => (g.keys as readonly string[]).includes(key))?.group ?? null;
}

/**
 * 🧰 The part of the list a phone's lower-third navigator shows for an item
 * (owner 2026-10-06): Look · Story & plans · Your event · Prints. The prints'
 * three groups are ONE part (Settings › Prints); an item that left the list
 * (`elsewhere`) shows with Your event.
 */
export type DetailsLtSection = 'look' | 'story' | 'event' | 'prints';
export function detailsLtSection(key: string): DetailsLtSection {
  // The whole Look panel is the Look's; Parents & hosts are held by the march (Story & plans).
  if (key === 'theme') return 'look';
  if (key === 'parents') return 'story';
  const g = groupOfItemSafe(key);
  if (g === 'set' || g === 'day' || g === 'download') return 'prints';
  if (g === 'look' || g === 'story') return g;
  return 'event';
}
/** The first item of a part of the list — where the phone's menu opens it. */
export const DETAILS_LT_SECTION_FIRST: Readonly<Record<DetailsLtSection, DetailsItemKey>> = {
  look: 'background',
  story: 'march',
  event: 'names',
  prints: DETAILS_FIRST_PRINT,
};

/** The address of one item — every link into Details names its item this way. */
export function detailsItemHref(eventId: string, item: DetailsItemKey, extra = ''): string {
  return `/dashboard/${eventId}/launch?tool=details&item=${item}${extra}`;
}

/**
 * An OLD page's address, landed on its Details item (part 2b — the Love Story
 * and Schedule pages moved in whole), carrying that page's own query: a save's
 * flash, a view, a lens. Empty values are dropped; every value is encoded.
 */
export function detailsDoorHref(eventId: string, item: DetailsItemKey, carry: Record<string, string | undefined>): string {
  const extra = Object.entries(carry)
    .filter((e): e is [string, string] => typeof e[1] === 'string' && e[1].length > 0)
    .map(([k, v]) => `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('');
  return detailsItemHref(eventId, item, extra);
}

/* ══ WORDS · STORY & PLANS (Details part 2b) ═══════════════════════════════ */

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
  /** Moments in the Love Story (drafted over live); null = could not be read (never "0"). */
  loveStoryMoments: number | null;
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
        sub:
          input.loveStoryMoments === null
            ? 'Could not be read just now'
            : input.loveStoryMoments > 0
              ? `${input.loveStoryMoments} ${input.loveStoryMoments === 1 ? 'moment' : 'moments'}`
              : not,
        done: input.loveStoryMoments === null ? undefined : input.loveStoryMoments > 0,
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
 * Is the Maker's work area — and so Details — this viewer's? The couple's, on
 * an event whose type has an Event Hub (`surfaceEnabled(profile, 'website')`).
 * ONE rule, read by the launch page (`hasWork`) and by every old page that now
 * lands on a Details item for the couple (the Mood Board): a coordinator, or an
 * event type with no Event Hub, keeps the old page, so no one is sent to a
 * Maker that has nothing for them.
 */
export function makerHasWork(memberType: string | null | undefined, websiteOn: boolean): boolean {
  return memberType === 'couple' && websiteOn;
}

/* ══ THE PIECES OF THE TOOLS THAT MOVED IN WHOLE (part 2b) ═════════════════
   DECISION_LOG "A TOOL MOVED INTO THE MAKER IS REBUILT INTO THE THREE PARTS":
   LEFT the tool's pieces, MIDDLE the picked one, RIGHT its controls. The keys
   are the tools' own (`data-rsvp-setting` sections, `LOVE_STORY_CHAPTERS`, a
   schedule moment's `block_id`). */

/** RSVP's settings, each a piece — the sections `MakerRsvpSettings` always drew. */
export const RSVP_PIECES: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'questions', label: 'What you ask' },
  { key: 'who', label: 'Who can reply' },
  { key: 'reply-by', label: 'Reply by' },
  { key: 'requests', label: 'Requests' },
];

/** The Schedule's Announce piece — beside the day's moments. */
export const SCHEDULE_ANNOUNCE_PIECE = 'announcements';

/** The Schedule's pieces: its top-level moments in the day's order, then Announce (when it is on). */
export function schedulePieces(
  moments: ReadonlyArray<{ id: string; label: string; time: string }>,
  announce: boolean,
): Array<{ key: string; label: string; sub?: string }> {
  return [
    ...moments.map((m) => ({ key: m.id, label: m.label || 'A moment', ...(m.time ? { sub: m.time } : {}) })),
    ...(announce ? [{ key: SCHEDULE_ANNOUNCE_PIECE, label: 'Announcements' }] : []),
  ];
}

/** The Details right column's slots the Schedule's own panels are drawn into (`InSlot`). */
export const DETAILS_SCHEDULE_INSPECTOR_SLOT = 'details-schedule-inspector';
export const DETAILS_SCHEDULE_ANNOUNCE_SLOT = 'details-schedule-announce';
