import Link from 'next/link';
import { ArrowRight, ListChecks } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveProfileByEvent, surfaceEnabled } from '@/lib/event-type-profile';
import { makerHasWork } from '@/lib/maker-details-items';
import { homeProgress, stepOf } from '@/lib/details-guided-flow';
import { readGuidedPlan } from '../launch/_components/details-guided-progress';

/**
 * 🪜 HOME'S LINE FOR THE GUIDED FLOW — "Round N · x of y · Continue"
 * (DECISION_LOG 2026-09-29 "THE GUIDED FLOW IS APPROVED — AND ANY STEP CAN BE
 * PICKED ANY TIME": *"Home shows 'Round N · x of y · Continue'"*; Details part 5).
 *
 * The same plan the Maker's Details draws (`readGuidedPlan` — the same columns,
 * the same helpers, the same "done"), so Home and the flow can never count a
 * different round. Continue opens the Maker on What's left, at the step still
 * to do (`?guide=1`).
 *
 * Drawn only for whom Details is (`makerHasWork`: the host of an event whose
 * type has an Event Hub), and only while something is left. A plan that could
 * not be read draws NOTHING — never a "0 of 7" nobody measured. Streamed by
 * Home inside its own Suspense, so it never holds the page.
 */
export async function DetailsGuideHomeCard({ eventId, memberType }: { eventId: string; memberType: string | null }) {
  // Who Details is for, first — nobody else pays for the reads below.
  if (memberType !== 'couple') return null;
  const profile = await resolveProfileByEvent(eventId).catch(() => null);
  if (!profile || !makerHasWork(memberType, surfaceEnabled(profile, 'website'))) return null;
  const supabase = await createClient();
  const plan = await readGuidedPlan({ supabase, admin: createAdminClient(), eventId }).catch((e: unknown) => {
    console.error('[home] the guided flow could not be read:', e instanceof Error ? e.message : e);
    return null;
  });
  if (!plan) return null;
  const at = homeProgress(plan);
  if (!at) return null;
  const next = stepOf(plan, at.next);
  const share = Math.round((at.done / Math.max(1, at.total)) * 100);
  return (
    <Link
      href={`/dashboard/${eventId}/launch?tool=details&guide=1`}
      data-home-guide={at.round}
      className="sn-tile sn-press flex items-center gap-3 text-left"
    >
      <span aria-hidden className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta/10 text-terracotta-700">
        <ListChecks className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">
          Your Event Hub · Round {at.round} · {at.done} of {at.total}
        </span>
        <span className="mt-0.5 block text-xs text-ink/60">
          {at.title}
          {next ? ` — next: ${next.title}` : ''}
        </span>
        <span aria-hidden className="mt-1.5 block h-1 w-full max-w-[12rem] overflow-hidden rounded-full bg-ink/10">
          <span className="block h-full rounded-full bg-terracotta-700" style={{ width: `${share}%` }} />
        </span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-terracotta-700">
        Continue
        <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
      </span>
    </Link>
  );
}
