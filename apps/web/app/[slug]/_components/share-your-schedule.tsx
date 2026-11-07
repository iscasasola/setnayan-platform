'use client';

import { useState } from 'react';

/**
 * 📤 PRINT OR SHARE (plan §11b) — the guest's own schedule, handed to the phone's share sheet as text (Messages, Notes,
 * a printer app). Where a browser has no share sheet, the page prints instead. Never a request: the words are already
 * on the card.
 */
export function ShareYourSchedule({ text, label }: { text: string; label: string }) {
  const [said, setSaid] = useState<string | null>(null);
  async function share() {
    setSaid(null);
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ text });
        return;
      }
    } catch (err) {
      // The guest closed the sheet — not a failure to report.
      if ((err as { name?: string })?.name === 'AbortError') return;
    }
    try {
      window.print();
    } catch {
      setSaid('This browser cannot share or print here.');
    }
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={share}
        data-your-schedule-share
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 text-[15px] text-ink ring-1 ring-inset ring-ink/20 hover:bg-ink/[0.04]"
      >
        <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 10V2M5 5l3-3 3 3M3 9v4h10V9" />
        </svg>
        {label}
      </button>
      {said ? (
        <span role="status" className="text-xs text-ink/70">
          {said}
        </span>
      ) : null}
    </div>
  );
}
