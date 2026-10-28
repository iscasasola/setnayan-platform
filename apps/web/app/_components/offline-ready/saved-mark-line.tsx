'use client';

import { CircleCheck, CircleDot, CloudOff, Loader2 } from 'lucide-react';

import type { SavedMark } from '@/lib/offline-copies';

/**
 * 📶 THE SAVED MARK — one line that says where this phone's copy stands (EV3; words from `savedMark` in
 * `lib/offline-copies.ts`, prototype claude.ai/artifact/KeAoiB3WoQRH1fqG9hoKzw): "✓ Saved for offline · updated
 * 2:10 PM", amber "● Saved 9 hours ago · update before you leave for the venue", "No signal · showing the copy from…".
 * `data-offline-mark` carries the tone so a walk and a guard can read it without parsing words.
 */
const TONE: Record<SavedMark['tone'], { light: string; dark: string }> = {
  ok: { light: 'text-success-700', dark: 'text-success-300' },
  amber: { light: 'text-warn-800', dark: 'text-warn-300' },
  muted: { light: 'text-ink/60', dark: 'text-[rgba(251,251,250,0.66)]' },
  bad: { light: 'text-danger-700', dark: 'text-danger-300' },
};

export function SavedMarkLine({ mark, busy = false, onDark = false }: { mark: SavedMark; busy?: boolean; onDark?: boolean }) {
  const Icon = busy ? Loader2 : mark.tone === 'ok' ? CircleCheck : mark.tone === 'bad' ? CloudOff : CircleDot;
  return (
    <p
      role="status"
      aria-live="polite"
      data-offline-mark={mark.tone}
      className={`flex items-start gap-1.5 text-[13px] font-semibold leading-snug ${onDark ? TONE[mark.tone].dark : TONE[mark.tone].light}`}
    >
      <Icon aria-hidden className={`mt-[1px] h-4 w-4 shrink-0 ${busy ? 'animate-spin' : ''}`} strokeWidth={2} />
      <span className="min-w-0">{mark.text}</span>
    </p>
  );
}
