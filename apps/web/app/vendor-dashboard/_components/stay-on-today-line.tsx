import { ArrowRight } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';

import { ActionButton } from '@/components/action-button';
import { Notice } from '@/app/_components/notices/notices';
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
/**
 * 🔔 Inventory #9 — a To-do (one notice system, owner approved 14 Nov 2026), registered for Today's top: "Pick which stay
 * on · Not now" (back after 7 days) until the pick is made.
 */
export function StayOnTodayLineView({ text }: { text: string }) {
  return (
    <Notice
      kind="todo"
      noticeKey="pick-service-on"
      title={text}
      actions={<ActionButton tone="brand" main icon={<ArrowRight aria-hidden strokeWidth={1.9} />} label="Pick which stay on" href="/vendor-dashboard/shop#stay-on" className="!h-11 !min-h-11" />}
    />
  );
}

function whenItStarts(tierExpiresAt: string | null): string | null {
  if (!tierExpiresAt) return null;
  const d = new Date(tierExpiresAt);
  if (Number.isNaN(d.getTime())) return null;
  return formatLongDate(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }));
}
