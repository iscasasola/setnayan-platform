'use client';

import { createContext, useContext } from 'react';
import type { LifecyclePhase } from '@/lib/invitation-widgets';

/**
 * THE MAKER'S SHARED STATE — what the toolbar says, the navigator, canvas and
 * inspector read.
 *
 * Two server trees meet in the Maker: the shell (toolbar + the ⋯ sheet, built
 * by `launch/page.tsx`) and the work area (navigator + canvas + inspector,
 * built by `website/editor/page.tsx` with every panel and its OWN bound server
 * action). They cannot pass props to each other — each is a server component
 * handing its own client component plain data — so the one place they meet is
 * this context, provided by `MakerShell` and read by `MakerWork`.
 *
 * 🔑 NOTHING HERE WRITES. Every write is a form posting to an action that
 * already ships; this carries only which stage, which device, which thing is
 * selected, and whether the navigator is open.
 */

export type MakerDevice = 'desktop' | 'phone';

/** What the inspector is showing. `null` = nothing selected, inspector closed. */
export type MakerSelection =
  | { kind: 'scene'; id: string; tab?: MakerSceneTab }
  | { kind: 'tool'; key: 'logo' | 'hero' | 'reveal' | 'love-story' | 'post-event' | 'prints' | 'details' }
  | { kind: 'main' }
  | { kind: 'row'; key: string }
  | null;

export type MakerSceneTab = 'format' | 'animate' | 'transition' | 'content';

export type MakerState = {
  eventId: string;
  stage: LifecyclePhase;
  setStage: (stage: LifecyclePhase) => void;
  device: MakerDevice;
  navOpen: boolean;
  selection: MakerSelection;
  select: (next: MakerSelection) => void;
  /** Is the ⋯ sheet open? The work area portals the address rows into it. */
  moreOpen: boolean;
  /** A new value on every server render — the canvas reloads on it, so a save
   *  (which redirects back here) is seen on the page at once. */
  renderStamp: string;
  /** App-store shell: Pro-only controls are HIDDEN, not locked, and no price. */
  storeShell: boolean;
};

export const MakerContext = createContext<MakerState | null>(null);

export function useMaker(): MakerState | null {
  return useContext(MakerContext);
}

/** The element id the ⋯ sheet keeps for the work area's address rows. */
export const MAKER_MORE_ROWS_ID = 'maker-more-rows';
