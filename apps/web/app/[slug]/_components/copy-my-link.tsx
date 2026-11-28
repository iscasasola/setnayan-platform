'use client';

import { useEffect, useRef, useState } from 'react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { Check, Copy } from 'lucide-react';
import { OverlayBackdrop } from '@/app/_components/overlay-backdrop';

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

/* 📋 WHY "COPY MY LINK" DID NOTHING (owner walk 2026-11-27, MASTER-PLAN L3). Inside Messenger / Facebook / Instagram
   the clipboard API is often missing or refused — and on some versions its promise NEVER SETTLES, so the button sat at
   "Copy my link" with no answer either way: a dead tap. So the copy now (1) copies by selection first, synchronously,
   inside the tap — the way an in-app browser still allows; (2) only then asks the clipboard API, with a time limit
   (`COPY_WAIT_MS`); and (3) if both fail, says so and hands over the link in a field the guest can select. */

/** How long the clipboard API may take before the copy is called failed. */
export const COPY_WAIT_MS = 1500;

/** Copy by selecting a hidden, read-only field — synchronous, so it runs inside the tap itself. */
function copyBySelection(text: string): boolean {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false;
  const before = document.activeElement as HTMLElement | null;
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.setAttribute('aria-hidden', 'true');
  // Off screen but focusable; 16 px so iOS never zooms to it.
  field.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;font-size:16px;';
  document.body.appendChild(field);
  try {
    field.focus({ preventScroll: true });
    field.select();
    field.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
    before?.focus?.({ preventScroll: true });
  }
}

/** Copy `text`: true only when a copy is known to have happened; never hangs. */
export async function copyText(text: string): Promise<boolean> {
  if (copyBySelection(text)) return true;
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false;
    return await Promise.race([
      navigator.clipboard.writeText(text).then(
        () => true,
        () => false,
      ),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), COPY_WAIT_MS)),
    ]);
  } catch {
    return false;
  }
}

/** The link in a field the guest can select and copy by hand — the honest fallback when no copy worked. */
export function LinkToCopyByHand({ link }: { link: string }) {
  return (
    <input // field-ok: the guest Event Hub — a read-only link to select by hand, never a typed answer
      type="text"
      readOnly
      value={link}
      aria-label="Your link — press and hold to copy it"
      onFocus={(e) => e.currentTarget.select()}
      onClick={(e) => e.currentTarget.select()}
      data-link-by-hand=""
      className="input-field w-full text-center font-mono text-xs"
    />
  );
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
          // "Copied ✓" on the cards' own surface — the page ink always reads there; the gild is its ring.
          state === 'done' ? 'bg-paper-deep text-ink ring-1 ring-gild' : 'bg-ink text-cream hover:bg-ink/90'
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
        <div role="alert" className="space-y-2">
          <p className="text-xs text-ink/70">Couldn&rsquo;t copy it for you — press and hold the link to copy it:</p>
          <LinkToCopyByHand link={link} />
        </div>
      ) : null}
      {note ? <p className="mx-auto w-full text-xs text-ink/70">{note}</p> : null}
    </section>
  );
}

/**
 * 🔎 THE TRUE REASON (2026-10-25). This line said "Messenger can’t sign you in here" — false since the email sign-in
 * works inside a chat app's browser (the offer draws "Sign in with email" right under this button), and wrong by name
 * inside Instagram or Facebook. What is true: Apple and Google refuse a sign-in inside an in-app browser.
 */
export const OPEN_IN_BROWSER_WHY = 'Apple and Google need your browser';

/** Frame F — "Save to my account" inside an in-app browser. */
export function OpenInBrowser({ link }: { link: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<boolean | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  // The sheet is a real modal: focus moves in, Escape closes, the page stays put.
  useModalA11y({ open, onClose: () => setOpen(false), containerRef: sheetRef });

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
        <span className="text-xs font-normal opacity-80">{OPEN_IN_BROWSER_WHY}</span>
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <OverlayBackdrop onClose={() => setOpen(false)} />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="open-in-browser-title"
            tabIndex={-1}
            className="relative w-full max-w-md space-y-3 rounded-t-2xl bg-cream px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 text-left shadow-xl"
          >
            <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-ink/20" />
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/70">Save to my account</p>
            <h2 id="open-in-browser-title" className="font-serif text-2xl leading-tight text-ink">
              Open in your browser
            </h2>
            <p className="text-sm text-ink/75">
              {OPEN_IN_BROWSER_WHY}. Your link is copied — it takes ten seconds:
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
              <div role="alert" className="space-y-2 text-center">
                <p className="text-xs text-ink/70">Couldn&rsquo;t copy it for you — press and hold the link to copy it:</p>
                <LinkToCopyByHand link={link} />
              </div>
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
