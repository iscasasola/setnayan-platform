import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveMayaConfig, type MayaConfig } from '@/lib/integration-config';
import { createAdminClient, createMoneyWriterClient } from '@/lib/supabase/admin';
import { paymentRowFor } from '@/lib/order-mint-identity';
import { fetchPayableByReference } from '@/lib/payable-by-reference';
import { notifyAdminsPaymentProofSubmitted } from '@/lib/order-admin-notify';
import { insertFaultLog } from '@/lib/telemetry/fault-log';
import { MAYA_CHANNEL, mayaRailState, type MayaEnvironment, type MayaRailState } from '@/lib/maya-checkout';
import { fetchMayaPayment, fetchMayaPaymentsByReference } from '@/lib/maya-api';

export { createMayaCheckout, registerMayaWebhooks } from '@/lib/maya-api';
import {
  mayaIdempotencyKey,
  type ApproveOutcome,
  type MayaCheckoutRow,
  type MayaSettleDeps,
} from '@/lib/maya-settle';

/**
 * lib/maya-checkout.server.ts — the rail's gate (switch + keys) and the real
 * database wiring for `settleMayaPayment`. The rules live in lib/maya-checkout.ts,
 * the HTTP calls in lib/maya-api.ts, the settle logic in lib/maya-settle.ts.
 *
 * 🔒 BOTH KEYS STAY ON THE SERVER. The "public" key is still a merchant
 * credential (integration-config.ts says so) — nothing here returns one.
 */

type FetchLike = typeof fetch;

/** The rail's switch, read fail-CLOSED: an unreadable switch is OFF (BDO stays as it is). */
export async function readMayaSwitch(client: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await client
      .from('platform_settings')
      .select('maya_checkout_enabled')
      .eq('id', 1)
      .maybeSingle();
    if (error) {
      // Fail CLOSED (BDO stays as it is), but never silently: a refused read is a different fact from "off".
      console.error('[maya] switch read refused — the rail reads as off', error.message);
      return false;
    }
    return (data as { maya_checkout_enabled?: boolean | null } | null)?.maya_checkout_enabled === true;
  } catch (e) {
    console.error('[maya] switch read threw — the rail reads as off', e instanceof Error ? e.message : e);
    return false;
  }
}

/** Switch + keys → is the rail open, and if not, why. */
export async function readMayaGate(): Promise<{ state: MayaRailState; config: MayaConfig; enabled: boolean }> {
  const [enabled, config] = await Promise.all([readMayaSwitch(createAdminClient()), resolveMayaConfig()]);
  return { state: mayaRailState({ enabled, publicKey: config.publicKey, secretKey: config.secretKey }), config, enabled };
}

const CHECKOUT_COLS =
  'checkout_id, order_id, user_id, request_reference_number, amount_php, environment, status, maya_payment_id, payment_id';

/** Record a checkout we just created, so the webhook and the return can find its order. */
export async function recordMayaCheckout(row: {
  checkoutId: string;
  orderId: string;
  userId: string;
  reference: string;
  amountPhp: number;
  environment: MayaEnvironment;
}): Promise<boolean> {
  const { error } = await createMoneyWriterClient().from('maya_checkouts').insert({
    checkout_id: row.checkoutId,
    order_id: row.orderId,
    user_id: row.userId,
    request_reference_number: row.reference,
    amount_php: Math.round(row.amountPhp * 100) / 100,
    environment: row.environment,
  });
  if (error) {
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Maya checkout — record the checkout',
      file_path: 'lib/maya-checkout.server.ts',
      error_message: error.message,
      payload_snapshot: { orderId: row.orderId },
    });
    return false;
  }
  return true;
}

/**
 * The real `MayaSettleDeps`. `approve` is handed in by the caller (the webhook
 * route and the pay page import `approvePaymentCore` from the admin payments
 * actions — a lib module does not reach into app/).
 */
export function mayaSettleDeps(
  config: MayaConfig,
  approve: (args: { paymentId: string; buyerUserId: string; note: string }) => Promise<ApproveOutcome>,
  fetchImpl: FetchLike = fetch,
): MayaSettleDeps {
  const admin = createAdminClient();
  const money = createMoneyWriterClient();
  return {
    async findCheckout(hint) {
      const tries: Array<[string, string]> = [];
      if (hint.checkoutId) tries.push(['checkout_id', hint.checkoutId]);
      if (hint.mayaPaymentId) tries.push(['maya_payment_id', hint.mayaPaymentId]);
      for (const [col, val] of tries) {
        const { data, error } = await admin.from('maya_checkouts').select(CHECKOUT_COLS).eq(col, val).maybeSingle();
        if (error) return 'error';
        if (data) return data as unknown as MayaCheckoutRow;
      }
      if (hint.reference) {
        const { data, error } = await admin
          .from('maya_checkouts')
          .select(CHECKOUT_COLS)
          .eq('request_reference_number', hint.reference.toUpperCase())
          .order('created_at', { ascending: false })
          .limit(1);
        if (error) return 'error';
        return ((data ?? [])[0] as unknown as MayaCheckoutRow | undefined) ?? null;
      }
      return null;
    },
    async owedNow(reference) {
      // The SAME resolver the pay page reads, on the service client: one
      // authority on what an order is owed (`orderGrossOwed` inside it).
      const payable = await fetchPayableByReference(admin, reference).catch(() => 'error' as const);
      if (payable === 'error') return 'error';
      if (!payable) return null;
      // A supplier plan switches on through `approve_vendor_subscription`, which
      // needs an admin's OWN session (lib/sku-activation.ts) — a gateway has
      // none, so the plan would be paid and stay off. Those wait for a press.
      return { amountPhp: payable.amountPhp, status: payable.status, needsAdminToActivate: payable.isVendorPlan };
    },
    verifyById: (id) => fetchMayaPayment(config, id, fetchImpl),
    verifyByReference: (ref) => fetchMayaPaymentsByReference(config, ref, fetchImpl),
    async upsertPayment({ orderId, userId, amountPhp, mayaPaymentId, note }) {
      const key = mayaIdempotencyKey(mayaPaymentId);
      const { data, error } = await money
        .from('payments')
        .insert(
          paymentRowFor(
            { userId, verifiedOrderId: orderId },
            {
              amount_php: Math.round(amountPhp * 100) / 100,
              channel: MAYA_CHANNEL,
              reference_number: mayaPaymentId.slice(0, 64),
              paid_at: new Date().toISOString().slice(0, 10),
              admin_notes: note.slice(0, 500),
              client_idempotency_key: key,
            },
          ),
        )
        .select('payment_id, status')
        .maybeSingle();
      if (!error && data) {
        const inserted = data as { payment_id: string; status: string };
        // The bill's empty placeholder gives way to the real payment — the same
        // sweep the proof form runs (app/pay/[reference]/actions.ts).
        const { error: sweepError } = await money
          .from('payments')
          .delete()
          .eq('order_id', orderId)
          .eq('status', 'pending')
          .is('reference_number', null)
          .is('screenshot_url', null)
          .neq('payment_id', inserted.payment_id);
        if (sweepError) console.error('[maya] placeholder payment row was not removed', { orderId, sweepError: sweepError.message });
        return { paymentId: inserted.payment_id, status: inserted.status };
      }
      if ((error as { code?: string } | null)?.code === '23505') {
        const { data: prior, error: readErr } = await admin
          .from('payments')
          .select('payment_id, status')
          .eq('order_id', orderId)
          .eq('client_idempotency_key', key)
          .maybeSingle();
        if (readErr || !prior) return 'error';
        const p = prior as { payment_id: string; status: string };
        return { paymentId: p.payment_id, status: p.status };
      }
      await insertFaultLog({
        event_type: 'SUPABASE_SAVE_ERROR',
        element_name: 'Maya checkout — log the payment',
        file_path: 'lib/maya-checkout.server.ts',
        error_message: error?.message ?? 'no row returned',
        payload_snapshot: { orderId, mayaPaymentId },
      });
      return 'error';
    },
    async updateCheckout(checkoutId, patch) {
      const { error } = await money
        .from('maya_checkouts')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('checkout_id', checkoutId);
      if (error) console.error('[maya] checkout row update failed (non-fatal)', { checkoutId, error: error.message });
    },
    approve,
    async notifyAdmins({ orderId, amountPhp }) {
      await notifyAdminsPaymentProofSubmitted({ orderId, eventId: '', amountPhp, channel: MAYA_CHANNEL });
    },
  };
}
