import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import {
  fetchVendorFeeOrders,
  bucketFeeOrders,
  FEE_ORDERS_UNREADABLE,
} from '@/lib/vendor-booking-fees.server';
import { sumFeeOrderTotalsPhp } from '@/lib/vendor-booking-fees';
import { BookingFeesBody } from './booking-fees-body';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  fetchWaivedFeeCharges,
  FEE_BILLS_UNREADABLE,
} from '@/lib/booking-fee-disclosure.server';
import type { WaivedFeeCharge } from '@/lib/booking-fee-disclosure';
import { feeFreeRuleInApp, feeNewClientLine } from '@/lib/booking-fee-who-words';
import { getLiveBookingFeeSchedule } from '@/lib/booking-fee-settings.server';
import { readLaunchOffer } from '@/lib/launch-offer.server';
import { launchOfferFeesLine } from '@/lib/launch-offer';

export const metadata = { title: 'Booking fees · Supplier' };

/**
 * /vendor-dashboard/booking-fees — the vendor-facing list of their Setnayan
 * booking-fee orders (5% of a booked total, then 3% beyond ₱100,000, never more than ₱100,000, minimum ₱50,
 * owner 2026-11-20; NOT a flat rate). Each row links to
 * the same manual-QR pay flow couples use, reachable from the Plan hub
 * doorway. READ-ONLY surfacing: this never mints or mutates a fee — it lists the
 * orders the fee-charge path already created (RLS scopes to the caller's own).
 *
 * Not flag-gated at the page level: a vendor with an outstanding fee must always
 * be able to reach + pay it (deep-link durability). The DOORWAY that advertises
 * this page + the notification sweep ARE flag-gated, so nothing new is surfaced
 * while the fee system is dark.
 */
export default async function VendorBookingFeesPage() {
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath('/vendor-dashboard/booking-fees'));
  const supabase = await createClient();

  const read = await fetchVendorFeeOrders(supabase, user.id);
  const unreadable = read === FEE_ORDERS_UNREADABLE;
  const orders = unreadable ? [] : read;
  const { due, settled, closed } = bucketFeeOrders(orders);

  // THE FREE BOOKINGS BELONG ON THE FEE LIST TOO (owner 2026-09-20). A waived
  // charge mints no `orders` row, so until now this page — the one place a
  // supplier goes to read their fees — showed nothing at all for the first five
  // and then a bill for the sixth. Unreadable renders nothing, never an implied
  // "you have had no free bookings".
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  const waivedRead = await fetchWaivedFeeCharges(
    createAdminClient(),
    profile?.vendor_profile_id,
  ).catch(() => FEE_BILLS_UNREADABLE);
  const waived: WaivedFeeCharge[] = waivedRead === FEE_BILLS_UNREADABLE ? [] : waivedRead;

  // `null` when ANY due order's total could not be read — the banner then names
  // the count and says the amount is unreadable, instead of printing a sum that
  // silently counted the unreadable one as ₱0.
  const totalDue = sumFeeOrderTotalsPhp(due);

  // The owner's LIVE rate for the fee line below — null prints no rate, never the code default.
  const feeSchedule = await getLiveBookingFeeSchedule();
  // 🎁 F-W1-30: the launch offer, said where the supplier reads their fees — from the live settings, never typed.
  const launchLine = launchOfferFeesLine(await readLaunchOffer(createAdminClient()).catch(() => null), Date.now());
  // 📅 The new-client window (owner 2026-11-16), named with its length from settings — the supplier's own app only.
  // Unread → no line (never a guessed number).
  const newClientLine = feeNewClientLine(feeSchedule?.newClientFreeMonths);

  return (
    <BookingFeesBody
      orders={unreadable ? null : orders}
      due={due}
      settled={settled}
      closed={closed}
      totalDue={totalDue}
      waived={waivedRead === FEE_BILLS_UNREADABLE ? null : waived}
      schedule={feeSchedule}
      launchLine={launchLine}
      newClientLine={newClientLine}
      freeRule={feeFreeRuleInApp(feeSchedule?.newClientFreeMonths)}
    />
  );
}
