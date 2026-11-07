'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { GLOBAL_SETTINGS_TAGS } from '@/lib/global-settings-tags';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminAction } from '@/lib/admin/require-admin';
import { GIFT_LIMIT_PCT_DEFAULT } from '@/lib/setnayan-gift';
import type { RowActionState } from '@/app/admin/pricing/actions';

/**
 * 🎁 SAVE THE GIFT LIMIT — "Gift limit · % of the booking fee" (owner v112 answer, 8 Nov 2026; THE ONE BUILD).
 *
 * The ONE writer of `platform_settings.gift_limit_pct`. Copies `saveBookingFeeSchedule`
 * (app/admin/pricing/price-control-actions.ts): admin-gated, a whole number 0–100 or refused, a no-op when
 * unchanged, an `admin_audit_log` row (`gift_limit_pct_edit`, before → after), the platform-settings tag cleared so
 * the next quote reads it, and a returned state — a save never resets the screen.
 *
 * What it moves: the Setnayan gift (`setnayan_gift_for_fee` reads the column in SQL; the quote reads it through
 * `getGiftLimitPct`) and the cap on a shop's BOUGHT gifts on one quote. Badge rewards stay outside it. Gifts already
 * locked on a booking do not move (`event_vendors.setnayan_gift_*_at_lock`).
 */
export async function saveGiftLimitPct(_prev: RowActionState, formData: FormData): Promise<RowActionState> {
  const { userId: adminUserId } = await requireAdminAction();
  const admin = createAdminClient();

  const raw = String(formData.get('gift_limit_pct') ?? '').trim();
  const pct = raw === '' ? NaN : Number(raw);
  if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
    return { ok: false, message: 'The gift limit must be a whole number from 0 to 100.' };
  }

  const { data: prior, error: readError } = await admin
    .from('platform_settings')
    .select('gift_limit_pct')
    .eq('id', 1)
    .maybeSingle();
  if (readError) return { ok: false, message: `Couldn't read the current limit — ${readError.message}` };
  const before =
    prior && (prior as { gift_limit_pct?: number | null }).gift_limit_pct != null
      ? Number((prior as { gift_limit_pct: number }).gift_limit_pct)
      : GIFT_LIMIT_PCT_DEFAULT;
  if (before === pct) return { ok: true, message: 'No changes to save.' };

  const { error } = await admin
    .from('platform_settings')
    .update({ gift_limit_pct: pct, updated_at: new Date().toISOString() })
    .eq('id', 1);
  revalidateTag(GLOBAL_SETTINGS_TAGS.platformSettings);
  if (error) return { ok: false, message: `Couldn't save — ${error.message}` };

  await admin.from('admin_audit_log').insert({
    action: 'gift_limit_pct_edit',
    target_id: 'gift_limit_pct',
    actor_user_id: adminUserId,
    metadata: { table: 'platform_settings', before, after: pct },
  });

  revalidatePath('/admin/gifts');
  return { ok: true, message: `Saved — new quotes size gifts at ${pct}% of the booking fee.` };
}
