'use client';

import { useState } from 'react';
import { Download, Loader2, Check } from 'lucide-react';
import { saveImageToDevice } from '@/lib/save-to-device';

// "Save to phone" overlay control for a gallery/wall tile. On mobile the native
// share sheet ("Save to Photos" / "Save image") drops it in the camera roll;
// elsewhere it falls back to a download. Best-effort; a brief check-mark on
// success. Shared by the couple's Papic gallery + the guest day-of wall.
//
// 🚨 IT USED TO SIT ON TOP OF THE PICTURE (fixed 2026-08-10, found by the owner
// looking at his own gallery). It was a pill anchored `left-1.5 top-1.5` — and
// on a thumbnail a 44px-tall pill reading "Save" covers most of the upper-left
// of the photo. With fourteen photos on screen he could not see any of them; the
// control meant to save a picture was hiding it.
//
// ⚠ THE LABEL AND THE 44px TARGET ARE NOT THE BUG — DO NOT "FIX" THIS BY
// SHRINKING IT. They are the Guest Legibility Floor, a deliberate decision: the
// save action must be a VISIBLE, ≥44px-tappable, LABELLED control, not a 20px
// icon-only corner dot an older guest cannot see or hit. Both survive here in
// full. What changed is WHERE it sits: a bottom bar over its own scrim, so it
// reads as chrome along an edge instead of an object dropped on the subject.
// Photos are framed centre and upper-middle; the bottom strip is the one place
// a control costs nothing.
export function SavePhotoButton({ url, filename }: { url: string; filename: string }) {
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle');
  const label = state === 'saving' ? 'Saving…' : state === 'done' ? 'Saved' : 'Save';
  return (
    <button
      type="button"
      aria-label="Save to phone"
      onClick={async (e) => {
        e.stopPropagation();
        if (state === 'saving') return;
        setState('saving');
        const r = await saveImageToDevice(url, filename);
        setState(r === 'failed' ? 'idle' : 'done');
        if (r !== 'failed') setTimeout(() => setState('idle'), 1500);
      }}
      className="absolute inset-x-0 bottom-0 inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 bg-gradient-to-t from-black/75 via-black/55 to-transparent px-3 pb-1.5 pt-3 text-sm font-semibold text-cream transition active:bg-black/70"
    >
      {state === 'saving' ? (
        <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
      ) : state === 'done' ? (
        <Check aria-hidden className="h-4 w-4" strokeWidth={2.5} />
      ) : (
        <Download aria-hidden className="h-4 w-4" strokeWidth={2} />
      )}
      <span>{label}</span>
    </button>
  );
}
