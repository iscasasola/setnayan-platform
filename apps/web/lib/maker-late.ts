import type { ReactNode } from 'react';
import type { DetailsItemKey } from '@/lib/maker-details-items';
import type { StudioTileModel } from '@/lib/studio-tiles';
import type { MakerVenuePictures } from '@/app/dashboard/[eventId]/launch/_components/maker-context';

/**
 * ⚡ WHAT ARRIVES BEHIND THE MAKER — the Studio's and Details' panels, built by the launch page as ONE
 * promise it never waits for (`app/dashboard/[eventId]/launch/page.tsx`, `late`), so the shell and the
 * canvas go out first and these follow in the same response, before anyone has tapped. The shell takes
 * them up through `MakerLateBridge` (`_components/maker-late.tsx`).
 *
 * Measured on production 2026-10-23 (new Maker, a phone): the page took 5.4–6.3 s and the canvas showed
 * at 7.5–11.6 s, because the editor that draws the canvas only started once these panels were done.
 */
export type MakerLate = {
  details: { page: ReactNode; controls: ReactNode } | null;
  rsvpStage: ReactNode;
  factEditors: Partial<Record<DetailsItemKey, ReactNode>>;
  venuePictures: MakerVenuePictures | null;
  studio: { tiles: readonly StudioTileModel[] } | null;
  /** An unfinished event with no place in the address opens on What's left — decided from the panels' own facts. */
  opensOnGuide: boolean;
};

/** The panels could not be built: every one of them then SAYS so ("could not be loaded"), never a blank Maker. */
export const MAKER_LATE_UNREAD: MakerLate = {
  details: null,
  rsvpStage: null,
  factEditors: {},
  venuePictures: null,
  studio: null,
  opensOnGuide: false,
};
