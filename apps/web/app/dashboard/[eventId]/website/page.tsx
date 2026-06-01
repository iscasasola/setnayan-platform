import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Aperture,
  ArrowRight,
  Camera,
  Cloud,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Film,
  Globe,
  Heart,
  Images,
  ImagePlus,
  LayoutGrid,
  Lock,
  MonitorPlay,
  Newspaper,
  Pencil,
  QrCode,
  Shirt,
  Star,
  Tv,
  Users,
  Video,
  Wand2,
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
import { JourneyRow, JourneySection } from './_components/journey';
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
 * /dashboard/[eventId]/website — journey-layout hub.
 *
 * Restructure per CLAUDE.md 2026-05-30 "V2.1 Amendment #3" (shell PR · pulled
 * forward pre-pilot by owner directive 2026-05-31). The page now reads
 * top-to-bottom as the wedding's lifecycle instead of a flat tile grid:
 *
 *   Step 1 · Your wedding address — public URL + branded QR + RSVPs + privacy
 *   Step 2 · Save the date & invitation — page-content editors + upgrades
 *   Step 3 · On the day — day-of preview + Panood / Papic / Patiktok
 *   Step 4 · After the wedding — editorial keepsakes (net-new · coming soon)
 *   Step 5 · Keep your photos — Google Drive sync
 *   Free vs Pro — the two existing paid widget upgrades (iteration 0004)
 *
 * Wiring rule (blueprint §1): journey rows are NAVIGATION, not buy buttons.
 * A clickable row deep-links to where the surface already lives — an
 * /add-ons/<key> detail page that owns its own pricing + buy/coming-soon
 * state, a /website/<editor> sub-route, or the guest list. There is NO
 * duplicate purchase flow on this page. Net-new features that have no route
 * yet render as honest "Coming soon" rows (never buyable) and flip to
 * clickable in their own follow-up PRs.
 *
 * Shell scope: pure re-presentation of existing surfaces into the journey
 * sections + coming-soon placeholders. No catalog fetch, no schema, no
 * pricing logic. The net-new features (Pro Bundle ₱24,999 SKU, the Section-4
 * editorial trio, Custom QR per guest, Animated Monogram, Live Photo Wall)
 * land one PR at a time after this.
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

  const rsvpBlurb =
    stats.pending > 0
      ? `${stats.pending} guest${stats.pending === 1 ? '' : 's'} still to hear from.`
      : 'Your guest list, one RSVP at a time.';

  const slugErrorMessage =
    typeof slugError === 'string' && slugError in SLUG_ERROR_COPY
      ? SLUG_ERROR_COPY[slugError]
      : typeof slugError === 'string' && slugError.length > 0
        ? 'We could not save that slug. Try again, or contact support if this keeps happening.'
        : null;

  return (
    <section className="space-y-10">
      {/* New full-screen editor entry — additive + pilot-safe. The journey
          page below stays the working surface; this opens the Reels-style
          full-screen editor (live preview + swipe tools). The Website tab
          flips to open it directly once the editor is complete (later PR).
          Per CLAUDE.md 2026-05-31 "Reels-style editor" build. */}
      <Link
        href={`/site-editor/${eventId}`}
        className="flex items-center justify-between gap-3 rounded-2xl border border-terracotta/30 bg-terracotta/10 px-4 py-3.5 transition hover:bg-terracotta/15"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-terracotta/20 text-terracotta">
            <Wand2 aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </span>
          <span>
            <span className="block text-sm font-semibold">Open the full-screen editor</span>
            <span className="block text-xs text-ink/60">
              Edit your site with a live preview — new
            </span>
          </span>
        </span>
        <ArrowRight aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
      </Link>

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

      {/* ─────────────────────────────────────────────────────────────
          STEP 1 · Your wedding address
          The one link + QR every guest uses. Keeps the existing Public
          URL card verbatim (URL · copy · open · slug editor · master QR ·
          live preview) and adds the navigational rows that used to live
          in the flat Quick-actions grid (RSVPs, privacy, QR download).
          ───────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <header className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
            Step 1
          </p>
          <h2 className="font-serif text-2xl italic tracking-tight sm:text-[1.7rem]">
            Your wedding address
          </h2>
          <p className="max-w-prose text-sm text-ink/60">
            The one link and QR every guest uses — to RSVP, find the venue, and
            follow along.
          </p>
        </header>

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
                      className="inline-flex h-11 min-h-[44pt] items-center justify-center gap-2 rounded-md bg-mulberry px-4 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mulberry"
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

        {/* Step-1 navigational rows. */}
        <ul className="space-y-2">
          <JourneyRow
            icon={Users}
            title="Manage RSVPs"
            blurb={rsvpBlurb}
            href={`/dashboard/${eventId}/guests?rsvp=pending`}
          />
          <JourneyRow
            icon={Lock}
            title="Set who can view"
            blurb="Public, unlisted, or private — change anytime."
            href={`/dashboard/${eventId}/website/privacy`}
          />
          {event.slug ? (
            <JourneyRow
              icon={Download}
              title="Download your QR"
              blurb="PNG with your monogram — print it, post it, share it."
              href={`/api/website/qr/${event.slug}`}
              download={`${event.slug}-wedding-qr.png`}
            />
          ) : (
            <JourneyRow
              icon={QrCode}
              title="Download your QR"
              blurb="Pick a slug above first to unlock your wedding QR."
              comingSoon
            />
          )}
        </ul>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          STEP 2 · Save the date & your invitation
          The page guests see before the day. Free content editors link to
          their existing /website/<editor> sub-routes; the Save-the-Date
          video links to its add-on detail page. Animated Monogram + Custom
          QR per guest are net-new (no route yet) → coming-soon rows.
          ───────────────────────────────────────────────────────────── */}
      <JourneySection
        step="2"
        title="Save the date & your invitation"
        blurb="Shape the page your guests see before the big day."
      >
        <JourneyRow
          icon={Pencil}
          title="Edit your branding"
          blurb="Monogram, names, and your invitation-site styling."
          href={`/dashboard/${eventId}/invitation`}
        />
        <JourneyRow
          icon={ImagePlus}
          title="Edit your hero photo"
          blurb="The full-bleed banner at the top of your page."
          href={`/dashboard/${eventId}/website/hero-photo`}
        />
        <JourneyRow
          icon={Camera}
          title="Edit photo moments"
          blurb="Phone-down, cameras welcome, or reserved for your paparazzo."
          href={`/dashboard/${eventId}/website/photo-moments`}
        />
        <JourneyRow
          icon={Shirt}
          title="Edit dress code"
          blurb="Headline, palette, and dos & don’ts for your guests."
          href={`/dashboard/${eventId}/website/dress-code`}
        />
        <JourneyRow
          icon={LayoutGrid}
          title="Customize widgets"
          blurb="Show, hide, and reorder the sections on your page."
          href={`/dashboard/${eventId}/website/widgets`}
        />
        <JourneyRow
          icon={Video}
          title="Save-the-Date video"
          blurb="A 60-second teaser from the template gallery."
          href={`/dashboard/${eventId}/add-ons/save-the-date`}
        />
        <JourneyRow
          icon={Wand2}
          title="Animated monogram"
          blurb="Your monogram draws itself in over a custom video or photo."
          comingSoon
        />
        <JourneyRow
          icon={QrCode}
          title="Custom QR for every guest"
          blurb="A personal QR per guest, dressed in your monogram and colors."
          href={`/dashboard/${eventId}/add-ons/custom-qr-guest`}
        />
      </JourneySection>

      {/* ─────────────────────────────────────────────────────────────
          STEP 3 · On the day
          What goes live while guests are celebrating. Day-of preview opens
          the public page in its T-1h..T+8h mode; Panood / Papic / Patiktok
          link to their add-on detail pages. Live Photo Wall is net-new.
          ───────────────────────────────────────────────────────────── */}
      <JourneySection
        step="3"
        title="On the day"
        blurb="What goes live while your guests are celebrating."
      >
        {publicLandingUrl ? (
          <JourneyRow
            icon={Eye}
            title="Preview day-of mode"
            blurb="See exactly what guests see from one hour before to eight after."
            href={`${publicLandingUrl}?preview=day_of`}
            external
          />
        ) : null}
        <JourneyRow
          icon={Tv}
          title="Live stream — Panood"
          blurb="Broadcast your ceremony to the guests who can’t be there."
          href={`/dashboard/${eventId}/add-ons/panood`}
        />
        <JourneyRow
          icon={MonitorPlay}
          title="Live photo wall"
          blurb="Guest photos on the venue screen as they’re taken."
          comingSoon
        />
        <JourneyRow
          icon={Camera}
          title="Candid capture — Papic for guests"
          blurb="Turn your guests’ phones into a shared candid camera."
          href={`/dashboard/${eventId}/add-ons/papic`}
        />
        <JourneyRow
          icon={Aperture}
          title="Paparazzo seats — Papic"
          blurb="Dedicated capture seats for the shooters you pick."
          href={`/dashboard/${eventId}/add-ons/papic`}
        />
        <JourneyRow
          icon={Film}
          title="Patiktok booth"
          blurb="A vertical-reel booth your guests can play with."
          href={`/dashboard/${eventId}/add-ons/patiktok`}
        />
      </JourneySection>

      {/* ─────────────────────────────────────────────────────────────
          STEP 4 · After the wedding
          Turn the day into a keepsake. All net-new (no routes yet) → these
          render as honest coming-soon rows and become clickable in their
          own follow-up PRs (editorial = iteration 0046 Phase 4).
          ───────────────────────────────────────────────────────────── */}
      <JourneySection
        step="4"
        title="After the wedding"
        blurb="Turn your day into a keepsake — coming soon."
      >
        <JourneyRow
          icon={Newspaper}
          title="Create your editorial"
          blurb="A magazine-style story of your wedding, right on your page."
          comingSoon
        />
        <JourneyRow
          icon={Star}
          title="Collect reviews"
          blurb="Invite your guests and vendors to leave a note."
          comingSoon
        />
        <JourneyRow
          icon={Images}
          title="Pick your photos"
          blurb="Curate the gallery your guests get to keep."
          comingSoon
        />
        <JourneyRow
          icon={Heart}
          title="Thank-you video"
          blurb="A short thank-you to everyone who celebrated with you."
          comingSoon
        />
      </JourneySection>

      {/* ─────────────────────────────────────────────────────────────
          STEP 5 · Keep your photos
          Save the full album to the host's own Google Drive — links to the
          existing Photo Delivery add-on (0009).
          ───────────────────────────────────────────────────────────── */}
      <JourneySection
        step="5"
        title="Keep your photos"
        blurb="Save the full album to your own Google Drive."
      >
        <JourneyRow
          icon={Cloud}
          title="Sync to Google Drive"
          blurb="Connect Drive so every photo lands in your own folder."
          href={`/dashboard/${eventId}/add-ons/photo-delivery`}
        />
      </JourneySection>

      {/* Free vs Pro panel — surfaces the two existing V1 paid widget
          upgrades from iteration 0004 (Monogram Hero ₱1,999 + Live
          Schedule ₱999). Owner directive CLAUDE.md 2026-05-22: the
          wedding website has a Free tier and a Pro tier; surface the
          existing SKUs, do not invent a new bundled SKU. The Pro Bundle
          ₱24,999 comparison (blueprint §6) lands in its own feature PR.
          Active-state comes from ownedOrders fetched above. */}
      <ProUpgradePanel eventId={eventId} ownedOrders={ownedOrders} />

      {/* Footer note */}
      <footer className="rounded-xl border border-ink/10 bg-cream/60 p-5 text-sm text-ink/65">
        Your wedding URL is live from the moment your event is created. Guests can scan the
        QR or open the link anytime — it stays the same throughout your engagement, on the
        day itself, and as your wedding becomes a keepsake page after.
      </footer>
    </section>
  );
}
