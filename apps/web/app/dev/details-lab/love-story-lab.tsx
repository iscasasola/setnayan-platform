'use client';

import { useEffect, useState } from 'react';
import { LiveLoveStoryBook } from '@/app/dashboard/[eventId]/website/our-story/_components/live-book-lazy';
import type { LoveStoryBlob } from '@/app/dashboard/[eventId]/website/our-story/_components/story-fields';

/**
 * /dev/details-lab?item=love-story — the Maker's INSTANT Love Story on fixture
 * data (2026-09-30). The REAL `LiveLoveStoryBook` and `LiveStoryPanel`; the
 * draft save is a stand-in that answers after `?ms=` (default 300) and records
 * every call on `window.__labSaves`, so a session measures what the couple
 * feels: edit → on the page, and how many saves a burst makes. `?refuse=1`
 * refuses every save, to see the story go back and say so. Nothing here
 * reaches a database.
 */

declare global {
  interface Window {
    __labSaves?: Array<{ at: number; patch: string }>;
  }
}

export function LoveStoryLab({ ms, refuse, story }: { ms: number; refuse: boolean; story: LoveStoryBlob }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    window.__labSaves = [];
    let off = () => {};
    /* The SAME module the Maker loads (its `maker-details` chunk) — never a copy of its own. */
    void import(
      /* webpackChunkName: "maker-details" */ '@/app/dashboard/[eventId]/website/our-story/_components/love-story-live'
    ).then(({ setLoveStoryLabSaver }) => {
      off = () => setLoveStoryLabSaver(null);
      setLoveStoryLabSaver(async (_eventId: string, fd: FormData) => {
        window.__labSaves!.push({ at: performance.now(), patch: String(fd.get('patch')) });
        await new Promise((r) => setTimeout(r, ms));
        return refuse
          ? { ok: false as const, intent: 'save' as const, error: 'The lab refused it.' }
          : { ok: true as const, intent: 'save' as const, applied: 0, held: [] };
      });
      setReady(true);
    });
    return () => off();
  }, [ms, refuse]);
  if (!ready) return null;
  return (
    <LiveLoveStoryBook
      story={story}
      inMaker
      eventId="00000000-0000-4000-8000-000000000000"
      names="Claire & Indalecio"
      partners={['Claire', 'Indalecio']}
      eyebrow="December 18, 2026"
      daysToTheDay={79}
      themeName="House"
      motionLabel="Gentle"
      makerHref="#"
      guestHref={null}
      ownsPro={false}
      storeShell={false}
      proHref="#"
      proPrice={null}
      refused={null}
      sectionHidden={false}
      mediaUrls={{}}
      action={async () => {
        throw new Error('The lab has no server — a photo change goes to the server.');
      }}
      pickSlot={null}
    />
  );
}
