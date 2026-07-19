'use client';

/**
 * The desktop half of the Papic homepage live demo (owner spec, DECISION_LOG
 * 2026-07-03). Opening this overlay mints a FRESH `demo_sessions` row every
 * time (tokens are never reused across opens) and shows two QR codes — "You"
 * and "A friend" — that live-update as each phone scans in.
 *
 * PR-2 (this build): the LIVE MIRROR + the style row. Captured frames relay
 * transiently over the session's Realtime channel (never persisted) and land
 * here tagged; the STYLE IS SET ON THIS POP-UP (owner rule) from the shipped
 * PAPIC_STYLES registry — switching it restyles the mirror instantly and the
 * phones' save-to-phone bakes in whatever this pop-up has set.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { OverlayShell, type OverlayId } from './HomeOverlays';
import {
  useDemoChannel,
  untaggedReason,
  type DemoDiag,
  type DemoMessage,
  type DemoRole,
} from '@/app/_components/demo-session/use-demo-channel';
import { startDemoSession, type DemoQrPair } from '@/app/_actions/demo-session-actions';
import { PAPIC_STYLES, DEFAULT_PAPIC_STYLE } from '@/lib/papic-photo-styles';

type MirrorPhoto = { id: string; from: DemoRole; dataUrl: string; tags: DemoRole[]; diag?: DemoDiag };

function QrTile({ label, svg, joined }: { label: string; svg: string; joined: boolean }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          position: 'relative',
          width: 160,
          height: 160,
          margin: '0 auto',
          borderRadius: 'var(--m-r-16, 16px)',
          border: '1px solid rgba(42,43,46,.12)',
          overflow: 'hidden',
        }}
      >
        <div
          className="hr-qr-fit"
          style={{ width: '100%', height: '100%', opacity: joined ? 0.35 : 1, transition: 'opacity .3s ease' }}
          // Inline SVG rendered server-side by the SAME QR renderer + palette
          // every other Setnayan QR uses (lib/qr.ts) — no client QR library.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        {joined && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 44,
              color: '#3f6b3f',
            }}
          >
            ✓
          </div>
        )}
      </div>
      <div style={{ marginTop: 10, fontSize: 13, fontWeight: 500, color: '#2a2925' }}>{label}</div>
      <div style={{ fontSize: 11.5, color: joined ? '#3f6b3f' : '#8c8884' }}>
        {joined ? 'Joined!' : 'Waiting for a scan…'}
      </div>
    </div>
  );
}

const TAG_LABEL: Record<DemoRole, string> = { a: 'You', b: 'Your friend' };

export function PapicDemoOverlay({ current, onClose }: { current: OverlayId; onClose: () => void }) {
  const [pair, setPair] = useState<DemoQrPair | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [photos, setPhotos] = useState<MirrorPhoto[]>([]);
  const [remaining, setRemaining] = useState(3);
  const [style, setStyle] = useState<string>(DEFAULT_PAPIC_STYLE);

  // Mint a brand-new session every time this overlay opens (owner rule: QR
  // codes are never reused). The component itself stays mounted across
  // open/close (only OverlayShell's portal toggles), so this effect re-fires
  // cleanly on each re-open — and resets the mirror with it.
  useEffect(() => {
    if (current !== 'papic-demo') return;
    let cancelled = false;
    setPending(true);
    setPair(null);
    setFailed(false);
    setPhotos([]);
    setRemaining(3);
    setStyle(DEFAULT_PAPIC_STYLE);
    startDemoSession('papic', window.location.origin)
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
  }, [current]);

  // Latest style + send live in refs so a phone's style-request is answered
  // with the CURRENT style, without side effects inside setState updaters
  // (updaters must stay pure — house rule from the gate scroll-lock bug).
  const styleRef = useRef(style);
  styleRef.current = style;
  const sendRef = useRef<((msg: DemoMessage) => void) | null>(null);

  const onMessage = useCallback((msg: DemoMessage) => {
    if (msg.type === 'photo') {
      setPhotos((prev) =>
        prev.some((p) => p.id === msg.id)
          ? prev
          : [...prev, { id: msg.id, from: msg.from, dataUrl: msg.dataUrl, tags: msg.tags, diag: msg.diag }],
      );
      setRemaining(msg.remaining);
    } else if (msg.type === 'style-request') {
      sendRef.current?.({ type: 'style', style: styleRef.current });
    }
  }, []);

  const { presence, send } = useDemoChannel(pair?.sessionId ?? '', undefined, onMessage);
  sendRef.current = send;

  const pickStyle = useCallback(
    (id: string) => {
      setStyle(id);
      send({ type: 'style', style: id });
    },
    [send],
  );

  const bothJoined = presence.a.joined && presence.b.joined;
  const styleCss = PAPIC_STYLES.find((s) => s.id === style)?.cssPreview ?? '';

  return (
    <OverlayShell id="papic-demo" current={current} onClose={onClose} label="Papic live demo" cardStyle={{ maxWidth: 560 }}>
      <div className="hr-ov-eyebrow">Papic · live demo</div>
      <h2 className="hr-ov-title">Grab a friend and try it live.</h2>
      <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.55, color: '#6c675e' }}>
        Scan one code each. No app, no sign-up, just your phone&rsquo;s
        camera.
      </p>

      {failed ? (
        <p style={{ marginTop: 24, fontSize: 13, color: '#8c8884' }}>
          Couldn&rsquo;t start the demo right now. Close this and try again in
          a moment.
        </p>
      ) : pending || !pair ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24, color: '#8c8884', fontSize: 13 }}>
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
          Setting up a fresh demo…
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 22, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
            <QrTile label="You" svg={pair.qrSvgA} joined={presence.a.joined} />
            <QrTile label="A friend" svg={pair.qrSvgB} joined={presence.b.joined} />
          </div>

          {/* ── the live mirror (PR-2) — frames relayed over the session channel ── */}
          {photos.length > 0 && (
            <>
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  justifyContent: 'center',
                  marginTop: 18,
                  flexWrap: 'wrap',
                }}
                role="radiogroup"
                aria-label="Photo style"
              >
                {PAPIC_STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => pickStyle(s.id)}
                    aria-pressed={style === s.id}
                    style={{
                      border: `1px solid ${style === s.id ? '#2a2925' : 'rgba(42,43,46,.25)'}`,
                      background: style === s.id ? '#2a2925' : 'transparent',
                      color: style === s.id ? '#f2f2f0' : '#54514d',
                      fontSize: 12,
                      padding: '6px 13px',
                      borderRadius: 'var(--m-r-full)',
                      cursor: 'pointer',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.min(photos.length, 3)}, 1fr)`,
                  gap: 10,
                  marginTop: 14,
                }}
              >
                {photos.map((p) => (
                  <figure key={p.id} style={{ margin: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.dataUrl}
                      alt={p.tags.length ? `Photo of ${p.tags.map((t) => TAG_LABEL[t]).join(' and ')}` : 'Demo photo'}
                      style={{
                        width: '100%',
                        borderRadius: 'var(--m-r-16, 16px)',
                        filter: styleCss,
                        transition: 'filter .25s ease',
                      }}
                    />
                    <figcaption style={{ marginTop: 4, fontSize: 11, color: '#8c8884', textAlign: 'center' }}>
                      {p.tags.length ? p.tags.map((t) => TAG_LABEL[t]).join(' · ') : untaggedReason(p.diag)}
                    </figcaption>
                  </figure>
                ))}
              </div>
              <p style={{ marginTop: 8, fontSize: 11.5, color: '#8c8884', textAlign: 'center' }}>
                {remaining > 0
                  ? `${remaining} demo shot${remaining === 1 ? '' : 's'} left. The style you pick here bakes into their saves.`
                  : 'Demo roll finished. The real Papic is unlimited, every guest, all day.'}
              </p>
            </>
          )}

          {photos.length === 0 && (
            <p style={{ marginTop: 18, fontSize: 12, color: '#a8a4a0', textAlign: 'center' }}>
              {bothJoined
                ? 'You’re both in! Shots from your phones appear here, live.'
                : 'This code refreshes every time you open this demo. It expires in 20 minutes.'}
            </p>
          )}
        </>
      )}
    </OverlayShell>
  );
}
