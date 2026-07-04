'use client';

/**
 * The desktop half of the Live Studio homepage demo (owner spec, DECISION_LOG
 * 2026-07-03): a MINI CONTROL ROOM. Opening this overlay mints a FRESH
 * `demo_sessions` row (tokens are never reused across opens) and shows ONE QR
 * — both phones scan the same code and each becomes a live camera (slots by
 * claim order). The overlay then runs the control room: the program view
 * (selected camera fullscreen in the card) under a simple lower-third overlay
 * (monogram + "· LIVE"), with the two camera thumbnails as the switcher —
 * click to CUT between cam 1 and cam 2.
 *
 * Video is WebRTC peer-to-peer (lib/demo-webrtc.ts): phone getUserMedia →
 * RTCPeerConnection → this viewer, signaled over a Supabase Realtime channel.
 * Public STUN only, no TURN — a network that can't punch through gets the
 * graceful same-Wi-Fi hint instead. NOTHING is recorded or stored anywhere.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Volume2, VolumeX } from 'lucide-react';
import { OverlayShell, type OverlayId } from './HomeOverlays';
import { startDemoSession, type DemoQrPair } from '@/app/_actions/demo-session-actions';
import { watchDemoCameras, type CamSlot, type PeerConnectionState } from '@/lib/demo-webrtc';

const SLOT_LABEL: Record<CamSlot, string> = { a: 'Camera 1', b: 'Camera 2' };

/**
 * Keeps a <video> element fed with a (possibly changing) MediaStream. Muted by
 * default — only the PROGRAM view opts out (`muted={false}`) so exactly one
 * source is ever audible, mirroring a real control-room monitor. Toggling
 * `muted` re-runs play() so unmuting (a user click) reliably starts audio even
 * where the browser blocked unmuted autoplay.
 */
function LiveVideo({
  stream,
  muted = true,
  style,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    el.muted = muted;
    if (stream) void el.play().catch(() => {});
  }, [stream, muted]);
  // eslint-disable-next-line jsx-a11y/media-has-caption
  return <video ref={ref} muted={muted} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...style }} />;
}

/** The lower-third: sample monogram + "· LIVE" — pure CSS, sits over the program view. */
function LowerThird() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: 14,
        bottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 14px 7px 8px',
        borderRadius: 'var(--m-r-12, 12px)',
        background: 'rgba(20,19,18,.62)',
        backdropFilter: 'blur(8px)',
        color: '#fff',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 30,
          height: 30,
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,.55)',
          fontFamily: 'Georgia, serif',
          fontStyle: 'italic',
          fontSize: 13,
        }}
      >
        M&amp;J
      </span>
      <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 14, letterSpacing: '.02em' }}>
        Maria &amp; Jose
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, letterSpacing: '.08em' }}>
        · <span style={{ color: '#e2574c' }}>●</span> LIVE
      </span>
    </div>
  );
}

export function PanoodDemoOverlay({ current, onClose }: { current: OverlayId; onClose: () => void }) {
  const open = current === 'panood-demo';
  const [pair, setPair] = useState<DemoQrPair | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [streams, setStreams] = useState<Record<CamSlot, MediaStream | null>>({ a: null, b: null });
  const [slotStates, setSlotStates] = useState<Record<CamSlot, PeerConnectionState>>({ a: 'waiting', b: 'waiting' });
  const [program, setProgram] = useState<CamSlot>('a');
  // Program-audio monitor, off until the visitor clicks the speaker. Muted by
  // default keeps a laptop + phone in the same room from howling with feedback
  // the instant a camera connects, and dodges browsers that block unmuted
  // autoplay — the click that unmutes is the user gesture that permits sound.
  const [audioOn, setAudioOn] = useState(false);
  const programRef = useRef(program);
  programRef.current = program;

  // Mint a brand-new session every time this overlay opens (owner rule: QR
  // codes are never reused). The component stays mounted across open/close
  // (only OverlayShell's portal toggles), so this effect re-fires per open.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPending(true);
    setPair(null);
    setFailed(false);
    setStreams({ a: null, b: null });
    setSlotStates({ a: 'waiting', b: 'waiting' });
    setProgram('a');
    setAudioOn(false);
    startDemoSession('panood', window.location.origin)
      .then((p) => {
        if (!cancelled) setPair(p);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // The viewer half of the peer connection — lives exactly as long as the
  // overlay is open with a minted session; closing tears every peer down
  // (remote phones see the feed die; nothing lingers).
  useEffect(() => {
    if (!open || !pair) return;
    const viewer = watchDemoCameras({
      sessionId: pair.sessionId,
      onTrack: (slot, stream) => {
        setStreams((prev) => {
          // First camera in takes program automatically (no dead black frame
          // while the visitor figures out the switcher).
          if (!prev.a && !prev.b) setProgram(slot);
          return { ...prev, [slot]: stream };
        });
      },
      onSlotState: (slot, state) => {
        setSlotStates((prev) => (prev[slot] === state ? prev : { ...prev, [slot]: state }));
        if (state === 'failed') {
          setStreams((prev) => (prev[slot] ? { ...prev, [slot]: null } : prev));
        }
      },
    });
    return () => {
      viewer.close();
      setStreams({ a: null, b: null });
    };
  }, [open, pair]);

  const cut = useCallback((slot: CamSlot) => setProgram(slot), []);

  const anyLive = Boolean(streams.a || streams.b);
  const bothLive = Boolean(streams.a && streams.b);
  const anyFailed = slotStates.a === 'failed' || slotStates.b === 'failed';
  const programStream = streams[program] ?? streams[program === 'a' ? 'b' : 'a'];
  // A phone with no mic (or a blocked mic) publishes a video-only stream — the
  // monitor toggle stays disabled for that camera so it never promises sound
  // it can't play.
  const programHasAudio = Boolean(programStream && programStream.getAudioTracks().length > 0);

  return (
    <OverlayShell
      id="panood-demo"
      current={current}
      onClose={onClose}
      label="Live Studio live demo"
      cardStyle={{ maxWidth: anyLive ? 680 : 460 }}
    >
      <div className="hr-ov-eyebrow">Live Studio · live demo</div>
      <h2 className="hr-ov-title">Two phones. One control room.</h2>
      <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.55, color: '#6c675e' }}>
        Scan the code with two phones, each becomes a live camera. Then cut
        between them right here. Live only: nothing is recorded.
      </p>

      {failed ? (
        <p style={{ marginTop: 24, fontSize: 13, color: '#8c8884' }}>
          Couldn&rsquo;t start the demo right now. Close this and try again in
          a moment.
        </p>
      ) : pending || !pair ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24, color: '#8c8884', fontSize: 13 }}>
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
          Setting up a fresh control room…
        </div>
      ) : !anyLive ? (
        /* ── Lobby: the one QR, waiting for the first camera ─────────────── */
        <>
          <div
            className="hr-qr-fit"
            style={{
              position: 'relative',
              width: 200,
              height: 200,
              margin: '20px auto 0',
              borderRadius: 'var(--m-r-16, 16px)',
              border: '1px solid rgba(42,43,46,.12)',
              overflow: 'hidden',
            }}
            // Inline SVG rendered server-side by the SAME QR renderer +
            // palette every other Setnayan QR uses (lib/qr.ts).
            dangerouslySetInnerHTML={{ __html: pair.qrSvgA }}
          />
          <p style={{ marginTop: 14, fontSize: 13, fontWeight: 500, color: '#2a2925', textAlign: 'center' }}>
            Scan the same code with both phones
          </p>
          <p style={{ marginTop: 6, fontSize: 12, color: '#a8a4a0', textAlign: 'center' }}>
            {slotStates.a === 'connecting' || slotStates.b === 'connecting'
              ? 'A camera is connecting…'
              : 'This code is fresh for this open. It expires in 20 minutes.'}
          </p>
          {anyFailed && (
            <p style={{ marginTop: 10, fontSize: 12, color: '#8c8884', textAlign: 'center' }}>
              Video couldn&rsquo;t connect on this network. Phone and computer
              on the same Wi-Fi usually does it.
            </p>
          )}
        </>
      ) : (
        /* ── Control room: program view + lower-third + the cut switcher ── */
        <>
          <div
            style={{
              position: 'relative',
              marginTop: 18,
              aspectRatio: '16 / 9',
              borderRadius: 'var(--m-r-16, 16px)',
              overflow: 'hidden',
              background: '#141312',
            }}
          >
            <LiveVideo stream={programStream} muted={!(audioOn && programHasAudio)} />
            <LowerThird />
            <button
              type="button"
              onClick={() => setAudioOn((v) => !v)}
              disabled={!programHasAudio}
              aria-label={audioOn ? 'Mute program audio' : 'Listen to program audio'}
              title={
                programHasAudio
                  ? audioOn
                    ? 'Mute program audio'
                    : 'Listen to program audio'
                  : 'This camera isn’t sending sound'
              }
              style={{
                position: 'absolute',
                left: 12,
                top: 10,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 9px',
                borderRadius: 'var(--m-r-8, 8px)',
                background: 'rgba(20,19,18,.62)',
                color: '#fff',
                border: 'none',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '.05em',
                cursor: programHasAudio ? 'pointer' : 'default',
                opacity: programHasAudio ? 1 : 0.5,
              }}
            >
              {audioOn && programHasAudio ? (
                <Volume2 aria-hidden size={14} strokeWidth={2} />
              ) : (
                <VolumeX aria-hidden size={14} strokeWidth={2} />
              )}
              {audioOn && programHasAudio ? 'SOUND' : 'MUTED'}
            </button>
            <span
              style={{
                position: 'absolute',
                right: 12,
                top: 10,
                padding: '3px 9px',
                borderRadius: 'var(--m-r-8, 8px)',
                background: 'rgba(20,19,18,.62)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '.06em',
              }}
            >
              PROGRAM · {SLOT_LABEL[streams[program] ? program : program === 'a' ? 'b' : 'a']}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'stretch' }}>
            {(['a', 'b'] as const).map((slot) => {
              const live = Boolean(streams[slot]);
              const isProgram = live && streams[program] === streams[slot];
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => live && cut(slot)}
                  disabled={!live}
                  aria-label={live ? `Cut to ${SLOT_LABEL[slot]}` : `${SLOT_LABEL[slot]}, waiting`}
                  style={{
                    position: 'relative',
                    flex: 1,
                    aspectRatio: '16 / 9',
                    borderRadius: 'var(--m-r-12, 12px)',
                    overflow: 'hidden',
                    border: isProgram ? '2px solid #e2574c' : '1px solid rgba(42,43,46,.14)',
                    background: '#141312',
                    padding: 0,
                    cursor: live ? 'pointer' : 'default',
                  }}
                >
                  {live ? (
                    <LiveVideo stream={streams[slot]} />
                  ) : (
                    <span
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11.5,
                        color: '#8c8884',
                        padding: '0 10px',
                        textAlign: 'center',
                      }}
                    >
                      {slotStates[slot] === 'connecting'
                        ? 'Connecting…'
                        : slotStates[slot] === 'failed'
                          ? 'Couldn’t connect'
                          : 'Waiting for a scan'}
                    </span>
                  )}
                  <span
                    style={{
                      position: 'absolute',
                      left: 8,
                      bottom: 6,
                      padding: '2px 7px',
                      borderRadius: 'var(--m-r-8, 8px)',
                      background: 'rgba(20,19,18,.62)',
                      color: '#fff',
                      fontSize: 10.5,
                      fontWeight: 600,
                      letterSpacing: '.05em',
                    }}
                  >
                    {SLOT_LABEL[slot]}
                    {isProgram ? ' · ON AIR' : ''}
                  </span>
                </button>
              );
            })}

            {!bothLive && (
              <div style={{ width: 120, textAlign: 'center', flexShrink: 0 }}>
                <div
                  className="hr-qr-fit"
                  style={{
                    width: 104,
                    height: 104,
                    margin: '0 auto',
                    borderRadius: 'var(--m-r-12, 12px)',
                    border: '1px solid rgba(42,43,46,.12)',
                    overflow: 'hidden',
                  }}
                  dangerouslySetInnerHTML={{ __html: pair.qrSvgA }}
                />
                <div style={{ marginTop: 6, fontSize: 10.5, color: '#8c8884', lineHeight: 1.4 }}>
                  Scan with a second phone
                </div>
              </div>
            )}
          </div>

          <p style={{ marginTop: 14, fontSize: 12, color: '#a8a4a0', textAlign: 'center' }}>
            {bothLive
              ? 'Click a camera to cut. That’s the control room.'
              : anyFailed
                ? 'Video couldn’t connect on this network. Phone and computer on the same Wi-Fi usually does it.'
                : 'One camera live. Add the second phone for the full cut.'}
          </p>
        </>
      )}
    </OverlayShell>
  );
}
