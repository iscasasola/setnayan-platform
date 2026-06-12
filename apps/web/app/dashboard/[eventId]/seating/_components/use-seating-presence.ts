'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Live presence for the seat-plan editor — who's here, which table each person
 * has selected ("Ana is editing Table 7"), and live cursors on the canvas.
 *
 * Transport follows the established `wall:{eventId}` convention: one Supabase
 * Realtime channel per event, keyed by the event's unguessable UUID. Presence
 * (low-frequency: join/leave + selected table) rides the presence API; cursors
 * (high-frequency) ride broadcast, throttled to ~12 msgs/s. Payloads carry
 * only a first name + canvas-percent coordinates — no guest or event data.
 * (Private-channel authorization via realtime.messages RLS is the planned
 * hardening pass, alongside the wall channel.)
 */

export type PresencePeer = {
  id: string;
  name: string;
  color: string;
  /** table_id this peer currently has selected (their popup is open on it) */
  table: string | null;
  /** last cursor position in canvas percent, with a freshness timestamp */
  cursor: { x: number; y: number; ts: number } | null;
};

// Same earthy accents as guest groups — deterministic per user id.
const PEER_COLORS = ['#C97B4B', '#5B8FA0', '#7BA05B', '#A05B8F', '#C2913B', '#6B7FB0', '#B0655B', '#4FA08C'];
function peerColor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return PEER_COLORS[Math.abs(h) % PEER_COLORS.length]!;
}

export function useSeatingPresence(
  eventId: string,
  me: { id: string; name: string },
  selectedTableId: string | null,
) {
  const [peers, setPeers] = useState<Map<string, PresencePeer>>(new Map());
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const lastSentRef = useRef(0);
  // Latest selection readable from the subscribe callback without re-joining.
  const selectedRef = useRef<string | null>(selectedTableId);
  selectedRef.current = selectedTableId;

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`seating-presence:${eventId}`, {
      config: { presence: { key: me.id } },
    });
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ name: string; table: string | null }>();
        setPeers((prev) => {
          const next = new Map<string, PresencePeer>();
          for (const [key, metas] of Object.entries(state)) {
            if (key === me.id) continue;
            const meta = metas[0];
            if (!meta) continue;
            const old = prev.get(key);
            next.set(key, {
              id: key,
              name: meta.name || 'Someone',
              color: peerColor(key),
              table: meta.table ?? null,
              cursor: old?.cursor ?? null,
            });
          }
          return next;
        });
      })
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        const p = payload as { id?: string; x?: number; y?: number } | null;
        if (!p || typeof p.id !== 'string' || p.id === me.id) return;
        if (typeof p.x !== 'number' || typeof p.y !== 'number') return;
        setPeers((prev) => {
          const peer = prev.get(p.id!);
          if (!peer) return prev;
          const next = new Map(prev);
          next.set(p.id!, { ...peer, cursor: { x: p.x!, y: p.y!, ts: Date.now() } });
          return next;
        });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void channel.track({ name: me.name, table: selectedRef.current });
        }
      });
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [eventId, me.id, me.name]);

  // Selection changed → update what the others see ("editing Table 7").
  useEffect(() => {
    const ch = channelRef.current;
    if (ch && ch.state === 'joined') {
      void ch.track({ name: me.name, table: selectedTableId });
    }
  }, [selectedTableId, me.name]);

  // Throttled live cursor (canvas-percent coords; ~12 msgs/s ceiling).
  const sendCursor = (x: number, y: number) => {
    const now = Date.now();
    if (now - lastSentRef.current < 80) return;
    lastSentRef.current = now;
    const ch = channelRef.current;
    if (ch && ch.state === 'joined') {
      void ch.send({ type: 'broadcast', event: 'cursor', payload: { id: me.id, x, y } });
    }
  };

  return { peers, sendCursor };
}
