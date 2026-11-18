import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { hasVerifiedBadge } from '@/lib/verified-badge';
import {
  NO1_PLAN_GIFT,
  STORED_SEALS,
  displayedSeals,
  judgeVerifiedPartner,
  manilaYear,
  pickYearlySeals,
  sealWindow,
  top10PlaqueLine,
  yearlySealsMayRun,
  type PartnerFacts,
  type PartnerVerdict,
  type SealKey,
  type SealYearCandidate,
  type StoredSeal,
  type YearlyPicks,
} from '@/lib/shop-seals';

/**
 * shop-seals.server.ts — the seals engine's reads and its one writer (the badge build, J2). The rules are pure, in
 * `lib/shop-seals.ts`; the table and the two counting functions are migration 20271349936814.
 *
 * It EXTENDS the monthly Spotlight engine rather than running beside it (4b8cc3a3): the same verified pool, the same
 * review score (`topPickScore`) and the same top-10% rule (`MOST_BOOKING_PERCENTILE`), read once a YEAR into
 * `shop_seals`. `vendor_spotlight_awards` is not read, written or dropped here.
 *
 * Every read and write runs on the SERVICE ROLE, created here (`createAdminClient`): `shop_seals` takes no session
 * writes, and both counting functions are service_role only. Callers gate first (an admin action, a periodic job, a
 * shop's own facts door).
 *
 * 🔑 A FAILED READ SAYS SO. Each reader returns null on a refused read — never [] and never 0 — and the run stops
 * there: a yearly list picked from half the platform would give a real shop's seal to the wrong shop.
 */

const SITE = 'lib/shop-seals.server.ts';
const IN_CHUNK = 500;

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * `shop_seal_year_facts(from, to)` for seal year `year` (18 Dec → 17 Dec, `sealWindow`) — every non-demo shop with
 * activity in it. null = the read failed.
 */
export async function readSealYearFacts(
  year: number,
): Promise<Array<Omit<SealYearCandidate, 'verified' | 'trustedAvgRating' | 'trustedReviewCount'>> | null> {
  const win = sealWindow(year);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('shop_seal_year_facts', { p_from: win.from, p_to: win.to });
  if (error) {
    logQueryError(`${SITE}: shop_seal_year_facts`, error, { year }, 'graceful_degrade');
    return null;
  }
  const out = [];
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const id = typeof r.vendor_profile_id === 'string' ? r.vendor_profile_id : null;
    const completed = num(r.completed_events);
    const refunded = num(r.refunded_events);
    const cancelled = num(r.shop_cancellations);
    const inquiries = num(r.inquiries);
    const seconds = num(r.second_bookings);
    // A row with a count that did not come back as a number is not a row we can rank on.
    if (!id || completed === null || refunded === null || cancelled === null || inquiries === null || seconds === null) return null;
    out.push({
      vendorProfileId: id,
      completedEvents: completed,
      refundedEvents: refunded,
      shopCancellations: cancelled,
      inquiries,
      secondBookings: seconds,
    });
  }
  return out;
}

async function inChunks<T>(
  ids: ReadonlyArray<string>,
  read: (chunk: string[]) => Promise<{ data: T[] | null; error: unknown }>,
): Promise<T[] | null> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const { data, error } = await read(ids.slice(i, i + IN_CHUNK));
    if (error) return null;
    out.push(...(data ?? []));
  }
  return out;
}

/** Verified state (the pool) and lifetime trusted review stats for these shops. null = a read failed. */
async function readPoolFacts(
  admin: SupabaseClient,
  ids: ReadonlyArray<string>,
): Promise<Map<string, { listedVerified: boolean; plan: string | null; avg: number | null; count: number | null }> | null> {
  const profiles = await inChunks<Record<string, unknown>>(ids, async (chunk) => {
    const { data, error } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, verification_state, is_demo, tier_state')
      .in('vendor_profile_id', chunk);
    return { data: (data ?? null) as Record<string, unknown>[] | null, error };
  });
  if (!profiles) {
    logQueryError(`${SITE}: vendor_profiles (seal pool)`, new Error('refused'), {}, 'graceful_degrade');
    return null;
  }
  const stats = await inChunks<Record<string, unknown>>(ids, async (chunk) => {
    const { data, error } = await admin
      .from('vendor_trusted_review_stats')
      .select('vendor_profile_id, trusted_avg_rating, trusted_review_count')
      .in('vendor_profile_id', chunk);
    return { data: (data ?? null) as Record<string, unknown>[] | null, error };
  });
  if (!stats) {
    logQueryError(`${SITE}: vendor_trusted_review_stats (seal pool)`, new Error('refused'), {}, 'graceful_degrade');
    return null;
  }
  const byId = new Map<string, { avg: number | null; count: number | null }>();
  for (const s of stats) {
    if (typeof s.vendor_profile_id === 'string') {
      byId.set(s.vendor_profile_id, { avg: num(s.trusted_avg_rating), count: num(s.trusted_review_count) });
    }
  }
  const out = new Map<string, { listedVerified: boolean; plan: string | null; avg: number | null; count: number | null }>();
  for (const p of profiles) {
    if (typeof p.vendor_profile_id !== 'string') continue;
    // A shop with no trusted reviews has no stats row: that is a real 0, not an unread one.
    const s = byId.get(p.vendor_profile_id) ?? { avg: 0, count: 0 };
    out.set(p.vendor_profile_id, {
      // The pool of the monthly Spotlight awards these seals replace: verification_state = 'verified', never demo.
      listedVerified: p.verification_state === 'verified' && p.is_demo !== true,
      plan: typeof p.tier_state === 'string' ? p.tier_state : null,
      avg: s.avg,
      count: s.count,
    });
  }
  return out;
}

/** Every candidate for one year. null = a read failed (the run must not go on). */
export async function readSealYearCandidates(
  year: number,
): Promise<Array<SealYearCandidate & { plan: string | null }> | null> {
  const facts = await readSealYearFacts(year);
  if (!facts) return null;
  const admin = createAdminClient();
  const pool = await readPoolFacts(admin, facts.map((f) => f.vendorProfileId));
  if (!pool) return null;
  return facts.map((f) => {
    const p = pool.get(f.vendorProfileId);
    return {
      ...f,
      verified: p?.listedVerified ?? false,
      plan: p?.plan ?? null,
      trustedAvgRating: p ? p.avg : null,
      trustedReviewCount: p ? p.count : null,
    };
  });
}

type SealRow = {
  vendor_profile_id: string;
  seal: StoredSeal;
  award_year: number;
  facts: Record<string, unknown>;
  /** No. 1 only: its free plan year, owed until G3's gift-to-shop flow gives it (NO1_PLAN_GIFT). */
  plan_gift_state?: 'owed';
};

/**
 * The ONE writer. An award once given is never rewritten: a repeat run meets the UNIQUE keys and adds nothing
 * (`ignoreDuplicates`). Returns how many rows were new, or null when the write was refused.
 */
async function giveSeals(admin: SupabaseClient, rows: ReadonlyArray<SealRow>): Promise<number | null> {
  if (rows.length === 0) return 0;
  const { data, error } = await admin
    .from('shop_seals')
    .upsert(rows as SealRow[], { onConflict: 'vendor_profile_id,seal,award_year', ignoreDuplicates: true })
    .select('seal_award_id');
  if (error) {
    logQueryError(`${SITE}: shop_seals.upsert`, error, { rows: rows.length }, 'graceful_degrade');
    return null;
  }
  return (data ?? []).length;
}

export type YearlyRunResult =
  | { ran: false; why: string }
  | { ran: true; year: number; picks: YearlyPicks; given: number };

/**
 * Gives one seal year's seals: Top 10, No. 1, Most In-Demand and Clients' Choice. Refuses to run before 18 Dec (Manila)
 * of that year, or for a year before the first. Idempotent.
 */
export async function runYearlySeals(year: number, now: Date = new Date()): Promise<YearlyRunResult> {
  const may = yearlySealsMayRun(year, now);
  if (!may.ok) return { ran: false, why: may.why };
  const candidates = await readSealYearCandidates(year);
  if (!candidates) return { ran: false, why: 'a read failed — nothing was given' };

  const picks = pickYearlySeals(candidates);
  const byId = new Map(candidates.map((c) => [c.vendorProfileId, c]));
  const factsOf = (id: string, extra: Record<string, unknown> = {}) => {
    const c = byId.get(id)!;
    return {
      completed_events: c.completedEvents,
      refunded_events: c.refundedEvents,
      inquiries: c.inquiries,
      second_bookings: c.secondBookings,
      trusted_avg_rating: c.trustedAvgRating,
      trusted_review_count: c.trustedReviewCount,
      ...extra,
    };
  };
  const rows: SealRow[] = [
    ...picks.top10.map((r) => ({
      vendor_profile_id: r.vendorProfileId,
      seal: 'top10' as const,
      award_year: year,
      // The plaque SHOWS the exact rank (11d044c0 (5)).
      facts: factsOf(r.vendorProfileId, { rank: r.rank, score: r.score, plaque_line: top10PlaqueLine(r.rank, year) }),
    })),
    ...(picks.no1
      ? [
          {
            vendor_profile_id: picks.no1.vendorProfileId,
            seal: 'no1' as const,
            award_year: year,
            // The free year is of the plan the shop is on NOW (7fbff0cd (6)) — recorded so G3 gives the right one.
            facts: factsOf(picks.no1.vendorProfileId, {
              score: picks.no1.score,
              plan_at_award: byId.get(picks.no1.vendorProfileId)!.plan,
              plan_gift: NO1_PLAN_GIFT,
            }),
            plan_gift_state: NO1_PLAN_GIFT.recordedAs,
          },
        ]
      : []),
    ...picks.mostInDemand.map((id) => ({ vendor_profile_id: id, seal: 'most_in_demand' as const, award_year: year, facts: factsOf(id) })),
    ...(picks.clientsChoice
      ? [{ vendor_profile_id: picks.clientsChoice, seal: 'clients_choice' as const, award_year: year, facts: factsOf(picks.clientsChoice) }]
      : []),
  ];
  const given = await giveSeals(createAdminClient(), rows);
  if (given === null) return { ran: false, why: 'the write was refused — nothing was given' };
  return { ran: true, year, picks, given };
}

// ── Verified Partner ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Rule 10 (ruled 7fbff0cd): suppliers the shop IMPORTED whose event is COMPLETED. ⚠ NO SOURCE YET: the supplier-
 * import door is not built (6439 (4): until it is, Invites ships "Not counted yet"), and nothing in the schema records
 * a shop importing another supplier (vendor_invites is a COUPLE inviting a supplier). It answers null — "unread" — so
 * Verified Partner cannot be given until the door and its counter exist; this function is where that counter plugs in.
 */
async function readCountedInvites(_vendorProfileId: string): Promise<number | null> {
  return null;
}

/** Everything the ten rules read, for one shop. Each part that fails is null, never 0. */
export async function readPartnerFacts(vendorProfileId: string): Promise<PartnerFacts> {
  const admin = createAdminClient();
  const [profile, stats, counters, invites] = await Promise.all([
    admin
      .from('vendor_profiles')
      .select('verification_state, next_renewal_due_at')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle(),
    admin
      .from('vendor_trusted_review_stats')
      .select('trusted_avg_rating, trusted_review_count')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle(),
    admin.rpc('shop_verified_partner_facts', { p_vendor_profile_id: vendorProfileId }),
    readCountedInvites(vendorProfileId),
  ]);

  if (profile.error) logQueryError(`${SITE}: vendor_profiles (partner)`, profile.error, { vendorProfileId }, 'graceful_degrade');
  if (stats.error) logQueryError(`${SITE}: vendor_trusted_review_stats (partner)`, stats.error, { vendorProfileId }, 'graceful_degrade');
  if (counters.error) logQueryError(`${SITE}: shop_verified_partner_facts`, counters.error, { vendorProfileId }, 'graceful_degrade');

  const p = profile.error || !profile.data ? null : (profile.data as Record<string, unknown>);
  const s = stats.error ? null : ((stats.data as Record<string, unknown> | null) ?? { trusted_avg_rating: 0, trusted_review_count: 0 });
  const rows = counters.error ? null : ((counters.data ?? []) as Record<string, unknown>[]);
  const c = rows && rows.length === 1 ? rows[0]! : null;

  return {
    verified: p
      ? hasVerifiedBadge({
          verification_state: typeof p.verification_state === 'string' ? p.verification_state : null,
          next_renewal_due_at: typeof p.next_renewal_due_at === 'string' ? p.next_renewal_due_at : null,
        })
      : null,
    bookedTotalPhp: c ? num(c.booked_total_php) : null,
    findBookings: c ? num(c.find_bookings) : null,
    websiteBookings: c ? num(c.website_bookings) : null,
    qrImportBookings: c ? num(c.qr_import_bookings) : null,
    bookingQrEvents: c ? num(c.booking_qr_events) : null,
    trustedAvgRating: s ? num(s.trusted_avg_rating) : null,
    trustedReviewCount: s ? num(s.trusted_review_count) : null,
    recommenders: c ? num(c.recommenders) : null,
    invites,
  };
}

/**
 * Judges the ten rules and, when every one is met, gives the seal — once, for life ("given the day its rules are
 * met", 6451). Returns the verdict either way, so a caller can show which rules are still open.
 */
export async function awardVerifiedPartnerIfEarned(
  vendorProfileId: string,
  now: Date = new Date(),
): Promise<PartnerVerdict & { given: boolean }> {
  const facts = await readPartnerFacts(vendorProfileId);
  const verdict = judgeVerifiedPartner(facts);
  if (!verdict.earned) return { ...verdict, given: false };
  const admin = createAdminClient();
  const { error } = await admin.from('shop_seals').insert({
    vendor_profile_id: vendorProfileId,
    seal: 'verified_partner',
    award_year: manilaYear(now),
    facts: {
      booked_total_php: facts.bookedTotalPhp,
      find_bookings: facts.findBookings,
      website_bookings: facts.websiteBookings,
      qr_import_bookings: facts.qrImportBookings,
      booking_qr_events: facts.bookingQrEvents,
      trusted_avg_rating: facts.trustedAvgRating,
      recommenders: facts.recommenders,
      invites: facts.invites,
    },
  });
  // 23505 = it already holds the seal (for life): nothing new, not a failure.
  if (error && (error as { code?: string }).code !== '23505') {
    logQueryError(`${SITE}: shop_seals.insert (verified_partner)`, error, { vendorProfileId }, 'graceful_degrade');
    return { ...verdict, given: false };
  }
  return { ...verdict, given: !error };
}

// ── What a shop wears ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * A shop's seals, in order — its stored seals plus Setnayan Verified (live), with Verified Partner replacing it.
 * null = the read failed: the caller shows nothing about seals, never "no seals".
 */
export async function readShopSeals(
  vendorProfileId: string,
  holdsVerifiedBadge: boolean,
): Promise<{ seals: SealKey[]; rows: Array<{ seal: StoredSeal; award_year: number; awarded_at: string }> } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('shop_seals')
    .select('seal, award_year, awarded_at')
    .eq('vendor_profile_id', vendorProfileId)
    .order('award_year', { ascending: false });
  if (error) {
    logQueryError(`${SITE}: shop_seals.select`, error, { vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const rows = ((data ?? []) as Array<{ seal: string; award_year: number; awarded_at: string }>).filter(
    (r): r is { seal: StoredSeal; award_year: number; awarded_at: string } => (STORED_SEALS as readonly string[]).includes(r.seal),
  );
  return { seals: displayedSeals(rows.map((r) => r.seal), holdsVerifiedBadge), rows };
}
