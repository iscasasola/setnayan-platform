'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { joinCall, type CallHandle, type CallState } from '@/lib/call-webrtc';

type Mode = 'video' | 'voice';

/**
 * The vendor↔couple CALL prototype room. Two people open the same `?room=` link
 * (any two devices/networks, like the Live Studio demo), pick voice or video,
 * and connect peer-to-peer. Free — media never touches a server; STUN-only, no
 * TURN (so it fails cleanly on the rare both-sides-hard-NAT pair, same as the
 * demo). Productionizing = embed this in the accepted thread + a "Start call"
 * ring; the transport (lib/call-webrtc.ts) is unchanged.
 */
export function CallRoom({ initialRoom }: { initialRoom: string | null }) {
  const [room, setRoom] = useState<string | null>(initialRoom);
  const [mode, setMode] = useState<Mode | null>(null);
  const [state, setState] = useState<CallState | null>(null);
  const [hasRemote, setHasRemote] = useState(false);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const handleRef = useRef<CallHandle | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Assign a room on first load if none was in the URL, and reflect it back so
  // the link is shareable.
  useEffect(() => {
    if (room) return;
    const r = crypto.randomUUID().slice(0, 8);
    setRoom(r);
    const url = new URL(window.location.href);
    url.searchParams.set('room', r);
    window.history.replaceState(null, '', url.toString());
  }, [room]);

  const shareUrl =
    typeof window !== 'undefined' && room
      ? `${window.location.origin}/prototype/call?room=${room}`
      : '';

  const start = useCallback(
    async (chosen: Mode) => {
      if (!room) return;
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: chosen === 'video',
          audio: true,
        });
        streamRef.current = stream;
        setMode(chosen);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        handleRef.current = joinCall({
          room,
          clientId: crypto.randomUUID(),
          localStream: stream,
          onRemoteStream: (s) => {
            setHasRemote(Boolean(s));
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = s;
          },
          onState: setState,
        });
      } catch {
        setError('Camera/microphone access was blocked. Allow it and try again.');
      }
    },
    [room],
  );

  useEffect(() => {
    return () => {
      handleRef.current?.leave();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

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
  const hangup = () => {
    handleRef.current?.leave();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    handleRef.current = null;
    setMode(null);
    setState(null);
    setHasRemote(false);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const statusLabel: Record<CallState, string> = {
    waiting: 'Waiting for the other person to join…',
    connecting: 'Connecting…',
    connected: 'Connected',
    failed: "Couldn't connect — try again, or get on the same Wi-Fi (no TURN in this prototype).",
    ended: 'Call ended.',
  };

  // ---- Pre-join screen ---------------------------------------------------
  if (!mode) {
    return (
      <div className="mx-auto max-w-md space-y-5 p-6">
        <div>
          <h1 className="text-lg font-semibold text-ink">Call prototype</h1>
          <p className="mt-1 text-sm text-ink/60">
            Open this same link on another device or send it to the other person, then start a
            call. Free, peer-to-peer — same transport as the Live Studio demo.
          </p>
        </div>

        <div className="space-y-2 rounded-lg border border-ink/10 bg-white/60 p-4">
          <p className="text-xs font-semibold text-ink">Share this call</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={shareUrl}
              className="min-w-0 flex-1 rounded-md border border-ink/15 bg-white px-2 py-1.5 text-xs text-ink/80"
            />
            <button
              type="button"
              onClick={copyLink}
              className="shrink-0 rounded-md border border-ink/20 px-3 py-1.5 text-xs font-medium text-ink hover:bg-ink/5"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {error ? <p className="text-xs text-red-600">{error}</p> : null}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => start('video')}
            className="rounded-lg bg-ink px-4 py-3 text-sm font-medium text-white hover:bg-ink/90"
          >
            Start video call
          </button>
          <button
            type="button"
            onClick={() => start('voice')}
            className="rounded-lg border border-ink/20 px-4 py-3 text-sm font-medium text-ink hover:bg-ink/5"
          >
            Start voice call
          </button>
        </div>
      </div>
    );
  }

  // ---- In-call screen ----------------------------------------------------
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <p className="text-center text-xs text-ink/60" aria-live="polite">
        {state ? statusLabel[state] : 'Starting…'}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Tile label="You">
          <video
            ref={localVideoRef}
            muted
            autoPlay
            playsInline
            className="h-full w-full -scale-x-100 object-cover"
            style={{ display: mode === 'video' && camOn ? 'block' : 'none' }}
          />
          {mode !== 'video' || !camOn ? <Avatar label="Camera off" /> : null}
        </Tile>
        <Tile label="Them">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="h-full w-full object-cover"
            style={{ display: hasRemote ? 'block' : 'none' }}
          />
          {!hasRemote ? <Avatar label="No one yet" /> : null}
        </Tile>
      </div>

      <div className="flex items-center justify-center gap-3">
        {mode === 'video' ? (
          <ControlButton active={camOn} onClick={toggleCam}>
            {camOn ? 'Camera on' : 'Camera off'}
          </ControlButton>
        ) : null}
        <ControlButton active={micOn} onClick={toggleMic}>
          {micOn ? 'Mic on' : 'Muted'}
        </ControlButton>
        <button
          type="button"
          onClick={hangup}
          className="rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Hang up
        </button>
      </div>

      {state === 'failed' ? (
        <p className="text-center text-xs text-ink/60">
          Media is peer-to-peer with STUN only (no TURN in this prototype), so a small share of
          cross-network pairs can&apos;t connect — adding a TURN relay later fixes those.
        </p>
      ) : null}
    </div>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-ink/90">
      {children}
      <span className="absolute bottom-2 left-2 rounded bg-black/40 px-2 py-0.5 text-[11px] text-white">
        {label}
      </span>
    </div>
  );
}

function Avatar({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-lg">
        {label.slice(0, 1)}
      </div>
      <span className="text-[11px]">{label}</span>
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
