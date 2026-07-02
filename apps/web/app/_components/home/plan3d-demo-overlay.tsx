'use client';

/**
 * The desktop half of the 3D Plan homepage demo (owner spec, DECISION_LOG
 * 2026-07-03): the pop-up renders the SAMPLE 3D ROOM (Maria & Jose, fictional
 * guests — zero privacy surface) using the SHIPPED guest 3D explorer. Clicking
 * any seated guest pops a QR **bound to that person**; scanning opens the room
 * on the phone as that guest, where "Where am I seated?" plays the
 * entrance-to-seat walk. A fresh session is minted on every open (QR tokens
 * are never reused — same rule as the Papic demo, same scaffold).
 */

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { OverlayShell, type OverlayId } from './HomeOverlays';
import {
  startPlan3dDemo,
  renderPlan3dGuestQr,
  type Plan3dDemoStart,
} from '@/app/_actions/demo-session-actions';
import { plan3dDemoScene, PLAN3D_DEMO_GUESTS, type DemoGuest } from './plan3d-demo-scene';

// three.js loads only when this overlay actually opens — never in the shared
// overlay chunk (the homepage stays light).
const GuestVenue3D = dynamic(() => import('@/app/[slug]/venue/_components/guest-venue-3d'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c8884', fontSize: 13 }}>
      <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
      <span style={{ marginLeft: 8 }}>Setting the room…</span>
    </div>
  ),
});

type Picked = { guest: DemoGuest; svg: string | null; pending: boolean };

export function Plan3dDemoOverlay({ current, onClose }: { current: OverlayId; onClose: () => void }) {
  const [start, setStart] = useState<Plan3dDemoStart | null>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);

  // Fresh session per open (owner rule) — and a clean slate for the QR panel.
  useEffect(() => {
    if (current !== 'plan3d-demo') return;
    let cancelled = false;
    setStart(null);
    setFailed(false);
    setPicked(null);
    startPlan3dDemo()
      .then((s) => {
        if (!cancelled) setStart(s);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [current]);

  const onSeatClick = (tableId: string, seatNumber: number) => {
    const guest = PLAN3D_DEMO_GUESTS.find((g) => g.table === tableId && g.seatNumber === seatNumber);
    if (!guest || !start) return;
    setPicked({ guest, svg: null, pending: true });
    renderPlan3dGuestQr(window.location.origin, start.token, guest.id)
      .then((r) => {
        setPicked((prev) =>
          prev?.guest.id === guest.id ? { guest, svg: r.ok ? r.svg : null, pending: false } : prev,
        );
      })
      .catch(() => {
        setPicked((prev) => (prev?.guest.id === guest.id ? { guest, svg: null, pending: false } : prev));
      });
  };

  return (
    <OverlayShell id="plan3d-demo" current={current} onClose={onClose} label="3D Plan live demo" cardStyle={{ maxWidth: 780 }}>
      <div className="hr-ov-eyebrow">3D Plan · live demo</div>
      <h2 className="hr-ov-title">Click a guest. Walk their way.</h2>
      <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.55, color: '#6c675e' }}>
        This is Maria &amp; Jose&rsquo;s sample room — every guest is fictional.
        Click any seated guest to get their QR, scan it, and your phone walks
        you from the entrance to their seat.
      </p>

      <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 420px', minWidth: 0 }}>
          <GuestVenue3D
            scene={plan3dDemoScene(null)}
            onSeatClick={onSeatClick}
            heightClass="h-[380px]"
            emptyHudText="Click any seated guest to get their QR · drag to look around"
          />
        </div>
        <div style={{ flex: '0 0 200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          {failed ? (
            <p style={{ fontSize: 13, color: '#8c8884' }}>
              Couldn&rsquo;t start the demo right now — close this and try again in a moment.
            </p>
          ) : !picked ? (
            <p style={{ fontSize: 13, color: '#8c8884' }}>
              {start ? 'Pick anyone in the room →' : 'Setting up a fresh demo…'}
            </p>
          ) : (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#2a2925' }}>{picked.guest.name}</div>
              <div style={{ width: 170, height: 170, marginTop: 10, borderRadius: 'var(--m-r-16, 16px)', border: '1px solid rgba(42,43,46,.12)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {picked.pending ? (
                  <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
                ) : picked.svg ? (
                  <div style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: picked.svg }} />
                ) : (
                  <span style={{ fontSize: 12, color: '#8c8884', padding: 10 }}>QR unavailable — try re-opening the demo.</span>
                )}
              </div>
              <p style={{ marginTop: 8, fontSize: 11.5, color: '#8c8884' }}>
                Scan to open the room as {picked.guest.name} — then tap
                &ldquo;Where am I seated?&rdquo;
              </p>
            </>
          )}
        </div>
      </div>
      <p style={{ marginTop: 12, fontSize: 11.5, color: '#a8a4a0' }}>
        Fresh codes every open · they expire in 20 minutes · nothing is recorded.
      </p>
    </OverlayShell>
  );
}
