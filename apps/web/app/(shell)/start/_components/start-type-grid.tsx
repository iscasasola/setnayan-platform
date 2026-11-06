'use client';

/**
 * The shipped create-event grid, unchanged, with a tap that goes to the
 * server-computed href for that type (`/start/page.tsx`). Nothing here decides
 * where a type goes — the page does, through `onboardingRouteFor`.
 */
import { useRouter } from 'next/navigation';
import { EventTypePhotoPicker } from '@/app/dashboard/(account)/create-event/_components/event-type-photo-picker';
import type { EventTypeRow } from '@/app/dashboard/(account)/create-event/_components/event-types';

export function StartTypeGrid({ types, hrefs }: { types: EventTypeRow[]; hrefs: Record<string, string> }) {
  const router = useRouter();
  return (
    <EventTypePhotoPicker
      types={types}
      onSelect={(t) => {
        const href = hrefs[t.key];
        if (href) router.push(href);
      }}
    />
  );
}
