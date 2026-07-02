'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Shared live-presence + broadcast hook for the homepage dock-tile demos
 * (Papic today; Panood + 3D Plan reuse it — DECISION_LOG 2026-07-03 "build it
 * GENERIC"). One Supabase Realtime channel per demo session
 * (`demo:{sessionId}`), following the same convention as
 * `use-seating-presence.ts`'s `seating-presence:{eventId}` channels.
 *
 * Presence carries `{ joined, registered }` booleans keyed by role ('a'|'b').
 *
 * PR-2 adds BROADCAST — the peer-to-peer relay the demo's privacy design is
 * built on: face vectors, captured frames, and the pop-up-set style travel
 * transiently over this channel between the participants and the desktop
 * mirror, and are NEVER persisted anywhere (no table, no bucket — a page
 * refresh forgets them). Every message uses the single 'demo' event with a
 * typed payload, so the socket contract stays one line wide.
 */

export type DemoPeerState = { joined: boolean; registered: boolean };
export type DemoPresence = { a: DemoPeerState; b: DemoPeerState };
export type DemoRole = 'a' | 'b';

/** The transient peer-to-peer messages. NOTHING here is ever persisted. */
export type DemoMessage =
  /** A phone finished on-device registration — its vector, for the peer's tagging only. */
  | { type: 'face'; role: DemoRole; vector: number[] }
  /** A late joiner asks peers to re-send their 'face' (broadcast doesn't replay history). */
  | { type: 'face-request' }
  /** A captured frame (compressed data-URL) + who was recognized in it. */
  | {
      type: 'photo';
      id: string;
      from: DemoRole;
      dataUrl: string;
      /** roles recognized in the frame (on-device matching) */
      tags: DemoRole[];
      shotNumber: number;
      remaining: number;
    }
  /** The desktop pop-up set the session style (PAPIC_STYLES id). */
  | { type: 'style'; style: string }
  /** A phone asks the desktop to re-send the current style. */
  | { type: 'style-request' };

const EMPTY_PEER: DemoPeerState = { joined: false, registered: false };

export function useDemoChannel(
  sessionId: string,
  me?: { role: DemoRole; registered?: boolean },
  onMessage?: (msg: DemoMessage) => void,
): { presence: DemoPresence; send: (msg: DemoMessage) => void } {
  const [presence, setPresence] = useState<DemoPresence>({ a: EMPTY_PEER, b: EMPTY_PEER });
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const meRef = useRef(me);
  meRef.current = me;
  // The handler lives in a ref so a new callback identity never tears down the
  // socket — the channel subscribes once per session.
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!sessionId) return;
    const supabase = createClient();
    const channel = supabase.channel(`demo:${sessionId}`, {
      config: {
        presence: { key: me?.role ?? `viewer-${Math.random().toString(36).slice(2)}` },
        // Senders render their own sends locally; no need for the socket echo.
        broadcast: { self: false },
      },
    });
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ registered?: boolean }>();
        setPresence({
          a: state['a']?.[0] ? { joined: true, registered: Boolean(state['a'][0].registered) } : EMPTY_PEER,
          b: state['b']?.[0] ? { joined: true, registered: Boolean(state['b'][0].registered) } : EMPTY_PEER,
        });
      })
      .on('broadcast', { event: 'demo' }, ({ payload }) => {
        if (payload && typeof payload === 'object' && 'type' in payload) {
          onMessageRef.current?.(payload as DemoMessage);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && meRef.current) {
          void channel.track({ registered: Boolean(meRef.current.registered) });
        }
      });
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- role is fixed per mount; `registered` re-publishes below
  }, [sessionId, me?.role]);

  // A phone that finishes face registration AFTER joining re-publishes so the
  // desktop overlay flips that side to "✓ Face registered" live.
  useEffect(() => {
    const ch = channelRef.current;
    if (ch && ch.state === 'joined' && me) {
      void ch.track({ registered: Boolean(me.registered) });
    }
  }, [me?.registered, me]);

  const send = useCallback((msg: DemoMessage) => {
    const ch = channelRef.current;
    if (!ch) return;
    void ch.send({ type: 'broadcast', event: 'demo', payload: msg });
  }, []);

  return { presence, send };
}
