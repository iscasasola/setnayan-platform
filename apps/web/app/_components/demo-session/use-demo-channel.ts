'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Shared live-presence hook for the homepage dock-tile demos (Papic today;
 * Panood + 3D Plan reuse it — DECISION_LOG 2026-07-03 "build it GENERIC").
 * One Supabase Realtime channel per demo session (`demo:{sessionId}`),
 * following the same convention as `use-seating-presence.ts`'s
 * `seating-presence:{eventId}` channels.
 *
 * Presence only ever carries `{ joined, registered }` booleans keyed by role
 * ('a' | 'b') — no photos, no face descriptors, no PII. That data is
 * deliberately NOT relayed here in this PR; a demo phone keeps its own
 * embedding in local memory. Broadcast events are for the same reason kept to
 * simple signals for now.
 */

export type DemoPeerState = { joined: boolean; registered: boolean };
export type DemoPresence = { a: DemoPeerState; b: DemoPeerState };

const EMPTY_PEER: DemoPeerState = { joined: false, registered: false };

export function useDemoChannel(sessionId: string, me?: { role: 'a' | 'b'; registered?: boolean }) {
  const [presence, setPresence] = useState<DemoPresence>({ a: EMPTY_PEER, b: EMPTY_PEER });
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const meRef = useRef(me);
  meRef.current = me;

  useEffect(() => {
    if (!sessionId) return;
    const supabase = createClient();
    const channel = supabase.channel(`demo:${sessionId}`, {
      config: { presence: { key: me?.role ?? `viewer-${Math.random().toString(36).slice(2)}` } },
    });
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ registered?: boolean }>();
        setPresence({
          a: state['a']?.[0] ? { joined: true, registered: Boolean(state['a'][0].registered) } : EMPTY_PEER,
          b: state['b']?.[0] ? { joined: true, registered: Boolean(state['b'][0].registered) } : EMPTY_PEER,
        });
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

  return presence;
}
