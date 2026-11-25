import type { ReactNode } from 'react';

import { NeedsInternetGuard } from '@/app/_components/offline-ready/needs-internet-guard';
import { ScheduleSavedSlot } from '@/app/_components/offline-ready/schedule-saved-slot';

/**
 * 📅 The Schedule route's own frame: the page, and the saved-for-no-signal mark drawn into the page's slot
 * (`ScheduleSavedSlot` — it lives here, not in the page, because the Event Hub Maker draws the page and must not carry it).
 */
export default function ScheduleLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ScheduleSavedSlot />
      {/* 📶 R15 — with no signal, the Maker's doors grey out and say "Needs internet" (also here, not in the page). */}
      <NeedsInternetGuard />
    </>
  );
}
