'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { HomeCoverWords } from '@/lib/home-cover-words';

/**
 * event-cover-words.tsx — the event's cover words (names + short date) as the event LAYOUT already read them, handed
 * down by context. Its own small module on purpose: the Home's loading screen (`home-loading-cover.tsx`) draws the
 * cover band with them, and the signature moments (The Tie, Go live) name the couple with them — the moments import
 * THIS file, never the loading screen, so the Event Hub Maker does not pull the Home's cover band (and every screen
 * behind it) into its reach (🔒 lib/a-failed-press-never-replaces-the-maker.test.ts walks the Maker's imports).
 */
const CoverWords = createContext<{ eventId: string; words: HomeCoverWords } | null>(null);

export function HomeCoverWordsProvider({
  eventId,
  words,
  children,
}: {
  eventId: string;
  words: HomeCoverWords;
  children: ReactNode;
}) {
  return <CoverWords.Provider value={{ eventId, words }}>{children}</CoverWords.Provider>;
}

/**
 * 🕯 This event's names and short date, as the layout already read them — for a signature moment that names the couple
 * (The Tie, Go live) without a read of its own. Null outside an event.
 */
export function useEventCoverWords(): { eventId: string; words: HomeCoverWords } | null {
  return useContext(CoverWords);
}
