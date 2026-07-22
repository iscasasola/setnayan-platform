/**
 * /[slug]/hub — the fullscreen, no-scroll event-day "hub" for guests (Phase 2
 * of the event-day guest-hub program · DECISION_LOG 2026-06-28).
 *
 * This is a SEPARATE route from the long-scrolling /[slug] page (4,100+ lines
 * serving guests / anonymous / STD-reveal / RSVP / day-of). That page stays
 * 100% intact; this one is the owner's centerpiece: one screen-filling hub with
 * a bottom menu that toggles between the day-of functions instead of a long
 * scroll. The /[slug] event-day bottom bar links here during the live window.
 *
 * This server component resolves the viewer's identity + every panel's data and
 * renders each panel's CONTENT, handing them to <HubShell> (the client chrome).
 * It reuses the same helpers /[slug] uses — the visibility gate, getDayOfPhase,
 * the schedule fetch, the per-guest live gallery, the live-wall snapshot, the
 * candid-camera gate, the QR render, the nav deep-links — so the hub never
 * diverges from the canonical day-of behavior.
 *
 * A no-guest viewer (anonymous open) degrades to the public panels only — the
 * same posture as the public event-day bar (candid Camera + public Photos, no
 * personal QR / "photos of you" / face enroll).
 *
 * PRIVACY: like every other /[slug] sub-route, this gates on canViewSlugEvent —
 * a private (pre-Save-the-Date-launch) wedding is NEVER exposed to a stranger
 * with a guessable URL (redirect to /[slug], which renders PrivateLanding). And
 * generateMetadata marks the whole route noindex,nofollow — a day-of utility
 * surface is never a crawl/SEO target, and this fail-safes the private case.
 */

import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  Camera as CameraIcon,
  CheckCircle2,
  Images,
  MapPin,
  PartyPopper,
  QrCode,
  Radio,
} from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { RESERVED_SLUGS } from '@/lib/reserved-slugs';
import { createClient } from '@/lib/supabase/server';
import { resolveProfile, surfaceEnabled } from '@/lib/event-type-profile';
import { readGuestSession } from '@/lib/guest-session';
import { canViewSlugEvent } from '@/lib/slug-access';
import { resolveEffectiveVisibility } from '@/lib/launch-save-the-date';
import { getDayOfPhase, type DayOfPhase } from '@/lib/day-of-mode';
import { fetchPublicScheduleBlocks } from '@/lib/schedule';
import { isCoordinatorPrepReleaseEnabled } from '@/lib/coordinator-prep-release';
import { eventTimezoneFromCoords } from '@/lib/event-timezone.server';
import { eventPapicGuestActive } from '@/lib/papic-guest';
import { eventOwnsPapicSeats } from '@/lib/papic-seats';
import { resolveGuestCamera } from '@/lib/papic-limited';
import { getGuestLiveGallery } from '@/lib/guest-live-gallery';
import { eventSkuActive } from '@/lib/entitlements';
import { getWallSnapshot } from '@/lib/live-wall';
import type { WallTile } from '@/lib/live-wall-logic';
import { parseYouTubeVideoId, youTubeEmbedUrl } from '@/lib/panood-watch';
import { buildInvitationUrl, renderInvitationQrSvg } from '@/lib/qr';
import { resolveEventOwnerSlug } from '@/lib/public-event-url';
import { resolveMonogram } from '@/lib/monogram';
import { NavLinksRow } from '@/app/_components/nav-links';
import { ScheduleWidget } from '../_components/schedule-widget';
import { DayOfFaceEnroll } from '../_components/day-of-face-enroll';
import { resolvePapicFaceMode, type PapicFaceMode } from '@/lib/papic-face-mode';
import { WhatsHappeningCard } from '@/app/dashboard/[eventId]/_components/day-of-mode/whats-happening-card';
import { LiveWallBlock, type LiveWallCaption } from '../_components/live-wall-block';
import { HubShell } from '../_components/hub/hub-shell';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/**
 * The hub is a private, day-of utility surface — never a crawl/SEO target. Mark
 * the whole route noindex,nofollow so a private/unlisted event's schedule/venue
 * can't leak through a crawler (a fail-safe alongside the canViewSlugEvent gate
 * in the body). Matches the canonical page's noindex-for-non-public posture but
 * is unconditional here, which is strictly safer for a utility route.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function EventHubPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const search = await searchParams;
  if (!slug || RESERVED_SLUGS.has(slug)) notFound();

  const admin = createAdminClient();

  // Focused event read — only the columns the hub panels need (a far smaller
  // select than the full /[slug] page, since the hub has no hero/STD/widget
  // chrome). landing_page_visibility + scheduled_launch_at drive the privacy
  // gate; panood_watch_url is for the Watch panel.
  const { data: event } = await admin
    .from('events')
    .select(
      'event_id, slug, display_name, event_type, event_date, venue_name, venue_address, venue_latitude, venue_longitude, monogram_text, monogram_color, monogram_font_key, monogram_style, monogram_frame_key, panood_watch_url, landing_page_visibility, scheduled_launch_at',
    )
    .ilike('slug', slug)
    .maybeSingle();
  if (!event) notFound();

  // Same surface gate as /[slug]: the public couple website is the 'website'
  // surface; non-website profiles 404 (mirrors the page's resolveProfile gate).
  const eventTypeProfile = await resolveProfile(event.event_type);
  if (!surfaceEnabled(eventTypeProfile, 'website')) notFound();

  // Private-event visibility gate — the SAME gate /[slug] and every sibling
  // sub-route (find-seat / find-my-table / recap) apply via canViewSlugEvent.
  // A wedding is private until the Save-the-Date launches (NULL → 'private',
  // fail-safe); a stranger with a guessable URL is bounced to /[slug], where
  // they correctly see PrivateLanding instead of this event's schedule/venue.
  // resolveEffectiveVisibility folds in a due scheduled-launch so the hub reads
  // public at the same instant the canonical page does.
  const effectiveVisibility = resolveEffectiveVisibility(event);
  if (!(await canViewSlugEvent(event.event_id, effectiveVisibility))) {
    redirect(`/${slug}`);
  }

  const monogram = resolveMonogram(event);

  // ── Day-of phase (with the same host/demo `?phase` preview /[slug] allows so
  // a couple — or QA on a demo event — can preview their hub off the day). ────
  const isDemoEvent =
    event.slug?.toLowerCase().startsWith('test-') === true ||
    (event.display_name ?? '').toUpperCase().includes('[TEST]');
  const phaseParam = typeof search.phase === 'string' ? search.phase.toLowerCase() : '';
  const isValidPhaseParam =
    phaseParam === 'event' || phaseParam === 'editorial' || phaseParam === 'rsvp';

  // Resolve the viewer identity early — the guest session (a personal QR open)
  // OR a signed-in account (for the host phase-preview check below).
  const session = await readGuestSession();
  const guestSessionMatches = session?.event_id === event.event_id;

  let isHost = false;
  if (isValidPhaseParam && !isDemoEvent) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const [{ data: memberRow }, { data: moderatorRow }] = await Promise.all([
        admin
          .from('event_members')
          .select('member_type')
          .eq('event_id', event.event_id)
          .eq('user_id', user.id)
          .maybeSingle(),
        admin
          .from('event_moderators')
          .select('moderator_id')
          .eq('event_id', event.event_id)
          .eq('user_id', user.id)
          .not('accepted_at', 'is', null)
          .is('removed_at', null)
          .maybeSingle(),
      ]);
      isHost = Boolean(memberRow) || Boolean(moderatorRow);
    }
  }
  const phasePreviewAllowed = isDemoEvent || isHost;
  const phaseOverride: DayOfPhase | null =
    isValidPhaseParam && phasePreviewAllowed
      ? phaseParam === 'event'
        ? 'live'
        : phaseParam === 'editorial'
          ? 'post'
          : 'pre'
      : null;

  const dayOfPhase: DayOfPhase =
    phaseOverride ?? (event.event_date ? getDayOfPhase(event.event_date) : 'inactive');
  const isLive = dayOfPhase === 'live';
  const isPost = dayOfPhase === 'post';

  // ── Identified guest row (personal panels). A cookie for a DIFFERENT event,
  // or no cookie, degrades to public panels only. ───────────────────────────
  const guest = guestSessionMatches
    ? (
        await admin
          .from('guests')
          .select(
            'guest_id, first_name, last_name, display_name, rsvp_status, qr_token, plus_one_of_guest_id, plus_one_name_confirmed_at',
          )
          .eq('guest_id', session!.guest_id)
          .is('deleted_at', null)
          .maybeSingle()
      ).data
    : null;

  // A TBA +1 who hasn't confirmed their own name yet must finish onboarding
  // first — exactly as /[slug] redirects them to /welcome — before we render
  // their personal hub (the QR/seat/gallery key off a real identity).
  if (
    guest &&
    guest.plus_one_of_guest_id !== null &&
    !guest.plus_one_name_confirmed_at &&
    (!guest.first_name || guest.first_name.toLowerCase() === 'tba')
  ) {
    redirect(`/${slug}/welcome`);
  }

  // ── Shared data: public schedule (every viewer). fetchPublicScheduleBlocks
  // already returns only is_public rows, so we just split out the top-level
  // blocks for the "happening now" card. ────────────────────────────────────
  const scheduleBlocks = await fetchPublicScheduleBlocks(
    admin,
    event.event_id,
    await isCoordinatorPrepReleaseEnabled(),
  );
  const eventTz = eventTimezoneFromCoords(
    event.venue_latitude,
    event.venue_longitude,
  );
  const topLevelBlocks = scheduleBlocks
    .filter((b) => !b.parent_block_id)
    .map((b) => ({
      block_id: b.block_id,
      label: b.label,
      start_at: b.start_at,
      end_at: b.end_at,
      location: b.location,
    }));

  // ── Watch (Panood) — single-cam live is free; the staged URL is the only
  // condition, mirroring /[slug]. Live window only. ──────────────────────────
  let watchEmbed: { embedUrl: string; watchUrl: string } | null = null;
  if (isLive && event.panood_watch_url) {
    const videoId = parseYouTubeVideoId(event.panood_watch_url);
    if (videoId) {
      watchEmbed = {
        embedUrl: youTubeEmbedUrl(videoId),
        watchUrl: event.panood_watch_url,
      };
    }
  }

  // ── Candid camera (PAPIC_GUEST) ownership — ONE read, reused for the camera
  // CTA AND the face-enroll gate. For an identified guest the candid CTA shows
  // whenever the couple owns the pack (matches guest-hub-bar.tsx — the capture
  // window is enforced inside /papic/guest); for a no-guest viewer it's
  // live-only (matches public-event-day-bar.tsx). ───────────────────────────
  const papicGuestOwned = await eventPapicGuestActive(admin, event.event_id);
  const candidActive = guest ? papicGuestOwned : isLive && papicGuestOwned;

  // ── Per-guest day-of reads (skip entirely for a no-guest viewer). ──────────
  let guestRollCameraReady = false;
  let galleryPhotos: { id: string; url: string }[] = [];
  let galleryTotal = 0;
  let needsFaceEnroll = false;
  // Effective face-tag mode for the day-of enroll surface (One-Pool spec §3.4).
  // Fail-closed default; resolved server-side only when we actually offer enroll.
  let hubFaceMode: PapicFaceMode = 'mode_b';
  let tableLabel: string | null = null;
  let arrived = false;
  let qrSvg = '';
  let invitationUrl = '';

  if (guest) {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      'https://setnayan-platform-web.vercel.app';
    const ownerSlug = await resolveEventOwnerSlug(admin, event.event_id);
    qrSvg = await renderInvitationQrSvg({
      appUrl,
      slug,
      qrToken: guest.qr_token,
      monogram,
      ownerSlug,
    });
    invitationUrl = buildInvitationUrl({ appUrl, slug, qrToken: guest.qr_token, ownerSlug });

    // Paid LIMITED roll camera — only the 'ready' state lights the launch CTA.
    if (guest.rsvp_status !== 'declined') {
      try {
        const cam = await resolveGuestCamera(admin, event.event_id, guest.guest_id);
        guestRollCameraReady = cam.status === 'ready';
      } catch {
        guestRollCameraReady = false;
      }
    }

    // "Photos of you" — live + post grace window (Invite/Join v2), same gate as
    // the page's per-guest gallery.
    if (isLive || isPost) {
      const live = await getGuestLiveGallery(event.event_id, guest.guest_id);
      if (live) {
        galleryPhotos = live.photos.map((p) => ({ id: p.id, url: p.url }));
        galleryTotal = live.total;
      }
    }

    // Face enroll catch — when this event has candid capture, the guest hasn't
    // declined, and they have no live enrollment (self-hides once enrolled).
    // Reuses papicGuestOwned (no second PAPIC_GUEST read).
    if (
      guest.rsvp_status !== 'declined' &&
      (papicGuestOwned || (await eventOwnsPapicSeats(admin, event.event_id)))
    ) {
      const { data: liveEnrollment } = await admin
        .from('guest_face_enrollments')
        .select('id')
        .eq('event_id', event.event_id)
        .eq('guest_id', guest.guest_id)
        .is('revoked_at', null)
        .maybeSingle();
      needsFaceEnroll = !liveEnrollment;
      if (needsFaceEnroll) {
        hubFaceMode = await resolvePapicFaceMode(admin, event.event_id);
      }
    }

    // Seat label + door arrival (graceful-degrade — these tables/columns may not
    // exist on every install).
    try {
      const { data: assignmentRow } = await admin
        .from('event_seat_assignments')
        .select('table_id')
        .eq('event_id', event.event_id)
        .eq('guest_id', guest.guest_id)
        .maybeSingle();
      if (assignmentRow?.table_id) {
        const { data: tableRow } = await admin
          .from('event_tables')
          .select('table_label, link_group_label')
          .eq('table_id', assignmentRow.table_id)
          .maybeSingle();
        if (tableRow) {
          tableLabel =
            (tableRow as { table_label: string; link_group_label?: string | null })
              .link_group_label ??
            (tableRow as { table_label: string }).table_label;
        }
      }
    } catch {
      tableLabel = null;
    }
    if (isLive || isPost) {
      try {
        const { data: checkinRow, error: checkinErr } = await admin
          .from('guest_checkins')
          .select('checked_in_at')
          .eq('event_id', event.event_id)
          .eq('guest_id', guest.guest_id)
          .maybeSingle();
        if (!checkinErr) arrived = Boolean(checkinRow?.checked_in_at);
      } catch {
        arrived = false;
      }
    }
  }

  // ── Camera destinations (mirror guest-hub-bar / public-event-day-bar). ──────
  const rollHref =
    guest && guestRollCameraReady ? `/papic/me/${guest.qr_token}` : null;
  const candidHref = candidActive ? '/papic/guest' : null;
  const hasCamera = Boolean(rollHref || candidHref);

  // ── Live Photo Wall — embed the SAME wall the venue projector renders
  // (getWallSnapshot, LIVE_WALL-gated, live window only). LiveWallBlock polls
  // the /[slug]/live-wall freshness FEED internally — that route is a JSON
  // endpoint, never a page, so we mount the block rather than link to it. The
  // post-event RECAP is the viewable album page. ────────────────────────────
  let liveWall: { tiles: WallTile[]; count: number; caption: LiveWallCaption } | null =
    null;
  if (isLive) {
    try {
      if (await eventSkuActive(admin, event.event_id, 'LIVE_WALL')) {
        const snap = await getWallSnapshot(event.event_id, null, { limit: 12 });
        liveWall = {
          tiles: snap.tiles,
          count: snap.count,
          caption: snap.caption
            ? { text: snap.caption.text, author: snap.caption.author }
            : null,
        };
      }
    } catch {
      liveWall = null; // wall trouble must never break the hub
    }
  }
  const recapHref = isPost ? `/${event.slug}/recap` : null;
  const hasPhotos = Boolean(guest) || Boolean(liveWall) || Boolean(recapHref);

  // ── Directions availability. ───────────────────────────────────────────────
  const hasCoords =
    event.venue_latitude != null &&
    event.venue_longitude != null &&
    Number.isFinite(event.venue_latitude) &&
    Number.isFinite(event.venue_longitude);
  const hasDirections = hasCoords || Boolean((event.venue_address ?? '').trim());

  const firstName = guest?.first_name ?? null;
  // Only the LIVE window with an active/upcoming block should read "happening
  // now" — WhatsHappeningCard is built for the live dashboard and its idle copy
  // is host-voiced, so we render it ONLY live-with-blocks and show a guest-voiced
  // status card otherwise (no false live badge at pre/post/inactive).
  const showWhatsHappening = isLive && topLevelBlocks.length > 0;
  const phaseStatus =
    dayOfPhase === 'live'
      ? 'The celebration is underway — enjoy every moment.'
      : dayOfPhase === 'post'
        ? 'The celebration has wrapped. Thank you for being part of the day.'
        : dayOfPhase === 'pre'
          ? 'The celebration is almost here. We can’t wait to see you.'
          : 'Your event hub — everything for the day, in one place.';
  const phaseLabel =
    dayOfPhase === 'live'
      ? 'Happening now'
      : dayOfPhase === 'post'
        ? 'Just wrapped'
        : dayOfPhase === 'pre'
          ? 'Almost here'
          : 'Event hub';

  // ───────────────────────────── Panels ─────────────────────────────────────

  const header = (
    <div className="mx-auto flex max-w-md items-center justify-between gap-3">
      <Link
        href={`/${event.slug}`}
        aria-label="Back to the event page"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/10 bg-cream text-ink/60 transition hover:border-terracotta hover:text-terracotta"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      </Link>
      <div className="min-w-0 flex-1 text-center">
        <p className="truncate font-serif text-base italic leading-tight text-ink">
          {event.display_name ?? monogram.text}
        </p>
        <p className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-terracotta">
          {isLive ? (
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-terracotta" />
          ) : null}
          {phaseLabel}
        </p>
      </div>
      <span
        aria-hidden
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
        style={{ background: monogram.bg, color: monogram.color }}
      >
        {monogram.text.slice(0, 2)}
      </span>
    </div>
  );

  const nowPanel = (
    <div className="mx-auto max-w-md space-y-4">
      {showWhatsHappening ? (
        <WhatsHappeningCard blocks={topLevelBlocks} />
      ) : (
        <article className="space-y-1 rounded-2xl border border-ink/10 bg-cream p-5">
          <p className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.18em] text-terracotta">
            <Activity aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            {phaseLabel}
          </p>
          <p className="text-sm text-ink/65">{phaseStatus}</p>
        </article>
      )}

      {guest ? (
        <article
          className={`space-y-1 rounded-2xl border p-5 ${
            arrived && tableLabel
              ? 'border-champagne-gold/40 bg-gradient-to-br from-cream to-champagne-gold/10'
              : 'border-ink/10 bg-cream'
          }`}
        >
          <p className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.18em] text-terracotta">
            {arrived && tableLabel ? (
              <PartyPopper aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            ) : (
              <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            {arrived && tableLabel ? 'You’ve arrived' : 'Your seat'}
          </p>
          <h3 className="font-serif text-3xl italic leading-tight tracking-tight text-ink">
            {tableLabel ?? 'Not yet assigned'}
          </h3>
          {arrived && tableLabel ? (
            <p className="text-sm text-emerald-700">
              Welcome, {firstName} — you’re checked in.
            </p>
          ) : tableLabel ? (
            <Link
              href={`/${event.slug}/find-my-table`}
              className="inline-flex items-center gap-1 text-sm text-terracotta underline-offset-2 hover:underline"
            >
              See the venue map →
            </Link>
          ) : (
            <p className="text-sm text-ink/55">
              The couple will assign seats closer to the day.
            </p>
          )}
        </article>
      ) : (
        <article className="space-y-1 rounded-2xl border border-ink/10 bg-cream p-5">
          <p className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.18em] text-terracotta">
            <Activity aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Welcome
          </p>
          <p className="text-sm text-ink/65">
            Open your personal invitation link to see your seat, your photos, and
            your QR here.
          </p>
        </article>
      )}
    </div>
  );

  const schedulePanel = (
    <div className="mx-auto max-w-md">
      {scheduleBlocks.length > 0 ? (
        <ScheduleWidget blocks={scheduleBlocks} eventTz={eventTz} />
      ) : (
        <article className="rounded-2xl border border-ink/10 bg-cream p-6 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta">
            Day-of schedule
          </p>
          <p className="mt-2 text-sm text-ink/60">
            The couple hasn’t published the program yet. Check back closer to the
            day.
          </p>
        </article>
      )}
    </div>
  );

  const directionsPanel = hasDirections ? (
    <div className="mx-auto max-w-md space-y-3">
      <article className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          Getting there
        </p>
        <h3 className="font-serif text-2xl italic leading-tight tracking-tight text-ink">
          {event.venue_name ?? 'Venue'}
        </h3>
        {event.venue_address ? (
          <p className="text-sm text-ink/65">{event.venue_address}</p>
        ) : null}
        <NavLinksRow
          latitude={event.venue_latitude ?? null}
          longitude={event.venue_longitude ?? null}
          addressFallback={event.venue_address ?? event.venue_name ?? null}
          label="Open in"
        />
      </article>
    </div>
  ) : null;

  const watchPanel = watchEmbed ? (
    <div className="mx-auto max-w-md">
      <section
        aria-label="Watch the celebration live"
        className="overflow-hidden rounded-2xl border-2 border-terracotta/40 bg-ink shadow-sm"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-cream">
            <Radio aria-hidden className="h-3.5 w-3.5 animate-pulse" strokeWidth={2} />
            Watch live
          </p>
          <a
            href={watchEmbed.watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-cream/65 underline-offset-4 hover:text-cream hover:underline"
          >
            Open on YouTube
          </a>
        </div>
        <div className="aspect-video w-full">
          <iframe
            title="Live broadcast of the celebration"
            src={watchEmbed.embedUrl}
            className="h-full w-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      </section>
    </div>
  ) : null;

  const cameraPanel = hasCamera ? (
    <div className="mx-auto max-w-md space-y-3">
      <article className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-6 text-center">
        <CameraIcon aria-hidden className="mx-auto h-8 w-8 text-terracotta" strokeWidth={1.5} />
        <div>
          <h3 className="font-serif text-xl italic leading-tight tracking-tight text-ink">
            Capture the day
          </h3>
          <p className="mx-auto mt-1 max-w-prose text-sm text-ink/65">
            Every shot lands in the couple’s gallery — and tagged guests get
            theirs in real time.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {rollHref ? (
            <Link
              href={rollHref}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-mulberry px-5 py-3 text-sm font-semibold text-cream transition hover:bg-mulberry-600"
            >
              <CameraIcon aria-hidden className="h-4 w-4" strokeWidth={2} />
              Open your camera roll
            </Link>
          ) : null}
          {candidHref ? (
            <Link
              href={candidHref}
              className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${
                rollHref
                  ? 'border border-ink/15 bg-cream text-ink hover:border-terracotta hover:text-terracotta'
                  : 'bg-mulberry text-cream hover:bg-mulberry-600'
              }`}
            >
              <CameraIcon aria-hidden className="h-4 w-4" strokeWidth={2} />
              Be a candid camera
            </Link>
          ) : null}
        </div>
      </article>
    </div>
  ) : null;

  const photosPanel = hasPhotos ? (
    <div className="mx-auto max-w-md space-y-4">
      {guest ? (
        <article className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
          <div className="flex items-center justify-between">
            <p className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.18em] text-terracotta">
              <Images aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              Photos of you
            </p>
            <Link
              href={`/papic/me/${guest.qr_token}`}
              className="font-mono text-xs uppercase tracking-[0.15em] text-ink/55 hover:text-terracotta"
            >
              See all{galleryTotal > 0 ? ` (${galleryTotal})` : ''} →
            </Link>
          </div>
          {galleryPhotos.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5">
              {galleryPhotos.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={p.id}
                  src={p.url}
                  alt="A candid photo you’re tagged in"
                  loading="lazy"
                  className="aspect-square w-full rounded-xl object-cover"
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink/55">
              {isLive || isPost
                ? 'No tagged photos yet — they’ll appear here as the celebration unfolds.'
                : 'Your tagged photos will appear here during the celebration.'}
            </p>
          )}
        </article>
      ) : null}

      {/* The shared Live Photo Wall, mirrored to the phone during the day
          (polls /[slug]/live-wall internally). */}
      {liveWall ? (
        <LiveWallBlock
          slug={event.slug}
          initialTiles={liveWall.tiles}
          initialCount={liveWall.count}
          initialCaption={liveWall.caption}
        />
      ) : null}

      {/* After the day, the viewable recap album. */}
      {recapHref ? (
        <Link
          href={recapHref}
          className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-cream p-5 transition hover:border-terracotta"
        >
          <span className="inline-flex items-center gap-2 text-sm font-medium text-ink">
            <Images aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
            See the recap gallery
          </span>
          <span aria-hidden className="text-ink/40">→</span>
        </Link>
      ) : null}
    </div>
  ) : null;

  const mePanel = guest ? (
    <div className="mx-auto max-w-md space-y-4">
      <article className="rounded-2xl border border-ink/10 bg-cream p-6 text-center">
        <p className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          <QrCode aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Your QR
        </p>
        <h3 className="mt-1 font-serif text-xl italic leading-tight tracking-tight text-ink">
          Let others scan you
        </h3>
        <p className="mx-auto mt-1 max-w-prose text-xs text-ink/60">
          Show this so photographers and friends can tag you — and the souvenir
          desk can mark yours received.
        </p>
        <div
          aria-hidden
          className="mx-auto mt-5 inline-block rounded-2xl bg-white p-3 shadow-sm [&_svg]:h-auto [&_svg]:w-48"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <p className="mx-auto mt-4 break-all font-mono text-[0.65rem] tracking-[0.05em] text-ink/45">
          {invitationUrl}
        </p>
        {guest.rsvp_status === 'attending' ? (
          <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-success-700">
            <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Your RSVP is confirmed.
          </p>
        ) : null}
      </article>

      {needsFaceEnroll ? <DayOfFaceEnroll context="hub" faceMode={hubFaceMode} /> : null}
    </div>
  ) : null;

  return (
    <HubShell
      eventDate={event.event_date ?? null}
      header={header}
      now={nowPanel}
      watch={watchPanel}
      camera={cameraPanel}
      photos={photosPanel}
      me={mePanel}
      schedule={schedulePanel}
      directions={directionsPanel}
    />
  );
}
