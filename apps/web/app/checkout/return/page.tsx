import Link from 'next/link';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

// PayMongo success_url landing page (Lane C's previously-dangling target).
//
// ⚠ The browser landing here is NOT proof of payment — the /api/webhooks/paymongo
// `checkout_session.payment.paid` event is the ONLY thing that flips an order to
// paid + unlocks access. So this page is webhook-truth-aware: it reads the order
// by its reference and shows "confirmed" once the webhook has landed, or a calm
// "we're confirming" state during the transient post-redirect window (the webhook
// may arrive a beat after the redirect). It never itself marks anything paid.

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Payment received · Setnayan' };

export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  let orderHref: string | null = null;
  let paid = false;
  if (ref) {
    const supabase = await createClient();
    // RLS scopes this to the buyer's own orders (orders.user_id = auth.uid()).
    const { data: order } = await supabase
      .from('orders')
      .select('order_id, event_id, status')
      .eq('reference_code', ref)
      .maybeSingle();
    if (order) {
      paid = order.status === 'paid' || order.status === 'fulfilled';
      orderHref = order.event_id
        ? `/dashboard/${order.event_id}/orders/${order.order_id}`
        : '/dashboard';
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <div
        className={`mb-5 flex h-16 w-16 items-center justify-center rounded-full ${
          paid ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-amber-50 ring-1 ring-amber-200'
        }`}
      >
        {paid ? (
          <CheckCircle2 aria-hidden className="h-8 w-8 text-emerald-700" strokeWidth={2} />
        ) : (
          <Loader2 aria-hidden className="h-8 w-8 animate-spin text-amber-700" strokeWidth={2} />
        )}
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">
        {paid ? 'Payment confirmed' : 'Payment received'}
      </h1>
      <p className="mt-2 max-w-[38ch] text-sm leading-relaxed text-ink/65">
        {paid
          ? 'Your order is fully paid and your access is live. Salamat!'
          : "Thank you — we're confirming your payment now. This usually takes only a moment; your access unlocks automatically the instant it clears. You can safely close this page."}
      </p>
      {ref ? (
        <p className="mt-3 font-mono text-xs text-ink/45">Reference: {ref}</p>
      ) : null}
      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        {orderHref ? (
          <Link
            href={orderHref}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-mulberry px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600"
          >
            View my order
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
