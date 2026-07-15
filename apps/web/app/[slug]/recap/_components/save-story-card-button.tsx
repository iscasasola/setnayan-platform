'use client';

import { useState } from 'react';
import { Share2, Loader2, Check } from 'lucide-react';
import { saveImageToDevice } from '@/lib/save-to-device';

/**
 * SaveStoryCardButton — the recap's file-asset share path (owner 2026-07-16,
 * Social_Share_Settings_Council_Verdict sign-off #3).
 *
 * WHY: Instagram feed, IG/FB Stories and TikTok don't accept web-URL shares —
 * they need an actual FILE pushed through the native share sheet. The recap's
 * FB / Pinterest / copy-link buttons only hand out the URL. This button fetches
 * the Setnayan-rendered 1080×1920 story card (/api/og/recap/[slug]?format=story
 * — public, published-gated, "made with Setnayan" mark) and hands it to
 * `saveImageToDevice`: on mobile that opens the native share sheet (Instagram /
 * TikTok / Stories); on desktop it downloads the JPEG. It sits ALONGSIDE the
 * URL-share buttons — native-share/copy still lead — adding the file path.
 */
export function SaveStoryCardButton({
  storyCardUrl,
  filenameBase,
}: {
  /** Absolute URL of the 1080×1920 story card (…/api/og/recap/[slug]?format=story). */
  storyCardUrl: string;
  /** Filename stem (no extension), e.g. "maria-juan-recap". */
  filenameBase: string;
}) {
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle');

  return (
    <button
      type="button"
      aria-label="Save a story card for Instagram or TikTok"
      aria-live="polite"
      onClick={async () => {
        if (state === 'saving') return;
        setState('saving');
        const r = await saveImageToDevice(storyCardUrl, `${filenameBase}.jpg`);
        setState(r === 'failed' ? 'idle' : 'done');
        if (r !== 'failed') setTimeout(() => setState('idle'), 2000);
      }}
      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-gold/50 bg-mulberry px-3.5 text-xs font-medium text-cream shadow-sm transition-colors hover:border-gold hover:bg-mulberry/90"
    >
      {state === 'saving' ? (
        <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
      ) : state === 'done' ? (
        <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
      ) : (
        <Share2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
      )}
      {state === 'done' ? 'Saved' : 'Save story card'}
    </button>
  );
}
