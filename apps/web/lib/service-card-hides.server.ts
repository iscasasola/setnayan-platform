import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { hidesByCard, parseCardHideKey } from '@/lib/service-card-hides';

/**
 * 🃏 HIDE PER CARD — the reads and the one write (Build 5 Lane C; `vendor_service_card_hides`, migration
 * 20271342009988). Keys and rules: `lib/service-card-hides.ts`.
 *
 * The public shop page reads every card's hides on the server (`readCardHides`, admin client — the table has no anon
 * grant). The supplier's own grown card asks, after the page, whether this viewer runs the shop (`readCardOwnerView`)
 * and toggles one item (`setCardHide`) — both under the CALLER'S session, so RLS (`current_vendor_profile_ids()`: the
 * owner and the owner/admin team) is the gate, never this file.
 *
 * Reached through the existing `couplePhotoShare` dispatcher (ops `card_owner` · `card_hide`) — no new server action:
 * the export budget (`scripts/lint-server-action-budget.mjs`) sits at its ceiling.
 */

/**
 * Every card's hidden keys. A refused read is logged and reads as "nothing hidden" — the card shows everything, which
 * is the shop's own content, never someone else's; it is never drawn as an error to a couple.
 */
export async function readCardHides(admin: SupabaseClient, serviceIds: ReadonlyArray<string>): Promise<Map<string, string[]>> {
  if (serviceIds.length === 0) return new Map();
  const { data, error } = await admin
    .from('vendor_service_card_hides')
    .select('vendor_service_id, item_kind, item_key')
    .in('vendor_service_id', [...serviceIds]);
  if (error) {
    logQueryError('readCardHides', error, { cards: serviceIds.length }, 'graceful_degrade');
    return new Map();
  }
  return hidesByCard((data ?? []) as Array<{ vendor_service_id: string; item_kind: string; item_key: string }>);
}

/**
 * Does THIS viewer run the shop? Then the grown card is theirs to curate: hide per card, 👁 Couple view, and the card's
 * opens. `opens` = distinct viewer-days the card was opened in the last 12 months (`service_card_opens`, the same count
 * Shop › Analytics draws); `null` when that read failed — the card then says "Couldn't load", never 0.
 */
export type CardOwnerView = { status: 'owner'; opens: Record<string, number> | null } | { status: 'not_owner' };

export async function readCardOwnerView(vendorProfileId: string): Promise<CardOwnerView> {
  if (!vendorProfileId) return { status: 'not_owner' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'not_owner' };
  const { data: mine, error: mineError } = await supabase.rpc('current_vendor_profile_ids');
  if (mineError) {
    logQueryError('readCardOwnerView.mine', mineError, { vendorProfileId }, 'graceful_degrade');
    return { status: 'not_owner' };
  }
  const ids = ((mine ?? []) as unknown[]).map((r) => (typeof r === 'string' ? r : (r as Record<string, unknown>)?.current_vendor_profile_ids));
  if (!ids.includes(vendorProfileId)) return { status: 'not_owner' };

  const { data: opensRows, error: opensError } = await supabase.rpc('service_card_opens', { p_vendor_profile_id: vendorProfileId });
  if (opensError) {
    logQueryError('readCardOwnerView.opens', opensError, { vendorProfileId }, 'graceful_degrade');
    return { status: 'owner', opens: null };
  }
  const opens: Record<string, number> = {};
  for (const r of (opensRows ?? []) as Array<{ vendor_service_id: string; opens_12m: number | string | null }>) {
    opens[r.vendor_service_id] = Number(r.opens_12m ?? 0);
  }
  return { status: 'owner', opens };
}

export type CardHideResult = { status: 'ok' | 'refused' | 'error' };

/** Hide (or show again) one item on one card. RLS decides who may; a write that matched nothing is a refusal. */
export async function setCardHide(vendorServiceId: string, rawKey: string, hidden: boolean): Promise<CardHideResult> {
  const parsed = parseCardHideKey(rawKey);
  if (!vendorServiceId || !parsed) return { status: 'refused' };
  const supabase = await createClient();
  if (hidden) {
    const { error } = await supabase
      .from('vendor_service_card_hides')
      .upsert(
        { vendor_service_id: vendorServiceId, item_kind: parsed.kind, item_key: parsed.key },
        { onConflict: 'vendor_service_id,item_kind,item_key', ignoreDuplicates: true },
      );
    if (!error) return { status: 'ok' };
    if (error.code === '42501') return { status: 'refused' };
    logQueryError('setCardHide.insert', error, { vendorServiceId, kind: parsed.kind }, 'graceful_degrade');
    return { status: 'error' };
  }
  const { data, error } = await supabase
    .from('vendor_service_card_hides')
    .delete()
    .eq('vendor_service_id', vendorServiceId)
    .eq('item_kind', parsed.kind)
    .eq('item_key', parsed.key)
    .select('vendor_service_id');
  if (error) {
    logQueryError('setCardHide.delete', error, { vendorServiceId, kind: parsed.kind }, 'graceful_degrade');
    return { status: 'error' };
  }
  // Nothing removed: either it was already shown, or RLS hid the row from a stranger. Both leave the card as it is.
  return { status: (data ?? []).length > 0 ? 'ok' : 'refused' };
}
