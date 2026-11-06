import { Hourglass } from 'lucide-react';
import { CLAIM_WAIT_LINE, CLAIM_WAIT_UNREADABLE, claimWaitTitle, type ClaimWaitsRead } from '@/lib/claim-access-wait';

/**
 * 🔗 "WAITING FOR <EVENT> TO LET YOU IN" — one line per pending claim ask, on Today (supplier gate audit G3,
 * `lib/claim-access-wait.ts`). Not pressable, so no frame — a divider under each (house rule: frames only on what you
 * press). Nothing waiting draws nothing; a failed read SAYS so rather than drawing as "nothing waiting".
 */
export function ClaimWaitLines({ read }: { read: ClaimWaitsRead }) {
  if (read.ok && read.waits.length === 0) return null;
  return (
    <section aria-label="Couples to let you in" className="mb-3 divide-y divide-ink/10 border-b border-ink/10">
      {read.ok ? (
        read.waits.map((w) => (
          <div key={w.requestId} className="flex items-start gap-3 py-3">
            <Hourglass aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink/55" strokeWidth={1.75} />
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-ink">{claimWaitTitle(w)}</p>
              <p className="mt-0.5 text-[13px] text-ink/70">{CLAIM_WAIT_LINE}</p>
            </div>
          </div>
        ))
      ) : (
        <p role="status" className="py-3 text-[13px] text-danger-700">
          {CLAIM_WAIT_UNREADABLE}
        </p>
      )}
    </section>
  );
}
