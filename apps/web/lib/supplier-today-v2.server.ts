import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { coverIsSet } from '@/lib/service-publish-gate';
import { readCompletedBookingsCount } from '@/lib/badge-rewards.server';
import { getVendorDemandRadar, DEMAND_RADAR_UNREADABLE, type DemandRadar } from '@/lib/demand-radar';
import type { DoneTodayCounts } from '@/lib/supplier-today-v2';
import { fetchGrowLines } from '@/lib/platform-settings';
import { fetchCapsWithAddOns } from '@/lib/vendor-ultra-addons';
import type { PutOffRecord } from '@/lib/today-put-off';

/**
 * lib/supplier-today-v2.server.ts — THE READS TODAY v2 ADDS (owner 18 Nov, `Today, one task` v2, "all picks").
 *
 * All of them start together, beside the page's wave 2 — never a wave of their own — and every one fails SOFT and SAYS
 * so (null), so a refused read never draws as "nothing done", "no badge" or "nothing trending":
 *
 *   · done today — five counts off the columns that already stamp each answer (Rule 0 rule 3: no table of its own);
 *   · the service cards with no cover photo (`coverIsSet`, the database trigger's own test);
 *   · a card holding Trending Now (`service_card_badge_holds`, the held row the card badges already keep);
 *   · Completed bookings — the ONE count the Next badge card needs (`shop_completed_bookings_count`);
 *   · the demand radar (`demand_radar_for_vendor`, min-N enforced in the RPC);
 *   · the owner's two grow lines (`platform_settings`), null = not set = off.
 */

export type TodayV2Reads = {
  done: DoneTodayCounts | null;
  noCover: { serviceId: string; title: string } | null;
  /** The live service cards could not be read — `noCover: null` then means UNKNOWN, never "every card has a cover". */
  coversUnread: boolean;
  trendingCard: { title: string } | null;
  completedBookings: number | null;
  radar: DemandRadar | null;
  cutoffs: { fewInquiries: number | null; fewBookings: number | null };
  /** Approved, live inspiration photos — the Inspiration box's own predicates (`badge-rewards.server.ts`); null unread. */
  inspirationPhotos: number | null;
  /**
   * ▦ The plan's LIVE total and this shop's live and hidden cards, counted as the live gate counts them
   * (`services/actions.ts` `liveCardsCapRefusal`: `fetchCapsWithAddOns(...).serviceCardsTotal`, a founder unlimited,
   * branch copies left out). Null = unread, or no limit applies — no row is drawn.
   */
  cardRoom: { allowed: number; live: number; hidden: number } | null;
  /**
   * ⏭ v3 part 2 — the shop's "Do it tomorrow" records still in force (`supplier_today_put_offs`, until_day after today).
   * Null = unread: then NO task is held off (every task stays listed — an unread record never hides work).
   */
  putOffs: PutOffRecord[] | null;
};

/** Manila midnight of `todayIso`, as an instant. */
export function manilaMidnightIso(todayIso: string): string {
  return new Date(`${todayIso}T00:00:00+08:00`).toISOString();
}

const count = (r: { count: number | null; error: unknown }) => (r.error || r.count == null ? null : r.count);

async function readDoneToday(admin: SupabaseClient, vendorProfileId: string, since: string): Promise<DoneTodayCounts | null> {
  const ev = () => admin.from('event_vendors').select('vendor_id', { count: 'exact', head: true }).eq('marketplace_vendor_id', vendorProfileId);
  const thread = () => admin.from('chat_threads').select('thread_id', { count: 'exact', head: true }).eq('vendor_profile_id', vendorProfileId);
  // 🔑 EVERY ANSWER THAT LEAVES THE LIST IS COUNTED, so "N of M done" only grows as the supplier works (a row that left
  // without being counted made M shrink instead). Each count reads the column that already stamps that answer.
  // (A dispute is not here on purpose: nothing the supplier does today takes it off the list — it leaves when the
  // couple accepts the re-sent work — so it never moves from "left" to "done" by the supplier's own answer.)
  const [replies, payments, paymentsDeclined, delivered, agreed, declined, dates, inquiriesAccepted, inquiriesDeclined, meetings, cancels] = await Promise.all([
    admin.from('vendor_reviews').select('review_id', { count: 'exact', head: true }).eq('vendor_profile_id', vendorProfileId).gte('vendor_reply_at', since),
    ev().gte('deposit_acknowledged_at', since),
    ev().gte('deposit_declined_at', since),
    ev().gte('service_marked_complete_at', since),
    ev().gte('lock_agreed_at', since),
    ev().gte('lock_declined_at', since),
    admin.from('event_date_change_answers').select('event_vendor_id', { count: 'exact', head: true }).eq('vendor_profile_id', vendorProfileId).gte('answered_at', since),
    thread().gte('accepted_at', since),
    thread().gte('declined_at', since),
    // A couple's proposed meeting time that is no longer `proposed` and changed today = answered today.
    admin.from('event_appointments').select('appointment_id', { count: 'exact', head: true }).eq('vendor_profile_id', vendorProfileId).eq('initiated_by', 'couple').neq('status', 'proposed').gte('updated_at', since),
    ev().gte('delete_answered_at', since),
  ]);
  const all = [replies, payments, paymentsDeclined, delivered, agreed, declined, dates, inquiriesAccepted, inquiriesDeclined, meetings, cancels];
  const bad = all.find((r) => r.error);
  if (bad) {
    logQueryError('supplier-today-v2: done today', bad.error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return null;
  }
  return {
    replies: count(replies) ?? 0,
    payments: (count(payments) ?? 0) + (count(paymentsDeclined) ?? 0),
    delivered: count(delivered) ?? 0,
    bookings: (count(agreed) ?? 0) + (count(declined) ?? 0),
    dates: count(dates) ?? 0,
    inquiries: (count(inquiriesAccepted) ?? 0) + (count(inquiriesDeclined) ?? 0),
    meetings: count(meetings) ?? 0,
    cancels: count(cancels) ?? 0,
  };
}

async function readCards(supabase: SupabaseClient, admin: SupabaseClient, vendorProfileId: string) {
  const [services, holds] = await Promise.all([
    supabase.from('vendor_services').select('vendor_service_id, title, primary_photo_r2_key').eq('vendor_profile_id', vendorProfileId).eq('is_active', true).order('created_at', { ascending: true }),
    admin.from('service_card_badge_holds').select('vendor_service_id').eq('vendor_profile_id', vendorProfileId).eq('badge', 'trending_now').is('lost_at', null).limit(1),
  ]);
  if (services.error) logQueryError('supplier-today-v2: cards', services.error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
  if (holds.error) logQueryError('supplier-today-v2: trending hold', holds.error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
  const rows = (services.error ? [] : (services.data ?? [])) as Array<{ vendor_service_id: string; title: string | null; primary_photo_r2_key: string | null }>;
  const bare = rows.find((r) => !coverIsSet(r.primary_photo_r2_key));
  const heldId = holds.error ? null : ((holds.data ?? []) as Array<{ vendor_service_id: string }>)[0]?.vendor_service_id ?? null;
  const held = heldId ? rows.find((r) => r.vendor_service_id === heldId) : null;
  return {
    noCover: bare ? { serviceId: bare.vendor_service_id, title: bare.title?.trim() || 'A service card' } : null,
    // 🔑 A refused cards read is UNREAD — never "no card is missing a cover" (that would skip grow stage 2).
    coversUnread: Boolean(services.error),
    trendingCard: held ? { title: held.title?.trim() || 'service' } : null,
  };
}


/**
 * ▦ The live total and the cards, for "You can turn on N more". The numbers are READ (the plan's caps + bought add-ons),
 * never typed here. Any refused read → null: an unread number decides nothing.
 */
async function readCardRoom(supabase: SupabaseClient, vendorProfileId: string): Promise<TodayV2Reads['cardRoom']> {
  const cards = () => supabase.from('vendor_services').select('vendor_service_id', { count: 'exact', head: true }).eq('vendor_profile_id', vendorProfileId).is('branch_copy_of', null);
  const [tier, live, hidden] = await Promise.all([
    supabase.from('vendor_profiles').select('tier_state, is_founder').eq('vendor_profile_id', vendorProfileId).maybeSingle(),
    cards().eq('is_active', true),
    cards().eq('is_active', false),
  ]);
  const bad = tier.error ?? live.error ?? hidden.error;
  if (bad || !tier.data || live.count == null || hidden.count == null) {
    logQueryError('supplier-today-v2: card room', bad ?? { message: 'no row' }, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const t = tier.data as { tier_state: string | null; is_founder: boolean | null };
  // A founder has no live limit (the gate's own override) — nothing to count down, so no row.
  if (t.is_founder === true) return null;
  const caps = await fetchCapsWithAddOns(supabase, vendorProfileId, t.tier_state);
  return Number.isFinite(caps.serviceCardsTotal) ? { allowed: caps.serviceCardsTotal, live: live.count, hidden: hidden.count } : null;
}

async function readInspirationPhotos(admin: SupabaseClient, vendorProfileId: string): Promise<number | null> {
  const r = await admin
    .from('moodboard_library_assets')
    .select('asset_id', { count: 'exact', head: true })
    .eq('vendor_profile_id', vendorProfileId)
    .eq('asset_type', 'supplier_gallery')
    .not('approved_at', 'is', null)
    .is('retired_at', null)
    .is('rejected_at', null);
  if (r.error) logQueryError('supplier-today-v2: inspiration photos', r.error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
  return count(r);
}

async function readCutoffs(admin: SupabaseClient): Promise<TodayV2Reads['cutoffs']> {
  // The admin page's own reader — one rule for "set", "not set" and "could not be read" (unread decides nothing: off).
  const g = await fetchGrowLines(admin);
  return g.read ? { fewInquiries: g.fewInquiries, fewBookings: g.fewBookings } : { fewInquiries: null, fewBookings: null };
}

async function readPutOffs(supabase: SupabaseClient, vendorProfileId: string, todayIso: string): Promise<PutOffRecord[] | null> {
  // The caller's own session: RLS (migration 20271352477387) is the shop's own rows.
  const r = await supabase.from('supplier_today_put_offs').select('task_key, until_day').eq('vendor_profile_id', vendorProfileId).gt('until_day', todayIso).limit(200);
  if (r.error) {
    logQueryError('supplier-today-v2: put-offs', r.error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return null;
  }
  return (r.data ?? []) as PutOffRecord[];
}

export async function readTodayV2(args: { supabase: SupabaseClient; admin: SupabaseClient; vendorProfileId: string; todayIso: string }): Promise<TodayV2Reads> {
  const { supabase, admin, vendorProfileId, todayIso } = args;
  const [done, cards, completedBookings, radar, cutoffs, inspirationPhotos, cardRoom, putOffs] = await Promise.all([
    readDoneToday(admin, vendorProfileId, manilaMidnightIso(todayIso)).catch(() => null),
    readCards(supabase, admin, vendorProfileId).catch(() => ({ noCover: null, coversUnread: true, trendingCard: null })),
    readCompletedBookingsCount(admin, vendorProfileId).catch(() => null),
    getVendorDemandRadar(supabase, vendorProfileId).catch(() => DEMAND_RADAR_UNREADABLE),
    readCutoffs(admin).catch(() => ({ fewInquiries: null, fewBookings: null })),
    readInspirationPhotos(admin, vendorProfileId).catch(() => null),
    readCardRoom(supabase, vendorProfileId).catch(() => null),
    readPutOffs(supabase, vendorProfileId, todayIso).catch(() => null),
  ]);
  return {
    done,
    noCover: cards.noCover,
    coversUnread: cards.coversUnread,
    trendingCard: cards.trendingCard,
    completedBookings,
    radar: radar === DEMAND_RADAR_UNREADABLE ? null : radar,
    cutoffs,
    inspirationPhotos,
    cardRoom,
    putOffs,
  };
}
