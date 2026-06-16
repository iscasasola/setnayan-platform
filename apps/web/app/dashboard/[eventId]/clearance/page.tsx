import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, CheckCircle2, MonitorPlay, QrCode, Sparkles, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { SubmitButton } from '@/app/_components/submit-button';
import { closeOutTheDay } from './actions';

export const metadata = { title: 'Close out the day' };

type Props = { params: Promise<{ eventId: string }> };

/**
 * Wrap-up / clearance (Event Lifecycle Menu PR3) — the event-level gate that
 * flips the menu Day-of → After. A short checklist (stop the livestream · freeze
 * the photo wall into the recap · close check-in — links so the couple can wind
 * each down) and a single "Close out the day" action that stamps
 * events.cleared_at. Couple OR delegated coordinator.
 */
export default async function ClearancePage({ params }: Props) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || !['couple', 'coordinator'].includes(membership.member_type as string)) {
    redirect(`/dashboard/${eventId}`);
  }

  const { data: event } = await supabase
    .from('events')
    .select('cleared_at')
    .eq('event_id', eventId)
    .maybeSingle();
  const cleared = Boolean((event as { cleared_at?: string | null } | null)?.cleared_at);

  const base = `/dashboard/${eventId}`;

  if (cleared) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-emerald-300/50 bg-emerald-50 p-8 text-center">
          <CheckCircle2 aria-hidden className="mx-auto h-8 w-8 text-emerald-600" strokeWidth={1.75} />
          <h1 className="mt-3 text-lg font-semibold text-ink">The day is closed out</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink/60">
            Your wedding day is wrapped. The app has moved into After mode — your recap, galleries,
            and vendor reviews live there now.
          </p>
          <Link
            href={base}
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-terracotta px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-terracotta-600"
          >
            Go to your dashboard
            <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      </div>
    );
  }

  const steps = [
    { label: 'Stop the livestream', href: `${base}/launch`, Icon: Sparkles, note: 'End any live broadcast that is still running.' },
    { label: 'Freeze the photo wall', href: `${base}/live`, Icon: MonitorPlay, note: 'Lock the wall so it becomes the recap.' },
    { label: 'Close check-in', href: `${base}/guests/checkin`, Icon: QrCode, note: 'Last arrivals are in — close the desk.' },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <Link
        href={base}
        className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to your dashboard
      </Link>

      <header className="mt-3 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Close out the day</h1>
        <p className="text-sm text-ink/60">
          When the celebration winds down, wrap up the live services and close out — the app moves
          into After mode (recap, galleries, and vendor reviews).
        </p>
      </header>

      <ul className="mt-6 space-y-2">
        {steps.map((s) => {
          const Icon = s.Icon;
          return (
            <li key={s.label}>
              <Link
                href={s.href}
                className="group flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-white p-4 shadow-sm transition-colors hover:border-terracotta/40"
              >
                <span className="flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
                    <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-ink">{s.label}</span>
                    <span className="block text-xs text-ink/55">{s.note}</span>
                  </span>
                </span>
                <ArrowRight
                  aria-hidden
                  className="h-4 w-4 shrink-0 text-ink/30 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={1.75}
                />
              </Link>
            </li>
          );
        })}
      </ul>

      <form action={closeOutTheDay.bind(null, eventId)} className="mt-6">
        <SubmitButton className="button-primary w-full sm:w-auto" pendingLabel="Closing out…">
          Close out the day
        </SubmitButton>
        <p className="mt-2 text-xs text-ink/50">
          You can do this once the celebration is over. It can&rsquo;t be undone from here, so wrap
          up the live services first.
        </p>
      </form>
    </div>
  );
}
