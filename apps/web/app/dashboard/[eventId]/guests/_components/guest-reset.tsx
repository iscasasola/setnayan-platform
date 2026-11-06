'use client';

/**
 * guest-reset.tsx — 🔄 RESET, beside Delete at the bottom of the guest card (owner 2026-10-26, verbatim: *"So at the
 * bottom, have (RESET) (DELETE)"*). Their invitation, as if it was never used: what the reply wrote is cleared, the
 * link, QR, seat and the host's info stay (the list, and why, is `lib/guest-fresh-reset.ts`).
 *
 * The shipped Delete's shape, on purpose: the same in-page warning (`GuestPopup kind="confirm"`, the safe answer first),
 * then the same toast with Undo (`pushUndo`). The write is the one host reply write, `setGuestRsvp(…, 'pending',
 * { fresh: true })`, and its Undo `restoreGuestRsvpAndSeat(…, fresh)` — both through `useGuestActions`, so the dev lab's
 * stand-ins answer there and nothing reaches the database from a lab press. A refusal is said in plain words.
 */

import { useId, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { GuestConfirmActions, GuestPopup } from './guest-popup';
import { useGuestActions } from './guest-actions-context';
import { guestToast, pushUndo } from './undo-store';
import { plainRefusal } from './plain-refusal';
import { hearAction } from './hear-action';

/** The warning's words — what goes, what stays, and that it can be undone. */
export function resetWarningText(name: string): { title: string; body: string } {
  return {
    title: `Reset ${name}’s invitation?`,
    body: 'Their reply goes back to No reply, and what they typed in it is cleared — meal, dietary, their note, what to call them, the names they gave their +1s and songs still waiting. Their link, QR, seat and the details you entered stay. You can undo it right after.',
  };
}

export function GuestResetFlow({
  eventId,
  guestId,
  guestName,
  onClose,
}: {
  eventId: string;
  guestId: string;
  guestName: string;
  onClose: () => void;
}) {
  const { setGuestRsvp, restoreGuestRsvpAndSeat } = useGuestActions();
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [held] = useState(guestName);
  const words = resetWarningText(held);
  const couldnt = `Couldn’t reset ${held}. Try again.`;

  async function reset() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await hearAction(() => setGuestRsvp(eventId, [guestId], 'pending', { fresh: true }));
      if (!res.ok) {
        setError(plainRefusal(res.error, couldnt));
        return;
      }
      onClose();
      const fresh = res.fresh ?? null;
      if (!fresh) {
        guestToast.info(`${held}’s invitation is already fresh — nothing to reset.`);
        return;
      }
      pushUndo({
        label: `${held}’s invitation reset`,
        undo: async () => {
          const r = await hearAction(() => restoreGuestRsvpAndSeat(eventId, [], null, fresh));
          if (!r.ok) guestToast.error('Could not undo — refresh and try again.');
        },
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <GuestPopup kind="confirm" onClose={onClose} labelledById={titleId}>
      <div className="space-y-3" data-guest-reset-warning="">
        <h2 id={titleId} className="font-display text-xl text-ink">
          {words.title}
        </h2>
        <p className="text-sm leading-relaxed text-ink/70">{words.body}</p>
        {error ? (
          <p role="alert" className="text-sm text-danger-700" data-guest-reset-refused="">
            {error}
          </p>
        ) : null}
        <GuestConfirmActions
          keep={<ActionButton tone="neutral" icon={X} label="Cancel" onClick={onClose} />}
          go={
            <div data-guest-reset-confirm="">
              <ActionButton tone="warn" main icon={RotateCcw} label={busy ? 'Resetting…' : 'Reset'} onClick={() => void reset()} disabled={busy} />
            </div>
          }
        />
      </div>
    </GuestPopup>
  );
}
