import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GLOBAL_SETTINGS_TAGS, rememberedGlobalRead } from '@/lib/global-settings-cache';
import { MAX_PAYMENT_PHP_DEFAULT, maxPaymentPhpOrDefault } from '@/lib/max-payment';

/**
 * 💳 THE LIVE "MOST IN ONE PAYMENT" (owner 2026-11-17: "We do not allow transactions above 100,000.").
 *
 * One admin setting, `platform_settings.max_payment_php` (seeded 100000, CHECK > 0), written only from Admin ›
 * Settings › Payment methods (`savePaymentInstruments`, intent `max_payment_save`, audited). The gift store draws its
 * caps from this value and the buy action refuses an order above it — both read HERE, never a typed number.
 *
 * ⚠ FAILS TOWARD THE RULED DEFAULT (100,000), never higher: a refused read is not remembered and returns the owner's
 * ruled value for this request only — the same shape as `getGiftLimitPct`.
 *
 * 🧊 Remembered across requests under `GLOBAL_SETTINGS_TAGS.platformSettings`; the admin save clears that tag.
 */
export async function getMaxPaymentPhp(client: SupabaseClient): Promise<number> {
  try {
    const php = await rememberedGlobalRead('platform_settings-max-payment-v1', GLOBAL_SETTINGS_TAGS.platformSettings, async () => {
      const res = await client.from('platform_settings').select('max_payment_php').eq('id', 1).maybeSingle();
      // ⚠ Supabase RESOLVES with `{ error }`; it does not throw. Checked explicitly so a refused read is never cached.
      if (res.error) throw res.error;
      const raw = (res.data as { max_payment_php?: number | string | null } | null)?.max_payment_php;
      return raw == null ? null : Number(raw);
    });
    return maxPaymentPhpOrDefault(php);
  } catch {
    return MAX_PAYMENT_PHP_DEFAULT;
  }
}
