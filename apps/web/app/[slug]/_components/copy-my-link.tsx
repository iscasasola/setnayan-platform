'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';

/**
 * "COPY MY LINK" and "OPEN IN YOUR BROWSER" — the guest's OWN invitation link,
 * handed to them (owner 2026-09-29, DECISION_LOG "NO EMAIL TO GUESTS — THE QR AND
 * THE LINK DO EVERYTHING": *"No email. Either use the qr and link only"*).
 * Copy and layout from the approved prototype
 * `Setnayan/prototypes/guest_ticket_flow_2026-09-29.html` (frames A · A′ · B · C · F).
 *
 *   · `CopyMyLink`      — frames A / A′ / B / C: the link, printed, and one pill
 *                         "Copy my link" that reads "Copied ✓" for two seconds.
 *   · `OpenInBrowser`   — frame F: what "Save to my account" becomes inside
 *                         Messenger / Facebook / Instagram, where Apple and
 *                         Google refuse to sign anyone in and there is no email
 *                         link any more. One tap copies the link and a sheet says
 *                         exactly what to do next.
 *
 * 🔑 THE LINK IS PRINTED, NOT HIDDEN. A refused clipboard says so and leaves the
 * printed link to be pressed and copied by hand — a button that silently does
 * nothing reads as a broken page.
 */

async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** `https://www.setnayan.com/x?invite=…` → `setnayan.com/x?invite=…` — how the link is printed. */
export function shownLink(link: string): string {
  return link.replace(/^https?:\/\/(www\.)?/i, '');
}

export const COPY_MY_LINK_NOTE =
  'Paste it in Messenger to yourself, or in your notes — it’s just for you, and it’s your ticket at the door too.';

export function CopyMyLink({
  link,
  heading = 'Your link opens this invitation any time',
  note = COPY_MY_LINK_NOTE,
}: {
  link: string;
  /** Frame A's line above the link; null where the screen already says it (B, C). */
  heading?: string | null;
  /** The one line under the pill; null for none. */
  note?: string | null;
}) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');
  useEffect(() => {
    if (state !== 'done') return;
    const t = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <section className="space-y-2 text-center" data-copy-my-link="">
      {heading ? <p className="text-sm font-medium text-ink">{heading}</p> : null}
      <p className="mx-auto w-full select-all truncate font-mono text-xs text-ink/70">{shownLink(link)}</p>
      <button
        type="button"
        onClick={async () => setState((await copyText(link)) ? 'done' : 'failed')}
        className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition ${
          state === 'done' ? 'bg-gild text-ink' : 'bg-ink text-cream hover:bg-ink/90'
        }`}
      >
        {state === 'done' ? (
          <Check aria-hidden className="h-4 w-4" strokeWidth={2.25} />
        ) : (
          <Copy aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        )}
        {state === 'done' ? 'Copied ✓' : 'Copy my link'}
      </button>
      {state === 'done' ? (
        <p role="status" className="text-xs text-ink/70">
          Link copied — paste it anywhere you’ll find it again.
        </p>
      ) : state === 'failed' ? (
        <p role="alert" className="text-xs text-ink/70">
          Couldn&rsquo;t copy it for you — press and hold the link above to copy it.
        </p>
      ) : null}
      {note ? <p className="mx-auto w-full text-xs text-ink/60">{note}</p> : null}
    </section>
  );
}

/** Frame F — "Save to my account" inside an in-app browser. */
export function OpenInBrowser({ link }: { link: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<boolean | null>(null);

  async function start() {
    setOpen(true);
    setCopied(await copyText(link));
  }

  return (
    <div data-save-open-in-browser="">
      <button
        type="button"
        onClick={start}
        className="button-primary flex min-h-[56px] w-full flex-col items-center justify-center gap-0.5"
      >
        <span className="text-base">Open in your browser</span>
        <span className="text-xs font-normal opacity-80">Save to my account · Messenger can’t sign you in here</span>
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby="open-in-browser-title">
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/40" />
          <div className="relative w-full max-w-md space-y-3 rounded-t-2xl bg-cream px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 text-left shadow-xl">
            <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-ink/20" />
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/60">Save to my account</p>
            <h2 id="open-in-browser-title" className="font-serif text-2xl leading-tight text-ink">
              Open in your browser
            </h2>
            <p className="text-sm text-ink/75">
              Messenger can’t sign you in here. Your link is copied — it takes ten seconds:
            </p>
            <ol className="space-y-2 text-sm text-ink/80">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-cream">1</span>
                <span>
                  Open <b>Safari</b> or <b>Chrome</b> and paste your link
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-cream">2</span>
                <span>
                  Tap <b>Continue with Apple</b> or <b>Continue with Google</b> — nothing to type
                </span>
              </li>
            </ol>
            <button
              type="button"
              onClick={async () => setCopied(await copyText(link))}
              className="button-primary flex min-h-[56px] w-full flex-col items-center justify-center gap-0.5"
            >
              <span className="text-base">Copy my link</span>
              <span className="w-full truncate text-xs font-normal opacity-80">{shownLink(link)}</span>
            </button>
            {copied === true ? (
              <p role="status" className="flex items-center justify-center gap-1.5 text-sm text-ink/80">
                <Check aria-hidden className="h-4 w-4 text-gild" strokeWidth={2.25} />
                Copied ✓ — now paste it in Safari or Chrome
              </p>
            ) : copied === false ? (
              <p role="alert" className="text-center text-xs text-ink/70">
                Couldn&rsquo;t copy it for you — press and hold the link to copy it:{' '}
                <span className="select-all break-all font-mono text-ink">{shownLink(link)}</span>
              </p>
            ) : null}
            <p className="text-center">
              <button type="button" onClick={() => setOpen(false)} className="inline-flex min-h-[44px] items-center text-sm text-ink/70 underline-offset-4 hover:underline">
                Not now
              </button>
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
