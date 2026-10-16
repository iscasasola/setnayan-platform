'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Screen } from '@/components/skeletons';
import type { HomeCoverWords } from '@/lib/home-cover-words';
import { HomeCoverBand } from './home-cover-band';

/**
 * home-loading-cover.tsx — ⚡ OPENING AN EVENT SHOWS ITS NAME AT ONCE (owner 2026-10-16:
 * "Opening my events takes so long").
 *
 * Measured on a production build with the owner's rows replayed (375 px, 4× CPU, Fast 4G): a tap
 * on an event card changed the URL at ~240 ms and drew the loading skeleton — then the branded
 * veil covered the page, and the event's name first appeared ~1.1 s after the tap, when the whole
 * Home had been read and sent. The event LAYOUT (prefetched with the card, so already on the phone)
 * has read the event row; it now hands the cover's words down (`HomeCoverWordsProvider`), and the
 * Home's loading screen draws the real cover band — the couple's names and the date line — at the
 * tap, with the skeleton below it. The veil does not cover a page that is already showing its
 * own words.
 *
 * 🔒 HONEST: the words are this request's own read of the event (the layout's), the same function
 * the Home uses (`lib/home-cover-words.ts`) — never a remembered or guessed value. Only the Home's
 * own path draws it; every other route that inherits this loading screen keeps its skeleton.
 * 🔒 app/dashboard/[eventId]/opening-an-event-shows-its-name-at-once.test.ts
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

/** The Home's loading screen: its real cover band on the Home's own path, else the plain skeleton. */
export function HomeLoadingScreen({ label, hero, children }: { label: string; hero: ReactNode; children: ReactNode }) {
  const cover = useContext(CoverWords);
  const path = usePathname();
  const onHome = Boolean(cover) && path === `/dashboard/${cover!.eventId}`;
  if (!onHome)
    return (
      <Screen label={label}>
        {hero}
        {children}
      </Screen>
    );
  return (
    <section aria-busy="true" aria-live="polite" className="space-y-6" data-home-loading-cover="">
      <span className="sr-only">{label}…</span>
      <HomeCoverBand eventId={cover!.eventId} cover={cover!.words} />
      {children}
    </section>
  );
}
