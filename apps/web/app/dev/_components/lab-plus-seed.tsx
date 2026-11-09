'use client';

/**
 * DEV-ONLY: seeds the chat's (+) store so a lab picture can show a card already open ("Running topic", the (+) shut)
 * without a tap. Mounted only by `/dev/*` labs (`the-lab-never-ships.test.ts` keeps them out of production).
 */
import { useEffect } from 'react';
import { patchPlus } from '@/lib/chat-plus-store';
import type { PlusCardKind } from '@/lib/chat-plus';

export function LabPlusSeed({ threadId, draft, toast }: { threadId: string; draft?: PlusCardKind | null; toast?: string | null }) {
  useEffect(() => {
    patchPlus(threadId, {
      draft: draft ? { kind: draft, startedAt: Date.now() } : null,
      toast: toast ? { text: toast, at: Date.now() } : null,
    });
  }, [threadId, draft, toast]);
  return null;
}
