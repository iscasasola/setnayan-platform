/**
 * guest-access-control.tsx — the guest card's "Access" line: the word (None · Co-host · Limited helper) and what it means.
 *
 * ⚖ Owner 24 Oct 2026, verbatim: *"Add the Access dropdown on the guest card too."* — superseding, for this case, the 03 Oct
 * "access is set in ONE place" rule. So for a LINKED guest the couple may change it HERE too, through the very action Event
 * Details › People with access calls (`GuestAccessPick` → `setGuestAccess`): one mechanism, two doors. Everyone else — an
 * unlinked guest, a viewer who may not change access, the creator's own row — sees the word, and no link out of the card.
 *
 * The pick is HANDED IN by the Guests pages (`Pick`), never imported here — this line is in the Maker's first load.
 */

import type { ComponentType } from 'react';
import { FormRow } from '@/app/_components/form-row';
import { accessNote, accessWordFor, type GuestAccessState } from '@/lib/guest-access';
import type { GuestAccessPick } from './guest-access-pick';

export function GuestAccessControl({
  eventId,
  guestId,
  firstName,
  initial,
  canManage,
  linked,
  Pick,
}: {
  eventId: string;
  guestId: string;
  firstName: string;
  initial: GuestAccessState;
  canManage: boolean;
  /** Has the guest linked an account? Only then is there an Access to change here (owner 24 Oct). */
  linked: boolean | null;
  /** "Access ▾" (`guest-access-pick.tsx`) — handed in by the Guests pages. */
  Pick?: ComponentType<Parameters<typeof GuestAccessPick>[0]>;
}) {
  /* 🔑 ONE LINE (owner 2026-11-02: *"simplify access just like the rest of the guest card"*): Access ▾ for whoever may
     change it — linked or not yet (a level set ahead starts once they sign in; `setGuestAccess` keeps the seat waiting) —
     else the word on the same row. What it means is the ⓘ, never a paragraph under it. Held by
     `the-access-row-is-three-lines.test.ts`. */
  if (Pick && linked !== null && canManage && initial.lock !== 'creator') {
    return <Pick eventId={eventId} guestId={guestId} firstName={firstName} initial={initial} />;
  }
  return (
    <FormRow name="Access" about={{ words: accessNote(initial, firstName) }} data="card-access" attrs={{ 'data-guest-access': '' }}>
      <span className="text-[14px] text-ink/70">{accessWordFor(initial)}</span>
    </FormRow>
  );
}
