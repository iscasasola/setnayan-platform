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
import { POST_EVENT_SCENE_NAMES } from './post-event-scene-names';

/* ── the four tools ───────────────────────────────────────────────────────── */

/**
 * Edit | Style | Background | Animate — the toolbar's one selector (owner 2026-10-09, verbatim: *"so it is just
 * Edit | Style | Background | Animate"*; `TOOLBAR-SPEC-2026-10-09.md`). It was Style | Text | Animate: Text's Font
 * left the toolbar (*"there is already a universal font"*), its Colour and Size are Style's last row, the part's
 * words and its place are Edit's, and Background is a tool of its own instead of a segment under Style.
 */
export const MAKER_PART_TOOLS = ['edit', 'style', 'bg', 'animate'] as const;
export type MakerPartTool = (typeof MAKER_PART_TOOLS)[number];
export const MAKER_PART_TOOL_LABEL: Record<MakerPartTool, string> = { edit: 'Edit', style: 'Style', bg: 'Background', animate: 'Animate' };

/**
 * What the WORK AREA is asked for a tool (`MAKER_STAGE_TOOL_EVENT`, `editor-shell.tsx` `onTool`): Animate is the
 * part's own motion; Edit, Style and Background are all read off the scene's Format (`StageStyle` shows the one the
 * toolbar is on — `stage-panel/store.ts` `useStageTool`). The work area's vocabulary is unchanged.
 */
export type MakerWorkTool = 'style' | 'animate';
export function makerWorkTool(tool: MakerPartTool): MakerWorkTool {
  return tool === 'animate' ? 'animate' : 'style';
}

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
  /* 👆 EVERY VISIBLE PIECE IS A PART (owner 2026-10-07: "every visible piece of the page must be a pickable part") —
     the cover's invite line and its link, the Details block, the day's "Happening now" card. */
  'heroline',
  'herolink',
  'details',
  'spotlight',
  'livehub',
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
  mood: 'Mood Board & Dress Code',
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
 * THE PART MAP (prototype `ELS`). The hero's own parts, E-Gifts and the four
 * for-each-guest parts wear their OWN registered styles (`lib/scene-styles-parts.ts`,
 * owner 2026-10-07); a section's parts share its scene's styles.
 */
export const MAKER_PARTS: Readonly<Record<MakerPartKey, MakerPartDef>> = {
  /* The Reveal is the first part of three stages — its kinds are PR 3's (`maker-reveal.tsx`). */
  reveal: { label: 'Reveal', source: 'tool', canvas: null, layouts: NONE },
  logo: { label: 'Logo', source: 'studio:logo', canvas: 'f:hero', el: 'mark', layouts: scene('hero_mark') },
  /* The stage's first line ("Save the date", "The wedding of") — typed on the page; NOT the Event Name. */
  ename: { label: 'Title', source: 'info:title', canvas: 'f:hero', el: 'eyebrow', layouts: scene('hero_eyebrow') },
  names: { label: 'Names', source: 'info:display_name', canvas: 'f:hero', el: 'names', layouts: scene('hero_names') },
  date: { label: 'Date', source: 'supplier:date', canvas: 'f:hero', el: 'date', layouts: scene('hero_date') },
  place: { label: 'Place', source: 'supplier:venue', canvas: 'f:hero', el: 'venue', layouts: scene('hero_venue') },
  countdown: { label: 'Countdown', source: 'info:countdown_line', canvas: 'w:countdown', layouts: scene('countdown') },
  message: { label: 'Message', source: 'info:special_message', canvas: 'w:special_message', layouts: scene('special_message') },
  rsvp: { label: 'RSVP', source: 'studio:rsvp', canvas: 'f:rsvp', layouts: scene('rsvp') },
  greeting: { label: 'Greeting', source: 'info:greeting', canvas: 'f:greeting', layouts: NONE },
  /* The Invitation's doorway to the RSVP stage (Reply / Change my reply) — drawn in PR 6. */
  rsvpcard: { label: 'Reply card', source: 'studio:rsvp', canvas: null, layouts: NONE },
  opening: { label: 'Opening line', source: 'info:opening_line', canvas: null, layouts: NONE },
  /* The Welcome's own short notes (2026-10-06 full pass) — not drawn on the Invitation's Welcome yet. */
  reminders: { label: 'Reminders', source: 'tool', canvas: null, layouts: NONE },
  gifts: { label: 'E-Gifts', source: 'studio:gifts', canvas: 'f:gifts', layouts: scene('gifts') },
  schedule: { label: 'Schedule', source: 'studio:schedule', canvas: 'w:schedule', layouts: scene('schedule') },
  venue: { label: 'Venue', source: 'supplier:venue', canvas: 'w:venue_map', layouts: scene('venue_map') },
  dress: { label: 'Dress code', source: 'studio:mood', canvas: 'w:dress_code', layouts: scene('dress_code') },
  march: { label: 'Wedding March', source: 'studio:march', canvas: 'f:entourage', layouts: scene('entourage') },
  bring: { label: 'What to bring', source: 'info:what_to_bring', canvas: 'w:what_to_bring', layouts: scene('what_to_bring') },
  story: { label: 'Love Story', source: 'studio:story', canvas: 'w:our_love_story', layouts: scene('our_love_story') },
  /* 👤 FOR EACH GUEST — one part per fact, from that guest's own row (owner 2026-10-06); drawn in PR 6. */
  myrole: { label: 'Your role', source: 'studio:march', canvas: null, layouts: scene('my_role'), my: 'role' },
  /* The Invitation's "Guest's look" stand-in (`f:look`) IS this part on the canvas — each guest's own outfit and colours. */
  mywear: { label: 'What to wear', source: 'studio:mood', canvas: 'f:look', layouts: scene('my_wear'), my: 'wear' },
  myarrive: { label: 'Arrive by', source: 'studio:schedule', canvas: null, layouts: scene('my_arrive'), my: 'arrive' },
  myguests: { label: 'Coming with you', source: 'tool', canvas: null, layouts: scene('my_guests'), my: 'guests' },
  seats: { label: 'Your seat', source: 'studio:seats', canvas: 'f:find_your_seat', layouts: scene('find_your_seat') },
  pass: { label: 'Digital pass', source: 'tool', canvas: 'f:pass', layouts: NONE },
  announce: { label: 'Announcements', source: 'tool', canvas: 'f:announcements', layouts: scene('announcements') },
  /* 🎛 The Camera's own three — never the shared families. */
  camera: { label: 'Camera', source: 'tool', canvas: null, layouts: { kind: 'own', names: MAKER_CAMERA_LAYOUTS } },
  gallery: { label: 'Gallery', source: 'tool', canvas: 'w:our_photos', layouts: scene('gallery') },
  myphotos: { label: 'Photos of you', source: 'tool', canvas: 'f:photos_of_you', layouts: scene('photos_of_you') },
  /* 🗳 The RSVP stage's two after-screens (owner 2026-10-07/08: "yes and no page for the rsvp is to show what the
     rsvp looks like after the reply yes or no"): the couple's heading and message, marked on the Maker's canvas of
     `invite/enter` (`f:yesnote` / `f:nonote`) and typed there on the second tap. */
  yesnote: { label: 'When-yes note', source: 'info:yes_note', canvas: 'f:yesnote', layouts: NONE },
  nonote: { label: 'When-no note', source: 'info:no_note', canvas: 'f:nonote', layouts: NONE },
  numbers: { label: 'By the numbers', source: 'tool', canvas: 'p:numbers', layouts: scene('statistics') },
  wishes: { label: 'Wishes', source: 'tool', canvas: 'p:wishes', layouts: scene('photo-notes') },
  suppliers: { label: 'Supplier Stories', source: 'tool', canvas: 'p:vendors', layouts: scene('supplier-stories') },
  film: { label: 'Watch Live', source: 'tool', canvas: 'p:film', layouts: scene('live-stream') },
  /* 👆 The cover's own two lines ("invite you to celebrate their wedding" · "the day, the place, the story ↓") —
     hero parts (`HUB_HERO_ELEMENT_KEYS` 'line' / 'link'), typed on the page on the second tap. */
  heroline: { label: 'Invite line', source: 'tool', canvas: 'f:hero', el: 'line', layouts: NONE },
  herolink: { label: 'Link', source: 'tool', canvas: 'f:hero', el: 'link', layouts: NONE },
  /* The Details page's "THE DETAILS · WHEN · WHERE" block (`PublicEventDetails`) — its date and place come from the
     booked venue, so its door is Suppliers'; its looks are the shipped event_details styles. */
  details: { label: 'The details', source: 'supplier:date', canvas: 'f:details', layouts: scene('event_details') },
  /* The Day's "Happening now · Watch the event live →" card (`SpotlightCard`). */
  spotlight: { label: 'Happening now', source: 'tool', canvas: 'f:spotlight', layouts: NONE },
  /* The Day's "Watch live · Live photo wall" part (`MakerDayPartStandIn` `live_hub`) — a tap on it picked nothing. */
  livehub: { label: 'Live hub', source: 'tool', canvas: 'f:live_hub', layouts: scene('live_hub') },
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
 * THE PART'S ONE DOOR — Edit's row 1 where its editing cannot be done in the toolbar (owner 2026-10-09: *"Only jump
 * if it has editing that cannot be done there. Example: Schedule, Love Story, Wedding March, Logo"*). It opens the
 * tool IN PLACE and ‹ returns to the same stage and part; the only "go there" in the Maker, never a badge on the
 * canvas. Null: none. The words are the approved prototype's: "Open in Studio › <page>" · "Change it in Suppliers".
 * (A part whose words the page draws is typed right in Edit instead — `stage-panel/part-words.ts`; its door is
 * only drawn where the page draws no such words.)
 */
export function makerPartQuietRow(key: MakerPartKey): { words: string; to: { studio: MakerStudioTool | 'info' } | { suppliers: 'date' | 'venue' } } | null {
  const src = makerPartSource(key);
  if (src.kind === 'studio') return { words: `Open in Studio › ${MAKER_STUDIO_TOOL_LABEL[src.tool]}`, to: { studio: src.tool } };
  if (src.kind === 'supplier') return { words: 'Change it in Suppliers', to: { suppliers: src.fact } };
  /* DECISION_LOG 2026-10-06 rule 6: the Info door stays on every text part. */
  if (src.kind === 'info') return { words: 'Open in Studio › Info', to: { studio: 'info' } };
  return null;
}

/**
 * 🚫 DOES A TOOL HAVE ANYTHING TO SET ON THIS PART? (owner rule: a failure never renders as success — a pill that
 * slides to "Animate" over a panel still showing Style's cards is exactly that. Tapped on the Maker lab, 2026-10-08:
 * E-Gifts and What to wear did it.)
 *
 *   Edit        every part but the Camera — a door or a name, and its place on the page.
 *   Style       always — every part has a look.
 *   🎛 The Camera is a full-screen design with ONLY Style live (owner 2026-10-09): Edit, Background and Animate are
 *   grey on it, and it has no move row.
 *   Background  only where the work area has a background to save TODAY: a scene the couple arranges (`w:`). A
 *               single line inside the cover (`el`) sits on the cover's own — grey for good (owner 2026-10-09). The
 *               fixed blocks (the March, E-Gifts, The details, What to wear, the seat, the pass …) are to get one
 *               (*"giving the freedom to fix their event hub"*) — real build work after the toolbar; grey until then.
 *   Animate     only where the work area has a save for it (`editor-shell.tsx` `onTool`, `stage-tools.tsx`
 *               `askTool`): a part of a bigger section with words of its own (`el` → the part's sheet), or a scene
 *               the couple arranges (`w:` → the scene's motion). The fixed blocks are to get it too — grey until then.
 * A Post Event scene (`p:`), and the parts the canvas does not draw (the Reveal, the Camera) have neither.
 */
export function makerPartToolWorks(key: MakerPartKey, tool: MakerPartTool): boolean {
  if (tool === 'style') return true;
  if (key === 'camera') return false;
  if (tool === 'edit') return true;
  const def = MAKER_PARTS[key];
  if (!def.canvas) return false;
  if (tool === 'bg') return def.canvas.startsWith('w:');
  return Boolean(def.el) || def.canvas.startsWith('w:');
}

/**
 * The ONE plain line a tap on a tool with nothing to set answers with — never a dead tap, never a silent one. A
 * line of the cover says whose background it sits on (the prototype's own words); a part whose content is Studio's
 * says where it IS changed; any other names the tool.
 */
export function makerPartToolWhy(key: MakerPartKey | null, tool: MakerPartTool): string {
  if (tool === 'bg' && key && MAKER_PARTS[key].canvas === 'f:hero' && MAKER_PARTS[key].el) return 'This sits on the cover’s background.';
  const src = key ? makerPartSource(key) : null;
  if (src?.kind === 'studio') return 'Nothing to change here — edit it in Studio.';
  return `${MAKER_PART_TOOL_LABEL[tool]} has nothing to change on this part.`;
}

/**
 * 🧠 THE TOOL A PART OPENS ON: the one last used — or, where that one has nothing to set on this part, the FIRST of
 * the four that has (the prototype's `pickPart`: `tool = toolKeys().find(t => works(k, t))`). The remembered tool is
 * not rewritten: it comes back on the next part that has it.
 */
export function makerPartToolFor(key: MakerPartKey | null, remembered: MakerPartTool): MakerPartTool {
  if (!key || makerPartToolWorks(key, remembered)) return remembered;
  return MAKER_PART_TOOLS.find((t) => makerPartToolWorks(key, t)) ?? 'style';
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
    home: ['reveal', 'logo', 'ename', 'names', 'heroline', 'date', 'place', 'herolink', 'countdown', 'message'],
    story: ['story'],
    me: ['pass'],
  },
  [RSVP_STAGE_KEY]: {
    form: ['logo', 'ename', 'names', 'date', 'place', 'rsvp', 'greeting'],
    /* 👆 "Every visible piece is a pickable part" (owner 2026-10-07): the after-screens draw the couple's mark,
       their names and — when they typed one — their invitation line over the note, so those are parts here too. */
    thanks: ['logo', 'names', 'heroline', 'yesnote', 'pass'],
    decline: ['logo', 'names', 'heroline', 'nonote'],
  },
  rsvp: {
    home: ['reveal', 'logo', 'ename', 'names', 'heroline', 'date', 'place', 'herolink', 'rsvpcard', 'countdown', 'opening', 'greeting', 'message', 'reminders', 'gifts'],
    details: ['details', 'schedule', 'venue', 'dress', 'march', 'bring'],
    story: ['story'],
    me: ['rsvpcard', 'myrole', 'mywear', 'myarrive', 'myguests', 'seats'],
  },
  event: {
    live: ['reveal', 'spotlight', 'announce', 'livehub', 'logo', 'ename', 'names', 'heroline', 'date', 'place', 'herolink', 'schedule'],
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
  return makerPartsOnPage(stage, page).filter((k) => makerPartIsDrawn(k, present));
}

/**
 * 🖼 DID THE PAGE DRAW THIS PART? `present` is what the canvas drew: each section's key, and — for a section whose
 * parts it lists (the cover, `f:hero|<el>`) — each part inside it. A part of a section (the cover's invite line, its
 * link) is drawn only when the page DREW that part: a cover without an invite line has no "Invite line" to pick.
 * (Seen on the Maker lab, 2026-10-09: the plain masthead draws no `line` and no `link`, yet both were parts of the
 * page — picked, the frame fell back to the whole cover and Edit had nothing to show.) A reader that did not list a
 * section's parts is answered by the section.
 */
export function makerPartIsDrawn(key: MakerPartKey, present: ReadonlySet<string>): boolean {
  const { canvas: c, el } = MAKER_PARTS[key];
  if (c === null || !present.has(c)) return false;
  if (!el) return true;
  const listed = [...present].some((p) => p.startsWith(`${c}|`));
  return !listed || present.has(`${c}|${el}`);
}

/**
 * WHY A STEP OF EDIT'S LAST ROW IS GREY (↑ Earlier · ↓ Later · Remove) — said when it is tapped, never a dead tap. A part that does not move at all (a line of the cover, a fixed block,
 * the Reveal, a reply page's part) keeps its place; one that moves but has no neighbour on that side is already first
 * or last; a part that cannot be taken off stays.
 */
export function makerPartStepWhy(label: string, canMove: boolean, canRemove: boolean): { earlier: string; later: string; remove: string } {
  return {
    /* (First / last: the approved prototype's own two lines.) */
    earlier: canMove ? 'It is already first on this page.' : `${label} keeps its place on this page.`,
    later: canMove ? 'It is already last on this page.' : `${label} keeps its place on this page.`,
    remove: canRemove ? '' : `${label} stays on this page.`,
  };
}

/**
 * 👆 THE PART PICKED ON ARRIVING at a stage's page (owner 2026-10-09: something is always picked): the first part the
 * page DRAWS (`ordered`, top to bottom) that Edit has a row for — its words to type, or its one door — so the first
 * thing seen is never an empty tool. Never the Reveal (it leads three pages and has only Style). A page whose parts
 * all have no row lands on its first part all the same; a page that draws nothing picks nothing.
 */
export function makerArrivalPart(ordered: readonly MakerPartKey[], hasEditRow: (k: MakerPartKey) => boolean): MakerPartKey | null {
  const parts = ordered.filter((k) => k !== 'reveal');
  return parts.find(hasEditRow) ?? parts[0] ?? null;
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

/** Hero pieces drawn inside another part (`pahina-masthead.tsx`): a tap on one picks the part it sits in. */
export const HERO_EL_INSIDE: Readonly<Record<string, string>> = { joiner: 'names', time: 'date' };

/** The part whose canvas key (and part) a tap on the page named — the first in this page's order. */
export function makerPartOfTap(
  stage: MakerStageKey,
  page: string | null | undefined,
  key: string,
  el: string | null | undefined,
): MakerPartKey | null {
  const on = makerPartsOnPage(stage, page);
  /* A piece INSIDE a part is that part: the names' "&", the date's time. */
  el = el ? (HERO_EL_INSIDE[el] ?? el) : el;
  const exact = on.find((k) => MAKER_PARTS[k].canvas === key && (MAKER_PARTS[k].el ?? null) === (el ?? null));
  if (exact) return exact;
  /* A tap inside a section on a part the map does not split (a scene's heading) is that section's part. */
  return on.find((k) => MAKER_PARTS[k].canvas === key && !MAKER_PARTS[k].el) ?? on.find((k) => MAKER_PARTS[k].canvas === key) ?? null;
}

/**
 * 🧾 THE SCENES THAT ARE ROWS (owner 2026-10-07, on Schedule › Animate › Build in:
 * *"where is the animation to allow it row by row or at the same time"* → *"put it
 * in build in"*). These scenes draw a list — moments, venues, chapters, colours,
 * items — so Build in carries ONE "Rows ▾" (All at once · One after another), the
 * SHIPPED `canvas.sequence` (`HUB_SEQUENCES`). A single block (the countdown, a
 * message, the greeting) has no rows and no such row. Widget types, as the scene's
 * canvas is keyed (`stage-animate.tsx`, `scene-animate-tab.tsx`).
 */
export const MAKER_ROW_SCENES: readonly string[] = [
  'schedule',
  'our_love_story',
  'venue_map',
  'dress_code',
  'what_to_bring',
  'photo_moments',
  'our_photos',
  'event_details',
  'entourage',
  'gifts',
];

/** Does this scene's Build in offer Rows ▾? */
export function makerSceneHasRows(widgetType: string): boolean {
  return MAKER_ROW_SCENES.includes(widgetType);
}

export { makerStageMayType } from './maker-stage-type';

/** The shell attribute the Stages panel keeps for the part it has picked (`makerStageMayType`). */
export function makerStagePickedAttr(key: MakerPartKey | null): string | null {
  if (!key) return null;
  const def = MAKER_PARTS[key];
  return def.canvas ? `${def.canvas}|${def.el ?? ''}` : null;
}

/**
 * 🎭 THE REVEAL IS LOCKED FIRST (owner 2026-10-07, verbatim: *"then the move feature or add a slide
 * above on reveal must be removed (for reveal only) because that should be its limitation"*). It is the
 * first part of Save the Date, Invitation › Welcome and The Day › Live: picked, it shows NO grip, NO ＋
 * above and NO 🗑 (it hides per stage through Arrange › On this stage); its ＋ below stays. Every other
 * part keeps all four.
 */
export function makerRevealEdges(isReveal: boolean): { grip: boolean; addAbove: boolean; addBelow: boolean; remove: boolean } {
  return isReveal ? { grip: false, addAbove: false, addBelow: false, remove: false } : { grip: true, addAbove: true, addBelow: true, remove: true };
}

/**
 * 🗳 THE RSVP STAGE'S THREE SCREENS ARE FIXED PAGES: the form and the two after-screens are the guest's own reply
 * pages — nothing can be added to one, moved on it or taken off it. So a part picked there has its frame, its name
 * and ↑ ↓ ✕, and NO ＋, grip or 🗑. (The ＋ sheet would also ask the work area mounted under that stage, and offer
 * the INVITATION's hidden scenes — a write to another stage.)
 */
export function makerStageIsFixedPages(stage: MakerStageKey): boolean {
  return stage === RSVP_STAGE_KEY;
}

/**
 * …and nothing lands ABOVE it: on a page the Reveal leads, a drop (or an add) at slot 0 lands at slot 1 —
 * right under the Reveal. `index` is the slot in the page's drawn order, the Reveal counted.
 */
export function makerDropSlot(index: number, revealLeads: boolean): number {
  return revealLeads ? Math.max(1, index) : Math.max(0, index);
}

/**
 * 🎯 THE STYLE BAR OPENS THE EXACT PLACE (owner 2026-10-07, verbatim: *"it should jump to whatever studio it
 * goes and opens to the exact place where to edit it"*; prototype `editin:info:<field>`, `#item=info&focus=name`).
 * The field a part's words live in, in its Studio editor — the SAME `data-same-field` door that editor draws
 * (`same-field.ts`). Null: the editor opens at its top (the field has no door of its own yet — the countdown
 * line, the greeting, the stage's title: `MAKER_INFO_DOORS`), or the part is the editor's whole subject
 * (the Schedule, the March, E-Gifts …). Held by `lib/the-stages-panel-is-the-prototypes.test.ts`.
 */
export const MAKER_PART_FOCUS: Partial<Record<MakerPartKey, string>> = {
  names: '[data-same-field="display_name"], [data-details-names] input',
  opening: '[data-same-field="opening_line"]',
  message: '[data-same-field="special_message"]',
};

/** Where a part's Style bar goes: its Studio tile, and the field focused there (or null). */
export function makerPartStudioDoor(key: MakerPartKey): { tile: MakerStudioTool | 'info'; focus: string | null } | null {
  const q = makerPartQuietRow(key);
  if (!q || 'suppliers' in q.to) return null;
  return { tile: q.to.studio, focus: MAKER_PART_FOCUS[key] ?? null };
}
