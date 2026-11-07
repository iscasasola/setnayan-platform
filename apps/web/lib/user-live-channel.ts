/**
 * user-live-channel.ts — THE Supabase half of "chat arrives instantly" (owner 2026-10-29). The state machine — when
 * to join, when to let go, how to back off — is lib/user-live.ts and has no Supabase in it; this file is only the
 * transport it drives, and the per-tab singleton.
 *
 *   · ONE CHANNEL PER TAB, AND ONLY WHILE THE TAB IS IN VIEW. Every caller in a tab (the Messages envelope in the
 *     chrome, an inbox page) shares one `createUserLive` machine; it joins after the page has painted (a random
 *     0–1.5 s), lets go 30 s after the tab is hidden, and closes when the last caller leaves.
 *   · 🔒 PRIVATE. `user:<uid>` with `private: true` and the person's token on the socket (supabase-js does not set it
 *     on INITIAL_SESSION — the same priming as lib/panood-webrtc.ts and the team presence join). The realtime.messages
 *     policy `user_topic_owner_can_read` (migration 20271323859288) admits the uid itself and nobody else; there is no
 *     INSERT policy, so a browser cannot send into anyone's topic.
 *   · NO postgres_changes. The database broadcasts (`realtime.send` from the chat_messages trigger), which Realtime
 *     authorises once at join — not once per subscriber per write.
 *   · NOT REACHED BY THE GUEST HUB. Nothing under app/[slug] imports this (lib/chat-arrives-instantly.test.ts walks
 *     the imports): guests hold no live connection (owner 2026-10-28, "no Event Hub may crash").
 *
 * Loaded only by `import()`, and only when `NEXT_PUBLIC_CHAT_LIVE_ENABLED` is on (lib/chat-live-flag.ts) — with the
 * flag off this file is never fetched.
 */
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { createUserLive, type LiveListener, type Transport, type TransportStatus } from './user-live';

/**
 * Every event the database sends on a `user:` topic. A second one (a heart on a chat message) is added HERE and in its
 * trigger — the channel, the policy and the machine do not change.
 */
export const USER_LIVE_EVENTS = ['chat_message'] as const;
export type UserLiveEvent = (typeof USER_LIVE_EVENTS)[number];

/** The topic a person listens on — the one string the trigger, the policy and this client must agree on. */
export const userTopic = (userId: string) => `user:${userId}`;

function openUserChannel(supabase: SupabaseClient, userId: string): Transport {
  return ({ onPing, onStatus }) => {
    let closed = false;
    let channel: RealtimeChannel | null = null;
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (closed) return;
        const token = data.session?.access_token;
        // Signed out: a private channel would be refused anyway. Say so — the machine backs off, then gives up.
        if (!token) {
          onStatus('CHANNEL_ERROR');
          return;
        }
        supabase.realtime.setAuth(token);
        let ch = supabase.channel(`user:${userId}`, { config: { private: true } });
        for (const event of USER_LIVE_EVENTS) {
          ch = ch.on('broadcast', { event }, (msg: { payload?: unknown }) => {
            const payload = msg?.payload && typeof msg.payload === 'object' ? (msg.payload as Record<string, unknown>) : {};
            onPing({ event, payload });
          });
        }
        channel = ch.subscribe((status: TransportStatus | string) => onStatus(status));
      })
      .catch(() => {
        if (!closed) onStatus('CHANNEL_ERROR');
      });
    return () => {
      closed = true;
      const c = channel;
      channel = null;
      return c ? supabase.removeChannel(c) : undefined;
    };
  };
}

let shared: { userId: string; live: ReturnType<typeof createUserLive> } | null = null;

/**
 * Listen to the signed-in person's own channel. The first caller in a tab starts it; the last to leave closes it.
 * Returns `leave`.
 */
export function subscribeUserLive(supabase: SupabaseClient, userId: string, listener: LiveListener): () => void {
  if (!shared || shared.userId !== userId) {
    // A different person in this tab (an account switch): the old machine has no listeners left by now — its callers
    // unmounted with the old layout — so it is already shut; start a fresh one for the new uid.
    shared = { userId, live: createUserLive({ transport: openUserChannel(supabase, userId) }) };
  }
  return shared.live.subscribe(listener);
}
