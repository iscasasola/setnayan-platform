'use client';

/**
 * event-pinned-row.tsx — 📌 THE COUPLE EVENT PAGES' ONE PINNED ROW, mounted ONCE by the event layout (design template,
 * owner-approved 14 Nov 2026, rule 1: *"No big title and no explaining caption. The page's name lives in the pinned
 * row's picker"* — the admin's `AdminPinnedRow` and the supplier's page menu are the same idea, from their layouts).
 *
 *   [Page · View ▾]
 *
 * Drawn by the app's ONE pinned row (`PinnedRow`) and its ONE picker (`PickMenu`) — never a copy. Where you stand comes
 * from the event menu's own tree and the rail's own resolver (`event-pin-places.ts`), so the row names the same place
 * the rail lights. The ▾ lists that menu row's pages (its door and the pages it holds); picking one goes there.
 *
 * ⚙ NO GEAR HERE, ON PURPOSE: each couple menu's ⚙ (home · guests · suppliers · memories · hub) is mounted ONCE, on its
 * own page's row (`every-menu-has-one-settings-button.test.ts` counts one literal site per menu), and those pages keep
 * their own rows — so this row would have to mount a second copy. It ends at the picker.
 *
 * Draws NOTHING on the event Home (its cover band is the exception), on a page that keeps its own first row, and on a
 * page the menu does not hold (never a guessed name). 🔒 app/dashboard/[eventId]/the-event-wears-one-pinned-row.test.ts
 */
import { useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { PinnedRow } from '@/app/_components/pinned-row/pinned-row';
import { useShellBarOffset } from '../guests/_components/use-shell-bar-offset';
import { eventPinFace, eventPinPlaceOf, type EventPinTable } from './event-pin-places';

export function EventPinnedRow({ table }: { table: EventPinTable }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const stick = useRef<HTMLDivElement>(null);
  useShellBarOffset(stick);
  const place = eventPinPlaceOf(table, pathname);
  if (!place) return null;
  const { pillar, view } = place;
  return (
    <div
      ref={stick}
      className="sticky top-[var(--gs-top,0px)] z-[15] -mx-4 mb-3 bg-cream px-4 py-2 print:hidden sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      data-event-pin={pillar.key}
    >
      <PinnedRow
        picker={{
          label: `${pillar.label} page`,
          value: view?.path ?? '',
          buttonText: eventPinFace(place),
          options: pillar.views.map((v) => ({ key: v.path, label: v.label })),
          onPick: (key) => {
            const to = pillar.views.find((v) => v.path === key);
            if (to && to.path !== pathname) router.push(to.href);
          },
        }}
        doors={[]}
        gear={null}
        data={{ 'data-event-pinned-row': pillar.key }}
      />
    </div>
  );
}
