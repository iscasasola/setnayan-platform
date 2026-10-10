import { buildMakerNavigatorData } from '@/app/dashboard/[eventId]/website/editor/_components/maker-navigator-data';
import { WEDDING_PROFILE } from '@/lib/event-type-profile';
import { INVITE_THEMES } from '@/lib/invite-themes';
import type { InvitationWidgetRow, LifecyclePhase } from '@/lib/invitation-widgets';
import type { PostEventMakerRead } from '@/lib/post-event-scenes';
import { resolveWeddingOnlyParts } from '@/lib/wedding-only-parts';
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
      content: {},
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

/**
 * A stage's canvas keys, in the page's order — the Maker's OWN list for it (`stageLists[stage].shown`): only that
 * stage's parts, a moved scene where it now stands, a removed scene gone.
 */
export function labStageTiles(rows: readonly InvitationWidgetRow[], stage: LifecyclePhase, postEvent: Extract<PostEventMakerRead, { ok: true }> | null = null): string[] {
  return buildMakerNavigatorData({ postEvent, ...labNavigatorInput(rows) }).stageLists[stage].shown.map((t) => t.key);
}
