/**
 * Phase 0 Date Selection — entry route.
 *
 * Per CLAUDE.md 2026-05-22 owner directive — the emotional entry point to
 * wedding planning. Three paths:
 *
 *   1. "I have a date in mind"        → DatePicker component (?path=direct)
 *   2. "Help me pick a meaningful one" → FourQuestionFlow component (?path=guided)
 *   3. "I'm not ready yet"            → markDateUndecided action,
 *                                       redirects back to event home
 *
 * The default landing view shows the 3-option chooser. Each path's URL is
 * shareable so the back-stack works naturally.
 *
 * Per orphan-prevention rule [[feedback_setnayan_orphan_prevention]]:
 * entry points are (a) auspicious chip on /dashboard/[eventId] event home
 * (added in this PR — links here when date_status='locked'), and (b) the
 * "Pick your date →" prompt on event home (added in this PR — links here
 * when date_status != 'locked'). No new orphan routes.
 */

import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Calendar, Heart, Sparkles, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import type { CeremonyType, MeaningfulDate, MeaningfulDateKind } from '@/lib/auspicious-date';
import { DatePicker } from './_components/date-picker';
import { FourQuestionFlow } from './_components/four-question-flow';
import { markDateUndecided } from './actions';

export const metadata = { title: 'Pick your date · Setnayan' };

const CEREMONY_TYPES: CeremonyType[] = [
  'catholic',
  'civil',
  'inc',
  'christian',
  'muslim',
  'cultural',
  'mixed',
];

function isCeremonyType(value: unknown): value is CeremonyType {
  return typeof value === 'string' && (CEREMONY_TYPES as readonly string[]).includes(value);
}

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{ path?: string }>;
};

export default async function DateSelectionPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = searchParams ? await searchParams : {};
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/dashboard/${eventId}/date-selection`);

  const supabase = await createClient();

  // Defense-in-depth: the parent EventLayout already gates couple membership,
  // but this route can be deep-linked so confirm again.
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || membership.member_type !== 'couple') {
    notFound();
  }

  // Pull event + meaningful dates in one round trip.
  const [eventRes, meaningfulRes] = await Promise.all([
    supabase
      .from('events')
      .select(
        'event_id, display_name, event_date, ceremony_type, date_status, event_date_precision',
      )
      .eq('event_id', eventId)
      .maybeSingle(),
    supabase
      .from('event_meaningful_dates')
      .select('meaningful_date, kind, note')
      .eq('event_id', eventId)
      .order('meaningful_date', { ascending: true }),
  ]);

  const event = eventRes.data;
  if (!event) notFound();

  const ceremonyType = isCeremonyType(event.ceremony_type)
    ? (event.ceremony_type as CeremonyType)
    : null;

  const meaningfulDates: MeaningfulDate[] = (meaningfulRes.data ?? []).map((r) => ({
    date: r.meaningful_date as string,
    kind: r.kind as MeaningfulDateKind,
    note: (r.note as string | null) ?? null,
  }));

  const path = typeof search.path === 'string' ? search.path : null;
  const backToHomeHref = `/dashboard/${eventId}`;
  const backToChooserHref = `/dashboard/${eventId}/date-selection`;

  // Path: direct calendar pick
  if (path === 'direct') {
    return (
      <section className="mx-auto max-w-2xl">
        <DatePicker
          eventId={eventId}
          ceremonyType={ceremonyType}
          meaningfulDates={meaningfulDates}
          initialDate={event.event_date ?? null}
          backLabel="Pick another path"
          backHref={backToChooserHref}
        />
      </section>
    );
  }

  // Path: 4-question guided flow
  if (path === 'guided') {
    return (
      <section className="mx-auto max-w-2xl">
        <FourQuestionFlow
          eventId={eventId}
          initialCeremonyType={ceremonyType}
          initialMeaningfulDates={meaningfulDates}
          backHref={backToChooserHref}
        />
      </section>
    );
  }

  // Default: 3-path chooser
  return (
    <section className="mx-auto max-w-2xl space-y-8">
      <a
        href={backToHomeHref}
        className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Back to {event.display_name}
      </a>

      <header className="space-y-2 text-center sm:text-left">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
          Setnayan · Phase 0
        </p>
        <h1 className="font-display text-3xl italic leading-tight text-ink sm:text-4xl">
          Congratulations. Let&apos;s start with your date.
        </h1>
        <p className="text-base text-ink/70">
          Every great wedding has one moment that everything else circles around. We&apos;ll help
          you find yours — and show you what makes the day you pick special.
        </p>
      </header>

      <div className="grid gap-3">
        <PathCard
          href={`${backToChooserHref}?path=direct`}
          icon={Calendar}
          title="I have a date in mind"
          description="Pick from the calendar and see what makes your date beautiful."
          accent="terracotta"
        />
        <PathCard
          href={`${backToChooserHref}?path=guided`}
          icon={Heart}
          title="Help me pick a meaningful one"
          description="Four soft questions about what matters to you, then five date suggestions that resonate."
          accent="terracotta"
        />
        <NotReadyForm eventId={eventId} />
      </div>

      <p className="text-center text-xs text-ink/50 sm:text-left">
        You can come back to this any time from your event home.
      </p>
    </section>
  );
}

function PathCard({
  href,
  icon: Icon,
  title,
  description,
  accent,
}: {
  href: string;
  icon: typeof Calendar;
  title: string;
  description: string;
  accent: 'terracotta' | 'muted';
}) {
  const accentClasses =
    accent === 'terracotta'
      ? 'border-ink/10 bg-cream hover:border-terracotta/45 hover:bg-terracotta/[0.04]'
      : 'border-ink/10 bg-cream hover:border-ink/25 hover:bg-ink/[0.02]';
  const iconClasses = accent === 'terracotta' ? 'text-terracotta' : 'text-ink/55';
  return (
    <a
      href={href}
      className={`flex items-start gap-4 rounded-2xl border p-5 transition-colors sm:p-6 ${accentClasses}`}
    >
      <span
        className={`mt-0.5 inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-cream ring-1 ring-ink/10 ${iconClasses}`}
      >
        <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <span className="space-y-1">
        <span className="block font-display text-xl italic text-ink">{title}</span>
        <span className="block text-sm text-ink/65">{description}</span>
      </span>
    </a>
  );
}

function NotReadyForm({ eventId }: { eventId: string }) {
  return (
    <form action={markDateUndecided}>
      <input type="hidden" name="event_id" value={eventId} />
      <button
        type="submit"
        className="flex w-full items-start gap-4 rounded-2xl border border-ink/10 bg-cream p-5 text-left transition-colors hover:border-ink/25 hover:bg-ink/[0.02] sm:p-6"
      >
        <span className="mt-0.5 inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-cream text-ink/55 ring-1 ring-ink/10">
          <Clock aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <span className="space-y-1">
          <span className="block font-display text-xl italic text-ink">
            I&apos;m not ready yet
          </span>
          <span className="block text-sm text-ink/65">
            That&apos;s okay. Start exploring the rest of your event and come back when you are.
          </span>
        </span>
      </button>
    </form>
  );
}
