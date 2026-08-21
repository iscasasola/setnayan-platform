'use client';

import { useState } from 'react';
import { CalendarPlus, Check, Copy, RotateCcw } from 'lucide-react';

/**
 * "Add to my calendar" — the one button, and the device picks which calendar
 * (owner 2026-08-21: *"it can be a general add to calendar and the device will
 * pick which calendar"*).
 *
 * 🔑 IT IS A `webcal:` LINK, WHICH IS WHAT MAKES THAT SENTENCE TRUE. A `https:`
 * .ics link DOWNLOADS a file the person then has to find and open; `webcal:` is
 * a registered scheme the operating system hands to whichever calendar it uses
 * — Apple Calendar on an iPhone, Google Calendar on Android, Outlook on a work
 * laptop. One button, no chooser we have to build and keep right.
 *
 * ⚠ AND IT IS A SUBSCRIPTION, WHICH IS THE WHOLE VALUE — so the copy says so.
 * A person who thinks they took a copy will not come back when a date moves.
 * A person who knows it follows will. The sentence under the button is doing
 * more work than the button.
 *
 * ⚠ THE COPY DOES NOT PROMISE "INSTANTLY". Google re-reads a subscribed
 * calendar on its own schedule — often hours — and no header we send changes
 * that. Saying "instantly" would be a claim the product cannot keep, on the one
 * screen where being wrong means somebody misses a date.
 */
export function CalendarSubscribe({
  webcalUrl,
  httpUrl,
  onReset,
}: {
  /** `webcal://…` — what the button opens. */
  webcalUrl: string;
  /** The same feed over https, for pasting into a desktop client by hand. */
  httpUrl: string;
  /** Server action that revokes this link and mints a new one. */
  onReset: () => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  return (
    <div className="rounded-2xl border border-ink/12 bg-white/[0.5] p-4">
      <a
        href={webcalUrl}
        className="inline-flex items-center gap-2 rounded-full bg-[color:var(--sn-mulberry-600)] px-4 py-2 text-[13px] font-semibold text-white transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sn-mulberry-600)]"
      >
        <CalendarPlus aria-hidden className="h-4 w-4" strokeWidth={1.9} />
        Add to my calendar
      </a>

      <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink/70">
        Your celebrations appear in whichever calendar your phone uses, and they{' '}
        <b className="font-semibold text-ink">keep themselves up to date</b> —
        change a date here and it changes there. Most calendars check for changes
        every few hours rather than straight away.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(httpUrl).then(
              () => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2500);
              },
              () => {
                /* A refused clipboard is not an error worth a red box — the
                   link is visible and selectable either way. */
              },
            );
          }}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink/60 underline-offset-4 hover:text-ink hover:underline"
        >
          {copied ? (
            <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          ) : (
            <Copy aria-hidden className="h-3.5 w-3.5" strokeWidth={1.9} />
          )}
          {copied ? 'Link copied' : 'Copy the link instead'}
        </button>

        {confirmingReset ? (
          <span className="inline-flex items-center gap-2 text-[12px] text-ink/70">
            {/* ⚠ THE WARNING IS THE POINT, NOT THE BUTTON. Resetting silently
                stops every calendar already subscribed — including the person's
                own — and nothing tells them why their celebrations stopped
                updating. So the consequence is stated BEFORE the press, not in
                a toast afterwards. */}
            This stops the old link everywhere, including on your own phone.
            <button
              type="button"
              disabled={resetting}
              onClick={() => {
                setResetting(true);
                void onReset().finally(() => setResetting(false));
              }}
              className="font-semibold text-[color:var(--sn-mulberry-600)] underline-offset-4 hover:underline disabled:opacity-50"
            >
              {resetting ? 'Resetting…' : 'Reset it'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingReset(false)}
              className="text-ink/50 underline-offset-4 hover:text-ink hover:underline"
            >
              Keep it
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingReset(true)}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink/45 underline-offset-4 hover:text-ink hover:underline"
          >
            <RotateCcw aria-hidden className="h-3.5 w-3.5" strokeWidth={1.9} />
            Reset my link
          </button>
        )}
      </div>

      <p className="mt-2 text-[11.5px] leading-relaxed text-ink/45">
        Anyone with this link can see the names and dates of these celebrations,
        so keep it to yourself. Reset it if you share it by accident.
      </p>
    </div>
  );
}
