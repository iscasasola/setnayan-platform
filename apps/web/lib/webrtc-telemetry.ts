import { reportWebrtcConnection } from '@/app/_actions/webrtc-telemetry-actions';

/**
 * Client-side WebRTC relay telemetry — reports, once per peer connection, whether
 * it connected DIRECT (host/STUN) or via a TURN RELAY, tagged by surface. This is
 * the "how often does TURN kick in?" signal for the 1,000 GB/mo budget plan; it
 * fires the `reportWebrtcConnection` server action (→ PostHog, no PII, no-op when
 * unconfigured). Best-effort and fully swallowed — telemetry must never affect a
 * call/stream. Call `reportConnectionType(pc, surface)` right after creating each
 * RTCPeerConnection; it self-detaches after the first `connected`.
 */

export type WebrtcSurface = 'demo' | 'panood' | 'call';

/** Inspect the winning ICE candidate pair: relayed? + a "localType/remoteType" tag. */
async function inspect(
  pc: RTCPeerConnection,
): Promise<{ relayed: boolean; connectionType: string } | null> {
  try {
    const stats = await pc.getStats();
    let pair: RTCIceCandidatePairStats | undefined;
    // Prefer the nominated+succeeded pair; fall back to any succeeded pair
    // (some engines don't stamp `nominated`).
    stats.forEach((r) => {
      if (r.type !== 'candidate-pair') return;
      const cp = r as RTCIceCandidatePairStats;
      if (cp.state === 'succeeded' && (cp.nominated || !pair)) pair = cp;
    });
    if (!pair) return null;
    const local = pair.localCandidateId ? stats.get(pair.localCandidateId) : undefined;
    const remote = pair.remoteCandidateId ? stats.get(pair.remoteCandidateId) : undefined;
    // The individual ICE-candidate stats type isn't in the TS DOM lib; read
    // `candidateType` ('host' | 'srflx' | 'prflx' | 'relay') defensively.
    const lt = (local as { candidateType?: string } | undefined)?.candidateType;
    const rt = (remote as { candidateType?: string } | undefined)?.candidateType;
    return {
      relayed: lt === 'relay' || rt === 'relay',
      connectionType: `${lt ?? '?'}/${rt ?? '?'}`,
    };
  } catch {
    return null;
  }
}

export function reportConnectionType(pc: RTCPeerConnection, surface: WebrtcSurface): void {
  let done = false;
  const fire = () => {
    if (done || pc.connectionState !== 'connected') return;
    done = true;
    pc.removeEventListener('connectionstatechange', fire);
    void inspect(pc).then((info) => {
      if (!info) return;
      void reportWebrtcConnection({ surface, ...info });
    });
  };
  pc.addEventListener('connectionstatechange', fire);
  // Guard the already-connected race (rare, but the listener would miss it).
  if (pc.connectionState === 'connected') fire();
}
