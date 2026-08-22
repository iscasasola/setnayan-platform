'use client';

import { useEffect, useRef, useState } from 'react';
import { User, VideoOff } from 'lucide-react';
import { joinCall, type CallHandle, type CallState } from '@/lib/call-webrtc';
import { getCallIceServers } from '@/app/_actions/thread-call-actions';
import { endThreadCall } from '@/app/_actions/thread-call-actions';

/**
 * The in-thread 1:1 CALL room (Relationship_Workspace_and_Appointments · "Call";
 * PR 10). Embeds the free P2P WebRTC transport (lib/call-webrtc.ts) directly in
 * an accepted vendor↔couple thread. Both parties open the same thread and join
 * the same room (keyed by threadId), then connect peer-to-peer — media NEVER
 * touches a server. A Cloudflare TURN relay is used WHEN CONFIGURED; whether one
 * was actually minted for this call is reported as `relayAvailable`, and the
 * failure copy is built from it rather than assuming. (This line used to state
 * "STUN-only, no TURN" as a permanent fact.)
 *
 * Self-starting WebRTC call room (grew out of a since-removed prototype): the
 * caller already picked voice/video at launch) and wired to the thread_calls
 * metadata row: hang up / unmount → leave() + stop tracks + endThreadCall().
 */

const STATUS_LABEL: Record<CallState, string> = {
  waiting: 'Waiting for them to join…',
  connecting: 'Connecting…',
  connected: 'Connected',
  // `failed` is built at render from `relayAvailable` — see statusLabel() below.
  // It used to be the fixed string "Couldn't connect — try again, or get on the
  // same Wi-Fi (no TURN yet)": engineering jargon shown to a couple, and a claim
  // that turns into a lie the moment the relay keys are set.
  failed: "Couldn't connect — try again.",
  ended: 'Call ended.',
};

/**
 * What to tell someone whose call would not connect.
 *
 * DERIVED from whether a relay actually came back for THIS call, never from a
 * hardcoded belief about the deployment. With a relay, "try again" is the honest
 * advice — a failure is a transient. Without one, the same-network hint is the
 * only thing that will actually work, and saying so beats a shrug.
 */
function statusLabel(state: CallState, relayAvailable: boolean): string {
  if (state === 'failed' && !relayAvailable) {
    return "Couldn't connect — try again, or get on the same Wi-Fi as them.";
  }
  return STATUS_LABEL[state];
}

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
  // Whether a relay actually came back for THIS call. Defaults true so a failed
  // ICE fetch never accuses the deployment of a misconfiguration it may not have.
  const [relayAvailable, setRelayAvailable] = useState(true);

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
          // 720p @ 30fps ceiling for the CALL (owner 2026-07-14) — clean for
          // talking-heads, ~half the bytes of 1080p (lighter on mobile battery +
          // less TURN relay data). `ideal` + `max` firmly caps it while still
          // returning a stream on cameras that can't hit exactly 720p (downscales
          // to fit; no OverconstrainedError). Deliberately CALL-ONLY — Live Studio
          // (panood-camera-publish) and Papic (use-papic-camera) keep their own
          // capture settings, untouched.
          video:
            kind === 'video'
              ? {
                  width: { ideal: 1280, max: 1280 },
                  height: { ideal: 720, max: 720 },
                  frameRate: { ideal: 30, max: 30 },
                }
              : false,
        });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (localVideoRef.current) localVideoRef.current.srcObject = s;
        // Fetch ICE servers (STUN + a minted TURN relay when configured) before
        // joining, so a couple/coordinator on mobile data / an isolated venue
        // Wi-Fi can still connect. Falls back to the transport's STUN-only default.
        const { iceServers, relayAvailable: relay } = await getCallIceServers(
          threadId,
        ).catch(() => ({
          iceServers: undefined as RTCIceServer[] | undefined,
          relayAvailable: true,
        }));
        setRelayAvailable(relay);
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        handle = joinCall({
          // ⚠ `threadId` ALONE — and this line is why the migration in this PR is
          // safe. joinCall builds the topic as `call:${room}`, so passing
          // `call:${threadId}` made the real channel **`call:call:{threadId}`**,
          // double-prefixed. On a PUBLIC channel that was harmless: any topic
          // string is accepted and both parties built the same wrong one. The
          // moment the channel goes PRIVATE it is fatal — the RLS predicate reads
          // the id after `call:`, gets `call:{uuid}`, fails the uuid cast, and
          // returns FALSE for EVERY call. Shipping the private channel without
          // this line would have taken calling down completely.
          room: threadId,
          clientId: crypto.randomUUID(),
          localStream: s,
          iceServers,
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
          {state ? statusLabel(state, relayAvailable) : 'Starting…'}
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
            {!camOn ? (
              <Avatar
                label="Camera off"
                icon={<VideoOff aria-hidden className="h-5 w-5" strokeWidth={1.75} />}
              />
            ) : null}
          </Tile>
          <Tile label={counterpartyLabel}>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
              style={{ display: hasRemote ? 'block' : 'none' }}
            />
            {!hasRemote ? (
              <Avatar
                label="Waiting…"
                icon={<User aria-hidden className="h-5 w-5" strokeWidth={1.75} />}
              />
            ) : null}
          </Tile>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-6 py-4">
          {/* Voice mode = audio only, no video tiles. Hidden element keeps the
              remote audio track playing. */}
          <VoiceAvatar label="You" active={micOn} />
          <VoiceAvatar
            label={counterpartyLabel}
            active={hasRemote}
            /* A name — the one label here that IS one, so it keeps its initial. */
            initial={counterpartyLabel.slice(0, 1).toUpperCase()}
          />
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

      {state === 'failed' && !relayAvailable ? (
        <p className="text-center text-[11px] text-ink/55">
          Calls connect your two phones directly. On some mobile networks that
          isn&apos;t possible, and there is no relay set up to fall back on.
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

/**
 * A STATUS is not a name. This slot only ever carries one — "Camera off",
 * "Waiting…" — and it used to slice the first character off whatever string it
 * was handed, so a person who muted their own camera watched a circle appear
 * containing the letter "C", and one waiting for their supplier got "W". Both
 * read as a broken monogram, because that is exactly the shape a monogram has.
 * The caption already says the words; the circle takes an icon.
 */
function Avatar({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
        {icon}
      </div>
      <span className="text-[10px]">{label}</span>
    </div>
  );
}

/**
 * `initial` is passed ONLY when the label is a person's name — the supplier on
 * the other end. Your own tile is captioned "You", which is not a name, so
 * slicing it produced a circle reading "Y". No initial means a person glyph.
 */
function VoiceAvatar({
  label,
  active,
  initial,
}: {
  label: string;
  active: boolean;
  initial?: string | null;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold ${
          active ? 'bg-mulberry text-cream' : 'bg-ink/15 text-ink/60'
        }`}
      >
        {initial ? initial : <User aria-hidden className="h-6 w-6" strokeWidth={1.75} />}
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
