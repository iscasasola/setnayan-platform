import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { FEE_LEAK_PRICE_TOLERANCE_DEFAULT } from './booking-fee-gate';
import { pickLeakMatch, type QuotedShop } from './manual-add-leak';

/**
 * stampManualLeakMatch — run the fee-leak check for ONE hand-typed record and,
 * on a match, stamp `event_manual_vendors.leak_match_vendor_profile_id`
 * (migration 20271267252894). The decision is `pickLeakMatch`
 * (`lib/manual-add-leak.ts`); this file only reads its facts and writes the one
 * column.
 *
 * Reads, in order:
 *   1 · the event's Setnayan shops in the record's category — under the
 *       COUPLE'S session, so the read is also the ownership check (a stranger's
 *       event reads zero rows and nothing is stamped);
 *   2 · the quotes those shops sent this event (`vendor_proposals`, sent ·
 *       viewed · accepted; the newest per shop) — service role, scoped to the
 *       ids step 1 returned;
 *   3 · the owner's tolerance (`platform_settings.fee_leak_price_tolerance`);
 *       unreadable → the owner's own 0.10, never "no check".
 * Writes: the stamp, with the service role — `guard_manual_vendor_leak_match`
 * refuses it from any other session, by design.
 *
 * ⚠ NEVER SEEN BY THE COUPLE and never an error to them (owner 2026-10-12: the
 * fee is between Setnayan and the supplier). Every failure is logged and the
 * record simply stays unstamped (fail-safe = import = free). A stamp is never
 * CLEARED here — a later edit can add one, not take one away.
 */
export async function stampManualLeakMatch(
  coupleSession: SupabaseClient,
  admin: SupabaseClient,
  args: {
    eventId: string;
    manualVendorId: string;
    category: string;
    typedName: string;
    typedPricePhp: number | null;
    nameDismissed: boolean;
  },
): Promise<{ matched: string | null; error?: string }> {
  const where = 'lib/manual-add-leak.server.ts';
  try {
    const { data: rows, error: rowErr } = await coupleSession
      .from('event_vendors')
      .select('marketplace_vendor_id, vendor_name')
      .eq('event_id', args.eventId)
      .eq('category', args.category)
      .not('marketplace_vendor_id', 'is', null);
    if (rowErr) throw new Error(`event_vendors: ${rowErr.message}`);
    const byShop = new Map<string, string>();
    for (const r of (rows ?? []) as { marketplace_vendor_id: string | null; vendor_name: string | null }[]) {
      if (r.marketplace_vendor_id) byShop.set(r.marketplace_vendor_id, r.vendor_name ?? '');
    }
    if (byShop.size === 0) return { matched: null };

    const ids = [...byShop.keys()];
    const [{ data: proposals, error: propErr }, { data: profiles }, { data: settings }] = await Promise.all([
      admin
        .from('vendor_proposals')
        .select('vendor_profile_id, total_centavos, created_at')
        .eq('event_id', args.eventId)
        .in('vendor_profile_id', ids)
        .in('status', ['sent', 'viewed', 'accepted'])
        .order('created_at', { ascending: false }),
      admin.from('vendor_profiles').select('vendor_profile_id, business_name').in('vendor_profile_id', ids),
      admin.from('platform_settings').select('fee_leak_price_tolerance').eq('id', 1).maybeSingle(),
    ]);
    if (propErr) throw new Error(`vendor_proposals: ${propErr.message}`);

    const quote = new Map<string, number>();
    for (const p of (proposals ?? []) as { vendor_profile_id: string; total_centavos: number | string | null }[]) {
      if (quote.has(p.vendor_profile_id)) continue; // newest first
      const c = Number(p.total_centavos);
      if (Number.isFinite(c) && c > 0) quote.set(p.vendor_profile_id, c / 100);
    }
    const shopName = new Map<string, string>();
    for (const p of (profiles ?? []) as { vendor_profile_id: string; business_name: string | null }[]) {
      if (p.business_name) shopName.set(p.vendor_profile_id, p.business_name);
    }
    const shops: QuotedShop[] = ids.map((id) => ({
      vendorProfileId: id,
      // The shop's own name, else what the couple's row calls it.
      name: shopName.get(id) ?? byShop.get(id) ?? '',
      quotePhp: quote.get(id) ?? null,
    }));
    const raw = Number((settings as { fee_leak_price_tolerance?: number | string | null } | null)?.fee_leak_price_tolerance);
    const tolerance = Number.isFinite(raw) && raw >= 0 ? raw : FEE_LEAK_PRICE_TOLERANCE_DEFAULT;

    const matched = pickLeakMatch({
      typedName: args.typedName,
      typedPricePhp: args.typedPricePhp,
      nameDismissed: args.nameDismissed,
      shops,
      tolerance,
    });
    if (!matched) return { matched: null };

    const { error: upErr } = await admin
      .from('event_manual_vendors')
      .update({ leak_match_vendor_profile_id: matched })
      .eq('manual_vendor_id', args.manualVendorId)
      .eq('event_id', args.eventId)
      .is('leak_match_vendor_profile_id', null);
    if (upErr) throw new Error(`event_manual_vendors.update: ${upErr.message}`);
    return { matched };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[supabase-error] ${where} · fee-leak check skipped (record left unstamped):`, message);
    return { matched: null, error: message };
  }
}
