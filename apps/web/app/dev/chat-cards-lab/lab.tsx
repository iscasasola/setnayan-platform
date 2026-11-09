/**
 * /dev/chat-cards-lab — Supplier Build 3 · lane B's parts on fixture data: no sign-in, no database. DEV-ONLY:
 * production builds 404 this route.
 *
 *   ?m=meeting&step=1..4   the (+) Meeting card on the shared one-step frame, at that step (filled up to it)
 *   ?m=details             Details › Agreed now: a quote revised once, a date moved, a guest count changed twice
 *                          &open=guest_count opens that row's history ("Changed 2×")
 *   ?m=empty               Agreed now on a brand-new client — every row present, each saying so in words
 *
 * Names are samples: nobody real.
 */
import { notFound } from 'next/navigation';
import { MeetingStepCard } from '@/app/_components/chat/meeting-step-card';
import { AgreedNowView } from '@/app/_components/chat/agreed-now';
import { SupplierLocksView } from '@/app/vendor-dashboard/clients/[eventId]/_components/supplier-locks-section';
import { LockSwitch } from '@/app/vendor-dashboard/clients/[eventId]/_components/lock-switch';
import { agreedOutcome, agreedRows, type AgreedInputs } from '@/lib/agreed-now';
import { orderQuoteVersions } from '@/lib/quote-versions';

const ME = '00000000-0000-4000-8000-0000000000aa';
const ANA = '00000000-0000-4000-8000-0000000000bb';
const EVENT_DAY = '2026-12-12';

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

export default async function ChatCardsLab({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const m = typeof sp.m === 'string' ? sp.m : 'meeting';

  if (m === 'meeting') {
    const step = Math.min(4, Math.max(1, Number(sp.step ?? 1) || 1));
    const seed = {
      ...(step > 1 ? { kind: 'Tasting' } : {}),
      ...(step > 2 ? { date: '2026-11-20' } : {}),
      ...(step > 3 ? { time: '14:00' } : {}),
    };
    return (
      <main className="min-h-dvh bg-cream px-4 py-6" data-lab-chat-cards="meeting">
        <div className="mx-auto max-w-md">
          <MeetingStepCard
            threadId="00000000-0000-4000-8000-00000000c0de"
            returnPath="/dev/chat-cards-lab"
            eventDate={EVENT_DAY}
            initialStep={step - 1}
            seed={seed}
          />
        </div>
      </main>
    );
  }

  const base: AgreedInputs = {
    viewerUserId: ME,
    quotes: [],
    event: { eventDate: null, estimatedPax: null, finalPax: null },
    changes: [],
    meetings: [],
    names: new Map([[ANA, 'Ana']]),
    booking: { isBooked: false, declined: false },
    quoteBy: 'You',
  };
  const quotes = orderQuoteVersions([
    { proposal_id: 'q1', public_id: 'S89P-LAB1', event_id: 'e', vendor_profile_id: 'v', status: 'superseded', sent_at: daysAgo(20), created_at: daysAgo(20), total_centavos: 10_500_000, line_items: [], payment_schedule: null },
    { proposal_id: 'q2', public_id: 'S89P-LAB2', event_id: 'e', vendor_profile_id: 'v', status: 'accepted', sent_at: daysAgo(12), created_at: daysAgo(12), total_centavos: 11_250_000, line_items: [], payment_schedule: null },
  ]);
  const ch = (id: number, field: 'event_date' | 'guest_estimate', from: string, to: string, by: string | null, at: string) => ({
    changeId: id, eventId: 'e', vendorProfileId: null, field, subjectId: null, fromValue: from, toValue: to, changedBy: by, changedAt: at,
  });
  const inputs: AgreedInputs =
    m === 'empty'
      ? base
      : {
          ...base,
          quotes,
          event: { eventDate: EVENT_DAY, estimatedPax: 170, finalPax: null },
          changes: [
            ch(1, 'guest_estimate', '150', '160', ANA, daysAgo(6)),
            ch(2, 'guest_estimate', '160', '170', ANA, daysAgo(2)),
            ch(3, 'event_date', '2026-12-05', EVENT_DAY, ANA, daysAgo(15)),
          ],
          meetings: [{ appointmentId: 'm1', title: 'Tasting', scheduledAt: '2026-11-20T06:00:00Z', status: 'confirmed' }],
          booking: { isBooked: true, declined: false },
        };
  const rows = agreedRows(inputs);
  const outcome = agreedOutcome(inputs.booking, inputs.quotes);
  const open = typeof sp.open === 'string' ? sp.open : null;
  return (
    <main className="min-h-dvh bg-cream px-4 py-6" data-lab-chat-cards={m}>
      <div className="mx-auto max-w-md">
        <AgreedNowView outcome={outcome} rows={rows} historyLoaded openKey={open} />
        {/* 🔒 Round 2 — Your locks, under Agreed now (empty with m=empty; &locks=failed draws the refused read). */}
        <div className="mt-5">
          <SupplierLocksView
            eventId="lab-event"
            vendorProfileId="lab-shop"
            failed={sp.locks === 'failed'}
            quote={m === 'empty' ? null : { proposal_id: 'q2', title: 'Wedding day coverage', changes_locked: true, plan_locked: false }}
            forms={m === 'empty' ? [] : [{ formId: 'f1', locked: false, title: 'Wedding day details' }]}
            questionsLocked={m === 'empty' ? null : false}
            Switch={LockSwitch}
          />
        </div>
      </div>
    </main>
  );
}
