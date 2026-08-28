'use server';

/**
 * /vendor-dashboard/subscription · server action — start a subscription order.
 *
 * Phase D (Vendor Tier #5). Vendors self-serve upgrade to Pro / Enterprise via
 * apply-then-pay, CLONED from the token-pack purchase flow (tokens/actions.ts).
 *
 * FLOW (apply-then-pay · manual reconcile)
 *   1. Vendor picks a tier + cycle → this action calls
 *      `create_vendor_subscription(p_sku_code)` (migration 20261010000000). The
 *      DB function reads price + tier + cycle + period from vendor_billing_
 *      catalog (NEVER a client-supplied amount), mints a 'SUB-xxxxxxxx'
 *      reference, and inserts a pending_payment row.
 *   2. Vendor pays the pesos externally (BDO / GCash · accounts from
 *      platform_settings) putting the reference code in the note.
 *   3. Admin confirms at /admin/subscriptions → `approve_vendor_subscription(id)`
 *      sets tier_state + tier_expires_at + grants the token bundle (idempotent
 *      per purchase). Same RPC a future Maya / PayMongo webhook hits via
 *      confirm_vendor_subscription_by_reference — automating later is a webhook
 *      handler, not a rebuild.
 *
 * Runs as the vendor's own user (no admin client); the DB function is
 * SECURITY DEFINER and resolves the vendor from auth.uid().
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createMoneyWriterClient } from '@/lib/supabase/admin';
import { orderRowFor } from '@/lib/order-mint-identity';
import { vendorSubscriptionServiceKey } from '@/lib/vendor-subscription-service-key';
import { notifyAdminsSubscriptionPending } from '@/lib/subscription-purchase-notify';
import { termTooShortMessage } from '@/lib/vendor-plan-change-words';

const ERR = (msg: string) =>
  redirect('/vendor-dashboard/subscription?error=' + encodeURIComponent(msg));

/**
 * Begin a subscription order. Form fields:
 *   • sku_code — a vendor_billing_catalog subscription sku_code
 *     (pro_vendor_monthly / pro_vendor_annual / enterprise_vendor_monthly /
 *      enterprise_vendor_annual).
 * The optional `addon_token_pack_sku` field is GONE (2026-08-07, token
 * retirement) — the checkout no longer offers a pack, and nothing credits one.
 * ⚠ `p_addon_token_pack_sku` is still PASSED to the RPC as an explicit null:
 * PostgREST resolves a function by its exact set of NAMED arguments, so
 * dropping the key would stop matching `create_vendor_subscription` and every
 * plan purchase would fail — rejected, not thrown, which is silent.
 *
 * On success: redirect to /vendor-dashboard/subscription?ordered=<reference_code>
 * so the page shows the payment-instructions panel for the new order.
 */
export async function startSubscriptionPurchase(formData: FormData): Promise<void> {
  const sku = formData.get('sku_code');
  if (typeof sku !== 'string' || sku.trim().length === 0) {
    ERR('Pick a plan to continue.');
  }
  const skuCode = (sku as string).trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase.rpc('create_vendor_subscription', {
    p_sku_code: skuCode,
    // Always null — see the docblock. The key must stay for RPC resolution.
    p_addon_token_pack_sku: null,
  });

  if (error) {
    const m = error.message?.toUpperCase() ?? '';
    if (m.includes('NOT_VERIFIED')) {
      ERR('Verify your shop before subscribing. Once your verification is approved you can upgrade your plan.');
    }
    if (m.includes('NOT_VENDOR_ADMIN')) {
      ERR('Only a store admin can purchase a subscription. Ask an admin on your team to upgrade.');
    }
    if (m.includes('NO_VENDOR_PROFILE')) {
      ERR('Sign in with your vendor account to upgrade.');
    }
    if (m.includes('INVALID_PACK')) {
      ERR('That token add-on is no longer available. Refresh and try again.');
    }
    if (m.includes('INVALID_SKU') || m.includes('UNMAPPED_SKU_TIER')) {
      ERR('That plan is no longer available. Refresh and try again.');
    }
    // A purchase may never be shorter than the time the shop already holds
    // (owner 2026-08-27). The picker disables the too-short option, so this is
    // the backstop for a stale page or a hand-posted form — but it is the SERVER
    // that decides, and a shop that gets here still reads a sentence naming the
    // day they are paid up to, never a raw code.
    //
    // ⚠ The date is read off the ORIGINAL message, not the upper-cased copy: the
    // `m` above is `.toUpperCase()`, which is fine for matching a code and wrong
    // for extracting anything.
    if (m.includes('TERM_TOO_SHORT')) {
      const day = /(\d{4}-\d{2}-\d{2})/.exec(error.message ?? '')?.[1] ?? null;
      ERR(termTooShortMessage(day));
    }
    // Only one plan change may be waiting to be paid at a time. Two open changes
    // could each be quoted against the same money the shop is holding, and each
    // be honoured — so the second is refused here rather than the balance being
    // reserved at order time and then having to be given back.
    if (m.includes('ONE_PLAN_CHANGE_PENDING')) {
      ERR(
        'You already have a plan change waiting to be paid. Pay that one first, ' +
          'or switch back to your current plan, then you can start another.',
      );
    }
    ERR("We couldn't start that upgrade right now. Please try again.");
  }

  // RPC returns the inserted vendor_subscriptions row (SETOF → first row).
  const row = Array.isArray(data) ? data[0] : data;
  const ref: string | null =
    row && typeof row.reference_code === 'string' ? row.reference_code : null;
  const purchaseId: string | null =
    row && typeof row.purchase_id === 'string' ? row.purchase_id : null;

  // ── The order row that gives this purchase somewhere to send proof ────────
  // Until 2026-08-21 a plan purchase wrote a `vendor_subscriptions` row and
  // NOTHING else. `payments.order_id` is NOT NULL, so there was no row a
  // screenshot or a reference number could attach to — the shop paid and then
  // had to hope somebody noticed. Every OTHER vendor purchase (extra seat,
  // branch, deep search, booking fee) already mints this exact shape; the
  // subscription was the one that did not.
  //
  // AUTHORIZATION: none of it comes from the form. `create_vendor_subscription`
  // is SECURITY DEFINER, resolves the vendor from `auth.uid()`, refuses a
  // non-admin of that shop (NOT_VENDOR_ADMIN) and an unverified shop
  // (NOT_VERIFIED), and prices the row from `vendor_billing_catalog` — so by
  // the time we are here the purchase EXISTS and is theirs. We mirror its own
  // amount and reference; `orderRowFor` stamps the identity columns.
  //
  // Fail-soft on purpose: the money row is already minted and the admin can
  // still confirm it at /admin/subscriptions. Losing the order row costs the
  // nicer payment page, and that is never a reason to strand a purchase that
  // already exists.
  const vendorId: string | null =
    row && typeof row.vendor_id === 'string' ? row.vendor_id : null;
  // The words the shop just picked. Read from the catalog, not from the RPC's
  // row — `vendor_subscriptions` stores the sku_code and no title at all, so a
  // `row.title` lookup here would silently always miss and every plan would
  // render as "Your Setnayan order".
  const { data: catalogRow } = await supabase
    .from('vendor_billing_catalog')
    .select('title')
    .eq('sku_code', skuCode)
    .maybeSingle();
  // 🔑 THE PRORATED FIGURE IS THE ORDER'S FIGURE. `amount_php` is what the RPC
  // decided the shop owes — list price minus whatever credit it applied — and it
  // is mirrored straight into `requested_total_php` below. That matters because
  // reconciliation compares a payment against THE ORDER'S OWN amount and never
  // re-derives a list price from the catalog: if the order carried the list
  // price instead, every prorated plan change would arrive looking like a short
  // payment and be refused. Nothing here may substitute a catalog price for it.
  const amountPhp = Number(row?.amount_php ?? 0);

  // ── NOTHING LEFT TO PAY ───────────────────────────────────────────────────
  // When the shop's own credit covers the whole bill, the database applies the
  // change on the spot and hands back a row that is already `paid`. There is no
  // money to reconcile, so there must be no order, no admin alert, and above all
  // no payment-instructions screen: sending somebody to pay ₱0 with a reference
  // number reads as a broken product.
  const alreadyPaid =
    row && typeof row.status === 'string' && row.status === 'paid';
  if (alreadyPaid) {
    revalidatePath('/vendor-dashboard/subscription');
    revalidatePath('/vendor-dashboard');
    redirect('/vendor-dashboard/subscription?applied=1');
  }

  let payPath: string | null = null;
  if (purchaseId && ref && vendorId && Number.isFinite(amountPhp) && amountPhp > 0) {
    try {
      const { error: orderError } = await createMoneyWriterClient()
        .from('orders')
        .insert(
          orderRowFor(
            { userId: user.id, eventId: null, vendorProfileId: vendorId },
            {
              service_key: vendorSubscriptionServiceKey(purchaseId),
              description: planDescription(skuCode, catalogRow),
              requested_total_php: amountPhp,
              status: 'awaiting_payment',
              reference_code: ref,
            },
          ),
        );
      if (!orderError) payPath = '/pay/' + encodeURIComponent(ref);
    } catch {
      /* keep payPath null — see above */
    }
  }

  // Alert admins there's a payment to watch for (fail-soft — never blocks the
  // vendor's redirect to the payment instructions).
  if (purchaseId) {
    await notifyAdminsSubscriptionPending(purchaseId);
  }

  revalidatePath('/vendor-dashboard/subscription');
  // The shared payment page when we have one, otherwise exactly what shipped
  // before — the plan screen's own instructions panel.
  redirect(payPath ?? '/vendor-dashboard/subscription?ordered=' + encodeURIComponent(ref ?? ''));
}

/**
 * Call off a scheduled plan change — the inverse of starting one.
 *
 * 🔑 A FORWARD PRIMITIVE WITH NO INVERSE TRAPS PEOPLE. A shop that schedules a
 * move down and then changes its mind must be able to say so; without this the
 * only way back would be an admin doing it for them, which nothing tells them
 * to ask for.
 *
 * What they paid is NOT lost. `cancel_vendor_plan_change` moves it onto their
 * account as money waiting for the next bill, because it is money they have
 * already handed over and a change of mind is not a reason to keep it.
 *
 * The shop is resolved inside the RPC from `auth.uid()` — nothing about which
 * shop this touches comes from the form.
 */
export async function cancelScheduledPlanChange(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.rpc('cancel_vendor_plan_change');
  if (error) {
    const m = error.message?.toUpperCase() ?? '';
    if (m.includes('NOT_VENDOR_ADMIN')) {
      ERR('Only a store admin can change the plan. Ask an admin on your team.');
    }
    ERR("We couldn't undo that just now. Please try again.");
  }

  revalidatePath('/vendor-dashboard/subscription');
  revalidatePath('/vendor-dashboard');
  redirect('/vendor-dashboard/subscription?kept=1');
}

/**
 * What the shop sees at the top of the payment page. The catalog title is the
 * words they just picked, so prefer it; the sku_code is a fallback that at
 * least names the right thing rather than reading "Your Setnayan order".
 */
function planDescription(skuCode: string, catalogRow: { title?: unknown } | null): string {
  const title =
    catalogRow && typeof catalogRow.title === 'string' ? catalogRow.title.trim() : '';
  if (title.length > 0) return title;
  return 'Setnayan plan — ' + skuCode.replace(/_/g, ' ');
}
