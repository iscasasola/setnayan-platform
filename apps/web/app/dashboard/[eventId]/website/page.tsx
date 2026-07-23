import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowUpRight,
  BookHeart,
  CalendarClock,
  CheckCircle2,
  Globe,
  Lock,
  Newspaper,
  Pencil,
  Sparkles,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { buildEventLandingUrl } from '@/lib/qr';
import { resolveEventOwnerSlug } from '@/lib/public-event-url';
import { eventOwnsSku } from '@/lib/entitlements';
import { logQueryError } from '@/lib/supabase/error-detect';
import { RevealList } from '@/app/_components/reveal-list';
import { eventNoun, eventNounCap } from '@/lib/event-noun';
import { guestColumnsActive } from '@/lib/guest-columns-gate';

export const metadata = { title: 'Event website' };

/**
 * /dashboard/[eventId]/website — the wedding-website HUB.
 *
 * WHY a real page (not the old redirect-to-editor): this surface now lives
 * INSIDE the dashboard layout (EventLayout) so it inherits the shared chrome —
 * top bar + the global mobile BottomNav. The full-screen "edit on the page"
 * studio still lives at the top-level /site-editor/[eventId] route (it has to,
 * to escape EventLayout's chrome — see that route's docstring); the hub is the
 * calm landing that introduces the couple's public site and hands them off to
 * the editor with a single primary action.
 *
 * DATA: reuses the exact minimal fetch shape from the editor's page
 * (/site-editor/[eventId]/page.tsx) — couple-membership gate + the same
 * events select (display_name + slug) + the same buildEventLandingUrl helper —
 * so the hub and the editor agree on names / slug / public URL. No new data
 * access is invented; the hub only reads the basics it shows.
 *
 * AUTH: this route is a child of EventLayout, which already runs the
 * couple/moderator membership gate. We re-run the couple-membership check here
 * too (cheap, RLS-scoped) so a direct hit can't render the hub for a
 * non-couple — mirroring the editor page's own replicated guard.
 */
export default async function WebsiteHubPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath(`/dashboard/${eventId}/website`));

  const supabase = await createClient();

  // Membership gate + event basics fire concurrently (same shape as the
  // editor page). The couple-membership check is applied after the batch
  // resolves; RLS already scopes every row to the caller.
  const [membershipRes, eventRes] = await Promise.all([
    supabase
      .from('event_members')
      .select('member_type')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('events')
      .select('event_id, display_name, slug, event_type, love_story')
      .eq('event_id', eventId)
      .maybeSingle(),
  ]);

  const { data: membership, error: membershipError } = membershipRes;
  if (membershipError) {
    logQueryError(
      'WebsiteHubPage (event_members)',
      membershipError,
      { event_id: eventId, user_id: user.id },
      'graceful_degrade',
    );
  }
  if (!membership || membership.member_type !== 'couple') {
    notFound();
  }

  const event = eventRes.data;
  if (!event) notFound();

  // Has the couple told any of their story yet? Drives the our-story QuickLink's
  // nudge blurb (onboarding's "Add it later" → this doorway is the later).
  const loveStoryBlob =
    event.love_story && typeof event.love_story === 'object'
      ? (event.love_story as Record<string, unknown>)
      : {};
  const hasLoveStory = Object.values(loveStoryBlob).some(
    (v) =>
      (typeof v === 'string' && v.trim() !== '') ||
      (Array.isArray(v) && v.length > 0) ||
      (v !== null &&
        typeof v === 'object' &&
        !Array.isArray(v) &&
        Object.values(v).some((a) => typeof a === 'string' && a.trim() !== '')),
  );

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';

  // Canonical URL form — nested /u/ under the cutover flag, bare root otherwise
  // (resolve self-noops OFF; no query pre-cutover).
  const ownerSlug = await resolveEventOwnerSlug(createAdminClient(), eventId);
  const publicLandingUrl = event.slug
    ? buildEventLandingUrl({ appUrl, slug: event.slug, ownerSlug })
    : null;
  const slugDisplay = publicLandingUrl
    ? publicLandingUrl.replace(/^https?:\/\//, '')
    : null;

  // Custom Subdomain (EVENT_SUBDOMAIN ₱999/yr) — when owned, the couple's site is
  // ALSO reachable at {slug}.setnayan.com (routed by the paid-gated subdomain
  // middleware). Shown as a secondary vanity address under the canonical link.
  const ownsSubdomain = event.slug
    ? await eventOwnsSku(supabase, eventId, 'EVENT_SUBDOMAIN')
    : false;
  const subdomainHost = ownsSubdomain && event.slug ? `${event.slug}.setnayan.com` : null;

  return (
    <section className="space-y-8">
      {/* Header strip — eyebrow + title + lede */}
      <header className="sn-reveal space-y-2">
        <p className="sn-eye flex items-center gap-2">
          <Globe aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Your {eventNoun(event.event_type)} website
        </p>
        <h1 className="sn-h1">
          {event.display_name || `Your ${eventNounCap(event.event_type)} page`}
        </h1>
        <p className="max-w-prose text-base text-ink/70">
          One page for everything your guests need — your story, the details, and
          their RSVP. Open the editor to style it, then share your link.
        </p>
      </header>

      {/* Hero — public site identity + the primary "Launch editor" action */}
      <div className="overflow-hidden sn-tile">
        <div className="space-y-5">
          <div className="space-y-1.5">
            {publicLandingUrl ? (
              <>
                <p className="flex items-center gap-1.5 text-sm text-success-700">
                  <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  Live — this link is yours.
                </p>
                <a
                  href={publicLandingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex max-w-full items-center gap-1.5 font-mono text-sm text-ink/70 transition-colors hover:text-terracotta"
                >
                  <span className="truncate">{slugDisplay}</span>
                  <ArrowUpRight
                    aria-hidden
                    className="h-4 w-4 shrink-0 opacity-60 transition-opacity group-hover:opacity-100"
                    strokeWidth={1.75}
                  />
                </a>
                {subdomainHost ? (
                  <p className="flex items-center gap-1.5 pt-1 text-sm text-ink/70">
                    <Globe aria-hidden className="h-3.5 w-3.5 shrink-0 text-terracotta" strokeWidth={1.75} />
                    <span>
                      Your custom subdomain:{' '}
                      <a
                        href={`https://${subdomainHost}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-terracotta hover:underline"
                      >
                        {subdomainHost}
                      </a>
                    </span>
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-ink/70">
                Pick your {eventNoun(event.event_type)} URL in the editor — it&rsquo;s how guests find
                your page and what your QR points to.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href={`/site-editor/${eventId}`}
              className="inline-flex h-11 min-h-[44pt] items-center justify-center gap-2 rounded-md bg-mulberry px-5 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mulberry"
            >
              <Sparkles aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Launch editor
            </Link>
            {publicLandingUrl ? (
              <a
                href={publicLandingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 min-h-[44pt] items-center justify-center gap-2 rounded-md border border-ink/20 bg-cream px-4 text-sm font-medium text-ink transition-colors hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <Globe aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                View live page
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {/* Quick links — light hand-offs to the surfaces that pair with the page */}
      <RevealList as="div" className="grid gap-4 sm:grid-cols-2">
        {event.event_type === 'wedding' ? (
          <QuickLink
            data-reveal-item
            href={`/dashboard/${eventId}/website/our-story`}
            icon={<BookHeart aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />}
            title="Our story"
            blurb={
              hasLoveStory
                ? 'How you met, the spark, the yes — and your timeline of moments.'
                : 'You said “add it later” at onboarding — this is later. Tell your story.'
            }
          />
        ) : null}
        <QuickLink
          data-reveal-item
          href={`/dashboard/${eventId}/invitation`}
          icon={<Pencil aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />}
          title="Invitation & URL"
          blurb={`Your monogram, how your names appear, and your public ${eventNoun(event.event_type)} URL.`}
        />
        <QuickLink
          data-reveal-item
          href={`/dashboard/${eventId}/website/privacy`}
          icon={<Lock aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />}
          title="Who can view"
          blurb="Choose who reaches your page — anyone with the link, or only your guests."
        />
        <QuickLink
          data-reveal-item
          href={`/dashboard/${eventId}/website/editorial`}
          icon={<Newspaper aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />}
          title="Editorial"
          blurb="Your front-page story after the day — words, photos, hero, and which features show."
        />
        {/* Guest Columns review queue doorway (BUILD ① · wayfinding rule: a
            page ships with its doorway). Gated with the whole feature (env
            flag AND the guest_columns DPO control — no dead door). */}
        {(await guestColumnsActive()) ? (
          <QuickLink
            data-reveal-item
            href={`/dashboard/${eventId}/studio/guest-columns`}
            icon={<Newspaper aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />}
            title="Guest columns"
            blurb="Short columns your guests wrote for your paper — approve or return each one."
          />
        ) : null}
      </RevealList>

      {/* Your page through time — the 4-path lifecycle. One page, but it shows
          guests the phase that fits the date. These previews force a phase so
          the couple can see each one any time (host-only preview). */}
      {publicLandingUrl ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="sn-eye flex items-center gap-2">
              <CalendarClock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Your page through time
            </p>
            <p className="max-w-prose text-sm text-ink/70">
              Your page has four parts — guests always see the one that fits the
              date. Edit each part on its own, or preview how it looks.
            </p>
          </div>
          <RevealList as="div" className="grid gap-3 sm:grid-cols-2">
            <PhasePart
              data-reveal-item
              editHref={`/dashboard/${eventId}/studio/save-the-date`}
              previewHref={`${publicLandingUrl}?phase=save_the_date`}
              title="Save the Date"
              blurb="Far out — the announcement. Countdown + add-to-calendar."
            />
            <PhasePart
              data-reveal-item
              editHref={`/site-editor/${eventId}/rsvp`}
              previewHref={`${publicLandingUrl}?phase=rsvp`}
              title="RSVP"
              blurb="The run-up — your invitation and the RSVP form."
            />
            <PhasePart
              data-reveal-item
              editHref={`/site-editor/${eventId}/event`}
              previewHref={`${publicLandingUrl}?phase=event`}
              title="Event"
              blurb={`The ${eventNoun(event.event_type)} day — the live, day-of page.`}
            />
            <PhasePart
              data-reveal-item
              editHref={`/site-editor/${eventId}/editorial`}
              previewHref={`${publicLandingUrl}?phase=editorial`}
              title="Editorial"
              blurb="After — the recap, gallery, and thank-you."
            />
          </RevealList>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Quick-link card — a light hand-off into a paired surface. Same border / hover
 * treatment as the privacy editor's VisibilityCard, sized for a 2-up grid.
 */
function QuickLink({
  href,
  icon,
  title,
  blurb,
  'data-reveal-item': dataRevealItem,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  blurb: string;
  'data-reveal-item'?: boolean;
}) {
  return (
    <Link
      data-reveal-item={dataRevealItem ? '' : undefined}
      href={href}
      className="group sn-row flex items-start gap-4 p-5 transition-colors hover:border-terracotta/40 hover:bg-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex items-center gap-1.5 text-base font-semibold text-ink">
          {title}
          <ArrowUpRight
            aria-hidden
            className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-60"
            strokeWidth={1.75}
          />
        </span>
        <span className="block text-sm text-ink/70">{blurb}</span>
      </span>
    </Link>
  );
}

/**
 * Phase part card — one of the four website parts (Save the Date · RSVP · Event
 * · Editorial). The primary action opens that part's OWN editor (Save the Date →
 * its builder; the other three → the full-screen site editor jumped to that
 * phase — the same destinations as the Studio cards). The secondary "Preview"
 * opens the public page with a host-gated `?phase=` override (the page checks the
 * viewer's own session, so it's safe to render).
 */
function PhasePart({
  editHref,
  previewHref,
  title,
  blurb,
  'data-reveal-item': dataRevealItem,
}: {
  editHref: string;
  previewHref: string;
  title: string;
  blurb: string;
  'data-reveal-item'?: boolean;
}) {
  return (
    <div
      data-reveal-item={dataRevealItem ? '' : undefined}
      className="flex flex-col sn-row p-4 transition-colors hover:border-terracotta/40"
    >
      <span className="min-w-0 flex-1 space-y-1">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-xs text-ink/65">{blurb}</span>
      </span>
      <div className="mt-3 flex items-center gap-2">
        <Link
          href={editHref}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-mulberry px-3 text-xs font-semibold text-cream transition-colors hover:bg-mulberry-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mulberry"
        >
          <Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> Edit
        </Link>
        <a
          href={previewHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-ink/20 px-3 text-xs font-medium text-ink/75 transition-colors hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <ArrowUpRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> Preview
        </a>
      </div>
    </div>
  );
}
