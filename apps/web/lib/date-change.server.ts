import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { datePickClash } from '@/lib/date-clash.server';
import { eventDatePrecisionOf, type EventDatePrecision } from '@/lib/events';
import { emptyHubDraft, mergeHubDraft } from '@/lib/hub-draft';
import { readHubDraft, writeHubDraft } from '@/lib/hub-draft-store';
import { notifyWaitlistIfBookingReleased } from '@/lib/vendor-waitlist';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  dateChangeRefusalText,
  dateChangeWhen,
  dateMoveClearance,
  dateMovedNotice,
  summarizeDateChange,
  type DateChangeAction,
  type DateChangeAnswerRow,
  type DateChangeView,
  type SupplierDateAnswer,
} from '@/lib/date-change';

/**
 * date-change.server.ts — THE CLASHING-DATE FLOW, SERVER HALF (owner 2026-10-01;
 * Q8 2026-10-02). The rules are in `lib/date-change.ts` (pure) and in the
 * database functions (`20271259875335_a_clashing_date_goes_to_the_supplier.sql`)
 * — the ask, the answer, the couple's settle, and the one release both Unlock
 * and Drop run. This file wires them to the shipped pieces:
 *
 *   · WHO CLASHES — `datePickClash` (lib/date-clash.server.ts), the matrix the
 *     date finder and Compare read; never a second availability check.
 *   · WHO IS TOLD — `emitNotification` + its email allowlist (the four
 *     `date_change_*` / `date_moved` types — two halves of one mechanism).
 *   · WHERE THE DATE GOES — the couple's Event Hub DRAFT; it goes live only
 *     through Apply (the Maker rule), which asks `dateApplyClearance`.
 *   · THE MONEY — never computed: an unlock with money logged opens the admin
 *     case in SQL with the booking's own terms on it; here the admins are told.
 *
 * Every notice is best-effort: the answer is already recorded, and a mail
 * hiccup must never roll it back.
 */

type Client = SupabaseClient;
type DraftClient = Parameters<typeof writeHubDraft>[0];

const SUPPLIER_DESK = '/vendor-dashboard#today-all';

/* ── reads ─────────────────────────────────────────────────────────────────── */

/**
 * The event's OPEN request, summarised — or null when there is none.
 * `{ ok: false }` when it could not be read (a Home that cannot read it shows
 * nothing rather than "no request").
 */
export async function readOpenDateChange(
  client: Client,
  eventId: string,
  now = Date.now(),
): Promise<{ ok: true; view: DateChangeView | null } | { ok: false }> {
  const { data: req, error } = await client
    .from('event_date_change_requests')
    .select('request_id, proposed_date, proposed_precision, from_date, from_precision, asked_at')
    .eq('event_id', eventId)
    .eq('state', 'open')
    .maybeSingle();
  if (error) {
    logQueryError('readOpenDateChange.request', error, { eventId }, 'graceful_degrade');
    return { ok: false };
  }
  if (!req) return { ok: true, view: null };
  const r = req as { request_id: string; proposed_date: string; proposed_precision: string; from_date: string | null; from_precision: string | null; asked_at: string };
  const { data: rows, error: rowsErr } = await client
    .from('event_date_change_answers')
    .select('event_vendor_id, vendor_profile_id, answer, due_at, answered_at, money_flag_id')
    .eq('request_id', r.request_id);
  if (rowsErr) {
    logQueryError('readOpenDateChange.answers', rowsErr, { eventId }, 'graceful_degrade');
    return { ok: false };
  }
  const answerRows = (rows ?? []) as DateChangeAnswerRow[];
  const names = new Map<string, string>();
  if (answerRows.length > 0) {
    const { data: ev } = await client
      .from('event_vendors')
      .select('vendor_id, vendor_name')
      .in('vendor_id', answerRows.map((a) => a.event_vendor_id));
    for (const v of (ev ?? []) as Array<{ vendor_id: string; vendor_name: string | null }>) {
      if (v.vendor_name) names.set(v.vendor_id, v.vendor_name);
    }
  }
  return {
    ok: true,
    view: summarizeDateChange({
      requestId: r.request_id,
      proposedDate: r.proposed_date,
      proposedPrecision: eventDatePrecisionOf(r.proposed_precision) ?? 'day',
      fromDate: r.from_date,
      fromPrecision: eventDatePrecisionOf(r.from_precision) ?? 'day',
      askedAt: r.asked_at,
      rows: answerRows,
      names,
      now,
    }),
  };
}

/* ── who to tell ──────────────────────────────────────────────────────────── */

async function coupleUserIds(admin: Client, eventId: string): Promise<string[]> {
  const { data } = await admin.from('event_members').select('user_id').eq('event_id', eventId).eq('member_type', 'couple');
  return ((data ?? []) as Array<{ user_id: string | null }>).map((m) => m.user_id).filter((u): u is string => Boolean(u));
}

async function supplierUserIds(admin: Client, vendorProfileIds: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (vendorProfileIds.length === 0) return out;
  const { data } = await admin.from('vendor_profiles').select('vendor_profile_id, user_id').in('vendor_profile_id', [...vendorProfileIds]);
  for (const p of (data ?? []) as Array<{ vendor_profile_id: string; user_id: string | null }>) {
    if (p.user_id) out.set(p.vendor_profile_id, p.user_id);
  }
  return out;
}

async function eventName(admin: Client, eventId: string): Promise<string> {
  const { data } = await admin.from('events').select('display_name').eq('event_id', eventId).maybeSingle();
  return ((data as { display_name?: string | null } | null)?.display_name ?? '').trim() || 'A couple';
}

/** An admin case was opened for money (the manual path) — tell the admins, as the disputes page does. */
async function tellAdminsOfMoneyCases(admin: Client, flagIds: readonly string[]): Promise<void> {
  if (flagIds.length === 0) return;
  const { data: admins } = await admin.from('users').select('user_id').or('is_internal.eq.true,is_team_member.eq.true');
  for (const flagId of flagIds) {
    for (const a of (admins ?? []) as Array<{ user_id: string }>) {
      await emitNotification({
        userId: a.user_id,
        type: 'force_majeure_filed',
        title: 'Date change · a booking with money logged was released',
        body: 'Settle the payment by the cancellation terms on the booking — the case carries them.',
        relatedUrl: `/admin/force-majeure/${flagId}`,
      });
    }
  }
}

async function safely(what: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    console.error(`[date-change] ${what} failed:`, e);
  }
}

/* ── the draft ────────────────────────────────────────────────────────────── */

/**
 * EVERY SUPPLIER ANSWERED → THE NEW DATE ENTERS THE DRAFT (the Maker rule: it
 * goes live only through Apply). Written with whichever client the caller has —
 * the couple's own session, or the admin client when the last answer came from
 * a supplier (whose session cannot reach the couple's draft).
 */
export async function enterReadyDateIntoDraft(
  client: Client,
  eventId: string,
  date: { date: string; precision: EventDatePrecision },
): Promise<void> {
  const draftClient = client as unknown as DraftClient;
  const current = (await readHubDraft(draftClient, eventId)) ?? emptyHubDraft();
  await writeHubDraft(
    draftClient,
    eventId,
    mergeHubDraft(current, { events: { event_date: date.date, event_date_precision: date.precision } }),
  );
}

/** Withdraw puts the drafted date back to live — only if the draft holds the asked date. */
async function takeAskedDateOutOfDraft(client: Client, eventId: string, asked: string): Promise<void> {
  const draftClient = client as unknown as DraftClient;
  const current = await readHubDraft(draftClient, eventId);
  if (!current || current.events.event_date !== asked) return;
  const { data: live } = await client.from('events').select('event_date, event_date_precision').eq('event_id', eventId).maybeSingle();
  const row = (live ?? {}) as { event_date?: string | null; event_date_precision?: string | null };
  await writeHubDraft(
    draftClient,
    eventId,
    mergeHubDraft(current, { events: { event_date: row.event_date ?? null, event_date_precision: row.event_date_precision ?? null } }),
  );
}

/* ── the couple ───────────────────────────────────────────────────────────── */

export type DateChangeResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * "Ask them to move or unlock?" — the ONE confirm. The conflicting suppliers are
 * named HERE, by the server's own read (never a list from the browser), and the
 * database refuses any that is not a booked supplier of this event.
 */
export async function askDateChange({
  supabase,
  eventId,
  date,
  precision,
}: {
  supabase: Client;
  eventId: string;
  date: string;
  precision: EventDatePrecision;
}): Promise<DateChangeResult> {
  const admin = createAdminClient();
  const { data: liveRow } = await supabase.from('events').select('event_date, event_date_precision').eq('event_id', eventId).maybeSingle();
  const live = (liveRow ?? {}) as { event_date?: string | null; event_date_precision?: string | null };
  let clash;
  try {
    clash = await datePickClash({
      supabase,
      admin,
      eventId,
      date,
      precision,
      live: { date: live.event_date ?? null, precision: live.event_date_precision },
      failClosed: true,
    });
  } catch {
    return { ok: false, error: 'We could not check your suppliers’ calendars. Nothing was sent — please try again.' };
  }
  if (!clash) return { ok: false, error: dateChangeRefusalText('fits') };

  const { data, error } = await supabase.rpc('ask_event_date_change', {
    p_event_id: eventId,
    p_date: date,
    p_precision: precision,
    p_event_vendor_ids: clash.clash.map((c) => c.vendorId),
  });
  if (error) {
    return { ok: false, error: dateChangeRefusalText(error.code === '42501' ? 'not_couple' : undefined) };
  }
  const env = (data ?? {}) as { ok?: boolean; reason?: string; request_id?: string };
  if (env.ok !== true) return { ok: false, error: dateChangeRefusalText(env.reason) };

  await safely('ask notice', async () => {
    const { data: rows } = await admin
      .from('event_date_change_answers')
      .select('vendor_profile_id')
      .eq('request_id', env.request_id as string);
    const vps = [...new Set(((rows ?? []) as Array<{ vendor_profile_id: string }>).map((r) => r.vendor_profile_id))];
    const users = await supplierUserIds(admin, vps);
    const who = await eventName(admin, eventId);
    const from = live.event_date ? dateChangeWhen(live.event_date, eventDatePrecisionOf(live.event_date_precision) ?? 'day') : 'their current date';
    for (const vp of vps) {
      const userId = users.get(vp);
      if (!userId) continue;
      await emitNotification({
        userId,
        type: 'date_change_requested',
        title: `${who} asks to move their date`,
        body: `From ${from} to ${dateChangeWhen(date, precision)}. Move to the new date, or unlock your service — please answer within 3 days.`,
        relatedUrl: SUPPLIER_DESK,
        eventId,
      });
    }
  });
  return { ok: true, message: 'Asked. Your date stays as it is until every supplier answers — see it on Home.' };
}

/**
 * The couple's other choices: withdraw (anytime — "cancel the change") · keep
 * waiting · drop that supplier (both only after the 3 days).
 */
export async function settleDateChange({
  supabase,
  eventId,
  action,
  eventVendorId,
}: {
  supabase: Client;
  eventId: string;
  action: Exclude<DateChangeAction, 'ask'>;
  eventVendorId: string | null;
}): Promise<DateChangeResult> {
  const open = await readOpenDateChange(supabase, eventId);
  if (!open.ok) return { ok: false, error: dateChangeRefusalText(undefined) };
  if (!open.view) return { ok: false, error: dateChangeRefusalText('not_open') };
  const view = open.view;

  const { data, error } = await supabase.rpc('settle_event_date_change', {
    p_request_id: view.requestId,
    p_action: action,
    p_event_vendor_id: eventVendorId,
  });
  if (error) return { ok: false, error: dateChangeRefusalText(error.code === '42501' ? 'not_couple' : undefined) };
  const env = (data ?? {}) as { ok?: boolean; reason?: string; ready?: boolean; vendor_profile_id?: string; money_flag_ids?: string[] };
  if (env.ok !== true) return { ok: false, error: dateChangeRefusalText(env.reason) };

  const admin = createAdminClient();
  const who = await eventName(admin, eventId).catch(() => 'The couple');

  if (action === 'withdraw') {
    await safely('withdraw draft', () => takeAskedDateOutOfDraft(supabase, eventId, view.proposedDate));
    await safely('withdraw notice', async () => {
      const still = view.suppliers.filter((s) => s.answer === 'asked' || s.answer === 'moved');
      const users = await supplierUserIds(admin, still.map((s) => s.vendorProfileId));
      for (const s of still) {
        const userId = users.get(s.vendorProfileId);
        if (!userId) continue;
        await emitNotification({
          userId,
          type: 'date_change_closed',
          title: `${who} kept their date`,
          body: `They withdrew the ask to move to ${dateChangeWhen(view.proposedDate, view.proposedPrecision)}. Nothing changes for your booking.`,
          relatedUrl: SUPPLIER_DESK,
          eventId,
        });
      }
    });
    return { ok: true, message: 'Withdrawn. Your date stays as it is.' };
  }

  if (action === 'wait') return { ok: true, message: 'They have 3 more days to answer.' };

  // drop
  await safely('drop notice', async () => {
    const vp = env.vendor_profile_id;
    if (!vp) return;
    const userId = (await supplierUserIds(admin, [vp])).get(vp);
    if (!userId) return;
    await emitNotification({
      userId,
      type: 'date_change_closed',
      title: `${who} released your booking`,
      body: `You had not answered their ask to move to ${dateChangeWhen(view.proposedDate, view.proposedPrecision)} after 3 days, so they released the booking. Any payment is settled by the cancellation terms on the booking.`,
      relatedUrl: SUPPLIER_DESK,
      eventId,
    });
  });
  await safely('drop money', () => tellAdminsOfMoneyCases(admin, env.money_flag_ids ?? []));
  await safely('drop waitlist', async () => {
    const dropped = view.suppliers.find((s) => s.vendorProfileId === env.vendor_profile_id);
    for (const id of dropped?.eventVendorIds ?? []) await notifyWaitlistIfBookingReleased(id);
  });
  if (env.ready) {
    await safely('drop → draft', () => enterReadyDateIntoDraft(supabase, eventId, { date: view.proposedDate, precision: view.proposedPrecision }));
    return { ok: true, message: 'Released. Every supplier has answered — your new date is in your draft. Apply it in your Event Hub.' };
  }
  return { ok: true, message: 'Released. The others are still deciding.' };
}

/* ── the supplier ─────────────────────────────────────────────────────────── */

/**
 * Move to <date> · Unlock my service. The database decides who may answer and
 * releases the booking; this tells the couple (and, with money logged, the
 * admins), and when the last supplier answered puts the date in the draft.
 */
export async function answerDateChange({
  supabase,
  eventVendorId,
  answer,
  supplierName,
}: {
  supabase: Client;
  eventVendorId: string;
  answer: SupplierDateAnswer;
  supplierName: string;
}): Promise<{ ok: true; eventId: string } | { ok: false; reason: string }> {
  const { data, error } = await supabase.rpc('answer_event_date_change', {
    p_event_vendor_id: eventVendorId,
    p_answer: answer,
  });
  if (error) return { ok: false, reason: error.code === '42501' ? 'not_yours' : 'failed' };
  const env = (data ?? {}) as { ok?: boolean; reason?: string; request_id?: string; event_id?: string; ready?: boolean; money_flag_ids?: string[] };
  if (env.ok !== true || !env.event_id || !env.request_id) return { ok: false, reason: env.reason ?? 'failed' };
  const eventId = env.event_id;

  const admin = createAdminClient();
  const { data: reqRow } = await admin
    .from('event_date_change_requests')
    .select('proposed_date, proposed_precision')
    .eq('request_id', env.request_id)
    .maybeSingle();
  const req = (reqRow ?? null) as { proposed_date: string; proposed_precision: string } | null;
  const when = req ? dateChangeWhen(req.proposed_date, eventDatePrecisionOf(req.proposed_precision) ?? 'day') : 'the new date';

  let readyInDraft = false;
  if (env.ready && req) {
    await safely('answer → draft', async () => {
      await enterReadyDateIntoDraft(admin, eventId, { date: req.proposed_date, precision: eventDatePrecisionOf(req.proposed_precision) ?? 'day' });
      readyInDraft = true;
    });
  }
  const money = (env.money_flag_ids ?? []).length > 0;
  await safely('answer notice', async () => {
    for (const userId of await coupleUserIds(admin, eventId)) {
      await emitNotification({
        userId,
        type: 'date_change_answered',
        title: answer === 'moved' ? `${supplierName} can move to ${when}` : `${supplierName} unlocked their service`,
        body: [
          answer === 'unlocked'
            ? money
              ? 'They are no longer booked. Money was logged with them, so the payment is settled by the cancellation terms on your booking — Setnayan support has the case.'
              : 'They are no longer booked for your celebration.'
            : 'They confirmed they can do the new date.',
          env.ready
            ? readyInDraft
              ? 'Every supplier has answered — your new date is in your draft. Apply it in your Event Hub.'
              : 'Every supplier has answered — pick the date again in your Event Hub and Apply it.'
            : 'Others are still deciding.',
        ].join(' '),
        relatedUrl: `/dashboard/${eventId}`,
      });
    }
  });
  if (answer === 'unlocked') {
    await safely('unlock money', () => tellAdminsOfMoneyCases(admin, env.money_flag_ids ?? []));
    await safely('unlock waitlist', async () => {
      await notifyWaitlistIfBookingReleased(eventVendorId);
    });
  }
  return { ok: true, eventId };
}

/* ── the pick ─────────────────────────────────────────────────────────────── */

/**
 * The Maker's pick refuses a clashing date (#6241) — UNLESS every supplier it
 * clashes with already answered Move on the open request for exactly this
 * date (the couple re-picking it after an Undo, say). Null = the pick may go
 * to the draft; otherwise the clash as it was.
 */
export async function clashStillOpen<T extends { clash: Array<{ vendorId: string }> }>(
  supabase: Client,
  eventId: string,
  date: { date: string; precision: EventDatePrecision },
  clash: T | null,
): Promise<T | null> {
  if (!clash) return null;
  const open = await readOpenDateChange(supabase, eventId);
  if (!open.ok || !open.view) return clash;
  if (open.view.proposedDate !== date.date || open.view.proposedPrecision !== date.precision) return clash;
  const moved = open.view.suppliers.filter((s) => s.answer === 'moved').flatMap((s) => s.eventVendorIds);
  return dateMoveClearance({ clashing: clash.clash.map((c) => c.vendorId), moved }).cleared ? null : clash;
}

/* ── Apply ────────────────────────────────────────────────────────────────── */

/**
 * 🗓 MAY THIS DRAFTED DATE GO LIVE OVER BOOKED SUPPLIERS? Asked by Apply when
 * `eventDateRefusal` would say `locked`. FAIL-CLOSED: an unread supplier list or
 * calendar is `{ ok: false }`, never "everyone is free".
 *
 * Cleared when no booked supplier's calendar clashes (Q8 — a fitting date needs
 * no decision), or every one that clashes answered Move on the OPEN request for
 * exactly this date.
 */
export async function dateApplyClearance({
  supabase,
  eventId,
  prior,
  next,
}: {
  supabase: Client;
  eventId: string;
  prior: { date: string | null; precision: unknown };
  next: { date: string; precision: EventDatePrecision };
}): Promise<{ ok: true; cleared: boolean; requestId: string | null } | { ok: false }> {
  let clash;
  try {
    clash = await datePickClash({
      supabase,
      admin: createAdminClient(),
      eventId,
      date: next.date,
      precision: next.precision,
      live: prior,
      failClosed: true,
    });
  } catch {
    return { ok: false };
  }
  const open = await readOpenDateChange(supabase, eventId);
  if (!open.ok) return { ok: false };
  const request =
    open.view && open.view.proposedDate === next.date && open.view.proposedPrecision === next.precision ? open.view : null;
  const moved = request ? request.suppliers.filter((s) => s.answer === 'moved').flatMap((s) => s.eventVendorIds) : [];
  const { cleared } = dateMoveClearance({ clashing: (clash?.clash ?? []).map((c) => c.vendorId), moved });
  return { ok: true, cleared, requestId: request?.requestId ?? null };
}

/**
 * A NEW DATE WENT LIVE THROUGH APPLY: the request (if any) closes as applied,
 * and EVERY booked supplier gets the plain notice "The date moved to <date>" —
 * no decision (Q8). Their held day already moved with it in the database
 * (`events_booked_dates_follow_the_event`).
 */
export async function afterDateApplied({
  supabase,
  eventId,
  next,
  requestId,
}: {
  supabase: Client;
  eventId: string;
  next: { date: string; precision: EventDatePrecision };
  requestId: string | null;
}): Promise<void> {
  if (requestId) {
    await safely('applied', async () => {
      const { data, error } = await supabase.rpc('settle_event_date_change', { p_request_id: requestId, p_action: 'applied', p_event_vendor_id: null });
      // The date is already live; an unclosed request only keeps Home's card up
      // (it then says every supplier answered) — logged, never thrown.
      if (error || (data as { ok?: boolean } | null)?.ok !== true) {
        logQueryError('afterDateApplied.settle', error ?? { message: JSON.stringify(data) }, { requestId }, 'graceful_degrade');
      }
    });
  }
  await safely('date moved notice', async () => {
    const admin = createAdminClient();
    const { data: booked } = await admin
      .from('event_vendors')
      .select('marketplace_vendor_id')
      .eq('event_id', eventId)
      .in('status', ['contracted', 'deposit_paid', 'delivered', 'complete'])
      .not('marketplace_vendor_id', 'is', null);
    const vps = [...new Set(((booked ?? []) as Array<{ marketplace_vendor_id: string }>).map((b) => b.marketplace_vendor_id))];
    const users = await supplierUserIds(admin, vps);
    const who = await eventName(admin, eventId);
    for (const vp of vps) {
      const userId = users.get(vp);
      if (!userId) continue;
      await emitNotification({
        userId,
        type: 'date_moved',
        title: dateMovedNotice(next.date, next.precision),
        body: `${who} moved their celebration to ${dateChangeWhen(next.date, next.precision)}. Your calendar moved with it.`,
        relatedUrl: `/vendor-dashboard/clients/${eventId}`,
        eventId,
      });
    }
  });
}
