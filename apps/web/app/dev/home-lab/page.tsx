/**
 * /dev/home-lab — the phone Home's first screen (owner-APPROVED 2026-10-01,
 * "THE SIMPLE PHONE APP — APPROVED", frame 1) on fixture data: no sign-in, no
 * database. DEV-ONLY: production builds 404 this route, the same kill-switch as
 * `/dev/details-lab`. It draws the REAL `HomeFirstScreen` with the REAL picker
 * and glance formatters, so what it shows is what the Home shows.
 *
 *   ?next=guide|date|papic|ai|plan   which Next card (default: guide)
 *   ?unread=1                        every read failed — the numbers read "—"
 *   ?hidden=1                        the budget is not shared with this viewer
 */
import { notFound } from 'next/navigation';
import { HomeFirstScreen } from '@/app/dashboard/[eventId]/_components/home-first-screen';
import { glanceCount, glanceDays, glanceMoney, pickHomeNext, type HomeNextInput } from '@/lib/home-first-screen';

export const dynamic = 'force-dynamic';

const STATES: Record<string, HomeNextInput> = {
  guide: {
    guide: { round: 2, roundTitle: 'Invitations', done: 3, total: 7, nextTitle: 'Schedule' },
    hasDate: true,
    noun: 'wedding',
    papicReady: true,
    aiOffer: true,
  },
  date: { guide: null, hasDate: false, noun: 'wedding', papicReady: false, aiOffer: true },
  papic: { guide: null, hasDate: true, noun: 'wedding', papicReady: true, aiOffer: true },
  ai: { guide: null, hasDate: true, noun: 'wedding', papicReady: false, aiOffer: true },
  plan: { guide: null, hasDate: true, noun: 'wedding', papicReady: false, aiOffer: false },
};

export default async function HomeLab({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; unread?: string; hidden?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const q = await searchParams;
  const unread = q.unread === '1';
  const input = STATES[q.next ?? 'guide'] ?? STATES.guide!;
  return (
    <div className="min-h-screen bg-cream px-4 pb-6 pt-3">
      <HomeFirstScreen
        eventId="00000000-0000-4000-8000-000000000000"
        cover={{ eyebrow: 'Wedding · March 13, 2027', name: 'Ana & Miguel' }}
        next={pickHomeNext(input)}
        days={glanceDays(163)}
        coming={glanceCount(96, !unread)}
        noReply={glanceCount(35, !unread)}
        noReplyWaiting={!unread}
        money={
          q.hidden === '1'
            ? null
            : { paid: glanceMoney(unread ? null : 120000), owing: glanceMoney(unread ? null : 45000) }
        }
      />
      <div id="home-all" className="mt-6 rounded-xl border border-dashed border-ink/20 p-6 text-center text-sm text-ink/50">
        The rest of Home (the dashboard) renders here, below the fold.
      </div>
    </div>
  );
}
