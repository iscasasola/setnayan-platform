'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { hubDraftAction } from '../../../website/hub-draft-actions';
import { rejectColourChange } from '../../../colour-access-actions';
import { uploadMoodboardSlot, removeMoodboardSlot } from '../../../wizard-actions';
import { applyGalleryPick, fetchGalleryAssets } from '../actions';
import { updateDressCodeLists } from '../dress-code-actions';

/**
 * The Mood Board studio's writes that a plain press reaches — the SHIPPED server actions by default.
 *
 * Why this exists (controller, 2026-10-09; the pattern is `guests/_components/guest-actions-context.tsx`): the dev lab
 * (`/dev/maker-lab?studio=1`, `/dev/details-lab?studio=1`) draws the REAL page on fixture data, and every colour pick, outfit,
 * photo and Do's & Don'ts edit used to reach the real action — a lab press could reach the database. The lab hands in stand-ins that
 * succeed LOCALLY (`app/dev/details-lab/lab-mood-board-actions.tsx`); nothing in the app ever provides this context, so production
 * runs the real thing — `useMoodBoardActions()` falls back to `REAL_MOOD_BOARD_ACTIONS` for every name the provider does not
 * override (`the-lab-cannot-reach-the-database` holds it).
 *
 * Call sites keep the action's OWN name (`const { hubDraftAction } = useMoodBoardActions();`), so every call reads — and every guard
 * that pins "the page calls hubDraftAction(…)" still reads — as the real call.
 *
 * ⚡ This file rides the lazy Mood Board chunk (`mood-board-lazy.tsx`), with the studio that reads it — never the Maker's first load.
 */
export type MoodBoardActions = {
  /** The five colours, the room, a role's colours and each role's outfit, into the draft; and a Do's & Don'ts look pick's canvas. */
  hubDraftAction: typeof hubDraftAction;
  /** A supplier's colour change, undone (live). */
  rejectColourChange: typeof rejectColourChange;
  /** A photo into / out of a part (live). */
  uploadMoodboardSlot: typeof uploadMoodboardSlot;
  removeMoodboardSlot: typeof removeMoodboardSlot;
  /** "Search ideas" — a supplier's photo into a part (live). */
  applyGalleryPick: typeof applyGalleryPick;
  fetchGalleryAssets: typeof fetchGalleryAssets;
  /** The Do's & Don'ts lists (the form's own action; into the draft in the Maker). */
  updateDressCodeLists: typeof updateDressCodeLists;
};

export const REAL_MOOD_BOARD_ACTIONS: MoodBoardActions = {
  hubDraftAction,
  rejectColourChange,
  uploadMoodboardSlot,
  removeMoodboardSlot,
  applyGalleryPick,
  fetchGalleryAssets,
  updateDressCodeLists,
};

export const MoodBoardActionsContext = createContext<Partial<MoodBoardActions> | null>(null);

export function MoodBoardActionsProvider({ actions, children }: { actions: Partial<MoodBoardActions>; children: ReactNode }) {
  return <MoodBoardActionsContext.Provider value={actions}>{children}</MoodBoardActionsContext.Provider>;
}

export function useMoodBoardActions(): MoodBoardActions {
  const over = useContext(MoodBoardActionsContext);
  return useMemo(() => (over ? { ...REAL_MOOD_BOARD_ACTIONS, ...over } : REAL_MOOD_BOARD_ACTIONS), [over]);
}
