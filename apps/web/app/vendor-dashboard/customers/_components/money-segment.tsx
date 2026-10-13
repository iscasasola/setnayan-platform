import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readAllPages, readInChunks } from '@/lib/read-all-pages';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { canUseSoloBusinessTools } from '@/lib/vendor-tier-caps';
import { isVendorFeatureGateEnabled, resolveVendorTier } from '@/lib/vendor-feature-gate';
import { readVendorPaydayInstallments } from '@/lib/vendor-payday-read';
import { manilaTodayIso } from '@/lib/vendor-cashflow';
import { fetchVendorLedgerEarnings } from '@/lib/vendor-earnings';
import { earningsView, readVendorEarnings } from '@/lib/vendor-earnings-view';
import { PAYOUT_STAGE_LABEL, type PayoutStage } from '@/lib/payouts';
import { bookingFeeScheduleSummary } from '@/lib/booking-fee';
import { getLiveBookingFeeSchedule } from '@/lib/booking-fee-settings.server';
import { fetchDueFeeBills, fetchWaivedFeeCharges, FEE_BILLS_UNREADABLE } from '@/lib/booking-fee-disclosure.server';
import { billsForSurface, feeDueCopy, type DueFeeBill, type WaivedFeeCharge } from '@/lib/booking-fee-disclosure';
import { manilaToday } from '@/lib/std-views';
import { monthDay } from '@/lib/format-date';
import { moneyPicture, moneyWindowOf, moneyYear, type MoneyWindow, type MoneyYear } from '@/lib/vendor-money';
import { paginate } from '@/lib/paginate';
import { keepParamsFrom } from '../../_components/list-pager';
import { SupplierThumbRow } from '../../_components/supplier-thumb-row';
import { MoneyView, type MoneyLegacyPayout } from './money-view';
import { MoneyLog, type MoneyLogCustomer } from './money-log';

/**
 * CUSTOMERS › MONEY — the reads (S-PR4). Payday + earnings + the booking-fee bills, as one segment (plan § 2: the
 * old `#bookings` / `#payday` blocks on Customers and the `earnings/surface.tsx` mounted on Shop merge here; § 6
 * S-PR4 "payday + earnings + fee bills as one segment; Log a payment thumb; This-year fold; legacy payouts only when
 * present"). Each read is the SHIPPED one, moved — not a second copy:
 *
 *   · `readVendorPaydayInstallments` — every instalment, paged to the server's count. A read that did not reach
 *     the end is NOT a smaller total: the figures go unset and the page says so.
 *   · `fetchDueFeeBills` + `billsForSurface(…, 'earnings')` — this shop's unpaid booking fees (the `earnings` entry of
 *     BOOKING_FEE_BILL_SURFACES is this surface now; the key is the fee lane's and is not renamed here).
 *   · `fetchWaivedFeeCharges` — the waived ones, with the amount each would have cost.
 *   · `fetchVendorLedgerEarnings` through `readVendorEarnings` → `earningsView` — the year, `null` when unread.
 *   · `vendor_payouts` — the pre-2026 payout records, paged; drawn only when any exist.
 *
 * 🔗 THE FEE JOIN. Money reads the fee lane's seams and writes no fee logic. The booking-fee drafts (#6506–#6511)
 * widen `fetchWaivedFeeCharges` to promotion and launch-offer waivers and word them in `waivedFeeCopy` with the same
 * signatures — they show here unchanged the day those merge. #6507 changes the Solo-gate blurb to the LIVE rate on the
 * old earnings page; that sentence lives here now (`lockedLine` below) and carries the live rate (joined in batch 5).
 */

type SP = Record<string, string | string[] | undefined>;

const HUB = '/vendor-dashboard/customers';

export function moneyHref(window: MoneyWindow): string {
  return window === 'month' ? `${HUB}?seg=money` : `${HUB}?seg=money&next=${window}`;
}

type PayoutRow = {
  payout_id: string;
  payout_stage: PayoutStage | null;
  stage: string;
  amount_centavos: number;
  vendor_net_centavos: number | null;
  scheduled_at: string | null;
  paid_at: string | null;
  on_hold: boolean;
  order: { reference_code: string; description: string } | null;
};

export async function CustomersMoney({ search }: { search: SP }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const vendorProfileId = profile.vendor_profile_id;
  const today = manilaTodayIso();
  const window = moneyWindowOf(search.next);
  const admin = createAdminClient();

  // The year view is a Solo business tool (the old Earnings page's gate, moved with it). What comes in and what is
  // owed to Setnayan are never gated — a shop always sees its own money.
  const tier = await resolveVendorTier(supabase, vendorProfileId);
  const yearLocked = isVendorFeatureGateEnabled() && !canUseSoloBusinessTools(tier);

  const [paydayRead, feeBillsRead, waivedRead, earningsRead, payoutRead, feeSchedule] = await Promise.all([
    readVendorPaydayInstallments(supabase),
    // UNREADABLE renders a "couldn't load" row; it must never read as "you owe nothing".
    fetchDueFeeBills(supabase, user.id).catch(() => FEE_BILLS_UNREADABLE),
    fetchWaivedFeeCharges(admin, vendorProfileId).catch(() => FEE_BILLS_UNREADABLE),
    yearLocked ? Promise.resolve(null) : readVendorEarnings(() => fetchVendorLedgerEarnings(admin, vendorProfileId)),
    yearLocked
      ? Promise.resolve(null)
      : readAllPages(
          async (from, to) => {
            const { data, error, count } = await supabase
              .from('vendor_payouts')
              .select(
                `payout_id, payout_stage, stage, amount_centavos, vendor_net_centavos, scheduled_at, paid_at, on_hold,
                 order:orders!vendor_payouts_order_id_fkey(reference_code, description)`,
                { count: 'exact' },
              )
              .eq('vendor_profile_id', vendorProfileId)
              .order('scheduled_at', { ascending: true, nullsFirst: false })
              .order('payout_id', { ascending: true })
              .range(from, to);
            return { rows: data ?? null, error: error ? error.message : null, total: count };
          },
          { pageSize: 1000 },
        ),
    // The LIVE schedule for the locked year's line — never the code default (#6507, audit 2026-10-12 item 5).
    // NULL names the fee without a rate. Read only when the year is locked (the line is drawn only then).
    yearLocked ? getLiveBookingFeeSchedule() : Promise.resolve(null),
  ]);

  // ⚠ PAGED TO THE SERVER'S EXACT COUNT. A read that did not reach the end renders as "couldn't load", never as a
  // timeline that adds up to less.
  const paydayIncomplete = !paydayRead.complete;
  if (paydayIncomplete) {
    logQueryError('customers/money: vendor_payday_installments', {
      message: paydayRead.error ?? `read ${paydayRead.rows.length} rows without reaching the server count`,
    });
  }
  const picture = moneyPicture(paydayIncomplete ? null : paydayRead.rows, window, today);

  const feeBills: DueFeeBill[] = feeBillsRead === FEE_BILLS_UNREADABLE ? [] : billsForSurface(feeBillsRead, 'earnings');
  const waived: WaivedFeeCharge[] = waivedRead === FEE_BILLS_UNREADABLE ? [] : waivedRead;

  // The year — `null` when the ledger was not read (an em-dash and a sentence, never ₱0).
  let year: MoneyYear | null | 'locked' = 'locked';
  if (earningsRead) {
    if (!earningsRead.ok) {
      logQueryError('customers/money: ledger earnings', { message: earningsRead.error }, { vendorProfileId }, 'graceful_degrade');
    }
    year = moneyYear(earningsView(earningsRead), today);
  }

  // ⚠ THE LEGACY PAYOUTS: drawn only when any exist; a refused or short read says so, it never sums to ₱0.
  let legacy: MoneyLegacyPayout[] | null = [];
  if (payoutRead) {
    const payoutsMeasured = payoutRead.complete;
    if (!payoutsMeasured) {
      logQueryError(
        'customers/money: vendor_payouts',
        { message: payoutRead.error ?? `read ${payoutRead.rows.length} rows without reaching the server count` },
        { vendorProfileId },
        'graceful_degrade',
      );
    }
    legacy = payoutsMeasured ? (payoutRead.rows as unknown as PayoutRow[]).map(legacyRow) : null;
  }

  // Log a payment: each booked customer opens the conversation's payment band (the shipped "Log payment" door).
  const bookedIds = picture.customers.map((c) => c.eventId);
  const threadsRead =
    bookedIds.length > 0
      ? await readInChunks<{ thread_id: string; event_id: string; updated_at: string }>(bookedIds, (part) =>
          supabase.from('chat_threads').select('thread_id, event_id, updated_at').eq('vendor_profile_id', vendorProfileId).in('event_id', part),
        )
      : { rows: [], error: null };
  if (threadsRead.error) logQueryError('customers/money: threads', threadsRead.error, {}, 'graceful_degrade');
  const threadOf = new Map<string, string>();
  for (const t of [...threadsRead.rows].sort((a, b) => b.updated_at.localeCompare(a.updated_at))) {
    if (!threadOf.has(t.event_id)) threadOf.set(t.event_id, t.thread_id);
  }
  const logCustomers: MoneyLogCustomer[] = picture.customers.map((c) => ({
    eventId: c.eventId,
    name: c.name,
    line: c.line,
    href: threadOf.has(c.eventId)
      ? `/vendor-dashboard/messages/${threadOf.get(c.eventId)}#pending-payments`
      : `/vendor-dashboard/clients/${c.eventId}`,
  }));

  return (
    <>
      <MoneyView
        data={{
          today,
          totals: picture.totals,
          window,
          windowHref: moneyHref,
          rows: paginate(picture.rows, search.mpage),
          openCount: picture.openCount,
          rowHref: (eventId) => `/vendor-dashboard/clients/${eventId}`,
          pager: { param: 'mpage', keep: keepParamsFrom(search, ['mpage']) },
          retryHref: moneyHref(window),
          fees: {
            billsRead: feeBillsRead !== FEE_BILLS_UNREADABLE,
            bills: feeBills,
            copyFor: (b) => feeDueCopy(b, manilaToday()),
            waived,
          },
          year,
          // 🔴 NAMES THE FEE. "We never take a cut" is only the whole truth WITH the booking fee beside it (owner
          // 2026-08-06); the terms are DERIVED, never typed.
          lockedLine: `Totals by month start with Solo. Couples pay you directly and we never take a cut — Setnayan bills you a booking fee${feeSchedule ? ` of ${bookingFeeScheduleSummary(feeSchedule)}` : ''}, only on the couples we introduce.`,
          legacy,
        }}
      />
      {/* 📱 Frame 05's thumb row: Log a payment — the screen's one main. */}
      <SupplierThumbRow name="money" label="Money actions">
        <MoneyLog customers={logCustomers} />
      </SupplierThumbRow>
    </>
  );
}

function legacyRow(r: PayoutRow): MoneyLegacyPayout {
  const stage: PayoutStage = (r.payout_stage ?? legacyStageToPayoutStage(r.stage)) as PayoutStage;
  const cents = r.vendor_net_centavos ?? r.amount_centavos;
  const when = r.scheduled_at ? monthDay(r.scheduled_at.slice(0, 10)) : null;
  return {
    key: r.payout_id,
    reference: r.order?.reference_code ?? 'Payout',
    line: [PAYOUT_STAGE_LABEL[stage], when ? `scheduled ${when}` : null].filter(Boolean).join(' · '),
    amountPhp: Number.isFinite(Number(cents)) ? Number(cents) / 100 : null,
    badge: r.paid_at ? { tone: 'ok', word: 'Paid' } : r.on_hold ? { tone: 'no', word: 'On hold' } : { tone: 'wait', word: 'Scheduled' },
  };
}

function legacyStageToPayoutStage(legacy: string): PayoutStage {
  switch (legacy) {
    case 'reservation':
      return 'stage_1_confirm';
    case 'pre_event':
      return 'stage_2_event_start';
    case 'post_event':
      return 'stage_3_event_end';
    default:
      return 'immediate_full';
  }
}
