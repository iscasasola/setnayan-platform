'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Chapter, TaskRow } from '@/lib/schedule-chapters';
import type { ChapterMoment } from './chapters-host';
import type { ViewAsInput, ViewLens } from '@/lib/schedule-view-as';

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
  /**
   * 👤 THE PAGE'S ONE VIEW AS (owner 2026-11-04, prototype frames 1–2: the round 👤 on Event Day AND on a chapter's
   * page). Held here so both read and set the same lens; the rail draws the view.
   */
  lens: ViewLens;
  setLens: (l: ViewLens) => void;
  /**
   * ⚙ SCHEDULE SETTINGS (prototype frames 1–2: the round ⚙). One sheet the host owns: the date line and its ⓘ,
   * Announce and Share (from the page's one line), and the day's tools (from the rail) — each registered here.
   */
  openSettings: () => void;
  /** `needs` — what needs you (the supplier requests' door), drawn in the desktop's people column (slice 10). */
  setSettingsPart: (part: 'line' | 'tools' | 'needs', node: ReactNode) => void;
  /**
   * 📋 THE DAY AS A LIST (slice 8): what a chapter row draws — its moments, the tasks in them and the suppliers they
   * name — read from the page's ONE chapter state (so a save shows at once), and the booked suppliers who have not
   * picked a chapter yet, by the chapter their trade usually serves (dashed faces).
   */
  moments: ChapterMoment[];
  tasks: TaskRow[] | null;
  suppliers: { id: string; name: string; everyChapter?: boolean }[];
  picking: Readonly<Record<string, readonly string[]>>;
  /** 🔎 "4 chapters" is a door: the day narrowed to ONE chapter (null = every chapter). */
  dayFilter: string | null;
  setDayFilter: (id: string | null) => void;
  /**
   * ↕ THE DESKTOP BOARD (slice 10, ≥1280 only): a chapter dragged by `minutes` (snapped to 5) — saved in place through
   * the phone's own time edit (`lib/chapter-move.ts` → `ChapterDoors.save`), with Undo. The page never resets.
   */
  moveChapter: (id: string, minutes: number) => void;
};

export const ChaptersContext = createContext<ChaptersApi | null>(null);

/** The page's chapters — null where none are drawn (the Maker, a failed read, a trip). */
export function useChapters(): ChaptersApi | null {
  return useContext(ChaptersContext);
}
