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
import { resolveAlbumDoor } from './album-door.server';
import { HOST_MEMBER_TYPES } from './host-scope';
import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveMonogram } from '@/lib/monogram';
import { eventAnimatedMonogramActive } from '@/lib/animated-monogram';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { buildCustomSiteColorVars } from '@/lib/site-palette';
import { eventPapicGuestActive, fetchGuestQuota } from '@/lib/papic-guest';
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';
import { asPapicStyle, type PapicStyle } from '@/lib/papic-photo-styles';
import { resolveFaceMode, resolvePapicFaceMode, type PapicFaceMode } from '@/lib/papic-face-mode';
import { resolveGuestCamera } from '@/lib/papic-limited';
import { eventOwnsCustomQrGuest, eventSeatingPublished } from '@/lib/seat-pass';
import { resolveProfile, surfaceEnabled } from '@/lib/event-type-profile';
import { fetchEgiftMethods, isPabuyaPublicRouteEnabled } from '@/lib/egift';
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
import { heroVideoRefForGuests } from '@/lib/guest-hero-video';
import { resolveStdMedia, stdVideoNeedsGrandfatherHeal } from '@/lib/std-media';
import { loadStdNsfwVerdict, stdVideoServeUrls } from '@/lib/std-video-gate';
import { resolveStdFinalizedVenues } from '@/lib/std-venues';
import { eventStdOpeningsActive } from '@/lib/std-openings';
import { parseRsvpBackdropConfig, type RsvpBackdropConfig } from '@/lib/spatial-backdrop';
import { getWallSnapshot, guestWallMirrorActive } from '@/lib/live-wall';
import { getGuestLiveGallery } from '@/lib/guest-live-gallery';
import { fetchEventVendorCredits } from '@/lib/event-vendor-credits';
import { youTubeEmbedUrl } from '@/lib/panood-watch';
import { readEventWatchUrls, resolveWatchLinks } from '@/lib/watch-live-links';
import {
  applyGuestPick,
  fetchRoamViewerState,
  liveStudioRoamEnabled,
  selectFeaturedZone,
} from '@/lib/live-studio-roam';
import { canPublishMultiCam, limitPublishedManifest } from '@/lib/live-studio-publish';
import { fetchGuestPickCameras, shouldOfferGuestPick } from '@/lib/live-studio-guest-pick';
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
  GuestPapicCamera,
  LiveLayerData,
  LiveWallData,
  WatchLiveData,
} from './types';
import { resolveEventMonogramSvg } from '@/lib/monogram-svg-safe';

/** The service-role Supabase client the orchestrator creates once per request
 *  and threads into every loader — a stable per-request reference, so it is a
 *  well-behaved `React.cache` key component. */
type AdminClient = ReturnType<typeof createAdminClient>;

// Soft-404 fix (SEO). ANY streaming boundary on this route commits an HTTP 200
// BEFORE the page body runs, so a notFound() thrown in the body renders the 404
// UI while the status stays 200 — a Google soft-404, and every junk top-level
// URL an indexable 200. generateMetadata resolves before the stream starts on
// Next 15.1, so the slug lookup happens HERE: a miss throws notFound()
// pre-stream and the response is a real 404. React cache() dedupes the read —
// the page body reuses the same single DB roundtrip.
//
// ⚠ THIS COMMENT USED TO SAY "this route has a loading.tsx". It does not — that
// file was deleted by 04c03063d for exactly the reason above, and the sentence
// then sat here for months describing the opposite of what the code does. The
// rule it was protecting is real and still binding: NO route-level loading.tsx
// at `[slug]/` or `[slug]/hub/`. The blank-white-screen fix (2026-08-05) is a
// `<Suspense>` INSIDE page.tsx, placed AFTER every notFound()/redirect, so the
// status is settled before the first flush and this stays true.
//
// (PR2 note: this is page.tsx's `fetchEventBySlug`, re-homed as the event-shell
// loader. It creates its OWN admin client so the cache key stays the slug alone
// — generateMetadata and the page body must keep sharing one DB roundtrip; an
// admin-client parameter would fork the key per call site.)
export const loadEventShell = cache(async (slug: string) => {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('events')
    .select(
      'event_id, public_id, display_name, event_date, event_end_date, cleared_at, venue_name, venue_address, venue_latitude, venue_longitude, event_type, ceremony_type, secondary_ceremony_type, gender_separation, slug, monogram_text, monogram_color, monogram_style, monogram_font_key, monogram_frame_key, monogram_motion_key, monogram_custom_svg, monogram_uploaded_svg, monogram_studio_config, photo_moments_config, landing_page_visibility, scheduled_launch_at, dress_code_config, landing_page_hero_image_url, special_message, what_to_bring, our_photos, landing_page_hero_video_r2_key, site_bg_music_enabled, site_bg_music_r2_key, role_palette, site_art_direction, site_bg_color, site_button_color, love_story, wax_seal_config, std_reveal_template, std_reveal_effects, std_invitation_launch_date, std_theme, std_background, std_media, std_film_venue_name, std_film_venue_city, std_film_ceremony_name, std_film_accent_hex, is_sample, live_media_public, website_open_browse, guest_list_edit_deadline, guest_count_locked_at',
    )
    .ilike('slug', slug)
    .maybeSingle();
  // A FAILED READ IS NOT A MISSING EVENT (2026-08-05).
  //
  // The error used to be discarded, so a database hiccup returned `data = null`
  // — indistinguishable from "no event has this slug". Every caller reads that
  // as a miss and calls notFound(), which tells a guest standing at the venue
  // that their invitation link is wrong, offers them a sign-in button for a
  // site that is working fine, and tells Google the page does not exist.
  //
  // Throwing routes to the route's error boundary instead, which says "having
  // trouble loading, try again" and offers a retry. The distinction only ever
  // matters when something is already broken, which is exactly when a guest
  // most needs to be told the truth about which thing broke.
  if (error) {
    throw new Error(`loadEventShell: could not read the event for "${slug}": ${error.message}`);
  }
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
/**
 * Host-membership check for THIS event.
 *
 * 🔴 It used to select `member_type` and NEVER COMPARE IT, returning
 * `Boolean(memberRow)` — and `event_members` is the event's people table, not a
 * host table, so a guest who scanned the event QR counted as a host. See
 * `host-scope.ts` for the full note and the shared definition.
 */

/**
 * Is this viewer one of the COUPLE on this event?
 *
 * The narrow twin of `loadHostMembership`, and deliberately the exact question
 * `app/dashboard/[eventId]/website/editor/page.tsx` asks before it redirects:
 * `event_members.member_type = 'couple'`. Two copies of a rule is how the
 * ribbon and the editor came to disagree about the same person in the first
 * place, so this reads the same column with the same value rather than
 * inventing a second notion of "can edit".
 *
 * ⚖ It grants NOTHING. It is only ever consulted after host membership has
 * already been confirmed, and its answer can only remove the edit doorway from
 * the ribbon. The editor's own gate stays the boundary.
 *
 * Cached per (event, user) like its sibling, so a host who triggers both pays
 * one extra query for the whole render.
 */
export const loadCoupleMembership = cache(
  async (admin: AdminClient, eventId: string, userId: string): Promise<boolean> => {
    const { data } = await admin
      .from('event_members')
      .select('member_type')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .eq('member_type', 'couple')
      .maybeSingle();
    return Boolean(data);
  },
);

export const loadHostMembership = cache(
  async (admin: AdminClient, eventId: string, userId: string): Promise<boolean> => {
    const [{ data: memberRow }, { data: moderatorRow }] = await Promise.all([
      admin
        .from('event_members')
        .select('member_type')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .in('member_type', [...HOST_MEMBER_TYPES])
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
 * ⛔ `loadVendorBooking` USED TO LIVE HERE AND HAS MOVED to
 * `lib/booked-supplier.ts`. Do not add it back: three surfaces need it — this
 * route's lock screen, its supplier doorway and `/{slug}/print` — and this
 * module's own header says its loaders must not be imported from other routes.
 * Two of the three had drifted into asking whether a LINK existed rather than
 * whether the couple had BOOKED anybody, which admits a 'shortlisted' reuse row
 * the couple has not locked. It is one read and one predicate now, and it is
 * still React.cache'd — keyed on (eventId, userId) rather than on a client
 * instance, so every surface in one request shares the single query.
 */

/**
 * Day-of announcements for the GUEST side.
 *
 * ── THE HALF THAT WAS MISSING ───────────────────────────────────────────────
 * The composer has shipped for months: `coordinator-broadcast-card.tsx` on the
 * couple's day-of screen writes `coordinator_broadcasts`, the Data Privacy
 * control `coordinator_day_of_broadcast` is ACTIVE in production, and the table
 * is live. But nothing on the guest site ever read it — every "broadcast" under
 * app/[slug] is the Panood LIVESTREAM, not an announcement. So a coordinator
 * could write "phones down, the ceremony is starting" and only the couple's own
 * dashboard would show it. This is the receiver.
 *
 * LIVE WINDOW ONLY. An announcement is a thing shouted across a room; it has no
 * meaning the week before or the month after. The caller passes the resolved
 * day-of phase and this returns nothing outside it, so a stale "we are running
 * late" cannot haunt the page forever.
 *
 * ONE, NOT A FEED. The guest gets the latest only. A scrollback of operational
 * chatter is the coordinator's business, not a guest's — and a feed on the
 * event page would compete with the couple's own words.
 *
 * Admin client for the same reason as the widget registry above: this page
 * renders for visitors with no RLS session. The read is scoped to one event and
 * returns nothing but the announcement text and when it was sent.
 */
export const loadDayOfBroadcast = cache(
  async (
    admin: AdminClient,
    eventId: string,
    isLive: boolean,
  ): Promise<{ body: string; createdAt: string } | null> => {
    if (!isLive) return null;
    const { data, error } = await admin
      .from('coordinator_broadcasts')
      .select('body, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    // Best-effort, exactly like fetchLatestBroadcasts: a missing relation or a
    // read error must never take the wedding page down on the day.
    if (error || !data) return null;
    const row = data as { body: string; created_at: string };
    const body = row.body?.trim();
    if (!body) return null;
    return { body, createdAt: row.created_at };
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
    const { data: widgetsRaw, error } = await admin
      .from('invitation_widgets')
      .select(
        'widget_id, event_id, widget_type, display_order, is_visible, is_always_on, tier, config_json, created_at, updated_at, mode, audience',
      )
      .eq('event_id', eventId);

    // AN EMPTY WIDGET LIST IS NOT A THINNER PAGE — IT IS A BLANK ONE.
    //
    // `widgetShouldRender(null)` is FALSE, so a missing row does not hide one
    // section, it hides the section. With no rows at all, `heroShouldRender`,
    // `greetingShouldRender`, `qrCardShouldRender` and the RSVP gate ALL go
    // false together: the couple's names and date, the welcome line, the
    // guest's own entry QR and the RSVP form vanish in one go, with nothing on
    // screen saying anything went wrong. The guest concludes the couple never
    // filled their invitation in.
    //
    // And that state is not reachable any other way: **every event in
    // production has exactly 16 widget rows, 4 of them always-on** — they are
    // seeded at creation, so an empty list can only mean the read failed. The
    // error used to be discarded, which turned a one-second database hiccup
    // into an invitation that looked abandoned.
    //
    // Throwing hands it to app/[slug]/error.tsx, which tells the guest their
    // link is fine and offers a retry — the honest answer, and a recoverable
    // one, where a blank page is neither.
    if (error) {
      throw new Error(`loadWidgets: could not read the invitation for ${eventId}: ${error.message}`);
    }

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

    // Website Pro net-new manual site colours (Launch settings §4.4 · PR-C).
    // The couple's chosen background + button colours (events.site_bg_color /
    // site_button_color) override the Mood-Board palette tokens on the guest
    // site — but ONLY when the event owns ACTIVE Website Pro (same gate as the
    // watermark). Reuses the boolean already resolved above (no extra roundtrip).
    // buildCustomSiteColorVars returns null when both columns are NULL, so a
    // non-Pro OR unset event yields `siteColorVars = null` → InvitationShell adds
    // no override → the page renders byte-identically to today (inert contract).
    const siteColorVars = proWatermarkHidden
      ? buildCustomSiteColorVars(
          event.site_bg_color as string | null,
          event.site_button_color as string | null,
        )
      : null;

    // Setnayan-AI bespoke monogram (Phase 2 of the monogram overhaul). When the
    // couple applied a bespoke mark (events.monogram_custom_svg — sanitized at
    // generation time, lib/bespoke-monogram-engine.ts), it REPLACES the
    // typographic circle on the hero. ANIMATED_MONOGRAM owners get a gentle
    // bloom-in entrance (glyph-level Motion Library signatures need letterform
    // strokes, so the bespoke mark uses the container-level entrance instead).
    // The couple's own UPLOAD outranks the AI/Cipher mark (owner rule 2026-06-15),
    // which outranks the lettered lockup — one effective mark feeds the hero.
    // SEC-3: gated on read — events.monogram_* are host-writable via PostgREST.
    const bespokeSvg = resolveEventMonogramSvg(event);

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
    //
    // SEC-6 (D16): the hero video is a couple-uploaded clip that NOTHING screens
    // — no poster, no verdict, no gate — so it does not reach a guest until it
    // goes through the same screen-and-seal spine as std_media. The still photo
    // (already its poster) shows instead. See lib/guest-hero-video.ts.
    const heroVideoUrl = await displayUrlForStoredAsset(
      heroVideoRefForGuests(event.landing_page_hero_video_r2_key),
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
    // either their photo gallery (default) or an uploaded video.
    //
    // SEC-6 — ONE function decides AND emits. `stdVideoServeUrls` resolves the
    // row strictly (a ref that is not this event's own r2:// upload is not a
    // video), requires an `approved` verdict from the host-unwritable
    // events.std_media_nsfw column, and then presigns the SEALED copies the
    // screen made of the bytes it classified — never `std_media.videoKey`.
    //
    // That last part is the round-two fix. `displayUrlForStoredAsset` returns any
    // non-`r2://` value VERBATIM as a URL, so calling it with a host-writable ref
    // let a URL-shaped R2 key ("http:/evil.example/…") be fingerprinted as an
    // object here and resolved as a foreign origin by the browser. Nothing on
    // this path may pass std_media through that helper again.
    //
    // The verdict is read in its OWN query (loadStdNsfwVerdict) so a deploy that
    // lands ahead of the migration degrades to "gallery beat", not a 404.
    const stdMedia = resolveStdMedia(event.std_media, event.event_id);
    const stdVerdict =
      stdMedia.type === 'video' ? await loadStdNsfwVerdict(admin, event.event_id) : null;
    const stdServe =
      stdMedia.type === 'video' && stdVerdict
        ? await stdVideoServeUrls(stdMedia, stdVerdict, event.event_id)
        : null;
    /**
     * CUTOVER HEAL — the narrowest possible public-path trigger, and a decaying
     * one.
     *
     * The SEC-6 migration carries the one already-serving production video
     * across as approved, but SQL cannot HEAD an R2 object, so it cannot know a
     * fingerprint and cannot write the sealed refs the serve path requires. The
     * marker row therefore lands NOT serving (fail-closed by construction) and
     * needs one pass of the screen to fingerprint, classify the poster and seal.
     *
     * Every other heal in this feature fires from a dashboard, which would mean
     * a real couple's live page sits on their photo gallery until somebody logs
     * in. `stdVideoNeedsGrandfatherHeal` is true ONLY for a row carrying the
     * service-role marker that is not yet serving, so this fires for exactly one
     * row in the world, at most once per throttle window, and never again once
     * that row is sealed. It runs in after(), so it costs this response nothing.
     */
    if (
      stdMedia.type === 'video' &&
      stdVerdict &&
      stdVideoNeedsGrandfatherHeal(stdMedia, stdVerdict, event.event_id) &&
      stdMedia.videoKey &&
      stdMedia.posterKey
    ) {
      const healEventId = event.event_id as string;
      const videoKey = stdMedia.videoKey;
      const posterR2Key = stdMedia.posterKey;
      after(async () => {
        const { screenStdVideo } = await import('@/lib/nsfw-screen');
        await screenStdVideo({ eventId: healEventId, videoKey, posterR2Key }).catch(() => {});
      });
    }
    const stdVideoUrl = stdServe?.videoUrl ?? null;
    // The video's poster frame (client-extracted on upload, then sealed with it).
    // Resolved ONLY in "fit to screen" mode (std_media.fit === 'fit'), where the
    // full-screen video beat fills the letterbox bars with a BLURRED STILL of it
    // — a 2nd <video> for that backdrop won't play on iOS (one-video-at-a-time),
    // so a static image is the iOS-safe fill (owner 2026-06-21 "still black
    // screens on top and bottom"). "fill" (the default) needs no poster.
    const stdVideoPosterUrl = stdServe && stdMedia.fit === 'fit' ? stdServe.posterUrl : null;

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
      siteColorVars,
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
    // ⭐ THE PLAYER FOLLOWS THE BROADCAST, NOT THE CALENDAR (owner-ruled
    // 2026-09-02). `dayOfPhase` is pure calendar arithmetic — event date,
    // timezone, now — and knows nothing about whether a broadcast is actually
    // running. A stream genuinely on air was hidden from guests whenever the
    // date said it wasn't the day, which is exactly backwards for a couple
    // testing their setup, or streaming an event on a date the record hasn't
    // caught up to.
    //
    // SAFE WITHOUT NEW STATE: `endPanoodBroadcast` already clears
    // `panood_watch_url` the moment the host stops. A set watch URL therefore
    // already means "on air right now" and self-clears when the broadcast
    // ends — no calendar gate is needed to keep this trustworthy. Resolved on
    // EVERY render, regardless of phase.
    //
    // The Roam side-camera manifest follows the SAME rule and the same
    // reasoning: `limitPublishedManifest` already reduces an un-entitled event
    // to one camera, so a free single-cam host gets their stream and nothing
    // more — the paywall below is unchanged, not a new gate added here.
    //
    // ⛔ NOTHING ELSE FOLLOWS. The Live Photo Wall mirror below keeps its
    // original live-window rule — it is on-the-day chrome about BEING AT the
    // event, not about being on air.
    try {
      const watchUrls = await readEventWatchUrls(admin, event.event_id);
      // DUAL-STREAM (owner-approved 2026-07-26). resolveWatchLinks re-validates
      // BOTH stored URLs on every render — `events` UPDATE RLS is ROW-level and
      // the anon key is public, so a forged value must degrade to "no link"
      // rather than reach an iframe src or an href. Returns null when neither
      // side is usable, which is byte-for-byte the old behaviour.
      watchLive = resolveWatchLinks(watchUrls);
      // Live Studio ROAM (flag-dark, default OFF): when the couple owns a
      // multi-camera Roam broadcast, the public manifest (events.live_studio_roam_manifest,
      // mirrored non-secret) turns the single embed into a camera/zone picker. The
      // featured zone becomes the fallback embedUrl so every existing `watchLive`
      // gate keeps firing even for a Roam-only event (no CAST watch URL). When the
      // flag is off (prod default), this whole block is skipped and CAST behavior
      // is byte-for-byte unchanged. Graceful-degrades to [] pre-migration.
      if (liveStudioRoamEnabled()) {
        // GUEST-PICK (Wave 2, owner-locked): the host's switch is honored HERE, by
        // omission. Off → applyGuestPick reduces the manifest to the single channel
        // Channel 1 is carrying, so the other channels' video ids are never sent to
        // the browser and the picker's `length > 1` guard hides itself. Hiding the
        // buttons while shipping the ids would only look like enforcement.
        const { manifest, guestPickEnabled } = await fetchRoamViewerState(admin, event.event_id);

        // ⭐ THE PAYWALL, SECOND INDEPENDENT ENFORCEMENT (owner-locked 2026-07-25
        // · § 4d "rehearse free, pay to broadcast"). The write gate lives in
        // mirrorRoamManifest; this is the READ gate, and it exists because
        // SETTINGS PERSIST WHILE PERMISSION DOES NOT. An entitlement that lapses,
        // is refunded or is revoked after the mirror ran would otherwise leave a
        // fully published multi-cam stream up until something happened to rewrite
        // the column. Re-asking here means a free event is reduced to one channel
        // on EVERY render — same posture as resolveOverlays re-asking on every
        // frame of the program surface.
        //
        // ⚠ DO NOT DELETE THIS AS "REDUNDANT WITH THE WRITE GATE". `events` UPDATE
        // RLS is ROW-level (couple_can_update_event), so a host can PATCH
        // live_studio_roam_manifest straight through PostgREST with the public anon
        // key, bypassing every server action. This read is what makes that
        // pointless. See lib/live-studio-publish.ts for the full threat note.
        //
        // ADMIN client on purpose: `orders` RLS is purchaser-scoped, so the
        // anon/session client would read "not owned" for a couple who genuinely
        // paid and strip their multi-cam mid-wedding. Fail-closed inside
        // canPublishMultiCam; the lookup is skipped entirely for a
        // zero-or-one-channel (free single-cam) manifest, so the free path pays
        // nothing for the gate.
        // ⭐ ONE ANSWER, TWO CONSUMERS. Resolve the entitlement ONCE and let both the
        // YouTube manifest and the Wave 10 side-camera roster read the same boolean.
        // The zero-or-one-channel shortcut is preserved for the free single-cam path
        // — but a free event with side cameras must still be asked, or guest-pick
        // would be the one paid capability you could get without paying.
        const needsEntitlement = manifest.length > 1 || guestPickEnabled;
        const multiCamOwned = needsEntitlement
          ? await canPublishMultiCam(admin, event.event_id)
          : true;

        const publishable = limitPublishedManifest(manifest, multiCamOwned);
        const roam = applyGuestPick(publishable, guestPickEnabled);

        // WAVE 10 · GUEST-PICK AT ₱0 — side cameras served peer-to-peer from the
        // operator's phone. Deliberately NOT part of the manifest: they have no
        // YouTube id (they are never broadcast), and parseRoamManifest drops
        // idless entries by design.
        //
        // Three gates, all of which must pass, and all of which already exist:
        //   • guestPickEnabled — the host's own switch (Wave 2)
        //   • multiCamOwned    — THE paywall, the same helper that reduced the
        //                        manifest one line above (§ 4d). Not a second rule.
        //   • a camera that is live, claimed AND still beating on the zone
        //     (inside fetchGuestPickCameras, via the controller's own
        //     resolveChannelStatus — a stored 'live' is not liveness)
        // Enforced by OMISSION, matching the manifest: a guest whose event fails any
        // gate is never told a side camera exists, so nothing on their page can open
        // a connection to one.
        const guestCameras = shouldOfferGuestPick({
          // Already inside `if (liveStudioRoamEnabled())`; passed explicitly so the
          // gate reads as the complete rule rather than a partial one.
          flagEnabled: true,
          guestPickEnabled,
          multiCamOwned,
        })
          ? await fetchGuestPickCameras(admin, event.event_id)
          : [];

        const featured = selectFeaturedZone(roam);
        if (featured) {
          try {
            watchLive = {
              embedUrl: youTubeEmbedUrl(featured.videoId),
              watchUrl: `https://www.youtube.com/watch?v=${featured.videoId}`,
              roam,
              // Carried through deliberately: a couple who published a Facebook
              // link AND owns Roam must not lose the Facebook door just because
              // the picker replaced the single embed.
              facebookUrl: watchLive?.facebookUrl ?? null,
            };
          } catch {
            // invalid featured id — keep any CAST watchLive as-is
          }
        }

        // Attach the side cameras to whatever director's cut we ended up with —
        // the Roam featured zone above, or the plain CAST embed resolved earlier.
        // ⚠ ONLY when one exists: guest-pick's entire failure story is "fall back to
        // the director's cut", so offering side cameras with nothing to fall back to
        // would build the one broken state this wave is meant to avoid.
        if (watchLive && guestCameras.length > 0) {
          watchLive = { ...watchLive, guestCameras, eventId: event.event_id };
        }
      }
    } catch {
      watchLive = null;
    }
    const broadcastPlanned = watchLive !== null;

    // Live Photo Wall mirror (owner 2026-06-12: "photo wall live and the
    // gallery must be on the on-the-day part"). Only during the live window
    // (which the host phase-preview can force), only when the event owns
    // LIVE_WALL — the same activation door as /wall/[eventId]. Reads the SAME
    // screened feed the venue projector renders (wall-safe derivatives only),
    // capped to the newest dozen so a busy wall doesn't presign hundreds per
    // page view. Wall trouble must never break the wedding page → try/null.
    //
    // Kept on the calendar rule while the player above is not: this is
    // on-the-day chrome about BEING AT the event, not about a broadcast being
    // on air.
    if (dayOfPhase === 'live') {
      try {
        // LIVE_WALL ownership reads off orders.status via eventOwnsSku() (PR4
        // dead-unlock repair, 2026-06-15) — bundle-aware, so a Media Pack buyer's
        // day-of page surfaces the wall mirror. The old
        // event_software_activations_v2 reads had no payment-path writer (their
        // only writer, verify_and_activate_manual_payment, has zero callers).
        // guestWallMirrorActive fuses that ownership check with the couple's
        // own answer to "does the wall also play on my guests' phones?" — the
        // question this surface asked for nine months without ever reading the
        // setting that was built to answer it.
        const mirrorOn = await guestWallMirrorActive(admin, event.event_id);
        if (mirrorOn) {
          const snap = await getWallSnapshot(event.event_id, null, { limit: 12 });
          liveWall = {
            tiles: snap.tiles,
            count: snap.count,
            caption: snap.caption
              ? { text: snap.caption.text, author: snap.caption.author }
              : null,
            challenge: snap.challenge,
            challengeMeasured: snap.challengeMeasured,
          };
        }
      } catch {
        liveWall = null;
      }
    }

    // Event-day chrome for the no-guest PublicLanding paths (owner 2026-06-28 —
    // unify the three event-day views so an anonymous open / host `?phase=event`
    // preview shares the same bottom bar a real guest sees). The candid camera
    // surfaces only during the live window when the couple's PAPIC_GUEST camera
    // is open; the public album points at the Live Photo Wall during the day and
    // the recap after. One cheap read, and only in the live window.
    // THE HOST'S SWITCH, asked unconditionally.
    //
    // Owner, 2026-08-03: "the papic service will always run but the host of the
    // event has the power to allow use and not allow use." So the gate is the
    // SWITCH, not the calendar — and the menu's camera slot needs to know the
    // switch's real state on every day, not just the wedding day, so it can be
    // drawn LOCKED with an honest reason rather than silently vanishing.
    const hostCameraOpen = await eventPapicGuestActive(admin, event.event_id);
    // The day-of BAR keeps its original live-window rule: that surface is the
    // on-the-day chrome and has no meaning before it. Only the menu slot follows
    // the switch alone.
    const publicCandidCameraActive = dayOfPhase === 'live' ? hostCameraOpen : false;
    // During the live window the Live Photo Wall is already mirrored INLINE on
    // this page (the #live-photo-wall section below), so "Photos" anchors to it —
    // NOT to `/[slug]/live-wall`, which is a JSON poll-feed route handler (the
    // LiveWallBlock's freshness endpoint), never a navigable page. After the day,
    // it points at the viewable recap album.
    //
    // ⚠ THE SECOND HALF OF THAT SENTENCE USED TO ASK THE CALENDAR, NOT THE
    // ALBUM. It read `dayOfPhase === 'post' ? /recap : null`, with no check
    // that the couple had published anything — so an ANONYMOUS visitor to the
    // invitation address tapped "Photos" during the T+36h→T+60h window and
    // landed on "The recap isn't ready yet", and after T+60h the button went
    // dark forever even once the album WAS published. The rooms footer on the
    // same event applied the correct rule the whole time. One decision now,
    // shared by all three surfaces — see `album-door.server.ts`.
    //
    // The live-wall branch is untouched: during the day "Photos" anchors to the
    // wall mirrored inline on this page, which is a different destination.
    const publicAlbumHref = liveWall
      ? `/${event.slug}#live-photo-wall`
      : ((await resolveAlbumDoor(event))?.href ?? null);

    return {
      scheduleBlocks,
      backdropConfig,
      liveWall,
      watchLive,
      broadcastPlanned,
      publicCandidCameraActive,
      hostCameraOpen,
      publicAlbumHref,
    };
  },
);

/**
 * The facts the two guest doorways need — the 3D walk-through of the reception
 * and the money-gift page. Each is read the way the DESTINATION reads it, which
 * is the whole point: a door is only honest if the page behind it would let
 * this viewer in.
 *
 *   · the 3D room → the event TYPE has seating AND the couple has PUBLISHED the
 *     floor plan. Those are the two questions `public_venue_scene` asks before
 *     it answers `{published:false}`; asking them here is what stops us handing
 *     a guest a link to "The 3D venue isn't ready yet".
 *   · the money gift → the rollout switch is on AND at least one destination is
 *     enabled, counted through `fetchEgiftMethods(admin, id, {enabledOnly:true})`
 *     — the same function, the same service-role client and the same filter the
 *     public page uses. "Is there anything behind this door" must be answered by
 *     the reader that will actually stand there, not by a cheaper query that
 *     might be permitted differently. Skipped entirely while the switch is off,
 *     so a dark flag costs nothing.
 *
 * ⚠ The VISIBILITY half of the money-gift page's gate is deliberately NOT here:
 * it needs the guest-session cookie and the viewer's account, and cookie reads
 * may never enter a `React.cache`'d loader (the hard rule at the top of this
 * file). The orchestrator answers it and passes it to `resolveGuestDoorways`.
 */
export const loadDoorwayFacts = cache(
  async (
    admin: AdminClient,
    eventId: string,
    eventType: string | null,
  ): Promise<{
    seatingSurfaceEnabled: boolean;
    seatingPublished: boolean;
    pabuyaRouteEnabled: boolean;
    enabledEgiftCount: number;
  }> => {
    const seatingSurfaceEnabled = surfaceEnabled(
      await resolveProfile(eventType ?? 'wedding'),
      'seating',
    );
    const pabuyaRouteEnabled = isPabuyaPublicRouteEnabled();
    const [seatingPublished, enabledEgiftCount] = await Promise.all([
      seatingSurfaceEnabled ? eventSeatingPublished(admin, eventId) : Promise.resolve(false),
      pabuyaRouteEnabled
        ? fetchEgiftMethods(admin, eventId, { enabledOnly: true }).then((m) => m.length)
        : Promise.resolve(0),
    ]);
    return { seatingSurfaceEnabled, seatingPublished, pabuyaRouteEnabled, enabledEgiftCount };
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

    const { data: guest, error: guestError } = await admin
      .from('guests')
      .select(
        'guest_id, first_name, last_name, display_name, role, side, group_category, plus_one_of_guest_id, plus_one_mode, plus_one_name_confirmed_at, plus_one_allowed, plus_one_name, rsvp_status, meal_preference, dietary_restrictions, guest_note, custom_tags, qr_token, photo_url, photo_source, email, mobile',
      )
      .eq('guest_id', session.guest_id)
      .is('deleted_at', null)
      .maybeSingle();

    // Same distinction as loadEventShell: `not_found` renders "we couldn't find
    // that invitation", which is a real accusation to make at someone holding a
    // printed QR — and it was also what a failed read produced, because the
    // error was discarded and a broken query returns `data = null` too. The
    // guest whose row is genuinely gone still gets told so; the guest whose
    // read merely failed gets told to try again.
    if (guestError) {
      throw new Error(
        `loadGuestContext: could not read guest ${session.guest_id}: ${guestError.message}`,
      );
    }
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
    // candid capture ON as a purchase, the guest hasn't declined, and they have NO
    // active enrollment. Self-hides the moment they add a selfie.
    //
    // ⚠ THE `eventOwnsPapicSeats()` HALF WAS DEAD AND IS REMOVED (2026-07-30) —
    // `PAPIC_SEATS` is `is_active = false` in prod, zero orders ever, retired by the
    // 2026-07-29 two-type lock. It could never be true, so it was buying every
    // guest page-load an extra orders read for a guaranteed `false`.
    //
    // ── WIDENED 2026-07-30 (owner: "widen it") — and gated on the control that
    //    actually governs the capability, not on a purchase. ───────────────────
    //
    // It used to require an ACTIVE `PAPIC_GUEST` pack, so a guest at an event on
    // the free pool — every event, since the grant is armed at creation — was
    // never offered enrollment even though their photos were being taken.
    //
    // ⚠ TWO CORRECTIONS TO THE PRIOR NOTE HERE, both verified in code rather than
    // taken from the register:
    //   • Auto face-matching is NOT dormant. `lib/face-match.ts` is a working
    //     matcher, and it needs no hosted model because the DESCRIPTORS ARE
    //     EXTRACTED CLIENT-SIDE and posted with the capture
    //     (api/papic/guest-capture/route.ts:244,540). So an enrollment does buy
    //     the guest something today.
    //   • The `face_enrollment` data-privacy control is ACTIVE in prod (approved
    //     2026-07-16), i.e. the DPO already signed the capability off.
    //
    // So the honest gate is the capability's OWN control — the very one
    // `face-match.ts:52` checks before it will match or persist a descriptor. Ask
    // for a selfie only where a selfie can actually be used, and if the DPO ever
    // revokes the control the prompt disappears on its own. That is
    // disclose-then-enable mechanised instead of hand-held.
    //
    // `faceMode` still decides the ASK's shape downstream (christening/debut are
    // forced mode_b), and RA 10173 consent is captured by the enroll UI itself.
    let needsFaceEnroll = false;
    if (await isDataPrivacyControlActive('face_enrollment')) {
      if (guest.rsvp_status !== 'declined') {
        const { data: liveEnrollment, error: enrollError } = await admin
          .from('guest_face_enrollments')
          .select('id')
          .eq('event_id', event.event_id)
          .eq('guest_id', guest.guest_id)
          .is('revoked_at', null)
          .maybeSingle();
        // A FAILED READ MUST NOT ASK FOR A FACE SCAN AGAIN.
        //
        // The error was discarded, so a failed read produced `null` — the same
        // value as "never enrolled" — and the page asked a guest who had
        // already given their face scan to give it a second time. Of the two
        // ways to be wrong about biometric consent, re-asking is the worse
        // one: it is a fresh collection prompt aimed at someone who already
        // decided, and it reads as though their answer was lost.
        //
        // So this fails toward SILENCE rather than toward asking. A guest who
        // genuinely has not enrolled and misses the prompt on one render sees
        // it on the next; nobody is asked twice for something they gave once.
        needsFaceEnroll = enrollError ? false : !liveEnrollment;
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
    // ONE declaration of this shape, in ./types — see GuestPapicCamera.
    let papicGuest: GuestPapicCamera | null = null;
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
          capApplies: quota.capApplies,
          poolRemaining: quota.poolRemaining,
          poolLow: quota.poolLow,
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

    // ── FIRST ARRIVAL vs RETURN ──────────────────────────────────────────
    // `scan_events` is written by every door that mints a guest session and was
    // read by nothing. The EARLIEST row is the whole signal: it does not move
    // when a guest re-scans the card in their hand, and it survives the redeem
    // route's observed DOUBLE-FIRE — prod holds two rows 1.3 seconds apart for
    // ONE arrival — so a count would lie where a minimum does not.
    //
    // ⛔ DO NOT ADD A SECOND CONJUNCT. `rsvp_responded_at` is stamped by three
    // HOST dashboard paths with no guest session in sight (in prod most guests
    // carry it and have never scanned anything, because the couple typed their
    // answers in), and `arrived` is written only by the door crew. Either one
    // would demote a genuine first arrival to "Hi again" — the exact bug.
    // A scan OLDER than the window already IS the proof of a previous visit.
    //
    // ⏱ TWO CLOCKS: `scanned_at` defaults to the database's now(), this runs on
    // the app runtime. The window absorbs ordinary skew, and a database clock
    // running ahead yields a negative difference that stays inside it — i.e. it
    // fails toward "Hello". `scanned_at` is a true instant, so parsing it
    // directly is correct here; the venue-wall-clock helper is for schedule
    // blocks and would INTRODUCE the error it exists to prevent.
    //
    // ↩ FAILS TOWARD TODAY'S COPY: a door that mints a session without writing
    // a scan leaves no evidence, and no evidence means "Hi again".
    //
    // 🔒 AND ONE GUEST NOW CHOOSES THAT ON PURPOSE. A guest who sets
    // `scan_tracking_opt_out` gets no `scan_events` row from any door
    // (lib/scan-trail.ts), so this read finds nothing and they are greeted with
    // "Hi again" every time — including their first. That is the price of the
    // switch, it is stated to the guest in the control itself
    // (_components/scan-trail-notice.tsx), and it is the correct direction: we
    // cannot know it is their first visit without the record they declined.
    const ARRIVAL_WINDOW_MS = 5 * 60 * 1000;
    let guestFirstVisit = false;
    try {
      const { data: firstScan, error: firstScanErr } = await admin
        .from('scan_events')
        .select('scanned_at')
        .eq('guest_id', guest.guest_id)
        .order('scanned_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      // 🔑 A REJECTED QUERY IS NOT A THROWN ERROR — check the error, or a lost
      // grant reads as "no scan ever" and greets every returning guest as new.
      if (!firstScanErr && firstScan?.scanned_at) {
        const firstAt = Date.parse(firstScan.scanned_at as string);
        guestFirstVisit = Number.isFinite(firstAt) && Date.now() - firstAt < ARRIVAL_WINDOW_MS;
      }
    } catch {
      guestFirstVisit = false;
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
      firstVisit: guestFirstVisit,
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
      guestHubData,
      seatMap,
      rsvpFaceMode,
      eventVendorCredits,
    };
  },
);
