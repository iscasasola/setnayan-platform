'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Subscribes to the `seating-changes:{eventId}` Supabase broadcast channel and
 * calls router.refresh() when an `assignment_updated` event arrives.
 *
 * This is a pure side-effect component — it renders no DOM. Drop it anywhere
 * in a server-component tree that also renders seat data. Because the channel is
 * broadcast (not presence), anonymous guest browsers can subscribe without an
 * authenticated session.
 *
 * The refresh is silent: Next.js 15 router.refresh() re-fetches the current
 * route's server data in the background and swaps in new RSC payload without a
 * visible loading state. Guests see their table or seat number update in place.
 *
 * Used on:
 *   • /[slug]/find-seat  (seat-finding PR 1 — free public finder)
 *   • /[slug]/seat       (seat-finding PR 4 — paid personal pass + table view)
 */
export function SeatingChangesListener({ eventId }: { eventId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`seating-changes:${eventId}`)
      .on('broadcast', { event: 'assignment_updated' }, () => {
        // Silent re-render: re-fetches RSC data without a loading flash.
        router.refresh();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, router]);

  return null;
}
