/**
 * Browser-only WebRTC plumbing for the Live Studio homepage demo — and the
 * codebase's FIRST real video transport, deliberately structured as a
 * reusable lib because it's groundwork for the actual Live Studio media core
 * (owner brief, DECISION_LOG 2026-07-03; see memory
 * `project_setnayan_panood_controller_build`).
 *
 * Topology: each phone is a PUBLISHER (getUserMedia camera + mic →
 * RTCPeerConnection), the desktop control room is the VIEWER (one peer
 * connection per camera slot; it monitors the on-air camera's audio). This
 * transport is track-agnostic — it forwards whatever tracks the publisher
 * adds. Signaling rides an ephemeral Supabase Realtime broadcast
 * channel keyed by the demo session (`demo-rtc:{sessionId}`) — no new infra,
 * same convention family as `demo:{sessionId}` presence and
 * `wall:{eventId}` tiles. Media itself flows peer-to-peer and NEVER touches
 * Supabase or any Setnayan server: nothing is recorded, nothing is stored.
 *
 * ICE: public STUN always, plus an optional short-lived Cloudflare TURN relay
 * passed in by the caller (from `getDemoIceServers`, minted server-side). STUN
 * alone can't traverse symmetric NAT / CGNAT (PH mobile data, client-isolated
 * venue Wi-Fi) — the reason the demo synced for some phones and not others —
 * so a TURN relay is what lets a hard-NAT pair connect at all. If no
 * `iceServers` is passed (or TURN isn't configured) this falls back to
 * STUN-only, and a still-unreachable pair fails cleanly after the timeout.
 *
 * Protocol (phone offers, viewer answers — the side with media initiates):
 *   cam-hello   {slot}                phone announces itself, retries until acked
 *   viewer-hello {}                   viewer announces on subscribe + acks cam-hello
 *   rtc-offer   {slot, sdp}           phone → viewer
 *   rtc-answer  {slot, sdp}           viewer → phone
 *   rtc-ice     {slot, side, candidate}  trickle ICE, both directions
 */

import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type CamSlot = 'a' | 'b';

export type PeerConnectionState =
  | 'waiting' // signaling up, no peer yet
  | 'connecting'
  | 'connected'
  | 'failed';

/** STUN-only fallback when a caller passes no `iceServers` (or TURN is unconfigured). */
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

/** Past this, a peer stuck mid-handshake is declared failed (STUN-only has no TURN fallback to keep waiting for). */
const CONNECT_TIMEOUT_MS = 15_000;
const HELLO_RETRY_MS = 2_000;

function signalChannelName(sessionId: string): string {
  return `demo-rtc:${sessionId}`;
}

type Sdp = { type: RTCSdpType; sdp: string };

function watchConnectionState(
  pc: RTCPeerConnection,
  onState: (state: PeerConnectionState) => void,
): () => void {
  let settled = false;
  const timeout = setTimeout(() => {
    if (!settled) onState('failed');
  }, CONNECT_TIMEOUT_MS);
  const handler = () => {
    if (pc.connectionState === 'connected') {
      settled = true;
      clearTimeout(timeout);
      onState('connected');
    } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      settled = true;
      clearTimeout(timeout);
      onState('failed');
    } else if (pc.connectionState === 'connecting') {
      onState('connecting');
    }
  };
  pc.addEventListener('connectionstatechange', handler);
  return () => {
    clearTimeout(timeout);
    pc.removeEventListener('connectionstatechange', handler);
  };
}

export type CameraPublisher = { close: () => void };

/**
 * Phone side: publish a local MediaStream as camera `slot`. Announces itself
 * until the viewer acks, then offers; re-offers if the viewer says hello
 * again while this peer isn't connected (e.g. the answer got lost in flight).
 */
export function publishDemoCamera({
  sessionId,
  slot,
  stream,
  onState,
  iceServers = DEFAULT_ICE_SERVERS,
}: {
  sessionId: string;
  slot: CamSlot;
  stream: MediaStream;
  onState: (state: PeerConnectionState) => void;
  /** STUN + (ideally) a minted TURN relay from `getDemoIceServers`; STUN-only if omitted. */
  iceServers?: RTCIceServer[];
}): CameraPublisher {
  const supabase = createClient();
  let pc: RTCPeerConnection | null = null;
  let unwatch: (() => void) | null = null;
  let helloTimer: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const channel: RealtimeChannel = supabase.channel(signalChannelName(sessionId), {
    config: { broadcast: { self: false } },
  });

  const send = (event: string, payload: Record<string, unknown>) => {
    void channel.send({ type: 'broadcast', event, payload });
  };

  const stopHello = () => {
    if (helloTimer) {
      clearInterval(helloTimer);
      helloTimer = null;
    }
  };

  const startOffer = async () => {
    if (closed || (pc && pc.connectionState === 'connected')) return;
    stopHello();
    pc?.close();
    unwatch?.();
    pc = new RTCPeerConnection({ iceServers });
    unwatch = watchConnectionState(pc, onState);
    for (const track of stream.getTracks()) pc.addTrack(track, stream);
    pc.onicecandidate = (e) => {
      if (e.candidate) send('rtc-ice', { slot, side: 'cam', candidate: e.candidate.toJSON() });
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send('rtc-offer', { slot, sdp: { type: offer.type, sdp: offer.sdp } });
    onState('connecting');
  };

  channel
    .on('broadcast', { event: 'viewer-hello' }, () => {
      void startOffer();
    })
    .on('broadcast', { event: 'rtc-answer' }, ({ payload }) => {
      const p = payload as { slot?: CamSlot; sdp?: Sdp };
      if (p.slot !== slot || !p.sdp || !pc) return;
      void pc.setRemoteDescription(new RTCSessionDescription(p.sdp)).catch(() => onState('failed'));
    })
    .on('broadcast', { event: 'rtc-ice' }, ({ payload }) => {
      const p = payload as { slot?: CamSlot; side?: string; candidate?: RTCIceCandidateInit };
      if (p.slot !== slot || p.side !== 'viewer' || !p.candidate || !pc) return;
      void pc.addIceCandidate(p.candidate).catch(() => {});
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED' && !closed) {
        // Announce until the viewer acks with viewer-hello (which triggers the
        // offer) — covers either side subscribing first.
        send('cam-hello', { slot });
        helloTimer = setInterval(() => {
          if (pc && pc.connectionState === 'connected') stopHello();
          else send('cam-hello', { slot });
        }, HELLO_RETRY_MS);
      }
    });

  return {
    close: () => {
      closed = true;
      stopHello();
      unwatch?.();
      pc?.close();
      pc = null;
      void supabase.removeChannel(channel);
    },
  };
}

export type ControlRoomViewer = { close: () => void };

/**
 * Desktop side: receive both camera slots. Fires `onTrack(slot, stream)` when
 * a camera's video arrives and `onSlotState(slot, state)` as each peer's
 * connection progresses/fails.
 */
export function watchDemoCameras({
  sessionId,
  onTrack,
  onSlotState,
  iceServers = DEFAULT_ICE_SERVERS,
}: {
  sessionId: string;
  onTrack: (slot: CamSlot, stream: MediaStream) => void;
  onSlotState: (slot: CamSlot, state: PeerConnectionState) => void;
  /** STUN + (ideally) a minted TURN relay from `getDemoIceServers`; STUN-only if omitted. */
  iceServers?: RTCIceServer[];
}): ControlRoomViewer {
  const supabase = createClient();
  const pcs: Partial<Record<CamSlot, RTCPeerConnection>> = {};
  const unwatchers: Partial<Record<CamSlot, () => void>> = {};
  let closed = false;

  const channel: RealtimeChannel = supabase.channel(signalChannelName(sessionId), {
    config: { broadcast: { self: false } },
  });

  const send = (event: string, payload: Record<string, unknown>) => {
    void channel.send({ type: 'broadcast', event, payload });
  };

  const answerOffer = async (slot: CamSlot, sdp: Sdp) => {
    if (closed) return;
    // A fresh offer for a slot replaces any previous peer (phone retried).
    pcs[slot]?.close();
    unwatchers[slot]?.();
    const pc = new RTCPeerConnection({ iceServers });
    pcs[slot] = pc;
    unwatchers[slot] = watchConnectionState(pc, (state) => onSlotState(slot, state));
    pc.onicecandidate = (e) => {
      if (e.candidate) send('rtc-ice', { slot, side: 'viewer', candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      onTrack(slot, stream);
    };
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    send('rtc-answer', { slot, sdp: { type: answer.type, sdp: answer.sdp } });
  };

  channel
    .on('broadcast', { event: 'cam-hello' }, ({ payload }) => {
      const p = payload as { slot?: CamSlot };
      if (p.slot !== 'a' && p.slot !== 'b') return;
      // Ack so the phone stops hello-ing and sends (or re-sends) its offer —
      // but only nudge a slot that isn't already connected. Surfacing
      // 'connecting' here (before any offer lands) lets the control room flip
      // that camera tile from "waiting for a scan" the moment a phone joins.
      if (pcs[p.slot]?.connectionState !== 'connected') {
        onSlotState(p.slot, 'connecting');
        send('viewer-hello', {});
      }
    })
    .on('broadcast', { event: 'rtc-offer' }, ({ payload }) => {
      const p = payload as { slot?: CamSlot; sdp?: Sdp };
      if ((p.slot !== 'a' && p.slot !== 'b') || !p.sdp) return;
      void answerOffer(p.slot, p.sdp).catch(() => onSlotState(p.slot as CamSlot, 'failed'));
    })
    .on('broadcast', { event: 'rtc-ice' }, ({ payload }) => {
      const p = payload as { slot?: CamSlot; side?: string; candidate?: RTCIceCandidateInit };
      if ((p.slot !== 'a' && p.slot !== 'b') || p.side !== 'cam' || !p.candidate) return;
      void pcs[p.slot]?.addIceCandidate(p.candidate).catch(() => {});
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED' && !closed) send('viewer-hello', {});
    });

  return {
    close: () => {
      closed = true;
      for (const slot of ['a', 'b'] as const) {
        unwatchers[slot]?.();
        pcs[slot]?.close();
        delete pcs[slot];
      }
      void supabase.removeChannel(channel);
    },
  };
}
