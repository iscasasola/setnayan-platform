'use client';

import { useState, useTransition } from 'react';
import { Plus, Check, AlertCircle } from 'lucide-react';
import {
  addVenueDirectoryEntryToPlan,
  type AddVenueToPlanResult,
} from '../actions';

type Props = {
  venueDirectoryId: string;
  /**
   * Pre-resolved state from the server. If true the button renders in the
   * terminal "Added" state and is disabled. Server-rendered initial state
   * means returning visitors see the correct label on first paint.
   */
  initiallyAdded: boolean;
  /**
   * Whether the viewer can add to a plan right now. False for anonymous
   * visitors and signed-in users without a primary event. Hides the
   * button entirely when false (UX: "you can't see this because there's
   * no plan to add it to").
   */
  canAdd: boolean;
};

type LocalState =
  | { kind: 'idle' }
  | { kind: 'added' }
  | { kind: 'error'; message: string };

export function AddVenueToPlanButton({
  venueDirectoryId,
  initiallyAdded,
  canAdd,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<LocalState>(
    initiallyAdded ? { kind: 'added' } : { kind: 'idle' },
  );

  if (!canAdd) return null;

  const isAdded = state.kind === 'added';
  const isError = state.kind === 'error';

  const stateClasses = isAdded
    ? 'border-emerald-300/60 bg-emerald-50 text-emerald-900'
    : isError
      ? 'border-rose-300/60 bg-rose-50 text-rose-900'
      : 'border-ink/15 bg-cream text-ink/80 hover:border-terracotta/50 hover:text-terracotta';

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (isAdded || pending) return;
        const fd = new FormData();
        fd.set('venue_directory_id', venueDirectoryId);
        startTransition(async () => {
          const result: AddVenueToPlanResult = await addVenueDirectoryEntryToPlan(fd);
          if (result.status === 'ok' || result.status === 'already_added') {
            setState({ kind: 'added' });
            return;
          }
          if (result.status === 'not_signed_in') {
            const next = encodeURIComponent(
              window.location.pathname + window.location.search,
            );
            window.location.href = `/login?next=${next}`;
            return;
          }
          if (result.status === 'no_primary_event') {
            setState({
              kind: 'error',
              message: 'Create an event first to add venues.',
            });
            return;
          }
          if (result.status === 'venue_not_found') {
            setState({ kind: 'error', message: 'Venue unavailable.' });
            return;
          }
          setState({ kind: 'error', message: result.message ?? 'Add failed.' });
        });
      }}
      className="inline-flex w-full"
    >
      <button
        type="submit"
        disabled={isAdded || pending}
        title={
          isAdded
            ? 'Added to your plan'
            : isError && state.kind === 'error'
              ? state.message
              : 'Add this venue to your plan'
        }
        className={`inline-flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-default disabled:opacity-90 ${stateClasses}`}
      >
        {isAdded ? (
          <>
            <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Added to plan
          </>
        ) : isError ? (
          <>
            <AlertCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Try again
          </>
        ) : (
          <>
            <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            {pending ? 'Adding…' : 'Add to plan'}
          </>
        )}
      </button>
    </form>
  );
}
