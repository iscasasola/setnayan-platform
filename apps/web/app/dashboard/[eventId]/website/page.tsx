import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  Camera,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Globe,
  ImagePlus,
  Lock,
  Pencil,
  QrCode,
  Shirt,
  Users,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { computeGuestStats, fetchGuestsByEvent } from '@/lib/guests';
import {
  buildEventLandingUrl,
  renderEventLandingQrSvg,
} from '@/lib/qr';
import { resolveMonogram } from '@/lib/monogram';
import { CopyButton } from './_components/copy-button';
import { SlugField } from '../invitation/_components/slug-field';
import { ProUpgradePanel } from './_components/pro-upgrade-panel';
import { updateEventSlugFromWebsite } from './actions';

export const metadata = { title: 'Wedding website' };

/** Banner copy for ?slug_error=... + ?slug_saved=1. Polite brand voice
 *  per [[feedback_setnayan_no_dev_text_post_launch]] — no engineering
 *  jargon, no all-caps urgency, no parens with codes. */
const SLUG_ERROR_COPY: Record<string, string> = {
  missing: 'Pick a slug first — your wedding URL needs one.',
  invalid_format: 'Slugs are 3–32 characters of lowercase letters, numbers, and hyphens.',
  invalid_chars: 'Only lowercase letters, numbers, and hyphens are allowed.',
  reserved: 'That slug is reserved by Setnayan. Try something a touch more unique to you.',
  taken: 'That slug is already in use — try another.',
};

/**
 * /dashboard/[eventId]/website — new V1 hub surface (CLAUDE.md 2026-05-22).
 *
 * Owner directive: new Website tab in the 4-tab bottom nav. Hub-links the
 * public landing page surfaces in one polite editorial frame:
 *   • Public URL card (one-tap copy + open-in-new-tab + iframe preview)
 *   • Quick actions (edit hero · download QR · manage RSVPs · day-of preview)
 *   • RSVP stats strip
 *
 * The underlying surfaces (invitation editor, public landing at /[slug], the
 * day-of guest portal, the RSVP-filtered guest list) already exist — this
 * page is the host's one-stop dashboard for them.
 *
 * Per 0002 unified QR lifecycle lock (CLAUDE.md 2026-05-22), the public URL
 * is canonical from event creation onward — guests, anonymous browsers,
 * vendors at the venue, and search engines all land at the same URL.
 */
export default async function WebsiteHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ slug_saved?: string; slug_error?: string }>;
}) {
  const { eventId } = await params;
  const { slug_saved: slugSaved, slug_error: slugError } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select(
      'event_id, display_name, event_date, slug, monogram_text, monogram_color',
    )
    .eq('event_id', eventId)
    .maybeSingle();

  if (!event) redirect(`/dashboard/${eventId}`);

  // Bind eventId so <SlugField> stays a generic component that only
  // takes saveAction(formData). Mirrors invitation/page.tsx:92.
  const slugAction = updateEventSlugFromWebsite.bind(null, eventId);

  // Owned-state for the two paid widget upgrades (CLAUDE.md 2026-05-22
  // Pro panel). Same query shape as page.tsx:487 — exclude cancelled /
  // refunded / lapsed so a still-in-reconciliation order locks the CTA
  // to its post-purchase "Active" state and prevents double-buying.
  // Graceful-degrade if the orders table is missing (42P01) — pre-bootstrap
  // databases shouldn't crash the Website tab; surface Upgrade CTAs as
  // the safe default per the PR #380 / #390 hotfix pattern.
  let ownedOrders: { service_key: string | null; status: string }[] = [];
  const { data: ordersData, error: ordersError } = await supabase
    .from('orders')
    .select('service_key, status')
    .eq('event_id', eventId)
    .in('service_key', ['monogram_hero_upgrade', 'pro_widget_schedule'])
    .not('status', 'in', '("cancelled","refunded","lapsed")');
  if (ordersError && ordersError.code !== '42P01' && ordersError.code !== '42703') {
    // Real error — bubble it so the host sees a 500 not silent missing CTAs.
    throw new Error(`Failed to load Pro upgrade order state: ${ordersError.message}`);
  }
  ownedOrders = (ordersData ?? []) as typeof ownedOrders;

  const guests = await fetchGuestsByEvent(supabase, eventId);
  const stats = computeGuestStats(guests);

  const monogram = resolveMonogram(event);
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';

  const publicLandingUrl = event.slug
    ? buildEventLandingUrl({ appUrl, slug: event.slug })
    : null;

  // Master event QR (no token suffix) — encodes setnayan.com/{slug}. Same QR
  // that drives host-shared social posts + vendor scan-at-venue Tier 1/Tier 2.
  const masterQrSvg = event.slug
    ? await renderEventLandingQrSvg({
        appUrl,
        slug: event.slug,
        monogram,
      })
    : null;

  // Friendly slug display (drop protocol for the headline; keep the full URL
  // for the copy + open-in-new-tab buttons).
  const slugDisplay = publicLandingUrl
    ? publicLandingUrl.replace(/^https?:\/\//, '')
    : null;

  const slugErrorMessage =
    typeof slugError === 'string' && slugError in SLUG_ERROR_COPY
      ? SLUG_ERROR_COPY[slugError]
      : typeof slugError === 'string' && slugError.length > 0
        ? 'We could not save that slug. Try again, or contact support if this keeps happening.'
        : null;

  return (
    <section className="space-y-8">
      {/* Header strip */}
      <header className="space-y-2">
        <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          <Globe aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Wedding website
        </p>
        <h1 className="font-serif text-3xl italic tracking-tight sm:text-4xl">
          {event.display_name}
        </h1>
        {slugDisplay ? (
          <p className="break-all font-mono text-sm text-ink/60">{slugDisplay}</p>
        ) : (
          <p className="text-sm text-ink/60">
            Your wedding URL appears here once you pick a slug.
          </p>
        )}
      </header>

      {/* Slug save / error banner — surfaces above the public URL card so
          the host sees the result of the inline editor without scrolling
          the iframe out of view. Auto-clear is intentional NO-OP for V1:
          the banner stays until the host navigates or refreshes (the
          query param is the source of truth + the URL strip is cheap). */}
      {slugSaved === '1' ? (
        <div
          role="status"
          className="rounded-lg border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          Slug saved. Your new wedding URL is live everywhere — guests, QR scans,
          and social shares all point here now. The old URL still works for
          90 days so anyone using a saved link can find their way over.
        </div>
      ) : null}
      {slugErrorMessage ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm text-rose-900"
        >
          {slugErrorMessage}
        </div>
      ) : null}

      {/* Public URL card */}
      <section
        aria-labelledby="public-url-heading"
        className="rounded-xl border border-ink/10 bg-cream p-5 sm:p-6"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink/55">
                Your public URL
              </p>
              <h2
                id="public-url-heading"
                className="mt-1 text-xl font-semibold tracking-tight"
              >
                Share this with every guest
              </h2>
            </div>

            {publicLandingUrl ? (
              <>
                <div className="rounded-lg border border-ink/10 bg-white/60 px-4 py-3">
                  <p className="break-all font-mono text-base text-ink">
                    {publicLandingUrl}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <CopyButton
                    text={publicLandingUrl}
                    className="inline-flex h-11 min-h-[44pt] items-center justify-center gap-2 rounded-md bg-terracotta px-4 text-sm font-medium text-cream transition-colors hover:bg-terracotta-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
                  >
                    <Copy aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                    <span>Copy link</span>
                  </CopyButton>
                  <Link
                    href={publicLandingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 min-h-[44pt] items-center justify-center gap-2 rounded-md border border-ink/20 bg-cream px-4 text-sm font-medium text-ink transition-colors hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    <ExternalLink aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                    <span>Open in new tab</span>
                  </Link>
                </div>

                {/* Slug edit — collapsible <details> so the URL stays the
                    headline of the card and the editor is one tap away
                    without dominating the page. Mirrors the inline
                    affordance pattern already used by the chrome event-
                    switcher (lib pattern). The SlugField component is the
                    same one used by invitation/page.tsx — debounced
                    live-check + status pill + suggestions — bound here
                    to the Website-tab-specific server action. */}
                <details className="group rounded-lg border border-ink/10 bg-white/40 px-4 py-2 open:bg-white/70 open:pb-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-2 text-sm font-medium text-ink/75 hover:text-ink">
                    <span className="flex items-center gap-2">
                      <Pencil
                        aria-hidden
                        className="h-3.5 w-3.5 text-terracotta"
                        strokeWidth={1.75}
                      />
                      Change your slug
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink/45 group-open:hidden">
                      Edit
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink/45 hidden group-open:inline">
                      Close
                    </span>
                  </summary>
                  <div className="mt-3 space-y-2">
                    <SlugField
                      eventId={eventId}
                      initialSlug={event.slug ?? ''}
                      saveAction={slugAction}
                    />
                    <p className="text-xs text-ink/50">
                      The new URL goes live everywhere right away. Your old
                      URL keeps working for 90 days so anyone with the link
                      still lands here.
                    </p>
                  </div>
                </details>
              </>
            ) : (
              <div className="space-y-3 rounded-lg border border-amber-300/60 bg-amber-50 p-4">
                <p className="text-sm text-amber-900">
                  Pick a slug to publish your wedding URL. Guests will land here when they
                  scan their QR or tap their personal invitation link.
                </p>
                {/* Inline slug claim — host can pick a slug right from the
                    Website tab without bouncing through the invitation
                    editor. Reuses the same <SlugField> component + server
                    action as the change-slug flow above. */}
                <SlugField
                  eventId={eventId}
                  initialSlug=""
                  saveAction={slugAction}
                />
              </div>
            )}
          </div>

          {/* Master QR — same code used by social shares + vendor venue scan. */}
          {masterQrSvg ? (
            <div className="shrink-0 self-start">
              <div
                aria-label="Wedding website QR code with your monogram in the center"
                className="h-32 w-32 overflow-hidden rounded-lg border border-ink/10 bg-white p-2 sm:h-40 sm:w-40 [&_svg]:h-full [&_svg]:w-full"
                dangerouslySetInnerHTML={{ __html: masterQrSvg }}
              />
              <p className="mt-2 text-center text-[11px] uppercase tracking-[0.14em] text-ink/50">
                Public QR
              </p>
            </div>
          ) : null}
        </div>

        {/* Inline preview — lazy-loaded iframe of the public landing page. */}
        {publicLandingUrl ? (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink/55">
                Live preview
              </p>
              <Link
                href={publicLandingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-terracotta hover:text-terracotta-700"
              >
                Open full preview
                <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Link>
            </div>
            <div className="overflow-hidden rounded-lg border border-ink/10 bg-white shadow-sm">
              {/*
                Sandbox tokens — WHY this set, in this order:
                  • allow-scripts        — required so the public landing page
                    (a Next.js route with client-hydrated countdown · schedule
                    widget · guided-tour · nav-links · RSVP SubmitButton)
                    can actually render. Without it the iframe boots into
                    server-HTML and React never hydrates → blank white box.
                  • allow-same-origin    — required so the preview can read
                    its own cookies / Supabase auth / guest-session for the
                    accurate "this is what every guest sees" promise.
                  • allow-forms          — preserves the RSVP form inside
                    the preview (host can sanity-check the submit flow
                    without leaving the dashboard).
                  • allow-popups + allow-popups-to-escape-sandbox — keeps
                    any "Open map" / "Add to calendar" / external links in
                    the public landing page working from the preview.
                MDN caveat: `allow-scripts` + `allow-same-origin` together
                let same-origin iframe content remove its own sandbox. This
                is YOUR OWN public landing page on the same origin — we
                already trust it; the sandbox here is a defense-in-depth
                marker, not a security boundary against hostile content.
              */}
              <iframe
                src={publicLandingUrl}
                title="Public landing page preview"
                loading="lazy"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                className="block h-[400px] w-full bg-white sm:h-[480px]"
              />
            </div>
            <p className="mt-2 text-xs text-ink/50">
              This is what every guest sees when they scan their QR.
            </p>
          </div>
        ) : null}
      </section>

      {/* Quick actions grid */}
      <section aria-labelledby="quick-actions-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2
            id="quick-actions-heading"
            className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55"
          >
            Quick actions
          </h2>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <li>
            <Link
              href={`/dashboard/${eventId}/invitation`}
              className="group flex h-full min-h-[44pt] flex-col gap-2 rounded-xl border border-ink/10 bg-cream p-4 transition-colors hover:border-terracotta/40 hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              <Pencil
                aria-hidden
                className="h-5 w-5 text-terracotta"
                strokeWidth={1.75}
              />
              <p className="text-sm font-semibold text-ink">Edit hero</p>
              <p className="text-xs text-ink/55">
                Monogram, slug, and your invitation site branding.
              </p>
            </Link>
          </li>
          <li>
            {event.slug ? (
              <a
                href={`/api/website/qr/${event.slug}`}
                download={`${event.slug}-wedding-qr.png`}
                className="group flex h-full min-h-[44pt] flex-col gap-2 rounded-xl border border-ink/10 bg-cream p-4 transition-colors hover:border-terracotta/40 hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
              >
                <Download
                  aria-hidden
                  className="h-5 w-5 text-terracotta"
                  strokeWidth={1.75}
                />
                <p className="text-sm font-semibold text-ink">Download QR</p>
                <p className="text-xs text-ink/55">
                  PNG with your monogram — print, post, share.
                </p>
              </a>
            ) : (
              <div className="flex h-full min-h-[44pt] flex-col gap-2 rounded-xl border border-ink/10 bg-cream/60 p-4 opacity-60">
                <QrCode
                  aria-hidden
                  className="h-5 w-5 text-ink/40"
                  strokeWidth={1.75}
                />
                <p className="text-sm font-semibold text-ink/50">Download QR</p>
                <p className="text-xs text-ink/45">
                  Pick a slug first to unlock your wedding QR.
                </p>
              </div>
            )}
          </li>
          <li>
            <Link
              href={`/dashboard/${eventId}/guests?rsvp=pending`}
              className="group flex h-full min-h-[44pt] flex-col gap-2 rounded-xl border border-ink/10 bg-cream p-4 transition-colors hover:border-terracotta/40 hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              <Users
                aria-hidden
                className="h-5 w-5 text-terracotta"
                strokeWidth={1.75}
              />
              <p className="text-sm font-semibold text-ink">Manage RSVPs</p>
              <p className="text-xs text-ink/55">
                {stats.pending > 0
                  ? `${stats.pending} guest${stats.pending === 1 ? '' : 's'} still to hear from.`
                  : 'Your guest list, one RSVP at a time.'}
              </p>
            </Link>
          </li>
          <li>
            {publicLandingUrl ? (
              <Link
                href={`${publicLandingUrl}?preview=day_of`}
                target="_blank"
                rel="noreferrer"
                className="group flex h-full min-h-[44pt] flex-col gap-2 rounded-xl border border-ink/10 bg-cream p-4 transition-colors hover:border-terracotta/40 hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
              >
                <Eye
                  aria-hidden
                  className="h-5 w-5 text-terracotta"
                  strokeWidth={1.75}
                />
                <p className="text-sm font-semibold text-ink">Day-of preview</p>
                <p className="text-xs text-ink/55">
                  See what your guests see from T-1h to T+8h.
                </p>
              </Link>
            ) : (
              <div className="flex h-full min-h-[44pt] flex-col gap-2 rounded-xl border border-ink/10 bg-cream/60 p-4 opacity-60">
                <Eye aria-hidden className="h-5 w-5 text-ink/40" strokeWidth={1.75} />
                <p className="text-sm font-semibold text-ink/50">Day-of preview</p>
                <p className="text-xs text-ink/45">Pick a slug first.</p>
              </div>
            )}
          </li>
          {/* CLAUDE.md 2026-05-22 — four sibling landing-page editors merged
              cleanly: Hero Photo (this PR · direct ship) · Photo Moments
              (PR #383) · Privacy (PR #381) · Dress Code (PR #382). Each adds
              one tile to the Quick Actions grid in append-only fashion. */}
          {/* Hero Photo upload — direct ship 2026-05-22 (agents hit session
              limits before reaching this; built inline). Routes to
              /dashboard/[eventId]/website/hero-photo for the file uploader.
              Reads + writes events.landing_page_hero_image_url via
              migration 20260605020000. */}
          <li>
            <Link
              href={`/dashboard/${eventId}/website/hero-photo`}
              className="group flex h-full min-h-[44pt] flex-col gap-2 rounded-xl border border-ink/10 bg-cream p-4 transition-colors hover:border-terracotta/40 hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              <ImagePlus
                aria-hidden
                className="h-5 w-5 text-terracotta"
                strokeWidth={1.75}
              />
              <p className="text-sm font-semibold text-ink">Edit hero photo</p>
              <p className="text-xs text-ink/55">
                Upload the full-bleed banner for your public landing page.
              </p>
            </Link>
          </li>
          {/* Photo Moments editor — PR #383 landing-page-photo-moments. */}
          <li>
            <Link
              href={`/dashboard/${eventId}/website/photo-moments`}
              className="group flex h-full min-h-[44pt] flex-col gap-2 rounded-xl border border-ink/10 bg-cream p-4 transition-colors hover:border-terracotta/40 hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              <Camera
                aria-hidden
                className="h-5 w-5 text-terracotta"
                strokeWidth={1.75}
              />
              <p className="text-sm font-semibold text-ink">Edit photo moments</p>
              <p className="text-xs text-ink/55">
                Phone-down, cameras welcome, or reserved for your paparazzo.
              </p>
            </Link>
          </li>
          {/* Privacy tile — PR #381 landing-page-privacy-toggle. Routes to
              /dashboard/[eventId]/website/privacy for the Public / Unlisted
              / Private picker (V1 minimum-viable privacy lever for the
              Phase 4 RA 10173 work-stream in iteration 0046). */}
          <li>
            <Link
              href={`/dashboard/${eventId}/website/privacy`}
              className="group flex h-full min-h-[44pt] flex-col gap-2 rounded-xl border border-ink/10 bg-cream p-4 transition-colors hover:border-terracotta/40 hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              <Lock
                aria-hidden
                className="h-5 w-5 text-terracotta"
                strokeWidth={1.75}
              />
              <p className="text-sm font-semibold text-ink">Set who can view</p>
              <p className="text-xs text-ink/55">
                Public, unlisted, or private — change anytime.
              </p>
            </Link>
          </li>
          {/* Dress Code tile — PR #382 landing-page-dress-code. Host curates
              copy + palette + dos/donts; landing page renders from
              events.dress_code_config (migration 20260605030000). */}
          <li>
            <Link
              href={`/dashboard/${eventId}/website/dress-code`}
              className="group flex h-full min-h-[44pt] flex-col gap-2 rounded-xl border border-ink/10 bg-cream p-4 transition-colors hover:border-terracotta/40 hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              <Shirt
                aria-hidden
                className="h-5 w-5 text-terracotta"
                strokeWidth={1.75}
              />
              <p className="text-sm font-semibold text-ink">Edit dress code</p>
              <p className="text-xs text-ink/55">
                Headline, palette, and dos &amp; don&rsquo;ts for your guests.
              </p>
            </Link>
          </li>
        </ul>
      </section>

      {/* Free vs Pro panel — surfaces the two existing V1 paid widget
          upgrades from iteration 0004 (Monogram Hero ₱1,999 + Live
          Schedule ₱999). Owner directive CLAUDE.md 2026-05-22: the
          wedding website has a Free tier and a Pro tier; surface the
          existing SKUs, do not invent a new bundled SKU. Active-state
          comes from ownedOrders fetched above. */}
      <ProUpgradePanel eventId={eventId} ownedOrders={ownedOrders} />

      {/* RSVP stats strip */}
      <section aria-labelledby="rsvp-stats-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2
            id="rsvp-stats-heading"
            className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55"
          >
            RSVP at a glance
          </h2>
          <Link
            href={`/dashboard/${eventId}/guests`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-terracotta hover:text-terracotta-700"
          >
            View all
            <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          </Link>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <RsvpStat label="Attending" value={stats.attending} accent="emerald" />
          <RsvpStat label="Pending" value={stats.pending} accent="amber" />
          <RsvpStat label="Declined" value={stats.declined} accent="rose" />
          <RsvpStat label="Total invited" value={stats.total} accent="ink" />
        </dl>
      </section>

      {/* Footer note */}
      <footer className="rounded-xl border border-ink/10 bg-cream/60 p-5 text-sm text-ink/65">
        Your wedding URL is live from the moment your event is created. Guests can scan the
        QR or open the link anytime — it stays the same throughout your engagement, on the
        day itself, and as your wedding becomes a keepsake page after.
      </footer>
    </section>
  );
}

/**
 * Single RSVP stat card. Accent picks one of four polite-brand-voice colors.
 */
function RsvpStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: 'emerald' | 'amber' | 'rose' | 'ink';
}) {
  const accentClasses: Record<typeof accent, { text: string; bg: string; border: string }> = {
    emerald: {
      text: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200/70',
    },
    amber: {
      text: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-200/70',
    },
    rose: {
      text: 'text-rose-700',
      bg: 'bg-rose-50',
      border: 'border-rose-200/70',
    },
    ink: {
      text: 'text-ink/80',
      bg: 'bg-white/60',
      border: 'border-ink/10',
    },
  };
  const palette = accentClasses[accent];

  return (
    <div className={`rounded-xl border ${palette.border} ${palette.bg} p-4`}>
      <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink/55">
        {label}
      </dt>
      <dd className={`mt-1 text-3xl font-semibold tabular-nums ${palette.text}`}>
        {value}
      </dd>
    </div>
  );
}
