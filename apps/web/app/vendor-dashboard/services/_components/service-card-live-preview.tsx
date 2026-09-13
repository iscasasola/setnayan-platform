'use client';

import { useEffect, useRef, useState } from 'react';

import { readSnapshot, type Snapshot } from '@/lib/service-card-snapshot';
import { ServiceCardFace } from './service-card-face';

/**
 * Live service-card preview (v20 prototype — owner: "when we create a service
 * card, we want to see the exact card"). Renders INSIDE the create/edit form
 * and mirrors it as the vendor types.
 *
 * HOW IT READS THE FORM: on mount it finds its closest <form> and snapshots
 * FormData on every input/change event — plus a light interval, because the
 * bracket/inclusion/discount editors write React-controlled HIDDEN inputs whose
 * updates fire no native DOM events. Purely presentational: it renders no
 * inputs of its own, so it adds nothing to the submitted payload.
 *
 * ── WHAT LIVES ELSEWHERE NOW (2026-09-08) ─────────────────────────────────
 * The DRAWING is `./service-card-face`, and the READING is
 * `@/lib/service-card-snapshot`. Both moved out so the vendor's card LIST can
 * render the identical card from stored values — owner: *"we want to show the
 * actual service cards."* This component is now the live-mirroring wrapper and
 * nothing else; it must not re-implement either half.
 */
export function ServiceCardLivePreview({
  leafPathLabel,
  addonsFromPhp,
  initialCoverUrl,
}: {
  /** "Leaf · Parent" context line under the name (server-resolved). */
  leafPathLabel: string;
  /** Cheapest PAID add-on (server-known; the AddonsEditor manages its own forms). */
  addonsFromPhp?: number | null;
  /** Presigned/public URL of the current cover when editing; null on create. */
  initialCoverUrl?: string | null;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    const form = holderRef.current?.closest('form');
    if (!form) return;
    const read = () => {
      try {
        setSnap(readSnapshot(new FormData(form)));
      } catch {
        /* a mid-render read never breaks the form */
      }
    };
    read();
    form.addEventListener('input', read);
    form.addEventListener('change', read);
    // The list editors write React-controlled hidden inputs (no DOM events);
    // a light poll keeps the preview honest while the form is on screen.
    const tick = setInterval(read, 800);
    return () => {
      form.removeEventListener('input', read);
      form.removeEventListener('change', read);
      clearInterval(tick);
    };
  }, []);

  if (!snap) return <div ref={holderRef} aria-hidden />;

  return (
    <div ref={holderRef}>
      <div className="mb-1 flex items-center justify-between">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.13em]"
          style={{ color: 'var(--m-slate-3)' }}
        >
          Card preview
        </span>
      </div>
      <ServiceCardFace
        snap={snap}
        leafPathLabel={leafPathLabel}
        addonsFromPhp={addonsFromPhp}
        coverUrl={initialCoverUrl}
      />
    </div>
  );
}
