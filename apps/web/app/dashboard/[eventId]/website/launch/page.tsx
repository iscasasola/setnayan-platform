import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Rocket,
  Globe,
  Eye,
  Compass,
  LayoutGrid,
  Image as ImageIcon,
  MapPin,
  Palette,
  Radio,
  Film,
  Clapperboard,
  Music,
  PenLine,
  Paintbrush,
  CircleDot,
  Lock,
  ArrowUpRight,
  ExternalLink,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { resolveProfile, surfaceEnabled } from '@/lib/event-type-profile';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { LaunchStdButton } from '../../studio/save-the-date/_components/launch-std-button';
import { WebsiteLaunchPreview } from './_components/website-launch-preview';

export const metadata = { title: 'Launch — your website' };

/**
 * /dashboard/[eventId]/website/launch — the couple's LAUNCH surface, now
 * SETTINGS-FIRST (owner 2026-07-24: "when we open Launch, instead of the
 * website, we start by the settings — as free, and the settings when Website
 * Pro is unlocked"). Design: Design_Launch_Settings_2026-07-24/.
 *
 * Structure (spec §2): a go-live hero plaque, then a FREE band of always-
 * included settings, then the WEBSITE PRO band — the owner-locked seven, shown
 * LOCKED with one umbrella unlock CTA until `COUPLE_WEBSITE_PRO` is owned, and
 * UNLOCKED (deep-links live) once it is. The guest website itself is untouched;
 * only what the "Launch" nav item opens changes (customer-nav-config.ts now
 * points here always). The live site stays one click away ("View my site").
 *
 * PR-A of the 3-PR plan: this page + the nav re-point. It does NOT gate the
 * underlying editors yet (PR-B) and the two color settings are placeholders
 * until PR-C — so a locked couple simply gets no deep-link from here.
 */

type SettingCard = {
  key: string;
  name: string;
  blurb: string;
  href: string;
  Icon: LucideIcon;
  status?: string;
};

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
      'event_id, display_name, slug, event_type, landing_page_visibility, std_launched_at, scheduled_launch_at, website_open_browse',
    )
    .eq('event_id', eventId)
    .maybeSingle();

  if (!event) redirect(`/dashboard/${eventId}`);

  // Event-type gate — the public website (and therefore "launch") only exists
  // for event types whose profile enables the 'website' surface.
  const profile = await resolveProfile((event.event_type as string | null) ?? 'wedding');
  if (!surfaceEnabled(profile, 'website')) redirect(`/dashboard/${eventId}`);

  // Couple gate — only a couple member manages launch (the launch actions are
  // requireCouple). Non-couples (incl. moderators) bounce to the event home.
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();
  if (!membership) redirect(`/dashboard/${eventId}`);

  const ownsPro = await eventCoupleWebsiteProActive(supabase, eventId);

  const base = `/dashboard/${eventId}`;
  const slug = (event.slug as string | null) ?? null;
  const visibility = (event.landing_page_visibility ?? 'private') as
    | 'public'
    | 'unlisted'
    | 'private';
  const stdLaunched = Boolean(event.std_launched_at) || visibility === 'public';
  const scheduledAt =
    typeof event.scheduled_launch_at === 'string' ? event.scheduled_launch_at : null;
  const openBrowseOn = event.website_open_browse === true;
  const publicLandingUrl = slug ? `/${slug}` : null;

  const statusLabel = stdLaunched ? 'Live' : scheduledAt ? 'Scheduled' : 'Not live yet';
  const visibilityLabel =
    visibility === 'public'
      ? 'Public'
      : visibility === 'unlisted'
        ? 'Unlisted'
        : 'Private — only you can see it';

  // FREE band — the always-included settings. Each deep-links to the EXISTING
  // editor (no new editors here). "Open browsing" + "Sections" both land on the
  // section manager; URL / theme / map live in the website editor.
  const freeCards: SettingCard[] = [
    {
      key: 'url',
      name: 'Wedding URL',
      blurb: 'Your one link, on every QR and invite.',
      href: `/site-editor/${eventId}`,
      Icon: Globe,
      status: slug ?? 'Not set',
    },
    {
      key: 'visibility',
      name: 'Who can view',
      blurb: 'Public, unlisted, or private while you build.',
      href: `${base}/website/privacy`,
      Icon: Eye,
      status: visibility === 'private' ? 'Private' : visibilityLabel,
    },
    {
      key: 'open-browse',
      name: 'Open browsing',
      blurb: 'Let guests browse every page from day one — the five-tab site.',
      href: `${base}/website/widgets`,
      Icon: Compass,
      status: openBrowseOn ? 'On' : 'Off',
    },
    {
      key: 'sections',
      name: 'Sections',
      blurb: 'Show, hide, and order what appears — Auto fills from your planning.',
      href: `${base}/website/widgets`,
      Icon: LayoutGrid,
    },
    {
      key: 'hero',
      name: 'Hero photo',
      blurb: 'The photo at the top of your page.',
      href: `${base}/website/hero-photo`,
      Icon: ImageIcon,
    },
    {
      key: 'map',
      name: 'Map link',
      blurb: 'Waze / Google Maps door-to-door directions.',
      href: `/site-editor/${eventId}`,
      Icon: MapPin,
    },
    {
      key: 'theme',
      name: 'Theme',
      blurb: 'The look of your RSVP, wedding-day, and After pages.',
      href: `/site-editor/${eventId}`,
      Icon: Palette,
    },
    {
      key: 'live-media',
      name: 'Live media for visitors',
      blurb: 'Let people without an invite watch the livestream & photo wall.',
      href: `${base}/website/privacy`,
      Icon: Radio,
    },
  ];

  // WEBSITE PRO band — the owner-locked seven (2026-07-24). Deep-links only in
  // the UNLOCKED state; locked shows "Part of Website Pro" + the umbrella CTA.
  const proCards: SettingCard[] = [
    {
      key: 'reveal',
      name: 'Cinematic Reveal',
      blurb: 'The veil, the doors — a film-grade opening for your Save-the-Date.',
      href: `${base}/studio/save-the-date`,
      Icon: Film,
    },
    {
      key: 'std-video',
      name: 'Save-the-Date video',
      blurb: 'Your own video inside the announcement film.',
      href: `${base}/studio/save-the-date`,
      Icon: Clapperboard,
    },
    {
      key: 'gallery',
      name: 'Photo gallery',
      blurb: 'Your engagement and prenup shots, on the site.',
      href: `${base}/website/our-photos`,
      Icon: ImageIcon,
    },
    {
      key: 'music',
      name: 'Background music',
      blurb: 'A song that plays softly as guests browse.',
      href: `${base}/website/site-chrome`,
      Icon: Music,
    },
    {
      key: 'editorial',
      name: 'Editorial editing',
      blurb: 'Write and arrange your After-the-wedding story pages.',
      href: `${base}/website/editorial`,
      Icon: PenLine,
    },
    {
      key: 'bg-color',
      name: 'Background color',
      blurb: 'Tint the whole site to your motif.',
      href: `/site-editor/${eventId}`,
      Icon: Paintbrush,
    },
    {
      key: 'button-color',
      name: 'Button color',
      blurb: 'Match every button to your palette.',
      href: `/site-editor/${eventId}`,
      Icon: CircleDot,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      {/* Header */}
      <header className="space-y-1">
        <p className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          <Rocket aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Go live
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Your website, ready when you are.
        </h1>
        <p className="max-w-prose text-sm text-ink/60">
          Everything about your site lives here — what it says, who sees it, and the moment it
          goes live. Your guests only ever see one link.
        </p>
      </header>

      {/* Go-live hero plaque */}
      <section className="mt-6 rounded-2xl bg-ink p-5 text-cream shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-cream/50">
              Status
            </p>
            <p className="mt-1 text-xl font-semibold">{statusLabel}</p>
            <p className="mt-0.5 font-mono text-xs text-cream/60">
              {slug ? `setnayan.com/${slug}` : 'Set your URL to get your link'}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-cream/10 px-3 py-1.5 text-xs font-medium text-cream/80">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                stdLaunched ? 'bg-success-400' : 'bg-amber-300'
              }`}
            />
            {visibilityLabel}
          </span>
        </div>
        {publicLandingUrl ? (
          <Link
            href={publicLandingUrl}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-cream/25 px-4 py-2 text-sm font-medium text-cream/90 transition-colors hover:bg-cream/10"
          >
            View my site
            <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
        ) : null}
        {/* Go-live + schedule control — single-sourced from the STD studio so
            the scheduled_launch_at semantics never fork. */}
        <div className="mt-4">
          <LaunchStdButton
            eventId={eventId}
            slug={slug}
            initialLaunched={stdLaunched}
            initialScheduledAt={scheduledAt}
          />
        </div>
      </section>

      {/* FREE band */}
      <section className="mt-9">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
              Included with every event
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">
              Set up your site
            </h2>
            <p className="text-sm text-ink/60">
              The whole four-page site — Save-the-Date, Invitation &amp; RSVP, Wedding day, and the
              After — is free.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-success-100 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-wide text-success-800">
            Free
          </span>
        </header>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {freeCards.map((c) => (
            <SettingCardTile key={c.key} card={c} locked={false} />
          ))}
        </div>
      </section>

      {/* WEBSITE PRO band */}
      <section className="mt-9 rounded-3xl border border-amber-300/50 bg-amber-50/40 p-5 sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-800">
              Website Pro
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">
              The cinematic layer
            </h2>
            <p className="text-sm text-ink/60">
              Seven signature upgrades, one unlock. Yours for this event, forever.
            </p>
          </div>
          {ownsPro ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-wide text-amber-800">
              ✓ Unlocked
            </span>
          ) : (
            <span className="rounded-full bg-amber-800 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-wide text-amber-50">
              ₱3,500 · one-time
            </span>
          )}
        </header>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {proCards.map((c) => (
            <SettingCardTile key={c.key} card={c} locked={!ownsPro} />
          ))}
        </div>

        {!ownsPro ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-ink p-4 text-cream sm:p-5">
            <p className="max-w-prose text-sm text-cream/80">
              <span className="font-semibold text-cream">Unlock all seven with Website Pro.</span>{' '}
              One payment for this event — plus the “Powered by Setnayan” mark comes off your page.
            </p>
            <Link
              href={`${base}/studio/website-pro`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-400 px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-amber-300"
            >
              Unlock Website Pro · ₱3,500
            </Link>
          </div>
        ) : null}

        <p className="mt-3 flex items-start gap-2 text-xs text-ink/55">
          <span aria-hidden className="text-amber-700">
            ✦
          </span>
          Website Pro also removes the “Powered by Setnayan” footer from your live site.
        </p>
      </section>

      {/* Preview each page — kept reachable (the old launch page's 4-phase
          preview), below the settings. */}
      {publicLandingUrl ? (
        <section className="mt-9">
          <header className="space-y-1">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
              Preview
            </p>
            <h2 className="text-lg font-semibold tracking-tight sm:text-xl">See each page</h2>
            <p className="text-sm text-ink/60">
              Your site changes with the day. Preview each part before it goes live.
            </p>
          </header>
          <div className="mt-4">
            <WebsiteLaunchPreview eventId={eventId} publicLandingUrl={publicLandingUrl} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** One settings tile. `locked` hides the deep-link + status and shows the
 *  "Part of Website Pro" lock line instead (Pro band, no entitlement). */
function SettingCardTile({ card, locked }: { card: SettingCard; locked: boolean }) {
  const Icon = card.Icon;
  const body = (
    <>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
          <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        </span>
        {card.name}
      </h3>
      <p className="text-xs text-ink/55">{card.blurb}</p>
      {locked ? (
        <p className="mt-auto flex items-center gap-1.5 text-xs font-medium text-ink/40">
          <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Part of Website Pro
        </p>
      ) : (
        <div className="mt-auto flex items-center justify-between">
          {card.status ? (
            <span
              className={`rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium ${
                card.status === 'Not set' || card.status === 'Off'
                  ? 'bg-ink/5 text-ink/60'
                  : 'bg-success-100 text-success-800'
              }`}
            >
              {card.status}
            </span>
          ) : (
            <span />
          )}
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-terracotta">
            Manage
            <ExternalLink aria-hidden className="h-3 w-3" strokeWidth={2} />
          </span>
        </div>
      )}
    </>
  );

  const className =
    'flex min-h-[118px] flex-col gap-2 rounded-2xl border border-ink/10 bg-white p-4 transition-colors';

  if (locked) {
    return <div className={className}>{body}</div>;
  }
  return (
    <Link href={card.href} className={`${className} hover:border-ink/25`}>
      {body}
    </Link>
  );
}
