'use client';

/**
 * /dev/details-lab?asks=moodboard — Home's Mood Board lines (owner 2026-10-30, "THE OWNERS HAVE 24 HOURS TO UNDO"), on
 * fixture rows, no database: a supplier's photo to approve and a coordinator's change with its Undo. The REAL
 * `MoodBoardAsks` draws it; its three actions are stand-ins that answer locally, so a lab press never reaches the
 * database. `&open=changes` / `&open=approve` is for a screenshot of the Sheet — pressed here, not by a URL in the app.
 */
import { useEffect } from 'react';
import { MoodBoardAsks, type MoodBoardAsksActions } from '@/app/dashboard/[eventId]/_components/mood-board-asks';
import type { HomeChange, HomeSuggestion } from '@/lib/mood-board-changes';

const LAB_EVENT = '00000000-0000-4000-8000-00000000ac03';
const NOW = '2026-10-30T09:00:00.000Z';

const SUGGESTIONS: HomeSuggestion[] = [
  {
    suggestionId: '00000000-0000-4000-8000-0000000c0001',
    partLabel: 'Stage',
    shopLabel: 'Bloom & Co.',
    imageUrl: '/moodboard-seed/florals/boutonniere.webp',
    at: '2026-10-30T08:10:00.000Z',
  },
];
const CHANGES: HomeChange[] = [
  {
    changeId: '00000000-0000-4000-8000-0000000d0001',
    actorLabel: 'Coordinator Styled by Bea',
    kind: 'replace',
    partLabel: 'Ceiling',
    shopLabel: null,
    at: '2026-10-30T08:00:00.000Z',
    undoUntil: '2026-10-31T08:00:00.000Z',
  },
];

const STAND_INS: MoodBoardAsksActions = {
  keepInspirationSuggestion: async () => ({ status: 'ok', slotPosition: 1, replaced: false }),
  declineInspirationSuggestion: async () => ({ status: 'ok' }),
  undoMoodBoardChange: async () => ({ status: 'ok' }),
};

export function MoodBoardAsksLab({ open }: { open: 'approve' | 'changes' | null }) {
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>(`[data-mood-board-asks="${open}"]`)?.click();
    }, 300);
    return () => window.clearTimeout(t);
  }, [open]);
  return (
    <div className="min-h-dvh bg-cream px-4 py-6 text-ink">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-2">
        <h2 className="font-display text-lg">Today</h2>
        <MoodBoardAsks eventId={LAB_EVENT} suggestions={SUGGESTIONS} changes={CHANGES} actions={STAND_INS} now={NOW} />
      </div>
    </div>
  );
}
