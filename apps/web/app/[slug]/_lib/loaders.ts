// Cached domain loaders for the public event-website route (`app/[slug]`).
//
// OPEN-BROWSE PR2 (council build plan §3 row 2,
// Guest_Event_Website_Open_Browse_Council_Verdict_2026-07-22.md): the ~900-line
// inline data-resolution block of `page.tsx`, split into `React.cache`'d domain
// loaders. Every moved block is verbatim from page.tsx — same queries, same
// fallbacks, same error handling — re-homed here with parameters threaded in.
//
// The benefit is PER-REQUEST dedup + orchestrator shrinkage, NOT cross-route
// sharing — do NOT import these loaders from other routes (`cache()` scopes to
// a single server request; the loaders assume this route's gating has already
// run).
//
// HARD RULE (council row 2 + PR1 handover): `cookies()`, `readGuestSession()`
// and `createClient()` (the cookie-scoped Supabase server client) are NEVER
// called inside these cached functions — React.cache must not capture
// per-request cookie access. The orchestrator reads cookies/sessions and passes
// the results IN as arguments. The service-role admin client is cookie-free and
// safe to use here (`loadEventShell` creates its own so its cache key stays
// slug-only — see its doc block).
import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveMonogram } from '@/lib/monogram';
import { eventAnimatedMonogramActive } from '@/lib/animated-monogram';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { eventPapicGuestActive, fetchGuestQuota } from '@/lib/papic-guest';
import { eventPabatiActive, fetchPabatiQuota } from '@/lib/pabati';
import { eventOwnsPapicSeats } from '@/lib/papic-seats';
import { asPapicStyle, type PapicStyle } from '@/lib/papic-photo-styles';
import { resolveFaceMode, resolvePapicFaceMode, type PapicFaceMode } from '@/lib/papic-face-mode';
import { resolveGuestCamera } from '@/lib/papic-limited';
import { eventSkuActive } from '@/lib/entitlements';
import { eventOwnsCustomQrGuest } from '@/lib/seat-pass';
import { DEFAULT_STUDIO_ANIM } from '@/lib/hero-monogram-data';
import { sanitizeStudioConfig } from '@/lib/monogram-studio-shared';
import type { StudioAnim } from '@/app/_components/studio-reveal-player';
import {
  resolveMonogramMotion,
  type MonogramMotionKey,
} from '@/lib/monogram-motion';
import { fetchPublicScheduleBlocks } from '@/lib/schedule';
import { isCoordinatorPrepReleaseEnabled } from '@/lib/coordinator-prep-release';
import { isGuestNowTriggerEnabled } from '@/lib/guest-now-trigger';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { displayUrlForStdBackground } from '@/lib/std-bg-image';
import { resolveStdBackground, realisticBgSrc } from '@/lib/std-backgrounds';
import { resolveStdMedia, stdVideoIsLive } from '@/lib/std-media';
import { resolveStdFinalizedVenues } from '@/lib/std-venues';
import { eventStdOpeningsActive } from '@/lib/std-openings';
import { parseRsvpBackdropConfig, type RsvpBackdropConfig } from '@/lib/spatial-backdrop';
import { getWallSnapshot } from '@/lib/live-wall';
import { getGuestLiveGallery } from '@/lib/guest-live-gallery';
import { fetchEventVendorCredits } from '@/lib/event-vendor-credits';
import { parseYouTubeVideoId, youTubeEmbedUrl } from '@/lib/panood-watch';
import {
  fetchRoamManifest,
  liveStudioRoamEnabled,
  selectFeaturedZone,
} from '@/lib/live-studio-roam';
import { fetchEntrance, type EntrancePos } from '@/lib/indoor-blueprint';
import { fetchTables, type EventTableRow } from '@/lib/seating';
import { resolveEventOwnerSlug } from '@/lib/public-event-url';
import { buildInvitationUrl, renderInvitationQrSvg } from '@/lib/qr';
import type { MonogramConfig } from '@/lib/monogram';
import type { DayOfPhase } from '@/lib/day-of-mode';
import type { GuestSessionPayload } from '@/lib/guest-session';
import {
  type InvitationWidgetRow,
  isWidgetType,
} from '@/lib/invitation-widgets';
import { pickNextScheduleBlock, type GuestHubData } from '../_components/guest-hub-card';
import type {
  EventMedia,
  GuestContext,
  LiveLayerData,
  LiveWallData,
  WatchLiveData,
} from './types';

/** The service-role Supabase client the orchestrator creates once per request
 *  and threads into every loader — a stable per-request reference, so it is a
 *  well-behaved `React.cache` key component. */
type AdminClient = ReturnType<typeof createAdminClient>;

// Soft-404 fix (SEO) — this route has a loading.tsx, so the streaming shell
// commits an HTTP 200 BEFORE the page body runs; a notFound() thrown in the
// body renders the 404 UI but the status stays 200 (Google soft-404, and any
// junk top-level URL was an indexable 200). generateMetadata resolves before
// the stream starts on Next 15.1, so the slug lookup happens HERE: a miss
// throws notFound() pre-stream and the response is a real 404. React cache()
// dedupes the read — the page body reuses the same single DB roundtrip.
//
// (PR2 note: this is page.tsx's `fetchEventBySlug`, re-homed as the event-shell
// loader. It creates its OWN admin client so the cache key stays the slug alone
// — generateMetadata and the page body must keep sharing one DB roundtrip; an
// admin-client parameter would fork the key per call site.)
export const loadEventShell = cache(async (slug: string) => {
  const admin = createAdminClient();
  const { data } = await admin
    .from('events')
    .select(
      'event_id, public_id, display_name, event_date, venue_name, venue_address, venue_latitude, venue_longitude, event_type, ceremony_type, secondary_ceremony_type, gender_separation, slug, monogram_text, monogram_color, monogram_style, monogram_font_key, monogram_frame_key, monogram_motion_key, monogram_custom_svg, monogram_uploaded_svg, monogram_studio_config, photo_moments_config, landing_page_visibility, scheduled_launch_at, dress_code_config, landing_page_hero_image_url, special_message, what_to_bring, our_photos, landing_page_hero_video_r2_key, site_bg_music_enabled, site_bg_music_r2_key, role_palette, love_story, wax_seal_config, std_reveal_template, std_reveal_effects, std_invitation_launch_date, std_theme, std_background, std_media, std_film_venue_name, std_film_venue_city, std_film_ceremony_name, std_film_accent_hex, is_sample, live_media_public',
    )
    .ilike('slug', slug)
    .maybeSingle();
  return data;
});

/** The event row as `loadEventShell` returns it (the loosely-typed service-
 *  client row page.tsx has always flowed) — the `event` parameter every other
 *  loader takes, so loader bodies stay verbatim against the original inline
 *  block. Renderers keep typing it as `EventRow` (./types) at the prop
 *  boundary, exactly as before. */
export type EventShellRow = NonNullable<Awaited<ReturnType<typeof loadEventShell>>>;

/**
 * Host-membership check for THIS event — event_members (V1 couple membership)
 * OR event_moderators (iteration 0048 multi-host invite path). Verbatim the
 * query pair page.tsx ran inline at BOTH the private-mode gate and the
 * `?phase=` preview gate — the page's only literally-duplicated read, so a
 * private event previewed by its host with a phase param now costs one pair of
 * queries instead of two (the React.cache dedup this PR exists for).
 *
 * The caller resolves the viewer via the cookie-scoped client and passes the
 * user id IN — auth/cookie reads never happen inside a cached loader.
 */
export const loadHostMembership = cache(
  async (admin: AdminClient, eventId: string, userId: string): Promise<boolean> => {
    const [{ data: memberRow }, { data: moderatorRow }] = await Promise.all([
      admin
        .from('event_members')
        .select('member_type')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .maybeSingle(),
      admin
        .from('event_moderators')
        .select('moderator_id')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .not('accepted_at', 'is', null)
        .is('removed_at', null)
        .maybeSingle(),
    ]);
    return Boolean(memberRow) || Boolean(moderatorRow);
  },
);

/**
 * Per-event widget registry from migration 20260607030000_invitation_widgets.sql.
 * Drives which widgets render on this page and in what order. Every event
 * has 12 rows after the backfill; pre-backfill events fall back to "render
 * everything" via widgetShouldRender() returning true for missing rows
 * through the always-on path. See lib/invitation-widgets.ts for the
 * canonical widget catalog + sort/filter helpers.
 *
 * Read via the admin client (same as the events SELECT in loadEventShell) —
 * this page is rendered for anonymous public visitors too, who have no RLS
 * session. The admin client is fine here: invitation_widgets rows carry no
 * PII + the only data the renderer cares about is is_visible + display_order
 * + widget_type. No row-level filter is applied on read — we render this
 * event's widgets only because we already constrained event_id below.
 */
export const loadWidgets = cache(
  async (admin: AdminClient, eventId: string): Promise<InvitationWidgetRow[]> => {
    const { data: widgetsRaw } = await admin
      .from('invitation_widgets')
      .select(
        'widget_id, event_id, widget_type, display_order, is_visible, is_always_on, tier, config_json, created_at, updated_at',
      )
      .eq('event_id', eventId);

    const widgets: InvitationWidgetRow[] = ((widgetsRaw ?? []) as Array<
      Omit<InvitationWidgetRow, 'widget_type'> & { widget_type: string }
    >)
      .filter((row): row is InvitationWidgetRow => isWidgetType(row.widget_type))
      .map((row) => row as InvitationWidgetRow);
    return widgets;
  },
);

/**
 * Hero / photos / monogram / Save-the-Date media resolution — everything the
 * page needs BEFORE the private gate (PrivateLanding consumes the monogram
 * quartet), shared verbatim by all render branches. Sequential awaits are
 * preserved exactly as the inline block ran them.
 */
export const loadMedia = cache(
  async (admin: AdminClient, event: EventShellRow): Promise<EventMedia> => {
    const monogram = resolveMonogram(event);

    // Paid ANIMATED_MONOGRAM upgrade (₱999 · "Your initials, drawn live").
    // When the event owns it, the monogram hero circle ANIMATES on load with
    // the couple's chosen Motion Library signature (lib/monogram-motion.ts ·
    // events.monogram_motion_key · NULL → 'draw') instead of rendering static.
    // Resolved once here via the admin client (this page renders for anonymous
    // visitors with no RLS session) + threaded into the hero render branches
    // below as `MonogramMotionKey | false` — false = static circle. Degrades to
    // `false` on any orders-table shape error — see lib/animated-monogram.ts.
    // The separate 0004 monogram_hero_upgrade widget path is untouched.
    const ownsAnimatedMonogram = await eventAnimatedMonogramActive(
      admin,
      event.event_id,
    );
    const animatedMonogram: MonogramMotionKey | false = ownsAnimatedMonogram
      ? resolveMonogramMotion(event.monogram_motion_key)
      : false;

    // Paid COUPLE_WEBSITE_PRO upgrade (retired/unbundled · the single website-Pro unlock).
    // V1 perk: when ACTIVE (admin-approved), the couple's wedding site sheds the
    // freemium "Powered by Setnayan · setnayan.com" footer watermark. Resolved
    // once here via the admin client (anonymous public path, no RLS session) and
    // threaded into every render branch as a plain boolean → the InvitationShell
    // footer drops the watermark line. Graceful-degrades to `false` (= keep the
    // watermark, the safe default) on any orders-table shape error — see
    // lib/couple-website-pro.ts. The free baseline website keeps the watermark.
    const proWatermarkHidden = await eventCoupleWebsiteProActive(admin, event.event_id);

    // Setnayan-AI bespoke monogram (Phase 2 of the monogram overhaul). When the
    // couple applied a bespoke mark (events.monogram_custom_svg — sanitized at
    // generation time, lib/bespoke-monogram-engine.ts), it REPLACES the
    // typographic circle on the hero. ANIMATED_MONOGRAM owners get a gentle
    // bloom-in entrance (glyph-level Motion Library signatures need letterform
    // strokes, so the bespoke mark uses the container-level entrance instead).
    // The couple's own UPLOAD outranks the AI/Cipher mark (owner rule 2026-06-15),
    // which outranks the lettered lockup — one effective mark feeds the hero.
    const bespokeSvg =
      (typeof event.monogram_uploaded_svg === 'string' && event.monogram_uploaded_svg.trim()
        ? event.monogram_uploaded_svg
        : null) ??
      (typeof event.monogram_custom_svg === 'string' && event.monogram_custom_svg
        ? event.monogram_custom_svg
        : null);

    // The reveal the couple designed in the Vector Studio "Animate the reveal" panel
    // (monogram_studio_config.anim) — the SOURCE for how the bespoke mark animates on
    // the hero + the Save-the-Date film (owner 2026-06-23 unification). Defaulted when
    // untuned; gated on ANIMATED_MONOGRAM ownership downstream (HeroMonogram).
    const studioCfg = sanitizeStudioConfig(event.monogram_studio_config);
    const studioAnim: StudioAnim =
      studioCfg?.anim
        ? { kind: studioCfg.anim.kind, dur: studioCfg.anim.dur, smooth: studioCfg.anim.smooth, delay: studioCfg.anim.delay }
        : DEFAULT_STUDIO_ANIM;

    // Resolve the hero photo's display URL up-front so it's available to both
    // PublicLanding (anonymous browsers) and InvitationSite (guest-cookie
    // visitors). Resolves to a presigned 24h GET URL when the host has uploaded
    // a photo via /dashboard/[eventId]/website/hero-photo (migration
    // 20260605020000); otherwise returns null and both renderers fall back to
    // the monogram-only hero.
    const heroPhotoUrl = await displayUrlForStoredAsset(
      event.landing_page_hero_image_url,
    );

    // Hero video + background music chrome (Increment B · §6.2). The video, when
    // present, plays full-bleed behind the monogram instead of the still photo
    // (the photo becomes its poster). Music resolves only when the couple has
    // both enabled it AND set a track. Both resolve to presigned 24h URLs here
    // and thread into the render paths like heroPhotoUrl.
    const heroVideoUrl = await displayUrlForStoredAsset(
      event.landing_page_hero_video_r2_key,
    );
    // The couple's song plays whenever they've ENABLED it + set a track
    // (events.site_bg_music_*). The Save-the-Date Music step sets both on upload.
    // (owner 2026-06-19: an uploaded song must just play — the old extra gate on
    // the redundant std_reveal_effects.music veil flag, which the veil canvas
    // ignores anyway, was blocking it even after upload.)
    const bgMusicUrl =
      event.site_bg_music_enabled && event.site_bg_music_r2_key
        ? await displayUrlForStoredAsset(event.site_bg_music_r2_key)
        : null;

    // Step-1 Save-the-Date background (events.std_background). Realistic → the
    // public scene src; upload → a presigned R2 url; plain/paper → no image.
    const stdBackground = resolveStdBackground(event.std_background);
    const stdBackgroundUrl =
      stdBackground.kind === 'realistic'
        ? realisticBgSrc(stdBackground.value)
        : stdBackground.kind === 'upload'
          ? // Serve a screen-sized WebP variant (cached in R2), not the couple's
            // full-resolution original — the full-bleed CSS background otherwise
            // streams multiple MB and loads slowly on phones. Falls back to the
            // original on any error. See lib/std-bg-image.
            await displayUrlForStdBackground(stdBackground.value)
          : null;

    // Step-3 Save-the-Date media (events.std_media). The couple's closing beat is
    // either their photo gallery (default) or an uploaded video. The video plays
    // on this PUBLIC page ONLY when NSFW-approved (stdVideoIsLive — the platform
    // lock); otherwise the gallery beat shows. PR-B (0024 · 2026-06-19).
    const stdMedia = resolveStdMedia(event.std_media);
    const stdVideoUrl =
      stdVideoIsLive(stdMedia) && stdMedia.videoKey
        ? await displayUrlForStoredAsset(stdMedia.videoKey)
        : null;
    // The video's poster frame (client-extracted on upload). Resolved ONLY in
    // "fit to screen" mode (std_media.fit === 'fit'), where the full-screen video
    // beat fills the letterbox bars with a BLURRED STILL of it — a 2nd <video> for
    // that backdrop won't play on iOS (one-video-at-a-time), so a static image is
    // the iOS-safe fill (owner 2026-06-21 "still black screens on top and bottom").
    // "fill" (the default) needs no poster: the clip plays object-cover, edge-to-edge.
    const stdVideoPosterUrl =
      stdVideoUrl && stdMedia.fit === 'fit' && stdMedia.posterKey
        ? await displayUrlForStoredAsset(stdMedia.posterKey)
        : null;

    // Save-the-Date ceremony + reception venues (0024 · 2026-06-19). AUTO-FILLED
    // from the couple's FINALIZED vendor bookings (event_vendors); the reception
    // falls back to the couple's manual builder entry (std_film_venue_*) then the
    // event's free-text venue. Ceremony = the finalized booking, else the couple's
    // manual ceremony venue (std_film_ceremony_name, owner 2026-06-19). The film
    // shows whichever venues resolved.
    const stdFinalizedVenues = await resolveStdFinalizedVenues(admin, event.event_id);
    const stdVenues = {
      ceremony:
        stdFinalizedVenues.ceremony ?? (event.std_film_ceremony_name as string | null) ?? null,
      reception:
        stdFinalizedVenues.reception ??
        (event.std_film_venue_name as string | null) ??
        event.venue_name,
      receptionCity: (event.std_film_venue_city as string | null) ?? event.venue_address,
    };

    // Resolve the couple-curated "Our photos" gallery (Increment A.4) to display
    // URLs up-front so both render paths share the result. events.our_photos is a
    // JSONB array of asset refs; empty/absent → empty array → OurPhotosWidget
    // renders nothing. Each ref goes through displayUrlForStoredAsset, which
    // presigns `r2://` refs AND passes plain http(s)/relative URLs through
    // unchanged — so seeded/legacy URLs (e.g. /demo/...) render too, matching how
    // the hero photo already tolerates legacy URLs.
    const ourPhotoRefs = Array.isArray(event.our_photos)
      ? event.our_photos.filter(
          (r): r is string => typeof r === 'string' && r.trim().length > 0,
        )
      : [];
    const ourPhotoUrls = (
      await Promise.all(ourPhotoRefs.map((ref) => displayUrlForStoredAsset(ref)))
    ).filter((u): u is string => Boolean(u));

    // The Save-the-Date's OWN media beats — background music, the closing video, and
    // the photo gallery — unlock with the Cinematic Reveal (STD_PREMIUM_OPENINGS ₱999 ·
    // owner 2026-07-10 "these 3 will unlock when they purchase the save the date
    // reveal"). Free STD = the text-only content film (monogram · names · date · venues
    // · sentiment · calendar); owning the Reveal lights up the couple's own music,
    // video, and photos. This gate is SCOPED TO THE STD FILM ONLY — the couple's full
    // website (later lifecycle phases) still shows their photos/music free.
    const ownsStdReveal = await eventStdOpeningsActive(admin, event.event_id);

    return {
      monogram,
      animatedMonogram,
      proWatermarkHidden,
      bespokeSvg,
      studioAnim,
      heroPhotoUrl,
      heroVideoUrl,
      bgMusicUrl,
      stdBackground,
      stdBackgroundUrl,
      stdVideoUrl,
      stdVideoPosterUrl,
      stdVenues,
      ourPhotoUrls,
      ownsStdReveal,
    };
  },
);

/**
 * Day-of layer — public schedule, the RSVP-era spatial backdrop, the live
 * window's Watch-Live + Live Photo Wall mirrors, and the anonymous event-day
 * chrome inputs. All branch on `dayOfPhase`, which the orchestrator computes
 * (it depends on the host `?phase=` preview gate) and passes in.
 *
 * (PR2 delta: the inline block built `backdrop` as a rendered
 * `<SpatialBackdrop/>` node — the loader returns the parsed CONFIG and the
 * orchestrator wraps it in JSX, preserving the same truthiness guard.)
 */
export const loadLiveLayer = cache(
  async (
    admin: AdminClient,
    event: EventShellRow,
    dayOfPhase: DayOfPhase,
  ): Promise<LiveLayerData> => {
    // Schedule blocks fetched here (hoisted from the InvitationSite-only
    // branch as of 2026-05-23) so PublicLanding can also render the
    // Schedule widget. fetchPublicScheduleBlocks already takes the admin
    // client + event_id and returns only the rows the host has marked
    // public — safe to show to anonymous visitors.
    const scheduleBlocks = await fetchPublicScheduleBlocks(
      admin,
      event.event_id,
      await isCoordinatorPrepReleaseEnabled(),
    );

    // Spatial backdrop (Wedding_Website_Effects_and_Editing_Spec_2026-06-11
    // §2.1b) — the AI-generated world behind the RSVP page. SEPARATE tolerant
    // read instead of a column on the main events select: on a DB where
    // migration 20261105000000 hasn't applied yet, an unknown column in the
    // MAIN select would error the whole fetch and 404 every wedding page —
    // here it just degrades to "no backdrop". RSVP-era only (pre/inactive):
    // the live day-of page stays lean for weak venue WiFi, and the post-event
    // page belongs to the editorial treatment.
    let backdropConfig: RsvpBackdropConfig | null = null;
    if (dayOfPhase === 'pre' || dayOfPhase === 'inactive') {
      const { data: backdropRow, error: backdropError } = await admin
        .from('events')
        .select('rsvp_backdrop')
        .eq('event_id', event.event_id)
        .maybeSingle();
      backdropConfig = backdropError
        ? null
        : parseRsvpBackdropConfig(
            (backdropRow as { rsvp_backdrop?: unknown } | null)?.rsvp_backdrop,
          );
    }

    // Live Photo Wall mirror (owner 2026-06-12: "photo wall live and the
    // gallery must be on the on-the-day part"). Only during the live window
    // (which the host phase-preview can force), only when the event owns
    // LIVE_WALL — the same activation door as /wall/[eventId]. Reads the SAME
    // screened feed the venue projector renders (wall-safe derivatives only),
    // capped to the newest dozen so a busy wall doesn't presign hundreds per
    // page view. Wall trouble must never break the wedding page → try/null.
    let liveWall: LiveWallData | null = null;
    // Panood Watch-Live (owner 2026-06-12: "panood … must be on the on-the-day
    // part") — when the couple staged their watch link (events.panood_watch_url,
    // migration 20261122000000), the live page leads with the broadcast for the
    // loved ones watching from afar. youtube-nocookie embed; the URL was
    // normalize-or-rejected at save time. Owner model 2026-06-26: single-cam
    // Panood live is FREE for any host, so the embed is NO LONGER gated on
    // PANOOD_SYSTEM — the presence of the watch URL is the only condition. The
    // PANOOD_SYSTEM SKU gates the PAID multi-camera control-room + broadcast
    // overlays upgrade (built at studio/panood/broadcast). (The LIVE_WALL gate
    // below is unchanged.)
    let watchLive: WatchLiveData | null = null;
    if (dayOfPhase === 'live') {
      try {
        // LIVE_WALL ownership reads off orders.status via eventOwnsSku() (PR4
        // dead-unlock repair, 2026-06-15) — bundle-aware, so a Media Pack buyer's
        // day-of page surfaces the wall mirror. The old
        // event_software_activations_v2 reads had no payment-path writer (their
        // only writer, verify_and_activate_manual_payment, has zero callers).
        const [ownsWall, watchRowRes] = await Promise.all([
          eventSkuActive(admin, event.event_id, 'LIVE_WALL'),
          admin
            .from('events')
            .select('panood_watch_url')
            .eq('event_id', event.event_id)
            .maybeSingle(),
        ]);
        if (ownsWall) {
          const snap = await getWallSnapshot(event.event_id, null, { limit: 12 });
          liveWall = {
            tiles: snap.tiles,
            count: snap.count,
            caption: snap.caption
              ? { text: snap.caption.text, author: snap.caption.author }
              : null,
          };
        }
        const watchUrl = watchRowRes.error
          ? null
          : ((watchRowRes.data as { panood_watch_url?: string | null } | null)
              ?.panood_watch_url ?? null);
        if (watchUrl) {
          const videoId = parseYouTubeVideoId(watchUrl);
          if (videoId) {
            watchLive = { embedUrl: youTubeEmbedUrl(videoId), watchUrl };
          }
        }
        // Live Studio ROAM (flag-dark, default OFF): when the couple owns a
        // multi-camera Roam broadcast, the public manifest (events.live_studio_roam_manifest,
        // mirrored non-secret) turns the single embed into a camera/zone picker. The
        // featured zone becomes the fallback embedUrl so every existing `watchLive`
        // gate keeps firing even for a Roam-only event (no CAST watch URL). When the
        // flag is off (prod default), this whole block is skipped and CAST behavior
        // is byte-for-byte unchanged. Graceful-degrades to [] pre-migration.
        if (liveStudioRoamEnabled()) {
          const roam = await fetchRoamManifest(admin, event.event_id);
          const featured = selectFeaturedZone(roam);
          if (featured) {
            try {
              watchLive = {
                embedUrl: youTubeEmbedUrl(featured.videoId),
                watchUrl: `https://www.youtube.com/watch?v=${featured.videoId}`,
                roam,
              };
            } catch {
              // invalid featured id — keep any CAST watchLive as-is
            }
          }
        }
      } catch {
        liveWall = null;
        watchLive = null;
      }
    }

    // Event-day chrome for the no-guest PublicLanding paths (owner 2026-06-28 —
    // unify the three event-day views so an anonymous open / host `?phase=event`
    // preview shares the same bottom bar a real guest sees). The candid camera
    // surfaces only during the live window when the couple's PAPIC_GUEST camera
    // is open; the public album points at the Live Photo Wall during the day and
    // the recap after. One cheap read, and only in the live window.
    const publicCandidCameraActive =
      dayOfPhase === 'live'
        ? await eventPapicGuestActive(admin, event.event_id)
        : false;
    // During the live window the Live Photo Wall is already mirrored INLINE on
    // this page (the #live-photo-wall section below), so "Photos" anchors to it —
    // NOT to `/[slug]/live-wall`, which is a JSON poll-feed route handler (the
    // LiveWallBlock's freshness endpoint), never a navigable page. After the day,
    // it points at the viewable recap album.
    const publicAlbumHref = liveWall
      ? `/${event.slug}#live-photo-wall`
      : dayOfPhase === 'post'
        ? `/${event.slug}/recap`
        : null;

    return {
      scheduleBlocks,
      backdropConfig,
      liveWall,
      watchLive,
      publicCandidCameraActive,
      publicAlbumHref,
    };
  },
);

/**
 * Guest-scoped context — THE ONLY loader that may select guest columns.
 *
 * Structurally unreachable without a verified guest session: the session is a
 * REQUIRED parameter (never read from cookies here — the orchestrator reads the
 * cookie via readGuestSession() and only calls this after its `!session` and
 * `session.event_id !== event.event_id` branches have already returned the
 * anonymous PublicLanding). The runtime guard below enforces the same invariant
 * defensively; it is unreachable through page.tsx.
 *
 * Returns a discriminated union so the orchestrator keeps its exact control
 * flow (and query behavior): `not_found` → PublicLanding reason="invalid_invite"
 * (no further guest reads run, as before); `unconfirmed_tba` → the /welcome
 * redirect (the redirect() itself stays in the orchestrator — a thrown redirect
 * must not be cached); `ready` → the full guest render context.
 */
export const loadGuestContext = cache(
  async (
    admin: AdminClient,
    event: EventShellRow,
    session: GuestSessionPayload,
    dayOfPhase: DayOfPhase,
    slug: string,
    scheduleBlocks: Awaited<ReturnType<typeof fetchPublicScheduleBlocks>>,
    // The couple's resolved mark (loadMedia's `monogram`) — the QR SVG centers
    // it. Threaded in (not re-resolved) so the QR uses the EXACT object the
    // hero renders with, as the inline block did.
    monogram: MonogramConfig,
  ): Promise<GuestContext> => {
    if (session.event_id !== event.event_id) {
      // Defensive invariant — the orchestrator's wrong-event branch returns
      // before this loader is ever called. Never reachable in page.tsx.
      throw new Error('loadGuestContext called with a session for another event');
    }

    const { data: guest } = await admin
      .from('guests')
      .select(
        'guest_id, first_name, last_name, display_name, role, side, group_category, plus_one_of_guest_id, plus_one_mode, plus_one_name_confirmed_at, rsvp_status, meal_preference, dietary_restrictions, notes, custom_tags, qr_token, photo_url, photo_source',
      )
      .eq('guest_id', session.guest_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (!guest) {
      return { kind: 'not_found' };
    }

    // TBA +1 still hasn't confirmed their name — re-route them to onboarding.
    const isUnconfirmedTba =
      guest.plus_one_of_guest_id !== null &&
      !guest.plus_one_name_confirmed_at &&
      (!guest.first_name || guest.first_name.toLowerCase() === 'tba');
    if (isUnconfirmedTba) {
      return { kind: 'unconfirmed_tba' };
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
    // Encode the guest's QR + shareable link at the canonical form — nested /u/
    // under the cutover flag, bare root otherwise (owner resolve self-noops OFF).
    const ownerSlug = await resolveEventOwnerSlug(admin, event.event_id);
    // Encode the DB-canonical slug (event.slug), not the raw URL param (matched
    // case-insensitively), so the QR + link match the canonical everywhere else.
    const canonicalSlug = event.slug ?? slug;
    const qrSvg = await renderInvitationQrSvg({
      appUrl,
      slug: canonicalSlug,
      qrToken: guest.qr_token,
      monogram,
      ownerSlug,
    });
    const invitationUrl = buildInvitationUrl({ appUrl, slug: canonicalSlug, qrToken: guest.qr_token, ownerSlug });

    // Papic guest camera (PAPIC_GUEST) — when the couple owns the pack, give the
    // cookie-bearing guest a floating "be a candid camera" CTA into /papic/guest.
    // Gated, admin read, graceful-degrade so the anonymous public path is untouched.
    const papicGuestActive = await eventPapicGuestActive(admin, event.event_id);

    // Papic LIMITED roll camera (owner 2026-06-26: "the custom QR of the guests
    // will automatically have their papic camera and gallery"). When this guest
    // has a live, PAID roll camera under the event's Limited snapshot, surface a
    // floating CTA into the guest-QR camera bridge (/papic/me/[qr_token]) — the
    // bridge resolves the seat + reuses the existing /papic/seat capture surface.
    // Only the 'ready' (paid + active) state lights the CTA; the bridge itself
    // shows the "payment under review" / not-ready states. Admin read, graceful.
    let guestRollCameraReady = false;
    if (guest.rsvp_status !== 'declined') {
      try {
        const cam = await resolveGuestCamera(admin, event.event_id, guest.guest_id);
        guestRollCameraReady = cam.status === 'ready';
      } catch {
        guestRollCameraReady = false;
      }
    }

    // Custom-QR seat pass (CUSTOM_QR_GUEST · seat-finding PR4) — when the couple
    // owns the branded-QR SKU, the cookie-bearing guest gets a "Your seat pass"
    // entry into /[slug]/seat (their exact seat + arrival bloom). Gated, admin
    // read, graceful-degrade; ADDITIVE alongside the find-my-table link (a
    // separate INDOOR_BLUEPRINT surface, left untouched). The pass route does its
    // own gating too, so this link only controls whether we advertise it here.
    const seatPassActive = await eventOwnsCustomQrGuest(admin, event.event_id);

    // Per-guest gallery (owner 2026-06-12: "the gallery must be on the on-the-day
    // part") — the photos THIS guest is tagged in. Shown through the LIVE window
    // AND the post-event grace (Invite/Join v2): a no-login guest keeps access
    // until ~24h after the wedding (dayOfPhase 'post') so they can download, then
    // it closes for them (account-holders keep theirs forever in the Collection
    // hub). Guest-session-scoped; clean-screened captures only.
    const guestLiveGallery =
      dayOfPhase === 'live' || dayOfPhase === 'post'
        ? await getGuestLiveGallery(event.event_id, guest.guest_id)
        : null;

    // "Register your face if you haven't yet" — day-of catch for a guest who
    // skipped the optional RSVP selfie. Shown across the WHOLE pre-event window
    // (not just the day) so guests enroll early — but only when this event has
    // candid capture (Papic guest camera or crew seats), the guest hasn't
    // declined, and they have NO active enrollment. Self-hides the moment they
    // add a selfie. Two cheap targeted reads, gated to skip work when irrelevant.
    let needsFaceEnroll = false;
    if (papicGuestActive || (await eventOwnsPapicSeats(admin, event.event_id))) {
      if (guest.rsvp_status !== 'declined') {
        const { data: liveEnrollment } = await admin
          .from('guest_face_enrollments')
          .select('id')
          .eq('event_id', event.event_id)
          .eq('guest_id', guest.guest_id)
          .is('revoked_at', null)
          .maybeSingle();
        needsFaceEnroll = !liveEnrollment;
      }
    }

    // Inline Papic guest camera (PAPIC_GUEST) — mount the SAME capture surface the
    // standalone /papic/guest route uses, but in-context on this guest's own
    // landing page so the camera auto-shows when the couple owns the paid pack (no
    // tap-out required). Gated on the active (admin-approved) entitlement +
    // guest-session identity. Resolve the same data the route does: the per-guest
    // 150-credit quota, the one-time UGC-terms flag, and the block short-circuit.
    // If the guest is blocked, mirror the route and DON'T mount the camera (the
    // floating CTA / route remains as the QR-scan fallback). Admin reads, all
    // gated so the anonymous public path never touches this.
    let papicGuest:
      | {
          initialRemaining: number;
          total: number;
          termsAccepted: boolean;
          guestUnlimited: boolean;
          eventStyle: PapicStyle;
          faceMode: PapicFaceMode;
        }
      | null = null;
    if (papicGuestActive) {
      const [quota, { data: ugcRow }, { data: blockRow }, { data: styleRow }] =
        await Promise.all([
          fetchGuestQuota(admin, event.event_id, guest.guest_id),
          admin
            .from('guests')
            .select('ugc_terms_accepted_at')
            .eq('guest_id', guest.guest_id)
            .maybeSingle(),
          admin
            .from('event_blocked_users')
            .select('id')
            .eq('event_id', event.event_id)
            .eq('blocked_guest_id', guest.guest_id)
            .maybeSingle(),
          // Locked event-wide Papic look + face-tag mode — defensive read so a
          // pre-migration DB (no papic_style / papic_face_mode column) falls back
          // to ORIG / mode_b instead of breaking.
          admin
            .from('events')
            .select('papic_style, papic_face_mode')
            .eq('event_id', event.event_id)
            .maybeSingle(),
        ]);
      if (!blockRow) {
        papicGuest = {
          initialRemaining: quota.remaining,
          total: quota.total,
          termsAccepted: Boolean(
            (ugcRow as { ugc_terms_accepted_at?: string | null } | null)
              ?.ugc_terms_accepted_at,
          ),
          guestUnlimited: quota.unlimited,
          eventStyle: asPapicStyle(
            (styleRow as { papic_style?: string } | null)?.papic_style,
          ),
          // Face-tag mode gate (One-Pool spec §3.4). Fail-closed to mode_b;
          // forced to mode_b for christening/debut via event.event_type.
          faceMode: resolveFaceMode(
            (styleRow as { papic_face_mode?: string | null } | null)?.papic_face_mode,
            event.event_type,
          ),
        };
      }
    }

    // Pabati video guestbook (PABATI) — auto-show the in-context guest recorder on
    // this guest's own landing page when the couple owns the active (admin-
    // approved, bundle-aware) pack. Gated on eventPabatiActive; the per-EVENT
    // 300-clip quota drives the "N greetings left" display (the RPC is the real
    // gate). Admin read, graceful so the anonymous public path is never touched.
    const pabatiActive = await eventPabatiActive(admin, event.event_id);
    let pabati: { initialRemaining: number; total: number } | null = null;
    if (pabatiActive) {
      const quota = await fetchPabatiQuota(admin, event.event_id);
      pabati = { initialRemaining: quota.remaining, total: quota.total };
    }

    // Guest Hub Card — seat assignment for THIS guest only (one targeted query;
    // the hub card needs the table label without loading the full floor plan).
    // Graceful-degrade: if the join fails or no assignment exists, tableLabel
    // stays null and the card shows "Not yet assigned" — safe for every event
    // regardless of whether the seating editor has been used.
    let guestTableLabel: string | null = null;
    let guestTableId: string | null = null;
    try {
      const { data: assignmentRow } = await admin
        .from('event_seat_assignments')
        .select('table_id')
        .eq('event_id', event.event_id)
        .eq('guest_id', guest.guest_id)
        .maybeSingle();
      if (assignmentRow?.table_id) {
        guestTableId = assignmentRow.table_id as string;
        const { data: tableRow } = await admin
          .from('event_tables')
          .select('table_label, link_group_label')
          .eq('table_id', assignmentRow.table_id)
          .maybeSingle();
        if (tableRow) {
          // Prefer the linked group label (e.g. "VIP Section") over the
          // individual table label when the table is part of a linked unit.
          guestTableLabel =
            (tableRow as { table_label: string; link_group_label?: string | null })
              .link_group_label ??
            (tableRow as { table_label: string }).table_label;
        }
      }
    } catch {
      // Graceful degrade — seating tables may not exist yet on all installs.
      guestTableLabel = null;
      guestTableId = null;
    }

    // Day-of arrival — has THIS guest scanned in at the door yet? A row in
    // guest_checkins (written by the coordinator/kiosk check-in desk) is the
    // signal. We only bother during the live/post window: before the wedding day
    // there is nothing to arrive at, and the read would just be noise. When the
    // guest has checked in, their seat surface (the GuestHubCard seat tile + the
    // inline YourSeatBlock) blooms into a warm personal greeting instead of the
    // neutral "here's your table" copy — closing the check-in → day-of-experience
    // gap (until now check-in only fed the planner's "arrived" counter).
    //
    // Graceful-degrade: the table may not exist (42P01) or lack a column (42703)
    // on installs that pre-date the check-in desk migration — fall back to the
    // normal pre-arrival seat pass rather than failing the page.
    let guestArrived = false;
    if (dayOfPhase === 'live' || dayOfPhase === 'post') {
      try {
        const { data: checkinRow, error: checkinErr } = await admin
          .from('guest_checkins')
          .select('checked_in_at')
          .eq('event_id', event.event_id)
          .eq('guest_id', guest.guest_id)
          .maybeSingle();
        if (checkinErr) {
          if (checkinErr.code !== '42P01' && checkinErr.code !== '42703') {
            // Unexpected error — degrade quietly (no bloom) but don't crash.
            guestArrived = false;
          }
        } else {
          guestArrived = Boolean(checkinRow?.checked_in_at);
        }
      } catch {
        guestArrived = false;
      }
    }

    const guestHubData: GuestHubData = {
      firstName: guest.first_name,
      displayName:
        (guest.display_name ?? '').trim() ||
        `${guest.first_name} ${guest.last_name}`.trim(),
      rsvpStatus: guest.rsvp_status,
      tableLabel: guestTableLabel,
      mealPreference: guest.meal_preference,
      dietaryRestrictions: guest.dietary_restrictions,
      // "Coming up" follows the host-set run-of-show pointer when the trigger
      // flag is on (owner directive 2026-07-23); wall-clock inference otherwise.
      nextScheduleBlock: pickNextScheduleBlock(scheduleBlocks, {
        preferRunState: isGuestNowTriggerEnabled(),
      }),
      slug,
      isLimitedPlusOne:
        guest.plus_one_of_guest_id !== null && guest.plus_one_mode === 'limited',
      arrived: guestArrived,
    };

    // "Your seat" inline map — surface the entrance→table wayfinding map on the
    // event website itself whenever the guest is seated. Indoor Blueprint is FREE
    // (owner 2026-07-23: "indoor blueprint is free and uses the 2D Plan for
    // free"), so there is no paid gate — the map rides on the free 2D seat plan.
    // The empty-chart case still shows nothing (seatTables.length > 0 guard).
    let seatMap:
      | { tables: EventTableRow[]; entrance: EntrancePos; targetTableId: string }
      | null = null;
    if (guestTableId && guestTableLabel) {
      try {
        const [seatTables, seatEntrance] = await Promise.all([
          fetchTables(admin, event.event_id),
          fetchEntrance(admin, event.event_id),
        ]);
        if (seatTables.length > 0) {
          seatMap = { tables: seatTables, entrance: seatEntrance, targetTableId: guestTableId };
        }
      } catch {
        seatMap = null;
      }
    }

    // Invite/Join v2 — "vendors who made this day": the couple's booked marketplace
    // vendors, savable to a guest's own account for their future planning. Read
    // server-side (a guest can't read event_vendors under RLS).
    const eventVendorCredits = await fetchEventVendorCredits(event.event_id);

    // Effective face-tag mode for the RSVP selfie + day-of enroll surfaces on this
    // page (One-Pool spec §3.4). Resolved server-side via the same helper the
    // capture gates use — christening/debut forced to mode_b, fail-closed to
    // mode_b on a pre-migration DB. Threaded into SelfieCapture so a mode_b guest
    // never has a descriptor computed; the enroll actions null any vector anyway.
    const rsvpFaceMode = await resolvePapicFaceMode(admin, event.event_id);

    return {
      kind: 'ready',
      guest,
      qrSvg,
      invitationUrl,
      papicGuestActive,
      guestRollCameraReady,
      seatPassActive,
      guestLiveGallery,
      needsFaceEnroll,
      papicGuest,
      pabati,
      guestHubData,
      seatMap,
      rsvpFaceMode,
      eventVendorCredits,
    };
  },
);
