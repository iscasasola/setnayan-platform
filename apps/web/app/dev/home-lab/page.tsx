/**
 * /dev/home-lab — the phone Home's first screen (owner-APPROVED 2026-10-01,
 * "THE SIMPLE PHONE APP — APPROVED", frame 1) on fixture data: no sign-in, no
 * database. DEV-ONLY: production builds 404 this route, the same kill-switch as
 * `/dev/details-lab`. It draws the REAL `HomeFirstScreen` with the REAL picker
 * and glance formatters, so what it shows is what the Home shows.
 *
 *   ?next=guide|date|guests|invite|papic|ai|plan   which Next card (default: guide)
 *   ?unread=1 (or ?fail=1)           every read failed — said so, with ⟳ Reload (H3)
 *   ?hidden=1                        the budget is not shared with this viewer
 *   ?proto=1                         the prototype's own figures (Cale & Ice, 72 days, 7 coming…)
 *   ?store=1                         the App Store / Play shell (no Your services row)
 */
import { notFound } from 'next/navigation';
import { HomeFirstScreen } from '@/app/dashboard/[eventId]/_components/home-first-screen';
import { HomeWhatsNext } from '@/app/dashboard/[eventId]/_components/home-parts';
import { getNavSlotMap } from '@/lib/nav-registry';
import {
  aiStatus,
  glanceCount,
  glanceDays,
  glanceMoney,
  homeServices,
  papicStatus,
  pickHomeNext,
  type HomeNextInput,
} from '@/lib/home-first-screen';

export const dynamic = 'force-dynamic';

const DONE_GUESTS = { total: 96, unsent: 0 };
const STATES: Record<string, HomeNextInput> = {
  guide: {
    guide: { done: 9, total: 20, stageTitle: 'Invitation', stageDone: 4, stageTotal: 8 },
    hasDate: true,
    guests: DONE_GUESTS,
    noun: 'wedding',
    papicReady: true,
    aiOffer: true,
  },
  date: { guide: null, hasDate: false, guests: DONE_GUESTS, noun: 'wedding', papicReady: false, aiOffer: true },
  guests: { guide: null, hasDate: true, guests: { total: 0, unsent: 0 }, noun: 'wedding', papicReady: true, aiOffer: true },
  invite: { guide: null, hasDate: true, guests: { total: 96, unsent: 58 }, noun: 'wedding', papicReady: true, aiOffer: true },
  papic: { guide: null, hasDate: true, guests: DONE_GUESTS, noun: 'wedding', papicReady: true, aiOffer: true },
  ai: { guide: null, hasDate: true, guests: DONE_GUESTS, noun: 'wedding', papicReady: false, aiOffer: true },
  plan: { guide: null, hasDate: true, guests: DONE_GUESTS, noun: 'wedding', papicReady: false, aiOffer: false },
};

export default async function HomeLab({
  searchParams,
}: {
  searchParams: Promise<{ proto?: string; next?: string; unread?: string; fail?: string; hidden?: string; store?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const q = await searchParams;
  const unread = q.unread === '1' || q.fail === '1';
  const proto = q.proto === '1';
  /* The prototype's own figures, for the side-by-side (prototypes/home_and_guests_2026-10-07_fable.html). */
  const F = proto
    ? { eyebrow: 'Wedding · Fri, Dec 18, 2026', name: 'Cale & Ice', days: 72, coming: 7, noReply: 2, paid: 0, owing: 1056000 }
    : { eyebrow: 'Wedding · March 13, 2027', name: 'Ana & Miguel', days: 163, coming: 96, noReply: 35, paid: 120000, owing: 45000 };
  const picked = proto
    ? { guide: null, hasDate: true, guests: { total: 14, unsent: 3 }, noun: 'wedding' as const, papicReady: false, aiOffer: false }
    : STATES[q.next ?? 'guide'] ?? STATES.guide!;
  /* An unread guest list reaches the picker as `null` — exactly as the page hands it. */
  const input: HomeNextInput = unread ? { ...picked, guide: null, guests: null } : picked;
  const next = pickHomeNext(input);
  const slots = await getNavSlotMap().catch(() => null);
  const E = '00000000-0000-4000-8000-000000000000';
  return (
    <div className="min-h-screen bg-cream px-4 pb-6 pt-3">
      <HomeFirstScreen
        eventId={E}
        cover={{ eyebrow: F.eyebrow, name: F.name }}
        next={next}
        days={glanceDays(F.days)}
        coming={glanceCount(F.coming, !unread)}
        noReply={glanceCount(F.noReply, !unread)}
        noReplyWaiting={!unread}
        figures={{
          days: F.days,
          coming: unread ? null : F.coming,
          noReply: unread ? null : F.noReply,
          money: q.hidden === '1' ? null : unread ? 'unread' : { paid: F.paid, owing: F.owing },
        }}
        navSlots={slots}
        whatsNext={
          <HomeWhatsNext
            open={3}
            rows={[
              { id: 'b', title: 'Book a supplier', sub: 'Catering · 2 quotes in', href: `/dashboard/${E}/vendors`, verb: 'book', cta: 'Book' },
              { id: 'p', title: 'Settle a payment', sub: 'Seda Vertis North · first payment · by Oct 5', href: `/dashboard/${E}/vendors`, verb: 'pay', cta: 'Pay' },
              { id: 'r', title: 'Fill a role', sub: 'Emcee · nobody picked yet', href: `/dashboard/${E}/guests`, verb: 'role', cta: 'Pick' },
            ]}
            checklist={{ href: `/dashboard/${E}/checklist`, pct: 47 }}
          />
        }
        money={
          q.hidden === '1'
            ? null
            : { paid: glanceMoney(unread ? null : F.paid), owing: glanceMoney(unread ? null : F.owing) }
        }
        services={homeServices({
          next: next.kind,
          storeShell: q.store === '1',
          papic: papicStatus({
            permitted: true,
            tile: unread ? 'failed' : proto ? { photosGathered: 0, preCapture: true } : { photosGathered: 12, preCapture: false },
          }),
          ai: aiStatus(unread ? null : false),
        })}
      />
    </div>
  );
}
