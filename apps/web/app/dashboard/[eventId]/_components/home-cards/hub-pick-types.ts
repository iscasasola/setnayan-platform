/**
 * hub-pick-types.ts — what the Event Hub tile's "Pick what shows" sheet reads on the tap (owner 2026-10-25: *"pick
 * what shows makes them choose between Save the Date, Invitation, The Day, Post Event only"*). A plain module (no
 * server imports) so the sheet, its server action and the dev lab share ONE shape.
 */
import type { LifecyclePhase } from '@/lib/invitation-widgets';

export type HomeHubPickRead =
  /** `not_host` — only current hosts pin the page (`setLaunchPhase`'s own gate); `unread` — the read failed. */
  | { ok: false; reason: 'not_host' | 'unread' }
  | {
      ok: true;
      /** The stage the couple PINNED (`manualLaunchPhase(launch_mode, manual_phase)`) — null = the date decides. */
      pinned: LifecyclePhase | null;
      /** The stage the date gives today (`resolveHubStage`) — what guests see when nothing is pinned. */
      byDate: LifecyclePhase | null;
    };
