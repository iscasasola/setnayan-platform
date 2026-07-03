'use client';

/**
 * Phone-side 3D Plan demo experience (owner spec, DECISION_LOG 2026-07-03,
 * extended 2026-07-03 "show my seat OR walk around the event"): a guest scans
 * their bound QR and lands here as themselves, with two things to do —
 *   • "Where am I seated?" — the scripted entrance→seat walk.
 *   • "Walk around" — free roam: tap anywhere on the floor to walk there
 *     (same obstacle-avoiding steering + chase camera), their own seat marked
 *     with a gold ring so they can always find their way back.
 * This pioneers the seat-plan program's OPEN wayfinding item (memory
 * `project_setnayan_smart_seating_plan`); both modes live inside the shared
 * `Plan3DScene` (also used by the desktop overlay), not one-off here.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Footprints, MapPin } from 'lucide-react';
import { Plan3DSceneLoader } from '@/app/_components/plan3d/plan3d-scene-loader';
import type { Plan3DScene, Plan3DGuest } from '@/app/_actions/plan3d-demo-actions';

type Phase = 'idle' | 'walking' | 'arrived' | 'roam';

// Pills use the `rounded-full` utility (not an inline borderRadius literal) —
// the radius-token lint guard forbids hardcoded radii (main hotfix 5f7bd92dd).
const PILL: React.CSSProperties = {
  minWidth: 220,
  padding: '14px 24px',
  border: 'none',
  background: '#2a2925',
  color: '#faf7f2',
  fontSize: 15,
  fontWeight: 500,
};

const PILL_GHOST: React.CSSProperties = {
  ...PILL,
  background: 'transparent',
  border: '1px solid rgba(42,41,37,.35)',
  color: '#2a2925',
};

export function Plan3DGuestView({ scene, guest }: { scene: Plan3DScene; guest: Plan3DGuest }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const table = scene.tables.find((t) => t.id === guest.tableId);

  return (
    <main
      style={{
        position: 'fixed',
        inset: 0,
        background: '#e7e1d8',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ flex: 1, minHeight: 0 }}>
        <Plan3DSceneLoader
          tables={scene.tables}
          floor={scene.floor}
          guests={scene.guests}
          walkTarget={phase === 'walking' || phase === 'arrived' ? { guestId: guest.id } : null}
          onWalkComplete={() => setPhase('arrived')}
          roam={phase === 'roam' ? { guestId: guest.id } : null}
          interactive={false}
        />
      </div>

      <div
        style={{
          padding: '18px 20px calc(20px + env(safe-area-inset-bottom))',
          background: 'linear-gradient(0deg, rgba(250,247,242,.98) 60%, rgba(250,247,242,0))',
          textAlign: 'center',
        }}
      >
        {phase === 'idle' || phase === 'walking' ? (
          <>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6c675e' }}>
              Hi <strong>{guest.name}</strong> — this is Maria &amp; Jose&rsquo;s room.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={phase === 'walking'}
                onClick={() => setPhase('walking')}
                className="rounded-full"
                style={{ ...PILL, opacity: phase === 'walking' ? 0.6 : 1 }}
              >
                {phase === 'walking' ? 'Walking you in…' : 'Where am I seated?'}
              </button>
              {phase === 'idle' ? (
                <button type="button" onClick={() => setPhase('roam')} className="rounded-full" style={PILL_GHOST}>
                  Walk around
                </button>
              ) : null}
            </div>
          </>
        ) : phase === 'arrived' ? (
          <>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#3f6b3f', fontSize: 14, fontWeight: 500 }}>
              <MapPin aria-hidden className="h-4 w-4" strokeWidth={2} />
              You&rsquo;re at {table?.label ?? 'your table'}
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 12, color: '#a8a4a0' }}>
              A sample guest, on a sample table — every real Setnayan guest gets this on the day.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14 }}>
              <button type="button" onClick={() => setPhase('roam')} className="rounded-full" style={PILL_GHOST}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Footprints aria-hidden className="h-4 w-4" strokeWidth={2} />
                  Walk around
                </span>
              </button>
            </div>
            <Link
              href="/"
              style={{
                display: 'inline-block',
                marginTop: 12,
                fontSize: 13,
                color: '#8C6932',
                textDecoration: 'underline',
              }}
            >
              Back to Setnayan
            </Link>
          </>
        ) : (
          /* roam */
          <>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#2a2925', fontSize: 14, fontWeight: 500 }}>
              <Footprints aria-hidden className="h-4 w-4" strokeWidth={2} />
              Tap anywhere on the floor to walk there
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#a8a4a0' }}>
              Your seat is the gold ring{table?.label ? ` — ${table.label}` : ''}.
            </p>
            <Link
              href="/"
              style={{
                display: 'inline-block',
                marginTop: 12,
                fontSize: 13,
                color: '#8C6932',
                textDecoration: 'underline',
              }}
            >
              Back to Setnayan
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
