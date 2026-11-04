'use client';

import { createContext, useContext } from 'react';
import type { Chapter } from '@/lib/schedule-chapters';
import type { ViewAsInput } from '@/lib/schedule-view-as';

/**
 * 📖 The Schedule page's chapters, as the rail and the frame's dropdown read them (`chapters-host.tsx` provides it).
 * A module of its own — no sheets, no actions — so the rail and the frame carry only this, not the chapter page.
 */
export type ChaptersApi = {
  /** Every chapter, in time order. */
  chapters: Chapter[];
  /** The event's first day (`YYYY-MM-DD`) — before it a chapter lives in Planning Stage; null = no exact day yet. */
  eventDay: string | null;
  canEdit: boolean;
  /** The chapter whose page is open (the rail's add pill steps aside for its Edit). */
  openId: string | null;
  open: (id: string) => void;
  add: () => void;
  /** 👁 What the rail's View as ▾ reads (`schedule-view-as.tsx`); null = the page drew none. */
  viewAs: ViewAsInput | null;
  /** 🗑 A swipe left on a chapter asks to delete it — the page shows the warning, then Undo (owner 2026-11-03). */
  askDelete: (id: string) => void;
};

export const ChaptersContext = createContext<ChaptersApi | null>(null);

/** The page's chapters — null where none are drawn (the Maker, a failed read, a trip). */
export function useChapters(): ChaptersApi | null {
  return useContext(ChaptersContext);
}
