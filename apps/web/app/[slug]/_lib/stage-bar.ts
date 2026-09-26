/**
 * 🧭 THE EVENT BAR, PER STAGE — the ONE place a stage's guest bar is configured
 * (owner 2026-09-26, verbatim: *"you showed invitation guest bar? for an on the
 * day guest bar"* · *"show the actual guest bar for that stage"* · on the
 * Maker navigator's "Main" button: *"this depends on what menu they are
 * looking at."*).
 *
 * Three things read this and must never disagree:
 *   · the guest page's header, which names the stage ("On the Day", not
 *     "Invitation" on every stage — `InvitationShell`'s `stageLabel`);
 *   · the guest page's bottom tab bar (`resolveSiteNav`'s `stageSlots`);
 *   · the Maker's navigator, whose tabs ARE that bar, read off the canvas the
 *     bar was drawn on (`data-maker-bar`, `lib/maker-navigator-tabs.ts`).
 *
 * `slots` is the stage's ALLOW-LIST, in no particular order — the rules in
 * `resolveSiteNav` still decide whether each one is drawn and where (a Details
 * tab with no details, a Gallery nobody shared, Watch before a broadcast). A
 * slot missing from a stage's list is never drawn on that stage.
 *
 * ⏳ POST EVENT IS THE OWNER'S TO SET. Its list below is what the page drew on
 * 2026-09-26 (Recap · Camera · Gallery · Join/Me). Changing what the Post Event
 * bar offers is an edit to `STAGE_BAR.editorial.slots` and nothing else — the
 * header, the tab bar and the Maker's navigator all follow it.
 */
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import type { DayOfPhase } from '@/lib/day-of-mode';
import { PUBLIC_STAGE_LABELS } from '@/lib/public-site-stage-labels';
import type { NavSlotKey } from './site-nav';

export type StageBar = {
  /** The header's word for the stage. */
  label: string;
  /** Which slots this stage's bar may carry. */
  slots: readonly NavSlotKey[];
};

export const STAGE_BAR: Readonly<Record<LifecyclePhase, StageBar>> = {
  save_the_date: {
    label: PUBLIC_STAGE_LABELS.save_the_date,
    slots: ['home', 'details', 'story', 'camera', 'me'],
  },
  rsvp: {
    label: PUBLIC_STAGE_LABELS.rsvp,
    slots: ['home', 'details', 'story', 'camera', 'me'],
  },
  event: {
    label: PUBLIC_STAGE_LABELS.event,
    // `details` stays for a booked supplier's "Cues" tab on the day.
    slots: ['home', 'details', 'watch', 'camera', 'gallery', 'me'],
  },
  editorial: {
    label: PUBLIC_STAGE_LABELS.editorial,
    slots: ['home', 'camera', 'gallery', 'me'],
  },
};

/**
 * Which stage the page is showing. With the website phases on it is the
 * page's own lifecycle phase (a host's `?phase=` preview included); with them
 * off the page is the invitation, which becomes the day while the day is live
 * and the recap just after it — the same moments `navPhaseFor` reads.
 */
export function pageStageFor(input: {
  phasesEnabled: boolean;
  lifecyclePhase: LifecyclePhase;
  dayOfPhase: DayOfPhase | null | undefined;
}): LifecyclePhase {
  if (input.phasesEnabled) return input.lifecyclePhase;
  if (input.dayOfPhase === 'live') return 'event';
  if (input.dayOfPhase === 'post') return 'editorial';
  return 'rsvp';
}

/** What the canvas hands the Maker's navigator: the bar exactly as drawn. */
export type MakerBarItem = { key: NavSlotKey; label: string; href: string; state: 'live' | 'locked' };

export function makerBarItems(slots: ReadonlyArray<{ key: NavSlotKey; label: string; href: string; state: 'live' | 'locked' }>): MakerBarItem[] {
  return slots.map(({ key, label, href, state }) => ({ key, label, href, state }));
}
