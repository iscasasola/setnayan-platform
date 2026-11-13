'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Bookmark, Check, AlertCircle, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { pickArrowClass, pickButtonClass } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-place';
import { favoriteDay } from '@/lib/favorites';
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
  /**
   * 🗂 "SAVE TO WHICH EVENT?" (owner 2026-11-06, prototype favorites-proto §A "After · several events"). With TWO OR
   * MORE of the viewer's own events still ahead, Save asks which — the shop page's picker rows
   * (`resolveAddShopToEvent`, "only events you organise that haven't happened yet"), as a dropdown — and saves to the
   * one picked (`saveVendorToPicks` with its `event_id`, which checks it is theirs). One event or none: unchanged.
   */
  events?: ReadonlyArray<{ eventId: string; title: string; kindWord: string; dateISO: string | null }>;
  /**
   * The idle label. Default "Save" (Discover). The shop page says "Add to your event" (owner 2026-11-13, DECISION_LOG
   * "THE SHOP PAGE HAS ONE MAIN BUTTON — INQUIRE": Add = put the shop on the couple's event list, no message) — the
   * same action, `saveVendorToPicks`, so there is still one way to add a supplier.
   */
  label?: string;
  /** Replaces the variant's look (the shop page's ghost pill); state colours still apply. */
  className?: string;
};

/** The one row that starts a new event instead of saving. */
const START_NEW = '__start_new_event';

type LocalState =
  | { kind: 'idle' }
  | { kind: 'saved'; eventName?: string | null }
  /** Signed in, but no event yet — a next step, not a failure. */
  | { kind: 'needs_event' }
  | { kind: 'error'; message: string };

export function SaveVendorButton({
  vendorProfileId,
  initiallySaved,
  variant = 'card',
  events = [],
  label = 'Save',
  className,
}: Props) {
  const router = useRouter();
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
  function attemptSave(eventId?: string) {
    const fd = new FormData();
    fd.set('vendor_profile_id', vendorProfileId);
    if (eventId) fd.set('event_id', eventId);
    startTransition(async () => {
      const result: SaveVendorResult = await saveVendorToPicks(fd);
      if (result.status === 'ok' || result.status === 'already_saved') {
        setState({ kind: 'saved', eventName: result.eventName });
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
        openSignIn({ onSignedIn: () => attemptSave(eventId) });
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
        setState({ kind: 'error', message: 'Supplier unavailable.' });
        return;
      }
      // `/explore` never sends an event_id, so this branch is unreachable from
      // here today — handled anyway rather than falling into the catch-all,
      // because the next caller that DOES send one would otherwise be told
      // "Save failed" for a cause the action named precisely.
      if (result.status === 'not_your_event') {
        setState({ kind: 'error', message: 'That is not one of your events.' });
        return;
      }
      setState({ kind: 'error', message: result.message ?? 'Save failed.' });
    });
  }

  const isSaved = state.kind === 'saved';
  const savedEventName = state.kind === 'saved' ? (state.eventName ?? null) : null;
  const isError = state.kind === 'error';

  const baseClasses = className
    ? className
    : variant === 'card'
      ? 'inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors'
      : 'inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors';

  const stateClasses = isSaved
    ? 'border-success-300/60 bg-success-50 text-success-900'
    : isError
      ? 'border-danger-300/60 bg-danger-50 text-danger-900'
      : className
        ? ''
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

  // 🗂 Two or more events ahead → "Save to…" asks which (prototype §A). Saved / error fall through to the shipped button.
  if (events.length >= 2 && state.kind === 'idle') {
    return (
      <>
        <PickMenu
          label={`Save this supplier to…`}
          value={null}
          compact={variant === 'card'}
          dataAttr="data-save-to-event"
          className={pickButtonClass(variant === 'card')}
          trigger={
            <>
              <Bookmark aria-hidden className={variant === 'profile' ? 'h-4 w-4' : 'h-3.5 w-3.5'} strokeWidth={1.75} />
              <span className="truncate">{pending ? 'Saving…' : label === 'Save' ? 'Save to…' : `${label}…`}</span>
              <ChevronDown aria-hidden className={pickArrowClass(false)} strokeWidth={2} />
            </>
          }
          head={
            <li role="none" className="px-3 pb-1 pt-2 text-[12px] text-ink/60">
              Only events you organise that haven&rsquo;t happened yet.
            </li>
          }
          options={[
            ...events.map((e) => ({
              key: e.eventId,
              label: e.title,
              hint: [e.kindWord, favoriteDay(e.dateISO) ?? 'date TBD'].join(' · '),
            })),
            { key: START_NEW, label: '＋ Start a new event' },
          ]}
          onPick={(key) => {
            if (key === START_NEW) {
              router.push('/dashboard');
              return;
            }
            attemptSave(key);
          }}
        />
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
              : 'Save this supplier to your event picks'
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
            {/* Names the EVENT it saved into. Save is event-scoped and this
                screen is not — the action resolves the couple's PRIMARY host
                event and writes there (owner 2026-09-08: *"Save adds to a
                specific event? this is a search result outside an event"*). A
                couple planning a wedding AND a debut otherwise had no way to
                learn which one just gained a supplier.

                Falls back to the bare word when the name could not be read:
                the save still happened, and claiming an event we cannot name
                would be worse than not naming one. */}
            {savedEventName ? `Saved to ${savedEventName}` : 'Saved'}
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
            {pending ? 'Saving…' : label}
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
