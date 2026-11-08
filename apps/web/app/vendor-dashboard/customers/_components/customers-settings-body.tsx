import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorPools, fetchVendorServicesForPicker } from '@/lib/vendor-schedule';
import { fetchVendorServices } from '@/lib/vendor-services';
import { VENDOR_CATEGORY_LABEL } from '@/lib/vendors';
import { DAILY_CAPACITY_MAX } from '@/lib/vendor-tier-caps';
import { isLockHandshakeEnabled } from '@/lib/lock-handshake-flag';
import { manilaTodayIso } from '@/lib/vendor-cashflow';
import PaymentOptionsSurface from '../../payment-options/surface';
import { createCalendar, editCalendar, reassignCategoryPool, updatePoolCapacity } from '../../calendar/actions';
import { DaysSettings } from './dates-folds';
import { vendorAutoReplyEnabled } from '@/lib/vendor-autoreply-flag';
import { AutoReplySection } from '../../shop/_components/autoreply-section';
import type { CustomersSegment } from '../segments';
import { logQueryError } from '@/lib/supabase/error-detect';
import { formatCount } from '@/lib/format-number';
import { DatesRow } from './dates-row';

/** 🎟 The Booked QRs list — the QR codes page with its ledger open (Waiting · Used · Deleted). */
export const BOOKED_QRS_HREF = '/vendor-dashboard/invite?mode=locked&ledger=1';

/**
 * ⚙ CUSTOMERS SETTINGS — the sheet's rows (owner 2026-10-28, DECISION_LOG "SUPPLIER DASHBOARD APPROVED — EVERYTHING IN
 * PLACE, A ⚙ PER PAGE": "Customers ⚙ = getting paid + booking terms + teams/days"; prototype `custSettings()`).
 *
 * Drawn ONLY when the ⚙ is open (`?gear=1`, `customers-settings.tsx`), so a Customers visit never pays these reads.
 * Every row is a SHIPPED editor, mounted — not redrawn:
 *
 *   GETTING PAID     the shop's payment options (`payment-options/surface.tsx`, the same editor Your details › How
 *                    clients pay you mounts), its saves coming back here (`return_to=customers`).
 *   TEAMS AND DAYS   Your halls · How many a day (each schedule's counter, its name and services, a new schedule) ·
 *                    Exact time slots · Phone calendar — the rows Dates used to fold (`DaysSettings`), moved.
 *   BOOKED QRs       one row (Supplier Build 2 lane E; prototype v118 `custSettings` "Booked QRs · One-time codes ·
 *                    waiting · used · deleted"): it opens the shipped Booked QRs list (the QR codes page, ledger open).
 *                    Its count is ONE head read of this shop's waiting codes; refused, the row says no number.
 *   AUTO-REPLY       the shipped `AutoReplySection`, mounted UNCHANGED (THE ONE BUILD, 8 Nov 2026 · spec §9 #6): it
 *                    answers a client's first message, so it lives with Clients. Still behind its own switch
 *                    (`vendorAutoReplyEnabled`, zero reads when off). C4 removes the Your-page mount once this lands.
 *
 * ⏳ BOOKING TERMS (owner 2026-10-28: shop defaults — a downpayment as a % OR an exact ₱, the refund window, the
 * wording — that pre-fill every new service card and quote) has NO column to save to: today each card carries its own
 * schedule (`vendor_service_payment_schedules`). A row that saved nothing would be a fake door, so it is not drawn here;
 * it is its own build (a column set + the card and quote makers reading it).
 */

/** A save's answer, said once at the top of the sheet (`gnotice` — the ⚙'s own, so Dates' toast does not repeat it). */
const GEAR_NOTICES: Record<string, { tone: 'ok' | 'note' | 'bad'; text: string }> = {
  capacity_saved: { tone: 'ok', text: 'How many a day — saved.' },
  capacity_clamped: { tone: 'note', text: `Saved at ${DAILY_CAPACITY_MAX} a day — the most a calendar takes.` },
  pool_saved: { tone: 'ok', text: 'Saved — those services share that schedule now.' },
  calendar_created: { tone: 'ok', text: 'Schedule made.' },
  calendar_saved: { tone: 'ok', text: 'Schedule saved.' },
  bad_name: { tone: 'bad', text: 'It needs a name. Nothing was saved.' },
  bad_capacity: { tone: 'bad', text: 'How many a day must be 1 or more. Nothing was saved.' },
  bad_pool: { tone: 'bad', text: 'Pick which schedule it belongs to. Nothing was saved.' },
  save_failed: { tone: 'bad', text: 'That did not go through. Nothing changed — please try again.' },
};

const VENUE_KINDS = new Set(['venue', 'religious_venue']);

function categoryLabel(key: string): string {
  return (VENDOR_CATEGORY_LABEL as Record<string, string>)[key] ?? key.replace(/_/g, ' ');
}

export async function CustomersSettingsBody({
  seg,
  search,
}: {
  seg: CustomersSegment;
  search: { m?: string; gnotice?: string; gmsg?: string; gerror?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  const vendorProfileId = profile.vendor_profile_id;

  const thisMonth = manilaTodayIso().slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(search.m ?? '') ? (search.m as string) : thisMonth;
  const namedCalendars = process.env.NEXT_PUBLIC_NAMED_CALENDARS_ENABLED !== 'false';
  const [pools, services, pickerServices, waitingRead] = await Promise.all([
    fetchVendorPools(supabase, vendorProfileId),
    fetchVendorServices(supabase, vendorProfileId),
    namedCalendars ? fetchVendorServicesForPicker(supabase, vendorProfileId) : Promise.resolve([]),
    supabase
      .from('vendor_locked_qr_tokens')
      .select('id', { count: 'exact', head: true })
      .eq('vendor_profile_id', vendorProfileId)
      .eq('status', 'pending'),
  ]);
  // ⚠ A refused count is not "0 waiting" — the row then carries no number at all.
  if (waitingRead.error) logQueryError('CustomersSettingsBody.bookedQrsWaiting', waitingRead.error, { vendorProfileId }, 'graceful_degrade');
  const waiting = waitingRead.error ? null : (waitingRead.count ?? null);
  const venue = pools.some((p) => p.isHall) || services.some((s) => VENUE_KINDS.has(String(s.category ?? '')));
  const notice = search.gnotice ? GEAR_NOTICES[search.gnotice] : undefined;

  return (
    <div data-customers-settings-body="">
      {notice ? (
        <p
          role="status"
          className="mb-2 text-[13.5px] font-medium"
          style={{ color: notice.tone === 'bad' ? 'rgb(var(--color-danger))' : notice.tone === 'ok' ? 'rgb(var(--color-ok))' : undefined }}
          data-customers-settings-notice={search.gnotice}
        >
          {notice.text}
        </p>
      ) : null}

      <p className="home-k2 pt-2" data-customers-settings-section="paid">
        Getting paid
      </p>
      <PaymentOptionsSurface
        searchParams={Promise.resolve({ msg: search.gmsg, error: search.gerror })}
        embedded
        returnTo={{ to: 'customers', seg }}
      />

      <p className="home-k2 pt-4" data-customers-settings-section="days">
        Teams and days
      </p>
      <DaysSettings
        month={month}
        seg={seg}
        calendars={pools.map((p) => ({
          poolId: p.poolId,
          label: p.label,
          name: p.calendarName ?? p.label,
          capacity: p.capacity,
          isHall: p.isHall === true,
          seated: p.seatedCapacity ?? null,
          standing: p.standingCapacity ?? null,
          line: p.categories.map(categoryLabel).join(', '),
          serviceIds: p.serviceIds,
          categories: p.categories.map((c) => ({ key: c, label: categoryLabel(c) })),
        }))}
        ceiling={DAILY_CAPACITY_MAX}
        namedCalendars={namedCalendars}
        services={pickerServices.map((s) => ({ serviceId: s.serviceId, label: s.label, poolId: s.poolId }))}
        slotsHref="/vendor-dashboard/shop"
        icsHref="/vendor-dashboard/customers/calendar.ics"
        approveFirst={isLockHandshakeEnabled()}
        venue={venue}
        actions={{ updatePoolCapacity, createCalendar, editCalendar, reassignCategoryPool }}
      />

      <p className="home-k2 pt-4" data-customers-settings-section="booked-qrs">
        Booked QRs
      </p>
      <DatesRow
        data="customers-gear-booked-qrs"
        title="Booked QRs"
        line="One-time codes · waiting · used · deleted"
        badge={waiting ? { tone: 'wait', word: `${formatCount(waiting)} waiting` } : null}
        href={BOOKED_QRS_HREF}
      />

      {vendorAutoReplyEnabled() ? (
        <>
          <p className="home-k2 pt-4" data-customers-settings-section="auto-reply">
            Auto-reply
          </p>
          <div id="auto-reply" className="scroll-mt-24">
            <AutoReplySection vendorProfileId={vendorProfileId} />
          </div>
        </>
      ) : null}
    </div>
  );
}
