import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loginRedirectPath, getCurrentUser } from '@/lib/auth';
import { receiptOfPayment, type PaymentRow } from '@/lib/deal-end';

/**
 * Every answer this address gives that is NOT the receipt — sign in, or not found — decided here, by the route's
 * `layout.tsx`, BEFORE its `loading.tsx` streams. A boundary commits HTTP 200 before the page body runs, so the same
 * checks in the page would answer a missing receipt with a 200 and a skeleton instead of a 404. Every read below
 * decides "not found", so all of them live here; `cache()` makes it one set per request, the page asks again.
 * 🔒 app/_components/a-route-decides-before-it-streams.test.ts
 */
export const gatePaymentReceipt = cache(async (paymentId: string) => {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath(`/receipts/payment/${paymentId}`));

  const { data: one, error: oneErr } = await supabase
    .from('event_vendor_payments')
    .select('event_id, vendor_id')
    .eq('payment_id', paymentId)
    .maybeSingle();
  if (oneErr) console.error('[payment-receipt] payment read failed', oneErr.message);
  const ids = one as { event_id: string; vendor_id: string } | null;
  if (!ids) notFound();

  const [host, booking, event] = await Promise.all([
    supabase.from('event_members').select('user_id').eq('event_id', ids.event_id).eq('user_id', user.id).eq('member_type', 'couple').maybeSingle(),
    supabase.from('event_vendors').select('marketplace_vendor_id, vendor_name').eq('vendor_id', ids.vendor_id).maybeSingle(),
    supabase.from('events').select('display_name').eq('event_id', ids.event_id).maybeSingle(),
  ]);
  if (host.error) console.error('[payment-receipt] host read failed', host.error.message);
  if (!host.data) notFound();
  const b = booking.data as { marketplace_vendor_id: string | null; vendor_name: string | null } | null;
  const shopId = b?.marketplace_vendor_id ?? null;
  if (booking.error || !shopId) notFound();

  const [payments, quote] = await Promise.all([
    supabase
      .from('event_vendor_payments')
      .select('payment_id, amount_php, paid_at, method, reference, is_deposit_record, vendor_confirmed_at, payment_refused_at')
      .eq('vendor_id', ids.vendor_id)
      .not('vendor_confirmed_at', 'is', null),
    supabase
      .from('vendor_proposals')
      .select('total_centavos')
      .eq('event_id', ids.event_id)
      .eq('vendor_profile_id', shopId)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (payments.error || quote.error) {
    console.error('[payment-receipt] rows read failed', (payments.error ?? quote.error)?.message);
    notFound();
  }
  const agreed = quote.data ? Math.round(Number((quote.data as { total_centavos: number | string }).total_centavos) || 0) : null;
  const receipt = receiptOfPayment({ payments: (payments.data ?? []) as PaymentRow[], paymentId, agreedCentavos: agreed });
  if (!receipt) notFound();
  return { ids, b, event, receipt };
});
