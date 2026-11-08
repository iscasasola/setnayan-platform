import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GLOBAL_SETTINGS_TAGS, rememberedGlobalRead } from '@/lib/global-settings-cache';
import { GIFT_LIMIT_PCT_DEFAULT, giftLimitPctOrDefault } from '@/lib/setnayan-gift';

/**
 * 🎁 THE LIVE GIFT LIMIT — "Gift limit · % of the booking fee" (owner v112 answer, 8 Nov 2026; THE ONE BUILD).
 *
 * One admin setting, `platform_settings.gift_limit_pct` (default 40, CHECK 0–100), written only from Admin › Gifts
 * (`saveGiftLimitPct`, audited). It sizes the Setnayan gift AND caps a shop's BOUGHT gifts on one quote; badge
 * rewards sit outside it. The bill reads the SAME column in SQL (`setnayan_gift_for_fee`), and
 * tests/db/the-gift-limit-reaches-the-bill.db.test.ts holds TS == SQL at 40 and at 25.
 *
 * ⚠ FAILS TOWARD THE RULED DEFAULT (40), NEVER TOWARD 0 OR HIGHER. A refused read is not remembered and returns the
 * owner's ruled default for this page only — the same shape as `getBookingFeeSchedule`. The bill never depends on
 * this read (SQL reads the column itself), so the worst a refused read can do is show the ruled default on a screen.
 *
 * 🧊 Remembered across requests under `GLOBAL_SETTINGS_TAGS.platformSettings`; `saveGiftLimitPct` clears that tag in
 * the same action, so a new limit is read on the next page.
 */
export async function getGiftLimitPct(admin: SupabaseClient): Promise<number> {
  try {
    const pct = await rememberedGlobalRead('platform_settings-gift-limit-v1', GLOBAL_SETTINGS_TAGS.platformSettings, async () => {
      const res = await admin.from('platform_settings').select('gift_limit_pct').eq('id', 1).maybeSingle();
      // ⚠ Supabase RESOLVES with `{ error }`; it does not throw. Checked explicitly so a refused read is never cached.
      if (res.error) throw res.error;
      const raw = (res.data as { gift_limit_pct?: number | string | null } | null)?.gift_limit_pct;
      return raw == null ? null : Number(raw);
    });
    return giftLimitPctOrDefault(pct);
  } catch {
    return GIFT_LIMIT_PCT_DEFAULT;
  }
}
