'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { payPath } from '@/lib/pay-path';
import { railForNewOrder } from '@/lib/rail-for-new-order';
import { PAYMENTS_PAUSED_MESSAGE } from '@/lib/payment-channels';
import { createClient } from '@/lib/supabase/server';
import { createMoneyWriterClient } from '@/lib/supabase/admin';
import { orderRowFor, paymentRowFor } from '@/lib/order-mint-identity';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRoleForProfile, canManageVendor } from '@/lib/vendor-role';
import { TIER_LABEL } from '@/lib/vendor-tier-caps';
import { fetchEffectiveCaps } from '@/lib/vendor-effective-caps';
import { formatCount } from '@/lib/format-number';
import {
  COUNT_ADDONS,
  canBuyUltraAddOn,
  countAddOnServiceKey,
  fetchCountAddOnPricePhp,
  isCountAddOnKind,
} from '@/lib/vendor-ultra-addons';

/**
 * BUY ONE ULTRA ADD-ON — owner 2026-11-06, DECISION_LOG "ULTRA ADD-ON PRICES" (*"seat, branch + 990 / the rest is
 * +199"*): +1 category · +1 service card · +1 wait list · +1 booking per date, per 4 weeks, Ultra only.
 *
 * The shipped add-on purchase flow, exactly the extra seat's (`buyExtraSeat`, app/vendor-dashboard/team/actions.ts):
 * apply-then-pay — an `orders` row keyed `<prefix><vendor_profile_id>` + a pending `payments` row, so it lands in
 * /admin/payments → the shop pays on the ONE payment page → an admin approves → the sku-activation hook recomputes the
 * paid count on `vendor_profiles` → the allowance rises (lib/vendor-effective-caps.ts). A refund lowers it again.
 *
 * 🔑 The form posts ONLY the add-on's kind (and the rail placeholder). The shop, its plan and the price are all read
 * here, server-side: the shop from the session, the plan from `vendor_profiles.tier_state`, the price from the active
 * `vendor_billing_catalog` row. No readable price → no sale (never a fallback figure).
 */

const PLAN = '/vendor-dashboard/subscription';

function back(message: string): never {
  redirect(`${PLAN}?error=${encodeURIComponent(message)}#add-ons`);
}

/** 'SN' + 8 uppercase hex — the seat / branch / couple checkout reference format. */
function generateReferenceCode(): string {
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  return (
    'SN' +
    Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/** The column's own CHECK on `vendor_profiles.max_waitlist_acceptances` (0..10) — the most places a date can hold. */
const WAITLIST_SETTING_MAX = 10;

export async function buyUltraAddOn(formData: FormData): Promise<void> {
  const kind = formData.get('addon');
  if (!isCountAddOnKind(kind)) back('That add-on is not one we sell.');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) back('No supplier profile found.');
  const vendorProfileId = profile.vendor_profile_id;

  // The role on THIS shop — an agent on it, or an admin of some other shop, cannot buy for it.
  const role = await resolveVendorRoleForProfile(supabase, user.id, vendorProfileId);
  if (!canManageVendor(role)) back('Only the owner or an admin can buy add-ons for this shop.');

  const { data: tierRow, error: tierErr } = await supabase
    .from('vendor_profiles')
    .select('tier_state')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (tierErr) back('We could not read your plan just now, so nothing was ordered. Try again in a moment.');
  const tier = (tierRow as { tier_state?: string | null } | null)?.tier_state ?? null;

  if (!canBuyUltraAddOn(kind, tier)) {
    back(`Only ${TIER_LABEL.enterprise} can add these. Move up to ${TIER_LABEL.enterprise} to add one.`);
  }

  // A wait list can hold at most the column's own ten places a date — a place past it could be paid for and never
  // used, so it is not sold.
  if (kind === 'waitlist') {
    const caps = await fetchEffectiveCaps(supabase, vendorProfileId, tier);
    if (caps.waitlistAcceptances + 1 > WAITLIST_SETTING_MAX) {
      back(
        `Your wait list already takes ${formatCount(caps.waitlistAcceptances)} couples a date — the most it can hold is ${formatCount(WAITLIST_SETTING_MAX)}.`,
      );
    }
  }

  const pricePhp = await fetchCountAddOnPricePhp(supabase, kind);
  if (pricePhp === null) back('This add-on is not on sale right now, so nothing was ordered.');

  // The rail is chosen on the payment page; this placeholder only satisfies NOT NULL, and must be an OPEN rail.
  const channel = await railForNewOrder(supabase, formData.get('channel'));
  if (!channel) back(PAYMENTS_PAUSED_MESSAGE);

  const referenceCode = generateReferenceCode();
  const def = COUNT_ADDONS[kind];

  // ── SEC-4b · service-role mint (as `buyExtraSeat`) ─────────────────────────
  // `orders` + `payments` INSERT are revoked from `authenticated`. Every identity column comes from the session-resolved
  // shop above, never from the form; the role check above is the authorization.
  const moneyWriter = createMoneyWriterClient();
  const { data: orderRow, error: oErr } = await moneyWriter
    .from('orders')
    .insert(
      orderRowFor(
        { userId: user.id, eventId: null, vendorProfileId },
        {
          service_key: countAddOnServiceKey(kind, vendorProfileId),
          description: `${def.label} (4 weeks · ${TIER_LABEL.enterprise})`,
          requested_total_php: pricePhp,
          status: 'submitted',
          reference_code: referenceCode,
        },
      ),
    )
    .select('order_id')
    .maybeSingle();
  if (oErr || !orderRow) back('Could not start the add-on order. Please try again.');
  const orderId = (orderRow as { order_id: string }).order_id;

  const { error: pErr } = await moneyWriter.from('payments').insert(
    paymentRowFor(
      { userId: user.id, verifiedOrderId: orderId },
      {
        amount_php: pricePhp,
        channel,
        reference_number: null,
        screenshot_url: null,
        paid_at: new Date().toISOString().slice(0, 10),
      },
    ),
  );
  if (pErr) {
    // Same client that minted it — a mixed-client compensation is how a rollback silently stops rolling back.
    const { error: undoErr } = await moneyWriter.from('orders').delete().eq('order_id', orderId);
    if (undoErr) {
      // The order stands without its payment row — say so where an admin will see it, never silently.
      console.error('[ultra-addon] could not undo the order after the payment row failed', { orderId, undoErr });
    }
    back('Could not start the add-on order. Please try again.');
  }

  revalidatePath(PLAN);
  // The ONE payment page (owner 2026-08-21): the amount inside the QR, the screenshot, the last 6 digits.
  redirect(payPath(referenceCode));
}
