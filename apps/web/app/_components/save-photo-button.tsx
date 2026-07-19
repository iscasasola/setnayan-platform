'use client';

import { useState } from 'react';
import { Download, Loader2, Check } from 'lucide-react';
import { saveImageToDevice } from '@/lib/save-to-device';

// "Save to phone" overlay button for a gallery/wall tile. On mobile the native
// share sheet ("Save to Photos" / "Save image") drops it in the camera roll;
// elsewhere it falls back to a download. Best-effort; a brief check-mark on
// success. The parent tile positions it (absolute, top-left). Shared by the
// couple's Papic gallery + the guest day-of wall.
export function SavePhotoButton({ url, filename }: { url: string; filename: string }) {
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle');
  // Guest Legibility Floor: the "save my photo" action must be a VISIBLE,
  // ≥44px-tappable, labelled control — not a 20px icon-only corner dot an older
  // guest can't see or hit. A scrim pill keeps it legible over any photo.
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
      className="absolute left-1.5 top-1.5 inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-black/60 px-3 text-sm font-semibold text-cream shadow-sm backdrop-blur-[2px] transition active:scale-95"
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
