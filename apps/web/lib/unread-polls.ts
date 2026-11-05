/**
 * unread-polls.ts — what the bell and the Messages envelope run once they are on screen (2026-10-21).
 *
 * The two badges are drawn by EVERY signed-in layout, so their code is in the first load of every page. Nothing here
 * is needed for the first paint — the server render seeds the count, and the first re-ask is a minute away — so the
 * badges `import()` this module from their effect and it rides in a chunk of its own, off the first load.
 *
 *   · `pollBell` — the unread-notification count, re-asked through `startCountPoll` (lib/tab-return.ts). When it goes UP
 *     it asks whether a notification of `refreshOn` arrived (made a host · invited) and calls `onArrival` once per new one.
 *   · `pollEnvelope` — the unread-thread count, the same way.
 *
 * 🔒 A FAILED READ CHANGES NOTHING: the honest reads answer `null`, and `startCountPoll` never draws `null`. The first
 * refusal per mount is reported to Connection Logs (not one a minute).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { readRecentUnreadOfTypes, readUnreadNotificationCount, type NotificationType } from '@/lib/notifications';
import { readUnreadMessageThreads } from '@/lib/chat';
import { startCountPoll } from '@/lib/tab-return';
import { trackFailure } from '@/lib/telemetry/track-error';

/** How far back "arrived" looks — comfortably longer than one poll plus a hidden stretch's catch-up ask. */
const ARRIVAL_WINDOW_MS = 15 * 60_000;

function reportOnce(elementName: string, filePath: string, query: string) {
  let reported = false;
  return (n: number | null) => {
    if (n === null && !reported) {
      reported = true;
      void trackFailure({
        eventType: 'OTHER',
        elementName,
        filePath,
        error: new Error(`${query} could not be read`),
        payload: { query },
      });
    }
    return n;
  };
}

export function pollBell({
  supabase,
  userId,
  shown,
  onValue,
  refreshOn,
  onArrival,
}: {
  supabase: SupabaseClient;
  userId: string;
  /** The count drawn right now — "went up" is measured against it. */
  shown: () => number;
  onValue: (n: number) => void;
  refreshOn: readonly NotificationType[];
  onArrival: () => void;
}): () => void {
  const seen = new Set<string>();
  const report = reportOnce('Unread notifications badge', 'app/_components/unread-bell-badge.tsx', 'readUnreadNotificationCount');
  const checkArrivals = async () => {
    const ids = await readRecentUnreadOfTypes(supabase, userId, refreshOn, ARRIVAL_WINDOW_MS);
    if (!ids) return;
    const fresh = ids.filter((id) => !seen.has(id));
    ids.forEach((id) => seen.add(id));
    if (fresh.length > 0) onArrival();
  };
  return startCountPoll({
    read: async () => report(await readUnreadNotificationCount(supabase, userId)),
    onValue: (n) => {
      const rose = n > shown();
      onValue(n);
      if (rose) void checkArrivals();
    },
  });
}

export function pollEnvelope({
  supabase,
  onValue,
}: {
  supabase: SupabaseClient;
  onValue: (n: number) => void;
}): () => void {
  const report = reportOnce('Unread messages badge', 'app/_components/unread-messages-badge.tsx', 'readUnreadMessageThreads');
  return startCountPoll({
    read: async () => report(await readUnreadMessageThreads(supabase)),
    onValue,
  });
}
