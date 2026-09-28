'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import type { DetailsItemKey } from '@/lib/maker-details-items';

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
  /** `item` names one Details item (`details` only). `love-story` and
   *  `rsvp-page` moved INTO Details (part 2b): the shell lands them on their
   *  item (`landInDetails`), so they are only ever asked for, never held. */
  | { kind: 'tool'; key: 'logo' | 'hero' | 'reveal' | 'love-story' | 'post-event' | 'details' | 'rsvp-page'; item?: DetailsItemKey }
  | { kind: 'main' }
  | { kind: 'row'; key: string }
  /** 📖 One of Post Event's written scenes (Maker Phase 8) — by its scene key. */
  | { kind: 'post-event'; scene: string }
  | null;

/** 'transition' is the folded tab (answer 4, "fold it") — an old address opens Animate. */
export type MakerSceneTab = 'format' | 'animate' | 'arrange' | 'content' | 'transition';

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
  /**
   * VIEW AS (moved from the ⋯ sheet's old stage, owner 2026-09-25): the guest
   * page as one role sees it, or null for the host's own editing preview. The
   * canvas iframe loads this instead of `?editor=1` while it is set.
   */
  viewAsHref: string | null;
  /** ＋ Add a scene, as the work area registered it — see `MakerAddScene` below. */
  addScene: MakerAddScene | null;
  setAddScene: (next: MakerAddScene | null) => void;
  /**
   * ✍ TAP A FACT, EDIT IT ON THE RIGHT (Details part 2b): the Details items'
   * OWN editors, built once by the launch page (`detailsFactEditors`) and handed
   * to both Details and the stage — so a fact tapped on a stage opens the SAME
   * component its Details item shows, never a copy. Empty outside the Maker.
   */
  factEditors: Partial<Record<DetailsItemKey, ReactNode>>;
};

export const MakerContext = createContext<MakerState | null>(null);

export function useMaker(): MakerState | null {
  return useContext(MakerContext);
}

/** The element id the ⋯ sheet keeps for the work area's address rows. */
export const MAKER_MORE_ROWS_ID = 'maker-more-rows';

/**
 * ＋ ADD A SCENE — what the toolbar's ＋ (and, on a phone, the More ▾ row) does.
 * Only the work area knows whether a scene may be added here — the templates,
 * Pro, the six, the stage, the store shell — so it REGISTERS the answer
 * (`setAddScene`) and the shell draws the button from it. `ready` opens the
 * work area's own template sheet (the same one as the navigator's "+ Add a
 * scene"); `refused` says why, and wears the padlock when the reason is Event
 * Hub Pro; null = no button (the store shell, a stage without scenes of their
 * own). A client registration only — the write is still the tile's form,
 * posting to `addCustomSection`.
 */
export type MakerAddScene =
  | { kind: 'ready'; open: () => void }
  | { kind: 'refused'; note: string; locked: boolean; unlockHref: string };
