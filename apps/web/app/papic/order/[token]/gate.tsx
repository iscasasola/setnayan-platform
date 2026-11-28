import 'server-only';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { papicGuestBuyEnabled } from '@/lib/papic-guest-buy-flag';

/**
 * Every "not found" a guest's order link gives — the switch off, a bad token, an order row gone — decided by
 * `./layout.tsx` BEFORE `./loading.tsx` streams, so the 404 is never sent as a 200, a skeleton and a client hop. A
 * REFUSED read is not a 404: it draws "We couldn't open this order" (200), in the layout and the page alike.
 * `cache()`: one set of reads per request; the page asks again and gets the same answer.
 * 🔒 app/_components/a-route-decides-before-it-streams.test.ts
 */
export const gatePapicOrder = cache(async (token: string) => {
  if (!papicGuestBuyEnabled()) notFound();

  const admin = createAdminClient();
  // Same distinction as the shared-quote page: no row + no error is a genuine
  // "no such order" (correct 404); an ERROR answered with 404 tells a guest
  // holding a valid link that their order does not exist.
  const { data: row, error: orderError } = await admin
    .from('papic_guest_orders')
    .select(
      'order_id, purchase_kind, points, payer_name, ' +
        'order:orders(public_id, reference_code, description, requested_total_php, status)',
    )
    .eq('access_token', token)
    .maybeSingle();
  if (orderError) {
    console.error('[papic/order] order read refused', orderError);
    return { refused: true as const };
  }
  if (!row) notFound();

  const order = (row as {
    order?: {
      public_id?: string | null;
      reference_code?: string | null;
      description?: string | null;
      requested_total_php?: number | null;
      status?: string | null;
    } | null;
  }).order;
  if (!order) notFound();
  return { refused: false as const, admin, row, order };
});

/** A refused read — never the 404: a guest holding a valid link must not be told their order does not exist. */
export function PapicOrderUnreadable() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-ink">We couldn&rsquo;t open this order</h1>
      <p className="mt-3 text-sm text-ink/70">
        Something went wrong reading it — your order has <strong>not</strong> been
        cancelled and your link is still good. Please reload in a moment.
      </p>
    </main>
  );
}
