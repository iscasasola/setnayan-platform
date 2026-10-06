/**
 * lib/maker-parts.ts — 🧩 THE PARTS OF EVERY GUEST PAGE, AND WHERE EACH ONE IS
 * EDITED (the new Maker's Stages side, behind `makerStagesStudioEnabled`).
 *
 * Owner, 2026-10-06, verbatim: *"swiping will proceed to the next element. with
 * the different tools Style | Text | Animate · Style are the presets, background ·
 * Text Font, Color, Size · Animate Build In - Action - Build Out"* · *"if these are
 * texts only … should we allow them to edit directly to the event hub and update
 * the data on studio?"* → *"YES"* · *"suppliers"* (date and venue). Plan
 * `EVENT_HUB_MAKER_STAGES_STUDIO_BUILD_PLAN_2026-10-06.md` §3 PR 2; the approved
 * prototype's `ELS` and `TABS` (`maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html`);
 * DECISION_LOG 2026-10-06 "PLAIN WORDS ARE TYPED ON THE PAGE AND SAVED TO STUDIO ›
 * INFO", "TEXT STYLING STAYS THREE CONTROLS", "DATE AND VENUE LIVE IN SUPPLIERS",
 * "FULL PASS OF EVERY STAGE", "THE CAMERA HAS ITS OWN THREE LAYOUTS"; 2026-10-05
 * "EVERY GUEST PAGE'S DEFAULT SECTION ORDER".
 *
 * ── ONE SOURCE PER PART ─────────────────────────────────────────────────────
 * Every part names where its CONTENT comes from, as one string:
 *
 *   info:<field>        plain words, typed ON THE PAGE — and the same value is
 *                       Studio › Info's field (two doors, one value: the field
 *                       is the draft column the page writes, and the Info door
 *                       carries `data-same-field="<field>"`, `same-field.ts`)
 *   studio:<tool>       a structured part made in its Studio tool (the Wedding
 *                       March, the Schedule …) — Style's ONE quiet row
 *                       "Edit the <tool> ›" opens it in place, ‹ returns
 *   supplier:date|venue the date and the venue, set in Suppliers (read-only here)
 *   tool                made right here, by the part's own tools (the camera,
 *                       a gallery, the ticket)
 *
 * Names · Date · Place are THREE parts. The Title line (`ename`) is the stage's
 * first line ("Save the date", "The wedding of") — never the Event Name.
 *
 * ── LAYOUTS ARE THE SHIPPED STYLES, NEVER A NEW FAMILY ──────────────────────
 * The prototype gave every part the same five families (Classic · Stacked ·
 * Offset · Modern · Statement). Those are INVENTED (plan §5 risk 1): a part's
 * layouts are the SHIPPED per-scene styles of the scene it is drawn in
 * (`lib/scene-styles.ts` `sceneStyleOptions`) — three, mostly, not five. Only
 * the Camera keeps its own three (Classic · Your brand · Challenges — owner
 * 2026-10-06; a draft field, drawn for guests in PR 6). Held by
 * `lib/layouts-are-the-shipped-scene-styles.test.ts`.
 *
 * ── WHERE A PART IS ON THE PAGE ─────────────────────────────────────────────
 * `canvas` is the key the shipped canvas marks the part's section with
 * (`f:hero`, `w:<widget_type>`, `f:<fixed>`, `p:<post event scene>`), and `el`
 * the part inside it (`[data-el]`, `lib/element-style.ts`) — so a tap on the
 * part's tile is the SAME selection a tap on the page makes. Null: the part is
 * not drawn by the canvas yet (a later PR draws it); it is listed nowhere a tap
 * could do nothing.
 *
 * Pure. No I/O, no React — the Stages tools (lazy), the tests and nothing else
 * read it, so none of it rides the Maker's first load.
 */
import type { HubElementKey } from './element-style';
import type { HubStage } from './hub-canvas';
import { RSVP_STAGE_KEY } from './rsvp-stage-shared';
import { POST_EVENT_SCENE_NAMES } from './post-event-scenes';

/* ── the three tools ──────────────────────────────────────────────────────── */

/** Style | Text | Animate — the panel's one segmented control (`tpill`). */
export const MAKER_PART_TOOLS = ['style', 'text', 'animate'] as const;
export type MakerPartTool = (typeof MAKER_PART_TOOLS)[number];
export const MAKER_PART_TOOL_LABEL: Record<MakerPartTool, string> = { style: 'Style', text: 'Text', animate: 'Animate' };

/**
 * 🔤 THE TEXT TOOL IS THREE CONTROLS — Font · Colour · Size (owner 2026-10-06:
 * *"no"* to Weight, Bold/Italic/Underline, line and letter spacing; DECISION_LOG
 * "TEXT STYLING STAYS THREE CONTROLS"). `part-inspector.tsx` `PartTextTab` draws
 * exactly these rows when `threeControls` is on, and the retired ones never.
 * A builder must not add a fourth.
 */
export const MAKER_PART_TEXT_TOOLS = ['font', 'colour', 'size'] as const;
export type MakerPartTextTool = (typeof MAKER_PART_TEXT_TOOLS)[number];
/** The shipped Text rows' own `data-inspector-row` names, for the three (`IRow data=…` in `part-inspector.tsx`). */
export const MAKER_PART_TEXT_ROW: Record<MakerPartTextTool, string> = { font: 'font', colour: 'color', size: 'size' };

/**
 * 🎬 ANIMATE = Build in · Action · Build out — the SHIPPED Comes in · While on
 * screen · Goes out (`PartAnimateTab`, `motion-fx-rows.tsx`), named as the owner
 * named them. Words only: the controls under each are the shipped ones.
 */
export const MAKER_PART_ANIMATE_STEPS = [
  { step: 'in', label: 'Build in' },
  { step: 'during', label: 'Action' },
  { step: 'out', label: 'Build out' },
] as const;

/* ── the stages and their pages ───────────────────────────────────────────── */

/** The five stages, in the order a guest meets them (Save the Date · RSVP · Invitation · The Day · Post Event). */
export type MakerStageKey = HubStage | typeof RSVP_STAGE_KEY;
export const MAKER_STAGE_KEYS: readonly MakerStageKey[] = ['save_the_date', RSVP_STAGE_KEY, 'rsvp', 'event', 'editorial'];

/* ── the parts ────────────────────────────────────────────────────────────── */

export const MAKER_PART_KEYS = [
  'reveal',
  'logo',
  'ename',
  'names',
  'date',
  'place',
  'countdown',
  'message',
  'rsvp',
  'greeting',
  'rsvpcard',
  'opening',
  'reminders',
  'gifts',
  'schedule',
  'venue',
  'dress',
  'march',
  'bring',
  'story',
  'myrole',
  'mywear',
  'myarrive',
  'myguests',
  'seats',
  'pass',
  'announce',
  'camera',
  'gallery',
  'myphotos',
  'yesnote',
  'nonote',
  'numbers',
  'wishes',
  'suppliers',
  'film',
  /* 🎞 THE NINE POST EVENT SCENES THE ＋ SHEET ADDS (PR 3, DECISION_LOG 2026-10-06
     "POST EVENT: EVERY SHIPPED AUTO SCENE CAN BE ADDED") — not on a page by default. */
  'road',
  'watchlive',
  'challenge',
  'supstories',
  'wall',
  'said',
  'beforeafter',
  'song',
  'next',
] as const;
export type MakerPartKey = (typeof MAKER_PART_KEYS)[number];

/** The plain-text fields a part may be typed into on the page — each one draft value, two doors. */
export const MAKER_INFO_FIELDS = [
  /** `events.display_name` — the Event Name (the names), drafted (`type-in-place.tsx`, `NAMES_WRITE_KEY`). */
  'display_name',
  /** The stage's first line — the hero's small line on top (its own words on the hero canvas). */
  'title',
  /** `events.special_message` — `lib/scene-type-words.ts` field `message`; Info door `special-message-field.tsx`. */
  'special_message',
  /** `events.what_to_bring` — field `reminders`; Info door the Reminders' words box (`text-panel.tsx`). */
  'what_to_bring',
  /** The opening line of the invitation — Studio › Info (`opening-line-field.tsx`); not drawn on the Event Hub yet. */
  'opening_line',
  /** The countdown's line, the greeting and the RSVP notes — Studio › Info's own (PR 4). */
  'countdown_line',
  'greeting',
  'yes_note',
  'no_note',
] as const;
export type MakerInfoField = (typeof MAKER_INFO_FIELDS)[number];

/**
 * 🔗 THE TWO DOORS OF EACH PLAIN-TEXT FIELD — ONE VALUE (DECISION_LOG 2026-10-06
 * "PLAIN WORDS ARE TYPED ON THE PAGE AND SAVED TO STUDIO › INFO": *"Typing on the
 * page and the Studio › Info field are ONE value (two doors), never a copy"*).
 *
 *   page       the SHIPPED on-page writer that types it: a scene field
 *              (`lib/scene-type-words.ts` — `message`, `reminders`) or a hero part
 *              (`lib/hub-part-words.ts` — `names`, `eyebrow`); null = not typed on
 *              the page yet (its part is not drawn by the canvas yet)
 *   sameField  the ONE key every Info door of it carries (`data-same-field`,
 *              `same-field.ts`) — always the field itself; null = Studio › Info
 *              draws no door holding that one value yet (PR 4 merged without a
 *              field for the title, the countdown line, the greeting or the
 *              yes / no notes). The Event Name's door is the one-person name
 *              box (`details-your-event.tsx` `OneNameEditor`); two people type
 *              two names, which are not one value.
 *
 * Held by `lib/the-typing-door-is-the-info-door.test.ts`.
 */
export const MAKER_INFO_DOORS: Readonly<Record<MakerInfoField, { page: string | null; sameField: string | null }>> = {
  display_name: { page: 'names', sameField: 'display_name' },
  title: { page: 'eyebrow', sameField: null },
  special_message: { page: 'message', sameField: 'special_message' },
  what_to_bring: { page: 'reminders', sameField: 'what_to_bring' },
  opening_line: { page: null, sameField: 'opening_line' },
  countdown_line: { page: null, sameField: null },
  greeting: { page: null, sameField: null },
  yes_note: { page: null, sameField: null },
  no_note: { page: null, sameField: null },
};

export type MakerPartSource =
  | { kind: 'info'; field: MakerInfoField }
  | { kind: 'studio'; tool: MakerStudioTool }
  | { kind: 'supplier'; fact: 'date' | 'venue' }
  | { kind: 'tool' };

/** The Studio tools a part's quiet row opens — `lib/studio-tiles.ts` `STUDIO_TILE_KEYS`, restated so this stays import-light. */
export type MakerStudioTool = 'logo' | 'mood' | 'schedule' | 'story' | 'march' | 'seats' | 'gifts' | 'rsvp';
export const MAKER_STUDIO_TOOL_LABEL: Record<MakerStudioTool, string> = {
  logo: 'Logo',
  mood: 'Mood Board',
  schedule: 'Schedule',
  story: 'Love Story',
  march: 'Wedding March',
  seats: 'Seat plan',
  gifts: 'E-Gifts',
  rsvp: 'RSVP',
};

/** A part's layouts: the shipped styles of the scene it is drawn in, or the Camera's own three. */
export type MakerPartLayouts = { kind: 'scene'; type: string } | { kind: 'own'; names: readonly string[] } | { kind: 'none' };

/** 🎛 The Camera's three (owner 2026-10-06, "THE CAMERA HAS ITS OWN THREE LAYOUTS"). */
export const MAKER_CAMERA_LAYOUTS = ['Classic', 'Your brand', 'Challenges'] as const;

export type MakerPartDef = {
  /** The tile's word. */
  label: string;
  /** One string: `info:<field>` · `studio:<tool>` · `supplier:date|venue` · `tool` (see the docblock). */
  source: string;
  /** The canvas's key for the section it is drawn in — null: not drawn by the canvas yet. */
  canvas: string | null;
  /** The part inside that section (`[data-el]`), when it is one part of a bigger section. */
  el?: HubElementKey;
  layouts: MakerPartLayouts;
  /** 👤 One of the four FOR-EACH-GUEST parts (filled from that guest's own row; drawn for guests in PR 6). */
  my?: 'role' | 'wear' | 'arrive' | 'guests';
};

const scene = (type: string): MakerPartLayouts => ({ kind: 'scene', type });
const NONE: MakerPartLayouts = { kind: 'none' };

/**
 * THE PART MAP (prototype `ELS`). The hero's own parts share the hero's styles
 * (none registered today — the hero's design is Studio › Look's); a section's
 * parts share its scene's styles.
 */
export const MAKER_PARTS: Readonly<Record<MakerPartKey, MakerPartDef>> = {
  /* The Reveal is the first part of three stages — its kinds are PR 3's (`maker-reveal.tsx`). */
  reveal: { label: 'Reveal', source: 'tool', canvas: null, layouts: NONE },
  logo: { label: 'Logo', source: 'studio:logo', canvas: 'f:hero', el: 'mark', layouts: NONE },
  /* The stage's first line ("Save the date", "The wedding of") — typed on the page; NOT the Event Name. */
  ename: { label: 'Title', source: 'info:title', canvas: 'f:hero', el: 'eyebrow', layouts: NONE },
  names: { label: 'Names', source: 'info:display_name', canvas: 'f:hero', el: 'names', layouts: NONE },
  date: { label: 'Date', source: 'supplier:date', canvas: 'f:hero', el: 'date', layouts: NONE },
  place: { label: 'Place', source: 'supplier:venue', canvas: 'f:hero', el: 'venue', layouts: NONE },
  countdown: { label: 'Countdown', source: 'info:countdown_line', canvas: 'w:countdown', layouts: scene('countdown') },
  message: { label: 'Message', source: 'info:special_message', canvas: 'w:special_message', layouts: scene('special_message') },
  rsvp: { label: 'RSVP', source: 'studio:rsvp', canvas: 'f:rsvp', layouts: scene('rsvp') },
  greeting: { label: 'Greeting', source: 'info:greeting', canvas: 'f:greeting', layouts: NONE },
  /* The Invitation's doorway to the RSVP stage (Reply / Change my reply) — drawn in PR 6. */
  rsvpcard: { label: 'Reply card', source: 'studio:rsvp', canvas: null, layouts: NONE },
  opening: { label: 'Opening line', source: 'info:opening_line', canvas: null, layouts: NONE },
  /* The Welcome's own short notes (2026-10-06 full pass) — not drawn on the Invitation's Welcome yet. */
  reminders: { label: 'Reminders', source: 'tool', canvas: null, layouts: NONE },
  gifts: { label: 'E-Gifts', source: 'studio:gifts', canvas: 'f:gifts', layouts: NONE },
  schedule: { label: 'Schedule', source: 'studio:schedule', canvas: 'w:schedule', layouts: scene('schedule') },
  venue: { label: 'Venue', source: 'supplier:venue', canvas: 'w:venue_map', layouts: scene('venue_map') },
  dress: { label: 'Dress code', source: 'studio:mood', canvas: 'w:dress_code', layouts: scene('dress_code') },
  march: { label: 'Wedding March', source: 'studio:march', canvas: 'f:entourage', layouts: scene('entourage') },
  bring: { label: 'What to bring', source: 'info:what_to_bring', canvas: 'w:what_to_bring', layouts: scene('what_to_bring') },
  story: { label: 'Love Story', source: 'studio:story', canvas: 'w:our_love_story', layouts: scene('our_love_story') },
  /* 👤 FOR EACH GUEST — one part per fact, from that guest's own row (owner 2026-10-06); drawn in PR 6. */
  myrole: { label: 'Your role', source: 'studio:march', canvas: null, layouts: NONE, my: 'role' },
  mywear: { label: 'What to wear', source: 'studio:mood', canvas: null, layouts: NONE, my: 'wear' },
  myarrive: { label: 'Arrive by', source: 'studio:schedule', canvas: null, layouts: NONE, my: 'arrive' },
  myguests: { label: 'Coming with you', source: 'tool', canvas: null, layouts: NONE, my: 'guests' },
  seats: { label: 'Your seat', source: 'studio:seats', canvas: 'f:find_your_seat', layouts: scene('find_your_seat') },
  pass: { label: 'Digital pass', source: 'tool', canvas: 'f:pass', layouts: NONE },
  announce: { label: 'Announcements', source: 'tool', canvas: 'f:announcements', layouts: scene('announcements') },
  /* 🎛 The Camera's own three — never the shared families. */
  camera: { label: 'Camera', source: 'tool', canvas: null, layouts: { kind: 'own', names: MAKER_CAMERA_LAYOUTS } },
  gallery: { label: 'Gallery', source: 'tool', canvas: 'w:our_photos', layouts: scene('gallery') },
  myphotos: { label: 'Photos of you', source: 'tool', canvas: 'f:photos_of_you', layouts: scene('photos_of_you') },
  yesnote: { label: 'When-yes note', source: 'info:yes_note', canvas: null, layouts: NONE },
  nonote: { label: 'When-no note', source: 'info:no_note', canvas: null, layouts: NONE },
  numbers: { label: 'By the numbers', source: 'tool', canvas: 'p:numbers', layouts: scene('statistics') },
  wishes: { label: 'Wishes', source: 'tool', canvas: 'p:wishes', layouts: scene('photo-notes') },
  suppliers: { label: 'With thanks to', source: 'tool', canvas: 'p:vendors', layouts: scene('supplier-stories') },
  film: { label: 'The film', source: 'tool', canvas: 'p:film', layouts: scene('live-stream') },
  /* 🎞 The nine Post Event scenes the ＋ sheet adds — each by its SHIPPED name and
     key (`lib/post-event-scenes.ts` `POST_EVENT_SCENE_NAMES`), never retyped; their
     looks are Post Event's own (`post-event-style-resolve.ts`), not a scene's. */
  road: { label: POST_EVENT_SCENE_NAMES.before!, source: 'tool', canvas: 'p:before', layouts: NONE },
  watchlive: { label: POST_EVENT_SCENE_NAMES.film!, source: 'tool', canvas: 'p:film', layouts: NONE },
  challenge: { label: POST_EVENT_SCENE_NAMES.asked!, source: 'tool', canvas: 'p:asked', layouts: NONE },
  supstories: { label: POST_EVENT_SCENE_NAMES.vendors!, source: 'tool', canvas: 'p:vendors', layouts: NONE },
  wall: { label: POST_EVENT_SCENE_NAMES.wall!, source: 'tool', canvas: 'p:wall', layouts: NONE },
  said: { label: POST_EVENT_SCENE_NAMES.said!, source: 'tool', canvas: 'p:said', layouts: NONE },
  beforeafter: { label: POST_EVENT_SCENE_NAMES.beforeAfter!, source: 'tool', canvas: 'p:beforeAfter', layouts: NONE },
  song: { label: POST_EVENT_SCENE_NAMES.song!, source: 'tool', canvas: 'p:song', layouts: NONE },
  next: { label: POST_EVENT_SCENE_NAMES.next!, source: 'tool', canvas: 'p:next', layouts: NONE },
};

/** A part's source, read. Throws on a string no part may carry — the test walks every part through it. */
export function makerPartSource(key: MakerPartKey): MakerPartSource {
  const raw = MAKER_PARTS[key].source;
  if (raw === 'tool') return { kind: 'tool' };
  const [kind, value] = raw.split(':') as [string, string | undefined];
  if (kind === 'info' && (MAKER_INFO_FIELDS as readonly string[]).includes(value ?? '')) return { kind: 'info', field: value as MakerInfoField };
  if (kind === 'studio' && value && value in MAKER_STUDIO_TOOL_LABEL) return { kind: 'studio', tool: value as MakerStudioTool };
  if (kind === 'supplier' && (value === 'date' || value === 'venue')) return { kind: 'supplier', fact: value };
  throw new Error(`maker-parts: "${key}" names no source the Maker knows ("${raw}")`);
}

/**
 * THE ONE QUIET ROW at the top of Style (owner-approved: *"Edit the <tool> ›"* —
 * the only "go there" in the Maker; it opens the tool IN PLACE and ‹ returns to
 * the same stage and part). Never a badge on the canvas. Null: none.
 */
export function makerPartQuietRow(key: MakerPartKey): { words: string; to: { studio: MakerStudioTool | 'info' } | { suppliers: 'date' | 'venue' } } | null {
  const src = makerPartSource(key);
  if (src.kind === 'studio') return { words: `Edit the ${MAKER_STUDIO_TOOL_LABEL[src.tool]}`, to: { studio: src.tool } };
  if (src.kind === 'supplier') return { words: `Change the ${src.fact} in Suppliers`, to: { suppliers: src.fact } };
  /* DECISION_LOG 2026-10-06 rule 6: "Edit in Studio › Info" stays on every text part. */
  if (src.kind === 'info') return { words: 'Edit in Studio › Info', to: { studio: 'info' } };
  return null;
}

/* ── the pages (prototype `TABS`, on the SHIPPED guest bar's page keys) ──── */

/**
 * The parts of each page, in the approved default order (DECISION_LOG
 * 2026-10-05). The page keys are the guest bar's own (`site-nav.ts`
 * `NavSlotKey`, `lib/maker-guest-pages.ts`), and the RSVP stage's three screens
 * are `lib/rsvp-stage.ts`'s. A page the guest bar does not draw on this event is
 * simply not offered (the item ▾ lists the bar's pages, not these).
 */
export const MAKER_STAGE_PAGES: Readonly<Record<MakerStageKey, Readonly<Record<string, readonly MakerPartKey[]>>>> = {
  save_the_date: {
    home: ['reveal', 'logo', 'ename', 'names', 'date', 'place', 'countdown', 'message'],
    story: ['story'],
    me: ['pass'],
  },
  [RSVP_STAGE_KEY]: {
    form: ['logo', 'ename', 'names', 'date', 'place', 'rsvp', 'greeting'],
    thanks: ['yesnote', 'pass'],
    decline: ['nonote'],
  },
  rsvp: {
    home: ['reveal', 'logo', 'ename', 'names', 'date', 'place', 'rsvpcard', 'countdown', 'opening', 'greeting', 'message', 'reminders', 'gifts'],
    details: ['schedule', 'venue', 'dress', 'march', 'bring'],
    story: ['story'],
    me: ['rsvpcard', 'myrole', 'mywear', 'myarrive', 'myguests', 'seats'],
  },
  event: {
    live: ['reveal', 'announce', 'logo', 'names', 'date', 'place', 'schedule'],
    home: ['venue', 'dress', 'march', 'bring'],
    camera: ['camera'],
    gallery: ['gallery', 'myphotos'],
    me: ['seats', 'pass'],
  },
  editorial: {
    home: ['logo', 'ename', 'names', 'date', 'numbers', 'message', 'wishes', 'story', 'suppliers'],
    film: ['film'],
    suppliers: ['suppliers'],
    gallery: ['film', 'gallery', 'myphotos'],
  },
};

/** The parts of one page, in order (none for a page the map does not know). */
export function makerPartsOnPage(stage: MakerStageKey, page: string | null | undefined): readonly MakerPartKey[] {
  return (page ? MAKER_STAGE_PAGES[stage]?.[page] : undefined) ?? [];
}

/**
 * The parts a TAP can reach on this page: drawn by the canvas (`canvas` set) and
 * present on it now (`present` — the canvas keys the page drew). A part the page
 * did not draw is not a tile: a tap on it would do nothing.
 */
export function makerPartsTappable(stage: MakerStageKey, page: string | null | undefined, present: ReadonlySet<string>): MakerPartKey[] {
  return makerPartsOnPage(stage, page).filter((k) => {
    const c = MAKER_PARTS[k].canvas;
    return c !== null && present.has(c);
  });
}

/**
 * ⟷ SWIPE = the next (or previous) part, CONTINUING INTO THE NEXT PAGE (owner:
 * *"Swiping right will go to the next element"*). `parts` are this page's
 * tappable parts in order; `pages` the stage's pages in the bar's order. At
 * either end of a page it names the neighbouring page (its first part, or its
 * last going back) — `part: null` means "that page's first/last, once drawn".
 * Null: nowhere to go.
 */
export function makerStepPart(input: {
  parts: readonly MakerPartKey[];
  at: MakerPartKey | null;
  pages: readonly string[];
  page: string | null;
  dir: 1 | -1;
}): { page: string; part: MakerPartKey | null } | null {
  const { parts, at, pages, page, dir } = input;
  const i = at ? parts.indexOf(at) : -1;
  const j = i < 0 ? (dir === 1 ? 0 : parts.length - 1) : i + dir;
  if (page && j >= 0 && j < parts.length) return { page, part: parts[j]! };
  const p = page ? pages.indexOf(page) : -1;
  const q = p + dir;
  if (p < 0 || q < 0 || q >= pages.length) return null;
  return { page: pages[q]!, part: null };
}

/** The part whose canvas key (and part) a tap on the page named — the first in this page's order. */
export function makerPartOfTap(
  stage: MakerStageKey,
  page: string | null | undefined,
  key: string,
  el: string | null | undefined,
): MakerPartKey | null {
  const on = makerPartsOnPage(stage, page);
  const exact = on.find((k) => MAKER_PARTS[k].canvas === key && (MAKER_PARTS[k].el ?? null) === (el ?? null));
  if (exact) return exact;
  /* A tap inside a section on a part the map does not split (a scene's heading) is that section's part. */
  return on.find((k) => MAKER_PARTS[k].canvas === key && !MAKER_PARTS[k].el) ?? on.find((k) => MAKER_PARTS[k].canvas === key) ?? null;
}
