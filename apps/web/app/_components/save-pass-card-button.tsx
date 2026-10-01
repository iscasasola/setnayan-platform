'use client';

import { useRef, useState } from 'react';
import { Check, Download, Loader2 } from 'lucide-react';
import { handPassCards, savePassCards } from '@/lib/save-pass-cards';

/**
 * SavePassCardButton — "Save to Photos" for one pass card, or "Save all
 * passes" for several (owner 2026-09-29: *"when they save multiple QR Codes, it
 * is easy"*). Each file is the 1080 × 1440 card with the person's name on it
 * and in its filename (`/api/guest/pass-card`, lib/pass-card.ts).
 *
 * 🔑 A FAILURE MUST NOT RENDER LIKE SUCCESS: a refused or failed save says so
 * in words on the control's own line (the route's own message when it sent
 * one). A share iOS refused for a stale tap becomes "Tap to save" with the
 * files already in hand.
 *
 * Free for every guest, and for the couple one card at a time — there is no
 * Pro question anywhere in this component (only the couple's zip is Pro).
 */
type State = { k: 'idle' } | { k: 'working' } | { k: 'ready'; files: File[] } | { k: 'saved' } | { k: 'error'; message: string };

export function SavePassCardButton({
  hrefs,
  label,
  className,
  variant = 'button',
}: {
  /** One card, or several (their order is the order they save in). */
  hrefs: readonly string[];
  label: string;
  className?: string;
  /** `primary` — the one filled, full-width "Save my ticket" of the guest's landing page (Fable frames 3 · 5 · 6). */
  variant?: 'button' | 'link' | 'primary';
}) {
  const [state, setState] = useState<State>({ k: 'idle' });
  const busy = useRef(false);

  const done = (r: Awaited<ReturnType<typeof savePassCards>>) => {
    if (r.k === 'saved') {
      setState({ k: 'saved' });
      setTimeout(() => setState({ k: 'idle' }), 2000);
    } else if (r.k === 'needsTap') setState({ k: 'ready', files: r.files });
    else setState({ k: 'error', message: r.message });
  };

  const onClick = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      if (state.k === 'ready') {
        done(await handPassCards(state.files));
        return;
      }
      setState({ k: 'working' });
      done(await savePassCards(hrefs));
    } finally {
      busy.current = false;
    }
  };

  const text =
    state.k === 'working' ? 'Saving…' : state.k === 'ready' ? 'Tap to save' : state.k === 'saved' ? 'Saved' : label;
  const base =
    variant === 'primary'
      ? 'button-primary w-full justify-center gap-1.5'
      : variant === 'link'
      ? 'inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-ink underline underline-offset-4'
      : 'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-4 text-sm font-medium text-ink transition hover:border-terracotta hover:text-terracotta-700';
  return (
    <span className={variant === 'primary' ? 'flex w-full flex-col items-stretch' : 'inline-flex flex-col items-start'}>
      <button type="button" data-save-pass-card={hrefs.length} onClick={onClick} aria-busy={state.k === 'working' || undefined} className={`${base} ${className ?? ''}`}>
        {state.k === 'working' ? (
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
        ) : state.k === 'saved' ? (
          <Check aria-hidden className="h-4 w-4" strokeWidth={2.5} />
        ) : (
          <Download aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        )}
        <span>{text}</span>
      </button>
      {state.k === 'error' ? (
        <span role="alert" className="mt-1 text-xs text-ink/70">
          {state.message}
        </span>
      ) : null}
    </span>
  );
}
