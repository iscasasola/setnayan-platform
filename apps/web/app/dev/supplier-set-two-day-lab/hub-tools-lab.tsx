'use client';

/**
 * The five hub tools (DECISION_LOG 2026-11-23) on SAMPLE data, for the day lab: the shipped `HubToolsSection`, its
 * checklists and counter talking to an in-memory store (`memoryListStore`) instead of the actions, so every control
 * can be pressed with no sign-in and no database. DEV-ONLY (the lab page 404s in production).
 */
import { useState } from 'react';
import { HubToolsSection } from '@/app/vendor-dashboard/on-the-day/live/[eventId]/_components/hub-tools/hub-tools-section';
import { memoryListStore } from '@/lib/shot-list';
import type { DayOfModuleId } from '@/lib/vendor-dayof-modules';
import type { EntourageSheetSection } from '@/lib/supplier-march';

const ENTOURAGE: EntourageSheetSection[] = [
  {
    key: 'principal_sponsors',
    label: 'Principal Sponsors',
    people: [
      { key: 'p1', name: 'Atty. Ramon Dizon', initials: 'RD', role: 'Ninong' },
      { key: 'p2', name: 'Dr. Liza Dizon', initials: 'LD', role: 'Ninang' },
    ],
  },
  {
    key: 'bridesmaids_groomsmen',
    label: 'Bridesmaids & Groomsmen',
    people: [
      { key: 'b1', name: 'Maria Reyes', initials: 'MR', role: 'Maid of Honor' },
      { key: 'b2', name: 'Jose Santos', initials: 'JS', role: 'Best Man' },
      { key: 'b3', name: 'Ana Cruz', initials: 'AC', role: 'Bridesmaid' },
    ],
  },
];

export function HubToolsLab({
  eventId,
  eventName,
  coming,
  on,
  entourageUnread = false,
}: {
  eventId: string;
  eventName: string;
  coming: number | null;
  on: readonly DayOfModuleId[];
  entourageUnread?: boolean;
}) {
  const [store] = useState(() =>
    memoryListStore({
      paperwork_checklist: [{ label: 'Valid IDs', done: true }, { label: 'Signed forms' }, { label: 'Permits' }],
      queue_counter: Array.from({ length: 37 }, () => ({ label: 'Served', done: true })),
    }),
  );
  return (
    <HubToolsSection
      eventId={eventId}
      eventName={eventName}
      on={on}
      coming={coming}
      entourage={entourageUnread ? null : ENTOURAGE}
      store={store}
    />
  );
}
