/**
 * unread-follow.ts — the Messages envelope FOLLOWING the person's live channel instead of only polling (owner
 * 2026-10-29, "chat arrives instantly"). Loaded by `followEnvelope` (lib/unread-polls.ts) ONLY when
 * `NEXT_PUBLIC_CHAT_LIVE_ENABLED` is on; with the flag off this file is never fetched and the envelope polls exactly
 * as it did before.
 *
 * What it does, by the channel's status (lib/user-live.ts):
 *
 *   live            — NO poll. A `chat_message` ping re-asks the count (a burst folds into one leading + one trailing
 *                     read, `PING_REREAD_GAP_MS` apart). Becoming live re-asks once — the catch-up for whatever
 *                     arrived while it was joining, down or hidden.
 *   paused          — the tab is out of view: no poll (a hidden tab never asks anyway), no channel.
 *   joining · down · off
 *                   — today's 60 s poll (`startCountPoll`), unchanged. Going down does NOT re-ask: after an outage
 *                     every tab fails at once (and up to six times each), and a re-ask per failure was measured to
 *                     double the RPCs (scripts/loadtest-chat-live.mts); the poll's next minute is the catch-up, as on main.
 *
 * 🔒 THE SAME HONEST READ. Every re-ask is `readUnreadMessageThreads` — `null` when it could not read, and `null` is
 * never drawn (no false 0). A ping carries ids only; it can make the envelope ASK, never tell it a number.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { readUnreadMessageThreads } from '@/lib/chat';
import { browserTabEnv, startCountPoll, type TabEnv } from '@/lib/tab-return';
import { coalesce, type LiveListener, type LiveStatus } from '@/lib/user-live';

/** A burst of pings is at most one read now and one read this long after it. */
export const PING_REREAD_GAP_MS = 1_000;

type Subscribe = (supabase: SupabaseClient, userId: string, listener: LiveListener) => () => void;

export function followEnvelopeLive({
  supabase,
  userId,
  onValue,
  report = (n) => n,
  subscribe,
  read = () => readUnreadMessageThreads(supabase),
  env = browserTabEnv(),
}: {
  supabase: SupabaseClient;
  userId: string;
  onValue: (n: number) => void;
  /** Sees every read's answer (the first refusal goes to Connection Logs) and hands it back. */
  report?: (n: number | null) => number | null;
  /** The channel — lib/user-live-channel.ts `subscribeUserLive`, passed in so the tests drive a fake one. */
  subscribe: Subscribe;
  read?: () => Promise<number | null>;
  env?: TabEnv;
}): () => void {
  let stopped = false;
  let stopPoll: (() => void) | null = null;

  const ask = async () => report(await read());
  const draw = (n: number | null) => {
    // 🔒 null = could not read. Leave what is drawn alone.
    if (!stopped && typeof n === 'number' && Number.isFinite(n)) onValue(n);
  };
  const reread = coalesce(
    async () => {
      if (stopped) return;
      draw(await ask());
    },
    PING_REREAD_GAP_MS,
    env,
  );

  const poll = (on: boolean) => {
    if (on && !stopPoll && !stopped) stopPoll = startCountPoll({ read: ask, onValue: draw, env });
    if (!on && stopPoll) {
      stopPoll();
      stopPoll = null;
    }
  };

  // Until the channel says otherwise, the envelope polls exactly as it does with the flag off.
  poll(true);
  let prev: LiveStatus | null = null;
  const leave = subscribe(supabase, userId, {
    onPing: (p) => {
      if (p.event === 'chat_message') reread();
    },
    onStatus: (s) => {
      if (stopped) return;
      poll(s !== 'live' && s !== 'paused');
      if (s === 'live' && prev !== 'live') reread();
      prev = s;
    },
  });

  return () => {
    stopped = true;
    poll(false);
    leave();
  };
}

/** The inbox re-renders at most once per this long, however many pings land (one leading + one trailing). */
export const INBOX_REFRESH_GAP_MS = 5_000;

/**
 * An INBOX page (the couple's Messages, the supplier's Chats) following the same channel: a `chat_message` ping
 * re-renders the page (`refresh` = `router.refresh()`), coalesced to one leading + one trailing per
 * `INBOX_REFRESH_GAP_MS`; coming back live after the channel was down, paused or given up re-renders once (the
 * catch-up). Never a poll of its own — with the channel down the inbox is exactly as on main (current on navigation).
 */
export function followInboxLive({
  supabase,
  userId,
  refresh,
  subscribe,
  env = browserTabEnv(),
}: {
  supabase: SupabaseClient;
  userId: string;
  refresh: () => void;
  subscribe: Subscribe;
  env?: TabEnv;
}): () => void {
  let stopped = false;
  let missed = false;
  const run = coalesce(
    () => {
      if (!stopped) refresh();
    },
    INBOX_REFRESH_GAP_MS,
    env,
  );
  const leave = subscribe(supabase, userId, {
    onPing: (p) => {
      if (p.event === 'chat_message') run();
    },
    onStatus: (s) => {
      if (stopped) return;
      if (s === 'down' || s === 'paused' || s === 'off') missed = true;
      if (s === 'live' && missed) {
        missed = false;
        run();
      }
    },
  });
  return () => {
    stopped = true;
    leave();
  };
}
