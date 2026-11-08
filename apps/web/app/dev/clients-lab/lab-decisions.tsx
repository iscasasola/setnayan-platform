'use client';

import { DetailsDecisionsList } from '@/app/vendor-dashboard/clients/[eventId]/_components/details-decisions-list';
import { threadDecisionFacts } from '@/lib/thread-decisions';

/**
 * /dev/clients-lab · Details' Decisions (Build 2 #42) on v118's own five rows (`DEC2`, "Reyes & Santos wedding"):
 * the REAL list and the REAL merge (`threadDecisionFacts`), fed lab messages and lab card rows instead of the thread
 * page's draw. The four answers are client stand-ins that write nothing — no route, no server action.
 *
 * `?decisions=none` draws the empty line; `?decisions=partial` the refused-read line.
 */
const at = (iso: string) => Date.parse(iso);
const noop = async () => undefined;

export function LabDetailsDecisions({ mode }: { mode: 'full' | 'none' | 'partial' }) {
  const messages =
    mode === 'none'
      ? []
      : [
          { created_at: '2026-10-05T02:00:00Z', proposal_id: 'q1' },
          { created_at: '2026-10-20T02:00:00Z', appointment_id: 'a1' },
          { created_at: '2026-10-28T02:00:00Z', amendment_id: 'm1' },
        ];
  const facts = threadDecisionFacts({
    viewer: 'vendor',
    messages,
    cards: {
      quotes: { q1: { publicId: 'S89Q-LAB0000001', title: 'Wedding coverage · v2', totalCentavos: 4_000_000, status: 'accepted', resolvedAt: '2026-10-10T02:00:00Z' } },
      meetings: { a1: { label: 'Ocular visit', scheduled_at: '2026-11-08T02:00:00Z', status: 'confirmed', initiated_by: 'vendor' } },
      meetingPreviousAt: { a1: null },
      adjustments:
        mode === 'partial'
          ? {}
          : { m1: { data: { note: 'Same-day edit plays at dinner', status: 'proposed', lockedAt: null, raised_by: 'couple' }, items: [{ amount_php: 8000 }] } },
    },
    payments:
      mode === 'none'
        ? []
        : [{ paymentId: 'p1', loggedAtMs: at('2026-11-01T02:00:00Z'), amountPhp: 30000, method: 'GCash', label: 'Balance', confirmedAtMs: null, ofTotalPhp: 40000 }],
    guestCounts:
      mode === 'none' ? [] : [{ id: 'lab-event', changedAtMs: at('2026-11-03T02:00:00Z'), livePax: 142, quotedPax: 150, surchargePhp: -2400 }],
  });
  return (
    <DetailsDecisionsList
      facts={facts}
      partial={mode === 'partial'}
      reply={{
        threadId: 'lab-thread',
        eventId: 'lab-event',
        vendorProfileId: 'lab-shop',
        returnPath: '/dev/clients-lab?v=pick&page=details',
        eventDate: '2026-11-08',
        supplierActions: { confirmPayment: noop, refusePayment: noop, applySurcharge: noop, holdPrice: noop },
      }}
    />
  );
}
