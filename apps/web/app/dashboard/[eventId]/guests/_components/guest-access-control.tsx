/**
 * guest-access-control.tsx — the guest card's "Access" line: the word (None · Co-host · Limited helper) and what it means.
 *
 * ⚖ Owner 24 Oct 2026, verbatim: *"Add the Access dropdown on the guest card too."* — superseding, for this case, the 03 Oct
 * "access is set in ONE place" rule. So for a LINKED guest the couple may change it HERE too, through the very action Event
 * Details › People with access calls (`GuestAccessPick` → `setGuestAccess`): one mechanism, two doors.
 * ⚖ Owner 2026-11-02, verbatim: *"Only for guests with setnayan accounts already"* — the dropdown is for a LINKED guest
 * only; an unlinked guest with no access draws no Access row (the card's "Account · Not linked" line says what linking
 * opens). Which of the three is `cardAccessView` (lib/guest-access.ts), held by `the-access-row-is-three-lines.test.ts`.
 *
 * The pick is HANDED IN by the Guests pages (`Pick`), never imported here — this line is in the Maker's first load.
 */

import type { ComponentType } from 'react';
import { FormRow } from '@/app/_components/form-row';
import { accessNote, accessWordFor, cardAccessView, type GuestAccessState } from '@/lib/guest-access';
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
  /** Has the guest linked an account? Only then is there an Access to change here (owner 24 Oct, again 2026-11-02). */
  linked: boolean | null;
  /** "Access ▾" (`guest-access-pick.tsx`) — handed in by the Guests pages. */
  Pick?: ComponentType<Parameters<typeof GuestAccessPick>[0]>;
}) {
  /* 🔑 ONE LINE (owner 2026-11-02: *"simplify access just like the rest of the guest card"*): Access ▾ only for a LINKED
     guest (owner 2026-11-02: *"Only for guests with setnayan accounts already"*), else the word on the same row, else —
     an unlinked guest with nothing — no row. What it means is the ⓘ, never a paragraph under it. */
  const view = cardAccessView(initial, linked, canManage);
  if (view === 'none') return null;
  if (view === 'pick' && Pick) {
    return <Pick eventId={eventId} guestId={guestId} firstName={firstName} initial={initial} />;
  }
  return (
    <FormRow name="Access" about={{ words: accessNote(initial, firstName) }} data="card-access" attrs={{ 'data-guest-access': '' }}>
      <span className="text-[14px] text-ink/70">{accessWordFor(initial)}</span>
    </FormRow>
  );
}
