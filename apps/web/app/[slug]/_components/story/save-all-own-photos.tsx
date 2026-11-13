'use client';

import { useState } from 'react';
import { Check, Download, Loader2 } from 'lucide-react';
import { saveImagesToDevice } from '@/lib/save-to-device';

/**
 * 📸 SAVE ALL — on a guest's OWN "Were you there?" screen (owner 2026-11-13, DECISION_LOG "POST EVENT = A STORY (ONE
 * SCENE PER SCREEN) — SIX CALLS SETTLED" (4)). Their own photos only — the urls the server already resolved from their
 * signed Papic session (`loadYourOwnDay`); nothing here can name anyone else's. It reuses the viewer's own full-size
 * Save (`saveImageToDevice` → `saveImagesToDevice`): one share sheet on a phone, downloads on a computer. No email.
 * ⚠ IT NEVER PRETENDS: a failed save says so, and a partial one says how many were missed.
 */
export function SaveAllOwnPhotos({ urls, baseName }: { urls: readonly string[]; baseName: string }) {
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'failed'>('idle');
  const [missed, setMissed] = useState(0);
  if (urls.length === 0) return null;
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        data-save-all-own=""
        disabled={state === 'saving'}
        onClick={async () => {
          setState('saving');
          const r = await saveImagesToDevice(urls, baseName);
          setMissed(r.missed);
          setState(r.result === 'failed' ? 'failed' : 'done');
        }}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-ink/25 bg-white px-5 text-[14px] font-semibold text-ink disabled:opacity-60"
      >
        {state === 'saving' ? (
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
        ) : state === 'done' ? (
          <Check aria-hidden className="h-4 w-4" strokeWidth={2.5} />
        ) : (
          <Download aria-hidden className="h-4 w-4" strokeWidth={2} />
        )}
        {state === 'saving' ? 'Saving…' : state === 'done' ? 'Saved' : 'Save all'}
      </button>
      {state === 'failed' ? (
        <span role="alert" className="text-xs text-ink/70">
          We couldn&rsquo;t save them from here — open a photo and press and hold it to save.
        </span>
      ) : state === 'done' && missed > 0 ? (
        <span role="status" className="text-xs text-ink/70">
          {missed === 1 ? `${missed} photo could not be saved — open it and press and hold it.` : `${missed} photos could not be saved — open each and press and hold it.`}
        </span>
      ) : null}
    </span>
  );
}
