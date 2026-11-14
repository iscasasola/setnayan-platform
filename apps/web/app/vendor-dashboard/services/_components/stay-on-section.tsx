import type { SupabaseClient } from '@supabase/supabase-js';

import { createAdminClient } from '@/lib/supabase/admin';
import { readStayOn } from '@/lib/service-plan-hold.server';
import { ladderFor, pickModeFor, stayOnNeed } from '@/lib/service-plan-hold';
import { tierRank } from '@/lib/vendor-tier-caps';
import { pickServicesThatStayOn } from '../stay-on-actions';
import { StayOnPicker, type StayOnPlan } from './stay-on-picker';

/**
 * "Which services stay on" on My Shop's services list (owner 2026-11-06, SERVICES LIFE CYCLE + A DOWNGRADE PUTS EXTRA
 * SERVICES ON HOLD + the PLAN PICKER WITH SWAP). Whether it shows is `stayOnNeed` — the same decision Today's line
 * reads. A read that failed draws nothing; before the first booking a Free / Verified shop sees one line only.
 */
export async function StayOnSection({
  supabase,
  vendorProfileId,
  userId,
}: {
  supabase: SupabaseClient;
  vendorProfileId: string;
  userId: string;
}) {
  const read = await readStayOn(supabase, createAdminClient(), vendorProfileId);
  const need = stayOnNeed(read);
  if (read.status !== 'ok') return null;
  if (!need.show) {
    return need.line ? (
      <p className="text-[13px] text-[color:var(--m-slate-2)]" data-stay-on-line="">
        {need.line}
      </p>
    ) : null;
  }
  const { shop, cards, firstBooking } = read;
  const plans: StayOnPlan[] = ladderFor(shop.tier, shop.pending).flatMap((tier) => {
    const mode = pickModeFor(tier, shop.tier, shop.pending);
    return mode ? [{ tier, mode }] : [];
  });
  const owner = shop.ownerUserId === userId;
  const freeTier = tierRank(shop.tier) <= tierRank('verified');
  const waitsForBooking = freeTier && firstBooking !== 'done';
  return (
    <div className="border-b border-ink/10 pb-4">
      <StayOnPicker
        cards={cards}
        plans={plans}
        startPlan={need.startPlan}
        founder={shop.founder}
        owner={owner}
        nowWaits={waitsForBooking}
        action={pickServicesThatStayOn}
      />
    </div>
  );
}
