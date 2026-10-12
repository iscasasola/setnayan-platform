/**
 * apps/web/lib/guests-see-build.ts
 *
 * 🗂 "WHAT GUESTS SEE" — BUILDING THE TABLE (server side). Every scene cell is
 * read from `sceneOnStage` (`lib/what-guests-see.ts`), the same answer the guest
 * page and the Maker's list decide by; the rows that are not scenes are shown in
 * their current state and locked. See `lib/guests-see-table.ts` for the shape,
 * the words and what a tick writes.
 *
 * Pure: no React, no database.
 */
import type { InvitationWidgetRow, LifecyclePhase, WidgetType } from './invitation-widgets';
import { isCustomSectionType, sanitizeCustomSection } from './custom-sections';
import { resolveSiteBodyPlan } from './site-body-plan';
import { FIXED_PARTS, configWithStageShow, stageShowsEntourage, type FixedPart } from './stage-scenes';
import { filmLeadsStage, partChoice, sceneMeetsGuestsOn, sceneOnStage, whyNotInStageList, type GuestsSeeInput } from './what-guests-see';
import { FIXED_PART_LABEL, GUESTS_SEE_COLUMNS, GUESTS_SEE_WORDS, type GuestsSeeCell, type GuestsSeeGroup, type GuestsSeeRow, type GuestsSeeTable } from './guests-see-table';

/** A dash's one line, where the prototype words it; otherwise the rule's own line (`sceneOnStage().notPossible.why`). */
const SCENE_DASH: Partial<Record<string, string>> = {
  'countdown:event': 'The countdown ends on the day.',
  'countdown:editorial': 'The countdown ends on the day.',
  'what_to_bring:editorial': 'The day has passed.',
};

/**
 * THE ROWS THAT ARE NOT SCENES — their state per column, as the prototype
 * records it (measured on the live page 2026-10-10): `T` shown · `O` not shown ·
 * `X` cannot be there then (with its line). Three of them are asked of the
 * page's own rules instead (`fixedRowOn`): Names and date, the Digital pass and
 * the Reply card follow the plan's always-on gates; the Entourage follows
 * `stageShowsEntourage` and whether anybody holds a role; E-Gifts follows
 * "Accept gifts?".
 */
type FixedKey = 'names' | 'place' | FixedPart | 'reveal';
/* Every fixed part has its name in the table's words — a part added to `FIXED_PARTS` without one fails to compile here. */
FIXED_PART_LABEL satisfies Record<FixedPart, string>;
/**
 * THE ROWS THAT ARE NOT SCENES, column by column (Save the Date · RSVP · Invitation · The Day · Post Event):
 *
 *   `B` a BOX — the part can be on that stage, and the couple's choice is read where it is drawn (`partOnStage` /
 *       `partsHiddenOn`, pass 2). Ticked when the page shows it there with no choice stored (`fixedBase`);
 *   `A` always shown (a bare tick; its tap says so in the prototype's words);
 *   `L` shown today as the page has it, not changed here yet (a bare tick or a quiet dash);
 *   `X` cannot be there at that time (a dash, with its line).
 *
 * 🔑 A BOX IS ONLY WHERE THE CODE CAN DRAW THE PART. The prototype's letters were one event's page; these are the
 * mounts' own gates, read 2026-10-11: the seat is drawn wherever the guest has a table guests may see
 * (`guestsMaySeeSeats`); Live follows the broadcast, not the calendar; the Camera is drawn on The Day (the
 * page draws none after it); Photos of you is the day's and the recap's; an announcement is read until the day is over
 * (`announcementStage`). `fixed-rows-are-real-boxes` flips every one of these boxes on the real page.
 */
const FIXED: Record<FixedKey, { label: string; cols: string; note?: string; always?: string; why?: Partial<Record<number, string>> }> = {
  names: { label: 'Names and date', cols: 'AAAAA', always: GUESTS_SEE_WORDS.alwaysNames },
  place: { label: 'Place', cols: 'AAAAL', note: GUESTS_SEE_WORDS.placeNote, always: GUESTS_SEE_WORDS.alwaysPlace },
  gifts: { label: FIXED_PART_LABEL.gifts, cols: 'BLBBB' },
  entourage: { label: FIXED_PART_LABEL.entourage, cols: 'BLBBB' },
  reply: { label: FIXED_PART_LABEL.reply, cols: 'LAALX', always: GUESTS_SEE_WORDS.alwaysReply, why: { 4: 'The reply closes after the day.' } },
  /* 🪑 TICKED ON ALL FOUR, AGAINST THE PROTOTYPE'S TWO EMPTY BOXES (Save the Date · Post Event) — measured, then
     ruled (controller 2026-10-12: follow the prototype's cells UNLESS that hides what a guest sees today on an event
     that never touched the table). It would: the one seat rule (`guestsMaySeeSeats`, lib/guests-may-see-seats.ts)
     shows a guest their table on and AFTER the day — every Post Event page — and BEFORE it wherever the couple
     switched on "Show guests their seats early", which reaches a Save the Date. Our pick is what the page draws with
     no choice stored, so both stay ticked; the couple may untick either. Held by `fixed-rows-are-real-boxes` (4c). */
  seat: { label: FIXED_PART_LABEL.seat, cols: 'BLBBB' },
  /* 🎫 NOT A BOX YET, and why: the ticket is drawn by the page's Me slot (`app/[slug]/page.tsx`, `meSlotFor`) on every
     stage for a guest who has one, while the plan's `qrCardShouldRender` (the Maker's tile, the bar's `hasPass`) says
     the Invitation and The Day — two gates that already disagree. A box must move both; neither is this file's. */
  pass: { label: FIXED_PART_LABEL.pass, cols: 'LLLLL' },
  announce: { label: FIXED_PART_LABEL.announce, cols: 'LLLLX', why: { 4: 'Announcements end with the day.' } },
  /* 📡 SAVE THE DATE IS THE PROTOTYPE'S DASH (controller 2026-10-12: follow its cells). The dash changes no page: the
     player's mount still follows the broadcast, not the calendar (owner 2026-09-02, `_lib/loaders.ts`), so a stream
     on air while the page is on its Save the Date is still drawn — and cannot be unticked there. */
  live: { label: FIXED_PART_LABEL.live, cols: 'XLBBB', why: { 0: 'Live opens on the day.' } },
  camera: { label: FIXED_PART_LABEL.camera, cols: 'LLLBX', why: { 4: 'The camera closes after the day.' } },
  photosofyou: {
    label: FIXED_PART_LABEL.photosofyou,
    cols: 'XXXBB',
    why: { 0: 'Photos of you come from the day.', 1: 'Photos of you come from the day.', 2: 'Photos of you come from the day.' },
  },
  reveal: { label: 'Reveal', cols: 'LLLLX', why: { 4: 'The opening plays before the day.' } },
};
/** The prototype's recorded letter where a cell is only shown as it is (`L`) — its tick or its quiet dash. */
const SHOWN_TODAY: Partial<Record<FixedKey, string>> = {
  place: 'TTTTO', gifts: 'TOTTT', entourage: 'OOTTT', reply: 'OTTOX', seat: 'OOTTO', pass: 'TOTTT',
  announce: 'TOTTX', live: 'XOTTT', camera: 'OOOTX', reveal: 'TOTTX',
};

type RowSpec = { scene: WidgetType; label: string } | { fixed: FixedKey };
const GROUPS: ReadonlyArray<{ title: string; rows: readonly RowSpec[] }> = [
  { title: 'The basics', rows: [{ fixed: 'names' }, { fixed: 'place' }, { scene: 'countdown', label: 'Countdown' }] },
  { title: 'The story', rows: [{ scene: 'special_message', label: 'Message' }, { scene: 'our_love_story', label: 'Love Story' }, { scene: 'our_photos', label: 'Our photos' }] },
  {
    title: 'The details',
    rows: [
      { scene: 'schedule', label: 'Schedule' },
      { scene: 'venue_map', label: 'Map' },
      { scene: 'dress_code', label: 'Dress code' },
      { scene: 'what_to_bring', label: 'What to bring' },
      { fixed: 'gifts' },
    ],
  },
  { title: 'People', rows: [{ fixed: 'entourage' }, { fixed: 'reply' }] },
  /* The prototype's head here is "On the day"; the owner's standing rule (d25, `the-day-is-the-day.test.ts`) is that a
     label naming that stage reads "The Day" — so it does. */
  { title: 'The Day', rows: [{ fixed: 'seat' }, { fixed: 'pass' }, { fixed: 'announce' }, { fixed: 'live' }, { fixed: 'camera' }, { fixed: 'photosofyou' }] },
  { title: 'The opening', rows: [{ fixed: 'reveal' }] },
];

export type GuestsSeeTableInput = Omit<GuestsSeeInput, 'stage' | 'reader'> & {
  /** Someone holds an entourage role (the section draws nothing otherwise). */
  hasEntourage: boolean;
  /** "Accept gifts? — No" (`events.gifts_on = false`). */
  giftsOff: boolean;
};

/** The page's plan for a stage with the couple's rows as they are — the always-on gates (the ticket, the reply, the names). */
function planFor(stage: LifecyclePhase, input: GuestsSeeTableInput) {
  return resolveSiteBodyPlan({
    identity: 'guest',
    phasesEnabled: input.phasesEnabled ?? true,
    lifecyclePhase: stage,
    stdFilm: true,
    isSample: false,
    hasHeroMedia: false,
    hasBgMusic: false,
    liveMediaPublic: false,
    weddingOnlyParts: input.weddingOnlyParts,
    widgets: input.widgets.filter((w) => sceneMeetsGuestsOn(w, stage)),
    openBrowse: input.openBrowse ?? false,
    content: input.content ?? {},
  });
}

/** A row's state per column where the page's own rules answer; null = the recorded letter stands. */
function fixedRowOn(key: FixedKey, stage: LifecyclePhase | null, input: GuestsSeeTableInput): boolean | null {
  if (stage === null) return null;
  if (key === 'names') return planFor(stage, input).heroShouldRender;
  if (key === 'reply') return planFor(stage, input).rsvpShouldRender;
  if (key === 'pass') return planFor(stage, input).qrCardShouldRender;
  return null;
}

/**
 * WHAT A STAGE SHOWS OF A FIXED PART WITH NO CHOICE STORED — our pick. The part's own gate, restated once: the
 * Entourage has its stages (`stageShowsEntourage`); E-Gifts is on
 * unless the couple answered "Accept gifts? — No"; the rest are shown wherever they have something to show.
 */
function fixedBase(part: FixedPart, stage: LifecyclePhase, input: GuestsSeeTableInput): boolean {
  if (part === 'entourage') return stageShowsEntourage(stage);
  if (part === 'gifts') return !input.giftsOff;
  return true;
}

function fixedRow(key: FixedKey, input: GuestsSeeTableInput): GuestsSeeRow {
  const def = FIXED[key];
  const part = (FIXED_PARTS as readonly string[]).includes(key) ? (key as FixedPart) : null;
  const shown = SHOWN_TODAY[key];
  const cells = GUESTS_SEE_COLUMNS.map((col, i): GuestsSeeCell => {
    const letter = def.cols[i];
    if (letter === 'X') return { kind: 'dash', why: def.why?.[i] ?? 'Not possible at this time.' };
    if (letter === 'A') return { kind: 'locked', on: true, why: def.always ?? GUESTS_SEE_WORDS.locked };
    if (letter === 'B' && part && col.stage) {
      /* 🎞 Under a Save the Date its film leads, the page is the film (`plan.fullBleed`): no foot strip, so no gift
         door to hide or show there — a dash, with why. Led by the photos, it is a box like the rest. */
      if (part === 'gifts' && col.stage === 'save_the_date' && filmLeadsStage(input.widgets, col.stage, input.phasesEnabled ?? true, input.weddingOnlyParts)) {
        return { kind: 'dash', why: GUESTS_SEE_WORDS.filmIsThePage };
      }
      const base = fixedBase(part, col.stage, input);
      const choice = partChoice(input.widgets, part, col.stage, input.phasesEnabled ?? true);
      return { kind: 'box', on: choice ?? base, ourPick: base, base, choice };
    }
    // Shown as it is. A column with no stage (the reply screens) draws none of these parts yet.
    const today = fixedRowOn(key, col.stage, input) ?? (shown ? shown[i] === 'T' : false);
    return { kind: 'locked', on: col.stage === null && key !== 'names' && key !== 'place' && key !== 'reply' ? false : today, why: col.stage === null && part ? GUESTS_SEE_WORDS.replyScreens : GUESTS_SEE_WORDS.locked };
  });
  return {
    key,
    scene: null,
    write: part && def.cols.includes('B') ? `part:${part}` : null,
    label: def.label,
    note: key === 'entourage' && !input.hasEntourage ? GUESTS_SEE_WORDS.nobodyYet : (def.note ?? null),
    empty: false,
    cells,
  };
}

/** The event's rows with ONE stage's stored choice taken off one scene — what `base` is read from. */
function withoutChoice(widgets: readonly InvitationWidgetRow[], type: WidgetType, stage: LifecyclePhase): InvitationWidgetRow[] {
  return widgets.map((w) => (w.widget_type === type ? { ...w, config_json: configWithStageShow(w.config_json, { [stage]: null }) } : w));
}

/**
 * 🧩 A SCENE WITH NOTHING IN IT YET IS ASKED ABOUT AS IF IT WERE WRITTEN — for its own boxes and its own eye.
 *
 * With open browsing on (`events.website_open_browse`, the default for a new event) the page draws no EMPTY scene, so
 * `sceneOnStage` answers "not drawn" for it on every stage. Read straight into the table that made every box of an
 * empty row an empty box: a new couple's Love Story read "Hidden" on all five stages; a tick on one of them was
 * stored and the box came back unticked on the next render (the choice is `true`, the page still draws nothing), and
 * a second tap wrote nothing. And the eye's `base` said "not on this stage" for a scene the Maker's canvas was
 * drawing (the canvas fails OPEN on content, `makerStageList`: an empty scene keeps its place as a prompt), so
 * Remove stored "back to our pick" — nothing — and the scene was back at the next render. Measured 2026-10-11 on the
 * sample's rows through `buildMakerNavigatorData`.
 *
 * The approved prototype (`maker_what_guests_see_2026-10-10.html`, "What to bring is empty in this sample") draws an
 * empty row with ITS TICKS, dimmed, and says so under the name: *"Nothing written yet — guests will not see it."*
 * So: the boxes and the eye say where the scene STANDS (what a stage shows once it is written — the list the Maker
 * draws), and the row's `empty` says guests do not see it yet. Only the scene's OWN emptiness is lifted; every
 * other scene's facts are as the page has them.
 */
function asIfWritten<T extends Pick<GuestsSeeTableInput, 'content'>>(input: T, type: WidgetType): T {
  return input.content?.[type] === false ? { ...input, content: { ...input.content, [type]: true } } : input;
}

/**
 * 🧩 …AND A PALE TICK IS ONLY EVER WHERE THE MAKER HAS A PLACE TO WRITE IT (the re-walk of 2026-10-11, M08). Asked
 * "as if written", an empty scene was ticked on every stage a guest would meet it — including the three places a
 * scene is met OFF the stage's list: inside the Save-the-Date film, as the love story's prose, on the Day's Welcome.
 * Nothing is written, so those places draw nothing; and the Maker's canvas has no prompt there either (a prompt is
 * an empty scene IN the list — `makerStageList` `emptyOf`). So the table ticked three boxes whose stage showed the
 * couple nothing at all, beside others that showed "Add …". For a row with nothing written, each stage is one of:
 *
 *   · IN THE STAGE'S LIST            → a box, pale-ticked: the Maker's canvas draws the prompt to write it;
 *   · off the list, and a tick CAN put it in the list (the love story on The Day — its prose stand-in has nothing
 *     to tell)                       → an EMPTY box: ticking it adds the scene, and its prompt, to that stage;
 *   · off the list, and the list REFUSES it (`whyNotInStageList`): the gallery on a Save the Date its film leads
 *     (`stdShows` — the film carries it), the reminders and the dress code on The Day (`DAY_WELCOME_SCENES` —
 *     the Day's Welcome draws them for a guest, "never the Maker's canvas": `welcomePartsOnTheDay`)
 *                                    → a dash, with the row's own line. It is a box again once it is written.
 */
const OFF_LIST_ONLY: readonly string[] = ['stdShows', 'DAY_WELCOME_SCENES'];

function sceneRow(type: WidgetType, label: string, given: GuestsSeeTableInput): GuestsSeeRow | null {
  const row = given.widgets.find((w) => w.widget_type === type && !w.is_always_on);
  if (!row) return null;
  const empty = given.content?.[type] === false;
  const input = asIfWritten(given, type);
  const cells = GUESTS_SEE_COLUMNS.map((col): GuestsSeeCell => {
    if (col.stage === null) return { kind: 'locked', on: false, why: GUESTS_SEE_WORDS.replyScreens };
    const v = sceneOnStage({ ...input, stage: col.stage, reader: 'guest' }, type)!;
    if (v.notPossible) return { kind: 'dash', why: SCENE_DASH[`${type}:${col.stage}`] ?? v.notPossible.why };
    const bare = sceneOnStage({ ...input, widgets: withoutChoice(input.widgets, type, col.stage), stage: col.stage, reader: 'guest' }, type)!;
    if (empty) {
      const film = filmLeadsStage(given.widgets, col.stage, given.phasesEnabled ?? true, given.weddingOnlyParts);
      const refused = whyNotInStageList(row, { stage: col.stage, reader: 'guest', film });
      if (refused !== null && OFF_LIST_ONLY.includes(refused)) return { kind: 'dash', why: GUESTS_SEE_WORDS.emptyNote };
      /* Only the LIST counts while nothing is written: a place off it has nothing to draw. */
      return { kind: 'box', on: v.inList && v.drawn, ourPick: v.ourPick && bare.inList, base: bare.inList && bare.drawn, choice: v.choice };
    }
    return { kind: 'box', on: v.drawn, ourPick: v.ourPick, base: bare.drawn, choice: v.choice };
  });
  return { key: type, scene: type, write: type, label, note: null, empty, cells };
}

/** THE TABLE for one event — every cell read from `sceneOnStage`, or from the page's own gates for a fixed row. */
export function buildGuestsSeeTable(input: GuestsSeeTableInput): GuestsSeeTable {
  const groups: GuestsSeeGroup[] = GROUPS.map((g) => ({
    title: g.title,
    rows: g.rows.flatMap((r) => {
      const row = 'fixed' in r ? fixedRow(r.fixed, input) : sceneRow(r.scene, r.label, input);
      return row ? [row] : [];
    }),
  })).filter((g) => g.rows.length > 0);
  // The couple's own scenes — theirs to show on any stage, so they are rows too (named by their own heading).
  const own = input.widgets
    .filter((w) => isCustomSectionType(w.widget_type))
    .flatMap((w) => {
      const row = sceneRow(w.widget_type, sanitizeCustomSection(w.config_json).title || GUESTS_SEE_WORDS.ownScene, input);
      return row ? [row] : [];
    });
  if (own.length > 0) groups.push({ title: GUESTS_SEE_WORDS.ownScenes, rows: own });
  return { groups };
}

/**
 * 👁 WHAT THE MAKER'S EYE NEEDS, per stage and scene: is the scene in the stage's
 * list with NO choice stored for that stage (`base`), and the choice stored
 * (`choice`). The eye writes the same value the table does — the wanted state,
 * or `null` when the stage lists it that way anyway — so it asks `base` of the
 * LIST (what the canvas draws), never of a place off it: a love story hidden by
 * the event-wide eye is still told as prose, and "show" must bring the SCENE.
 */
export type StageEye = { base: boolean; choice: boolean | null };
export function buildStageEyes(input: GuestsSeeTableInput): Record<LifecyclePhase, Partial<Record<WidgetType, StageEye>>> {
  const out = { save_the_date: {}, rsvp: {}, event: {}, editorial: {} } as Record<LifecyclePhase, Partial<Record<WidgetType, StageEye>>>;
  for (const stage of Object.keys(out) as LifecyclePhase[]) {
    for (const w of input.widgets) {
      if (w.is_always_on) continue;
      /* The list the Maker DRAWS keeps an empty scene's place (`asIfWritten`) — so does the eye's `base`. */
      const written = asIfWritten(input, w.widget_type);
      const now = sceneOnStage({ ...written, stage, reader: 'guest' }, w.widget_type);
      const bare = sceneOnStage({ ...written, widgets: withoutChoice(input.widgets, w.widget_type, stage), stage, reader: 'guest' }, w.widget_type);
      if (now && bare) out[stage][w.widget_type] = { base: bare.inList, choice: now.choice };
    }
  }
  return out;
}
