'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import {
  joinMeshCall,
  MAX_PEERS,
  type MeshHandle,
  type MeshRoomState,
  type RemotePeer,
} from '@/lib/mesh-call-webrtc';

/**
 * Prototype 3-way (up to 4) mesh-call room — for real multi-device testing of
 * lib/mesh-call-webrtc before it's wired into vendor↔couple threads. Everyone who
 * opens the same ?room= joins the same mesh; each tile is a live peer, the active
 * speaker gets a highlight. STUN-only here (cross-network TURN is proven on the
 * other surfaces and gets wired in at productionization via getCallIceServers).
 */

function PeerTile({ peer }: { peer: RemotePeer }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== peer.stream) ref.current.srcObject = peer.stream;
  }, [peer.stream]);
  const hasVideo = peer.stream.getVideoTracks().some((t) => t.readyState === 'live');
  return (
    <div
      className={`relative aspect-video overflow-hidden rounded-xl bg-black ring-2 transition ${
        peer.speaking ? 'ring-[var(--m-mulberry,#7a2e4a)]' : 'ring-transparent'
      }`}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={ref} autoPlay playsInline className="h-full w-full object-cover" />
      {!hasVideo ? (
        <div className="absolute inset-0 grid place-items-center text-xs text-white/60">
          camera off
        </div>
      ) : null}
      {peer.speaking ? (
        <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">
          ● speaking
        </span>
      ) : null}
    </div>
  );
}

export function MeshRoom({ room }: { room: string }) {
  const [state, setState] = useState<MeshRoomState>('waiting');
  const [peers, setPeers] = useState<RemotePeer[]>([]);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const handleRef = useRef<MeshHandle | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            width: { ideal: 1280, max: 1280 },
            height: { ideal: 720, max: 720 },
            frameRate: { ideal: 30, max: 30 },
          },
        });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (localVideoRef.current) localVideoRef.current.srcObject = s;
        handleRef.current = joinMeshCall({
          room,
          clientId: crypto.randomUUID(),
          localStream: s,
          onPeers: setPeers,
          onState: setState,
          onLocalSpeaking: setLocalSpeaking,
        });
      } catch {
        if (!cancelled) setError('Camera/microphone access was blocked. Allow it and reload.');
      }
    })();

    return () => {
      cancelled = true;
      handleRef.current?.leave();
      handleRef.current = null;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [room]);

  const toggleMic = useCallback(() => {
    setMicOn((on) => {
      handleRef.current?.setAudioEnabled(!on);
      return !on;
    });
  }, []);
  const toggleCam = useCallback(() => {
    setCamOn((on) => {
      handleRef.current?.setVideoEnabled(!on);
      return !on;
    });
  }, []);

  if (error) {
    return <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  }

  const full = peers.length >= MAX_PEERS;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--m-grey,#8c8884)]">
        Room <span className="font-mono font-semibold text-[var(--m-ink,#1a1a1a)]">{room}</span> ·{' '}
        {peers.length + 1}/{MAX_PEERS + 1} in the call
        {full ? ' · full' : ''} ·{' '}
        {state === 'waiting' ? 'waiting for others…' : state === 'connected' ? 'connected' : 'left'}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Local tile */}
        <div
          className={`relative aspect-video overflow-hidden rounded-xl bg-black ring-2 transition ${
            localSpeaking ? 'ring-[var(--m-mulberry,#7a2e4a)]' : 'ring-transparent'
          }`}
        >
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">
            You {micOn ? '' : '· muted'} {camOn ? '' : '· cam off'}
          </span>
        </div>

        {peers.map((p) => (
          <PeerTile key={p.id} peer={p} />
        ))}
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={toggleMic}
          aria-label={micOn ? 'Mute' : 'Unmute'}
          className="grid h-11 w-11 place-items-center rounded-full border border-ink/15 hover:bg-ink/5"
        >
          {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5 text-red-600" />}
        </button>
        <button
          type="button"
          onClick={toggleCam}
          aria-label={camOn ? 'Turn camera off' : 'Turn camera on'}
          className="grid h-11 w-11 place-items-center rounded-full border border-ink/15 hover:bg-ink/5"
        >
          {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5 text-red-600" />}
        </button>
        <button
          type="button"
          onClick={() => handleRef.current?.leave()}
          aria-label="Leave"
          className="grid h-11 w-11 place-items-center rounded-full bg-red-600 text-white hover:bg-red-700"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
