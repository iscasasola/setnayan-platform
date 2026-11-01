'use client';

import { useState } from 'react';
import { Check, Share, Loader2 } from 'lucide-react';
import { saveImageToDevice } from '@/lib/save-to-device';

/**
 * "Save" INSIDE the full-screen viewer — the photo goes to the phone and the guest stays on the page.
 *
 * It replaces "Open full size to save", an `<a target="_blank">` to the photo's raw presigned URL: in the app shell
 * and the installed PWA that opened a bare picture with no Setnayan around it and no way back (owner 2026-10-24, the
 * same report as the gift QR). The viewer already shows the photo full size; this is the save that was missing.
 *
 * The same `saveImageToDevice` the tile's own Save uses (`save-photo-button.tsx`): the native share sheet ("Save to
 * Photos") where the phone has one, a download elsewhere. ⚠ IT NEVER PRETENDS: a failed save says so and tells the
 * guest the one thing that always works — press and hold the photo.
 */
export function LightboxSaveButton({ url, filename }: { url: string; filename: string }) {
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'failed'>('idle');
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={state === 'saving'}
        onClick={async () => {
          setState('saving');
          const r = await saveImageToDevice(url, filename);
          setState(r === 'failed' ? 'failed' : 'done');
          if (r !== 'failed') window.setTimeout(() => setState('idle'), 1500);
        }}
        className="sn-gal-btn inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60"
      >
        {state === 'saving' ? (
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
        ) : state === 'done' ? (
          <Check aria-hidden className="h-4 w-4" strokeWidth={2.5} />
        ) : (
          <Share aria-hidden className="h-4 w-4" strokeWidth={2} />
        )}
        {state === 'saving' ? 'Saving…' : state === 'done' ? 'Saved' : 'Save'}
      </button>
      {state === 'failed' ? (
        <span role="alert" className="sn-gal-soft text-xs">
          We couldn&rsquo;t save it from here — press and hold the photo to save it.
        </span>
      ) : null}
    </span>
  );
}
