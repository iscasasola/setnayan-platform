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
  addedFreeTools,
  analyticsGraphs,
  cleanBadgePicks,
  cleanGraphPicks,
  isGraphKey,
  isPaidStoreTool,
  isShopBadgeKey,
  MAX_FOLLOWED_BADGES,
  storeToolOf,
  storeToolSku,
  toolStatus,
  type PaidStoreTool,
} from '@/lib/supplier-store';
import { readStoreGraphUnlocks, readStorePicks, readStoreToolFacts } from '@/lib/supplier-store.server';
import { readShopTrackerFacts } from '@/lib/shop-badges.server';

/**
 * 🛍 THE STORE'S ONE SERVER ACTION (owner 23 Nov 2026; drawing specs `prototypes/supplier_store_graphs_badges_2026-11-23/`).
 *
 * ONE export on purpose: every exported action is one Vercel route and the budget sits at its ceiling
 * (`scripts/lint-server-action-budget.mjs`); the slot was freed by folding the Suggested coverage pair into one.
 *
 *   op=graphs        the Analytics order (repeated `graph`), cleaned to open graphs   → vendor_profiles.store_graphs
 *   op=graph_add     one graph to the end of the Analytics                             → store_graphs
 *   op=graph_remove  one graph off the Analytics                                       → store_graphs
 *   op=badge_follow  follow one badge (refused at three: unfollow one first)          → store_badges
 *   op=badge_unfollow                                                                   → store_badges
 *   op=tool_add      a FREE tool into Your tools                                       → store_tools
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

  const picks = await readStorePicks(admin, shopId);
  if (!picks) return err('Couldn’t read your shop just now. Nothing was changed — try again.');

  const write = async (patch: Record<string, string[] | null>, done: string): Promise<StoreActionState> => {
    const { error } = await admin.from('vendor_profiles').update(patch).eq('vendor_profile_id', shopId);
    if (error) {
      logQueryError('storeAction.write', error, { vendor_profile_id: shopId, op });
      return err('Couldn’t save that just now. Try again.');
    }
    revalidateStore();
    return ok(done);
  };

  if (op === 'graphs' || op === 'graph_add' || op === 'graph_remove') {
    const unlocks = await readStoreGraphUnlocks(admin, shopId, readShopTrackerFacts(shopId).catch(() => null));
    const on = analyticsGraphs(picks.graphs, unlocks);
    if (op === 'graphs') return write({ store_graphs: cleanGraphPicks(formData.getAll('graph'), unlocks) }, 'Saved');
    const key = String(formData.get('graph') ?? '');
    if (!isGraphKey(key)) return err('That graph is not in the Store.');
    if (op === 'graph_remove') return write({ store_graphs: on.filter((k) => k !== key) }, 'Taken off your Analytics');
    if (unlocks.hidden.has(key)) return err('This graph opens with its badge’s Bronze.');
    if (on.includes(key)) return ok('Already on your Analytics');
    return write({ store_graphs: [...on, key] }, 'On your Analytics');
  }

  if (op === 'badge_follow' || op === 'badge_unfollow') {
    const key = String(formData.get('badge') ?? '');
    if (!isShopBadgeKey(key)) return err('That badge is not in the Store.');
    const now = cleanBadgePicks(picks.badges ?? []);
    if (op === 'badge_unfollow') return write({ store_badges: now.filter((k) => k !== key) }, 'Unfollowed');
    if (now.includes(key)) return ok('Already following');
    if (now.length >= MAX_FOLLOWED_BADGES) return err('You follow three already. Unfollow one first.');
    return write({ store_badges: [...now, key] }, 'Following on your Shop');
  }

  if (op === 'tool_add') {
    const key = String(formData.get('tool') ?? '');
    const tool = storeToolOf(key);
    if (!tool || isPaidStoreTool(tool.key)) return err('That tool is not a free tool.');
    const now = addedFreeTools({ picked: picks.tools, categoryLabels: [], services: (profile.services ?? []) as string[] });
    if (now.includes(tool.key)) return ok('Already in your tools');
    return write({ store_tools: [...now, tool.key] }, `${tool.title} is in your tools`);
  }

  return err('Nothing to do.');
}

async function buyTool(formData: FormData, who: { userId: string; shopId: string; services: string[] }): Promise<StoreActionState> {
  const key = String(formData.get('tool') ?? '');
  if (!isPaidStoreTool(key)) return err('That tool is not sold in the Store.');
  const tool: PaidStoreTool = key;
  const supabase = await createClient();
  const admin = createAdminClient();

  // ── Never charge for what the shop already has: owned, with its plan, in its trial, or an order in review.
  const facts = await readStoreToolFacts(supabase, admin, who.shopId, who.services, null);
  const state = toolStatus(tool, facts);
  if (state.kind === 'owned' || state.kind === 'plan' || state.kind === 'trial') return ok('It is already yours. Open it from Your tools.');
  if (state.kind === 'pending') return err('Your payment for this tool is in review. It opens once our team confirms it.');
  if (state.kind === 'unread') return err('Couldn’t check your tools just now. You have not been charged — try again.');

  // ── The authoritative price + is_active, from the admin-managed row. No row, a retired row or no price refuses.
  const sku = storeToolSku(tool);
  const { data: skuRow } = await admin.from('vendor_billing_catalog').select('price_php, is_active, title').eq('sku_code', sku).maybeSingle();
  const row = skuRow as { price_php?: number | string | null; is_active?: boolean | null; title?: string | null } | null;
  const pricePhp = row ? Number(row.price_php) : Number.NaN;
  if (!row || row.is_active !== true || !Number.isFinite(pricePhp) || pricePhp <= 0) {
    return err('This tool’s price is not set yet. You have not been charged.');
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
          description: row.title ?? storeToolOf(tool)?.title ?? 'Specialized tool',
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
