import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * pricing-audit-history.ts — surfaces what `admin_audit_log` already stores.
 *
 * WHATS_NEXT_Managing_Prices_2026-08-26.md § 4: "Every save records the full
 * before and after of the row. The screen shows you only 'edited 2 months
 * ago'... 34 stored before/after records, none shown." NO NEW TABLE — this
 * reads the same `admin_audit_log` the old bulk action already wrote to.
 *
 * ⚠ PARTIAL BY CONSTRUCTION, SAY SO ON SCREEN: a price changed by a MIGRATION
 * (the common case for a repricing sweep like the Papic ladder) never goes
 * through these actions and so never writes a row here. This file's history
 * is "every change made from this screen since 1 July 2026", not "every
 * change this SKU has ever had" — the caller must not imply completeness.
 */

const PRICING_ACTIONS = [
  'v2_retail_sku_edit',
  'v2_retail_retire',
  'v2_retail_reactivate',
  'v2_retail_delete',
  'v2_bundle_sku_edit',
  'v2_bundle_retire',
  'v2_bundle_reactivate',
  'v2_vendor_sku_edit',
  'v2_vendor_retire',
  'v2_vendor_reactivate',
] as const;

export type PricingHistoryEntry = {
  date: string; // ISO
  summary: string;
  who: string;
};

export type PricingHistoryMap = ReadonlyMap<string, PricingHistoryEntry[]>;

function priceOf(obj: unknown): number | null {
  if (!obj || typeof obj !== 'object') return null;
  const rec = obj as Record<string, unknown>;
  const raw = rec.retail_price_php ?? rec.price_php ?? null;
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function pesoShort(n: number): string {
  return `₱${n.toLocaleString('en-PH')}`;
}

function summarize(action: string, metadata: Record<string, unknown> | null): string {
  const before = metadata?.before as Record<string, unknown> | undefined;
  const after = metadata?.after as Record<string, unknown> | undefined;

  if (action.endsWith('_retire')) {
    const reason = (metadata?.reason as string | null) ?? null;
    return reason ? `retired — ${reason}` : 'retired';
  }
  if (action.endsWith('_reactivate')) return 'put back on sale';
  if (action.endsWith('_delete')) return 'removed for good';

  const beforePrice = priceOf(before);
  const afterPrice = priceOf(after);
  if (beforePrice != null && afterPrice != null && beforePrice !== afterPrice) {
    return `${pesoShort(beforePrice)} → ${pesoShort(afterPrice)}`;
  }
  if (afterPrice != null && beforePrice == null) return `set at ${pesoShort(afterPrice)}`;
  return 'edited';
}

/**
 * One batched read for every code the page will render, plus one batched
 * read to resolve actor display names. Call once per page render.
 */
export async function fetchPricingAuditHistory(
  admin: SupabaseClient,
  codes: readonly string[],
  perCodeLimit = 8,
): Promise<PricingHistoryMap> {
  const map = new Map<string, PricingHistoryEntry[]>();
  if (codes.length === 0) return map;

  const { data } = await admin
    .from('admin_audit_log')
    .select('action,target_id,actor_user_id,metadata,created_at')
    .in('target_id', codes)
    .in('action', PRICING_ACTIONS as unknown as string[])
    .order('created_at', { ascending: false });

  const rows = data ?? [];
  const actorIds = new Set<string>();
  for (const r of rows) if (r.actor_user_id) actorIds.add(r.actor_user_id as string);

  const nameById = new Map<string, string>();
  if (actorIds.size > 0) {
    const { data: users } = await admin
      .from('users')
      .select('user_id, display_name, email')
      .in('user_id', Array.from(actorIds));
    for (const u of users ?? []) {
      nameById.set(
        u.user_id as string,
        (u.display_name as string | null) ?? (u.email as string | null) ?? 'Unknown',
      );
    }
  }

  for (const r of rows) {
    const code = r.target_id as string;
    const list = map.get(code) ?? [];
    if (list.length >= perCodeLimit) continue;
    list.push({
      date: r.created_at as string,
      summary: summarize(r.action as string, r.metadata as Record<string, unknown> | null),
      who: r.actor_user_id ? (nameById.get(r.actor_user_id as string) ?? 'Unknown') : 'Unknown',
    });
    map.set(code, list);
  }
  return map;
}
