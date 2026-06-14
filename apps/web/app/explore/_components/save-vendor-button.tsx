'use client';

import { useState, useTransition } from 'react';
import { Bookmark, Check, AlertCircle } from 'lucide-react';
import { saveVendorToPicks, type SaveVendorResult } from '../actions';

type Props = {
  vendorProfileId: string;
  /**
   * Pre-resolved state from the server. If true, the button renders in
   * the "Saved" terminal state and is disabled. Server-rendered initial
   * state means returning visitors see the correct label on first paint.
   */
  initiallySaved: boolean;
  /**
   * Whether the viewer can save right now. False for anonymous visitors
   * AND for vendors viewing their own profile (self-save is nonsensical).
   * The button hides entirely when this is false rather than showing a
   * disabled state — the UX is "you can't see Save because there's
   * nothing to save into" rather than "Save is blocked."
   */
  canSave: boolean;
  /** Compact variant for cramped marketplace cards. */
  variant?: 'card' | 'profile';
};

type LocalState =
  | { kind: 'idle' }
  | { kind: 'saved' }
  | { kind: 'error'; message: string };

export function SaveVendorButton({
  vendorProfileId,
  initiallySaved,
  canSave,
  variant = 'card',
}: Props) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<LocalState>(
    initiallySaved ? { kind: 'saved' } : { kind: 'idle' },
  );

  if (!canSave) return null;

  const isSaved = state.kind === 'saved';
  const isError = state.kind === 'error';

  const baseClasses =
    variant === 'card'
      ? 'inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors'
      : 'inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors';

  const stateClasses = isSaved
    ? 'border-emerald-300/60 bg-emerald-50 text-emerald-900'
    : isError
      ? 'border-rose-300/60 bg-rose-50 text-rose-900'
      : 'border-ink/15 bg-cream text-ink/80 hover:border-terracotta/50 hover:text-terracotta';

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (isSaved || pending) return;
        const fd = new FormData();
        fd.set('vendor_profile_id', vendorProfileId);
        startTransition(async () => {
          const result: SaveVendorResult = await saveVendorToPicks(fd);
          if (result.status === 'ok' || result.status === 'already_saved') {
            setState({ kind: 'saved' });
            return;
          }
          if (result.status === 'not_signed_in') {
            // Bounce the visitor through login; after login they land back
            // on this URL and can save again.
            const next = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `/login?next=${next}`;
            return;
          }
          if (result.status === 'no_primary_event') {
            setState({
              kind: 'error',
              message: 'Create an event first to save vendors.',
            });
            return;
          }
          if (result.status === 'vendor_not_found') {
            setState({ kind: 'error', message: 'Vendor unavailable.' });
            return;
          }
          setState({ kind: 'error', message: result.message ?? 'Save failed.' });
        });
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
  );
}
