/**
 * ✍️ "SUPPLIER CHANGES" — the open proposals to the guest list, the seat plan and the suppliers, answered in place
 * (owner 8 Nov 2026: *"any supplier that is not a coordinator still has to request a host or coordinator to accept
 * the change"*).
 *
 * Mounted where the hosts and the coordinator already answer suppliers' schedule requests — the Schedule page, beside
 * the "Supplier requests" queue — and on the coordinator's client page (Details › Waiting on you). The rows come from
 * the caller's own session (`readOpenChangeRequests`), so each person sees exactly what RLS lets them answer; the
 * database decides every Accept (`answer_event_change_request`). A refused read is said, never "nothing waiting".
 */
import { FLOOR_AREA_LABEL } from '@/lib/floor-command';
import type { ChangeRow } from '@/lib/change-requests.server';
import { ChangeDecision } from './change-decision';

export function ChangeRequestsQueue({
  eventId,
  rows,
  measured,
}: {
  eventId: string;
  rows: ChangeRow[];
  measured: boolean;
}) {
  if (measured && rows.length === 0) return null;
  return (
    <section className="space-y-3 py-2" data-change-requests-queue="">
      <header className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
          Supplier changes{measured ? ` · ${rows.length}` : ''}
        </p>
        <p className="max-w-prose text-sm text-ink/65">
          A supplier you shared a part with asked for these. Accepting makes the change; suppliers never change the
          guest list, the seat plan or the suppliers directly.
        </p>
      </header>
      {!measured ? (
        <p className="text-sm text-terracotta-700" data-change-requests-refused="">
          We could not check for supplier changes. Reload to try again.
        </p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {rows.map((r) => (
            <li key={r.changeId} className="space-y-1.5 py-3" data-change-request={r.changeId}>
              <p className="text-sm">
                <span className="font-medium">{r.supplierName}</span>{' '}
                <span className="text-ink/55">· {FLOOR_AREA_LABEL[r.area]}</span>
              </p>
              <p className="text-sm text-ink/80">{r.summary}</p>
              {r.note ? <p className="text-sm text-ink/60">&ldquo;{r.note}&rdquo;</p> : null}
              <div className="pt-0.5">
                <ChangeDecision eventId={eventId} changeId={r.changeId} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
