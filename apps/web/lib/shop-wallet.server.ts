import 'server-only';

/**
 * THE SHOP WALLET — the database layer over `lib/shop-wallet.ts` (pure rules,
 * words, the history fold). Owner 2026-10-23, option A: one shop wallet.
 *
 *   fetchShopWallet        — balance + history + a pack still being checked,
 *                            for the Money row and the sheet. RLS client: the
 *                            shop reads its own rows (`shop_papic_wallet_entries
 *                            _vendor_read`).
 *   spendFromShopWallet    — the ONLY spend: `shop_papic_wallet_spend` (locks
 *                            the shop, refuses what it cannot cover, one spend
 *                            per spend_ref). Service-role, after the caller has
 *                            proven who it is.
 *   fetchShopWalletEventPots — the events' OWN pots, quoted on the sheet (each
 *                            a door to that event's Papic). Read-only; the
 *                            per-event ledger is untouched.
 *
 * ⚠ Supabase does not throw on a failed read — it resolves with `{ error }`.
 * Every read below checks it, and a failure becomes `null` (said on screen),
 * never 0.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { VENDOR_PAPIC_PORTFOLIO_PACK_SKU_CODE } from '@/lib/vendor-papic-credits';
import { fetchVendorPapicPortfolioCredits } from '@/lib/vendor-papic-grants';
import {
  SHOP_WALLET_KINDS,
  type EventPotLine,
  type ShopWallet,
  type ShopWalletEntry,
  type ShopWalletKind,
  type ShopWalletPendingPack,
  type ShopWalletSpendKind,
} from '@/lib/shop-wallet';

const HISTORY_LIMIT = 300;

type EntryRow = {
  entry_id: string;
  delta: number;
  kind: string;
  order_id: string | null;
  event_id: string | null;
  photos: number | null;
  clips: number | null;
  created_at: string;
};

const asKind = (k: string): ShopWalletKind | null =>
  (SHOP_WALLET_KINDS as readonly string[]).includes(k) ? (k as ShopWalletKind) : null;

/**
 * The shop's wallet: balance (the SQL sum — every row, not just the history
 * page), the newest history rows, and the newest pack order not yet approved.
 * A failed balance read → `balance: null`; a failed pending read → no pending
 * line (the balance is still right, and "checking" is a courtesy, not money).
 */
export async function fetchShopWallet(
  client: SupabaseClient,
  vendorProfileId: string,
): Promise<ShopWallet> {
  if (!vendorProfileId) return { balance: null, entries: [], pendingPack: null };
  const [bal, rows, pending] = await Promise.all([
    client.rpc('shop_papic_wallet_balance', { p_vendor_profile_id: vendorProfileId }),
    client
      .from('shop_papic_wallet_entries')
      .select('entry_id, delta, kind, order_id, event_id, photos, clips, created_at')
      .eq('vendor_profile_id', vendorProfileId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT),
    fetchPendingPack(client, vendorProfileId),
  ]);

  if (bal.error || rows.error) {
    console.error('[supabase-error] shop-wallet: wallet read', bal.error ?? rows.error);
    return { balance: null, entries: [], pendingPack: pending };
  }
  const balance = Number(bal.data);
  if (!Number.isFinite(balance)) return { balance: null, entries: [], pendingPack: pending };

  const entries: ShopWalletEntry[] = [];
  for (const r of (rows.data ?? []) as EntryRow[]) {
    const kind = asKind(r.kind);
    if (!kind) continue;
    entries.push({
      entryId: r.entry_id,
      delta: Number(r.delta),
      kind,
      orderId: r.order_id,
      eventId: r.event_id,
      photos: r.photos,
      clips: r.clips,
      createdAt: r.created_at,
    });
  }
  return { balance: Math.trunc(balance), entries, pendingPack: pending };
}

/**
 * The newest pack order this shop has not had approved yet. `submitted` /
 * `awaiting_payment` are the two states before approval (lib/orders.ts); a
 * payment row the admin bounced (`resubmit_requested`) is said as such.
 */
async function fetchPendingPack(
  client: SupabaseClient,
  vendorProfileId: string,
): Promise<ShopWalletPendingPack | null> {
  try {
    const { data, error } = await client
      .from('orders')
      .select('reference_code, requested_total_php, status, payments(status, created_at)')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('service_key', VENDOR_PAPIC_PORTFOLIO_PACK_SKU_CODE)
      .in('status', ['submitted', 'awaiting_payment'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('[supabase-error] shop-wallet: pending pack', error);
      return null;
    }
    if (!data) return null;
    const row = data as {
      reference_code: string | null;
      requested_total_php: number | string | null;
      payments: { status: string | null; created_at: string | null }[] | null;
    };
    const amount = Number(row.requested_total_php);
    if (!row.reference_code || !Number.isFinite(amount)) return null;
    const newest = [...(row.payments ?? [])].sort((a, b) =>
      String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')),
    )[0];
    return {
      referenceCode: row.reference_code,
      amountPhp: amount,
      state: newest?.status === 'resubmit_requested' ? 'resubmit' : 'checking',
    };
  } catch {
    return null;
  }
}

/** ₱ and rail of each approved pack, for the sheet's "+100 · Pack · ₱500 / GCash". */
export async function fetchShopWalletPackMeta(
  client: SupabaseClient,
  orderIds: readonly string[],
): Promise<Map<string, { amountPhp: number | null; rail: string | null }>> {
  const out = new Map<string, { amountPhp: number | null; rail: string | null }>();
  if (orderIds.length === 0) return out;
  try {
    const { data, error } = await client
      .from('orders')
      .select('order_id, requested_total_php, payments(channel, status)')
      .in('order_id', [...orderIds]);
    if (error) return out;
    for (const r of (data ?? []) as {
      order_id: string;
      requested_total_php: number | string | null;
      payments: { channel: string | null; status: string | null }[] | null;
    }[]) {
      const amount = Number(r.requested_total_php);
      const matched = (r.payments ?? []).find((p) => p.status === 'matched') ?? (r.payments ?? [])[0];
      const ch = matched?.channel ?? null;
      out.set(r.order_id, {
        amountPhp: Number.isFinite(amount) ? amount : null,
        rail: ch === 'gcash' ? 'GCash' : ch === 'bdo' ? 'BDO' : ch,
      });
    }
  } catch {
    /* the line draws without ₱/rail rather than inventing them */
  }
  return out;
}

export type ShopWalletSpendResult =
  | { status: 'ok'; balance: number }
  | { status: 'duplicate'; balance: number }
  | { status: 'insufficient'; balance: number }
  | { status: 'failed' };

/**
 * Spend from the shop wallet — through `shop_papic_wallet_spend` only. Run on
 * the SERVICE-ROLE client (the function is granted to nobody else), and only
 * after the caller has proven it may spend for this shop. `spendRef` names the
 * thing paid for; a repeat of the same ref answers `duplicate` and charges
 * nothing. A transport failure is `failed` — the caller must treat it as "not
 * charged, not saved", never as success.
 */
export async function spendFromShopWallet(
  admin: SupabaseClient,
  args: {
    vendorProfileId: string;
    credits: number;
    kind: ShopWalletSpendKind;
    spendRef: string;
    eventId?: string | null;
    photos?: number | null;
    clips?: number | null;
    note?: string | null;
    actorUserId?: string | null;
  },
): Promise<ShopWalletSpendResult> {
  try {
    const { data, error } = await admin.rpc('shop_papic_wallet_spend', {
      p_vendor_profile_id: args.vendorProfileId,
      p_credits: args.credits,
      p_kind: args.kind,
      p_spend_ref: args.spendRef,
      p_event_id: args.eventId ?? null,
      p_photos: args.photos ?? null,
      p_clips: args.clips ?? null,
      p_note: args.note ?? null,
      p_actor: args.actorUserId ?? null,
    });
    if (error) {
      console.error('[supabase-error] shop-wallet: spend', error);
      return { status: 'failed' };
    }
    const r = (data ?? {}) as { status?: string; balance?: number };
    const balance = Number(r.balance);
    if (r.status === 'ok' && Number.isFinite(balance)) return { status: 'ok', balance };
    if (r.status === 'duplicate' && Number.isFinite(balance)) return { status: 'duplicate', balance };
    if (r.status === 'insufficient' && Number.isFinite(balance)) return { status: 'insufficient', balance };
    return { status: 'failed' };
  } catch {
    return { status: 'failed' };
  }
}

const SOURCE_WORD: Record<string, (n: number) => string> = {
  launch_offer: (n) => `${n.toLocaleString('en-PH')} gift`,
  booking_fee: (n) => `${n.toLocaleString('en-PH')} from the booking fee`,
  pack_order: (n) => `${n.toLocaleString('en-PH')} from packs`,
  admin: (n) => `${n.toLocaleString('en-PH')} from Setnayan`,
  comp: (n) => `${n.toLocaleString('en-PH')} from Setnayan`,
  migration: (n) => `${n.toLocaleString('en-PH')} carried over`,
};

/**
 * The events' OWN pots — "Ana & Miguel · 28 left / 50 gift + 40 from the
 * booking fee · 62 used". One line per booked event (newest date first,
 * capped). `left` is the SAME number the event's Papic card shows
 * (`fetchVendorPapicPortfolioCredits`), so the two screens cannot disagree.
 * Service-role, like every reader of the per-event ledger.
 */
export async function fetchShopWalletEventPots(
  admin: SupabaseClient,
  vendorProfileId: string,
  events: readonly { eventId: string; eventName: string }[],
  cap = 8,
): Promise<EventPotLine[]> {
  const picked = events.slice(0, cap);
  if (picked.length === 0) return [];
  const ids = picked.map((e) => e.eventId);
  const grants = await admin
    .from('vendor_papic_portfolio_credit_grants')
    .select('event_id, credits, source')
    .eq('vendor_profile_id', vendorProfileId)
    .in('event_id', ids);
  const bySource = new Map<string, Map<string, number>>();
  if (!grants.error) {
    for (const g of (grants.data ?? []) as { event_id: string; credits: number; source: string }[]) {
      const m = bySource.get(g.event_id) ?? new Map<string, number>();
      m.set(g.source, (m.get(g.source) ?? 0) + Math.max(0, Math.floor(Number(g.credits) || 0)));
      bySource.set(g.event_id, m);
    }
  }
  return Promise.all(
    picked.map(async (e): Promise<EventPotLine> => {
      const pc = await fetchVendorPapicPortfolioCredits(admin, vendorProfileId, e.eventId);
      const m = bySource.get(e.eventId);
      const parts: string[] = [];
      if (grants.error) {
        // came-from unknown — say nothing rather than guess
      } else if (!m || m.size === 0) {
        if (pc.left != null) parts.push(SOURCE_WORD.launch_offer!(pc.left + pc.spent));
      } else {
        for (const [src, n] of m) if (n > 0) parts.push((SOURCE_WORD[src] ?? SOURCE_WORD.admin!)(n));
      }
      return {
        eventId: e.eventId,
        name: e.eventName,
        left: pc.credits == null ? null : pc.left,
        cameFrom: parts.join(' + '),
        used: Number.isFinite(pc.spent) && pc.spent < Number.MAX_SAFE_INTEGER ? pc.spent : 0,
      };
    }),
  );
}
