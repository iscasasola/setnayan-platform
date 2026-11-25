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
 *   · `followEnvelope` — what the envelope calls. With `NEXT_PUBLIC_CHAT_LIVE_ENABLED` OFF (the default) its first line
 *     returns `pollEnvelope` itself: the same reads, the same timer, nothing else fetched. ON, it loads
 *     lib/unread-follow.ts, which follows the person's ONE private live channel (lib/user-live-channel.ts) and polls
 *     only while that channel is not live (owner 2026-10-29, "chat arrives instantly").
 *
 * 🔒 A FAILED READ CHANGES NOTHING: the honest reads answer `null`, and `startCountPoll` never draws `null`. The first
 * refusal per mount is reported to Connection Logs (not one a minute).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { readRecentUnreadOfTypes, readUnreadNotificationCount, type NotificationType } from '@/lib/notifications';
import { readUnreadMessageThreads, type UnreadReadFailure } from '@/lib/chat';
import { startCountPoll } from '@/lib/tab-return';
import { isChatLiveEnabled } from '@/lib/chat-live-flag';
import { trackFailure } from '@/lib/telemetry/track-error';

/** How far back "arrived" looks — comfortably longer than one poll plus a hidden stretch's catch-up ask. */
const ARRIVAL_WINDOW_MS = 15 * 60_000;

function reportOnce(elementName: string, filePath: string, query: string) {
  let reported = false;
  return (n: number | null, why?: UnreadReadFailure | null) => {
    if (n === null && !reported) {
      reported = true;
      void trackFailure({
        eventType: 'OTHER',
        elementName,
        filePath,
        // 📶 The reason rides with the row (live fault 21 Nov: eight rows said only "could not be read").
        error: new Error(`${query} could not be read${why ? (why.network ? ' · no answer (network)' : ` · ${why.detail}`) : ''}`),
        payload: why ? { query, network: why.network, detail: why.detail } : { query },
      });
    }
    return n;
  };
}

/** How long the envelope waits for the phone's line to come back before its one second ask. */
export const ENVELOPE_LINE_WAIT_MS = 4_000;

/** Resolves when the browser says it is online again, or after `ms` — whichever is first. */
function waitForLine(ms = ENVELOPE_LINE_WAIT_MS): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve();
    const done = () => {
      window.removeEventListener('online', done);
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(done, ms);
    window.addEventListener('online', done);
  });
}

/**
 * The envelope's count, ONCE MORE after a read that never reached the database.
 *
 * 📶 LIVE FAULT (app_telemetry_logs, "readUnreadMessageThreads could not be read", 8× to 21 Nov). Not one of those reads
 * reached Supabase — the gateway logged every count around them as 200 — so each was a fetch with NO answer: the
 * envelope asks the moment a tab is shown again (`startCountPoll` → `onWake`), and a phone woken from sleep has not got
 * its line back yet. The badge stayed honest (null changes nothing); the count just stayed old until the next minute,
 * and the row said nothing of why. Now a no-answer read waits for the line (the `online` event, at most
 * `ENVELOPE_LINE_WAIT_MS`) and asks once more; a refusal from the database is NOT asked again. Still `null` on a second
 * failure — never a 0. 🛡 lib/the-envelope-asks-again-when-the-line-returns.test.ts
 */
export async function readEnvelopeCount(
  read: (onFail: (why: UnreadReadFailure) => void) => Promise<number | null>,
  wait: () => Promise<void> = waitForLine,
): Promise<{ n: number | null; why: UnreadReadFailure | null }> {
  let why: UnreadReadFailure | null = null;
  const first = await read((w) => (why = w));
  if (first !== null) return { n: first, why: null };
  if (!(why as UnreadReadFailure | null)?.network) return { n: null, why };
  await wait();
  why = null;
  const second = await read((w) => (why = w));
  return { n: second, why: second === null ? why : null };
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
    read: () => askEnvelope(supabase, report),
    onValue,
  });
}

/** The envelope's ONE read of its count: the honest read, once more after no answer, reported with its reason. */
async function askEnvelope(supabase: SupabaseClient, report: ReturnType<typeof reportOnce>): Promise<number | null> {
  const { n, why } = await readEnvelopeCount((onFail) => readUnreadMessageThreads(supabase, onFail));
  return report(n, why);
}

export function followEnvelope({
  supabase,
  userId,
  onValue,
  live = isChatLiveEnabled(),
}: {
  supabase: SupabaseClient;
  userId: string;
  onValue: (n: number) => void;
  /** The kill switch (lib/chat-live-flag.ts) — a parameter only so the tests can hold both sides. */
  live?: boolean;
}): () => void {
  // 🔌 OFF: exactly the envelope as it was — the same poll, and no channel module is even fetched.
  if (!live) return pollEnvelope({ supabase, onValue });

  // ON: poll as before until the live half has loaded; it then takes over (and polls whenever the channel is not live).
  let gone = false;
  let interim: (() => void) | null = pollEnvelope({ supabase, onValue });
  let stop: (() => void) | null = null;
  const report = reportOnce('Unread messages badge', 'app/_components/unread-messages-badge.tsx', 'readUnreadMessageThreads');
  void Promise.all([import('@/lib/unread-follow'), import('@/lib/user-live-channel')])
    .then(([{ followEnvelopeLive }, { subscribeUserLive }]) => {
      if (gone) return;
      interim?.();
      interim = null;
      stop = followEnvelopeLive({
        supabase,
        userId,
        onValue,
        subscribe: subscribeUserLive,
        // The same one-more-ask after a no-answer read, and the same reason on the row, as the poll above.
        read: () => askEnvelope(supabase, report),
      });
    })
    .catch(() => {
      /* the live half did not load (offline, a stale deploy's chunk): the poll above carries on alone */
    });
  return () => {
    gone = true;
    interim?.();
    stop?.();
  };
}
