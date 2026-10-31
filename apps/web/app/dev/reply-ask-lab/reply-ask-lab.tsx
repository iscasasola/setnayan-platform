'use client';

import { useEffect } from 'react';
import { ReplyAskSheet } from '@/app/dashboard/[eventId]/guests/_components/reply-push-ask';

/** Draws the shipped sheet, open, over a plain page — the lab's only job. */
export function ReplyAskLab({ mode, dark }: { mode: 'ask' | 'ios-home-screen'; dark: boolean }) {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle('dark', dark);
    return () => html.classList.remove('dark');
  }, [dark]);
  return (
    <main className="min-h-[100dvh] bg-cream p-4 text-ink">
      <p className="text-sm text-ink/60">Guests · List (behind the sheet)</p>
      <ReplyAskSheet mode={mode} busy={false} onYes={() => {}} onClose={() => {}} />
    </main>
  );
}
