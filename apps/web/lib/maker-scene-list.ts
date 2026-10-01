/**
 * THE MAKER'S SCENE LIST — what the navigator shows for one stage, in the order
 * the canvas draws it (owner 2026-09-25, verbatim: *"why does the slides not
 * follow the sequence alotted"*).
 *
 * 🔴 WHAT WAS WRONG. The navigator listed every hideable `invitation_widgets`
 * row in raw `display_order`, the same twelve on every stage. The canvas draws
 * something else: the page's own plan (`resolveSiteBodyPlan`) decides which
 * sections a stage has, a fixed masthead leads, the entourage follows, and a
 * section with nothing in it renders nothing at all. So "3 · Schedule" in the
 * navigator was the first thing under the names on the canvas, and Special
 * message, What to bring and an empty love story were listed but never drawn.
 *
 * 🔑 THE FIX IS TO ASK THE SAME RESOLVER THE PAGE ASKS. This module calls
 * `resolveSiteBodyPlan` with the canvas's own identity and then applies, per
 * section, the SAME null-render rules the anonymous widget dispatcher applies
 * (`app/[slug]/_components/public-hideable-widget.tsx`). Every rule below names
 * the line it mirrors; `the-navigator-follows-the-page.test.ts` pins the
 * result to the plan's order for all four stages.
 *
 * WHY "ANONYMOUS": the Maker's canvas is `/<slug>?editor=1`, opened by a host
 * who holds no guest cookie, which `page.tsx` renders through the anonymous
 * tree. That is exactly the page the canvas shows, so it is exactly the list.
 * Sections only an invited guest's own link can draw (their greeting, their
 * QR, their RSVP, their event details, their tagged photos) are named in the
 * fold, with that reason, instead of being listed as if the canvas drew them.
 *
 * Pure: no React, no DB, no cookies — the unit suite runs it directly.
 */
import { resolveSiteBodyPlan } from './site-body-plan';
import {
  WIDGET_PHASES,
  widgetInPhase,
  openBrowseSectionVisible,
  resolveWidgetTerminalState,
  isTerminalRenderable,
  WIDGET_CATALOG_BY_TYPE,
  type InvitationWidgetRow,
  type LifecyclePhase,
  type WidgetType,
} from './invitation-widgets';
import { PUBLIC_WIDGET_ALLOWLIST } from './public-widget-allowlist';
import { CUSTOM_SECTION_TYPES, isCustomSectionType, customSectionEditorLabel } from './custom-sections';
import type { WeddingOnlyParts } from './wedding-only-parts';
import { PUBLIC_STAGE_LABELS, PUBLIC_STAGE_ORDER } from './public-site-stage-labels';
import {
  postEventSceneDrawn,
  type OpenUpKind,
  type PostEventListRow,
  type PostEventSceneStatus,
  type PostEventSectionSwitch,
} from './post-event-scenes';
import { postEventRunKey } from './post-event-draft';
import { sanitizeHubCanvas } from './hub-canvas';
import type { SceneTemplateId } from './scene-templates';
import { stageShowsEntourage } from './stage-scenes';
import { welcomeParts } from './invitation-welcome';

/** The sections that are always in their place on a stage — never dragged. */
export type MakerFixedKey =
  | 'film'
  | 'editorial'
  | 'hero'
  | 'greeting'
  | 'pass'
  | 'rsvp'
  /* 🏠 The Invitation's Welcome page (owner 2026-09-30 — `lib/invitation-welcome.ts`). */
  | 'look'
  | 'gifts'
  | 'entourage'
  | 'story'
  /* 🎨 The day's own parts (owner 2026-09-29, "every scene … three styles"):
     each guest meets their own, so the Maker draws a stand-in and offers its
     Style — the key is the part's registry type (`lib/fixed-scene-styles.ts`). */
  | 'find_your_seat'
  | 'photos_of_you'
  | 'announcements'
  | 'live_hub';

export type MakerTile =
  | {
      kind: 'fixed';
      /** The canvas marker key (`data-maker-section`). */
      key: `f:${MakerFixedKey}`;
      fixed: MakerFixedKey;
      label: string;
      /** The ⓘ — why it cannot be moved. */
      why: string;
    }
  | {
      kind: 'scene';
      key: `w:${WidgetType}`;
      widgetId: string;
      type: WidgetType;
      label: string;
      /**
       * 🧩 EMPTY — the scene has nothing in it yet. Guests are never shown it;
       * the Maker draws it in place with this prompt so the couple can tap it
       * and fill it (owner 2026-09-27). Absent when the scene has content.
       */
      empty?: string;
    }
  | {
      /**
       * 📖 A POST EVENT SCENE (Event Hub Maker Phase 8, `lib/post-event-scenes.ts`).
       * Post Event's body is the story the Maker wrote after the day, one scene
       * per part; when the compiled list is handed in, its scenes take the place
       * of the single "The story after the day" tile.
       *
       * Listed in the PAGE's order, and listed even when the page does not draw
       * it — a skipped, hidden or optional scene is shown AS SUCH (`drawn:
       * false` + its `note`), never as an empty tile and never silently dropped.
       */
      kind: 'post-event';
      key: `p:${string}`;
      /** The canvas marker to scroll to — null when the page does not draw it. */
      anchor: `p:${string}` | null;
      scene: string;
      label: string;
      status: PostEventSceneStatus;
      hidden: boolean;
      /** True only when guests meet it: filled AND not hidden. */
      drawn: boolean;
      /** 1-based among the scenes guests meet; null for a skipped / hidden / optional one. */
      position: number | null;
      template: SceneTemplateId | null;
      source: string;
      note: string | null;
      open: OpenUpKind | null;
      pinned: boolean;
      /** The story switch that shows / hides it (null = it cannot be hidden from here). */
      switchKey: PostEventSectionSwitch | null;
      /** 🎬 The run block it moves with (`postEventRunKey`) — null when its place is fixed. */
      runKey: string | null;
    };

export type MakerFolded = {
  key: `w:${WidgetType}`;
  /** Null for a guest-only always-on section (it has no row the navigator writes). */
  widgetId: string | null;
  type: WidgetType;
  label: string;
  /** The ⓘ — why this stage does not draw it. */
  reason: string;
  /** The couple hid it — the eye can bring it back from here. */
  hiddenByCouple: boolean;
};

export type MakerStageList = {
  stage: LifecyclePhase;
  shown: MakerTile[];
  folded: MakerFolded[];
};

/**
 * THE NAVIGATOR'S WORDS (owner 2026-09-25: *"Setnayan account explainer"* and
 * *"Spec…"* read like internal names).
 *
 * The catalogue's host labels stay the base — "Camera cues", "Photos you add"
 * and "Each guest's own photos" are an EARLIER owner rename that keeps three
 * photo features from being one word apart (`the-four-photo-names.test.ts`),
 * and this does not undo it. What changes:
 *   · `tier_comparison` — "Setnayan account explainer" was an internal
 *     description of a section guests read as **"Two ways to celebrate"**, so
 *     it is called that.
 *   · The always-on sections, which the catalogue names by their parts
 *     ("Hero", "QR card"), are named for what a guest sees.
 * "Spec…" was never the name — it was "Special message" cut off by a one-line
 * tile. The label now wraps instead of truncating.
 */
export const MAKER_SCENE_LABEL: Partial<Record<WidgetType, string>> = {
  hero: 'Names & date',
  greeting: 'Personal greeting',
  qr_card: "Guest's ticket",
  tier_comparison: 'Two ways to celebrate',
};

export const MAKER_FIXED_LABEL: Record<MakerFixedKey, { label: string; why: string }> = {
  film: { label: 'Save-the-Date film', why: 'Always first on the Save the Date — it plays before the page.' },
  editorial: { label: 'The story after the day', why: 'Always first after the day — the story leads the page.' },
  hero: { label: 'Names & date', why: 'Always here on this stage — your names and date open the page.' },
  /* 👤 THE GUEST-LINK SCENES (owner 2026-09-27): drawn in the Maker in place,
     with "Your guest" — never sample content — so the couple sees where each
     guest's own part sits on the page. */
  greeting: { label: 'Personal greeting', why: 'Each guest sees their own — their name, and how they are joining you.' },
  pass: { label: "Guest's ticket", why: 'Each guest sees their own Digital ticket and QR code.' },
  rsvp: { label: 'RSVP', why: 'Each guest replies from their own link.' },
  look: { label: "Guest's look", why: 'Each guest sees what they wear — their role, their colours, your Do’s & Don’ts.' },
  gifts: { label: 'E-Gifts', why: 'Every guest sees your E-Gifts here once a gift method is on.' },
  entourage: { label: 'The entourage', why: 'Always here on this stage, after your sections — it lists everyone with a role.' },
  story: { label: 'Our story', why: 'Always here on this stage, after the entourage — written from your love story.' },
  find_your_seat: { label: 'Find your seat', why: 'Each guest sees their own table here, once your seating plan is published.' },
  photos_of_you: { label: "Each guest's own photos", why: 'Each guest sees the photos they are in, as they are taken.' },
  announcements: { label: 'Announcements', why: 'Your messages to guests appear at the top of the page once you send one.' },
  live_hub: { label: 'Live hub', why: 'Your live stream and live photo wall, when you have them on the day.' },
};

/**
 * 🎨 THE DAY'S OWN PARTS — on the stages where guests meet them. Listed after
 * the entourage, in the order the Maker's canvas draws their stand-ins
 * (`maker-fixed-parts.tsx`), so the navigator and the canvas stay one list.
 */
export const MAKER_DAY_PARTS: ReadonlyArray<{ key: MakerFixedKey; stages: readonly LifecyclePhase[] }> = [
  { key: 'announcements', stages: ['rsvp', 'event'] },
  /* 📱 In the order of The Day's tabs (owner 2026-09-30, Live · Welcome ·
     Camera · Gallery · Me): the live hub is Live's, the guest's table is their
     Welcome's, their photos are the Gallery's — so the navigator's tab headers
     fall between them, never across them (`lib/maker-navigator-tabs.ts`). */
  { key: 'live_hub', stages: ['event'] },
  { key: 'find_your_seat', stages: ['event'] },
  { key: 'photos_of_you', stages: ['event'] },
];

/** The day's parts this stage lists — the canvas draws exactly these, in this order. */
export function makerDayPartsOn(stage: LifecyclePhase): MakerFixedKey[] {
  return MAKER_DAY_PARTS.filter((p) => p.stages.includes(stage)).map((p) => p.key);
}

/**
 * 🔒 WHERE A FIXED SECTION IS EDITED (owner 2026-09-25: *"if not editable then
 * nothing to edit but the scene must be there"*). Each fixed section either
 * opens a Maker tool, or has nothing to edit in the Maker and says where it
 * comes from — never a tile that silently does nothing when tapped.
 */
export const MAKER_FIXED_TOOL: Partial<Record<MakerFixedKey, 'hero' | 'reveal' | 'post-event' | 'love-story' | 'rsvp-page'>> = {
  hero: 'hero',
  rsvp: 'rsvp-page',
  film: 'reveal',
  editorial: 'post-event',
  story: 'love-story',
};

/**
 * THE EDITOR EACH TOOL IS, BY NAME — for the scene panel's one line and one
 * button (owner 2026-09-27: *"it should just open the right tab and show this
 * scene is on Hero editor, Open Hero editor"*). A tap on the scene only selects
 * it; only this button leaves the stage (*"dont jump directly to the menu
 * because they can be just checking how things flow"*).
 */
export const MAKER_TOOL_EDITOR_NAME: Record<NonNullable<(typeof MAKER_FIXED_TOOL)[MakerFixedKey]>, string> = {
  hero: 'Hero',
  reveal: 'Reveal',
  'post-event': 'Post Event',
  'love-story': 'Love Story',
  'rsvp-page': 'RSVP',
};

/** For a fixed section with no Maker tool: what fills it, and the page that changes it. */
export type MakerFixedSourcePage = 'guests' | 'studio/mood-board' | 'pabuya' | 'seating' | 'galleries' | 'schedule' | 'live';
export const MAKER_FIXED_SOURCE: Partial<
  Record<MakerFixedKey, { text: string; page: MakerFixedSourcePage; link: string; from: string }>
> = {
  entourage: {
    // 🎨 Its STYLE is picked in this panel (2026-09-29); only its names come from elsewhere.
    text: 'The names come from your guest list — the roles you give people there.',
    page: 'guests',
    link: 'Open your guest list',
    from: 'your guest list',
  },
  look: {
    text: 'Each guest sees their own look — from your Mood Board and your dress code.',
    page: 'studio/mood-board',
    link: 'Open your Mood Board',
    from: 'your Mood Board',
  },
  gifts: {
    text: 'Guests see the ways to send you a gift that you switch on.',
    page: 'pabuya',
    link: 'Open E-Gifts',
    from: 'your E-Gifts',
  },
  /* 🎨 The day's own parts: their Style is picked in the panel; what fills them
     comes from here. */
  find_your_seat: { text: 'Each table comes from your seating plan.', page: 'seating', link: 'Open your seating plan', from: 'your seating plan' },
  photos_of_you: { text: 'Filled from the photos taken on the day.', page: 'galleries', link: 'Open your galleries', from: 'the photos taken on the day' },
  announcements: { text: 'You send them from your schedule on the day.', page: 'schedule', link: 'Open your schedule', from: 'your schedule' },
  live_hub: { text: 'Filled from your live stream and your live photo wall.', page: 'live', link: 'Open your live wall', from: 'your live settings' },
  greeting: {
    text: 'Each guest sees their own greeting — written from your guest list.',
    page: 'guests',
    link: 'Open your guest list',
    from: 'your guest list',
  },
  pass: {
    text: 'Each guest sees their own Digital ticket and QR — made from your guest list.',
    page: 'guests',
    link: 'Open your guest list',
    from: 'your guest list',
  },
};

/** The label a navigator row wears. A template scene is named by its template upstream. */
export function makerSceneLabel(type: WidgetType): string {
  if (isCustomSectionType(type)) return customSectionEditorLabel(type);
  return MAKER_SCENE_LABEL[type] ?? WIDGET_CATALOG_BY_TYPE[type]?.label ?? type;
}

/** Types the anonymous dispatcher never draws — they need an invited guest. */
const GUEST_ONLY: ReadonlySet<WidgetType> = new Set<WidgetType>(['event_details', 'your_photos']);
const ALWAYS_ON_GUEST_ONLY: readonly WidgetType[] = ['greeting', 'qr_card', 'rsvp'];

/**
 * 🧩 WHAT AN EMPTY SCENE SAYS IN THE MAKER — its placeholder's one line.
 *
 * Owner, 2026-09-27, measured on his own page: Love Story, Venue and Message
 * were empty, so they vanished from the editing canvas into "Not shown", and
 * "I cannot edit the body". In the Maker an empty scene now keeps its place —
 * on the canvas and in the list — drawn with this prompt. Guests still never
 * see an empty scene (`guestView`, #6009); "Not shown" is only for scenes the
 * couple chose to hide, or that this stage leaves out.
 */
export function makerEmptyPrompt(type: WidgetType): string {
  const reason = EMPTY_REASON[type];
  if (reason) return reason.replace(/^Empty — /, '').replace(/^./, (c) => c.toUpperCase());
  if (isCustomSectionType(type)) return 'Write this scene.';
  return 'Add its content.';
}

/** The scenes whose emptiness the Maker draws as a placeholder instead of dropping. */
export const MAKER_EMPTY_DRAWN: ReadonlySet<WidgetType> = new Set<WidgetType>([
  'schedule',
  'venue_map',
  'special_message',
  'what_to_bring',
  'our_photos',
  'our_love_story',
  'countdown',
]);

/** Does the Maker draw this empty scene as a placeholder? */
export function makerDrawsEmpty(type: WidgetType): boolean {
  return MAKER_EMPTY_DRAWN.has(type) || isCustomSectionType(type);
}

const EMPTY_REASON: Partial<Record<WidgetType, string>> = {
  schedule: 'Empty — add the moments of your day in Schedule.',
  venue_map: 'Empty — add your venue.',
  special_message: 'Empty — write your message.',
  what_to_bring: 'Empty — add reminders for your guests.',
  our_photos: 'Empty — add your photos.',
  our_love_story: 'Empty — add your story.',
  countdown: 'Needs your date.',
};

export type MakerStageInput = {
  stage: LifecyclePhase;
  /** The draft laid over the live rows — what the canvas renders. */
  widgets: readonly InvitationWidgetRow[];
  openBrowse: boolean;
  weddingOnlyParts?: Partial<WeddingOnlyParts>;
  /** `computeSectionContentMap` — the page's own emptiness signals. */
  content: Partial<Record<WidgetType, boolean>>;
  /** The event type's register (a funeral draws no countdown). */
  solemn: boolean;
  /** A hero photo or video is set (the masthead then sits only on the Invitation-shaped body). */
  hasHeroMedia: boolean;
  /** Someone holds an entourage role (`EntourageSection` draws nothing otherwise). */
  hasEntourage: boolean;
  /** `ourStoryRenders(love_story)` — the SAME test `<OurStory>` makes. */
  storyRenders: boolean;
  /** The countdown retires once the day arrives. */
  countdownPast?: boolean;
  /**
   * 🎨 List the day's own parts (`MAKER_DAY_PARTS`) — true from the Maker, whose
   * canvas draws their stand-ins in the same place. Absent = not listed.
   */
  dayParts?: boolean;
  /**
   * 📖 Post Event's compiled scenes, in the page's order
   * (`postEventSceneList`). Absent/empty → the one "story after the day" tile.
   */
  postEvent?: readonly PostEventListRow[] | null;
  /**
   * 🎨 Whether a Post Event scene has styles in the registry (so a waiting one is
   * drawn on the couple's canvas). Handed in by the server-side caller
   * (`maker-navigator-data.ts` → `resolvePostEventStyle`) so this file — which
   * the Maker's client also imports — never loads the style registry.
   * Absent = no scene is styled.
   */
  postEventStyled?: (sceneKey: string) => boolean;
};

/**
 * Post Event's rows → navigator tiles. A scene the page draws scrolls to its
 * canvas marker: the chapters after the first share the chapters block's
 * marker, and Before the day sits on the cover's page. A scene the page does
 * not draw has no anchor — the tile still says what it is and why.
 */
function postEventTiles(rows: readonly PostEventListRow[], styled: (sceneKey: string) => boolean = () => false): MakerTile[] {
  return rows.map((r) => {
    const drawn = postEventSceneDrawn(r.status, r.hidden);
    // 🛤 The Road to the Day is its own scene (with its own marker) since 2026-09-29.
    const anchorScene = r.block === 'chapters' ? 'ch-1' : r.key;
    /* 🕰 A waiting scene drawn in its style ALSO stands on the couple's canvas —
       its layout with the line that says what fills it (never for a guest) —
       so its tile scrolls there too. */
    const onCanvas = drawn || (r.status === 'waiting' && !r.hidden && styled(r.key));
    return {
      kind: 'post-event',
      key: `p:${r.key}`,
      anchor: onCanvas ? (`p:${anchorScene}` as const) : null,
      scene: r.key,
      label: r.name,
      status: r.status,
      hidden: r.hidden,
      drawn,
      position: r.position === null ? null : r.position + 1,
      template: r.template,
      source: r.source,
      note: r.note,
      open: r.open,
      pinned: r.pin !== null,
      switchKey: r.switch,
      runKey: postEventRunKey(r.key),
    };
  });
}

/** Where a section DOES show, for the ⓘ: "Shows on the Invitation and On the Day". */
function showsOn(type: WidgetType): string {
  const stages = PUBLIC_STAGE_ORDER.filter((s) => (WIDGET_PHASES[type] ?? []).includes(s));
  if (stages.length === 0) return 'Not shown on any stage.';
  const names = stages.map((s) => (s === 'rsvp' ? `the ${PUBLIC_STAGE_LABELS[s]}` : PUBLIC_STAGE_LABELS[s]));
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `Shows on ${list}.`;
}

/**
 * Does the anonymous dispatcher draw this widget? Mirrors
 * `PublicHideableWidgetBody` case by case; `null` = it draws, a string = why not.
 */
function whyNotDrawn(w: InvitationWidgetRow, input: MakerStageInput): string | null {
  const t = w.widget_type;
  const has = (k: WidgetType) => input.content[k] !== false;
  const live = input.stage === 'event'; // `?phase=event` forces dayOfPhase 'live' (page.tsx)
  switch (t) {
    case 'countdown':
      // `event.event_date && !words.solemn ? <CountdownWidget/>` — and the widget retires once past.
      if (input.solemn) return 'Not shown for this kind of event.';
      if (input.countdownPast && has('countdown')) return 'Retired — the day has arrived.';
      return null;
    case 'schedule':
      // The page draws the schedule on the day too (owner 2026-09-27, "YES TO
      // ALL" (2), `public-hideable-widget.tsx`); empty → the Maker's placeholder.
      void live;
      return null;
    case 'our_love_story':
      // 📖 A love story asks how TWO people met (`resolveWeddingOnlyParts`
      // love_story). A birthday, a wake, a corporate event has no answer, so the
      // scene is not part of it at all — never an "Empty — add your story."
      if (input.weddingOnlyParts?.love_story === false) return NOT_THIS_TYPE;
      return null;
    case 'special_message':
    case 'what_to_bring':
    case 'our_photos':
    case 'venue_map':
      // Empty → drawn in the Maker as a placeholder (`emptyOf`), never folded.
      return null;
    case 'dress_code':
    case 'photo_moments':
    case 'tier_comparison':
      // These draw a polite "closer to the day" card even when empty.
      return null;
    default:
      if (isCustomSectionType(t)) return null;
      return GUEST_ONLY.has(t) ? "Only on each guest's own link." : null;
  }
}

/** The reason a scene this event TYPE never has is left out — dropped from the fold too. */
const NOT_THIS_TYPE = 'Not part of this kind of event.';

/** The prompt an empty scene wears in the Maker, or undefined when it has content. */
function emptyOf(w: InvitationWidgetRow, input: MakerStageInput): string | undefined {
  if (!makerDrawsEmpty(w.widget_type)) return undefined;
  return input.content[w.widget_type] === false ? makerEmptyPrompt(w.widget_type) : undefined;
}

/**
 * 🧾 "TWO WAYS TO CELEBRATE" IS NOT ON THE INVITATION OR THE DAY (owner
 * 2026-09-26, replaced by the post-RSVP "Save to my account"; owner review
 * 2026-09-27: the Maker must show what guests see). Guests never meet it there,
 * so neither the Maker's canvas nor this list shows it. Post Event keeps it —
 * that is a separate owner decision. ONE rule, read by the page and this list.
 */
export function widgetsGuestsMeet<T extends { widget_type: string; config_json?: unknown }>(
  widgets: readonly T[],
  stage: LifecyclePhase,
): T[] {
  // 🗂 Since "EACH STAGE DOES ONE JOB" (owner 2026-09-27) the pitch is on NO
  // stage — Post Event included (`STAGE_SCENES`, `lib/stage-scenes.ts`).
  // 🎞 A scene seeded from one of Post Event's presets can only be written
  // AFTER something happened (strategy §5) — it is on Post Event and nowhere
  // else, though it is one of the six the couple's own scenes share.
  return widgets.filter(
    (w) =>
      w.widget_type !== 'tier_comparison' &&
      (stage === 'editorial' || !isCustomSectionType(w.widget_type) || !sanitizeHubCanvas(w.config_json).postEventPreset),
  );
}

export function makerStageList(input: MakerStageInput): MakerStageList {
  const { stage, openBrowse } = input;
  const widgets = widgetsGuestsMeet(input.widgets, stage);
  const plan = resolveSiteBodyPlan({
    identity: 'anonymous',
    phasesEnabled: true,
    lifecyclePhase: stage,
    stdFilm: false,
    isSample: false,
    hasHeroMedia: input.hasHeroMedia,
    hasBgMusic: false,
    liveMediaPublic: false,
    weddingOnlyParts: input.weddingOnlyParts,
    widgets,
    openBrowse,
    // The Maker's canvas fails OPEN on content (`site-body.tsx`), so an empty
    // scene keeps its place and is drawn as a placeholder there.
    content: {},
  });

  const fixed = (k: MakerFixedKey): MakerTile => ({
    kind: 'fixed',
    key: `f:${k}`,
    fixed: k,
    label: MAKER_FIXED_LABEL[k].label,
    why: MAKER_FIXED_LABEL[k].why,
  });

  const shown: MakerTile[] = [];
  // The body's own lead (site-body.tsx `phasedBody`): the editorial cover
  // after the day, the film on the Save the Date.
  // 📖 Post Event (Maker Phase 8): the story's own scenes, when the compiled
  // list was handed in — otherwise the one tile that stands for all of it.
  if (plan.body === 'editorial') {
    if (input.postEvent && input.postEvent.length > 0) shown.push(...postEventTiles(input.postEvent, input.postEventStyled));
    else shown.push(fixed('editorial'));
  }
  if (plan.body === 'save_the_date') shown.push(fixed('film'));
  // The masthead: the full-bleed banner (normal body + hero media) or the
  // text masthead inside the body (no hero media).
  if (plan.anonymousHeroBanner || !input.hasHeroMedia) shown.push(fixed('hero'));
  // 👤 The guest-link scenes, in place (`site-body.tsx` draws them in the Maker
  // right after the masthead, with "Your guest").
  if (plan.greetingShouldRender) shown.push(fixed('greeting'));
  if (plan.qrCardShouldRender) shown.push(fixed('pass'));
  if (plan.rsvpShouldRender) shown.push(fixed('rsvp'));

  // 🏠 THE WELCOME PAGE — after the reply, before Details, in the order the
  // canvas draws it (`GuestWelcome`, asked through the SAME `welcomeParts`):
  // the guest's look · Reminders (the `what_to_bring` scene, which leaves
  // Details for it) · E-Gifts.
  const drawable = plan.publicSafeWidgets.filter((w) => whyNotDrawn(w, input) === null);
  const welcome = welcomeParts({
    stage,
    bodyNormal: plan.body === 'normal',
    scenes: drawable.map((w) => w.widget_type),
    identified: false,
    reminders: null,
    giftHref: null,
    maker: true,
  });
  const drawn = new Set<string>();
  const sceneTile = (w: InvitationWidgetRow): MakerTile => {
    drawn.add(w.widget_id);
    const empty = emptyOf(w, input);
    return {
      kind: 'scene',
      key: `w:${w.widget_type}`,
      widgetId: w.widget_id,
      type: w.widget_type,
      label: makerSceneLabel(w.widget_type),
      ...(empty ? { empty } : {}),
    };
  };
  for (const part of welcome) {
    if (part === 'look') shown.push(fixed('look'));
    else if (part === 'gifts') shown.push(fixed('gifts'));
    else {
      const row = drawable.find((w) => w.widget_type === 'what_to_bring');
      if (row) shown.push(sceneTile(row));
    }
  }

  for (const w of drawable) {
    if (!drawn.has(w.widget_id)) shown.push(sceneTile(w));
  }
  // The entourage is not the Save the Date's job (`STAGE_FIXED`).
  if (input.hasEntourage && stageShowsEntourage(stage)) shown.push(fixed('entourage'));
  // 🎨 The day's own parts, where the normal body draws them (their stand-ins sit
  // right after the entourage on the Maker's canvas).
  if (input.dayParts && plan.body === 'normal') for (const k of makerDayPartsOn(stage)) shown.push(fixed(k));
  // 📖 The page draws the love story ONCE (site-body `storySceneShown`): with the
  // "Our love story" scene on the page, the prose section is not drawn.
  if (
    input.storyRenders &&
    input.weddingOnlyParts?.love_story !== false &&
    !drawable.some((w) => w.widget_type === 'our_love_story')
  )
    shown.push(fixed('story'));

  // ── The fold: every other section, with the reason this stage leaves it out.
  const folded: MakerFolded[] = [];
  const hideable = [...widgets]
    .filter((w) => !w.is_always_on)
    .sort((a, b) => a.display_order - b.display_order);
  for (const w of hideable) {
    if (drawn.has(w.widget_id)) continue;
    const t = w.widget_type;
    const visible = openBrowse ? openBrowseSectionVisible(w) : w.is_visible;
    let reason: string;
    if (!visible) reason = 'Hidden from guests — tap the eye to show it.';
    else if (GUEST_ONLY.has(t)) reason = "Only on each guest's own link.";
    else if (!openBrowse && !widgetInPhase(t, stage)) reason = `Not part of this stage. ${showsOn(t)}`;
    else if (!PUBLIC_WIDGET_ALLOWLIST.includes(t)) reason = "Only on each guest's own link.";
    else if (openBrowse && !isTerminalRenderable(resolveWidgetTerminalState(t, stage))) reason = 'Retired after the day.';
    else if (openBrowse && w.audience === 'guests_only') reason = 'Only for invited guests (set to guests only).';
    else reason = whyNotDrawn(w, input) ?? 'Not drawn on this stage.';
    // A scene this event type never has is not "folded" — it is not there.
    if (reason === NOT_THIS_TYPE) continue;
    folded.push({ key: `w:${t}`, widgetId: w.widget_id, type: t, label: makerSceneLabel(t), reason, hiddenByCouple: !visible });
  }
  const listedGuestScene: Partial<Record<WidgetType, boolean>> = {
    greeting: plan.greetingShouldRender,
    qr_card: plan.qrCardShouldRender,
    rsvp: plan.rsvpShouldRender,
  };
  for (const t of ALWAYS_ON_GUEST_ONLY) {
    const row = widgets.find((w) => w.widget_type === t);
    if (!row) continue;
    if (listedGuestScene[t]) continue; // drawn in place in the Maker, not under Not shown
    folded.push({ key: `w:${t}`, widgetId: null, type: t, label: makerSceneLabel(t), reason: "Only on each guest's own link — every invited guest sees their own.", hiddenByCouple: false });
  }

  // ↕ Every scene drags within its stage — on both paths, open browsing
  // included — and the stage keeps the couple's order (owner 2026-09-27,
  // `config_json.stage_order`, read by the plan above). `STAGE_SCENES` is only
  // the order before anybody drags.
  return { stage, shown, folded };
}

/** All four stages at once — the server hands the Maker this, and the stage switch reads it. */
export function makerStageLists(input: Omit<MakerStageInput, 'stage'>): Record<LifecyclePhase, MakerStageList> {
  return {
    save_the_date: makerStageList({ ...input, stage: 'save_the_date' }),
    rsvp: makerStageList({ ...input, stage: 'rsvp' }),
    event: makerStageList({ ...input, stage: 'event' }),
    editorial: makerStageList({ ...input, stage: 'editorial' }),
  };
}

/**
 * A drag in the navigator moves a scene past the shown scenes, but the write
 * (`moveWidgetUp/Down`) swaps it with its neighbour in the FULL hideable order,
 * where hidden and off-stage rows sit in between. This turns "drop X before the
 * shown scene at `to`" into the signed number of single swaps in that full
 * order — the same N-step chain the navigator already posts.
 *
 * `fullOrder` is the STAGE's whole list — every section on it, hidden and
 * guest-only ones included, in the stage's (drafted) order: `stageRowOrder`
 * (`lib/stage-scenes.ts`), the same list the move action swaps in.
 */
export function swapsForDrop(fullOrder: readonly string[], movingId: string, beforeId: string | null): number {
  const from = fullOrder.indexOf(movingId);
  if (from < 0) return 0;
  const rest = fullOrder.filter((id) => id !== movingId);
  const target = beforeId === null ? rest.length : rest.indexOf(beforeId);
  if (target < 0) return 0;
  return target - from;
}

/**
 * "+ ADD A SCENE" — may a scene of the couple's own be added to this stage?
 * The ONE place the Maker asks it (DECISION_LOG 2026-09-27). Read from
 * `WIDGET_PHASES`, where a scene of their own sits on EVERY stage today (and
 * stays so under "EACH STAGE DOES ONE JOB": after the stage's own scenes, in
 * the couple's order). When a stage stops taking them, this answers false and
 * the ＋ is not offered there.
 */
export function stageTakesOwnScenes(stage: LifecyclePhase): boolean {
  return CUSTOM_SECTION_TYPES.some((t) => WIDGET_PHASES[t].includes(stage));
}
