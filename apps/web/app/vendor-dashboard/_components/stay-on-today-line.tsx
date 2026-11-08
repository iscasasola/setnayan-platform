import { ArrowRight, Layers } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';

import { ActionButton } from '@/components/action-button';
import { createAdminClient } from '@/lib/supabase/admin';
import { readStayOn } from '@/lib/service-plan-hold.server';
import { HOLD_WORDS, stayOnNeed } from '@/lib/service-plan-hold';
import { formatLongDate } from '@/lib/format-date';

/**
 * TODAY TELLS THEM (owner 2026-11-06, SERVICES LIFE CYCLE (3)): once the first booking is done, Free and Verified
 * hold one service — pick which stays on, or upgrade. And when a lower plan is scheduled that holds fewer than are on
 * (A DOWNGRADE PUTS EXTRA SERVICES ON HOLD). One line and one door to "Which services stay on" on My Shop. The
 * decision is `stayOnNeed`, the same one My Shop's section asks; a read that failed draws nothing.
 */
export async function StayOnTodayLine({
  supabase,
  vendorProfileId,
}: {
  supabase: SupabaseClient;
  vendorProfileId: string;
}) {
  const read = await readStayOn(supabase, createAdminClient(), vendorProfileId);
  const need = stayOnNeed(read);
  if (read.status !== 'ok' || !need.show || need.reason === 'holding') return null;
  const text =
    need.reason === 'first_booking'
      ? HOLD_WORDS.todayFirstBooking
      : HOLD_WORDS.todayDowngrade(need.startPlan, whenItStarts(read.shop.tierExpiresAt));
  return <StayOnTodayLineView text={text} />;
}

/** The drawn line — one sentence and one door. Exported so the dev lab mounts this, not a copy. */
export function StayOnTodayLineView({ text }: { text: string }) {
  return (
    <section aria-label={HOLD_WORDS.door} className="mb-3 flex flex-wrap items-center gap-3 border-b border-ink/10 py-3" data-stay-on-today="">
      <Layers aria-hidden className="h-4 w-4 shrink-0 text-ink/55" strokeWidth={1.75} />
      <p className="min-w-[12rem] flex-1 text-[14px] text-ink">{text}</p>
      <ActionButton tone="brand" main icon={<ArrowRight aria-hidden strokeWidth={1.9} />} label="Pick which stay on" href="/vendor-dashboard/shop#stay-on" className="!h-11 !min-h-11" />
    </section>
  );
}

/** The day the current plan ends, as a Manila calendar day ("November 30, 2026"); unknown → no date in the sentence. */
function whenItStarts(tierExpiresAt: string | null): string | null {
  if (!tierExpiresAt) return null;
  const d = new Date(tierExpiresAt);
  if (Number.isNaN(d.getTime())) return null;
  return formatLongDate(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }));
}
