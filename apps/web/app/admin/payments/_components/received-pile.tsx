/**
 * received-pile.tsx — "From your BDO": the drop tile, what the last drops
 * found, and one card per received payment with no order yet (owner
 * 2026-11-17, specs prototypes/admin_payment_verify_2026-11-17/).
 *
 * Renders only — the page reads, and `candidatesFor` (pure) decides what each
 * card offers. ⛔ Phase 1: nothing is matched by itself. A strong candidate is
 * listed FIRST and the admin presses Match.
 */
import { formatPhp } from '@/lib/orders';
import { SubmitButton } from '@/app/_components/submit-button';
import { TemplateFail, TemplateSection, TEMPLATE_SUBLINE } from '@/app/_components/template-rows';
import { FormPick } from '../../work/_components/form-pick';
import { candidatesFor, waitingWithoutReceived, type WaitingPayment } from '@/lib/admin/received-match';
import { approvePayment } from '../actions';
import { ReceivedDropTile } from './received-drop-tile';

export type ReceivedOpenRow = {
  received_id: number;
  reference: string | null;
  reference_norm: string | null;
  amount_php: number | null;
  received_at: string | null;
  read_status: 'read' | 'unreadable';
  left_reason: 'later' | null;
};

export type ReceivedPileRead =
  | { kind: 'ok'; rows: ReceivedOpenRow[] }
  /** The read was refused — never drawn as "nothing received". */
  | { kind: 'failed' };

function manilaWhen(iso: string | null): string {
  if (!iso) return 'Time not read';
  return new Date(iso).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ReceivedPile({
  read,
  waiting,
  readerOn,
  query,
}: {
  read: ReceivedPileRead;
  waiting: WaitingPayment[];
  readerOn: boolean;
  query: string;
}) {
  const tile = <ReceivedDropTile disabledReason={readerOn ? null : 'Reading is off on this server'} />;
  if (read.kind === 'failed') {
    return (
      <TemplateSection label="From your BDO" data="payments-received">
        {tile}
        <TemplateFail data="payments-received-read">
          Couldn&rsquo;t load your received payments. Refresh to try again.
        </TemplateFail>
      </TemplateSection>
    );
  }
  const rows = [...read.rows].sort((a, b) => Number(a.left_reason === 'later') - Number(b.left_reason === 'later'));
  const unreadable = rows.filter((r) => r.read_status === 'unreadable').length;
  const noOrder = rows.length - unreadable;
  const notInBdo = waitingWithoutReceived(waiting, rows).length;

  return (
    <TemplateSection
      label="From your BDO"
      tip="Pictures are read, then deleted. Nothing confirms until you press Match."
      data="payments-received"
    >
      {tile}
      <ul className={`mt-2 space-y-1 ${TEMPLATE_SUBLINE}`} data-payments-received-lines="">
        <li>{noOrder === 1 ? '1 in your BDO, no order' : `${noOrder} in your BDO, no order`}</li>
        <li>
          {notInBdo === 1
            ? '1 buyer says paid, not in your BDO yet'
            : `${notInBdo} buyers say paid, not in your BDO yet`}
        </li>
        {unreadable > 0 ? <li>{unreadable === 1 ? '1 picture could not be read' : `${unreadable} pictures could not be read`}</li> : null}
      </ul>
      <div className="mt-3 space-y-3">
        {rows.map((r) => (
          <ReceivedCard key={r.received_id} row={r} waiting={waiting} query={query} />
        ))}
      </div>
    </TemplateSection>
  );
}

function ReceivedCard({ row, waiting, query }: { row: ReceivedOpenRow; waiting: WaitingPayment[]; query: string }) {
  const cands = candidatesFor(row, waiting);
  const matchForm = `received-match-${row.received_id}`;
  const leaveForm = `received-leave-${row.received_id}`;
  return (
    <div className="sn-card p-3" data-payments-received-card={row.received_id}>
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-[16px] font-semibold text-ink tabular-nums">
        <span>{row.amount_php != null ? formatPhp(Number(row.amount_php)) : 'Amount not read'}</span>
        <span className={`${TEMPLATE_SUBLINE} font-normal`}>{manilaWhen(row.received_at)}</span>
      </p>
      <p className={`${TEMPLATE_SUBLINE} break-all tabular-nums`}>
        {row.read_status === 'unreadable' ? 'This picture could not be read.' : (row.reference ?? 'Reference not read')}
        {row.left_reason === 'later' ? ' · Left for the next drop' : ''}
      </p>

      {cands.length > 0 ? (
        <form id={matchForm} action={approvePayment} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="intent" value="received-match" />
          <input type="hidden" name="received_id" value={row.received_id} />
          <input type="hidden" name="q" value={query} />
          <FormPick
            name="payment_id"
            form={matchForm}
            label="Match to"
            placeholder="Match to"
            dataAttr={`received-match-pick-${row.received_id}`}
            options={cands.map((c) => ({
              key: c.payment.payment_id,
              label: `${c.payment.label} · ${c.reasons.join(' · ')}`,
            }))}
          />
          <SubmitButton className="ab ab-ok min-h-11" pendingLabel="Confirming…">
            Match
          </SubmitButton>
        </form>
      ) : (
        <p className={`mt-2 ${TEMPLATE_SUBLINE}`}>
          {row.amount_php == null ? 'No amount, so nothing to match.' : 'No waiting payment of this amount.'}
        </p>
      )}

      <form id={leaveForm} action={approvePayment} className="mt-2 flex flex-wrap items-center gap-2">
        <input type="hidden" name="intent" value="received-leave" />
        <input type="hidden" name="received_id" value={row.received_id} />
        <FormPick
          name="reason"
          form={leaveForm}
          label="Not now"
          placeholder="Not now"
          dataAttr={`received-leave-pick-${row.received_id}`}
          options={[
            { key: 'later', label: 'Leave for the next drop' },
            { key: 'not_setnayan', label: 'Not a Setnayan payment' },
          ]}
        />
        <SubmitButton className="ab min-h-11" pendingLabel="Saving…">
          Set aside
        </SubmitButton>
      </form>
    </div>
  );
}
