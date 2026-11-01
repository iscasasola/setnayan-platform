'use client';

/**
 * 📥 A REQUEST DECIDED INSIDE GUESTS (R4 slice 11; owner 2026-10-31). The Requests page's rows, drawn in Guests
 * (`maker=guests`), post through these instead of the page's forms:
 *
 *   · `DecideForm` — Accept · Decline · Link call `decideRequestInPlace` (ONE door, the verb in `do`), which ANSWERS
 *     instead of redirecting. Done → the row is kept in Guests as "Accepted · just now" (`noteDecided`, drawn by
 *     `RequestsJustDecided`) and Accept · Decline drop Guests' own toast with Undo (`pushUndo`, its `UndoToastHost`);
 *     refused → said in that toast, in words, and the row stays as it was. Nothing navigates, ever.
 *   · `DecideRow` — the row itself steps aside the moment it is decided (the refresh would drop it anyway) and comes
 *     back on Undo.
 *
 * Loaded through the lazy door (`_components/guest-setup/guest-setup-lazy.tsx`) — the Requests page is in the Maker's
 * first load. 🔒 lib/requests-are-inside-guests.test.ts
 */

import type { ReactNode } from 'react';
import { guestToast, pushUndo } from '../_components/undo-store';
import { forgetDecided, noteDecided, useDecidedRequests, type DecidedRequest } from '../_components/requests-decided';
import type { RequestInPlace } from './actions';

type Act = (formData: FormData) => Promise<RequestInPlace>;
type Verb = 'keep' | 'decline' | 'link';

const KIND: Readonly<Record<Verb, DecidedRequest['kind']>> = { keep: 'accepted', decline: 'declined', link: 'linked' };
const UNDO: Readonly<Partial<Record<Verb, string>>> = { keep: 'undo-accept', decline: 'undo-decline' };
const DIDNT = 'That did not save — nothing changed. Try again.';

async function ask(act: Act, fd: FormData): Promise<RequestInPlace> {
  try {
    return await act(fd);
  } catch {
    return { ok: false, error: DIDNT };
  }
}

/** One decision, answered in place. `act` = `decideRequestInPlace` bound to the event. */
export async function decideInPlace(act: Act, verb: Verb, guestId: string, name: string, fd: FormData): Promise<void> {
  fd.set('do', verb);
  const r = await ask(act, fd);
  if (!r.ok) {
    guestToast.error(r.error);
    return;
  }
  const kind = KIND[verb];
  noteDecided({ guestId, name, kind });
  const undoVerb = UNDO[verb];
  const label = kind === 'accepted' ? `Accepted ${name}` : kind === 'declined' ? `Declined ${name}` : `Linked ${name}`;
  if (!undoVerb) {
    guestToast.success(label);
    return;
  }
  pushUndo({
    label,
    undo: async () => {
      const back = new FormData();
      back.set('do', undoVerb);
      back.set('guest_id', guestId);
      const u = await ask(act, back);
      if (u.ok) forgetDecided(guestId);
      else guestToast.error(u.error);
    },
  });
}

export function DecideForm({
  act,
  verb,
  guestId,
  name,
  className,
  children,
}: {
  act: Act;
  verb: Verb;
  guestId: string;
  name: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <form action={(fd) => decideInPlace(act, verb, guestId, name, fd)} className={className} data-decide-in-place={verb}>
      {children}
    </form>
  );
}

export function DecideRow({ guestId, children }: { guestId: string; children: ReactNode }) {
  const decided = useDecidedRequests();
  return decided.some((d) => d.guestId === guestId) ? null : <>{children}</>;
}
