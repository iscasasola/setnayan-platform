'use client';

import { useRef, useState } from 'react';
import { Check, Share, Loader2, LogIn } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { PASS_REENTRY_WORDS, handPassCards, passReentryHref, savePassCards, type PassCardSave } from '@/lib/save-pass-cards';

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
 * 🚪 A LAPSED SIGN-IN IS NOT AN ERROR LINE (owner 2026-10-25: *"A button we can offer when they try to save the
 * digital pass."*). When the save meets the route's 401 — no guest pass on this phone any more — the Save becomes
 * ONE button, "Get back in", to the page's own door (`PASS_REENTRY_WORDS` · `passReentryHref`, lib/save-pass-cards.ts),
 * with one short line and the rest in the ⓘ. Every surface that saves a ticket gets it, because they all use this.
 *
 * Free for every guest, and for the couple one card at a time — there is no
 * Pro question anywhere in this component (the couple's zip is free too since 2026-10-22).
 */
export type SavePassState =
  | { k: 'idle' }
  | { k: 'working' }
  | { k: 'ready'; files: File[] }
  | { k: 'saved' }
  | { k: 'error'; message: string }
  | { k: 'signedOut'; href: string };

/** What a save's answer turns the button into. Pure — held by `a-lapsed-guest-gets-back-in-from-the-save.test.ts`. */
export function nextSavePassState(r: PassCardSave, loc: { pathname: string }): SavePassState {
  if (r.k === 'saved') return { k: 'saved' };
  if (r.k === 'needsTap') return { k: 'ready', files: r.files };
  if (r.k === 'signedOut') return { k: 'signedOut', href: passReentryHref(loc) };
  return { k: 'error', message: r.message };
}

type Variant = 'button' | 'link' | 'primary';

/** The control as a state draws it — stateless, so a test can render every state. */
export function SavePassCardFace({
  state,
  label,
  count,
  variant = 'button',
  className,
  onClick,
}: {
  state: SavePassState;
  label: string;
  count: number;
  variant?: Variant;
  className?: string;
  onClick?: () => void;
}) {
  const wrap = variant === 'primary' ? 'flex w-full flex-col items-stretch' : 'inline-flex flex-col items-start';
  // A `const` of literal classes, written here on purpose: every-hub-press-is-44px.test.ts
  // reads `const` literals to size each press — a helper call would hide all three variants from it.
  const base =
    variant === 'primary'
      ? 'button-primary w-full justify-center gap-1.5'
      : variant === 'link'
      ? 'inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-ink underline underline-offset-4'
      : 'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-4 text-sm font-medium text-ink transition hover:border-terracotta hover:text-terracotta-700';
  if (state.k === 'signedOut') {
    return (
      <span
        className={variant === 'primary' ? wrap : 'inline-flex flex-col items-center'}
        data-guest-reentry-wrap=""
        role="status"
      >
        <a href={state.href} data-guest-reentry="" className={`${base} ${className ?? ''}`}>
          <LogIn aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          <span>{PASS_REENTRY_WORDS.button}</span>
        </a>
        <InfoTip
          label={PASS_REENTRY_WORDS.line}
          labelClassName="text-xs text-ink/70"
          className={`mt-1 ${variant === 'primary' ? 'justify-center' : ''}`}
        >
          {PASS_REENTRY_WORDS.why}
        </InfoTip>
      </span>
    );
  }
  const text =
    state.k === 'working' ? 'Saving…' : state.k === 'ready' ? 'Tap to save' : state.k === 'saved' ? 'Saved' : label;
  return (
    <span className={wrap}>
      <button type="button" data-save-pass-card={count} onClick={onClick} aria-busy={state.k === 'working' || undefined} className={`${base} ${className ?? ''}`}>
        {state.k === 'working' ? (
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
        ) : state.k === 'saved' ? (
          <Check aria-hidden className="h-4 w-4" strokeWidth={2.5} />
        ) : (
          <Share aria-hidden className="h-4 w-4" strokeWidth={1.75} />
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
  variant?: Variant;
}) {
  const [state, setState] = useState<SavePassState>({ k: 'idle' });
  const busy = useRef(false);

  const done = (r: PassCardSave) => {
    const next = nextSavePassState(r, window.location);
    setState(next);
    if (next.k === 'saved') setTimeout(() => setState({ k: 'idle' }), 2000);
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

  return <SavePassCardFace state={state} label={label} count={hrefs.length} variant={variant} className={className} onClick={onClick} />;
}
