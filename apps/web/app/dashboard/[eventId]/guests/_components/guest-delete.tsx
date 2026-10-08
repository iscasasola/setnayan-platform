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

import { createContext, useContext, useId, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { GuestPopup } from './guest-popup';
import { formatCount } from '@/lib/format-number';
import { bulkSoftDeleteGuestsForUndo, restoreDeletedGuests } from '../groups-actions';
import { buildUndo } from '@/lib/guest-optimistic';
import { guestOptimistic } from './guest-optimistic-store';
import { guestSelection } from './guest-selection-store';
import { guestToast, pushUndo } from './undo-toast';
import { couldntDelete, plainRefusal } from './plain-refusal';

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
 * The two writes a removal makes — the SHIPPED server actions by default. The dev lab (`/dev/guests-lab`) hands in
 * stand-ins that succeed locally, so a press there can be seen (and the Undo toast with it) without reaching the
 * database. Nothing in the app ever provides this; the default IS the real thing.
 */
export type GuestRemovalActions = {
  bulkSoftDeleteGuestsForUndo: typeof bulkSoftDeleteGuestsForUndo;
  restoreDeletedGuests: typeof restoreDeletedGuests;
};
const REAL_REMOVAL_ACTIONS: GuestRemovalActions = { bulkSoftDeleteGuestsForUndo, restoreDeletedGuests };
export const GuestRemovalActionsContext = createContext<GuestRemovalActions | null>(null);

/**
 * The delete, optimistic, with Undo. A REFUSAL IS SAID, never swallowed: the
 * rows come back AND the server's own sentence shows as an error toast, so a
 * host never watches a row reappear with no reason (the live-test defect).
 *
 * @param onRemoved runs only after the server confirms (the swipe resets its
 *   gesture, the card closes itself).
 */
export function useGuestRemoval(eventId: string) {
  const [removing, setRemoving] = useState(false);
  /* The shipped actions, unless the dev lab handed in stand-ins. Held under the SAME names, so every call below reads —
     and every guard that pins "the delete is called from exactly one place, the hook" still reads — as the real call. */
  const { bulkSoftDeleteGuestsForUndo, restoreDeletedGuests } = useContext(GuestRemovalActionsContext) ?? REAL_REMOVAL_ACTIONS;

  /** Resolves to the refusal's own words (shown where the host acted), or null. */
  async function remove(guestIds: string[], onRemoved?: () => void, who?: string): Promise<string | null> {
    if (removing) return null;
    const ids = [...guestIds];
    if (ids.length === 0) return null;
    const mutation = { kind: 'remove' as const, guestIds: ids };
    /* Who, in the host's words, for the one plain sentence a refusal is told in (never the action's own raw text). */
    const whom = who ?? (ids.length === 1 ? 'that guest' : `${formatCount(ids.length)} guests`);

    setRemoving(true);
    guestOptimistic.apply(mutation); // hide rows now
    /* 🔑 A PRESS ENDS ITS OWN PENDING STATE ON EVERY PATH (owner 2026-10-09, a refused delete read "Deleting…" with no
       word of why): the sheet goes back to "Delete" and the red toast says what was refused, within the press. */
    try {
      let result;
      try {
        result = await bulkSoftDeleteGuestsForUndo(eventId, ids);
      } catch {
        guestOptimistic.clear(mutation); // rollback the hide
        const said = 'Could not delete — check your connection and try again.';
        guestToast.error(said);
        return said;
      }

      if (!result.ok) {
        guestOptimistic.clear(mutation); // rollback — and SAY it, in plain words, where they acted
        const said = plainRefusal(result.error, couldntDelete(whom));
        guestToast.error(said);
        return said;
      }
      // Only now retract the selection bar: a refusal keeps it — and its warning,
      // with the reason — on screen, instead of vanishing with the rows' return.
      guestSelection.clear();
      onRemoved?.();

      // buildUndo carries the released seats through, so restore re-places them.
      const plan = buildUndo({ kind: 'remove', guestIds: result.removedIds }, [], result.releasedSeats);
      const n = result.removedIds.length;
      pushUndo({
        label: `${formatCount(n)} guest${n === 1 ? '' : 's'} deleted`,
        undo: async () => {
          if (plan.kind !== 'restore') return;
          // Their song requests come back with them (the warning said they go) —
          // read back from what the database kept at delete time, never sent from here.
          const r = await restoreDeletedGuests(eventId, plan.guestIds, plan.seats);
          if (r.ok) {
            guestOptimistic.clear(mutation); // un-hide the restored rows
            if (r.warning) guestToast.error(plainRefusal(r.warning, 'Brought back — but part of it did not come back with them.'));
          } else {
            guestToast.error('Could not undo — refresh and try again.');
          }
        },
      });
      return null;
    } finally {
      setRemoving(false);
    }
  }

  return { removing, remove };
}

/**
 * The one in-page warning — a pop-up, never `window.confirm()`. Delete · Cancel.
 *
 * Under the POP-UP RULE (`GuestPopup`): drawn on <body> — above the app's bottom bar, with the safe-area padding — dark
 * and blurred behind, a tap on the dark closes it, nothing behind works or scrolls. (It was the shared `Sheet`, which is
 * drawn inside the dashboard's transformed box and so sat UNDER the bottom bar, "Cancel" half hidden — controller,
 * 2026-10-09.) Mounted only while open, so the names it opened with are held until it closes.
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
  if (!open) return null;
  return <OpenDeleteGuestSheet names={names} busy={busy} error={error} onConfirm={onConfirm} onClose={onClose} />;
}

function OpenDeleteGuestSheet({
  names,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  names: readonly string[];
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  /* 🔑 THE HEADING KEEPS THE NAME IT OPENED WITH (owner 2026-10-09: it read "Delete ?" while it ran — the guest's row
     is already gone from the list by then, so the name was empty). This mounts when the sheet opens: held until it closes. */
  const [held] = useState<readonly string[]>(names);
  return (
    <GuestPopup
      onClose={onClose}
      rootClassName="fixed inset-0 z-[96] flex items-end justify-center lg:items-center"
      panelClassName="relative w-full max-w-md rounded-t-3xl bg-cream pb-[max(env(safe-area-inset-bottom),16px)] shadow-[0_-30px_80px_-40px_rgba(26,26,26,0.4)] lg:rounded-3xl"
      labelledById={titleId}
    >
      <DeleteGuestWarning titleId={titleId} names={held} busy={busy} error={error} onConfirm={onConfirm} onClose={onClose} />
    </GuestPopup>
  );
}

/** The warning's own words and its two buttons — what is inside the pop-up. */
export function DeleteGuestWarning({
  titleId,
  names,
  busy = false,
  error = null,
  onConfirm,
  onClose,
}: {
  titleId: string;
  names: readonly string[];
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const words = deleteWarningText(names);
  return (
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
      {/* A box, not a `contents` span: `space-y-4` puts its gap above a box, and a `contents` element has none — the
          sentence touched the Delete button (controller, 2026-10-09). */}
      <div data-guest-delete-confirm="">
        <ActionButton
          tone="danger"
          main
          icon={Trash2}
          label={busy ? 'Deleting…' : 'Delete'}
          onClick={onConfirm}
          disabled={busy}
          className="w-full"
        />
      </div>
      <ActionButton tone="neutral" icon={X} label="Cancel" onClick={onClose} className="w-full" />
    </div>
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
        const refused = await remove(
          [guestId],
          () => {
            onClose();
            onDeleted?.();
          },
          guestName,
        );
        if (refused) setError(refused);
      }}
    />
  );
}
