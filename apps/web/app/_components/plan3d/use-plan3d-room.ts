'use client';

/**
 * use-plan3d-room — the React + Supabase Realtime wrapper around the pure
 * `lib/plan3d-room` core. One per-event channel (`plan3d-room:{eventId}`) that
 * (a) tracks PRESENCE (who's live in this event's 3D room) and (b) broadcasts
 * the LOCAL character's {pos,vel,heading,moving} at ~8 Hz only-while-moving, and
 * folds incoming peer frames + greets into a `RemoteMap` for the renderer.
 *
 * Conventions mirror use-seating-presence.ts exactly: browser `createClient`
 * called inside the effect, `feature:{eventId}` channel keyed by the unguessable
 * event UUID, `broadcast:{self:false}`, a `lastSentRef` ms-gate throttle, mutable
 * per-frame values read through refs (so the channel subscribes once), teardown
 * via `removeChannel`. No PII on the wire beyond a display name + colour.
 *
 * FLAG-GATED + OFFLINE-FIRST: when `NEXT_PUBLIC_PLAN3D_SHARED_ROOM !== 'true'`
 * (default) OR there's no eventId/identity, the effect never opens a channel —
 * `remotes` stays empty and `sendMove`/`greet` are no-ops, so every surface
 * renders exactly as it does today (single-player). If the channel drops, the
 * room silently degrades to single-player and rejoins when it can.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  reconcilePresence,
  applyMove,
  applyGreet,
  pruneRemotes,
  shouldBroadcastMove,
  GREET_WAVE_MS,
  type RemoteMap,
  type MoveMsg,
  type GreetMsg,
  type RoomPeer,
} from '@/lib/plan3d-room';

/** Build-time flag. Next.js inlines NEXT_PUBLIC_* so an unset flag is a
 *  byte-identical off path. Default OFF (the desktop-oauth-buttons idiom). */
export const PLAN3D_SHARED_ROOM_ENABLED = process.env.NEXT_PUBLIC_PLAN3D_SHARED_ROOM === 'true';

export type LocalPlayer = { id: string; name: string; color: string };

export type Plan3dRoom = {
  /** Live peers to render (present + recently-left, still walking home). */
  remotes: RemoteMap;
  /** Present peers + self — the "N here now" count (1 when alone/offline). */
  onlineCount: number;
  /** Broadcast the local character's frame (throttled + only-while-moving). */
  sendMove: (x: number, z: number, vx: number, vz: number, heading: number, moving: boolean) => void;
  /** Wave at a peer (or `null` = the whole room). Plays locally + broadcasts. */
  greet: (toId: string | null) => void;
  /** Local-clock ms until the LOCAL figure should play its optimistic wave. */
  selfGreetUntil: number;
  /** True only when the channel machinery is live (flag on + identity + event). */
  enabled: boolean;
};

const EMPTY: RemoteMap = new Map();

function isMoveMsg(p: unknown): p is MoveMsg {
  if (!p || typeof p !== 'object') return false;
  const m = p as Record<string, unknown>;
  return (
    typeof m.id === 'string' &&
    typeof m.x === 'number' &&
    typeof m.z === 'number' &&
    typeof m.vx === 'number' &&
    typeof m.vz === 'number' &&
    typeof m.h === 'number' &&
    typeof m.m === 'boolean'
  );
}

function isGreetMsg(p: unknown): p is GreetMsg {
  if (!p || typeof p !== 'object') return false;
  const g = p as Record<string, unknown>;
  return typeof g.from === 'string' && (g.to === null || typeof g.to === 'string');
}

export function usePlan3dRoom(eventId: string | null | undefined, me: LocalPlayer | null): Plan3dRoom {
  const [remotes, setRemotes] = useState<RemoteMap>(EMPTY);
  const [selfGreetUntil, setSelfGreetUntil] = useState(0);

  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const lastSentRef = useRef(0);
  const wasMovingRef = useRef(false);
  const meRef = useRef<LocalPlayer | null>(me);
  meRef.current = me;

  const active = PLAN3D_SHARED_ROOM_ENABLED && !!eventId && !!me;
  const meId = me?.id;
  const meName = me?.name;
  const meColor = me?.color;

  useEffect(() => {
    if (!active || !eventId || !meId) return;
    const supabase = createClient();
    const channel = supabase.channel(`plan3d-room:${eventId}`, {
      config: { presence: { key: meId }, broadcast: { self: false } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ name: string; color: string }>();
        const roster: RoomPeer[] = [];
        for (const [id, metas] of Object.entries(state)) {
          const meta = metas[0];
          if (!meta) continue;
          roster.push({ id, name: meta.name || 'Guest', color: meta.color || '#c9a24a' });
        }
        setRemotes((prev) => reconcilePresence(prev, roster, meId, Date.now()));
      })
      .on('broadcast', { event: 'move' }, ({ payload }) => {
        if (!isMoveMsg(payload)) return;
        setRemotes((prev) => applyMove(prev, payload, meId, Date.now()));
      })
      .on('broadcast', { event: 'greet' }, ({ payload }) => {
        if (!isGreetMsg(payload)) return;
        setRemotes((prev) => applyGreet(prev, payload, meId, Date.now()));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void channel.track({ name: meRef.current?.name ?? 'Guest', color: meRef.current?.color ?? '#c9a24a' });
        }
      });

    channelRef.current = channel;
    // Drop peers that left presence long enough ago to have walked home.
    const prune = setInterval(() => setRemotes((prev) => pruneRemotes(prev, Date.now(), 8000)), 2000);

    return () => {
      channelRef.current = null;
      clearInterval(prune);
      void supabase.removeChannel(channel);
      setRemotes(EMPTY);
    };
  }, [active, eventId, meId]);

  // Re-track when the display name/colour changes without re-joining the channel.
  useEffect(() => {
    const ch = channelRef.current;
    if (ch && ch.state === 'joined' && meName) {
      void ch.track({ name: meName, color: meColor ?? '#c9a24a' });
    }
  }, [meName, meColor]);

  const sendMove = useCallback(
    (x: number, z: number, vx: number, vz: number, heading: number, moving: boolean) => {
      const ch = channelRef.current;
      const meNow = meRef.current;
      if (!ch || !meNow || ch.state !== 'joined') return;
      const now = Date.now();
      if (!shouldBroadcastMove(now, lastSentRef.current, moving, wasMovingRef.current)) {
        wasMovingRef.current = moving;
        return;
      }
      lastSentRef.current = now;
      wasMovingRef.current = moving;
      const payload: MoveMsg = { id: meNow.id, x, z, vx, vz, h: heading, m: moving, t: now };
      void ch.send({ type: 'broadcast', event: 'move', payload });
    },
    [],
  );

  const greet = useCallback((toId: string | null) => {
    // Play our own wave optimistically (broadcast:self is off, so we never echo).
    setSelfGreetUntil(Date.now() + GREET_WAVE_MS);
    const ch = channelRef.current;
    const meNow = meRef.current;
    if (!ch || !meNow || ch.state !== 'joined') return;
    const payload: GreetMsg = { from: meNow.id, to: toId, t: Date.now() };
    void ch.send({ type: 'broadcast', event: 'greet', payload });
  }, []);

  const onlineCount = useMemo(() => {
    if (!active) return 1;
    let present = 0;
    for (const p of remotes.values()) if (p.present) present += 1;
    return present + 1; // + self
  }, [active, remotes]);

  return { remotes, onlineCount, sendMove, greet, selfGreetUntil, enabled: active };
}
