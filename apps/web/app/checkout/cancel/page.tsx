import Link from 'next/link';
import { XCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

// PayMongo cancel_url landing page (Lane C's previously-dangling target). The
// buyer backed out of the hosted checkout — nothing was charged. The order stays
// in its pre-paid state, so they can pay again (online or via the manual rails).

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Checkout canceled · Setnayan' };

export default async function CheckoutCancelPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  let orderHref: string | null = null;
  if (ref) {
    const supabase = await createClient();
    const { data: order } = await supabase
      .from('orders')
      .select('order_id, event_id')
      .eq('reference_code', ref)
      .maybeSingle();
    if (order) {
      orderHref = order.event_id
        ? `/dashboard/${order.event_id}/orders/${order.order_id}`
        : '/dashboard';
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-ink/5 ring-1 ring-ink/10">
        <XCircle aria-hidden className="h-8 w-8 text-ink/50" strokeWidth={2} />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Checkout canceled</h1>
      <p className="mt-2 max-w-[40ch] text-sm leading-relaxed text-ink/65">
        No worries — nothing was charged. Your order is still waiting whenever
        you&rsquo;re ready. You can pay online again, or use GCash / BDO instead.
      </p>
      {ref ? <p className="mt-3 font-mono text-xs text-ink/45">Reference: {ref}</p> : null}
      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        {orderHref ? (
          <Link
            href={orderHref}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-mulberry px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600"
          >
            Finish paying
          </Link>
        ) : null}
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-ink/15 bg-cream px-5 py-2.5 text-sm font-medium text-ink/80 transition-colors hover:bg-ink/5"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
