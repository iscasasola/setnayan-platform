/**
 * guest-access-control.tsx — the guest card's "Access" line: the word
 * (None · Co-host · Limited helper) and what it means — SHOWN.
 *
 * ⚖ Owner 2026-10-03 ("People with access"): access is set per person, per
 * area, in ONE place — Event Details › People with access. The line's dropdown
 * (2026-09-28, `setGuestAccess`) moved there; for a co-host this line carries
 * the one quiet door to it. Replace means remove — no second setter here.
 */

import {
  ACCESS_LEVEL_LABEL,
  accessNote,
  type GuestAccessState,
} from '@/lib/guest-access';
import { ChangeAccessLink } from '@/app/dashboard/[eventId]/_components/coordinator-seat-controls';

export function GuestAccessControl({
  eventId,
  firstName,
  initial,
  canManage,
}: {
  eventId: string;
  guestId: string;
  firstName: string;
  initial: GuestAccessState;
  canManage: boolean;
}) {
  return (
    <div className="space-y-2" data-guest-access>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink">Access</span>
        <span className="text-sm text-ink/60">{ACCESS_LEVEL_LABEL[initial.level]}</span>
      </div>
      <p className="text-xs text-ink/55">{accessNote(initial, firstName)}</p>
      {canManage && initial.lock !== 'creator' ? <ChangeAccessLink eventId={eventId} /> : null}
    </div>
  );
}
