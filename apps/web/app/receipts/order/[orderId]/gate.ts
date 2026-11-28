import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loginRedirectPath, getCurrentUser } from '@/lib/auth';
import { fetchOrderById } from '@/lib/orders';
import { fetchReceiptByOrderId } from '@/lib/receipts';

/**
 * Every answer this address gives that is NOT the slip — sign in, not found, "this order has a receipt now" — decided
 * here, by the route's `layout.tsx`, BEFORE its `loading.tsx` streams. A boundary commits HTTP 200 before the page body
 * runs, so the same check in the page would send a skeleton and then a client hop instead of a 307 or a 404.
 * `cache()` makes it one set of reads per request: the page asks again and gets the same answer.
 * 🔒 app/_components/a-route-decides-before-it-streams.test.ts
 */
export const gateOrderSlip = cache(async (orderId: string) => {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath(`/receipts/order/${orderId}`));

  const order = await fetchOrderById(supabase, orderId);
  if (!order || order.user_id !== user.id || order.status === 'draft') notFound();
  const receipt = await fetchReceiptByOrderId(supabase, orderId);
  if (receipt) redirect(`/receipts/${receipt.receipt_id}`);
  return { supabase, user, order };
});
