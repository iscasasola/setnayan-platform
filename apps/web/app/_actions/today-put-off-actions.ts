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
 *   { ..., scope: 'event', eventId } the event's Today (owner 20 Nov 2026, "Event Today, Focus shape"), for THAT person
 *                         only on THAT event (`event_today_put_offs`): *"one host may choose to do it tomorrow but the
 *                         other host hasn't"* — every other host still sees the task on Today
 *
 * 🔢 ONE EXPORT ON PURPOSE: every exported server action is a Vercel route and the budget
 * (`scripts/lint-server-action-budget.mjs`) had exactly one left.
 *
 * 🔑 Runs under the CALLER'S OWN session, so RLS (migration 20271354681750) is the rule: a shop's owner or team writes
 * its own rows, signed as itself. Whether a row is red is decided where its deadline is read, and a red row ignores
 * any record (`lib/today-put-off.ts`), so no record written here can ever hide an urgent task.
 * Every outcome is said in words — never a silent no-op.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { resolveActiveShopId } from '@/lib/active-shop';
import { manilaToday } from '@/lib/chat-cards';
import { EVENT_PUT_OFF_KEY, FOCUS_PUT_OFF_KEY, PUT_OFF_KEY, PUT_OFF_WORDS, tomorrowOf } from '@/lib/today-put-off';
import { isUuid } from '@/lib/is-uuid';

export type TodayPutOffResult = { ok: boolean; message: string };

export async function todayPutOff(input: { op: 'put' | 'undo'; key: string; scope?: 'shop' | 'admin' | 'event'; eventId?: string }): Promise<TodayPutOffResult> {
  const op = input?.op;
  const scope = input?.scope === 'admin' ? 'admin' : input?.scope === 'event' ? 'event' : 'shop';
  const key = typeof input?.key === 'string' ? input.key : '';
  const keyShape = scope === 'admin' ? FOCUS_PUT_OFF_KEY : scope === 'event' ? EVENT_PUT_OFF_KEY : PUT_OFF_KEY;
  if ((op !== 'put' && op !== 'undo') || !keyShape.test(key)) return { ok: false, message: 'That task was not found.' };
  const eventId = scope === 'event' && isUuid(input?.eventId) ? input.eventId : null;
  if (scope === 'event' && !eventId) return { ok: false, message: 'That event was not found.' };
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
  if (scope === 'event' && eventId) {
    // This PERSON'S own record on this event (RLS: user_id = auth.uid() and the event is one of theirs) — every other
    // host still sees the task on Today (owner 20 Nov: "they have independent tasks").
    const write =
      op === 'put'
        ? await supabase
            .from('event_today_put_offs')
            .upsert({ event_id: eventId, user_id: user.id, task_key: key, until_day: tomorrowOf(manilaToday()), put_off_at: new Date().toISOString() }, { onConflict: 'event_id,user_id,task_key' })
        : await supabase.from('event_today_put_offs').delete().eq('event_id', eventId).eq('user_id', user.id).eq('task_key', key);
    if (write.error) {
      logQueryError(`todayPutOff.event.${op}`, write.error, { event_id: eventId }, 'graceful_degrade');
      return { ok: false, message: PUT_OFF_WORDS.failed };
    }
    revalidatePath(`/dashboard/${eventId}`);
    return { ok: true, message: op === 'put' ? PUT_OFF_WORDS.moved : 'Back on Today.' };
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
