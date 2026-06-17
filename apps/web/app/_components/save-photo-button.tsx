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
      className="absolute left-1 top-1 rounded-full bg-black/55 p-1 text-cream transition active:scale-95"
    >
      {state === 'saving' ? (
        <Loader2 aria-hidden className="h-3 w-3 animate-spin" strokeWidth={2} />
      ) : state === 'done' ? (
        <Check aria-hidden className="h-3 w-3" strokeWidth={2.5} />
      ) : (
        <Download aria-hidden className="h-3 w-3" strokeWidth={2} />
      )}
      <span className="sr-only">Save to phone</span>
    </button>
  );
}
