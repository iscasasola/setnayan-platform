import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from './supabase/admin';
import { emitNotification } from './notification-emit';
import { logQueryError } from './supabase/error-detect';
import { fromDatetimeLocalValue } from './schedule-datetime-local';
import { clockWords } from './schedule-chapters';
import { decideSuggestion, NOTHING_CHANGED } from './schedule-suggestion-decide.server';
import { answerNote, askedAsFor, askNote } from './schedule-ask';

/**
 * 🗓 THE HOST — OR THE COORDINATOR — ASKS A BOOKED SUPPLIER TO CHANGE THEIR TIMES; THE SUPPLIER ANSWERS (owner
 * 2026-11-02, DECISION_LOG "A SUPPLIER'S SCHEDULE BASICS FOR THIS WEEK" item 2; supplier gate audit D2). The server
 * half — the pure half and the why are in `lib/schedule-ask.ts`.
 *
 *   · ASK (`askSupplierToChange`) — from the moment sheet (`updateScheduleBlock`, moment_op `ask_supplier`: no new
 *     exported action, the budget is at its ceiling). Written on the CALLER's client: the database decides who may ask
 *     (`schedule_asks_host_insert`, migration 20271303655108) — the couple as 'host', a seat with The Day = Edit as
 *     'coordinator', only of a supplier booked on the event. The supplier is told in the app (`schedule_ask`).
 *   · ANSWER (`answerScheduleAsk`) — from the supplier's Schedule (`suggestScheduleChange`, request `answer`). The
 *     database says whether this supplier may answer (`may_answer_schedule_ask`); only then does the ONE accept path
 *     run with the service role (a supplier may not write the host's schedule — the asker's ask is what allows it).
 */

type Answer<T = string> = { ok: true; value: T } | { ok: false; error: string };

const NOT_SENT = 'That ask didn’t send — try again.';

export async function askSupplierToChange(
  supabase: SupabaseClient,
  userId: string,
  eventId: string,
  blockId: string,
  fd: FormData,
): Promise<Answer> {
  const bookingId = String(fd.get('vendor_id') ?? '');
  const start = fromDatetimeLocalValue(String(fd.get('start_at') ?? ''));
  const end = fromDatetimeLocalValue(String(fd.get('end_at') ?? ''));
  if (!bookingId || !start) return { ok: false, error: 'Pick the supplier and the new time first.' };

  // The booking → the shop it is (admin, scoped to this event: a coordinator may have Suppliers Off).
  const admin = createAdminClient();
  const [bookingRes, memberRes, meRes, blockRes] = await Promise.all([
    admin
      .from('event_vendors')
      .select('vendor_name, marketplace_vendor_id')
      .eq('event_id', eventId)
      .eq('vendor_id', bookingId)
      .maybeSingle(),
    supabase.from('event_members').select('user_id').eq('event_id', eventId).eq('user_id', userId).eq('member_type', 'couple').maybeSingle(),
    admin.from('users').select('display_name').eq('user_id', userId).maybeSingle(),
    supabase.from('event_schedule_blocks').select('label').eq('block_id', blockId).eq('event_id', eventId).maybeSingle(),
  ]);
  if (bookingRes.error) {
    logQueryError('askSupplierToChange.booking', bookingRes.error, { event_id: eventId }, 'graceful_degrade');
    return { ok: false, error: NOT_SENT };
  }
  const booking = bookingRes.data as { vendor_name: string | null; marketplace_vendor_id: string | null } | null;
  if (!booking) return { ok: false, error: 'That supplier is no longer on this event.' };
  const shop = booking.vendor_name?.trim() || 'This supplier';
  if (!booking.marketplace_vendor_id) {
    return { ok: false, error: `${shop} isn’t on Setnayan, so they can’t be asked here. Ask them in chat or by phone.` };
  }
  if (memberRes.error) logQueryError('askSupplierToChange.member', memberRes.error, { event_id: eventId }, 'graceful_degrade');
  const askedAs = askedAsFor(Boolean(memberRes.data));
  const asker = (meRes.data as { display_name: string | null } | null)?.display_name?.trim() || null;
  const moment = (blockRes.data as { label: string | null } | null)?.label?.trim() || 'a moment';
  const clock = clockWords(start);

  const { data, error } = await supabase
    .from('event_schedule_suggestions')
    .insert({
      event_id: eventId,
      block_id: blockId,
      vendor_profile_id: booking.marketplace_vendor_id,
      suggested_by_user_id: userId,
      suggested_by_name: asker,
      kind: 'adjust',
      direction: 'to_supplier',
      asked_as: askedAs,
      proposed_start_at: start,
      proposed_end_at: end && Date.parse(end) > Date.parse(start) ? end : null,
      note: askNote(String(fd.get('note') ?? ''), clock),
      status: 'open',
    })
    .select('suggestion_id')
    .maybeSingle();
  if (error || !data) {
    if (error?.code === '23505') return { ok: false, error: `${shop} hasn’t answered your last ask on this moment yet.` };
    if (error?.code === '42501') return { ok: false, error: `Only the hosts and a coordinator who edits the day can ask ${shop}.` };
    if (error) logQueryError('askSupplierToChange.insert', error, { event_id: eventId }, 'graceful_degrade');
    return { ok: false, error: NOT_SENT };
  }

  // Tell the supplier (best-effort: the ask is written; a failed notice never undoes it). In the app only.
  try {
    const { data: owner } = await admin
      .from('vendor_profiles')
      .select('user_id')
      .eq('vendor_profile_id', booking.marketplace_vendor_id)
      .maybeSingle();
    const ownerId = (owner as { user_id: string | null } | null)?.user_id;
    if (ownerId) {
      await emitNotification({
        userId: ownerId,
        type: 'schedule_ask',
        title: `${askedAs === 'coordinator' ? 'The coordinator' : 'The host'} asks you to move “${moment}” to ${clock}`,
        body: askNote(String(fd.get('note') ?? ''), clock).slice(0, 200),
        relatedUrl: `/vendor-dashboard/clients/${eventId}?tab=schedule`,
      });
    }
  } catch (e) {
    console.error('[askSupplierToChange] notify failed:', e);
  }
  // `<ask id>:<shop id>` — the sheet keys its "latest ask per supplier" on the shop, which only the server knows.
  return { ok: true, value: `${(data as { suggestion_id: string }).suggestion_id}:${booking.marketplace_vendor_id}` };
}

export async function answerScheduleAsk(
  supabase: SupabaseClient,
  userId: string,
  eventId: string,
  suggestionId: string,
  decision: 'accept' | 'decline',
  reasonRaw: unknown,
): Promise<Answer<'done' | 'gone'>> {
  // The database says whether THIS supplier was asked, is still booked, and the ask is still open.
  const { data: may, error } = await supabase.rpc('may_answer_schedule_ask', { p_suggestion_id: suggestionId });
  if (error) {
    logQueryError('answerScheduleAsk.may', error, { event_id: eventId }, 'graceful_degrade');
    return { ok: false, error: 'That answer didn’t send — try again.' };
  }
  if (may !== true) return { ok: true, value: 'gone' };
  try {
    const r = await decideSuggestion(createAdminClient(), userId, eventId, suggestionId, decision, false, {
      as: 'supplier',
      answerNote: decision === 'decline' ? answerNote(reasonRaw) : null,
    });
    return { ok: true, value: r === 'done' ? 'done' : 'gone' };
  } catch (e) {
    const said = e instanceof Error ? e.message : '';
    console.error('[answerScheduleAsk] refused', said, { event_id: eventId });
    return {
      ok: false,
      error: said === NOTHING_CHANGED ? 'That moment is gone, so there is nothing to change.' : 'That answer didn’t send — try again.',
    };
  }
}
