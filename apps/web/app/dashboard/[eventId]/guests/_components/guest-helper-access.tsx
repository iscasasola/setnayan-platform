import {
  ChangeAccessLink,
  CoordinatorGrantChips,
} from '@/app/dashboard/[eventId]/_components/coordinator-seat-controls';
import { CoordinatorColourDomains } from '@/app/dashboard/[eventId]/_components/coordinator-colour-domains';
import { setCoordinatorColourDomain, rejectColourChange } from '@/app/dashboard/[eventId]/colour-access-actions';
import { delegateActivityWhen } from '@/lib/delegate-activity';
import type { GuestHelperCard } from '@/lib/guest-helper-card.server';

/**
 * guest-helper-access.tsx — under the Access line of a LIMITED HELPER's guest
 * card: what they may open (SHOWN — set in Event Details › People with access,
 * owner 2026-10-03), their colour domains, and what they did. The Hosts page's pieces, MOVED here in the Hosts
 * fold (owner 2026-09-30, DECISION_LOG "GUEST LIST: ACCESS + CHECK-IN BECOME
 * COLUMNS; HOSTS FOLDS INTO THE GUEST LIST"; build F2) — the same components and
 * the same actions (`hosts/actions.ts`, `colour-access-actions.ts`), none
 * redrawn and none duplicated.
 *
 * Handed to `GuestCardBody` as a rendered slot by the Guest list's two card
 * screens only, so the Maker — which also draws that card — carries none of it.
 */
export function GuestHelperAccess({
  eventId,
  firstName,
  helper,
}: {
  eventId: string;
  /** The card's guest — kept so the two card screens pass one shape. */
  guestId: string;
  firstName: string;
  helper: GuestHelperCard;
}) {
  const { seat, colour, activity } = helper;
  if (!helper.measured && !seat && !activity) {
    return (
      <p className="text-xs text-terracotta-700" data-guest-helper-refused="">
        We could not load what {firstName} can do as a helper. Reload to try again.
      </p>
    );
  }
  if (!seat && !activity) return null;
  return (
    <div className="space-y-3 border-t border-ink/10 pt-3" data-guest-helper-access="">
      {seat ? (
        <div className="space-y-2" data-guest-helper-grants="">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/50">
            What {firstName} can open
          </span>
          <CoordinatorGrantChips permissions={seat.permissions} />
          <ChangeAccessLink eventId={eventId} />
        </div>
      ) : null}
      {colour ? (
        <CoordinatorColourDomains
          people={[colour]}
          setDomainAction={setCoordinatorColourDomain.bind(null, eventId)}
          rejectAction={rejectColourChange.bind(null, eventId)}
        />
      ) : null}
      {activity ? (
        <div className="space-y-1.5" data-guest-helper-activity="">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/50">
            What {firstName} did
          </span>
          {!activity.measured ? (
            <p className="text-xs text-terracotta-700">We could not load this just now. Reload to try again.</p>
          ) : activity.lines.length === 0 ? (
            <p className="text-xs text-ink/55">Nothing yet.</p>
          ) : (
            <ul className="space-y-1">
              {activity.lines.map((l) => (
                <li key={l.key} className="text-xs text-ink/70">
                  <span className="text-ink">{l.did}</span>
                  {l.note ? ` — ${l.note}` : ''}
                  <span className="text-ink/45"> · {delegateActivityWhen(l.at, null)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
