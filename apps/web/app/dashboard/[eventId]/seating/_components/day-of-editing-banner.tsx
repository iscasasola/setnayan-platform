'use client';

import { useEffect, useState } from 'react';
import { Notice } from '@/app/_components/notices/notices';
import { theDayIsOpenAt, theDayWhenKey, type TheDayWhen } from '@/lib/event-clock';

/**
 * Day-of "you're editing live" banner (seat-finding PR 5).
 *
 * Renders only while The Day is open (the one clock — `theDayIsOpenAt`), so
 * normal pre-wedding planning is unaffected. It encodes the owner's two day-of
 * locks for editors:
 *   • live propagation — a reseat reaches the guest "Find your seat" instantly;
 *   • digital-only responsibility — printed cards/signs are FROZEN snapshots;
 *     today the live digital plan is the single source of truth (Setnayan does
 *     not reconcile paper).
 *
 * A render-nothing sibling of <SeatingEditor> (kept out of the 4k-line editor),
 * it re-checks the clock on an interval + on tab-focus so it appears/disappears
 * as the window opens/closes without a reload.
 */
export function DayOfEditingBanner({ eventDate }: { eventDate: TheDayWhen }) {
  const whenKey = theDayWhenKey(eventDate);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!eventDate) return;
    /*
      ⚠ IT SAID "Live — guests are seeing this now" THE MORNING AFTER.

      `isEventDayActive` spans T-12h .. T+60h — two and a half days — so a red
      pulsing "guests are watching" banner sat on the seat plan of an event that
      finished the night before. That window is right for the surfaces guests
      actually use, and wrong for a message ABOUT them.

      🔑 It now asks the ONE clock (owner ruling, 10 Nov 2026) — handed The
      Day's instants by the seat plan's server page, so it opens at 06:00 on the
      day and lets go at 06:00 the morning after the LAST day, at the venue, with
      the rest of the product. (It used to ask with no zone: the device's own.)
    */
    const tick = () => setLive(theDayIsOpenAt(eventDate));
    tick();
    const id = setInterval(tick, 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the instants, not the object's identity
  }, [whenKey]);

  if (!live) return null;

  // 🔔 Inventory #24 — a LIVE notice (one notice system, owner approved 14 Nov 2026): very top, and it can't be hidden —
  // guests see every change the moment it is made.
  return (
    <Notice
      kind="live"
      tone="warning"
      closable={false}
      noticeKey={`guests-see-live:${whenKey}`}
      title="Live — guests are seeing this now"
      detail="Every seat change reaches the digital Find your seat the moment you make it. Printed escort cards, table signs, and boards are frozen snapshots — today the live plan is the source of truth."
    />
  );
}
