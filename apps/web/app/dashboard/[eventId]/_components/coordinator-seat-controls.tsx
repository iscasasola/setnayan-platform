import {
  DELEGATE_AREAS,
  DELEGATE_AREA_LABEL,
  resolveAreaLevel,
  type ModeratorPermissions,
} from '@/lib/event-moderators';
import { removeHost, setDelegateBudget, setDelegatePhotos } from '@/app/dashboard/[eventId]/hosts/actions';
import { SubmitButton } from '@/app/_components/submit-button';

/**
 * A COORDINATOR seat's grants and the couple's controls on it — moved whole
 * off the Hosts page in the Hosts fold (owner 2026-09-30, DECISION_LOG "GUEST
 * LIST: ACCESS + CHECK-IN BECOME COLUMNS…"). Nothing is redrawn: the same
 * chips, the same three forms, the same actions in `hosts/actions.ts`.
 *
 * Where they are drawn now:
 *   · the hired planner's seat — their supplier workspace
 *     (`promote-coordinator-card.tsx`);
 *   · a limited helper's seat — their guest card (`guest-helper-access.tsx`),
 *     without the reasoned Remove (Access → None is their removal).
 *
 * 🔑 NEVER FOR A FULL CO-HOST. A co-host seat is a `couple` member
 * (20271251336140) with the same access as the creator; nothing reads its
 * permissions_json, so a "Budget · off" chip on the Groom was a lie. The
 * actions refuse it at the door too (`seatIsFullCohost`).
 *
 * `returnTo` says where each form lands afterwards — the actions read the
 * hidden `vendor_id` / `guest_id` (see `seatReturnPath`), so the couple stays on
 * the screen they pressed it on.
 */

export type SeatReturnTo = { vendorId: string } | { guestId: string };

function ReturnFields({ returnTo }: { returnTo: SeatReturnTo }) {
  return 'vendorId' in returnTo ? (
    <input type="hidden" name="vendor_id" value={returnTo.vendorId} />
  ) : (
    <input type="hidden" name="guest_id" value={returnTo.guestId} />
  );
}

/** What `permissions_json` grants a coordinator seat, area by area. */
export function CoordinatorGrantChips({ permissions }: { permissions: ModeratorPermissions | null }) {
  const budgetLevel = resolveAreaLevel(permissions, 'budget');
  const grantChips = DELEGATE_AREAS.filter((a) => a !== 'budget')
    .map((a) => ({ area: a, level: resolveAreaLevel(permissions, a) }))
    .filter((g) => g.level !== null);
  return (
    <p className="flex flex-wrap gap-1">
      {grantChips.map((g) => (
        <span
          key={g.area}
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            g.level === 'edit' ? 'bg-terracotta/10 text-terracotta-700' : 'bg-ink/5 text-ink/60'
          }`}
        >
          {DELEGATE_AREA_LABEL[g.area]}
          {g.level === 'view' ? ' · view' : ''}
        </span>
      ))}
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
          budgetLevel ? 'bg-ink/5 text-ink/60' : 'bg-ink/[0.03] text-ink/35'
        }`}
      >
        Budget {budgetLevel ? '· view' : '· off'}
      </span>
    </p>
  );
}

/**
 * The couple's controls on a COORDINATOR seat: the budget and photo grants
 * (locked D1 · owner 2026-08-06) and removal with its reason (owner
 * 2026-06-22 — `abuse_misuse` is an admin signal).
 */
export function CoordinatorSeatControls({
  eventId,
  moderatorId,
  permissions,
  returnTo,
  withRemove = true,
}: {
  eventId: string;
  moderatorId: string;
  permissions: ModeratorPermissions | null;
  returnTo: SeatReturnTo;
  /**
   * The reasoned Remove is the HIRED PLANNER's. A limited helper from the guest
   * list is removed the guest-list way — Access → None on the same card
   * (`setGuestAccess`) — so their card draws no second, different Remove.
   */
  withRemove?: boolean;
}) {
  const budgetLevel = resolveAreaLevel(permissions, 'budget');
  // Owner ruling 2026-08-06 — the couple approves photo access per
  // delegate. Refused until they press it.
  const photosLevel = resolveAreaLevel(permissions, 'photos');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={setDelegateBudget}>
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="moderator_id" value={moderatorId} />
        <ReturnFields returnTo={returnTo} />
        <input type="hidden" name="budget_grant" value={budgetLevel ? 'off' : 'view'} />
        <SubmitButton pendingLabel="Saving…" className="text-[11px] text-ink/55 underline hover:text-ink">
          {budgetLevel ? 'Hide budget' : 'Allow budget view'}
        </SubmitButton>
      </form>
      <form action={setDelegatePhotos}>
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="moderator_id" value={moderatorId} />
        <ReturnFields returnTo={returnTo} />
        <input type="hidden" name="photos_grant" value={photosLevel ? 'off' : 'view'} />
        <SubmitButton pendingLabel="Saving…" className="text-[11px] text-ink/55 underline hover:text-ink">
          {photosLevel ? 'Hide event photos' : 'Allow event photos'}
        </SubmitButton>
      </form>
      {withRemove ? (
      <form action={removeHost} className="flex items-center gap-1.5">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="moderator_id" value={moderatorId} />
        <ReturnFields returnTo={returnTo} />
        <select
          name="reason"
          required
          defaultValue=""
          aria-label="Reason for removing this coordinator"
          className="rounded border border-ink/15 bg-cream px-1.5 py-1 text-[11px] text-ink"
        >
          <option value="" disabled>
            Reason…
          </option>
          <option value="no_longer_availing">No longer availing their services</option>
          <option value="abuse_misuse">Abuse / misuse</option>
          <option value="new_coordinator">We have a new coordinator</option>
          <option value="other">Other</option>
        </select>
        <SubmitButton pendingLabel="Removing…" className="text-[11px] text-terracotta-700 underline hover:text-terracotta-800">
          Remove
        </SubmitButton>
      </form>
      ) : null}
    </div>
  );
}
