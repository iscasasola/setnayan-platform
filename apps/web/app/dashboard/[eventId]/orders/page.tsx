import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, Receipt } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  fetchOrdersForEvent,
  formatPhp,
} from '@/lib/orders';
import { computeVatFromBase } from '@/lib/receipts';

export const metadata = { title: 'Orders' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    created?: string;
    cancelled?: string;
    paid_logged?: string;
    self_comp?: string;
  }>;
};

export default async function CoupleOrdersPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const orders = await fetchOrdersForEvent(supabase, eventId);

  const flash =
    search.self_comp === '1'
      ? 'Self-comp order created and marked paid. The grant is audit-logged for the admin team.'
      : search.created === '1'
        ? 'Order created. Pay the amount below and log the payment so the Setnayan team can match it.'
        : search.cancelled === '1'
          ? 'Order cancelled.'
          : null;

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Orders</h1>
          <p className="max-w-prose text-base text-ink/65">
            Apply for any Setnayan service — describe what you need, propose your budget. Our
            team confirms the price, then you pay via bank transfer or GCash and log the
            receipt here. We reconcile within one business day.
          </p>
        </div>
        <Link
          href={`/dashboard/${eventId}/orders/new`}
          className="button-primary inline-flex items-center gap-2"
        >
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
          New order
        </Link>
      </header>

      {flash ? (
        <p
          role="status"
          className="rounded-md border border-success-300/60 bg-success-50 px-4 py-3 text-sm text-success-800"
        >
          {flash}
        </p>
      ) : null}

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center">
          <Receipt aria-hidden className="mx-auto mb-2 h-6 w-6 text-ink/30" strokeWidth={1.5} />
          <p className="text-sm text-ink/55">
            No orders yet. Use <span className="font-medium text-ink">New order</span> above
            to request a custom quote.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.order_id}>
              <Link
                href={`/dashboard/${eventId}/orders/${o.order_id}`}
                className="group flex flex-col gap-2 rounded-xl border border-ink/10 bg-cream p-4 transition-colors hover:border-terracotta/40 hover:bg-terracotta/5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="line-clamp-1 text-sm font-semibold text-ink">
                    {o.description}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                    {o.public_id} · {o.reference_code}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-sm text-ink">
                    {formatPhp(
                      computeVatFromBase(
                        Number(o.confirmed_total_php ?? o.requested_total_php),
                      ).gross,
                    )}
                    <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                      incl. VAT
                    </span>
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
                      ORDER_STATUS_TONE[o.status]
                    }`}
                  >
                    {ORDER_STATUS_LABEL[o.status]}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
