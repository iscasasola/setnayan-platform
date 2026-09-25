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
import { isCustomSectionType, customSectionEditorLabel } from './custom-sections';
import type { WeddingOnlyParts } from './wedding-only-parts';
import { PUBLIC_STAGE_LABELS, PUBLIC_STAGE_ORDER } from './public-site-stage-labels';
import type { OpenUpKind, PostEventListRow, PostEventSceneStatus } from './post-event-scenes';
import type { SceneTemplateId } from './scene-templates';

/** The sections that are always in their place on a stage — never dragged. */
export type MakerFixedKey = 'film' | 'editorial' | 'hero' | 'entourage' | 'story';

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
  /** Open browsing orders sections by their kind, not by the couple's order,
   *  so dragging cannot change what guests see — the navigator says so. */
  orderIsAutomatic: boolean;
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
  qr_card: "Guest's QR pass",
  tier_comparison: 'Two ways to celebrate',
};

export const MAKER_FIXED_LABEL: Record<MakerFixedKey, { label: string; why: string }> = {
  film: { label: 'Save-the-Date film', why: 'Always first on the Save the Date — it plays before the page.' },
  editorial: { label: 'The story after the day', why: 'Always first after the day — the story leads the page.' },
  hero: { label: 'Names & date', why: 'Always here on this stage — your names and date open the page.' },
  entourage: { label: 'The entourage', why: 'Always here on this stage, after your sections — it lists everyone with a role.' },
  story: { label: 'Our story', why: 'Always here on this stage, after the entourage — written from your love story.' },
};

/** The label a navigator row wears. A template scene is named by its template upstream. */
export function makerSceneLabel(type: WidgetType): string {
  if (isCustomSectionType(type)) return customSectionEditorLabel(type);
  return MAKER_SCENE_LABEL[type] ?? WIDGET_CATALOG_BY_TYPE[type]?.label ?? type;
}

/** Types the anonymous dispatcher never draws — they need an invited guest. */
const GUEST_ONLY: ReadonlySet<WidgetType> = new Set<WidgetType>(['event_details', 'your_photos']);
const ALWAYS_ON_GUEST_ONLY: readonly WidgetType[] = ['greeting', 'qr_card', 'rsvp'];

const EMPTY_REASON: Partial<Record<WidgetType, string>> = {
  schedule: 'Empty — add the moments of your day in Schedule.',
  venue_map: 'Empty — add your venue.',
  special_message: 'Empty — write your message.',
  what_to_bring: 'Empty — add what guests should bring.',
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
   * 📖 Post Event's compiled scenes, in the page's order
   * (`postEventSceneList`). Absent/empty → the one "story after the day" tile.
   */
  postEvent?: readonly PostEventListRow[] | null;
};

/**
 * Post Event's rows → navigator tiles. A scene the page draws scrolls to its
 * canvas marker: the chapters after the first share the chapters block's
 * marker, and Before the day sits on the cover's page. A scene the page does
 * not draw has no anchor — the tile still says what it is and why.
 */
function postEventTiles(rows: readonly PostEventListRow[]): MakerTile[] {
  return rows.map((r) => {
    const drawn = r.status === 'auto' && !r.hidden;
    const anchorScene = r.block === 'chapters' ? 'ch-1' : r.key === 'before' ? 'cover' : r.key;
    return {
      kind: 'post-event',
      key: `p:${r.key}`,
      anchor: drawn ? (`p:${anchorScene}` as const) : null,
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
      if (!has('countdown')) return EMPTY_REASON.countdown!;
      if (input.countdownPast) return 'Retired — the day has arrived.';
      return null;
    case 'schedule':
      // `!isLive && scheduleBlocks.length > 0`
      if (live) return 'On the day itself the page leaves it out.';
      return has('schedule') ? null : EMPTY_REASON.schedule!;
    case 'special_message':
    case 'what_to_bring':
    case 'our_photos':
    case 'our_love_story':
    case 'venue_map':
      return has(t) ? null : (EMPTY_REASON[t] ?? 'Empty.');
    case 'dress_code':
    case 'photo_moments':
    case 'tier_comparison':
      // These draw a polite "closer to the day" card even when empty.
      return null;
    default:
      if (isCustomSectionType(t)) return has(t) ? null : 'Empty — write this scene.';
      return GUEST_ONLY.has(t) ? "Only on each guest's own link." : null;
  }
}

export function makerStageList(input: MakerStageInput): MakerStageList {
  const { stage, widgets, openBrowse } = input;
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
    content: input.content,
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
    if (input.postEvent && input.postEvent.length > 0) shown.push(...postEventTiles(input.postEvent));
    else shown.push(fixed('editorial'));
  }
  if (plan.body === 'save_the_date') shown.push(fixed('film'));
  // The masthead: the full-bleed banner (normal body + hero media) or the
  // text masthead inside the body (no hero media).
  if (plan.anonymousHeroBanner || !input.hasHeroMedia) shown.push(fixed('hero'));

  const drawn = new Set<string>();
  for (const w of plan.publicSafeWidgets) {
    if (whyNotDrawn(w, input) !== null) continue;
    drawn.add(w.widget_id);
    shown.push({ kind: 'scene', key: `w:${w.widget_type}`, widgetId: w.widget_id, type: w.widget_type, label: makerSceneLabel(w.widget_type) });
  }
  if (input.hasEntourage) shown.push(fixed('entourage'));
  if (input.storyRenders) shown.push(fixed('story'));

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
    folded.push({ key: `w:${t}`, widgetId: w.widget_id, type: t, label: makerSceneLabel(t), reason, hiddenByCouple: !visible });
  }
  for (const t of ALWAYS_ON_GUEST_ONLY) {
    const row = widgets.find((w) => w.widget_type === t);
    if (!row) continue;
    folded.push({ key: `w:${t}`, widgetId: null, type: t, label: makerSceneLabel(t), reason: "Only on each guest's own link — every invited guest sees their own.", hiddenByCouple: false });
  }

  return { stage, shown, folded, orderIsAutomatic: openBrowse };
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
 * `fullOrder` is every hideable widget id in (drafted) display order.
 */
export function swapsForDrop(fullOrder: readonly string[], movingId: string, beforeId: string | null): number {
  const from = fullOrder.indexOf(movingId);
  if (from < 0) return 0;
  const rest = fullOrder.filter((id) => id !== movingId);
  const target = beforeId === null ? rest.length : rest.indexOf(beforeId);
  if (target < 0) return 0;
  return target - from;
}
