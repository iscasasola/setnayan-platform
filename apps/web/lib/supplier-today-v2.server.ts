import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { coverIsSet } from '@/lib/service-publish-gate';
import { readCompletedBookingsCount } from '@/lib/badge-rewards.server';
import { getVendorDemandRadar, DEMAND_RADAR_UNREADABLE, type DemandRadar } from '@/lib/demand-radar';
import type { DoneTodayCounts } from '@/lib/supplier-today-v2';
import { fetchGrowLines } from '@/lib/platform-settings';

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
  trendingCard: { title: string } | null;
  completedBookings: number | null;
  radar: DemandRadar | null;
  cutoffs: { fewInquiries: number | null; fewBookings: number | null };
  /** Approved, live inspiration photos — the Inspiration box's own predicates (`badge-rewards.server.ts`); null unread. */
  inspirationPhotos: number | null;
  /**
   * ▦ The cards the plan holds and the cards made, counted as the create gate counts them (`services/actions.ts`:
   * `fetchCapsWithAddOns(...).serviceCardsTotal`, a founder unlimited, every card but a branch copy). Null = unread.
   */
  cardRoom: { allowed: number; made: number } | null;
};

/** Manila midnight of `todayIso`, as an instant. */
export function manilaMidnightIso(todayIso: string): string {
  return new Date(`${todayIso}T00:00:00+08:00`).toISOString();
}

const count = (r: { count: number | null; error: unknown }) => (r.error || r.count == null ? null : r.count);

async function readDoneToday(admin: SupabaseClient, vendorProfileId: string, since: string): Promise<DoneTodayCounts | null> {
  const ev = () => admin.from('event_vendors').select('vendor_id', { count: 'exact', head: true }).eq('marketplace_vendor_id', vendorProfileId);
  const [replies, payments, delivered, agreed, declined, dates] = await Promise.all([
    admin.from('vendor_reviews').select('review_id', { count: 'exact', head: true }).eq('vendor_profile_id', vendorProfileId).gte('vendor_reply_at', since),
    ev().gte('deposit_acknowledged_at', since),
    ev().gte('service_marked_complete_at', since),
    ev().gte('lock_agreed_at', since),
    ev().gte('lock_declined_at', since),
    admin.from('event_date_change_answers').select('event_vendor_id', { count: 'exact', head: true }).eq('vendor_profile_id', vendorProfileId).gte('answered_at', since),
  ]);
  const all = [replies, payments, delivered, agreed, declined, dates];
  const bad = all.find((r) => r.error);
  if (bad) {
    logQueryError('supplier-today-v2: done today', bad.error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return null;
  }
  return {
    replies: count(replies) ?? 0,
    payments: count(payments) ?? 0,
    delivered: count(delivered) ?? 0,
    bookings: (count(agreed) ?? 0) + (count(declined) ?? 0),
    dates: count(dates) ?? 0,
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
    trendingCard: held ? { title: held.title?.trim() || 'service' } : null,
  };
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

export async function readTodayV2(args: { supabase: SupabaseClient; admin: SupabaseClient; vendorProfileId: string; todayIso: string }): Promise<TodayV2Reads> {
  const { supabase, admin, vendorProfileId, todayIso } = args;
  const [done, cards, completedBookings, radar, cutoffs, inspirationPhotos, cardRoom] = await Promise.all([
    readDoneToday(admin, vendorProfileId, manilaMidnightIso(todayIso)).catch(() => null),
    readCards(supabase, admin, vendorProfileId).catch(() => ({ noCover: null, trendingCard: null })),
    readCompletedBookingsCount(admin, vendorProfileId).catch(() => null),
    getVendorDemandRadar(supabase, vendorProfileId).catch(() => DEMAND_RADAR_UNREADABLE),
    readCutoffs(admin).catch(() => ({ fewInquiries: null, fewBookings: null })),
    readInspirationPhotos(admin, vendorProfileId).catch(() => null),
    // ⏸ THE CARDS ROW IS OFF (owner 2026-11-19: "we already agreed they can add as many … so we can motivate them to
    // upgrade"): making cards is unlimited — the plan limits how many are LIVE. The row comes back as "You can turn on
    // N more" once the plans fix moves the limit to live cards; until then nothing is read and no row is drawn.
    Promise.resolve(null as TodayV2Reads['cardRoom']),
  ]);
  return {
    done,
    noCover: cards.noCover,
    trendingCard: cards.trendingCard,
    completedBookings,
    radar: radar === DEMAND_RADAR_UNREADABLE ? null : radar,
    cutoffs,
    inspirationPhotos,
    cardRoom,
  };
}
