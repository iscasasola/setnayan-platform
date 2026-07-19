import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * N-WAY MESH call transport — the multi-party generalization of the 1:1
 * `lib/call-webrtc.ts`. Where the 1:1 call is two peers ("perfect negotiation"
 * over `call:{room}`), this is a full MESH: every participant holds one
 * RTCPeerConnection to every OTHER participant, so each publishes their own
 * media to all and views all. Media stays peer-to-peer — NEVER touches a
 * Setnayan server, nothing recorded (same privacy lock as the 1:1 call: "their
 * calls are their own"). Signaling rides an ephemeral Supabase Realtime channel
 * (`mesh:{room}`); sdp/ice are ADDRESSED (carry `to`) so each pair negotiates
 * independently, `hello`/`bye`/`speaking` are broadcast.
 *
 * ICE: STUN default, plus an optional TURN relay passed by the caller (same
 * shape as the other transports). STUN-first per link, TURN only for the links
 * that can't go direct — so a 3-way call is free unless a participant is on
 * hard-NAT (mobile data), and even then only their links relay.
 *
 * CAP: `MAX_PEERS` remote peers (→ up to `MAX_PEERS + 1` participants). Free P2P
 * mesh is comfortable to ~4; beyond that each publisher fans out to everyone and
 * you'd want an SFU (not free) — so the transport hard-refuses extra peers.
 *
 * PROTOTYPE STATUS: exercised via /prototype/mesh-call for real multi-device
 * testing before it's wired into the vendor↔couple thread (2-way default, a
 * coordinator's 3rd seat gated to a BOOKED coordinator — an accepted
 * `wedding_planner_external` event_moderator — plus video-on-demand: the
 * productionization layer, deferred until the transport is validated on 3
 * devices, mirroring how the 1:1 call went /prototype/call → productionized).
 */

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

/** Up to this many REMOTE peers → MAX_PEERS + 1 participants total (here: 4). */
export const MAX_PEERS = 3;

export type MeshRoomState = 'waiting' | 'connected' | 'left';
export type RemotePeer = { id: string; stream: MediaStream; speaking: boolean };

export type MeshHandle = {
  setVideoEnabled: (on: boolean) => void;
  setAudioEnabled: (on: boolean) => void;
  leave: () => void;
};

type PeerCtx = {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  remoteStream: MediaStream;
};

type Sdp = RTCSessionDescriptionInit;

export function joinMeshCall(opts: {
  room: string;
  clientId: string;
  localStream: MediaStream;
  iceServers?: RTCIceServer[];
  /** Full remote-peer list, re-emitted on any change (join/leave/track/speaking). */
  onPeers: (peers: RemotePeer[]) => void;
  onState: (state: MeshRoomState) => void;
  /** Local mic activity (drives the "you're the active speaker" highlight). */
  onLocalSpeaking?: (on: boolean) => void;
}): MeshHandle {
  const {
    room,
    clientId,
    localStream,
    onPeers,
    onState,
    onLocalSpeaking,
    iceServers = DEFAULT_ICE_SERVERS,
  } = opts;

  const supabase = createClient();
  const peers = new Map<string, PeerCtx>();
  const speaking = new Map<string, boolean>();
  let closed = false;

  const channel: RealtimeChannel = supabase.channel(`mesh:${room}`, {
    config: { broadcast: { self: false } },
  });

  const send = (event: string, payload: Record<string, unknown>) =>
    void channel.send({ type: 'broadcast', event, payload: { ...payload, from: clientId } });

  function emitPeers() {
    const list: RemotePeer[] = [];
    for (const [id, ctx] of peers) {
      list.push({ id, stream: ctx.remoteStream, speaking: speaking.get(id) ?? false });
    }
    onPeers(list);
  }

  function dropPeer(id: string) {
    const ctx = peers.get(id);
    if (!ctx) return;
    ctx.pc.ontrack = null;
    ctx.pc.onicecandidate = null;
    ctx.pc.onnegotiationneeded = null;
    ctx.pc.onconnectionstatechange = null;
    ctx.pc.close();
    peers.delete(id);
    speaking.delete(id);
    emitPeers();
  }

  function createPeer(remoteId: string): PeerCtx | null {
    if (peers.has(remoteId)) return peers.get(remoteId)!;
    if (peers.size >= MAX_PEERS) return null; // cap — refuse extra peers
    const pc = new RTCPeerConnection({ iceServers });
    const remoteStream = new MediaStream();
    const ctx: PeerCtx = {
      pc,
      polite: clientId < remoteId, // deterministic: exactly one side is polite
      makingOffer: false,
      ignoreOffer: false,
      remoteStream,
    };
    peers.set(remoteId, ctx);

    for (const track of localStream.getTracks()) pc.addTrack(track, localStream);

    pc.ontrack = ({ track }) => {
      remoteStream.addTrack(track);
      emitPeers();
    };
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) send('ice', { to: remoteId, candidate: candidate.toJSON() });
    };
    pc.onnegotiationneeded = async () => {
      try {
        ctx.makingOffer = true;
        await pc.setLocalDescription();
        if (pc.localDescription) send('sdp', { to: remoteId, description: pc.localDescription });
      } catch (err) {
        console.error('[mesh] negotiation failed:', err);
      } finally {
        ctx.makingOffer = false;
      }
    };
    pc.onconnectionstatechange = () => {
      if (closed) return;
      if (pc.connectionState === 'connected') onState('connected');
      else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') dropPeer(remoteId);
    };
    return ctx;
  }

  function ensurePeer(remoteId: string): PeerCtx | null {
    if (remoteId === clientId) return null;
    return createPeer(remoteId);
  }

  channel
    .on('broadcast', { event: 'hello' }, ({ payload }) => {
      const from = (payload as { from?: string }).from;
      if (!from || from === clientId) return;
      const isNew = !peers.has(from);
      ensurePeer(from);
      // Reply so the newcomer also learns about us (only to a first hello — no loop).
      if (isNew) send('hello-ack', { to: from });
    })
    .on('broadcast', { event: 'hello-ack' }, ({ payload }) => {
      const p = payload as { from?: string; to?: string };
      if (p.to !== clientId || !p.from || p.from === clientId) return;
      ensurePeer(p.from);
    })
    .on('broadcast', { event: 'sdp' }, async ({ payload }) => {
      const p = payload as { from?: string; to?: string; description?: Sdp };
      if (p.to !== clientId || !p.from || p.from === clientId || !p.description) return;
      const ctx = ensurePeer(p.from);
      if (!ctx) return;
      const { pc } = ctx;
      const desc = p.description;
      const collision = desc.type === 'offer' && (ctx.makingOffer || pc.signalingState !== 'stable');
      ctx.ignoreOffer = !ctx.polite && collision;
      if (ctx.ignoreOffer) return;
      try {
        await pc.setRemoteDescription(desc);
        if (desc.type === 'offer') {
          await pc.setLocalDescription();
          if (pc.localDescription) send('sdp', { to: p.from, description: pc.localDescription });
        }
      } catch (err) {
        console.error('[mesh] applying description failed:', err);
      }
    })
    .on('broadcast', { event: 'ice' }, async ({ payload }) => {
      const p = payload as { from?: string; to?: string; candidate?: RTCIceCandidateInit };
      if (p.to !== clientId || !p.from || !p.candidate) return;
      const ctx = peers.get(p.from);
      if (!ctx) return;
      try {
        await ctx.pc.addIceCandidate(p.candidate);
      } catch (err) {
        if (!ctx.ignoreOffer) console.error('[mesh] addIceCandidate failed:', err);
      }
    })
    .on('broadcast', { event: 'speaking' }, ({ payload }) => {
      const p = payload as { from?: string; on?: boolean };
      if (!p.from || p.from === clientId) return;
      speaking.set(p.from, Boolean(p.on));
      emitPeers();
    })
    .on('broadcast', { event: 'bye' }, ({ payload }) => {
      const from = (payload as { from?: string }).from;
      if (from) dropPeer(from);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED' && !closed) {
        onState('waiting');
        send('hello', {});
      }
    });

  // Active-speaker: watch local mic level and broadcast on/off crossings so every
  // peer can highlight the talker. Cheap AudioContext analyser; degrades to no-op
  // if Web Audio isn't available. No effect on the media itself.
  let stopSpeaking: (() => void) | null = null;
  try {
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const audioTrack = localStream.getAudioTracks()[0];
    if (AudioCtx && audioTrack) {
      const ac = new AudioCtx();
      const analyser = ac.createAnalyser();
      analyser.fftSize = 512;
      ac.createMediaStreamSource(new MediaStream([audioTrack])).connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      let last = false;
      const timer = setInterval(() => {
        analyser.getByteFrequencyData(buf);
        let sum = 0;
        for (const v of buf) sum += v;
        const on = sum / buf.length > 12 && audioTrack.enabled; // muted → never "speaking"
        if (on !== last) {
          last = on;
          onLocalSpeaking?.(on);
          send('speaking', { on });
        }
      }, 300);
      stopSpeaking = () => {
        clearInterval(timer);
        void ac.close();
      };
    }
  } catch {
    /* speaking detection is best-effort */
  }

  return {
    setVideoEnabled: (on) => {
      for (const t of localStream.getVideoTracks()) t.enabled = on;
    },
    setAudioEnabled: (on) => {
      for (const t of localStream.getAudioTracks()) t.enabled = on;
    },
    leave: () => {
      if (closed) return;
      closed = true;
      stopSpeaking?.();
      try {
        send('bye', {});
      } catch {
        /* best-effort */
      }
      for (const id of [...peers.keys()]) dropPeer(id);
      void supabase.removeChannel(channel);
      onState('left');
    },
  };
}
