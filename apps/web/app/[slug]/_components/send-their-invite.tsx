'use client';

import { useState } from 'react';

/**
 * "SEND THEIR INVITE" — the bringer hands a plus-one their OWN key (owner
 * 2026-09-26: *"how can we make it easy for the person with a plus 1/2/3/4
 * help their plus to have an access as well?"* → one button per plus-one).
 *
 * The phone's own share sheet (Messenger · Viber · text), pre-filled with THAT
 * person's personal link. We never send an SMS (none in V1 — the share sheet
 * is the guest's own phone doing the sending). Where the browser has no share
 * sheet (most desktops, some webviews) the link is copied instead, and the
 * button says so.
 */
export function SendTheirInvite({
  name,
  url,
  eventName,
  label = 'Send their invite',
}: {
  name: string;
  url: string;
  eventName: string;
  label?: string;
}) {
  const [said, setSaid] = useState<string | null>(null);
  const first = name.split(/\s+/)[0] || name;
  async function send() {
    const text = `${first}, here is your invitation to ${eventName} — it opens your own pass.`;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: eventName, text, url });
        return;
      }
    } catch (err) {
      // The person closed the sheet — that is not a failure to report.
      if ((err as { name?: string })?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setSaid('Link copied — paste it to them');
    } catch {
      setSaid(url);
    }
  }
  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={send}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-ink px-4 text-sm font-medium text-cream"
      >
        <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 10V2M5 5l3-3 3 3M3 9v4h10V9" />
        </svg>
        {label}
      </button>
      {said ? (
        <span role="status" className="max-w-[16rem] break-all text-right text-xs text-ink/70">
          {said}
        </span>
      ) : null}
    </span>
  );
}
