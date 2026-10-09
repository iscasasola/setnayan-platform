'use client';

import type { ReactNode } from 'react';
import { MoodBoardActionsProvider } from '@/app/dashboard/[eventId]/studio/mood-board/_components/mood-board-actions-context';
import { LAB_MOOD_BOARD_ACTIONS, LAB_MOOD_BOARD_REFUSALS } from './lab-mood-board-stand-ins';

/**
 * 🧪 THE LAB GIVES STUDIO › MOOD BOARD & DRESS CODE ITS STAND-IN WRITERS (DEV-ONLY). The app never provides this context, so
 * production runs the shipped actions (`the-lab-cannot-reach-the-database.test.ts`). `refuse` = `&refuse=1`.
 */
export function LabMoodBoardActions({ refuse = false, children }: { refuse?: boolean; children: ReactNode }) {
  return <MoodBoardActionsProvider actions={refuse ? { ...LAB_MOOD_BOARD_ACTIONS, ...LAB_MOOD_BOARD_REFUSALS } : LAB_MOOD_BOARD_ACTIONS}>{children}</MoodBoardActionsProvider>;
}
