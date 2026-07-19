/**
 * 1:1 voice/video CALL transport — the vendor↔couple call prototype.
 *
 * This is the SYMMETRIC sibling of `lib/demo-webrtc.ts`. The Live Studio demo
 * is a STAR topology (N phone publishers → 1 control-room viewer); a call is
 * two peers that BOTH publish and BOTH view. So instead of the demo's
 * phone-offers / viewer-answers script, this uses the standard WebRTC
 * "perfect negotiation" pattern (MDN) which resolves offer glare on its own via
 * a polite/impolite role — the robust primitive for a 2-party session.
 *
 * Same infra/cost shape as the demo, deliberately:
 *   • Media flows peer-to-peer — NEVER touches a Setnayan server. Nothing is
 *     recorded or stored. Zero bandwidth/egress cost per call.
 *   • Signaling rides an ephemeral Supabase Realtime broadcast channel
 *     (`call:{room}`) — same convention family as `demo-rtc:{sessionId}`.
 *   • ICE: public STUN always, plus an optional short-lived Cloudflare TURN
 *     relay passed in by the caller (from `getCallIceServers`, minted
 *     server-side). STUN alone can't traverse symmetric NAT / CGNAT — the norm
 *     when a couple (or coordinator) is on mobile data — so a TURN relay is what
 *     lets those calls connect at all. Without it (or before the env is set)
 *     this falls back to STUN-only and a hard-NAT pair fails cleanly, as the
 *     demo did. (Same pattern proved in lib/demo-webrtc.ts / lib/panood-webrtc.ts.)
 *
 * Voice vs video is purely which tracks the caller adds to `localStream`
 * (audio-only = a voice call); a mid-call camera toggle just flips the video
 * track's `enabled`, no renegotiation.
 */

import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { reportConnectionType } from '@/lib/webrtc-telemetry';

/** STUN-only fallback when a caller passes no `iceServers` (or TURN is unconfigured). */
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

/** Past this with no peer connection, we surface the STUN-only "can't connect" state. */
const CONNECT_TIMEOUT_MS = 20_000;
const HELLO_RETRY_MS = 2_000;

export type CallState =
  | 'waiting' // in the room, no peer yet
  | 'connecting'
  | 'connected'
  | 'failed' // couldn't connect (STUN-only, no TURN) — offer to retry
  | 'ended'; // the other side hung up

export type CallHandle = {
  /** Enable/disable the local video track(s) mid-call (camera on/off). */
  setVideoEnabled: (on: boolean) => void;
  /** Enable/disable the local audio track(s) mid-call (mute). */
  setAudioEnabled: (on: boolean) => void;
  /** Leave the call: close the peer, tell the other side, tear down signaling. */
  leave: () => void;
};

type Sdp = { type: RTCSdpType; sdp: string };

/**
 * Join a 1:1 call room. `localStream` is the caller's own camera+mic (or
 * mic-only for a voice call). `onRemoteStream` fires with the peer's stream
 * once tracks arrive (and null when they leave). `onState` tracks the session.
 */
export function joinCall(opts: {
  room: string;
  clientId: string;
  localStream: MediaStream;
  onRemoteStream: (stream: MediaStream | null) => void;
  onState: (state: CallState) => void;
  /** STUN + (ideally) a minted TURN relay from `getCallIceServers`; STUN-only if omitted. */
  iceServers?: RTCIceServer[];
}): CallHandle {
  const {
    room,
    clientId,
    localStream,
    onRemoteStream,
    onState,
    iceServers = DEFAULT_ICE_SERVERS,
  } = opts;
  const supabase = createClient();

  let pc: RTCPeerConnection | null = null;
  let remoteId: string | null = null;
  let polite = false;
  let makingOffer = false;
  let ignoreOffer = false;
  let closed = false;
  let connected = false;
  let helloTimer: ReturnType<typeof setInterval> | null = null;
  let connectTimer: ReturnType<typeof setTimeout> | null = null;

  const channel: RealtimeChannel = supabase.channel(`call:${room}`, {
    config: { broadcast: { self: false } },
  });

  const send = (event: string, payload: Record<string, unknown>) => {
    void channel.send({ type: 'broadcast', event, payload: { ...payload, from: clientId } });
  };

  const stopHello = () => {
    if (helloTimer) {
      clearInterval(helloTimer);
      helloTimer = null;
    }
  };

  const armConnectTimeout = () => {
    if (connectTimer) clearTimeout(connectTimer);
    connectTimer = setTimeout(() => {
      if (!closed && !connected) onState('failed');
    }, CONNECT_TIMEOUT_MS);
  };

  // Create the peer once we've discovered the other participant. Both sides add
  // their local tracks and may fire onnegotiationneeded → both may offer; the
  // polite peer rolls back on glare (perfect negotiation), so it always settles.
  function ensurePeer() {
    if (pc || closed) return;
    const peer = new RTCPeerConnection({ iceServers });
    pc = peer;
    reportConnectionType(peer, 'call'); // relay-vs-direct telemetry (best-effort)
    armConnectTimeout();

    for (const track of localStream.getTracks()) peer.addTrack(track, localStream);

    const remote = new MediaStream();
    peer.ontrack = ({ track }) => {
      remote.addTrack(track);
      onRemoteStream(remote);
    };

    peer.onicecandidate = ({ candidate }) => {
      if (candidate) send('ice', { candidate: candidate.toJSON() });
    };

    peer.onnegotiationneeded = async () => {
      try {
        makingOffer = true;
        await peer.setLocalDescription();
        if (peer.localDescription) send('sdp', { description: peer.localDescription });
      } catch (err) {
        console.error('[call] negotiation failed:', err);
      } finally {
        makingOffer = false;
      }
    };

    peer.onconnectionstatechange = () => {
      if (closed) return;
      switch (peer.connectionState) {
        case 'connected':
          connected = true;
          if (connectTimer) clearTimeout(connectTimer);
          stopHello();
          onState('connected');
          break;
        case 'connecting':
          onState('connecting');
          break;
        case 'failed':
        case 'closed':
          onState('failed');
          break;
        default:
          break;
      }
    };
  }

  // Learn the peer + fix politeness deterministically (lexicographic on the two
  // ids) so exactly one side is polite regardless of who joined first.
  function notePeer(id: string) {
    if (id === clientId) return;
    if (remoteId !== id) {
      remoteId = id;
      polite = clientId < id;
    }
    ensurePeer();
  }

  channel
    .on('broadcast', { event: 'hello' }, ({ payload }) => {
      const from = (payload as { from?: string })?.from;
      if (!from || from === clientId) return;
      const firstContact = remoteId === null;
      notePeer(from);
      // Ack so whoever was already here also learns about us.
      if (firstContact) send('hello', {});
    })
    .on('broadcast', { event: 'sdp' }, async ({ payload }) => {
      const p = payload as { from?: string; description?: Sdp };
      if (!p?.from || p.from === clientId || !p.description) return;
      notePeer(p.from);
      if (!pc) return;
      const description = p.description;
      const offerCollision =
        description.type === 'offer' && (makingOffer || pc.signalingState !== 'stable');
      ignoreOffer = !polite && offerCollision;
      if (ignoreOffer) return;
      try {
        await pc.setRemoteDescription(description);
        if (description.type === 'offer') {
          await pc.setLocalDescription();
          if (pc.localDescription) send('sdp', { description: pc.localDescription });
        }
      } catch (err) {
        console.error('[call] applying description failed:', err);
      }
    })
    .on('broadcast', { event: 'ice' }, async ({ payload }) => {
      const p = payload as { from?: string; candidate?: RTCIceCandidateInit };
      if (!p?.from || p.from === clientId || !p.candidate || !pc) return;
      try {
        await pc.addIceCandidate(p.candidate);
      } catch (err) {
        if (!ignoreOffer) console.error('[call] addIceCandidate failed:', err);
      }
    })
    .on('broadcast', { event: 'bye' }, ({ payload }) => {
      const from = (payload as { from?: string })?.from;
      if (!from || from !== remoteId) return;
      onRemoteStream(null);
      onState('ended');
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED' && !closed) {
        onState('waiting');
        // Announce until a peer connects (retries cover a lost first hello).
        send('hello', {});
        helloTimer = setInterval(() => {
          if (!connected && !closed) send('hello', {});
        }, HELLO_RETRY_MS);
      }
    });

  return {
    setVideoEnabled(on: boolean) {
      for (const t of localStream.getVideoTracks()) t.enabled = on;
    },
    setAudioEnabled(on: boolean) {
      for (const t of localStream.getAudioTracks()) t.enabled = on;
    },
    leave() {
      if (closed) return;
      closed = true;
      stopHello();
      if (connectTimer) clearTimeout(connectTimer);
      try {
        send('bye', {});
      } catch {
        // best-effort
      }
      if (pc) {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.onnegotiationneeded = null;
        pc.onconnectionstatechange = null;
        pc.close();
        pc = null;
      }
      void supabase.removeChannel(channel);
      onState('ended');
    },
  };
}
