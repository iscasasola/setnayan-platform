import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/app/_components/logo';
import { SetnayanMarkLine } from '@/app/_components/setnayan-mark-line';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventSetnayanMark } from '@/lib/setnayan-mark-by-plan.server';
import type { SetnayanMark } from '@/lib/setnayan-mark-by-plan';

/**
 * 🏷 THE PLAN'S MARK ON A GUEST PAGE THAT IS NOT THE HUB ITSELF (seat pass · find my table · recap) — Build 6 Lane L,
 * DECISION_LOG 2026-11-04. These pages printed "Powered by Setnayan · setnayan.com" on EVERY event, an Event Pro one
 * included. Each reads the event's mark here (`eventSetnayanMark`, one cached read per request) and draws the ONE line
 * (`SetnayanMarkLine`). No event id (a page that could not read its event) → the free watermark, the safe default.
 */
async function markOf(eventId: string | null | undefined): Promise<SetnayanMark> {
  if (!eventId) return 'watermark';
  return eventSetnayanMark(createAdminClient(), eventId).catch((): SetnayanMark => 'watermark');
}

export async function EventSetnayanMarkLine({ eventId, className }: { eventId: string | null | undefined; className?: string }) {
  return <SetnayanMarkLine mark={await markOf(eventId)} className={className} />;
}

/**
 * The header's brand on those pages: Setnayan's logo and name on a FREE event (as before); on Event Plus and Event Pro
 * the page's one quiet mark is the footer's (Plus) or there is none (Pro), so the header link names the way back
 * instead — "← Event Hub", in the same small type.
 */
export async function EventHubHeaderBrand({ eventId }: { eventId: string | null | undefined }) {
  if ((await markOf(eventId)) === 'watermark') {
    return (
      <>
        <Logo height={28} />
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink/70">Setnayan</span>
      </>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.2em] text-ink/70" data-setnayan-mark="header-none">
      <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      Event Hub
    </span>
  );
}
