'use client';

import type { ReactNode } from 'react';
import { MoodBoardActionsProvider } from '@/app/dashboard/[eventId]/studio/mood-board/_components/mood-board-actions-context';
import { LAB_MOOD_BOARD_ACTIONS, LAB_MOOD_BOARD_REFUSALS } from './lab-mood-board-stand-ins';
import type { GalleryPage } from '@/lib/moodboard-gallery';
import { libraryLab } from '../supplier-lab/library-lab-server';

/**
 * 🧪 THE LAB GIVES STUDIO › MOOD BOARD & DRESS CODE ITS STAND-IN WRITERS (DEV-ONLY). The app never provides this context, so
 * production runs the shipped actions (`the-lab-cannot-reach-the-database.test.ts`). `refuse` = `&refuse=1`.
 */
export function LabMoodBoardActions({ refuse = false, library = false, children }: { refuse?: boolean; library?: boolean; children: ReactNode }) {
  const base = refuse ? { ...LAB_MOOD_BOARD_ACTIONS, ...LAB_MOOD_BOARD_REFUSALS } : LAB_MOOD_BOARD_ACTIONS;
  /* 🌱🖼 `&library=1`: Search ideas reads the supplier library lab's memory (`/dev/supplier-lab?s=library` → its lab Approve),
     through the shipped clamp and shaping — the round trip, with no database on either side (`library-lab-server.ts`). */
  return <MoodBoardActionsProvider actions={library ? { ...base, ...LAB_LIBRARY_GALLERY } : base}>{children}</MoodBoardActionsProvider>;
}

const LAB_LIBRARY_GALLERY = {
  fetchGalleryAssets: async (input: { slotKey: string; offset?: number; limit?: number; q?: string; from?: string; near?: string }) =>
    (await libraryLab({ op: 'gallery', ...input })) as GalleryPage,
  applyGalleryPick: async (input: { eventId: string; slotKey: string; slotPosition: number; assetId: string }) =>
    (await libraryLab({ op: 'pick', assetId: input.assetId })) as { status: 'ok' | 'error'; imageUrl?: string; message?: string },
};
