'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, ScanFace } from 'lucide-react';
import { DayOfFaceEnroll } from './day-of-face-enroll';
import type { PapicFaceMode } from '@/lib/papic-face-mode';
import type { FaceTaggingWish } from '@/lib/face-tagging-wish';

/**
 * ME → "FACE TAGGING" — the row from the approved design
 * (`prototypes/face_registration_2026-09-30_fable.html`, frame D):
 *
 *   · On  → "On · erased after the event"; tap → Retake selfie · Turn off;
 *   · Off, on the day → "Off" ; tap → the face screen;
 *   · before the day, after a Yes → "Selfie on the day", nothing to tap;
 *   · no Papic / face tagging off → the parent does not mount it at all
 *     (frame F — the guest never learns the feature exists).
 *
 * "Turn off" is the guest's own withdrawal — `withdrawFaceConsent`, the same
 * erasure as "Delete my face data" — handed in already bound. +0 actions.
 */
export function FaceTaggingRow({
  on,
  open,
  faceMode,
  wish,
  turnOff,
}: {
  /** The guest holds a face-tagging selfie. */
  on: boolean;
  /** The face screen may open now (askable + the day's capture window). */
  open: boolean;
  faceMode: PapicFaceMode;
  wish: FaceTaggingWish;
  /** `withdrawFaceConsent`, bound to this event and guest. */
  turnOff: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const [camera, setCamera] = useState(false);
  const [menu, setMenu] = useState(false);

  // A stored "No thanks" is never offered again here (never nagged); a Yes
  // before the day sees when; on the day the row opens the face screen.
  if (!on && (wish === false || (!open && wish !== true))) return null;

  const status = on ? (
    <>
      <span className="font-medium text-emerald-700">On</span> · erased after the event
    </>
  ) : open ? (
    'Off'
  ) : (
    'Selfie on the day'
  );
  const tappable = on || open;

  return (
    <div data-face-tagging-row className="border-y border-ink/10">
      <button
        type="button"
        disabled={!tappable}
        onClick={() => (on ? setMenu((m) => !m) : setCamera(true))}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/[0.06]">
          <ScanFace aria-hidden className="h-4 w-4 text-ink/60" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ink/55">Face tagging</span>
          <span className="block text-sm text-ink">{status}</span>
        </span>
        {tappable ? <ChevronRight aria-hidden className="h-4 w-4 text-ink/40" strokeWidth={1.75} /> : null}
      </button>
      {on && menu ? (
        <div className="flex gap-2 border-t border-ink/10 px-4 py-3">
          {open ? (
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                setCamera(true);
              }}
              className="min-h-11 flex-1 rounded-full bg-ink px-4 text-sm font-medium text-cream"
            >
              Retake selfie
            </button>
          ) : null}
          <form action={turnOff} className="flex-1">
            <button type="submit" className="min-h-11 w-full rounded-full bg-ink/[0.06] px-4 text-sm font-medium text-ink">
              Turn off
            </button>
          </form>
        </div>
      ) : null}
      {camera ? (
        <DayOfFaceEnroll
          context="me"
          faceMode={faceMode}
          wish={wish}
          onSkip={() => setCamera(false)}
          onDone={() => {
            setCamera(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
