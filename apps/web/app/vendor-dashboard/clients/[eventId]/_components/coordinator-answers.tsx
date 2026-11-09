/**
 * 🤝 "WAITING ON YOU" — THE BOOKED COORDINATOR'S PLACE TO ANSWER (owner 8 Nov 2026: *"only coordinator and hosts has
 * the final say. so any supplier that is not a coordinator still has to request a host or coordinator to accept the
 * change"*).
 *
 * Where the coordinator already works — their client page for this couple (Details), beside their own access. No new
 * screen: the asks are drawn with the hosts' own `RequestCard` (same component, same action, `answerAccessRequest`),
 * answering as the coordinator — who may share only a part they hold. The database decides either way
 * (`answer_area_access_request`). Drawn only for the booked coordinator; a refused read says so, never "nothing waiting".
 */
import type { ReactNode } from 'react';
import { RequestCard } from '@/app/dashboard/[eventId]/access-requests/_components/request-card';
import type { DelegateArea } from '@/lib/delegate-areas';
import type { CoordinatorAsk } from '@/lib/coordinator-answers.server';

export function CoordinatorAnswers({
  eventId,
  asks,
  measured,
  shareable,
  changes,
}: {
  eventId: string;
  asks: CoordinatorAsk[];
  measured: boolean;
  /** The parts the coordinator holds — the only ones they may share on. */
  shareable: readonly DelegateArea[];
  /** Suppliers' proposed changes to the guest list, the seat plan and the suppliers, when there are any. */
  changes?: ReactNode;
}) {
  if (measured && asks.length === 0 && !changes) return null;
  return (
    <section className="space-y-3" data-coordinator-answers="">
      <h3 className="sn-sec">Waiting on you</h3>
      {!measured ? (
        <p className="text-sm text-terracotta-700" data-coordinator-answers-refused="">
          We could not check for suppliers asking for access. Reload to try again.
        </p>
      ) : null}
      {asks.length > 0 ? (
        <ul className="space-y-4">
          {asks.map((a) => (
            <RequestCard key={a.requestId} eventId={eventId} request={a} answering={{ as: 'coordinator', shareable }} />
          ))}
        </ul>
      ) : null}
      {changes}
    </section>
  );
}
