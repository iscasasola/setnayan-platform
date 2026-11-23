'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, createMoneyWriterClient } from '@/lib/supabase/admin';
import { orderRowFor, paymentRowFor } from '@/lib/order-mint-identity';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRoleForProfile, canManageVendor } from '@/lib/vendor-role';
import { payPath } from '@/lib/pay-path';
import { railForNewOrder } from '@/lib/rail-for-new-order';
import { PAYMENTS_PAUSED_MESSAGE } from '@/lib/payment-channels';
import { logQueryError } from '@/lib/supabase/error-detect';
import { routes } from '@/lib/routes';
import {
  cleanLayoutRow,
  isLayoutRow,
  isPaidStoreTool,
  layoutColumn,
  storeToolOf,
  storeToolSku,
  toolStatus,
  withLayoutRow,
  type LayoutRow,
  type PaidStoreTool,
} from '@/lib/supplier-store';
import { readStoreLayout, readStoreToolFacts } from '@/lib/supplier-store.server';

/**
 * 🛍 THE STORE'S ONE SERVER ACTION (owner 23 Nov 2026; drawing specs `prototypes/supplier_store_graphs_badges_2026-11-23/`).
 *
 * ONE export on purpose: every exported action is one Vercel route and the budget sits at its ceiling
 * (`scripts/lint-server-action-budget.mjs`); the slot was freed by folding the Suggested coverage pair into one.
 *
 *   op=layout        ONE row of the Shop set at once — `row` (graphs · badges · tools), its keys in the new order
 *                    (repeated `key`), and for tools the paid ones taken off (repeated `off`). Add ([+] → Store: the
 *                    list + the new key), remove (the list without it) and reorder (the Edit sheet's Done) are all
 *                    this one write → vendor_profiles.store_layout. `intent` (add · remove · order) only picks the toast.
 *   op=buy           a PAID tool, once: apply-then-pay — a 'submitted' order + a pending payment, then the one pay page.
 *                    The price is the `vendor_billing_catalog` row `vendor_tool_<tool>`; the form sends the tool and the
 *                    pay channel only, never a price. Approval needs no hook: the paid order IS the ownership
 *                    (`vendor_store_tool_open`), so a refund takes it back on its own.
 *
 * Who: the shop's owner or an admin of it (`canManageVendor`) — an agent or a viewer cannot change the Shop or buy.
 */

export type StoreActionState = { status: 'idle' } | { status: 'ok'; message: string } | { status: 'error'; message: string };

const err = (message: string): StoreActionState => ({ status: 'error', message });
const ok = (message: string): StoreActionState => ({ status: 'ok', message });

const SHOP = routes.vendorDashboard.shop.index();

function generateReferenceCode(): string {
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  return (
    'SN' +
    Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function revalidateStore() {
  revalidatePath(SHOP);
  revalidatePath(routes.vendorDashboard.shop.store.index());
  revalidatePath(routes.vendorDashboard.shop.badges());
  revalidatePath(routes.vendorDashboard.performance());
}

export async function storeAction(_prev: StoreActionState, formData: FormData): Promise<StoreActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return err('No supplier profile found.');
  const shopId = profile.vendor_profile_id as string;
  const role = await resolveVendorRoleForProfile(supabase, user.id, shopId);
  if (!canManageVendor(role)) return err('Only the owner or an admin of this shop can change it.');

  const admin = createAdminClient();
  const op = String(formData.get('op') ?? '');

  if (op === 'buy') return buyTool(formData, { userId: user.id, shopId, services: (profile.services ?? []) as string[] });

  if (op !== 'layout') return err('Nothing to do.');
  const row = formData.get('row');
  if (!isLayoutRow(row)) return err('Nothing to do.');
  const keys = cleanLayoutRow(row, formData.getAll('key'));
  const off = row === 'tools' ? cleanLayoutRow('tools', formData.getAll('off')) : [];

  // The other two rows are kept as they are: read the column first, so one row's save never resets another's.
  const layout = await readStoreLayout(admin, shopId);
  if (!layout) return err('Couldn’t read your shop just now. Nothing was changed — try again.');
  const next = withLayoutRow(layout, row, keys, off);
  const { error } = await admin.from('vendor_profiles').update({ store_layout: layoutColumn(next) }).eq('vendor_profile_id', shopId);
  if (error) {
    logQueryError('storeAction.layout', error, { vendor_profile_id: shopId, row });
    return err('Couldn’t save that just now. Try again.');
  }
  revalidateStore();
  return ok(layoutToast(row, String(formData.get('intent') ?? 'order')));
}

const ADDED: Readonly<Record<LayoutRow, string>> = { graphs: 'On your Analytics', badges: 'On your Shop', tools: 'In Your widgets' };

function layoutToast(row: LayoutRow, intent: string): string {
  if (intent === 'add') return ADDED[row];
  if (intent === 'remove') return row === 'tools' ? 'Taken off your Shop. It stays yours in the Toolkit.' : 'Taken off your Shop';
  return 'Saved';
}

async function buyTool(formData: FormData, who: { userId: string; shopId: string; services: string[] }): Promise<StoreActionState> {
  const key = String(formData.get('tool') ?? '');
  if (!isPaidStoreTool(key)) return err('That widget is not sold in the Toolkit.');
  const tool: PaidStoreTool = key;
  const supabase = await createClient();
  const admin = createAdminClient();

  // ── Never charge for what the shop already has: owned, with its plan, or an order in review.
  const facts = await readStoreToolFacts(supabase, admin, who.shopId, who.services, null);
  const state = toolStatus(tool, facts);
  if (state.kind === 'owned' || state.kind === 'plan') return ok('It is already yours. Open it from Your widgets.');
  if (state.kind === 'pending') return err('Your payment for this widget is in review. It opens once our team confirms it.');
  if (state.kind === 'unread') return err('Couldn’t check your widgets just now. You have not been charged — try again.');

  // ── The authoritative price + is_active, from the admin-managed row. No row, a retired row or no price refuses.
  const sku = storeToolSku(tool);
  const { data: skuRow } = await admin.from('vendor_billing_catalog').select('price_php, is_active, title').eq('sku_code', sku).maybeSingle();
  const row = skuRow as { price_php?: number | string | null; is_active?: boolean | null; title?: string | null } | null;
  const pricePhp = row ? Number(row.price_php) : Number.NaN;
  if (!row || row.is_active !== true || !Number.isFinite(pricePhp) || pricePhp <= 0) {
    return err('This widget’s price is not set yet. You have not been charged.');
  }

  const channel = await railForNewOrder(supabase, formData.get('channel'));
  if (!channel) return err(PAYMENTS_PAUSED_MESSAGE);
  const referenceCode = generateReferenceCode();

  const { data: orderRow, error: oErr } = await createMoneyWriterClient()
    .from('orders')
    .insert(
      orderRowFor(
        { userId: who.userId, eventId: null, vendorProfileId: who.shopId },
        {
          service_key: sku,
          description: row.title ?? storeToolOf(tool)?.title ?? 'Widget',
          requested_total_php: pricePhp,
          status: 'submitted',
          reference_code: referenceCode,
        },
      ),
    )
    .select('order_id')
    .maybeSingle();
  if (oErr || !orderRow) return err('Could not start the order. Please try again.');
  const orderId = (orderRow as { order_id: string }).order_id;

  const { error: pErr } = await createMoneyWriterClient().from('payments').insert(
    paymentRowFor(
      { userId: who.userId, verifiedOrderId: orderId },
      {
        amount_php: pricePhp,
        channel,
        reference_number: null,
        screenshot_url: null,
        paid_at: new Date().toISOString().slice(0, 10),
      },
    ),
  );
  if (pErr) {
    const { error: rbErr } = await createMoneyWriterClient().from('orders').delete().eq('order_id', orderId);
    if (rbErr) console.error('[supabase-error] store-actions: order rollback failed', orderId, rbErr);
    return err('Could not start the payment. Please try again.');
  }

  revalidateStore();
  redirect(payPath(referenceCode));
}
