/**
 * lib/which-version-guests-see.ts — "WHICH VERSION GUESTS SEE ▾", ONE CONTROL
 * (owner 2026-10-06, verbatim: *"show me the prototype. draw it"*; DECISION_LOG
 * "THE APPLY SHEET IS DRAWN AS SHIPPED; OPEN BROWSING JOINS 'WHICH VERSION GUESTS
 * SEE'").
 *
 * Two shipped facts answer one question, so the new Maker's Studio › Info draws
 * them as ONE dropdown — never a second switch:
 *
 *   Automatic — follows the date      launch_mode auto,   open_browse off
 *   Save the Date · Invitation ·      launch_mode manual (that phase), open_browse off
 *     The Day · After
 *   All of them — guests can open     launch_mode auto,   open_browse ON
 *     every page
 *
 * The writes are the SHIPPED actions in `website/editor/actions.ts` —
 * `setLaunchPhase` (`launch_phase`) and `setOpenBrowse` (`open_browse`) — both
 * live, as they always were. This file only maps a choice to their fields and
 * reads the current choice back from the two columns. Pure; held by
 * `which-version-guests-see-is-one-control.test.ts`.
 */
import { LAUNCH_PHASE_CHOICES, type LaunchPhaseKey } from '@/app/dashboard/[eventId]/website/editor/_components/launch-phase-choices';

export type WhichVersion = 'auto' | LaunchPhaseKey | 'all';

export const WHICH_VERSION_LABEL = 'Which version guests see';

/** The six choices, in the prototype's order and words (the four phases keep the shipped labels). */
export const WHICH_VERSION_OPTIONS: ReadonlyArray<{ key: WhichVersion; label: string; hint?: string }> = [
  { key: 'auto', label: 'Automatic', hint: 'Follows the date' },
  /* The shipped labels and lines — "event", never "celebration" (owner 2026-10-04). */
  ...LAUNCH_PHASE_CHOICES.map((c) => ({ key: c.key as WhichVersion, label: c.label, hint: c.hint.replace(/\bcelebration\b/g, 'event') })),
  { key: 'all', label: 'All of them', hint: 'Guests can open every page' },
];

export function isWhichVersion(v: unknown): v is WhichVersion {
  return typeof v === 'string' && WHICH_VERSION_OPTIONS.some((o) => o.key === v);
}

/** The choice the two shipped columns spell today. A pinned phase wins — it is what guests open on. */
export function whichVersionNow(input: { pinned: LaunchPhaseKey | null; openBrowse: boolean }): WhichVersion {
  if (input.pinned) return input.pinned;
  return input.openBrowse ? 'all' : 'auto';
}

/**
 * What one pick posts: the `launch_phase` field of `setLaunchPhase`, and the
 * `open_browse` field of `setOpenBrowse` — or null where that column is already
 * right (no needless write).
 */
export function whichVersionWrites(
  pick: WhichVersion,
  now: { openBrowse: boolean },
): { launchPhase: 'auto' | LaunchPhaseKey; openBrowse: '1' | '0' | null } {
  const wantOpen = pick === 'all';
  return {
    launchPhase: pick === 'all' ? 'auto' : pick,
    openBrowse: wantOpen === now.openBrowse ? null : wantOpen ? '1' : '0',
  };
}

export function whichVersionLabel(v: WhichVersion): string {
  return WHICH_VERSION_OPTIONS.find((o) => o.key === v)?.label ?? 'Automatic';
}
