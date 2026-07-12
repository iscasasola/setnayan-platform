'use client';

import { useEffect, useRef, useState } from 'react';
import { joinCall, type CallHandle, type CallState } from '@/lib/call-webrtc';
import { endThreadCall } from '@/app/_actions/thread-call-actions';

/**
 * The in-thread 1:1 CALL room (Relationship_Workspace_and_Appointments · "Call";
 * PR 10). Embeds the free P2P WebRTC transport (lib/call-webrtc.ts) directly in
 * an accepted vendor↔couple thread. Both parties open the same thread and join
 * the same room (keyed by threadId), then connect peer-to-peer — media NEVER
 * touches a server; STUN-only, no TURN (so a rare hard-NAT pair fails cleanly).
 *
 * Self-starting WebRTC call room (grew out of a since-removed prototype): the
 * caller already picked voice/video at launch) and wired to the thread_calls
 * metadata row: hang up / unmount → leave() + stop tracks + endThreadCall().
 */

const STATUS_LABEL: Record<CallState, string> = {
  waiting: 'Waiting for them to join…',
  connecting: 'Connecting…',
  connected: 'Connected',
  failed: "Couldn't connect — try again, or get on the same Wi-Fi (no TURN yet).",
  ended: 'Call ended.',
};

export function ThreadCallRoom({
  threadId,
  kind,
  callId,
  counterpartyLabel = 'them',
  onLeave,
}: {
  threadId: string;
  kind: 'voice' | 'video';
  callId: string;
  counterpartyLabel?: string;
  onLeave: () => void;
}) {
  const [state, setState] = useState<CallState | null>(null);
  const [hasRemote, setHasRemote] = useState(false);
  const [camOn, setCamOn] = useState(kind === 'video');
  const [micOn, setMicOn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const handleRef = useRef<CallHandle | null>(null);

  // Acquire mic/camera, join the P2P room, and tear everything down on unmount.
  // Cleanup is the single source of teardown: hang up simply calls onLeave(),
  // which unmounts this component and triggers the cleanup below.
  useEffect(() => {
    let cancelled = false;
    let handle: CallHandle | null = null;
    let stream: MediaStream | null = null;

    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: kind === 'video',
        });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (localVideoRef.current) localVideoRef.current.srcObject = s;
        handle = joinCall({
          room: `call:${threadId}`,
          clientId: crypto.randomUUID(),
          localStream: s,
          onRemoteStream: (r) => {
            setHasRemote(Boolean(r));
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = r;
          },
          onState: setState,
        });
        handleRef.current = handle;
      } catch {
        if (!cancelled) {
          setError('Camera/microphone access was blocked. Allow it and try again.');
        }
      }
    })();

    return () => {
      cancelled = true;
      handle?.leave();
      stream?.getTracks().forEach((t) => t.stop());
      handleRef.current = null;
      // Close the metadata row (best-effort — RLS-scoped, fails soft server-side).
      void endThreadCall(callId);
    };
  }, [threadId, kind, callId]);

  const toggleCam = () => {
    const next = !camOn;
    setCamOn(next);
    handleRef.current?.setVideoEnabled(next);
  };
  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    handleRef.current?.setAudioEnabled(next);
  };

  return (
    <div className="space-y-3 rounded-xl border border-ink/15 bg-ink/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          {kind === 'video' ? 'Video call' : 'Voice call'}
        </p>
        <p className="text-xs text-ink/60" aria-live="polite">
          {state ? STATUS_LABEL[state] : 'Starting…'}
        </p>
      </div>

      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : kind === 'video' ? (
        <div className="grid grid-cols-2 gap-2">
          <Tile label="You">
            <video
              ref={localVideoRef}
              muted
              autoPlay
              playsInline
              className="h-full w-full -scale-x-100 object-cover"
              style={{ display: camOn ? 'block' : 'none' }}
            />
            {!camOn ? <Avatar label="Camera off" /> : null}
          </Tile>
          <Tile label={counterpartyLabel}>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
              style={{ display: hasRemote ? 'block' : 'none' }}
            />
            {!hasRemote ? <Avatar label="Waiting…" /> : null}
          </Tile>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-6 py-4">
          {/* Voice mode = audio only, no video tiles. Hidden element keeps the
              remote audio track playing. */}
          <VoiceAvatar label="You" active={micOn} />
          <VoiceAvatar label={counterpartyLabel} active={hasRemote} />
          <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
        </div>
      )}

      <div className="flex items-center justify-center gap-2">
        {kind === 'video' ? (
          <ControlButton active={camOn} onClick={toggleCam}>
            {camOn ? 'Camera on' : 'Camera off'}
          </ControlButton>
        ) : null}
        <ControlButton active={micOn} onClick={toggleMic}>
          {micOn ? 'Mic on' : 'Muted'}
        </ControlButton>
        <button
          type="button"
          onClick={onLeave}
          className="rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Hang up
        </button>
      </div>

      {state === 'failed' ? (
        <p className="text-center text-[11px] text-ink/55">
          Media is peer-to-peer with STUN only, so a small share of cross-network
          pairs can&apos;t connect — a TURN relay later fixes those.
        </p>
      ) : null}
    </div>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-ink/90">
      {children}
      <span className="absolute bottom-1.5 left-1.5 rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white">
        {label}
      </span>
    </div>
  );
}

function Avatar({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-base">
        {label.slice(0, 1).toUpperCase()}
      </div>
      <span className="text-[10px]">{label}</span>
    </div>
  );
}

function VoiceAvatar({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold ${
          active ? 'bg-mulberry text-cream' : 'bg-ink/15 text-ink/60'
        }`}
      >
        {label.slice(0, 1).toUpperCase()}
      </div>
      <span className="text-[11px] text-ink/60">{label}</span>
    </div>
  );
}

function ControlButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium ${
        active
          ? 'border border-ink/20 text-ink hover:bg-ink/5'
          : 'bg-ink/80 text-white hover:bg-ink'
      }`}
    >
      {children}
    </button>
  );
}
