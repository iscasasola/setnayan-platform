'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { nextPeers, type PresenceMeta, type PresencePeer } from './seating-presence-peers';

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

export type { PresencePeer } from './seating-presence-peers';

/** What this client publishes about its own lock state onto presence. */
export type LockBroadcast = {
  lockHolderId: string | null;
  lockHolderLabel: string | null;
  lockHeartbeatAt: string | null;
};

export function useSeatingPresence(
  eventId: string,
  me: { id: string; name: string },
  selectedTableId: string | null,
  /** This client's view of the editor lock, re-broadcast on every change. */
  lock: LockBroadcast = { lockHolderId: null, lockHolderLabel: null, lockHeartbeatAt: null },
) {
  const [peers, setPeersState] = useState<Map<string, PresencePeer>>(() => new Map());
  // 🔂 The list as last drawn, read OUTSIDE a state updater: an unchanged sync must not even call setState — React
  // renders a component once more before bailing out of a same-value update that lands right after another update.
  const peersRef = useRef(peers);
  const setPeers = (next: Map<string, PresencePeer>) => {
    if (next === peersRef.current) return;
    peersRef.current = next;
    setPeersState(next);
  };
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const lastSentRef = useRef(0);
  // Latest selection readable from the subscribe callback without re-joining.
  const selectedRef = useRef<string | null>(selectedTableId);
  selectedRef.current = selectedTableId;
  // Same for the lock snapshot (read inside subscribe + track without re-join).
  const lockRef = useRef<LockBroadcast>(lock);
  lockRef.current = lock;

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`seating-presence:${eventId}`, {
      config: { presence: { key: me.id } },
    });
    channel
      .on('presence', { event: 'sync' }, () => {
        // 🔂 The same Map back when the others are unchanged (my own join / re-track) — no editor render for nothing.
        setPeers(nextPeers(peersRef.current, channel.presenceState<PresenceMeta>(), me.id));
      })
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        const p = payload as { id?: string; x?: number; y?: number } | null;
        if (!p || typeof p.id !== 'string' || p.id === me.id) return;
        if (typeof p.x !== 'number' || typeof p.y !== 'number') return;
        const peer = peersRef.current.get(p.id);
        if (!peer) return;
        const next = new Map(peersRef.current);
        next.set(p.id, { ...peer, cursor: { x: p.x, y: p.y, ts: Date.now() } });
        setPeers(next);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void channel.track({
            name: me.name,
            table: selectedRef.current,
            lockHolderId: lockRef.current.lockHolderId,
            lockHolderLabel: lockRef.current.lockHolderLabel,
            lockHeartbeatAt: lockRef.current.lockHeartbeatAt,
          });
        }
      });
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [eventId, me.id, me.name]);

  // Selection OR lock state changed → re-publish so the others see "editing
  // Table 7" and "X holds the editor lock" without re-joining the channel.
  useEffect(() => {
    const ch = channelRef.current;
    if (ch && ch.state === 'joined') {
      void ch.track({
        name: me.name,
        table: selectedTableId,
        lockHolderId: lock.lockHolderId,
        lockHolderLabel: lock.lockHolderLabel,
        lockHeartbeatAt: lock.lockHeartbeatAt,
      });
    }
  }, [selectedTableId, me.name, lock.lockHolderId, lock.lockHolderLabel, lock.lockHeartbeatAt]);

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
