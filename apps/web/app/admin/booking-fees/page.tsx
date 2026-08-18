import Link from 'next/link';
import { Receipt, AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { requireAdmin } from '@/lib/admin/require-admin';
import { formatCentavosPhp } from '@/lib/payouts';
import { bookingFeeLockServiceKey } from '@/lib/booking-fee-lock';
import { PageMasthead } from '@/app/_components/page-masthead';

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
 * 🔑 THIS PAGE DECIDES NOTHING. No buttons, on purpose. Money is confirmed
 * where the PROOF is — the payment row with its reference and screenshot — and
 * a second place to approve from would be a second way to get it wrong. Each
 * row links to the payment instead.
 *
 * ⚠ FLAG-DARK UPSTREAM. `collectBookingFeeAtLock` is a no-op unless
 * NEXT_PUBLIC_BOOKING_FEE_ENABLED is on, so until the owner flips it this page
 * is legitimately empty. That is stated on the screen rather than left to look
 * like a broken query — an empty list and a switched-off feature look identical.
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
      'charge_id, public_id, amount_charged_centavos, proposal_amount_centavos, status, created_at, vendor_profile_id, event_id',
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
  const paidRefs = new Map<string, { hasProof: boolean; orderId: string }>();

  if (charges.length > 0) {
    const vendorIds = [...new Set(charges.map((c) => c.vendor_profile_id))];
    const { data: vendors } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name')
      .in('vendor_profile_id', vendorIds);
    for (const v of (vendors ?? []) as { vendor_profile_id: string; business_name: string | null }[]) {
      if (v.business_name) vendorNames.set(v.vendor_profile_id, v.business_name);
    }

    // Has the vendor actually sent anything? The fee's order is keyed on the
    // charge, so this is an exact join, not a guess.
    const keys = charges.map((c) => bookingFeeLockServiceKey(c.charge_id));
    const { data: orders } = await admin
      .from('orders')
      .select('order_id, service_key')
      .in('service_key', keys);
    const orderRows = (orders ?? []) as { order_id: string; service_key: string }[];

    if (orderRows.length > 0) {
      const { data: pays } = await admin
        .from('payments')
        .select('order_id, reference_number, screenshot_url')
        .in(
          'order_id',
          orderRows.map((o) => o.order_id),
        );
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
          // Same definition of proof the work list uses: non-EMPTY, not merely
          // non-null. A blank string is what an empty form field posts.
          hasProof:
            (p?.reference_number != null && p.reference_number.trim() !== '') ||
            (p?.screenshot_url != null && p.screenshot_url.trim() !== ''),
        });
      }
    }
  }

  const owedTotal = charges.reduce((s, c) => s + num(c.amount_charged_centavos), 0);
  const withProof = charges.filter(
    (c) => paidRefs.get(bookingFeeLockServiceKey(c.charge_id))?.hasProof,
  ).length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:max-w-5xl lg:py-8">
      {/* The shared masthead, not a hand-rolled <header> — a guard rejects a new
          page that draws its own, and it has no eyebrow by design. */}
      <PageMasthead
        title="Booking fees owed"
        className="mb-6"
      />

      {unreadable ? (
        <div className="sn-tile mb-4 flex items-start gap-3 p-4">
          <AlertTriangle
            aria-hidden
            className="mt-0.5 h-5 w-5 shrink-0"
            strokeWidth={1.75}
            style={{ color: '#B54708' }}
          />
          <p className="text-sm" style={{ color: '#B54708' }}>
            Could not load the fees right now — this is <strong>not</strong> the same as
            nobody owing anything.
          </p>
        </div>
      ) : null}

      {!unreadable && charges.length > 0 ? (
        <div className="sn-tile mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
          <span className="text-sm">
            <strong>{formatCentavosPhp(owedTotal)}</strong> owed across {charges.length}{' '}
            {charges.length === 1 ? 'booking' : 'bookings'}
          </span>
          <span className="text-sm text-[color:var(--sn-ink-500)]">
            {withProof} {withProof === 1 ? 'has' : 'have'} sent proof and{' '}
            {withProof === 1 ? 'is' : 'are'} waiting on you
          </span>
        </div>
      ) : null}

      {!unreadable && charges.length === 0 ? (
        <div className="sn-tile flex items-start gap-3 p-4">
          <CheckCircle2
            aria-hidden
            className="mt-0.5 h-5 w-5 shrink-0"
            strokeWidth={1.75}
            style={{ color: 'var(--sn-ink-500)' }}
          />
          <p className="text-sm text-[color:var(--sn-ink-500)]">
            Nobody owes a booking fee right now. Note that fees are only charged once the
            booking fee is switched on — until then this page stays empty even when
            bookings are being locked.
          </p>
        </div>
      ) : null}

      {charges.length > 0 ? (
        <ul className="space-y-3">
          {charges.map((c) => {
            const key = bookingFeeLockServiceKey(c.charge_id);
            const pay = paidRefs.get(key);
            const days = ageDays(c.created_at, nowMs);
            return (
              <li key={c.charge_id} className="sn-tile flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-ink/5">
                  <Receipt
                    aria-hidden
                    className="h-5 w-5"
                    strokeWidth={1.75}
                    style={{ color: pay?.hasProof ? '#B54708' : 'var(--sn-ink-500)' }}
                  />
                </span>

                <span className="flex min-w-[10rem] flex-1 flex-col gap-0.5">
                  <span className="text-sm font-semibold">
                    {vendorNames.get(c.vendor_profile_id) ?? 'A vendor'}
                  </span>
                  <span className="text-xs text-[color:var(--sn-ink-500)]">
                    {formatCentavosPhp(num(c.amount_charged_centavos))} on a{' '}
                    {formatCentavosPhp(num(c.proposal_amount_centavos))} booking
                    {c.public_id ? ` · ${c.public_id}` : ''}
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-3">
                  <span
                    className="inline-flex items-center gap-1 text-xs"
                    style={{ color: 'var(--sn-ink-500)' }}
                  >
                    <Clock3 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                    {days === 0 ? 'today' : `${days}d`}
                  </span>

                  {pay?.hasProof ? (
                    <Link
                      href="/admin/payments"
                      className="rounded-md px-3 py-1.5 text-xs font-semibold"
                      style={{ background: 'var(--sn-cta, #C24E25)', color: '#FDFBF7' }}
                    >
                      Check their payment
                    </Link>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--sn-ink-500)' }}>
                      Nothing sent yet
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
