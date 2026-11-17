/**
 * "N matched by themselves" — phase 2 of the admin BDO batch match.
 *
 * Owner 2026-11-17 (specs DECISION_LOG "limits APPROVED, undo 30 minutes"):
 * (5) Undo stays 30 minutes, then the payment opens like any other; (6) the
 * count reaches him by the on-screen toast and the Focus list ONLY — no email.
 *
 * Drawn in the same "From your BDO" block on Focus and on Admin › Payments.
 * Each row: who · amount · "Pays at 10:42 AM" · Undo. Past its window and not
 * yet released, a row reads "Confirming now" and has no Undo.
 */
import { formatPhp } from '@/lib/orders';
import { formatCount } from '@/lib/format-number';
import { SubmitButton } from '@/app/_components/submit-button';
import { TemplateFail, TEMPLATE_SUBLINE } from '@/app/_components/template-rows';
import { paysAtLabel, undoIsOpen } from '@/lib/admin/received-auto-match';
import { shortReference } from '@/lib/admin/received-match';
import { approvePayment } from '../actions';
import type { HeldRow } from '../received-auto';
import { HeldToast } from './received-held-toast';

export function ReceivedHeldList({ held, query, next, now = new Date() }: { held: HeldRow[] | null; query: string; next?: string; now?: Date }) {
  if (held === null) {
    return (
      <TemplateFail data="payments-received-held-read">
        Couldn&rsquo;t check the payments that matched by themselves. Refresh to try again.
      </TemplateFail>
    );
  }
  if (held.length === 0) return null;
  // One drop's holds share one matched_at — the toast counts the newest set once.
  const newest = held.reduce((m, h) => (h.matched_at > m ? h.matched_at : m), held[0]!.matched_at);
  const fresh = held.filter((h) => h.matched_at === newest).length;
  return (
    <div className="mt-3" data-payments-received-held="">
      <HeldToast count={fresh} stamp={newest} />
      <p className="text-[15px] font-semibold text-ink">
        {held.length === 1 ? '1 matched by itself' : `${formatCount(held.length)} matched by themselves`}
      </p>
      <p className={TEMPLATE_SUBLINE}>Same reference and same amount. Each confirms 30 minutes after it matched. Undo puts it back with the ones you match by hand.</p>
      <ul className="mt-2 divide-y divide-[color:var(--sn-ink-100)]">
        {held.map((h) => {
          const open = undoIsOpen(h.matched_at, now);
          return (
            <li key={h.received_id} className="flex items-center gap-3 py-2.5" data-payments-received-held-row={h.received_id}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-ink">
                  {h.label} · <span className="tabular-nums">{h.amount_php == null ? '—' : formatPhp(h.amount_php)}</span>
                </p>
                <p className={`${TEMPLATE_SUBLINE} tabular-nums`}>
                  {open ? `Confirms at ${paysAtLabel(h.matched_at)}` : 'Confirming now'}
                  {h.reference ? ` · ${shortReference(h.reference)}` : ''}
                </p>
              </div>
              {open ? (
                <form action={approvePayment}>
                  <input type="hidden" name="intent" value="received-undo" />
                  <input type="hidden" name="received_id" value={h.received_id} />
                  <input type="hidden" name="q" value={query} />
                  {next ? <input type="hidden" name="next" value={next} /> : null}
                  <SubmitButton className="ab min-h-11" pendingLabel="Undoing…">
                    Undo
                  </SubmitButton>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
