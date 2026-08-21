import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Check, Globe, Lock, EyeOff, Heart, CalendarClock, Rocket, Radio, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  updateLandingPageVisibility,
  setShowcaseConsent,
  setLiveMediaAudience,
} from './actions';
import { eventNoun } from '@/lib/event-noun';
import { resolveSiteReachability } from '@/lib/launch-save-the-date';
import type { EventVisibility } from '@/lib/event-visibility';
import { PageMasthead } from '@/app/_components/page-masthead';

export const metadata = { title: 'Who can view your event page' };

/**
 * /dashboard/[eventId]/website/privacy — landing-page visibility editor.
 *
 * Per CLAUDE.md 2026-05-22 owner directive: hosts need a way to make
 * their wedding landing page private (or restrict who can view it).
 *
 * Three-state picker (Public / Unlisted / Private) — see the migration
 * at `supabase/migrations/20260605050000_events_landing_page_visibility.sql`
 * for the enum + comment. Default is 'public' on every event (V1
 * backwards-compat with the pre-toggle behavior).
 *
 * The actual gate enforcement lives in `apps/web/app/[slug]/page.tsx`:
 * 'public' and 'unlisted' render identically today on the landing page
 * itself; 'private' renders a polite locked screen unless the visitor is
 * authenticated AND tied to the event via event_members, event_moderators,
 * or guests.linked_user_id.
 *
 * Per CLAUDE.md 2026-05-19 row 426 the broader Phase 4 editorial RA 10173
 * guardrails (T+27d reminder email · pseudonymization · private-always
 * field allowlist · right-to-redact · onboarding-time consent checkbox)
 * live in V1.1 iteration 0046 — this PR is the V1 minimum-viable lever.
 */
export default async function PrivacyEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { eventId } = await params;
  const search = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select(
      'event_id, event_type, display_name, slug, landing_page_visibility, scheduled_launch_at, std_launched_at, live_media_public',
    )
    .eq('event_id', eventId)
    .maybeSingle();

  if (!event) redirect(`/dashboard/${eventId}`);

  const currentVisibility = (event.landing_page_visibility ?? 'public') as
    | 'public'
    | 'unlisted'
    | 'invited_accounts'
    | 'private';
  const saved = search.saved === '1';

  // Launch status (read-only mirror — the controls live in the Save-the-Date
  // studio, owner 2026-06-28). Live when public/launched; otherwise scheduled or
  // private. Formatted in Manila time to match the studio scheduler.
  // 🔴 THIS USED TO SAY `Boolean(std_launched_at) || visibility === 'public'`,
  // which made "launched" and "private" both true at once. A couple who
  // launched their Save-the-Date and later set the picker below to Private saw
  // "Your page is live — anyone with your link can view your page" sitting
  // directly above a radio button reading Private. The banner and the control
  // contradicted each other on one screen, and the banner was the wrong one:
  // guests opening the link were getting the locked screen.
  //
  // The question a couple is asking is "can my guests open this?", so it is now
  // answered by the predicate the guest page itself renders from.
  const reach = resolveSiteReachability(event);
  const liveMediaOpen = Boolean(event.live_media_public);
  const launched = reach.reachable;
  const scheduledAt =
    typeof event.scheduled_launch_at === 'string' ? event.scheduled_launch_at : null;
  const scheduledLabel = scheduledAt
    ? new Intl.DateTimeFormat('en-PH', {
        timeZone: 'Asia/Manila',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(scheduledAt))
    : null;

  // Stories showcase consent (user-level). Read via the admin client so
  // the toggle reflects the true state regardless of users-table RLS; defaults
  // to off on any error.
  let showcaseOptedIn = false;
  try {
    const admin = createAdminClient();
    const { data: me } = await admin
      .from('users')
      .select('public_summary_consent_at')
      .eq('user_id', user.id)
      .maybeSingle();
    showcaseOptedIn = Boolean(me?.public_summary_consent_at);
  } catch {
    showcaseOptedIn = false;
  }

  return (
    <section className="space-y-8">
      {/* Header strip — back link + title */}
      <PageMasthead
        titleNode={<>Set who can see your {eventNoun(event.event_type)} page</>}
      />

      {/* Saved confirmation — polite + non-dismissible (gone on next nav) */}
      {saved ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-900"
        >
          <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          <p>Saved. Your {eventNoun(event.event_type)} page now follows this setting.</p>
        </div>
      ) : null}

      {/* Launch status — read-only mirror of the Save-the-Date studio control
          (owner 2026-06-28). Tells the host whether their page is live, scheduled,
          or private, and links to where they actually launch / schedule it. */}
      <div className="flex flex-col gap-3 sn-tile p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {launched ? (
            <Globe aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-success-700" strokeWidth={1.75} />
          ) : reach.launchedButHidden ? (
            // Same precedence as the copy below — a page that is launched AND
            // scheduled AND private must not show a calendar next to the words
            // "Launched — but hidden".
            <Lock aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-ink/55" strokeWidth={1.75} />
          ) : scheduledLabel ? (
            <CalendarClock aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-mulberry" strokeWidth={1.75} />
          ) : (
            <Lock aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-ink/55" strokeWidth={1.75} />
          )}
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-ink">
              {launched
                ? 'Your page is live'
                : reach.launchedButHidden
                  ? 'Launched — but hidden'
                  : scheduledLabel
                    ? 'Launch scheduled'
                    : 'Your page is private'}
            </p>
            <p className="text-sm text-ink/65">
              {launched
                ? 'Your Save-the-Date is launched — anyone with your link can view your page.'
                : reach.launchedButHidden
                  ? 'You launched your Save-the-Date, but the setting below is on Private — guests who open your link see a locked screen. Choose Public or Unlisted to let them in.'
                  : scheduledLabel
                    ? `Goes live ${scheduledLabel} (Manila time). Until then, only you and invited guests can see it.`
                    : 'Launch your Save-the-Date to make your page public — now, or at a time you choose.'}
            </p>
          </div>
        </div>
        <Link
          href={`/dashboard/${eventId}/website/editor`}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-mulberry/30 px-4 py-2 text-sm font-semibold text-mulberry transition hover:bg-mulberry/10 sm:self-center"
        >
          <Rocket aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          {launched
            ? 'Manage launch'
            : reach.launchedButHidden
              ? 'Manage launch'
              : scheduledLabel
                ? 'Change schedule'
                : 'Launch or schedule'}
        </Link>
      </div>

      {/* The picker — three radio cards in a single form */}
      <form action={updateLandingPageVisibility} className="space-y-4">
        <input type="hidden" name="event_id" value={eventId} />

        <fieldset className="space-y-3">
          <legend className="sr-only">Landing-page visibility</legend>

          <VisibilityCard
            value="public"
            currentValue={currentVisibility}
            icon={<Globe aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />}
            title="Public"
            blurb={`Anyone with your ${eventNoun(event.event_type)}'s URL can view your landing page. Search engines may index it after your ${eventNoun(event.event_type)} day.`}
          />

          <VisibilityCard
            value="unlisted"
            currentValue={currentVisibility}
            icon={<EyeOff aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />}
            title="Unlisted"
            blurb="The URL works for anyone you share it with, but your landing page won't be indexed by search engines or surfaced on Setnayan's public pages."
          />

          {/* Owner 2026-08-15 — the fourth audience, between "link only" and
              "private": narrower than a link, wider than yourself.
              🔑 THE BLURB STATES THE HONEST CONSEQUENCE. Recognising a guest
              needs their email written on the list AND that person signed up,
              so on a list of names this admits nobody and reads exactly like
              Private. Saying so here is what stops it being reported as broken;
              a setting that silently shows the page to no one looks like a
              fault, not a choice. */}
          <VisibilityCard
            value="invited_accounts"
            currentValue={currentVisibility}
            icon={<Users aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />}
            title="Only guests with a Setnayan account"
            blurb="People on your guest list who are signed in to Setnayan can view it. Anyone else — including someone you send the link to — sees the locked screen. Guests are recognised by the email on their guest-list entry, so a guest with no email saved, or who hasn't signed up, won't be let in yet."
          />

          <VisibilityCard
            value="private"
            currentValue={currentVisibility}
            icon={<Lock aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />}
            title="Private"
            blurb="Only your guests (in your guest list) and your event moderators can view. Anyone else opening the URL sees a polite locked screen."
          />
        </fieldset>

        <div className="flex flex-wrap gap-3 pt-2">
          <SubmitButton className="button-primary" pendingLabel="Saving…">
            Save changes
          </SubmitButton>
          <Link
            href={`/dashboard/${eventId}/website`}
            className="inline-flex h-11 min-h-[44pt] items-center justify-center gap-2 rounded-md border border-ink/20 bg-cream px-4 text-sm font-medium text-ink transition-colors hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Back
          </Link>
        </div>
      </form>

      {/* Footnote — light context so the host knows what changes immediately */}
      <footer className="sn-tile p-5 text-sm text-ink/65">
        Changes apply right away. Anyone with your URL who already opened the page
        may see the previous view for up to a minute while their browser refreshes.
      </footer>

      {/* ── Live media audience ───────────────────────────────────────────
          🔴 THE COLUMN BEHIND THIS HAD NO CONTROL. `live_media_public` shipped
          as "the couple's opt-in for anonymous live media" and nothing anywhere
          wrote it — all five events in production sit at the default, FALSE.
          The guest site reads `guest OR live_media_public`, so a visitor with no
          invitation never saw the broadcast or the live photo wall on ANY event.
          That visitor is the relative overseas who opened the link someone
          forwarded — the person a wedding livestream is for. */}
      <div className="space-y-4 sn-tile p-5 sm:p-6">
        <div className="space-y-2">
          <p className="sn-eye flex items-center gap-2">
            <Radio aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Watching from far away
          </p>
          <h2 className="font-serif text-2xl italic tracking-tight">
            Who can watch on the day
          </h2>
          <p className="max-w-prose text-sm text-ink/70">
            Your invited guests can always watch your livestream and see the photo
            wall. This decides whether someone <em>without</em> an invitation can
            too &mdash; a relative abroad who was sent your link, or a friend
            watching from home. Turn it on when you&rsquo;re ready to go live, and
            off again afterwards.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              liveMediaOpen ? 'bg-success-50 text-success-800' : 'bg-ink/5 text-ink/60'
            }`}
          >
            {liveMediaOpen
              ? 'Open — anyone with your link can watch'
              : 'Closed — only your invited guests can watch'}
          </span>
          <form action={setLiveMediaAudience}>
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="open" value={liveMediaOpen ? '0' : '1'} />
            <SubmitButton className="button-primary" pendingLabel="Saving…">
              {liveMediaOpen ? 'Close it to guests only' : 'Let anyone with the link watch'}
            </SubmitButton>
          </form>
        </div>

        <p className="text-xs text-ink/50">
          This only affects the livestream and the live photo wall. It doesn&rsquo;t
          change who can open your page, and it never shares anything before the
          day itself.
        </p>
      </div>

      {/* Stories showcase consent — RA 10173 opt-in / one-click opt-out (0046) */}
      <div className="space-y-4 sn-tile p-5 sm:p-6">
        <div className="space-y-2">
          <p className="sn-eye flex items-center gap-2">
            <Heart aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Stories
          </p>
          <h2 className="font-serif text-2xl italic tracking-tight">
            Feature your {eventNoun(event.event_type)} on Setnayan
          </h2>
          <p className="max-w-prose text-sm text-ink/70">
            With your okay, Setnayan can feature your {eventNoun(event.event_type)} on our public{' '}
            <Link href="/realstories" className="text-terracotta hover:underline">
              Stories
            </Link>{' '}
            page — your story, your photos, and the team behind your day — starting
            30&nbsp;days after your {eventNoun(event.event_type)}. It&rsquo;s completely optional, and you can
            turn it off anytime.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              showcaseOptedIn
                ? 'bg-success-50 text-success-800'
                : 'bg-ink/5 text-ink/60'
            }`}
          >
            {showcaseOptedIn
              ? 'On — eligible to be featured'
              : `Off — your ${eventNoun(event.event_type)} stays private`}
          </span>
          <form action={setShowcaseConsent}>
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="opt_in" value={showcaseOptedIn ? '0' : '1'} />
            <SubmitButton className="button-primary" pendingLabel="Saving…">
              {showcaseOptedIn ? 'Turn off featuring' : `Feature our ${eventNoun(event.event_type)}`}
            </SubmitButton>
          </form>
        </div>

        <p className="text-xs text-ink/50">
          Your {eventNoun(event.event_type)} only ever appears after the day itself (a 30-day grace
          window), and only while this is turned on. Details follow Setnayan&rsquo;s
          privacy rules (RA&nbsp;10173).
        </p>
      </div>
    </section>
  );
}

/**
 * Single radio card — visually selected when value === currentValue. Hidden
 * native radio for keyboard / a11y; the label is the click target.
 */
function VisibilityCard({
  value,
  currentValue,
  icon,
  title,
  blurb,
}: {
  value: EventVisibility;
  currentValue: EventVisibility;
  icon: React.ReactNode;
  title: string;
  blurb: string;
}) {
  const selected = value === currentValue;
  return (
    <label
      className={`group sn-row flex cursor-pointer items-start gap-4 p-5 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-terracotta ${
        selected
          ? 'border-terracotta bg-white/80 ring-2 ring-terracotta ring-offset-2 ring-offset-cream'
          : 'hover:border-terracotta/40 hover:bg-white/60'
      }`}
    >
      <input
        type="radio"
        name="visibility"
        value={value}
        defaultChecked={selected}
        className="sr-only"
      />
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 space-y-1.5">
        <span className="flex items-center gap-2">
          <span className="text-base font-semibold text-ink">{title}</span>
          {selected ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-terracotta-700">
              <Check aria-hidden className="h-3 w-3" strokeWidth={2} />
              Current
            </span>
          ) : null}
        </span>
        <span className="block text-sm text-ink/70">{blurb}</span>
      </span>
    </label>
  );
}
