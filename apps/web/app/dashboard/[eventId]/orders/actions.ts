'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { uploadPublicAsset } from '@/lib/storage';
import { insertFaultLog } from '@/lib/telemetry/fault-log';
import { coordinatorMoneyScopeAllowed } from '@/lib/coordinator-money-scope';
import { paymentRowFor } from '@/lib/order-mint-identity';

function nullIfBlank(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

/**
 * ⛔ `createOrder` — DELETED 2026-07-26 (SEC-4).
 *
 * It read the charge straight off the submitted form:
 *
 *     const requestedRaw = formData.get('requested_total_php');
 *     …
 *     requested_total_php: Math.round(Number(requestedRaw) * 100) / 100
 *
 * No catalog resolve, no `resolveServiceSellability` gate, no floor — so an
 * authenticated member of any event could mint an order for ANY `service_key`
 * at ANY amount (₱1 against a ₱2,999 SKU), pay that amount for real, and hand
 * the admin reconciliation queue a receipt that matches. The correct path,
 * `submitOrderAction` (../checkout/actions.ts), re-resolves the amount
 * server-side from `platform_retail_catalog_v2` and REJECTS a retired SKU
 * BEFORE any charge resolver runs. That order matters: a null resolve falls
 * back to the client price, so filtering inside the resolver would downgrade
 * "charged its real price" into "charged whatever the browser sent".
 *
 * WHY DELETED RATHER THAN REPAIRED — it had zero callers. Its UI entry point
 * `/orders/new` has been a bare `redirect()` since 2026-05-29, the
 * `SelfPurchaseConfirm` component that fed it `self_purchase_action` was
 * orphaned by the same change (deleted here too), and nothing in app / lib /
 * api / tests / scripts imported it. But a `'use server'` export stays
 * POST-able by its action id whether or not any UI references it — this module
 * reaches the client graph through `cancelOrder` + `logPayment` — so "no UI"
 * was never "no attack surface". Deleting the export deletes the surface.
 *
 * IF SELF-COMP COMES BACK (spec § 3.1a · vendor "comp for myself"), re-add it
 * on the `submitOrderAction` path, never here. The authority rule survives —
 * pure and tested — in `lib/self-comp-authority.ts` (`decideSelfCompAuthority`:
 * vendor owner/admin AND couple member of the target event), as does the
 * per-quarter `enforce_vendor_self_comp_quota` trigger on `comp_grants`. What
 * must not come back is a SECOND pricing rule.
 *
 * NOT AFFECTED — `app/admin/custom-plans/actions.ts` mints bespoke-amount
 * orders on purpose: it is `assertAdmin()`-gated and writes through
 * service-role. "An admin sets a negotiated price" is a different thing from
 * "the browser sets its own price"; only the second one is this bug.
 *
 * Enforced by `lib/order-price-authority.test.ts`.
 */

export async function cancelOrder(formData: FormData) {
  const eventId = formData.get('event_id');
  const orderId = formData.get('order_id');
  if (typeof eventId !== 'string' || typeof orderId !== 'string') {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .eq('user_id', user.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/orders/${orderId}`);
  redirect(`/dashboard/${eventId}/orders?cancelled=1`);
}

export async function logPayment(formData: FormData) {
  const eventId = formData.get('event_id');
  const orderId = formData.get('order_id');
  const amountRaw = formData.get('amount_php');
  const channel = formData.get('channel');
  const paidAtRaw = formData.get('paid_at');

  if (
    typeof eventId !== 'string' ||
    typeof orderId !== 'string' ||
    typeof channel !== 'string'
  ) {
    throw new Error('Invalid input');
  }
  if (typeof amountRaw !== 'string') throw new Error('Amount required');
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be > 0');
  }
  const trimmedChannel = channel.trim();
  if (trimmedChannel.length === 0) throw new Error('Channel required');

  const paidAt =
    typeof paidAtRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(paidAtRaw)
      ? paidAtRaw
      : new Date().toISOString().slice(0, 10);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Ownership guard (money bug-hunt 2026-06-26, #11): only log a payment against
  // an order you're actually allowed to see. RLS (orders_owner_read) scopes this
  // read to your own orders + your events' orders; a foreign order_id returns
  // null → reject. Without this, the payments INSERT (whose RLS only checks
  // payments.user_id = auth.uid()) let a user pin a payment row onto a
  // stranger's order and pollute their reconciliation/order totals.
  const { data: ownedOrder } = await supabase
    .from('orders')
    .select('order_id, event_id')
    .eq('order_id', orderId)
    .maybeSingle();
  if (!ownedOrder || ownedOrder.event_id !== eventId) {
    throw new Error('Order not found for this event');
  }

  // Consent-scoped coordinator payment handling (owner 2026-07-19 #5). The
  // orders SELECT above is satisfied by ANY event member (migration
  // 20270129279924 widened the read to all members), so a coordinator could
  // attach payment proof to the couple's orders. Behind
  // NEXT_PUBLIC_COORDINATOR_CONSENT_GATE_ENABLED, a non-couple member may log
  // a payment only when the couple granted the 'checkout' scope at invite
  // time (coordinator_access_consents.scopes). Flag OFF = exact current
  // behavior (helper returns true without reading).
  const moneyWriter = createAdminClient();
  const checkoutAllowed = await coordinatorMoneyScopeAllowed(
    moneyWriter,
    eventId,
    user.id,
    'checkout',
  );
  if (!checkoutAllowed) {
    throw new Error(
      'The couple has not approved payment handling for your coordinator access — ask them to re-invite you with payment permission.',
    );
  }

  // Optional screenshot — TWO supported shapes:
  //
  //   (1) New flow (preferred): `<FileUpload name="screenshot_ref">` uploads
  //       direct-to-R2 client-side and emits an `r2://bucket/key` hidden
  //       input. We store that ref verbatim in `screenshot_url`.
  //
  //   (2) Legacy flow: a `<input type="file" name="screenshot">` for forms
  //       that haven't been migrated yet (or admin tooling that pre-dates
  //       the new component). We pipe the file through `uploadPublicAsset`
  //       the same way the old code did and store the resulting public URL.
  //
  // (1) takes precedence — if both are present we trust the explicit ref.
  let screenshotUrl: string | null = null;
  const screenshotRefRaw = formData.get('screenshot_ref');
  if (
    typeof screenshotRefRaw === 'string' &&
    screenshotRefRaw.trim().startsWith('r2://')
  ) {
    screenshotUrl = screenshotRefRaw.trim();
  } else {
    const screenshotFile = formData.get('screenshot');
    if (screenshotFile instanceof File && screenshotFile.size > 0) {
      const result = await uploadPublicAsset({
        pathPrefix: `payment-screenshots/${orderId}`,
        file: screenshotFile,
      });
      if (!result.ok) {
        return redirect(
          `/dashboard/${eventId}/orders/${orderId}?error=${encodeURIComponent(result.error)}`,
        );
      }
      screenshotUrl = result.publicUrl;
    }
  }

  // Task 8 pilot hardening (2026-06-01): client-supplied idempotency key
  // deduplicates double-submits during pilot. The new-payment form mints
  // a UUID once on first render and ships it as a hidden input on every
  // retry; the (order_id, client_idempotency_key) partial unique index
  // turns the second insert into a 23505 unique-violation we catch and
  // treat as "already logged."
  const idempotencyKeyRaw = formData.get('client_idempotency_key');
  const idempotencyKey =
    typeof idempotencyKeyRaw === 'string' && idempotencyKeyRaw.trim().length > 0
      ? idempotencyKeyRaw.trim().slice(0, 64)
      : null;

  // ── SEC-4b · service-role write, ownership already proven above ────────────
  // `payments` INSERT is revoked from `authenticated` (migration
  // 20271008178212), so this goes through service_role — which bypasses
  // `payments_owner_insert`'s `WITH CHECK (user_id = auth.uid())`.
  //
  // Nothing about the AUTHORIZATION changes: the guards that matter are the two
  // above, and both stay on the SESSION client precisely so RLS keeps scoping
  // them — the `orders` SELECT (RLS `orders_owner_read` limits it to the
  // caller's own orders / their events' orders, and a foreign order_id comes
  // back null → reject) plus the event_id match and the coordinator 'checkout'
  // consent scope. `paymentRowFor` then re-binds the row to that proven order
  // and to the server's user id, replacing what RLS used to enforce.
  const { error } = await moneyWriter.from('payments').insert(
    paymentRowFor(
      { userId: user.id, verifiedOrderId: ownedOrder.order_id as string },
      {
        amount_php: Math.round(amount * 100) / 100,
        channel: trimmedChannel,
        reference_number: nullIfBlank(formData.get('reference_number')),
        screenshot_url: screenshotUrl,
        paid_at: paidAt,
        client_idempotency_key: idempotencyKey,
      },
    ),
  );
  if (error) {
    // 23505 = unique_violation. With a non-null idempotency key this means
    // the customer's previous submit succeeded and they retried; treat as
    // success and route them to the order detail page so they see the
    // already-logged payment.
    const code = (error as { code?: string }).code;
    if (code === '23505' && idempotencyKey) {
      revalidatePath(`/dashboard/${eventId}/orders/${orderId}`);
      redirect(`/dashboard/${eventId}/orders/${orderId}?paid_logged=1`);
    }
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Log payment (proof submission)',
      file_path: 'app/dashboard/[eventId]/orders/actions.ts',
      error_message: error.message,
      payload_snapshot: { eventId, orderId, userId: user.id, hasIdempotencyKey: idempotencyKey !== null },
    });
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/${eventId}/orders/${orderId}`);
  redirect(`/dashboard/${eventId}/orders/${orderId}?paid_logged=1`);
}
