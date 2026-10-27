'use client';

import { ConfirmDialog } from '@/app/_components/confirm-dialog';

/**
 * "DID YOU SEND <NAME>'S INVITATION?" — Sent · Not yet. The one question asked
 * when the host comes back from the app they sent it in (`lib/ask-on-return.ts`
 * decides WHEN; owner 2026-10-27, DECISION_LOG "AFTER INVITE OPENS ANOTHER APP,
 * ASK ON RETURN").
 *
 * Sent → the caller's ONE writer (`setGuestInvitationSent`, through its own
 * `mark(true)`), so the guest moves from To invite to No reply in place.
 * Not yet → nothing changes; they stay in To invite.
 *
 * It is the approved confirm box (`ConfirmDialog`, INTERACTION_RULES § 9) — not a
 * new sheet.
 */
export function SentOrNotYet({
  open,
  name,
  onSent,
  onNotYet,
}: {
  open: boolean;
  /** As the rest of the invite says it — their first name. */
  name: string;
  onSent: () => void;
  onNotYet: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      title={`Did you send ${name}’s invitation?`}
      body={`Tap Sent once it’s in their chat — ${name} moves from To invite to No reply.`}
      confirmLabel="Sent"
      cancelLabel="Not yet"
      onConfirm={onSent}
      onCancel={onNotYet}
    />
  );
}
