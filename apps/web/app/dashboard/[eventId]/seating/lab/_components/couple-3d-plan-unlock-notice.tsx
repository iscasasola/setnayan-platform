// 3D Plan unlock — the COUPLE-facing acknowledgement (owner 2026-07-22). When a
// booked vendor with an active 3D Booth add-on has unlocked the 3D Plan for this
// couple, show a slim "unlocked by <vendor>" banner on the couple's 3D surface.
// Light by design: read-only, self-fetches, renders null when there's no unlock.
// The couple still buys SEATING_3D (at the discounted ₱1,000) + publishes it
// themselves — this banner just credits the vendor and names the discount.

import { Boxes } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchEventVendor3dPlanUnlock,
  VENDOR_3D_PLAN_UNLOCK_PRICE_PHP,
} from '@/lib/vendor-3d-plan-unlock';

const peso = (n: number) => '₱' + n.toLocaleString('en-PH');

export async function Couple3dPlanUnlockNotice({ eventId }: { eventId: string }) {
  // Admin client: the unlock row + the (possibly-unpublished) vendor's name are
  // read server-side, scoped to THIS event only. Guard its construction so a CI
  // build with no service-role key degrades to nothing rather than throwing.
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }

  const unlock = await fetchEventVendor3dPlanUnlock(admin, eventId);
  if (!unlock) return null;

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('business_name')
    .eq('vendor_profile_id', unlock.vendorProfileId)
    .maybeSingle();
  const vendorName =
    (vendor as { business_name?: string | null } | null)?.business_name?.trim() ||
    'your vendor';

  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-mulberry/20 bg-mulberry/[0.05] px-3.5 py-2.5 text-xs text-ink/75">
      <Boxes aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
      <p>
        Your 3D Plan upgrade was unlocked by <span className="font-semibold">{vendorName}</span> — add
        it below for the discounted{' '}
        <span className="font-semibold">{peso(VENDOR_3D_PLAN_UNLOCK_PRICE_PHP)}</span>. You choose
        what to publish.
      </p>
    </div>
  );
}
