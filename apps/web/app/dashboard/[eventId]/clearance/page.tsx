import { eventRowOnce } from '@/lib/event-row-once';
import Link from 'next/link';
import { PageMasthead } from '@/app/_components/page-masthead';
import { redirect } from 'next/navigation';
import { ArrowLeft, CheckCircle2, MonitorPlay, QrCode, Sparkles, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { getCurrentUser } from '@/lib/auth';
import { SubmitButton } from '@/app/_components/submit-button';
import { closeOutTheDay } from './actions';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { EVENT_CLOCK_COLUMNS } from '@/lib/event-clock';
import { eventClockOf } from '@/lib/event-clock.server';
import { closeOutOpen } from '@/lib/close-out-open';
import { liveStudioControllerHref } from '@/lib/live-studio-control';
import { eventNoun } from '@/lib/event-noun';

export const metadata = { title: 'Close out the day' };

type Props = { params: Promise<{ eventId: string }>; searchParams: Promise<{ error?: string }> };

/**
 * Wrap-up / clearance (Event Lifecycle Menu PR3) — the event-level gate that
 * flips the menu Day-of → After. A short checklist (stop the livestream · freeze
 * the photo wall into the recap · close check-in — links so the couple can wind
 * each down) and a single "Close out the day" action that stamps
 * events.cleared_at. Couple OR delegated coordinator.
 */
export default async function ClearancePage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const { error: errorKey } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const { data: membership, error: membershipError } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (membershipError) {
    logQueryError(
      'ClearancePage.membership',
      membershipError,
      { event_id: eventId },
      'graceful_degrade',
    );
  }
  if (!membership || !['couple', 'coordinator'].includes(membership.member_type as string)) {
    redirect(`/dashboard/${eventId}`);
  }

  const { data: event, error: eventError } = await eventRowOnce(supabase, eventId, `event_type, ${EVENT_CLOCK_COLUMNS}`, () =>
      supabase
    .from('events')
    .select(`event_type, ${EVENT_CLOCK_COLUMNS}`)
    .eq('event_id', eventId)
    .maybeSingle());
  if (eventError) {
    logQueryError(
      'ClearancePage.event',
      eventError,
      { event_id: eventId },
      'graceful_degrade',
    );
  }
  /*
    ⚠ THIS SCREEN TOLD A MOVIE NIGHT THAT ITS WEDDING WAS WRAPPED.
    The copy was written when weddings were the only event type; every other
    type now reaches it. `eventNoun` is the shipped resolver for exactly this
    (weddings keep "wedding" byte-identical, everything else reads "event") —
    a second hand-written conditional here would drift from it.
  */
  const noun = eventNoun((event as { event_type?: string | null } | null)?.event_type ?? null);
  const cleared = Boolean((event as { cleared_at?: string | null } | null)?.cleared_at);

  const base = `/dashboard/${eventId}`;
  const open = closeOutOpen(eventClockOf(event));

  if (cleared) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <div className="py-2 text-center">
          <CheckCircle2 aria-hidden className="mx-auto h-8 w-8 text-success-600" strokeWidth={1.75} />
          <h1 className="mt-3 text-lg font-semibold text-ink">The day is closed out</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink/70">
            Your {noun} is wrapped. Your dashboard now leads with the summary — guests, suppliers,
            your services, your photos, and the editorial maker where you write the story.
          </p>
          <Link
            href={base}
            className="ab ab-brand ab-main inline-flex min-h-11 items-center justify-center gap-1.5 mt-5"
          >
            Go to your dashboard
            <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      </div>
    );
  }

  const steps = [
    // A2-G18: the live controller, where the broadcast is ended — not the Event Hub Maker one hop away.
    { label: 'Stop the livestream', href: liveStudioControllerHref(eventId), Icon: Sparkles, note: 'End any live broadcast that is still running.' },
    { label: 'Freeze Memory lane', href: `${base}/live`, Icon: MonitorPlay, note: 'Lock Memory lane so it becomes the recap.' },
    { label: 'Close check-in', href: `${base}/guests/checkin`, Icon: QrCode, note: 'Last arrivals are in — close the desk.' },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <PageMasthead title="Close out the day" />

      <ul className="mt-6 space-y-2">
        {steps.map((s) => {
          const Icon = s.Icon;
          return (
            <li key={s.label}>
              <Link
                href={s.href}
                className="sn-row group flex items-center justify-between gap-3 p-4 transition-colors hover:border-terracotta/40"
              >
                <span className="flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
                    <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-ink">{s.label}</span>
                    <span className="block text-xs text-ink/70">{s.note}</span>
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

      {errorKey ? (
        <p role="alert" className="mt-6 text-sm text-terracotta-700" data-close-out-error={errorKey}>
          {errorKey === 'too_early'
            ? 'Close out opens on the day itself — nothing was changed.'
            : 'Couldn’t close out the day — nothing was changed. Try again.'}
        </p>
      ) : null}

      {/* A2-P8: the irreversible button is offered only once The Day has opened at the venue (`closeOutOpen`). */}
      {open ? (
        // A2-G19: irreversible, so one confirm asks first (confirm only for the irreversible).
        <ConfirmForm
          action={closeOutTheDay.bind(null, eventId)}
          className="mt-6"
          title="Close out the day?"
          message="Your dashboard moves to the summary of the day. This can’t be undone from here."
          confirmLabel="Close out the day"
        >
          <SubmitButton className="button-primary w-full sm:w-auto" pendingLabel="Closing out…">
            Close out the day
          </SubmitButton>
          <p className="mt-2 text-xs text-ink/70">
            It can&rsquo;t be undone from here, so wrap up the live services first.
          </p>
        </ConfirmForm>
      ) : (
        <p className="mt-6 text-sm text-ink/70" data-close-out-not-yet="">
          Close out opens on the day itself. Until then there is nothing to wrap up.
        </p>
      )}
    </div>
  );
}
