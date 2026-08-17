'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Bookmark, Check, AlertCircle } from 'lucide-react';
import { useSignInPanel } from '@/app/_components/auth/sign-in-here';
import { saveVendorToPicks, type SaveVendorResult } from '../actions';

type Props = {
  vendorProfileId: string;
  /**
   * Pre-resolved state from the server. If true, the button renders in
   * the "Saved" terminal state and is disabled. Server-rendered initial
   * state means returning visitors see the correct label on first paint.
   */
  initiallySaved: boolean;
  /*
    ⚠ `canSave` IS RETIRED (owner 2026-08-13 "show it"). It meant "the viewer
    can save right now", and it was FALSE for every signed-out visitor — so the
    one person most likely to want to keep a supplier was the one person who
    could not see the button. Every call site now passes true, and a prop that
    every caller answers the same way is not a choice, it is a lie about there
    being one. The gate that remains is `bookable`, at the call site, where a
    supplier still finishing verification genuinely cannot be saved by anyone.
  */
  /** Compact variant for cramped marketplace cards. */
  variant?: 'card' | 'profile';
};

type LocalState =
  | { kind: 'idle' }
  | { kind: 'saved' }
  /** Signed in, but no event yet — a next step, not a failure. */
  | { kind: 'needs_event' }
  | { kind: 'error'; message: string };

export function SaveVendorButton({
  vendorProfileId,
  initiallySaved,
  variant = 'card',
}: Props) {
  const [pending, startTransition] = useTransition();
  const { openSignIn, panel: signInPanel } = useSignInPanel();
  const [state, setState] = useState<LocalState>(
    initiallySaved ? { kind: 'saved' } : { kind: 'idle' },
  );

  /*
    A FUNCTION DECLARATION, NOT A useCallback — it has to name ITSELF (the
    retry-after-sign-in below), and a `const` arrow referencing its own
    initializer is a TypeScript circular-inference error before it is anything
    else. Declarations hoist, so this is the plain form of "try again".
  */
  function attemptSave() {
    const fd = new FormData();
    fd.set('vendor_profile_id', vendorProfileId);
    startTransition(async () => {
      const result: SaveVendorResult = await saveVendorToPicks(fd);
      if (result.status === 'ok' || result.status === 'already_saved') {
        setState({ kind: 'saved' });
        return;
      }
      if (result.status === 'not_signed_in') {
        /*
          🔑 THE WHOLE POINT OF SHOWING THIS BUTTON TO A STRANGER.
          The sign-in opens OVER the marketplace — the page, the scroll
          position and the supplier they were looking at all stay — and when
          they are in, `attemptSave` runs itself. One press means one save.
          Being sent to a login screen and having to find the supplier again is
          the version of this that loses the person.
        */
        openSignIn({ onSignedIn: attemptSave });
        return;
      }
      if (result.status === 'no_primary_event') {
        /*
          Signed in, but nothing to save INTO — the honest state for somebody
          who has just made an account. It is not an error and must not read
          like one: it is the next step, so it renders as a doorway rather than
          a sentence. (The action requires a primary event; that is its rule,
          not a UI choice.)
        */
        setState({ kind: 'needs_event' });
        return;
      }
      if (result.status === 'vendor_not_found') {
        setState({ kind: 'error', message: 'Vendor unavailable.' });
        return;
      }
      setState({ kind: 'error', message: result.message ?? 'Save failed.' });
    });
  }

  const isSaved = state.kind === 'saved';
  const isError = state.kind === 'error';

  const baseClasses =
    variant === 'card'
      ? 'inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors'
      : 'inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors';

  const stateClasses = isSaved
    ? 'border-success-300/60 bg-success-50 text-success-900'
    : isError
      ? 'border-danger-300/60 bg-danger-50 text-danger-900'
      : 'border-ink/15 bg-cream text-ink/80 hover:border-terracotta/50 hover:text-terracotta';

  /*
    SIGNED IN, BUT NOTHING TO SAVE INTO — a doorway, not an apology.
    This is where a brand-new account lands: they pressed Save, signed in, and
    the retry told us they have no event yet. Ending on the sentence "Create an
    event first" would leave the person who just did everything we asked with
    a dead end and no button. The supplier they picked is not lost — it is one
    press away on the other side of starting a plan.
  */
  if (state.kind === 'needs_event') {
    return (
      <>
        <Link
          href="/dashboard"
          className={`${baseClasses} border-terracotta/40 bg-cream text-terracotta hover:border-terracotta`}
          title="Start an event, then save suppliers to it"
        >
          <Bookmark
            aria-hidden
            className={variant === 'profile' ? 'h-4 w-4' : 'h-3.5 w-3.5'}
            strokeWidth={1.75}
          />
          Start an event to save
        </Link>
        {signInPanel}
      </>
    );
  }

  return (
    <>
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (isSaved || pending) return;
        attemptSave();
      }}
      className="inline-flex"
    >
      <button
        type="submit"
        disabled={isSaved || pending}
        title={
          isSaved
            ? 'Already saved to your event picks'
            : isError && state.kind === 'error'
              ? state.message
              : 'Save this vendor to your event picks'
        }
        className={`${baseClasses} ${stateClasses} disabled:cursor-default disabled:opacity-90`}
      >
        {isSaved ? (
          <>
            <Check
              aria-hidden
              className={variant === 'profile' ? 'h-4 w-4' : 'h-3.5 w-3.5'}
              strokeWidth={2}
            />
            Saved
          </>
        ) : isError ? (
          <>
            <AlertCircle
              aria-hidden
              className={variant === 'profile' ? 'h-4 w-4' : 'h-3.5 w-3.5'}
              strokeWidth={2}
            />
            Try again
          </>
        ) : (
          <>
            <Bookmark
              aria-hidden
              className={variant === 'profile' ? 'h-4 w-4' : 'h-3.5 w-3.5'}
              strokeWidth={1.75}
            />
            {pending ? 'Saving…' : 'Save'}
          </>
        )}
      </button>
    </form>
    {/*
      🚨 A SIBLING OF THE FORM, NOT A CHILD. `createPortal` moves the panel's
      DOM to <body>, but REACT events still bubble through the REACT tree — so
      the sign-in's own Continue press would bubble to this form's onSubmit and
      fire the save again mid-sign-in. The portal escapes the DOM; it does not
      escape the event tree.
    */}
    {signInPanel}
    </>
  );
}
