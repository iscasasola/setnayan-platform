'use client';

import { createContext, useContext, useRef, type ReactNode } from 'react';
import { TodaySettings } from './today-settings';
import { useHeroPin } from './use-hero-pin';

/**
 * ⚙ TODAY'S GEAR RIDES — owner 11 Nov, *"Today settings yes"* (ask e of `supplier_queued_asks_2026-11-11`: *"shouldn't
 * today's settings be inside header"*). Today's ONE ⚙ (`TodaySettings`) sits top-right on the photo header
 * (`TodayCover` → `SupplierHero`'s gear slot, in the cover's ink) while the header is on screen, and rides onto the
 * right end of the pinned "Needs you today" row once the header has scrolled away — Portfolio's shipped `pin`
 * (`useHeroPin`), the house pinned-row template (selector · counts · action · ⚙). Never beside the hours while the
 * header is up; never two mounts.
 *
 * The cover and the Needs-you row are server parts in different subtrees, so `TodayGearRide` measures the cover and
 * the two `TodayGearSlot`s read the one answer. The server render (and the first paint) puts the ⚙ on the header.
 * 🔒 app/vendor-dashboard/_components/today-gear-rides-the-header.test.ts
 */
export const TodayGearPinned = createContext(false);

export function TodayGearRide({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const pin = useHeroPin(() => root.current?.querySelector('[data-today-cover]') ?? null);
  return (
    <TodayGearPinned.Provider value={pin >= 0.5}>
      <div ref={root} className="contents" data-today-gear-ride="">
        {children}
      </div>
    </TodayGearPinned.Provider>
  );
}

/** Where the one ⚙ may sit: `cover` (the header's top right) or `pin` (the pinned Needs-you row's right end). */
export function TodayGearSlot({ at }: { at: 'cover' | 'pin' }) {
  const pinned = useContext(TodayGearPinned);
  if ((at === 'pin') !== pinned) return null;
  return <TodaySettings cover={at === 'cover'} />;
}
