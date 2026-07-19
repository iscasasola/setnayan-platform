import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, CalendarClock, Pencil, Lock, Link2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { resolveProfile, surfaceEnabled } from '@/lib/event-type-profile';
import { eventNoun } from '@/lib/event-noun';
import { LaunchStdButton } from '../../studio/save-the-date/_components/launch-std-button';
import { WebsiteLaunchPreview } from './_components/website-launch-preview';

export const metadata = { title: 'Launch your website' };

/**
 * /dashboard/[eventId]/website/launch — the couple's "Launch" surface.
 *
 * Owner ask 2026-06-28: launch + preview should be a first-class sidebar
 * destination for EVERY user/event (not buried in the Save-the-Date studio).
 * This page brings the two together:
 *   1. PREVIEW — see what each part of the website looks like (live · invitation
 *      · wedding-day · after), via the host-gated ?phase override.
 *   2. LAUNCH — go public now OR schedule a future go-live (reuses the same
 *      LaunchStdButton panel the Save-the-Date studio uses, so the control + its
 *      scheduled_launch_at semantics never fork).
 *
 * Event-type aware: only events whose profile enables the 'website' surface
 * (weddings today) reach this page; others are redirected. The nav item is
 * gated the same way (layout.tsx → websiteEnabled), so this is defence-in-depth.
 *
 * Host gate mirrors the Save-the-Date studio (couple membership) — the launch
 * actions themselves enforce requireCouple, so the page matches where they work.
 */
export default async function WebsiteLaunchPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select(
      'event_id, display_name, slug, event_type, landing_page_visibility, std_launched_at, scheduled_launch_at',
    )
    .eq('event_id', eventId)
    .maybeSingle();

  if (!event) redirect(`/dashboard/${eventId}`);

  // Event-type gate — the public website (and therefore "launch") only exists
  // for event types whose profile enables the 'website' surface.
  const profile = await resolveProfile((event.event_type as string | null) ?? 'wedding');
  if (!surfaceEnabled(profile, 'website')) redirect(`/dashboard/${eventId}`);

  // Couple gate — only a couple member manages launch (the actions are
  // requireCouple). Non-couples (incl. moderators) bounce to the event home.
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();
  if (!membership) redirect(`/dashboard/${eventId}`);

  const slug = (event.slug as string | null) ?? null;
  const visibility = (event.landing_page_visibility ?? 'private') as
    | 'public'
    | 'unlisted'
    | 'private';
  const stdLaunched = Boolean(event.std_launched_at) || visibility === 'public';
  const scheduledAt =
    typeof event.scheduled_launch_at === 'string' ? event.scheduled_launch_at : null;
  // Relative URL keeps the preview iframe same-origin (so the host session +
  // ?phase override ride along) and works in every environment.
  const publicLandingUrl = slug ? `/${slug}` : null;

  return (
    <section className="space-y-8">
      {/* Header */}
      <header className="sn-reveal space-y-3">
        <Link
          href={`/dashboard/${eventId}/studio`}
          className="inline-flex items-center gap-1.5 text-sm text-terracotta hover:text-terracotta-700"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Back to Studio
        </Link>
        <div className="space-y-2">
          <p className="sn-eye flex items-center gap-2">
            <CalendarClock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Launch
          </p>
          <h1 className="sn-h1">
            Preview &amp; launch your website
          </h1>
          <p className="max-w-prose text-base text-ink/70">
            See what every part of {event.display_name ? <em>{event.display_name}</em> : `your ${eventNoun(event.event_type)} page`}{' '}
            looks like, then take it live — now, or at a time you choose.
          </p>
        </div>
      </header>

      {/* Launch panel — reused from the Save-the-Date studio so the control +
          its scheduling semantics are single-sourced. */}
      <LaunchStdButton
        eventId={eventId}
        slug={slug}
        initialLaunched={stdLaunched}
        initialScheduledAt={scheduledAt}
      />

      {/* Preview each part */}
      <div className="space-y-3">
        <h2 className="font-serif text-2xl italic tracking-tight">See each part</h2>
        {publicLandingUrl ? (
          <WebsiteLaunchPreview eventId={eventId} publicLandingUrl={publicLandingUrl} />
        ) : (
          <div className="flex flex-col items-start gap-3 sn-tile p-6">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Link2 aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
              Set your {eventNoun(event.event_type)} URL to preview
            </p>
            <p className="max-w-prose text-sm text-ink/65">
              Once you pick your {eventNoun(event.event_type)} URL in the website editor, a live preview of
              every part shows up here.
            </p>
            <Link
              href={`/site-editor/${eventId}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-mulberry px-4 py-2 text-sm font-semibold text-cream hover:bg-mulberry-600"
            >
              <Pencil aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Open website editor
            </Link>
          </div>
        )}
      </div>

      {/* Related actions */}
      <footer className="flex flex-wrap gap-3 border-t border-ink/10 pt-6">
        <Link
          href={`/site-editor/${eventId}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink/40"
        >
          <Pencil aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Edit your website
        </Link>
        <Link
          href={`/dashboard/${eventId}/website/privacy`}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink/40"
        >
          <Lock aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Who can view
        </Link>
      </footer>
    </section>
  );
}
