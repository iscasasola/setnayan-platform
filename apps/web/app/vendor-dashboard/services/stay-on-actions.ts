'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { readStayOn } from '@/lib/service-plan-hold.server';
import {
  capsOf,
  keptFits,
  ladderFor,
  overPlanWords,
  planThatHoldsAll,
} from '@/lib/service-plan-hold';
import { asVendorTier } from '@/lib/vendor-tier-caps';

/**
 * "WHICH SERVICES STAY ON" — the one write (owner 2026-11-06: SERVICES LIFE CYCLE · A DOWNGRADE PUTS EXTRA SERVICES
 * ON HOLD · PLAN PICKER WITH SWAP).
 *
 * 🔒 THE SERVER RE-ASKS EVERYTHING the screen showed: the plan must be on this shop's ladder, every kept card must be
 * the shop's, and the kept set must FIT the plan by `keptFits` — the create gate's own rule (`lib/service-plan-hold.ts`).
 * WHEN the pick takes effect is not decided here at all: `apply_service_plan_pick` reads it off the shop row (now ·
 * upgrade · at the plan change), refuses a Free / Verified "now" before the first booking, and writes all-or-nothing.
 * Only the shop's OWNER picks — a plan decision is a money decision.
 */

const BACK = '/vendor-dashboard/shop';

function back(error: string | null): never {
  redirect(error ? `${BACK}?error=${encodeURIComponent(error)}#stay-on` : `${BACK}#stay-on`);
}

const REFUSED: Readonly<Record<string, string>> = {
  first_booking_not_done: 'Every service stays on until your first booking on Setnayan is done.',
  no_such_change: 'That plan change is not scheduled. Change your plan first, then pick which services stay on.',
  not_your_card: 'One of those services is not in your shop any more. Refresh and pick again.',
  no_shop: 'We couldn’t find your shop. Refresh and try again.',
};

export async function pickServicesThatStayOn(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  if (profile.user_id !== user.id) back('Only the shop owner picks which services stay on.');

  const admin = createAdminClient();
  const read = await readStayOn(supabase, admin, profile.vendor_profile_id);
  if (read.status !== 'ok') back('We couldn’t read your services. Nothing was changed — try again.');

  const { shop, cards } = read;
  const plan = asVendorTier(String(formData.get('plan') ?? ''));
  if (!ladderFor(shop.tier, shop.pending).includes(plan)) back('Pick a plan from the list.');

  const ids = new Set(cards.map((c) => c.id));
  const keepIds = Array.from(new Set(formData.getAll('keep').map(String))).filter((id) => ids.has(id));
  if (keepIds.length === 0) back('Keep at least one service on.');
  const kept = cards.filter((c) => keepIds.includes(c.id));
  const fit = keptFits(kept, capsOf(plan, shop.founder));
  if (!fit.ok) back(overPlanWords(fit, plan));

  const { data, error } = await admin.rpc('apply_service_plan_pick', {
    p_vendor_profile_id: shop.vendorProfileId,
    p_plan: plan,
    p_keep: keepIds,
    p_returns_on: planThatHoldsAll(cards, shop.founder),
  });
  if (error) {
    console.error('[pickServicesThatStayOn] apply_service_plan_pick failed', error);
    back('We couldn’t save your pick. Nothing was changed — try again.');
  }
  const r = (data ?? {}) as { status?: string; mode?: string };
  if (r.status !== 'ok') back(REFUSED[r.status ?? ''] ?? 'We couldn’t save your pick. Nothing was changed — try again.');

  revalidatePath(BACK);
  revalidatePath('/vendor-dashboard');
  // An upgrade is paid on the Plan page; the hold waits for that plan to start.
  if (r.mode === 'upgrade') redirect(`/vendor-dashboard/subscription?stay=${encodeURIComponent(plan)}`);
  back(null);
}
