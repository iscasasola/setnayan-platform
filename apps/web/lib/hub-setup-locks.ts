/**
 * lib/hub-setup-locks.ts — the Maker's word for a part still waiting on a step
 * of "Finish your Event Hub" (`lib/hub-setup-steps.ts`): "Locked — finish ___",
 * filled in, never a paywall (owner-approved 2026-10-01).
 *
 * ⚡ Its own tiny module ON PURPOSE: the Maker's canvas list
 * (`lib/maker-scene-list.ts`) is in the Maker's first load, and the setup's
 * step table is not — so the canvas imports only these lines.
 */

/** "Locked — finish Love Story". */
export function lockedLine(short: string): string {
  return `Locked — finish ${short}`;
}

/**
 * The Event Hub scenes a setup step unlocks, as the Maker's canvas names them
 * while they are empty (`makerEmptyPrompt`). Words fit every event type — the
 * canvas does not know which step list it is in.
 */
export const HUB_SETUP_LOCKED_SCENES = {
  schedule: 'your Schedule',
  venue_map: 'your venues',
  our_love_story: 'Love Story',
} as const;
