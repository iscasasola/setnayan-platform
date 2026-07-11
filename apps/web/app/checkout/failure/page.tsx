import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

// Payment-failure landing page (Lane C's previously-dangling target — the retired
// Maya seam pointed its failure redirect here; PayMongo Checkout Sessions use
// only success_url + cancel_url, so this is reached only by the dead Maya lane
// and any future rail that distinguishes a hard failure from a cancel). The
// payment did not go through; the order stays pre-paid so the buyer can retry.

export const dynamic = 'force-dynamic';
export const metadata = { title: "Payment didn't go through · Setnayan" };

export default async function CheckoutFailurePage({
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
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 ring-1 ring-rose-200">
        <AlertTriangle aria-hidden className="h-8 w-8 text-rose-700" strokeWidth={2} />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Payment didn&rsquo;t go through</h1>
      <p className="mt-2 max-w-[40ch] text-sm leading-relaxed text-ink/65">
        Something went wrong and the payment wasn&rsquo;t completed — you
        haven&rsquo;t been charged. Please try again, or pay with GCash / BDO
        instead. If it keeps happening, reach out and we&rsquo;ll help.
      </p>
      {ref ? <p className="mt-3 font-mono text-xs text-ink/45">Reference: {ref}</p> : null}
      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        {orderHref ? (
          <Link
            href={orderHref}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-mulberry px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600"
          >
            Try again
          </Link>
        ) : null}
        <Link
          href="/help"
          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-ink/15 bg-cream px-5 py-2.5 text-sm font-medium text-ink/80 transition-colors hover:bg-ink/5"
        >
          Get help
        </Link>
      </div>
    </main>
  );
}
