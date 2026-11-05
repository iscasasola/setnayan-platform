import { buildMakerNavigatorData } from '@/app/dashboard/[eventId]/website/editor/_components/maker-navigator-data';
import { WEDDING_PROFILE } from '@/lib/event-type-profile';
import { INVITE_THEMES } from '@/lib/invite-themes';
import type { InvitationWidgetRow, LifecyclePhase } from '@/lib/invitation-widgets';
import type { PostEventMakerRead } from '@/lib/post-event-scenes';
import { resolveWeddingOnlyParts } from '@/lib/wedding-only-parts';
import type { GuestsSeeInput } from '@/lib/what-guests-see';
import { LAB_SAMPLE } from './guest/lab-sample';

/**
 * 🧪 WHAT THE LAB HANDS THE REAL NAVIGATOR BUILDER (`buildMakerNavigatorData`) — ONE input, two callers: the Maker
 * (`page.tsx`) and its canvas (`guest/page.tsx`). The canvas draws each stage from the SAME list the Maker shows
 * for it, so the two cannot disagree about what is on a stage or in what order (the walk of 2026-10-11, P02 · P12).
 * `rows` are the sample's rows with the lab's draft laid over them (`lab-draft.ts` `labDraftedRows`).
 */
export function labNavigatorInput(rows: readonly InvitationWidgetRow[]): Omit<Parameters<typeof buildMakerNavigatorData>[0], 'postEvent'> {
  const pal = INVITE_THEMES.house.palette;
  return {
    plan: {
      widgets: rows,
      openBrowse: true,
      weddingOnlyParts: resolveWeddingOnlyParts(WEDDING_PROFILE),
      /* 🧩 WHAT THE SAMPLE HAS NOTHING IN: the three scenes the lab's canvas draws as an empty scene's place
         (`guest/page.tsx`: the love story, the gallery, the reminders — `MakerEmptyScene`). The lab said "everything
         is written", so "What guests see" ticked a part the canvas could not draw with no word of why (the walk of
         2026-10-11, M08); now each of those rows says it: "Nothing written yet — guests will not see it." */
      content: LAB_EMPTY,
      solemn: false,
      hasHeroMedia: false,
      hasEntourage: true,
      dayParts: true,
      storyRenders: false,
      countdownPast: false,
      giftsOff: false,
      setupLocks: true,
    },
    sectionRows: rows,
    tint: { canvas: pal.canvas, ink: pal.ink, accent: pal.accent },
    facts: {
      names: LAB_SAMPLE.names,
      dateLabel: LAB_SAMPLE.dateLabel,
      daysToGo: 68,
      venueName: null,
      venueAddress: null,
      firstBlock: null,
      dressTitle: null,
      dressLine: null,
      photoMomentsLine: null,
      specialMessage: null,
      whatToBring: null,
      loveStory: null,
      entourageCount: 32,
      heroPhotoUrl: null,
      firstGalleryUrl: null,
    },
    photoUrls: {},
  };
}

/** The scenes the sample has nothing in yet — one list for the Maker's lists, the table and the canvas. */
export const LAB_EMPTY: Readonly<Partial<Record<'our_love_story' | 'our_photos' | 'what_to_bring', false>>> = { our_love_story: false, our_photos: false, what_to_bring: false };

/** The lab's facts as `sceneOnStage` takes them (`lib/what-guests-see.ts`) — the same ones the navigator is built from. */
export function labSeen(rows: readonly InvitationWidgetRow[]): Pick<GuestsSeeInput, 'widgets' | 'openBrowse' | 'weddingOnlyParts' | 'content' | 'solemn' | 'countdownPast'> {
  const plan = labNavigatorInput(rows).plan;
  return { widgets: rows, openBrowse: plan.openBrowse, weddingOnlyParts: plan.weddingOnlyParts, content: plan.content, solemn: plan.solemn, countdownPast: plan.countdownPast };
}

/**
 * A stage's canvas keys, in the page's order — the Maker's OWN list for it (`stageLists[stage].shown`): only that
 * stage's parts, a moved scene where it now stands, a removed scene gone.
 */
export function labStageTiles(rows: readonly InvitationWidgetRow[], stage: LifecyclePhase, postEvent: Extract<PostEventMakerRead, { ok: true }> | null = null): string[] {
  return buildMakerNavigatorData({ postEvent, ...labNavigatorInput(rows) }).stageLists[stage].shown.map((t) => t.key);
}
