'use server';

/**
 * ⏭ "DO IT TOMORROW" — the ONE server action Today's drag-left and its "Do it tomorrow" link call (Today v3 part 2,
 * owner 19 Nov 2026: *"drag it to the left do it tomorrow"* · *"yes. except urgent"*; drawing `Today, tap opens a card`
 * v3.5, V3 · 2 · 2b).
 *
 *   { op: 'put',  key }   put this Today task off until tomorrow (Manila) — again and again is fine (ruled)
 *   { op: 'undo', key }   the toast's Undo: the record is deleted and the task is back on Today
 *   { ..., scope: 'admin' } v3 part 4 — the same on admin Focus, for THAT admin only (`admin_focus_put_offs`, ruled
 *                         19 Nov); the key is the Focus row's `<queue>:<item>`
 *
 * 🔢 ONE EXPORT ON PURPOSE: every exported server action is a Vercel route and the budget
 * (`scripts/lint-server-action-budget.mjs`) had exactly one left.
 *
 * 🔑 Runs under the CALLER'S OWN session, so RLS (migration 20271352477387) is the rule: a shop's owner or team writes
 * its own rows, signed as itself. Whether a row is red is decided where its deadline is read, and a red row ignores
 * any record (`lib/today-put-off.ts`), so no record written here can ever hide an urgent task.
 * Every outcome is said in words — never a silent no-op.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { resolveActiveShopId } from '@/lib/active-shop';
import { manilaToday } from '@/lib/chat-cards';
import { FOCUS_PUT_OFF_KEY, PUT_OFF_KEY, PUT_OFF_WORDS, tomorrowOf } from '@/lib/today-put-off';

export type TodayPutOffResult = { ok: boolean; message: string };

export async function todayPutOff(input: { op: 'put' | 'undo'; key: string; scope?: 'shop' | 'admin' }): Promise<TodayPutOffResult> {
  const op = input?.op;
  const scope = input?.scope === 'admin' ? 'admin' : 'shop';
  const key = typeof input?.key === 'string' ? input.key : '';
  if ((op !== 'put' && op !== 'undo') || !(scope === 'admin' ? FOCUS_PUT_OFF_KEY : PUT_OFF_KEY).test(key)) return { ok: false, message: 'That task was not found.' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Please sign in again.' };

  if (scope === 'admin') {
    // The admin's OWN record (RLS: user_id = auth.uid() and is_admin()) — every other admin still sees the item.
    const write =
      op === 'put'
        ? await supabase
            .from('admin_focus_put_offs')
            .upsert({ user_id: user.id, item_key: key, until_day: tomorrowOf(manilaToday()), put_off_at: new Date().toISOString() }, { onConflict: 'user_id,item_key' })
        : await supabase.from('admin_focus_put_offs').delete().eq('user_id', user.id).eq('item_key', key);
    if (write.error) {
      logQueryError(`todayPutOff.admin.${op}`, write.error, {}, 'graceful_degrade');
      return { ok: false, message: PUT_OFF_WORDS.failed };
    }
    revalidatePath('/admin');
    return { ok: true, message: op === 'put' ? PUT_OFF_WORDS.moved : 'Back in Focus.' };
  }
  const vendorProfileId = await resolveActiveShopId(supabase, user.id).catch(() => null);
  if (!vendorProfileId) return { ok: false, message: 'Only a shop’s team can do that.' };

  const write =
    op === 'put'
      ? await supabase
          .from('supplier_today_put_offs')
          .upsert(
            { vendor_profile_id: vendorProfileId, task_key: key, until_day: tomorrowOf(manilaToday()), put_off_by: user.id, put_off_at: new Date().toISOString() },
            { onConflict: 'vendor_profile_id,task_key' },
          )
      : await supabase.from('supplier_today_put_offs').delete().eq('vendor_profile_id', vendorProfileId).eq('task_key', key);
  if (write.error) {
    logQueryError(`todayPutOff.${op}`, write.error, { vendorProfileId }, 'graceful_degrade');
    return { ok: false, message: PUT_OFF_WORDS.failed };
  }
  revalidatePath('/vendor-dashboard');
  return { ok: true, message: op === 'put' ? PUT_OFF_WORDS.moved : 'Back on Today.' };
}
