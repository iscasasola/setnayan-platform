import { Undo2 } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import {
  TEMPLATE_MONEY,
  TemplateEmpty,
  TemplateFail,
  TemplateNums,
  TemplateRow,
  TemplateRows,
  TemplateSection,
} from '@/app/_components/template-rows';
import { formatPhp } from '@/lib/orders';
import { refundDayWords, refundedTotalPhp } from '@/lib/client-refunds';

/** One number, read by the query AND disclosed by the table. */
export const SUPPLIER_REFUNDS_ROW_LIMIT = 200;

export type SupplierRefundRow = {
  refund_id: string;
  event_id: string | null;
  vendor_profile_id: string;
  amount_php: number | string;
  refunded_on: string;
  reason: string;
  proof_r2_key: string | null;
  created_at: string;
  removed_at: string | null;
};

/** One of Setnayan's OWN order refunds (`order_refunds`), recorded from a payment's "Record a refund". */
export type OurRefundRow = {
  refundId: string;
  orderId: string;
  orderPublicId: string | null;
  amountPhp: number;
  reason: string;
  refundedAt: string;
  proofAttached: boolean;
};

/** A refund over the § 9.1 limit, waiting on its approval (`admin_approval_requests` · `approve_large_refund`). */
export type WaitingRefundRow = {
  approvalId: string;
  orderPublicId: string | null;
  amountPhp: number | null;
  reason: string | null;
  expiresAt: string | null;
};

/**
 * 💰 Admin › Money › Refunds (admin drawing 2026-11-13, `money-refunds`): our own order refunds, the large ones still
 * waiting on an approval, then the money suppliers say they gave back. Each list has its own honest state — `null`
 * means that read was refused, never "none".
 *
 * 💸 Admin › Payments › Supplier refunds — the render (read only). `rows: null` = the read was refused: the table says
 * "Couldn't read", the totals an em-dash, never "No supplier refunds yet". The page does the reads (`page.tsx`); the
 * dev lab draws this same component on sample rows.
 */
export function SupplierRefundsView({
  rows,
  readError,
  shopName,
  eventName,
  namesUnread = false,
  ours,
  waiting,
}: {
  rows: SupplierRefundRow[] | null;
  readError: { message?: string } | null;
  shopName: ReadonlyMap<string, string | null>;
  eventName: ReadonlyMap<string, string | null>;
  /** The supplier or event names could not be read — each row then says so, never a made-up name. */
  namesUnread?: boolean;
  /** Setnayan's own recorded order refunds, newest first. `null` = refused; `undefined` = not read (the lab). */
  ours?: OurRefundRow[] | null;
  /** Large refunds waiting on an approval. `null` = refused; `undefined` = not read (the lab). */
  waiting?: WaitingRefundRow[] | null;
}) {
  const ROW_LIMIT = SUPPLIER_REFUNDS_ROW_LIMIT;
  const standing = rows ? rows.filter((r) => !r.removed_at) : null;
  const total = standing ? refundedTotalPhp(standing.map((r) => ({ amountPhp: Number(r.amount_php) }))) : null;

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-10 pt-1 sm:px-6" data-admin-supplier-refunds="">
      <PageMasthead title="Refunds" />

      {ours !== undefined ? (
        <TemplateSection
          label="Ours · recorded"
          first
          right={ours ? String(ours.length) : '—'}
          tip="A paid service they cannot use is converted to Papic credits or moved to their next event, from the payment itself. Record a refund is for money sent back by hand (a double payment) — it is on the payment too."
          data="refunds-ours"
        >
          {ours === null ? (
            <TemplateFail retryHref="/admin/payments/supplier-refunds">
              Couldn&rsquo;t read our refunds &mdash; that is not the same as none.
            </TemplateFail>
          ) : ours.length === 0 ? (
            <TemplateEmpty>No refund recorded yet. One lands here when it is recorded on a payment.</TemplateEmpty>
          ) : (
            <TemplateRows label="Our refunds">
              {ours.map((r) => (
                <TemplateRow
                  key={r.refundId}
                  title={`Order ${r.orderPublicId ?? '—'} · ${formatPhp(r.amountPhp)}`}
                  line={`${r.refundedAt.slice(0, 10)} · ${r.proofAttached ? 'Proof attached' : 'No proof attached'} · ${r.reason}`}
                  href={r.orderPublicId ? `/admin/payments?filter=all&q=${encodeURIComponent(r.orderPublicId)}` : undefined}
                />
              ))}
            </TemplateRows>
          )}
        </TemplateSection>
      ) : null}

      {waiting !== undefined ? (
        <TemplateSection
          label="Waiting · large refund"
          right={waiting ? String(waiting.length) : '—'}
          tip="A refund over ₱25,000 (Vendor Agreement § 9.1) is not recorded straight away — it waits in Work › Approvals with the reason attached. Nothing has been refunded yet."
          data="refunds-waiting"
        >
          {waiting === null ? (
            <TemplateFail retryHref="/admin/payments/supplier-refunds">
              Couldn&rsquo;t read the waiting refunds &mdash; that is not the same as none.
            </TemplateFail>
          ) : waiting.length === 0 ? (
            <TemplateEmpty>No large refund is waiting.</TemplateEmpty>
          ) : (
            <TemplateRows label="Large refunds waiting">
              {waiting.map((w) => (
                <TemplateRow
                  key={w.approvalId}
                  edge="due"
                  title={`Order ${w.orderPublicId ?? '—'} · ${w.amountPhp === null ? 'amount unread' : formatPhp(w.amountPhp)}`}
                  line={[w.expiresAt ? `expires ${w.expiresAt.slice(0, 10)}` : null, w.reason].filter(Boolean).join(' · ')}
                  href="/admin/approvals"
                />
              ))}
            </TemplateRows>
          )}
        </TemplateSection>
      ) : null}

      <TemplateSection
        label="Supplier refunds"
        first={ours === undefined}
        tip="Money a supplier says they gave back to a client, as they recorded it on that client’s Payment page. A record only — nothing moved through Setnayan, and nothing here can be changed. Setnayan’s own refunds of orders are on Payments."
        data="refunds-suppliers"
      >
        <TemplateNums
          items={[
            standing
              ? { label: 'Refunds standing', value: String(standing.length) }
              : { label: 'Refunds standing · couldn’t read', value: '—', tone: 'warn' },
            total === null
              ? { label: 'Given back · couldn’t read', value: '—', tone: 'warn' }
              : { label: 'Given back', value: <span className={TEMPLATE_MONEY}>{formatPhp(total)}</span> },
          ]}
        />
      </TemplateSection>

      <ConsoleTable
        rows={rows}
        readPermitted
        readError={readError}
        reads="supplier refunds"
        cap={ROW_LIMIT}
        label="Supplier refunds"
        minWidth="40rem"
        rowKey={(r) => r.refund_id}
        empty={{
          Icon: Undo2,
          title: 'No supplier refunds yet',
          blurb: 'A refund lands here when a supplier records one on a client’s Payment page (Clients › event › Payment › Record a refund).',
        }}
        columns={[
          {
            header: 'Given back',
            mono: true,
            cell: (r) => (
              <span className={r.removed_at ? 'text-ink/60 line-through' : 'font-semibold'}>{formatPhp(Number(r.amount_php))}</span>
            ),
          },
          { header: 'On', mono: true, cell: (r) => refundDayWords(r.refunded_on) },
          {
            header: 'Supplier · event',
            cell: (r) => (
              <>
                <p className="text-sm text-ink">{shopName.get(r.vendor_profile_id) ?? (namesUnread ? 'Couldn’t load the supplier' : 'A supplier')}</p>
                <p className="text-xs text-ink/70">{(r.event_id && eventName.get(r.event_id)) || (namesUnread ? 'Couldn’t load the event' : 'Their client’s event')}</p>
              </>
            ),
          },
          { header: 'Why', cell: (r) => <span className="text-sm text-ink">{r.reason}</span> },
          {
            header: 'Proof',
            hideBelow: 'md',
            cell: (r) => <span className="text-xs text-ink/70">{r.proof_r2_key ? 'Photo attached' : 'None attached'}</span>,
          },
          {
            header: 'Status',
            hideBelow: 'md',
            cell: (r) => (
              <span className="text-xs text-ink/70">
                {r.removed_at ? `Removed by the supplier · ${r.removed_at.slice(0, 10)}` : `Recorded ${r.created_at.slice(0, 10)}`}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
