/**
 * received-pile.tsx — "From your BDO" (owner 2026-11-17, specs
 * prototypes/admin_payment_verify_2026-11-17/ v5).
 *
 *   ReceivedTileBlock  the drop tile, the last-drop line, the summary rows
 *   ReceivedCard       "In your BDO, no order · match by hand"
 *   BuyerSaysPaidCard  "Buyer says paid" — not in your BDO yet
 *   ReceivedPile       Admin › Payments: the block plus every card, listed
 *
 * Focus draws the same block, and opens the same cards one at a time
 * (`app/admin/_components/focus-received.tsx`).
 *
 * Renders only — the page reads, and `candidatesFor` / `receivedFor` (pure)
 * decide what each card offers. ⛔ Phase 1: nothing is matched by itself.
 * A strong candidate is listed FIRST and the admin presses Match.
 */
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { formatPhp } from '@/lib/orders';
import { formatCount } from '@/lib/format-number';
import { SubmitButton } from '@/app/_components/submit-button';
import { TemplateFail, TemplateSection, TEMPLATE_SUBLINE } from '@/app/_components/template-rows';
import { FormPick } from '../../work/_components/form-pick';
import {
  candidatesFor,
  receivedFor,
  shortReference,
  waitingWithoutReceived,
  type WaitingPayment,
} from '@/lib/admin/received-match';
import { approvePayment } from '../actions';
import { NOT_RECEIVED_REASONS } from '../received';
import { ReceivedDropTile } from './received-drop-tile';
import { ReceivedMatchPick } from './received-match-pick';

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

export type LastDrop = { count: number; at: string } | null;

const TIP = 'They show phone numbers. We keep only the reference, amount, date and time.';

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

function manilaClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
}

/** What the pile counts. `buyers` is null when the waiting payments could not be read. */
export function pileCounts(rows: ReceivedOpenRow[], waiting: WaitingPayment[] | null) {
  const unreadable = rows.filter((r) => r.read_status === 'unreadable').length;
  const noOrder = rows.filter((r) => r.read_status === 'read');
  const buyers = waiting ? waitingWithoutReceived(waiting, rows) : null;
  return { unreadable, noOrder, buyers };
}

/** One summary row, drawn like a Focus row: title, the drawing's sub-line, a chevron when it opens. */
function PileRow({ title, sub, href, data }: { title: string; sub: string; href?: string; data: string }) {
  const inner = (
    <>
      <span className="grid min-w-0 flex-1">
        <span className="truncate text-[15px] font-semibold text-[color:var(--sn-ink-900)]">{title}</span>
        <span className="truncate text-[13px] text-[color:var(--sn-ink-500)]">{sub}</span>
      </span>
      {href ? <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-[color:var(--sn-ink-500)]" /> : null}
    </>
  );
  return (
    <li>
      {href ? (
        <Link
          href={href}
          scroll={false}
          className="flex min-h-14 items-center gap-3 border-t py-2.5 transition-colors hover:bg-[var(--sn-paper)]"
          style={{ borderColor: 'var(--sn-line)' }}
          data-payments-received-row={data}
        >
          {inner}
        </Link>
      ) : (
        <div
          className="flex min-h-14 items-center gap-3 border-t py-2.5"
          style={{ borderColor: 'var(--sn-line)' }}
          data-payments-received-row={data}
        >
          {inner}
        </div>
      )}
    </li>
  );
}

/**
 * The tile, "Pictures are read on this phone…", the last drop, and the
 * summary rows. `hrefs` turns the rows into Focus links; without it they are lines.
 */
export function ReceivedTileBlock({
  rows,
  waiting,
  lastDrop,
  hrefs,
}: {
  rows: ReceivedOpenRow[];
  waiting: WaitingPayment[] | null;
  lastDrop: LastDrop;
  hrefs?: { noOrder?: string; buyers?: string };
}) {
  const { unreadable, noOrder, buyers } = pileCounts(rows, waiting);
  return (
    <>
      <ReceivedDropTile />
      <p className={`mt-1.5 ${TEMPLATE_SUBLINE}`} data-payments-received-privacy="">
        Pictures are read on this phone, never uploaded.
      </p>
      {lastDrop ? (
        <p className={`mt-0.5 ${TEMPLATE_SUBLINE} tabular-nums`} data-payments-received-last-drop="">
          Last drop · {formatCount(lastDrop.count)} read · {manilaClock(lastDrop.at)}
        </p>
      ) : null}
      <ul className="mt-2" data-payments-received-lines="">
        <PileRow
          title={noOrder.length === 1 ? '1 in your BDO, no order' : `${formatCount(noOrder.length)} in your BDO, no order`}
          sub="Match each by hand"
          href={noOrder.length > 0 ? hrefs?.noOrder : undefined}
          data="no-order"
        />
        <PileRow
          title={
            buyers === null
              ? 'Couldn’t check who says paid'
              : buyers.length === 1
                ? '1 buyer says paid, not in your BDO yet'
                : `${formatCount(buyers.length)} buyers say paid, not in your BDO yet`
          }
          sub="Checked again on every drop"
          href={buyers && buyers.length > 0 ? hrefs?.buyers : undefined}
          data="buyers"
        />
        {unreadable > 0 ? (
          <PileRow
            title={unreadable === 1 ? '1 picture could not be read' : `${formatCount(unreadable)} pictures could not be read`}
            sub="Add it again, or match it from the payment"
            data="unreadable"
          />
        ) : null}
      </ul>
    </>
  );
}

export function ReceivedPile({
  read,
  waiting,
  lastDrop = null,
  query,
}: {
  read: ReceivedPileRead;
  waiting: WaitingPayment[];
  lastDrop?: LastDrop;
  query: string;
}) {
  if (read.kind === 'failed') {
    return (
      <TemplateSection label="From your BDO" tip={TIP} data="payments-received">
        <ReceivedDropTile />
        <TemplateFail data="payments-received-read">
          Couldn&rsquo;t load your received payments. Refresh to try again.
        </TemplateFail>
      </TemplateSection>
    );
  }
  const rows = [...read.rows].sort((a, b) => Number(a.left_reason === 'later') - Number(b.left_reason === 'later'));
  return (
    <TemplateSection label="From your BDO" tip={TIP} data="payments-received">
      <ReceivedTileBlock rows={rows} waiting={waiting} lastDrop={lastDrop} />
      <div className="mt-3 divide-y divide-ink/10">
        {rows.map((r) => (
          <div key={r.received_id} className="py-3">
            <ReceivedCard row={r} waiting={waiting} query={query} />
          </div>
        ))}
      </div>
    </TemplateSection>
  );
}

/** "In your BDO, no order · match by hand" — one received row. `next` = the following Focus card. */
export function ReceivedCard({
  row,
  waiting,
  query,
  next,
}: {
  row: ReceivedOpenRow;
  waiting: WaitingPayment[];
  query: string;
  next?: string;
}) {
  const cands = candidatesFor(row, waiting);
  const candIds = new Set(cands.map((c) => c.payment.payment_id));
  const top = cands[0];
  const others = waiting.filter((p) => !candIds.has(p.payment_id));
  const options = [
    ...cands.map((c) => ({
      key: c.payment.payment_id,
      label: `${c.payment.label} · ${formatPhp(c.payment.amount_php)} · ${c.reasons.join(' · ')}`,
      who: c.payment.label,
    })),
    ...others.map((p) => ({
      key: p.payment_id,
      label: `${p.label} · ${formatPhp(p.amount_php)}${p.reference_number ? ` · Invoice ${p.reference_number}` : ''}`,
      who: p.label,
    })),
  ];
  // The drawing's line under the amount: the strongest lead, and why it is not done by itself.
  const lead =
    top && top.diffPhp !== 0 && top.reasons.includes('Reference matches')
      ? `The reference is on ${top.payment.label}’s payment, but they owe ${formatPhp(top.payment.amount_php)}.`
      : null;
  const leaveForm = `received-leave-${row.received_id}`;
  const refLine =
    (row.read_status === 'unreadable'
      ? 'This picture could not be read.'
      : row.reference
        ? `Ref ${shortReference(row.reference)}`
        : 'Reference not read') + (row.left_reason === 'later' ? ' · Left for the next drop' : '');
  return (
    <div data-payments-received-card={row.received_id}>
      <p className={TEMPLATE_SUBLINE}>BDO · read from your screenshot · {manilaWhen(row.received_at)}</p>
      <p className="mt-0.5 text-[22px] font-bold text-ink tabular-nums">
        {row.amount_php != null ? formatPhp(Number(row.amount_php)) : 'Amount not read'}
      </p>
      <p className={`${TEMPLATE_SUBLINE} break-all tabular-nums`}>{refLine}</p>
      <p className={TEMPLATE_SUBLINE}>Picture never uploaded</p>
      {lead ? <p className="mt-2 text-[14px] text-ink">{lead}</p> : null}

      {options.length > 0 ? (
        <form action={approvePayment} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="intent" value="received-match" />
          <input type="hidden" name="received_id" value={row.received_id} />
          <input type="hidden" name="q" value={query} />
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <ReceivedMatchPick
            name="payment_id"
            label="Match to"
            placeholder="Match to"
            dataAttr={`received-match-pick-${row.received_id}`}
            options={options}
            verb="Match to"
          />
        </form>
      ) : (
        <p className={`mt-2 ${TEMPLATE_SUBLINE}`}>No payment is waiting.</p>
      )}
      {options.length > 0 ? (
        <p className={`mt-1 ${TEMPLATE_SUBLINE}`}>Only the exact amount confirms here. A different amount opens their payment.</p>
      ) : null}

      <form id={leaveForm} action={approvePayment} className="mt-2 flex flex-wrap items-center gap-2">
        <input type="hidden" name="intent" value="received-leave" />
        <input type="hidden" name="received_id" value={row.received_id} />
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <FormPick
          name="reason"
          form={leaveForm}
          label="Set aside"
          placeholder="Set aside"
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

/** "Buyer says paid" — a waiting payment no received row accounts for yet. */
export function BuyerSaysPaidCard({
  payment,
  rows,
  lastDrop,
  query,
  next,
}: {
  payment: WaitingPayment;
  rows: ReceivedOpenRow[];
  lastDrop: LastDrop;
  query: string;
  next?: string;
}) {
  const matches = receivedFor(
    payment,
    rows.filter((r) => r.read_status === 'read'),
  );
  const notForm = `received-not-${payment.payment_id}`;
  return (
    <div data-payments-buyer-card={payment.payment_id}>
      <p className="text-[16px] font-semibold text-ink">{payment.label}</p>
      <p className="mt-0.5 text-[22px] font-bold text-ink tabular-nums">{formatPhp(payment.amount_php)}</p>
      <p className={`${TEMPLATE_SUBLINE} tabular-nums`}>
        {payment.reference_number ? `Invoice ${payment.reference_number}` : 'No reference given'}
      </p>
      <p className="mt-2 text-[14px] text-ink">
        Not in your BDO screenshots yet.
        {lastDrop ? ` Checked at the ${manilaClock(lastDrop.at)} drop.` : ''}
      </p>
      <p className={`mt-1 ${TEMPLATE_SUBLINE}`}>
        <Link href={`/admin/payments?open=${encodeURIComponent(payment.payment_id)}`} className="underline underline-offset-2">
          Open their receipt photo
        </Link>
      </p>

      {matches.length > 0 ? (
        <form action={approvePayment} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="intent" value="received-match" />
          <input type="hidden" name="payment_id" value={payment.payment_id} />
          <input type="hidden" name="q" value={query} />
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <ReceivedMatchPick
            name="received_id"
            label="Match to a received one"
            placeholder="Match to a received one"
            dataAttr={`buyer-match-pick-${payment.payment_id}`}
            options={matches.map(({ row, c }) => ({
              key: String(row.received_id),
              label: [
                row.amount_php != null ? formatPhp(Number(row.amount_php)) : 'Amount not read',
                manilaWhen(row.received_at),
                shortReference(row.reference),
                ...c.reasons.filter((x) => x !== 'Same amount'),
              ]
                .filter(Boolean)
                .join(' · '),
              who: payment.label,
            }))}
            verb="Confirm payment"
          />
        </form>
      ) : null}

      <form id={notForm} action={approvePayment} className="mt-2 flex flex-wrap items-center gap-2">
        <input type="hidden" name="intent" value="received-not" />
        <input type="hidden" name="payment_id" value={payment.payment_id} />
        <input type="hidden" name="q" value={query} />
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <FormPick
          name="reason"
          form={notForm}
          label="Not received"
          placeholder="Not received"
          dataAttr={`buyer-not-pick-${payment.payment_id}`}
          options={Object.entries(NOT_RECEIVED_REASONS).map(([key, v]) => ({ key, label: v.label }))}
        />
        <SubmitButton className="ab min-h-11" pendingLabel="Saving…">
          Not received
        </SubmitButton>
      </form>
    </div>
  );
}
