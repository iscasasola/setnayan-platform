'use client';

/**
 * guest-delete.tsx — THE ONE WAY A HOST DELETES A GUEST, from three places.
 *
 * ⚖ Owner 2026-10-03 (DECISION_LOG "A HOST CAN DELETE A GUEST WHO ALREADY
 * ACCEPTED"), after his live test where an attending guest's delete was refused
 * and the row silently came back: *"add a way to delete someone even if they
 * accepted just note that deleting them will automatically remove their
 * decisions and everything with it. add delete function on the guest card and
 * when we select guests"*.
 *
 *   · the guest card's ⋯ (`GuestMoreMenu`, `deletable`)
 *   · a phone row's swipe (`SwipeToDelete`)
 *   · the selection bar ("Delete N guests", one warning for all of them)
 *
 * All three show the SAME in-page warning (`DeleteGuestSheet` — never a browser
 * `confirm()`) and go through the SAME hook (`useGuestRemoval`) to the SAME
 * action (`bulkSoftDeleteGuestsForUndo`): hidden at once, an Undo in the
 * snackbar, and a refusal said out loud where the host acted. The old
 * "Reset their RSVP to No reply first" rule is retired, and so is the card's
 * second remove path (`softDeleteGuest` + `RemoveGuestConfirm`), which kept the
 * rule and had no Undo.
 *
 * The account link a deleted guest held is ended by the database (branch
 * `rd/deleted-guest-unlinks`), not by this file — one mechanism, not two.
 */

import { useId, useState } from 'react';
import { Sheet } from '@/app/_components/sheet';
import { useToast } from '@/app/_components/toast/toast-provider';
import { formatCount } from '@/lib/format-number';
import { bulkSoftDeleteGuestsForUndo, restoreDeletedGuests } from '../groups-actions';
import { buildUndo } from '@/lib/guest-optimistic';
import { guestOptimistic } from './guest-optimistic-store';
import { guestSelection } from './guest-selection-store';
import { pushUndo } from './undo-toast';

/** What the warning says goes with them — the owner's list, in his order. */
export function deleteWarningText(names: readonly string[]): { title: string; body: string } {
  if (names.length === 1) {
    return {
      title: `Delete ${names[0]}?`,
      body: 'Their reply and answers, seat, +1, song request and the link to their account go with them.',
    };
  }
  return {
    title: `Delete ${formatCount(names.length)} guests?`,
    body: 'Their replies and answers, seats, +1s, song requests and the links to their accounts go with them.',
  };
}

/**
 * The delete, optimistic, with Undo. A REFUSAL IS SAID, never swallowed: the
 * rows come back AND the server's own sentence shows as an error toast, so a
 * host never watches a row reappear with no reason (the live-test defect).
 *
 * @param onRemoved runs only after the server confirms (the swipe resets its
 *   gesture, the card closes itself).
 */
export function useGuestRemoval(eventId: string) {
  const toast = useToast();
  const [removing, setRemoving] = useState(false);

  /** Resolves to the refusal's own words (shown where the host acted), or null. */
  async function remove(guestIds: string[], onRemoved?: () => void): Promise<string | null> {
    if (removing) return null;
    const ids = [...guestIds];
    if (ids.length === 0) return null;
    const mutation = { kind: 'remove' as const, guestIds: ids };

    setRemoving(true);
    guestOptimistic.apply(mutation); // hide rows now

    let result;
    try {
      result = await bulkSoftDeleteGuestsForUndo(eventId, ids);
    } catch {
      guestOptimistic.clear(mutation); // rollback the hide
      setRemoving(false);
      const said = 'Could not delete — check your connection and try again.';
      toast.error(said);
      return said;
    }
    setRemoving(false);

    if (!result.ok) {
      guestOptimistic.clear(mutation); // rollback — and SAY why, where they acted
      toast.error(result.error);
      return result.error;
    }
    // Only now retract the selection bar: a refusal keeps it — and its warning,
    // with the reason — on screen, instead of vanishing with the rows' return.
    guestSelection.clear();
    onRemoved?.();

    // buildUndo carries the released seats through, so restore re-places them.
    const plan = buildUndo({ kind: 'remove', guestIds: result.removedIds }, [], result.releasedSeats);
    const n = result.removedIds.length;
    const releasedSongs = result.releasedSongs;
    pushUndo({
      label: `${formatCount(n)} guest${n === 1 ? '' : 's'} deleted`,
      undo: async () => {
        if (plan.kind !== 'restore') return;
        // Their song requests come back with them (the warning said they go).
        const r = await restoreDeletedGuests(eventId, plan.guestIds, plan.seats, releasedSongs);
        if (r.ok) {
          guestOptimistic.clear(mutation); // un-hide the restored rows
        } else {
          toast.error('Could not undo — refresh and try again.');
        }
      },
    });
    return null;
  }

  return { removing, remove };
}

/**
 * The one in-page warning — a sheet, never `window.confirm()`. Delete · Cancel.
 */
export function DeleteGuestSheet({
  open,
  names,
  busy = false,
  error = null,
  onConfirm,
  onClose,
}: {
  open: boolean;
  /** A refusal, in the server's own words — said here, where they pressed Delete. */
  error?: string | null;
  /** Who goes — one name, or every selected guest (one warning for all). */
  names: readonly string[];
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const words = deleteWarningText(names);
  return (
    <Sheet open={open} onClose={onClose} labelledById={titleId} rise>
      <div className="space-y-4 p-5" data-guest-delete-warning="">
        <h2 id={titleId} className="font-display text-xl text-ink">
          {words.title}
        </h2>
        <p className="text-sm leading-relaxed text-ink/70">{words.body}</p>
        {error ? (
          <p role="alert" className="text-sm text-danger-700" data-guest-delete-refused="">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          data-guest-delete-confirm=""
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-danger-600 px-5 text-sm font-semibold text-cream hover:bg-danger-700 disabled:opacity-60"
        >
          {busy ? 'Deleting…' : 'Delete'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full border border-ink/15 bg-cream px-5 text-sm font-medium text-ink"
        >
          Cancel
        </button>
      </div>
    </Sheet>
  );
}

/**
 * A small "Delete" beside a name — the +1 note's "3 named · 1 allowed" (frame
 * G). The flow (hook + warning) mounts on the tap, so a list of names drawn on
 * the server, or in a test, never needs the toast host to exist.
 */
export function DeleteGuestButton({
  eventId,
  guestId,
  guestName,
}: {
  eventId: string;
  guestId: string;
  guestName: string;
}) {
  const [asking, setAsking] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAsking(true)}
        aria-label={`Delete ${guestName}`}
        data-guest-delete=""
        className="inline-flex min-h-[44px] items-center px-2 text-xs font-medium text-danger-700 underline underline-offset-2 hover:text-danger-800"
      >
        Delete
      </button>
      {asking ? (
        <DeleteGuestFlow eventId={eventId} guestId={guestId} guestName={guestName} onClose={() => setAsking(false)} />
      ) : null}
    </>
  );
}

/**
 * One guest's warning + delete, mounted only once a host asks — so a list of
 * rows (each with a ⋯) carries no delete machinery until someone taps Delete.
 */
export function DeleteGuestFlow({
  eventId,
  guestId,
  guestName,
  onClose,
  onDeleted,
}: {
  eventId: string;
  guestId: string;
  guestName: string;
  onClose: () => void;
  /** After the server confirms (the card closes itself here). */
  onDeleted?: () => void;
}) {
  const { removing, remove } = useGuestRemoval(eventId);
  const [error, setError] = useState<string | null>(null);
  return (
    <DeleteGuestSheet
      open
      names={[guestName]}
      busy={removing}
      error={error}
      onClose={onClose}
      onConfirm={async () => {
        const refused = await remove([guestId], () => {
          onClose();
          onDeleted?.();
        });
        if (refused) setError(refused);
      }}
    />
  );
}
