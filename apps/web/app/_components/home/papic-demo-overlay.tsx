'use client';

/**
 * The desktop half of the Papic homepage live demo (owner spec, DECISION_LOG
 * 2026-07-03 — PR-1 of the demos program). Opening this overlay mints a FRESH
 * `demo_sessions` row every time (tokens are never reused across opens) and
 * shows two QR codes — "You" and "A friend" — that live-update to a checkmark
 * as each phone scans in, via the same Realtime presence channel the join
 * page publishes to (`use-demo-channel.ts`).
 *
 * PR-1 SCOPE: mint + QR display + live join status only. The phones' capture
 * / theme / cross-phone face-tag / save-to-phone steps are PR-2 (see
 * `demo-join-flow.tsx`'s scope note) — this overlay doesn't yet show any
 * captured photo, because none exists yet in this build.
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { OverlayShell, type OverlayId } from './HomeOverlays';
import { useDemoChannel } from '@/app/_components/demo-session/use-demo-channel';
import { startDemoSession, type DemoQrPair } from '@/app/_actions/demo-session-actions';

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

export function PapicDemoOverlay({ current, onClose }: { current: OverlayId; onClose: () => void }) {
  const [pair, setPair] = useState<DemoQrPair | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  // Mint a brand-new session every time this overlay opens (owner rule: QR
  // codes are never reused). The component itself stays mounted across
  // open/close (only OverlayShell's portal toggles), so this effect re-fires
  // cleanly on each re-open.
  useEffect(() => {
    if (current !== 'papic-demo') return;
    let cancelled = false;
    setPending(true);
    setPair(null);
    setFailed(false);
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

  const presence = useDemoChannel(pair?.sessionId ?? '');
  const bothJoined = presence.a.joined && presence.b.joined;

  return (
    <OverlayShell id="papic-demo" current={current} onClose={onClose} label="Papic live demo" cardStyle={{ maxWidth: 460 }}>
      <div className="hr-ov-eyebrow">Papic · live demo</div>
      <h2 className="hr-ov-title">Grab a friend and try it live.</h2>
      <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.55, color: '#6c675e' }}>
        Scan one code each. No app, no sign-up — just your phone&rsquo;s
        camera.
      </p>

      {failed ? (
        <p style={{ marginTop: 24, fontSize: 13, color: '#8c8884' }}>
          Couldn&rsquo;t start the demo right now — close this and try again in
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
          <p style={{ marginTop: 18, fontSize: 12, color: '#a8a4a0', textAlign: 'center' }}>
            {bothJoined
              ? 'You’re both in! Check your phones to keep going.'
              : 'This code refreshes every time you open this demo — it expires in 20 minutes.'}
          </p>
        </>
      )}
    </OverlayShell>
  );
}
