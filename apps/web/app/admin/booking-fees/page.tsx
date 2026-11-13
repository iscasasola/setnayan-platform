import { Receipt } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { requireAdmin } from '@/lib/admin/require-admin';
import { formatCentavosPhp } from '@/lib/payouts';
import { bookingFeeLockServiceKey } from '@/lib/booking-fee-lock';
import { whyNotBilled, type PendingCharge, type UnbilledVerdict } from '@/lib/unbilled-fee-repair';
import { gatherUnbilledFacts } from '@/lib/unbilled-fee-repair.server';
import { ActionButton } from '@/components/action-button';
import { Badge } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';
import {
  TEMPLATE_SUBLINE,
  TemplateEmpty,
  TemplateFail,
  TemplateRow,
  TemplateRows,
  TemplateSection,
} from '@/app/_components/template-rows';
import { FeeRowMore } from './fee-row-more';
import { readSuppliersToReview } from '@/lib/admin/suppliers-to-review.server';
import { ReviewMinForm } from './review-min-form';
import { BookingsOpenForm } from './bookings-open-form';
import { bookingsOpenFromSetting } from '@/lib/bookings-open';

export const dynamic = 'force-dynamic';

/**
 * OUTSTANDING BOOKING FEES — who owes Setnayan, and whether they have paid yet.
 *
 * Owner, 2026-08-05: *"vendor must send their booking fee payment before we
 * activate it. admin will verify it manually if paid via QR until we have a
 * payment gate."*
 *
 * The VERIFYING already had a home — the vendor's fee arrives as an ordinary
 * pending payment and is approved on /admin/payments (or, since 2026-08-05,
 * from the work list once it carries proof). What had no home was the other
 * half of that sentence: **seeing who owes.** A charge sits `pending` from the
 * moment the vendor confirms the deposit, and nothing anywhere listed those.
 *
 * 🔑 THIS PAGE DECIDES NOTHING about money. No approve button, on purpose. Money is confirmed
 * where the PROOF is — the payment row with its reference and screenshot — and
 * a second place to approve from would be a second way to get it wrong. Each
 * row links to the payment instead.
 *
 * ⚠ FLAG-DARK UPSTREAM. `collectBookingFeeAtLock` is a no-op unless
 * NEXT_PUBLIC_BOOKING_FEE_ENABLED is on, so until the owner flips it this page
 * is legitimately empty. That is stated on the screen rather than left to look
 * like a broken query — an empty list and a switched-off feature look identical.
 *
 * ─── 2026-09-21 · THE ROW THAT MEANT TWO OPPOSITE THINGS ─────────────────
 * Every pending charge with no `orders` row read **"Nothing sent yet"** — the
 * same six words as a supplier who has been billed and simply has not paid.
 * They are opposite situations. One is a customer taking their time; the other
 * is Setnayan never having asked, because the collector opens the charge
 * through the RPC FIRST and can then fail at five points before the order and
 * payment rows exist. In that second case the supplier is shown nothing owed
 * anywhere, and this page — the one place built to answer "who owes us?" —
 * quietly agreed with them.
 *
 * 🔑 NOT BILLED IS NOW ITS OWN STATE, WITH ITS REASON, measured at read time by
 * `whyNotBilled` (the same judge the repair sweep uses to decide what it can
 * heal, so the desk and the sweep can never disagree about which charges are a
 * person's problem). The reason is DERIVED, never stored: see the pure module's
 * docblock for why writing it onto the charge would let a bookkeeping UPDATE
 * re-size the supplier's gift through a BEFORE-UPDATE trigger.
 */

type ChargeRow = {
  charge_id: string;
  public_id: string | null;
  amount_charged_centavos: number | string | null;
  proposal_amount_centavos: number | string | null;
  status: string;
  created_at: string;
  vendor_profile_id: string;
  event_id: string;
  event_vendor_id: string | null;
};

const num = (v: number | string | null): number => (v == null ? 0 : Number(v));

function ageDays(iso: string, nowMs: number): number {
  return Math.floor((nowMs - Date.parse(iso)) / 86_400_000);
}

export default async function AdminBookingFeesPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const nowMs = Date.now();

  const { data, error } = await admin
    .from('booking_fee_charges')
    .select(
      'charge_id, public_id, amount_charged_centavos, proposal_amount_centavos, status, created_at, vendor_profile_id, event_id, event_vendor_id',
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) logQueryError('admin/booking-fees', error);

  const charges = (data ?? []) as ChargeRow[];

  // 🪤 A FAILED READ IS NOT AN EMPTY LIST. Saying "nobody owes anything" when
  // the query errored is a positive claim about money, and the reader cannot
  // tell it apart from the truth. Same rule the work-list drawer follows.
  const unreadable = error != null;

  // Names, and whether the money has actually shown up. Both are best-effort:
  // a failure here must not blank the page, because the amounts above are the
  // point and they are already in hand.
  const vendorNames = new Map<string, string>();
  const paidRefs = new Map<string, { hasProof: boolean; orderId: string; orderPublicId: string | null }>();
  // The order and payment reads decide "never billed" — if either was refused we
  // do not know, and "Never billed" over a supplier who WAS billed is a false
  // accusation about money.
  let billingUnread = false;

  if (charges.length > 0) {
    const vendorIds = [...new Set(charges.map((c) => c.vendor_profile_id))];
    const { data: vendors, error: vendorsErr } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name')
      .in('vendor_profile_id', vendorIds);
    if (vendorsErr) logQueryError('admin/booking-fees (supplier names)', vendorsErr);
    for (const v of (vendors ?? []) as { vendor_profile_id: string; business_name: string | null }[]) {
      if (v.business_name) vendorNames.set(v.vendor_profile_id, v.business_name);
    }

    // Has the vendor actually sent anything? The fee's order is keyed on the
    // charge, so this is an exact join, not a guess.
    const keys = charges.map((c) => bookingFeeLockServiceKey(c.charge_id));
    const { data: orders, error: ordersErr } = await admin
      .from('orders')
      .select('order_id, public_id, service_key')
      .in('service_key', keys);
    if (ordersErr) {
      logQueryError('admin/booking-fees (orders)', ordersErr);
      billingUnread = true;
    }
    const orderRows = (orders ?? []) as { order_id: string; public_id: string | null; service_key: string }[];

    if (orderRows.length > 0) {
      const { data: pays, error: paysErr } = await admin
        .from('payments')
        .select('order_id, reference_number, screenshot_url')
        .in(
          'order_id',
          orderRows.map((o) => o.order_id),
        );
      if (paysErr) {
        logQueryError('admin/booking-fees (payments)', paysErr);
        billingUnread = true;
      }
      const byOrder = new Map<string, { reference_number: string | null; screenshot_url: string | null }>();
      for (const p of (pays ?? []) as {
        order_id: string;
        reference_number: string | null;
        screenshot_url: string | null;
      }[]) {
        byOrder.set(p.order_id, p);
      }
      for (const o of orderRows) {
        const p = byOrder.get(o.order_id);
        paidRefs.set(o.service_key, {
          orderId: o.order_id,
          orderPublicId: o.public_id ?? null,
          // Same definition of proof the work list uses: non-EMPTY, not merely
          // non-null. A blank string is what an empty form field posts.
          hasProof:
            (p?.reference_number != null && p.reference_number.trim() !== '') ||
            (p?.screenshot_url != null && p.screenshot_url.trim() !== ''),
        });
      }
    }
  }

  // WHY a charge has no bill — asked only of the charges that have none, and
  // answered from rows read just now. `gatherUnbilledFacts` is best-effort: a
  // refused lookup leaves the charge looking repairable rather than inventing a
  // durable cause for a read that simply failed.
  const unbilledCharges: PendingCharge[] = charges
    .filter((c) => !paidRefs.has(bookingFeeLockServiceKey(c.charge_id)))
    .map((c) => ({
      chargeId: c.charge_id,
      eventVendorId: c.event_vendor_id,
      status: c.status,
      createdAt: c.created_at,
    }));
  const notBilled = new Map<string, UnbilledVerdict>();
  if (unbilledCharges.length > 0 && !billingUnread) {
    const facts = await gatherUnbilledFacts(admin, unbilledCharges, nowMs);
    for (const c of unbilledCharges) {
      const f = facts.get(c.chargeId);
      if (f) notBilled.set(c.chargeId, whyNotBilled(f));
    }
  }

  // ⚖ SUPPLIERS TO REVIEW (owner 2026-10-07 "flag suppliers with several
  // booked-but-unsettled events"; 2026-10-12 #12: an admin-set count of events,
  // default 2, REVIEW ONLY). It lists; it charges and tells nobody.
  const review = await readSuppliersToReview(admin);

  // 🚪 The bookings switch, read fresh (not remembered) so this page shows what was just saved.
  const { data: switchRow, error: switchErr } = await admin
    .from('platform_settings')
    .select('bookings_open')
    .eq('id', 1)
    .maybeSingle();
  if (switchErr) logQueryError('admin/booking-fees.bookings_open', switchErr);
  const bookingsOpen = switchErr ? null : bookingsOpenFromSetting((switchRow as { bookings_open?: unknown } | null)?.bookings_open);

  const owedTotal = charges.reduce((s, c) => s + num(c.amount_charged_centavos), 0);
  const withProof = charges.filter(
    (c) => paidRefs.get(bookingFeeLockServiceKey(c.charge_id))?.hasProof,
  ).length;

  const owedLabel = `${formatCentavosPhp(owedTotal)} on ${charges.length} ${charges.length === 1 ? 'booking' : 'bookings'}`;

  // 📐 THE DESIGN TEMPLATE (owner-approved 2026-11-14, `design_template_sheet_2026-11-14_fable.html` › "Booking fees
  // owed"). The page's name lives in the layout's pinned row ("Money · Fees owed ▾" with its count), so nothing here
  // restates it. Plain sections and hairline rows — no card anywhere; every explaining paragraph moved behind an ⓘ;
  // each fee is ONE row with ONE action (or a chip) and the rest behind ⋯; the review count is a − / + sentence that
  // saves itself; a failed read is amber with its own Try again, never "none".
  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-8 pt-2 sm:px-6">
      {/* 🚪 BOOKINGS (owner 2026-11-02, "for now, they cannot add bookings"). `lib/bookings-open.ts`. */}
      <TemplateSection label="Bookings" first data="bookings">
        <div className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 py-2">
          <span className="min-w-0 flex-1">
            <InfoTip
              label={`Bookings are ${bookingsOpen === null ? 'unknown' : bookingsOpen ? 'open' : 'closed'}`}
              labelClassName="text-[15px] font-semibold text-ink"
              align="start"
            >
              {bookingsOpen === null
                ? 'Couldn’t read the switch — that is not the same as closed. The switch is hidden until it can be read.'
                : bookingsOpen
                  ? 'Verified shops can be booked, and booking fees are made.'
                  : 'No booking can be made from any door and no fee is made. Shop pages, packages and prices still show, with “Bookings open soon”.'}
            </InfoTip>
          </span>
          {bookingsOpen === null ? null : <BookingsOpenForm open={bookingsOpen} />}
        </div>
        {bookingsOpen === null ? (
          <TemplateFail retryHref="/admin/booking-fees" data="bookings">
            Couldn&rsquo;t check &mdash; the switch is hidden until we can.
          </TemplateFail>
        ) : null}
      </TemplateSection>

      <TemplateSection
        label="Fees owed"
        tip="Fees are only charged once the booking fee is switched on — until then this list stays empty even when bookings are being locked."
        right={!unreadable && charges.length > 0 ? owedLabel : undefined}
        data="fees"
      >
        {unreadable ? (
          <TemplateFail retryHref="/admin/booking-fees" data="fees">
            Couldn&rsquo;t check the fees &mdash; not the same as nobody owing anything.
          </TemplateFail>
        ) : null}

        {billingUnread && !unreadable ? (
          <TemplateFail retryHref="/admin/booking-fees" data="billing">
            Couldn&rsquo;t check which were billed or paid, so each reads &ldquo;Status unknown&rdquo; &mdash; not the same as never billed.
          </TemplateFail>
        ) : null}

        {!unreadable && charges.length > 0 && (notBilled.size > 0 || !billingUnread) ? (
          <p className={`pb-1 ${TEMPLATE_SUBLINE}`} data-fees-summary="">
            {notBilled.size > 0 ? (
              <span style={{ color: 'rgb(var(--color-danger))' }}>
                {notBilled.size} never billed
              </span>
            ) : null}
            {notBilled.size > 0 && !billingUnread ? ' · ' : null}
            {billingUnread ? null : (
              <span>
                {withProof} sent proof {withProof === 1 ? 'and is' : 'and are'} waiting on you
              </span>
            )}
          </p>
        ) : null}

        {!unreadable && charges.length === 0 ? (
          <TemplateEmpty data="fees">Nobody owes a booking fee right now.</TemplateEmpty>
        ) : null}

        {charges.length > 0 ? (
          <TemplateRows label="Fees owed">
            {charges.map((c) => {
              const key = bookingFeeLockServiceKey(c.charge_id);
              const pay = paidRefs.get(key);
              const days = ageDays(c.created_at, nowMs);
              // NOT BILLED is a different state from NOT PAID, and the row says which one this is. `pay` is
              // undefined exactly when no order row exists for the charge — i.e. when nobody was ever asked.
              const missing = notBilled.get(c.charge_id) ?? null;
              const name = vendorNames.get(c.vendor_profile_id) ?? 'A supplier';
              const fee = formatCentavosPhp(num(c.amount_charged_centavos));
              const paymentHref = pay
                ? `/admin/payments?filter=all&q=${encodeURIComponent(pay.orderPublicId ?? c.public_id ?? '')}`
                : null;
              return (
                <TemplateRow
                  key={c.charge_id}
                  data={c.charge_id}
                  edge={missing ? 'late' : pay?.hasProof ? 'due' : undefined}
                  title={`${name} · ${fee}`}
                  line={
                    missing ? (
                      <span style={{ color: 'rgb(var(--color-danger))' }} data-unbilled-reason={missing.code}>
                        {missing.reason}
                      </span>
                    ) : (
                      <>
                        On a {formatCentavosPhp(num(c.proposal_amount_centavos))} booking · {days === 0 ? 'today' : `${days}d`}
                      </>
                    )
                  }
                  right={
                    <>
                      {missing ? (
                        <Badge tone="no">Never billed</Badge>
                      ) : billingUnread ? (
                        <Badge tone="wait">Status unknown</Badge>
                      ) : pay?.hasProof && paymentHref ? (
                        <ActionButton tone="ok" icon={<Receipt aria-hidden strokeWidth={1.9} />} label="Check payment" href={paymentHref} />
                      ) : (
                        <Badge tone="quiet">Billed — nothing sent yet</Badge>
                      )}
                      <FeeRowMore
                        title={`${name} · ${fee}`}
                        code={c.public_id}
                        paymentHref={paymentHref}
                        shopHref={`/admin/vendors/${c.vendor_profile_id}`}
                      />
                    </>
                  }
                />
              );
            })}
          </TemplateRows>
        ) : null}
      </TemplateSection>

      {/* ⚖ SUPPLIERS TO REVIEW — lists; it charges and tells nobody. */}
      <TemplateSection
        label="Suppliers to review"
        tip="Suppliers with several events their couples treat as booked — a booked status or a payment recorded — and no settled booking fee. For review only."
        data="review"
      >
        <ReviewMinForm value={review.ok ? review.minEvents : null} />
        {!review.ok ? (
          <TemplateFail retryHref="/admin/booking-fees" data="review">
            Couldn&rsquo;t read {review.why} &mdash; not the same as nobody to review.
          </TemplateFail>
        ) : review.rows.length === 0 ? (
          <TemplateEmpty data="review">No supplier has {review.minEvents} or more such events.</TemplateEmpty>
        ) : (
          <TemplateRows label="Suppliers to review">
            {review.rows.map((r) => (
              <TemplateRow
                key={r.vendorProfileId}
                data={r.vendorProfileId}
                href={`/admin/vendors/${r.vendorProfileId}`}
                title={r.name ?? 'A supplier'}
                line={
                  <span className="tabular-nums">
                    {r.events} {r.events === 1 ? 'event' : 'events'} · couples recorded{' '}
                    {formatCentavosPhp(Math.round(r.paymentsPhp * 100))} · fee owed {formatCentavosPhp(r.owedCentavos)}
                  </span>
                }
              />
            ))}
          </TemplateRows>
        )}
      </TemplateSection>
    </div>
  );
}
