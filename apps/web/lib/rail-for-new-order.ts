import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { resolveChannel, type PayChannel } from '@/lib/payment-channels';

/**
 * The rail a NEW supplier order is minted on — or null when every rail is
 * closed, in which case the caller must refuse with `PAYMENTS_PAUSED_MESSAGE`
 * and mint nothing.
 *
 * Every supplier buy button redirects to `/pay/<reference>`, where the rail is
 * actually chosen (2026-08-21), so the value posted from the card is only the
 * NOT NULL placeholder on the pending `payments` row. That is why a closed
 * posted rail is quietly moved to an open one here instead of refused the way
 * couple checkout refuses it: nobody is looking at that rail's QR yet.
 *
 * 🔑 What it does refuse is an order nobody can pay. With both rails switched
 * off (both personal accounts at their monthly receiving cap), minting one
 * sends the supplier to a payment page with nothing on it they can safely pay
 * into — and a pending order the admin has to clean up.
 *
 * Reads with the caller's session: `platform_settings` is readable by
 * `authenticated` (policy `platform_settings_read_authenticated`, measured in
 * prod 2026-09-18).
 *
 * ⚠ A FAILED read resolves to null (paused), not open: `fetchPlatformSettings`
 * falls back to flags ON but NO account details, and a rail with nothing to
 * pay to is closed. Couple checkout behaves identically, and it is the honest
 * answer — the /pay page would have no number or QR to show either.
 */
export async function railForNewOrder(
  supabase: SupabaseClient,
  requested: FormDataEntryValue | null,
): Promise<PayChannel | null> {
  const settings = await fetchPlatformSettings(supabase);
  return resolveChannel(String(requested ?? '').trim(), settings);
}
