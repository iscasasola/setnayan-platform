/**
 * Browser-only WebRTC transport for the REAL Live Studio multicam controller —
 * a direct generalization of the proven homepage-demo transport
 * (lib/demo-webrtc.ts, DECISION_LOG 2026-07-03). Same protocol, same STUN-only
 * ICE, same ephemeral Supabase Realtime signaling — but keyed on the EVENT
 * (`panood-rtc:{eventId}`) with an arbitrary string `slot` per camera (the
 * control room uses the same `cam{index}` key as a program source, so a slot
 * maps 1:1 to what's on air). So it carries any number of cameras instead of the
 * demo's fixed two.
 *
 * Topology: each operator phone is a PUBLISHER (getUserMedia → RTCPeerConnection);
 * the couple's control room is the VIEWER (one peer connection per live camera
 * slot). Media flows peer-to-peer and NEVER touches Supabase or any Setnayan
 * server — nothing is recorded, nothing is stored (owner-locked light-privacy).
 * ICE: public STUN always, plus an optional short-lived Cloudflare TURN relay
 * passed in by the caller (from `getPanoodIceServers`, minted server-side). STUN
 * alone can't traverse symmetric NAT / CGNAT — the norm for operator phones on
 * their own mobile data at a venue — so a TURN relay is what lets those cameras
 * reach the control room at all. If no `iceServers` is passed (or TURN isn't
 * configured) this falls back to STUN-only, and a still-unreachable camera fails
 * cleanly after the timeout. (Same pattern the homepage demo proved — lib/demo-webrtc.ts.)
 *
 * Gated by NEXT_PUBLIC_PANOOD_STREAMING_ENABLED (panoodStreamingEnabled) — the
 * callers only invoke this once the owner has flipped real streaming on for a
 * real-event test.
 *
 * Protocol (phone offers, viewer answers — the side with media initiates):
 *   cam-hello    {slot}                    phone announces itself, retries until acked
 *   viewer-hello {}                         viewer announces on subscribe + acks cam-hello
 *   rtc-offer    {slot, sdp}                phone → viewer
 *   rtc-answer   {slot, sdp}                viewer → phone
 *   rtc-ice      {slot, side, candidate}    trickle ICE, both directions
 */

import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { reportConnectionType } from '@/lib/webrtc-telemetry';

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

function signalChannelName(eventId: string): string {
  return `panood-rtc:${eventId}`;
}

/**
 * Channel options for the signaling topic.
 *
 * `private: true` is a SECURITY REQUIREMENT, not a preference. Supabase evaluates RLS on
 * `realtime.messages` for PRIVATE channels only — a public channel is unauthenticated by
 * definition, and this one is keyed on an event id that travels in dashboard URLs and QR links.
 *
 * Without it, the policies in migration 20270829134804 are dead code and ANY stranger holding an
 * event id could answer a camera's offer. The transport is one-publisher → one-viewer per slot,
 * so that hijack does not merely eavesdrop — it TAKES the camera, and the couple's own control
 * room goes black on that tile, mid-ceremony.
 *
 * Both halves must ship together. Do not flip this back to public.
 */
function signalChannelConfig() {
  return {
    config: {
      private: true as const,
      broadcast: { self: false },
    },
  };
}

type Sdp = { type: RTCSdpType; sdp: string };

/** A camera slot is any non-empty string (the control room uses `cam{index}`). */
function isSlot(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

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
 * Phone side: publish a local MediaStream as camera `slot` on this event.
 * Announces itself until the viewer acks, then offers; re-offers if the viewer
 * says hello again while this peer isn't connected (e.g. the answer got lost).
 */
export function publishPanoodCamera({
  eventId,
  slot,
  stream,
  onState,
  iceServers = DEFAULT_ICE_SERVERS,
}: {
  eventId: string;
  slot: string;
  stream: MediaStream;
  onState: (state: PeerConnectionState) => void;
  /** STUN + (ideally) a minted TURN relay from `getPanoodIceServers`; STUN-only if omitted. */
  iceServers?: RTCIceServer[];
}): CameraPublisher {
  const supabase = createClient();
  let pc: RTCPeerConnection | null = null;
  let unwatch: (() => void) | null = null;
  let helloTimer: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const channel: RealtimeChannel = supabase.channel(
    signalChannelName(eventId),
    signalChannelConfig(),
  );

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
    reportConnectionType(pc, 'panood'); // relay-vs-direct telemetry (best-effort)
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
      const p = payload as { slot?: string; sdp?: Sdp };
      if (p.slot !== slot || !p.sdp || !pc) return;
      void pc.setRemoteDescription(new RTCSessionDescription(p.sdp)).catch(() => onState('failed'));
    })
    .on('broadcast', { event: 'rtc-ice' }, ({ payload }) => {
      const p = payload as { slot?: string; side?: string; candidate?: RTCIceCandidateInit };
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
 * Desktop/control-room side: receive every publishing camera on this event.
 * Fires `onTrack(slot, stream)` when a camera's media arrives and
 * `onSlotState(slot, state)` as each peer's connection progresses/fails. Slots
 * are discovered dynamically (any camera that says hello), so it scales past the
 * demo's fixed two.
 */
export function watchPanoodCameras({
  eventId,
  onTrack,
  onSlotState,
  iceServers = DEFAULT_ICE_SERVERS,
}: {
  eventId: string;
  onTrack: (slot: string, stream: MediaStream) => void;
  onSlotState: (slot: string, state: PeerConnectionState) => void;
  /** STUN + (ideally) a minted TURN relay from `getPanoodIceServers`; STUN-only if omitted. */
  iceServers?: RTCIceServer[];
}): ControlRoomViewer {
  const supabase = createClient();
  const pcs = new Map<string, RTCPeerConnection>();
  const unwatchers = new Map<string, () => void>();
  let closed = false;

  const channel: RealtimeChannel = supabase.channel(
    signalChannelName(eventId),
    signalChannelConfig(),
  );

  const send = (event: string, payload: Record<string, unknown>) => {
    void channel.send({ type: 'broadcast', event, payload });
  };

  const answerOffer = async (slot: string, sdp: Sdp) => {
    if (closed) return;
    // A fresh offer for a slot replaces any previous peer (phone retried).
    pcs.get(slot)?.close();
    unwatchers.get(slot)?.();
    const pc = new RTCPeerConnection({ iceServers });
    pcs.set(slot, pc);
    reportConnectionType(pc, 'panood'); // relay-vs-direct telemetry (best-effort)
    unwatchers.set(slot, watchConnectionState(pc, (state) => onSlotState(slot, state)));
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
      const p = payload as { slot?: unknown };
      if (!isSlot(p.slot)) return;
      // Ack so the phone stops hello-ing and sends (or re-sends) its offer — but
      // only nudge a slot that isn't already connected. Surfacing 'connecting'
      // here (before any offer lands) lets the control room flip that camera tile
      // from "waiting for a scan" the moment a phone joins.
      if (pcs.get(p.slot)?.connectionState !== 'connected') {
        onSlotState(p.slot, 'connecting');
        send('viewer-hello', {});
      }
    })
    .on('broadcast', { event: 'rtc-offer' }, ({ payload }) => {
      const p = payload as { slot?: unknown; sdp?: Sdp };
      if (!isSlot(p.slot) || !p.sdp) return;
      const slot = p.slot;
      void answerOffer(slot, p.sdp).catch(() => onSlotState(slot, 'failed'));
    })
    .on('broadcast', { event: 'rtc-ice' }, ({ payload }) => {
      const p = payload as { slot?: unknown; side?: string; candidate?: RTCIceCandidateInit };
      if (!isSlot(p.slot) || p.side !== 'cam' || !p.candidate) return;
      void pcs.get(p.slot)?.addIceCandidate(p.candidate).catch(() => {});
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED' && !closed) send('viewer-hello', {});
    });

  return {
    close: () => {
      closed = true;
      for (const [slot, pc] of pcs) {
        unwatchers.get(slot)?.();
        pc.close();
      }
      pcs.clear();
      unwatchers.clear();
      void supabase.removeChannel(channel);
    },
  };
}
