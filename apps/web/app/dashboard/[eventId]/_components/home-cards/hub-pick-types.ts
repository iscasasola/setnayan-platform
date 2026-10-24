/**
 * hub-pick-types.ts — what the Event Hub tile's "Pick what shows" sheet reads on the tap (owner 2026-10-24). A plain
 * module (no server imports) so the sheet, its server action and the dev lab share ONE shape. The Apply bar is NOT in
 * it: its data reads the "view as a free couple" switch (`loadHubDraftBarData`), which no server action may see
 * (`lib/view-as-free-never-changes-a-save.test.ts`) — so Home RENDERS the shipped `HubDraftDock` and hands it in.
 */
import type { GuestsSeeTable } from '@/lib/guests-see-table';
import type { LifecyclePhase } from '@/lib/invitation-widgets';

export type HomeHubPickRead =
  /** `not_host` — only current hosts change the page (the draft's own gate); `unread` — the reads failed. */
  | { ok: false; reason: 'not_host' | 'unread' }
  | {
      ok: true;
      /** "What guests see", the draft laid over (`readHomeHubCard`) — null when the scene rows could not be read. */
      table: GuestsSeeTable | null;
      /** Which page the link shows now — the page picker's "Now". */
      stage: LifecyclePhase | null;
      /** The draft could not be read — the switches show the live page. */
      draftUnread: boolean;
    };
