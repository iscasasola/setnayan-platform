'use client';

/**
 * Phone-side 3D Plan demo experience (owner spec, DECISION_LOG 2026-07-03):
 * a guest scans their bound QR and lands here as themselves. One big button
 * — "Where am I seated?" — plays the entrance→seat walk. This pioneers the
 * seat-plan program's OPEN wayfinding item (memory
 * `project_setnayan_smart_seating_plan`); the walk itself is built reusable
 * inside `Plan3DScene` (shared with the desktop overlay), not one-off here.
 */

import { useState } from 'react';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { Plan3DSceneLoader } from '@/app/_components/plan3d/plan3d-scene-loader';
import type { Plan3DScene, Plan3DGuest } from '@/app/_actions/plan3d-demo-actions';

type Phase = 'idle' | 'walking' | 'arrived';

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
          walkTarget={phase !== 'idle' ? { guestId: guest.id } : null}
          onWalkComplete={() => setPhase('arrived')}
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
        {phase !== 'arrived' ? (
          <>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6c675e' }}>
              Hi <strong>{guest.name}</strong> — this is Maria &amp; Jose&rsquo;s room.
            </p>
            <button
              type="button"
              disabled={phase === 'walking'}
              onClick={() => setPhase('walking')}
              style={{
                minWidth: 240,
                padding: '14px 24px',
                borderRadius: 999,
                border: 'none',
                background: '#2a2925',
                color: '#faf7f2',
                fontSize: 15,
                fontWeight: 500,
                opacity: phase === 'walking' ? 0.6 : 1,
              }}
            >
              {phase === 'walking' ? 'Walking you in…' : 'Where am I seated?'}
            </button>
          </>
        ) : (
          <>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#3f6b3f', fontSize: 14, fontWeight: 500 }}>
              <MapPin aria-hidden className="h-4 w-4" strokeWidth={2} />
              You&rsquo;re at {table?.label ?? 'your table'}
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 12, color: '#a8a4a0' }}>
              A sample guest, on a sample table — every real Setnayan guest gets this on the day.
            </p>
            <Link
              href="/"
              style={{
                display: 'inline-block',
                marginTop: 14,
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
