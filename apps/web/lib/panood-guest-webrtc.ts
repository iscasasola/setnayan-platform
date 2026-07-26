/**
 * Live Studio · GUEST-PICK transport — one operator phone fanning out to a CAPPED
 * number of wedding guests over plain peer-to-peer WebRTC (Wave 10, 2026-07-26).
 *
 * Same technology as the shipped 1:1 chat call and as `lib/panood-webrtc.ts`; the
 * only new idea is that the publisher keeps a MAP of peers instead of one, and
 * refuses past a cap.
 *
 * ══ WHY THIS IS A SEPARATE CHANNEL, AND WHY THAT IS NOT OPTIONAL ══
 *
 * The host path (`panood-rtc:{eventId}`) is ONE-PUBLISHER → ONE-VIEWER PER SLOT.
 * Its publisher holds a single `pc` and `startOffer()` CLOSES it on every re-offer,
 * and `rtc-answer` is filtered on nothing but `slot`. So a guest answering on that
 * channel would not merely join — it would TAKE the camera, and the couple's own
 * controller would go black on that tile, mid-ceremony. Migration 20270829134804
 * exists because exactly that hole was found once already, and its comment states
 * the rule plainly: "guests watch the public live page, never the signaling channel."
 *
 * This module therefore uses a DIFFERENT topic (`panood-guest:{eventId}`), a
 * DIFFERENT event vocabulary (`g-*`), and DIFFERENT peer connections. There is no
 * code path here that can send on the host topic — the director's cut cannot be
 * harmed by anything that goes wrong in this file, by construction rather than by
 * care. Do not merge the two channels.
 *
 * ══ WHAT THIS COSTS ══
 *
 * ₱0 when the peers connect DIRECTLY, which is the whole reason the owner chose it.
 * When NAT traversal fails the connection relays through Cloudflare TURN, which is
 * billed per GB — see the cost note in the Wave 10 changelog fragment. TURN is what
 * makes a phone on Philippine mobile data reachable at all, so it is offered; it is
 * not free.
 *
 * ⚠ PRIVACY, STATED NOT HIDDEN: peer-to-peer means the two peers learn each other's
 * IP address. A guest who opens a side camera exposes their IP to the operator's
 * phone and vice versa. That is inherent to P2P (a TURN-relayed connection masks it;
 * a direct one does not) and it is NEW — until now guests only ever talked to
 * YouTube. Flagged for the owner in the PR.
 */

import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { reportConnectionType } from '@/lib/webrtc-telemetry';
import {
  GUEST_PICK_MAX_BITRATE_BPS,
  GUEST_PICK_MAX_VIEWERS_PER_CAMERA,
  GUEST_PICK_PRESENCE_HEARTBEAT_MS,
  GUEST_PICK_SCALE_DOWN_BY,
  admitViewer,
  flattenGuestPresence,
  guestPickChannelName,
  resolveSlotAdmission,
  type GuestPickPresence,
} from '@/lib/live-studio-guest-pick';
import type { PeerConnectionState } from '@/lib/panood-webrtc';

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

const CONNECT_TIMEOUT_MS = 15_000;
const HELLO_RETRY_MS = 2_000;

function channelConfig(presenceKey?: string) {
  return {
    config: {
      // SECURITY REQUIREMENT, same as the host channel: Supabase evaluates RLS on
      // `realtime.messages` for PRIVATE channels only. The companion policies live
      // in the Wave 10 migration (live_studio_guest_rtc_can_access). Public would
      // make them dead code and put every guest's SDP — which carries IP addresses
      // — on an unauthenticated topic keyed by an event id that travels in QR links.
      private: true as const,
      broadcast: { self: false },
      ...(presenceKey ? { presence: { key: presenceKey } } : {}),
    },
  };
}

type Sdp = { type: RTCSdpType; sdp: string };

function watchState(
  pc: RTCPeerConnection,
  onState: (s: PeerConnectionState) => void,
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

/**
 * Hold the guest copy to a peek-view bitrate/resolution.
 *
 * THIS IS THE BUDGET THAT MAKES THE CAP ARITHMETIC TRUE. Without it WebRTC
 * negotiates the full 1080p30 encode per guest and one viewer costs as much uplink
 * as the host feed does. Best-effort: `setParameters` is not uniformly implemented,
 * and a failure here must never break the connection — a slightly-too-fat guest
 * stream is far better than a dead one.
 */
async function capGuestEncoding(sender: RTCRtpSender): Promise<void> {
  try {
    if (sender.track?.kind !== 'video') return;
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }
    for (const e of params.encodings) {
      e.maxBitrate = GUEST_PICK_MAX_BITRATE_BPS;
      e.scaleResolutionDownBy = GUEST_PICK_SCALE_DOWN_BY;
    }
    await sender.setParameters(params);
  } catch {
    /* best-effort */
  }
}

export type GuestFanout = {
  close: () => void;
};

/**
 * PHONE SIDE — serve this camera's stream to up to `maxViewers` guests at once.
 *
 * Runs ALONGSIDE `publishPanoodCamera`, sharing the same local MediaStream but
 * nothing else. Every entry point is wrapped so a guest-side fault (a malformed
 * payload, a peer that never answers, a Realtime hiccup) cannot propagate into the
 * caller and therefore cannot reach the host publish.
 *
 * `onViewers` reports the live count so the operator's screen can say how many
 * guests are watching them — honest feedback, and it makes the cap visible.
 */
export function publishGuestFanout({
  eventId,
  slot,
  stream,
  iceServers = DEFAULT_ICE_SERVERS,
  maxViewers = GUEST_PICK_MAX_VIEWERS_PER_CAMERA,
  onViewers,
}: {
  eventId: string;
  slot: string;
  stream: MediaStream;
  iceServers?: RTCIceServer[];
  maxViewers?: number;
  onViewers?: (count: number) => void;
}): GuestFanout {
  const supabase = createClient();
  const peers = new Map<string, RTCPeerConnection>();
  const unwatchers = new Map<string, () => void>();
  let closed = false;

  const channel: RealtimeChannel = supabase.channel(
    guestPickChannelName(eventId),
    channelConfig(),
  );

  const send = (event: string, payload: Record<string, unknown>) => {
    try {
      void channel.send({ type: 'broadcast', event, payload });
    } catch {
      /* signaling is best-effort; never throw into the camera page */
    }
  };

  const report = () => onViewers?.(peers.size);

  const drop = (viewerId: string) => {
    unwatchers.get(viewerId)?.();
    unwatchers.delete(viewerId);
    peers.get(viewerId)?.close();
    peers.delete(viewerId);
    report();
  };

  const offerTo = async (viewerId: string) => {
    if (closed) return;

    // ⭐ THE AUTHORITATIVE CAP. The guest's browser also checks, from presence, so
    // the UI can be honest before it connects — but that check runs on a machine we
    // do not control. This one runs on the phone that pays the uplink, and it is the
    // one that decides. Idempotent for a viewer already being served (its hello
    // retried), which must not consume a second slot.
    if (!admitViewer([...peers.keys()], viewerId, maxViewers)) {
      send('g-full', { slot, viewerId });
      return;
    }

    // A repeat hello from a viewer we are already CONNECTED to is just a retry that
    // crossed our offer — leave the working peer alone.
    const existing = peers.get(viewerId);
    if (existing && existing.connectionState === 'connected') return;
    if (existing) drop(viewerId);

    const pc = new RTCPeerConnection({ iceServers });
    peers.set(viewerId, pc);
    report();
    reportConnectionType(pc, 'panood-guest'); // relay-vs-direct telemetry (best-effort)
    unwatchers.set(
      viewerId,
      watchState(pc, (s) => {
        // Reclaim the slot the moment a guest's peer dies, so a guest who walked out
        // of range does not hold a seat until presence times out.
        if (s === 'failed' && !closed) drop(viewerId);
      }),
    );
    pc.onicecandidate = (e) => {
      if (e.candidate) send('g-ice', { slot, viewerId, side: 'cam', candidate: e.candidate.toJSON() });
    };
    for (const track of stream.getTracks()) {
      const sender = pc.addTrack(track, stream);
      void capGuestEncoding(sender);
    }
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send('g-offer', { slot, viewerId, sdp: { type: offer.type, sdp: offer.sdp } });
  };

  channel
    .on('broadcast', { event: 'g-hello' }, ({ payload }) => {
      const p = payload as { slot?: unknown; viewerId?: unknown };
      if (p.slot !== slot) return;
      if (typeof p.viewerId !== 'string' || !p.viewerId) return;
      const viewerId = p.viewerId;
      void offerTo(viewerId).catch(() => drop(viewerId));
    })
    .on('broadcast', { event: 'g-answer' }, ({ payload }) => {
      const p = payload as { slot?: unknown; viewerId?: unknown; sdp?: Sdp };
      if (p.slot !== slot || typeof p.viewerId !== 'string' || !p.sdp) return;
      const pc = peers.get(p.viewerId);
      if (!pc) return;
      void pc.setRemoteDescription(new RTCSessionDescription(p.sdp)).catch(() => {});
    })
    .on('broadcast', { event: 'g-ice' }, ({ payload }) => {
      const p = payload as {
        slot?: unknown;
        viewerId?: unknown;
        side?: string;
        candidate?: RTCIceCandidateInit;
      };
      if (p.slot !== slot || p.side !== 'viewer') return;
      if (typeof p.viewerId !== 'string' || !p.candidate) return;
      void peers.get(p.viewerId)?.addIceCandidate(p.candidate).catch(() => {});
    })
    .on('broadcast', { event: 'g-bye' }, ({ payload }) => {
      const p = payload as { slot?: unknown; viewerId?: unknown };
      if (p.slot !== slot || typeof p.viewerId !== 'string') return;
      // A guest who navigated away frees the slot immediately rather than at the
      // presence timeout — the difference between "the next guest waits 45s" and
      // "the next guest gets in".
      if (peers.has(p.viewerId)) drop(p.viewerId);
    });

  // Hydrate the session BEFORE subscribing. The channel is private, so Realtime must
  // carry a real access token when it joins; `createBrowserClient` loads the session
  // asynchronously, and subscribing first can join with the bare anon key and be
  // refused by the policy.
  void (async () => {
    try {
      await supabase.auth.getSession();
    } catch {
      /* fall through — a refused join surfaces as "no guests", never a crash */
    }
    if (!closed) channel.subscribe();
  })();

  return {
    close: () => {
      closed = true;
      for (const viewerId of [...peers.keys()]) {
        unwatchers.get(viewerId)?.();
        peers.get(viewerId)?.close();
      }
      peers.clear();
      unwatchers.clear();
      void supabase.removeChannel(channel);
    },
  };
}

export type GuestCameraWatcher = { close: () => void };

/**
 * GUEST SIDE — watch one side camera.
 *
 * Tracks presence so every guest can compute the same occupancy picture, then
 * hellos the phone until it offers. Two ways to be told "no": the presence maths
 * says the camera is already full (instant, before any connection is attempted), or
 * the phone itself refuses with `g-full` (authoritative). Both surface through
 * `onFull`, and the caller's job is to put the guest back on the director's cut.
 */
export function watchGuestCamera({
  eventId,
  slot,
  viewerId,
  onTrack,
  onState,
  onFull,
  onOccupancy,
  iceServers = DEFAULT_ICE_SERVERS,
  maxViewers = GUEST_PICK_MAX_VIEWERS_PER_CAMERA,
}: {
  eventId: string;
  slot: string;
  viewerId: string;
  onTrack: (stream: MediaStream) => void;
  onState: (state: PeerConnectionState) => void;
  onFull: () => void;
  onOccupancy?: (count: number) => void;
  iceServers?: RTCIceServer[];
  maxViewers?: number;
}): GuestCameraWatcher {
  const supabase = createClient();
  let pc: RTCPeerConnection | null = null;
  let unwatch: (() => void) | null = null;
  let helloTimer: ReturnType<typeof setInterval> | null = null;
  let beatTimer: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  let refused = false;
  const joinedAt = Date.now();

  const channel: RealtimeChannel = supabase.channel(
    guestPickChannelName(eventId),
    channelConfig(viewerId),
  );

  const send = (event: string, payload: Record<string, unknown>) => {
    try {
      void channel.send({ type: 'broadcast', event, payload });
    } catch {
      /* best-effort */
    }
  };

  const stopHello = () => {
    if (helloTimer) {
      clearInterval(helloTimer);
      helloTimer = null;
    }
  };

  const giveUp = () => {
    if (refused || closed) return;
    refused = true;
    stopHello();
    unwatch?.();
    pc?.close();
    pc = null;
    // Stop holding a presence seat we are not using — otherwise a refused guest
    // would keep a slot away from a guest who could actually have it.
    void channel.untrack();
    onFull();
  };

  const recomputeOccupancy = () => {
    if (closed) return;
    let entries: GuestPickPresence[] = [];
    try {
      entries = flattenGuestPresence(
        channel.presenceState() as unknown as Record<string, unknown[]>,
      );
    } catch {
      return;
    }
    onOccupancy?.(entries.filter((e) => e.slot === slot).length);
    if (refused) return;
    // ADVISORY check — deterministic across every guest's browser (oldest `at`
    // wins), so two guests tapping at the same instant resolve the same way on both
    // screens instead of racing.
    if (resolveSlotAdmission(entries, slot, viewerId, Date.now(), maxViewers) === 'full') {
      giveUp();
    }
  };

  channel
    .on('presence', { event: 'sync' }, recomputeOccupancy)
    .on('presence', { event: 'join' }, recomputeOccupancy)
    .on('presence', { event: 'leave' }, recomputeOccupancy)
    .on('broadcast', { event: 'g-offer' }, ({ payload }) => {
      const p = payload as { slot?: unknown; viewerId?: unknown; sdp?: Sdp };
      if (p.slot !== slot || p.viewerId !== viewerId || !p.sdp) return;
      if (refused || closed) return;
      void (async () => {
        stopHello();
        unwatch?.();
        pc?.close();
        pc = new RTCPeerConnection({ iceServers });
        unwatch = watchState(pc, onState);
        reportConnectionType(pc, 'panood-guest');
        pc.onicecandidate = (e) => {
          if (e.candidate) {
            send('g-ice', { slot, viewerId, side: 'viewer', candidate: e.candidate.toJSON() });
          }
        };
        pc.ontrack = (e) => onTrack(e.streams[0] ?? new MediaStream([e.track]));
        await pc.setRemoteDescription(new RTCSessionDescription(p.sdp!));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send('g-answer', { slot, viewerId, sdp: { type: answer.type, sdp: answer.sdp } });
        onState('connecting');
      })().catch(() => onState('failed'));
    })
    .on('broadcast', { event: 'g-ice' }, ({ payload }) => {
      const p = payload as {
        slot?: unknown;
        viewerId?: unknown;
        side?: string;
        candidate?: RTCIceCandidateInit;
      };
      if (p.slot !== slot || p.viewerId !== viewerId || p.side !== 'cam' || !p.candidate) return;
      void pc?.addIceCandidate(p.candidate).catch(() => {});
    })
    .on('broadcast', { event: 'g-full' }, ({ payload }) => {
      const p = payload as { slot?: unknown; viewerId?: unknown };
      if (p.slot !== slot || p.viewerId !== viewerId) return;
      giveUp(); // the phone's word is final
    });

  const onSubscribed = (status: string) => {
    {
      if (status !== 'SUBSCRIBED' || closed) return;
      void channel.track({ slot, viewerId, at: joinedAt });
      // Keep `at` fresh so other guests never mistake a live viewer for a leaked
      // slot (GUEST_PICK_PRESENCE_STALE_MS).
      beatTimer = setInterval(() => {
        if (!closed && !refused) void channel.track({ slot, viewerId, at: Date.now() });
      }, GUEST_PICK_PRESENCE_HEARTBEAT_MS);
      send('g-hello', { slot, viewerId });
      helloTimer = setInterval(() => {
        if (pc && pc.connectionState === 'connected') stopHello();
        else if (!refused) send('g-hello', { slot, viewerId });
      }, HELLO_RETRY_MS);
    }
  };

  // Same reason as the publisher side: the guest's session (often a native-anon one
  // minted moments ago by `startGuestPickSession`) must be loaded before Realtime
  // joins a PRIVATE topic, or the policy refuses the join.
  void (async () => {
    try {
      await supabase.auth.getSession();
    } catch {
      /* a refused join simply never reaches SUBSCRIBED → the caller falls back */
    }
    if (!closed) channel.subscribe(onSubscribed);
  })();

  return {
    close: () => {
      closed = true;
      stopHello();
      if (beatTimer) clearInterval(beatTimer);
      unwatch?.();
      pc?.close();
      pc = null;
      // Tell the phone to reclaim the slot NOW rather than waiting for presence.
      send('g-bye', { slot, viewerId });
      void supabase.removeChannel(channel);
    },
  };
}
