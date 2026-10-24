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
  if (Pick && linked === true && canManage && initial.lock !== 'creator') {
    return <Pick eventId={eventId} guestId={guestId} firstName={firstName} initial={initial} />;
  }
  return (
    <div className="space-y-2" data-guest-access>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink">Access</span>
        <span className="text-sm text-ink/60">{accessWordFor(initial)}</span>
      </div>
      <p className="text-xs text-ink/55">{accessNote(initial, firstName)}</p>
    </div>
  );
}
