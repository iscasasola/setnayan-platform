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
 *
 * RELIABLE DELIVERY (relay fix): Supabase broadcast has NO history/replay and
 * only delivers to a socket that is already 'joined'. The face-vector handshake
 * (`face` / `face-request`) fires early in the phone flow — squarely inside the
 * join window on a slow mobile/cellular WS handshake — so a naive send would be
 * silently dropped and never recovered, permanently stranding the pair with no
 * peer vector to tag against ("No one recognized"). So `send` now QUEUES until
 * the socket is truly joined and flushes on SUBSCRIBED, which also re-fires on
 * every automatic REJOIN — self-healing a mid-session reconnect (presence + any
 * queued sends are re-asserted). No broadcast is ever issued into the void.
 */

export type DemoPeerState = { joined: boolean; registered: boolean };
export type DemoPresence = { a: DemoPeerState; b: DemoPeerState };
export type DemoRole = 'a' | 'b';

/**
 * Per-photo diagnostic for the demo — demo-only, NO PII (four booleans, a face
 * count, and one distance). It lets an untagged shot explain WHY it missed
 * instead of a blank "No one recognized", so a single live two-phone test names
 * the failing stage (model / registration / relay / match distance).
 */
export type DemoDiag = {
  /** the face model URL is configured (NEXT_PUBLIC_FACE_MODEL_URL set) */
  model: boolean;
  /** this phone holds its OWN registered vector */
  you: boolean;
  /** this phone holds the PEER's relayed vector (the relay-fix linchpin) */
  friend: boolean;
  /** faces detected in the captured frame */
  faces: number;
  /** closest euclidean distance to any known vector, or null if nothing to compare */
  closest: number | null;
};

/**
 * Human sentence for an untagged shot, derived from its diagnostic. Shared by
 * the phone caption and the desktop mirror so both explain a miss identically.
 * Order matters: earliest-in-the-pipeline failure wins.
 */
export function untaggedReason(d?: DemoDiag | null): string {
  if (!d) return 'No one recognized';
  if (!d.model) return 'Face matching is warming up';
  if (d.faces === 0) return 'No face in the frame';
  if (!d.friend) return 'Waiting for your friend’s face to sync';
  if (d.closest != null && d.closest <= 0.75) return `So close — best match ${d.closest.toFixed(2)}`;
  return 'No one recognized';
}

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
      /** demo-only, no-PII diagnostic so a miss can say why (optional for back-compat) */
      diag?: DemoDiag;
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
  // Outbound messages issued before the socket is 'joined' (or during a
  // reconnect) queue here and flush on SUBSCRIBED — broadcast has no replay.
  const outboxRef = useRef<DemoMessage[]>([]);
  const meRef = useRef(me);
  meRef.current = me;
  // The handler lives in a ref so a new callback identity never tears down the
  // socket — the channel subscribes once per session.
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const flushOutbox = useCallback(() => {
    const ch = channelRef.current;
    if (!ch || ch.state !== 'joined') return;
    const queued = outboxRef.current;
    outboxRef.current = [];
    for (const msg of queued) {
      void ch.send({ type: 'broadcast', event: 'demo', payload: msg });
    }
  }, []);

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
        // Fires on the initial join AND on every automatic REJOIN after a drop,
        // so re-tracking presence and flushing the outbox here also self-heals a
        // mobile reconnect — presence and any queued sends are re-asserted.
        if (status === 'SUBSCRIBED') {
          if (meRef.current) void channel.track({ registered: Boolean(meRef.current.registered) });
          flushOutbox();
        }
      });
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      outboxRef.current = [];
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- role is fixed per mount; `registered` re-publishes below
  }, [sessionId, me?.role, flushOutbox]);

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
    // Send immediately only when the socket is truly joined; otherwise queue and
    // let the SUBSCRIBED handler flush it — no broadcast is issued into the void.
    if (ch && ch.state === 'joined') {
      void ch.send({ type: 'broadcast', event: 'demo', payload: msg });
    } else {
      outboxRef.current.push(msg);
    }
  }, []);

  return { presence, send };
}
