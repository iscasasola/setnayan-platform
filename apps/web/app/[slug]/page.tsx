import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { Suspense } from 'react';
import { resolveProfile, surfaceEnabled } from '@/lib/event-type-profile';
import { InvitationSkeleton } from './_components/invitation-skeleton';
import { RESERVED_SLUGS } from '@/lib/reserved-slugs';
import { isSetnayanHost, isLocalOrPreviewHost } from '@/lib/custom-domain-resolve';
import {
  isUserNestingCutoverEnabled,
  publicEventPath,
  publicEventUrl,
  resolveEventOwnerSlug,
  resolveRenamedEventPath,
} from '@/lib/public-event-url';
// Bare-root dispatch: a slug that isn't a renderable event may be a vendor
// (setnayan.com/{vendor-slug}). Reuse the vendor route's render + metadata.
import { renderVendorBySlug, vendorMetadataBySlug } from '@/app/v/[slug]/page';
import { readGuestSession } from '@/lib/guest-session';
import {
  resolveEffectiveVisibility,
  isScheduledLaunchDue,
  publishSaveTheDate,
} from '@/lib/launch-save-the-date';
import { fanOutSaveTheDateEmails } from '@/lib/save-the-date-emails';
import { formatEventDate } from '@/lib/events';
import { getDayOfPhase, type DayOfPhase } from '@/lib/day-of-mode';
import { eventTimezoneFromCoords } from '@/lib/event-timezone.server';
import { GuestHubBar } from './_components/guest-hub-bar';
import { SpatialBackdrop } from '@/app/_components/spatial-backdrop';
import {
  type LifecyclePhase,
  isWebsitePhasesEnabled,
  getLifecyclePhase,
} from '@/lib/invitation-widgets';
import { eventNounOf } from './_lib/event-noun';
import {
  loadEventShell,
  loadGuestContext,
  loadHostMembership,
  loadVendorBooking,
  loadDayOfBroadcast,
  loadLiveLayer,
  loadMedia,
  loadWidgets,
  type EventShellRow,
} from './_lib/loaders';
import {
  anonymousIdentity,
  guestIdentity,
  resolveOwnerCapability,
  resolveVendorCapability,
  type AnonymousReason,
  type OwnerCapability,
} from './_lib/site-identity';
import { siteMenuEnabled } from './_lib/site-menu';
import {
  buildSimulatedGuestIdentity,
  shouldSimulateRepliedGuest,
} from '@/lib/simulated-guest-preview';
import { PrivateLanding } from './_components/private-landing';
// The ONE body tree (OPEN-BROWSE PR3) — renders every identity tier; the
// retained PublicLanding/InvitationSite pair (the duplicated 3-way body)
// dissolved into it. See _components/site-body.tsx.
import { SiteBody } from './_components/site-body';

// Task #13 (Phase 1 day-of PWA fix, 2026-05-22) — swap `dynamic = 'force-dynamic'`
// for ISR so this surface can be CDN-cached AND served from SHELL_CACHE when a
// guest reloads at a venue with weak WiFi. 60s revalidate window is acceptable
// for V1 pilot — guest invitation content changes infrequently; RSVP submit is
// a server action that still revalidates fresh.
//
// V1.1 follow-up: per-guest table-assignment preload via guest-session-scoped
// Cache API write — see Task #9 audit findings (CLAUDE.md decision-log row
// 2026-05-22).
export const revalidate = 60;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    invite?: string;
    invite_error?: string;
    phase?: string;
    // Unified Website Editor (PR-1) — `?editor=1` mounts the click-to-edit
    // bridge INSIDE the editor's preview iframe. Host-gated exactly like
    // `?phase=` below; ignored for guests/anonymous so their bytes never change.
    editor?: string;
    // PR4 P1 — per-visit preview of the auto-playing STD film while it bakes.
    film?: string;
    // Invite/Join v2 — guest "save a vendor" result flash (ok/needs_account/error).
    save?: string;
    rsvp?: string;
    // Editor RSVP'd tab (2026-07-26) — `?as=replied` previews the `rsvp` phase
    // as a guest who already answered "attending". Honoured ONLY for a viewer
    // holding a server-verified OwnerCapability; inert for everyone else, so a
    // guest's bytes are unchanged. See lib/simulated-guest-preview.ts.
    as?: string;
  }>;
};

// The event-by-slug read (with its soft-404 rationale) lives in
// `_lib/loaders.ts` as `loadEventShell` (OPEN-BROWSE PR2) — still React.cache'd
// on the slug alone, so generateMetadata and the page body keep sharing one DB
// roundtrip exactly as before.

export async function generateMetadata({ params }: Pick<Props, 'params'>) {
  const { slug } = await params;
  if (!slug || RESERVED_SLUGS.has(slug)) notFound();

  const event = await loadEventShell(slug);
  // Bare-root dispatch (PR5): not a renderable event → use the vendor metadata
  // (vendorMetadataBySlug returns a generic title if it isn't a vendor either).
  if (!event) return vendorMetadataBySlug(slug);
  // Iteration 0053: the public couple website is the 'website' profile surface.
  // Generic (non-wedding) profiles don't enable it → fall through to vendor
  // metadata (config-driven; was a notFound() before PR5).
  if (!surfaceEnabled(await resolveProfile(event.event_type), 'website')) return vendorMetadataBySlug(slug);

  // Private by default (owner 2026-06-20): a wedding page is private until the
  // couple LAUNCHES their Save-the-Date (which flips this to 'public'). NULL /
  // legacy rows coalesce to 'private' so they fail safe, not open. A SCHEDULED
  // launch (owner 2026-06-28) reads as 'public' once its time has passed, so the
  // page is indexable from the scheduled instant — same resolver as the body.
  const visibility = resolveEffectiveVisibility(event);

  // Unlisted = reachable by link but not discoverable; private = lock screen
  // for strangers. Neither should be in a search index, and neither should
  // leak the couple's names into SERP snippets via metadata.
  if (visibility !== 'public') {
    return {
      title: eventNounOf(event) === 'wedding' ? 'Wedding invitation' : 'Event invitation',
      robots: { index: false, follow: false },
    };
  }

  const siteUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
  ).replace(/\/$/, '');
  // PR6 cutover: canonical + OG URL point at the nested /u/{owner}/{slug} once
  // the flag is ON (self-noops to the bare slug while OFF). Keeps the crawler's
  // canonical in lockstep with the redirect the page body issues for bare hits.
  const ownerSlug = await resolveEventOwnerSlug(createAdminClient(), event.event_id);
  const canonicalUrl = publicEventUrl(siteUrl, event.slug, ownerSlug);
  const description = `You're invited — ${event.display_name}${
    event.event_date ? `, ${formatEventDate(event.event_date)}` : ''
  }. RSVP on Setnayan.`;
  return {
    title: event.display_name,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: 'website',
      url: canonicalUrl,
      title: `${event.display_name} · Setnayan`,
      description,
      siteName: 'Setnayan',
      locale: 'en_PH',
      // Share card: the editorial card (couple's hero photo + scrim) once their
      // story is published, else the couple's monogram card (their mark + names +
      // date, mirroring the page hero) — so a shared link always previews as the
      // couple; only a missing event / render failure falls back to the brand
      // image. See app/api/og/realstory-slug/[slug]/route.ts.
      images: [
        {
          url: `${siteUrl}/api/og/realstory-slug/${event.slug}`,
          width: 1200,
          height: 630,
          alt: `${event.display_name} · Setnayan`,
        },
      ],
    },
    twitter: { card: 'summary_large_image' as const },
  };
}

// (The reveal/STD helper functions — revealMonogram · revealWaxColor ·
// revealVeilColor · stdAccentColor · revealMarkSvg · stdLockupFor ·
// revealSealConfig · coerceRevealTemplate · displayNameOf — moved verbatim to
// _components/site-body.tsx with the body trees that consume them.)

export default async function PublicInvitationPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const search = await searchParams;
  const invite = (search.invite ?? '').trim();
  const inviteError = search.invite_error ?? null;

  if (!slug || RESERVED_SLUGS.has(slug)) notFound();

  // If an invite token is in the URL, hand off to the redeem route handler
  // which can write the session cookie (Server Components in Next 15 can't).
  if (invite) {
    redirect(
      `/${slug}/redeem?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(invite)}`,
    );
  }

  const admin = createAdminClient();

  const event = await loadEventShell(slug);

  // Bare-root dispatch (PR5): not a renderable event → it might be a renamed
  // event's prior slug, else a vendor at this slug.
  if (!event) {
    // Renamed-event redirect (wires the long-dormant slug_change_log read): a
    // bare slug mapping to no current event may be a PRIOR slug of one — send it
    // to that event's CURRENT canonical /u/ URL. Flag-gated (resolveRenamedEventPath
    // self-noops when OFF), so this — like the rest of the cutover — is fully
    // inert until the flip; the old-QR-after-rename 404 gets fixed as part of it.
    const renamedTo = await resolveRenamedEventPath(admin, slug);
    if (renamedTo) redirect(renamedTo);
    // Not a renamed event → try a vendor at this slug. renderVendorBySlug
    // notFound()s itself if there's no vendor either.
    return renderVendorBySlug({ slug, searchParams });
  }
  // Iteration 0053: the whole public couple website is the 'website' profile
  // surface. Non-wedding (generic) profiles don't enable it → fall through to
  // the vendor check (config-driven; was a notFound() before PR5). The resolved
  // profile is reused for the phase engine below.
  const eventTypeProfile = await resolveProfile(event.event_type);
  if (!surfaceEnabled(eventTypeProfile, 'website')) return renderVendorBySlug({ slug, searchParams });

  // PR6 — three-tier URL cutover (slug-routing program), flag-gated (default
  // OFF). The canonical public URL for an event is now /u/{ownerSlug}/{slug}; a
  // hit on the legacy bare root (printed QRs, old shares) 307-redirects to the
  // nested URL. 307 (not 308) keeps the cutover REVERSIBLE — flipping the flag
  // back never leaves a permanently-cached redirect. Suppressed when:
  //   (a) the request already arrived via the /u/ middleware rewrite (the
  //       x-sn-u-nesting header) — that IS the nested render; redirecting it
  //       would loop /u/a/b → /b → /u/a/b forever;
  //   (b) the Host is a custom BYO domain — there the bare URL is canonical
  //       (sny.theirdomain.com/{slug}); bouncing to /u/ would be wrong.
  if (isUserNestingCutoverEnabled()) {
    const reqHeaders = await headers();
    const viaNesting = reqHeaders.get('x-sn-u-nesting') === '1';
    const host = (reqHeaders.get('host') ?? '').toLowerCase();
    const firstPartyHost =
      !host || isSetnayanHost(host) || isLocalOrPreviewHost(host);
    if (!viaNesting && firstPartyHost) {
      const ownerSlug = await resolveEventOwnerSlug(admin, event.event_id);
      if (ownerSlug && event.slug) {
        // Carry the incoming query through the canonicalization redirect — the
        // bare `/{slug}` URL is where server actions + the redeem route land
        // their one-shot params (?save=, ?invite_error=, ?phase=, ?film=) and
        // where inbound UTM/ref attribution arrives; dropping it would silently
        // kill save-confirmation flashes, invalid-invite messaging, host phase
        // previews, and analytics. (The `?invite=` redeem hand-off already fired
        // above, so it's never in this query.)
        const qs = new URLSearchParams();
        for (const [k, v] of Object.entries(search)) {
          if (typeof v === 'string') qs.set(k, v);
        }
        const q = qs.toString();
        redirect(`${publicEventPath(event.slug, ownerSlug)}${q ? `?${q}` : ''}`);
      }
    }
  }


  // ── THE BLANK WHITE SCREEN (2026-08-05) ───────────────────────────────────
  //
  // Everything above this line is a ROUTING decision — notFound(), the redeem
  // redirect, the /u/ canonicalisation, the vendor dispatch. Everything below
  // is body work: a dozen-plus sequential awaits, several of them R2 presign
  // round-trips.
  //
  // With no boundary anywhere under this route, the whole page WAS React's
  // shell, so not one byte flushed until the last await resolved. A guest
  // scanning the QR on a crowded venue network got a blank white screen — no
  // monogram, no couple's name, not even a spinner — for as long as the server
  // took. Most people tap again, or decide the link is broken.
  //
  // ⛔ THE FIX IS NOT A `loading.tsx`. One existed and was deliberately deleted
  // (04c03063d, "real 404s on unknown slugs"): a route-level loading file makes
  // the streaming shell commit HTTP 200 BEFORE the body runs, so every junk URL
  // became an indexable soft-404. A Suspense boundary placed AFTER the
  // notFound/redirect decisions keeps the real 404, because the status is
  // settled before the first flush.
  return (
    <Suspense
      fallback={
        <InvitationSkeleton
          displayName={event.display_name}
          monogramText={event.monogram_text}
        />
      }
    >
      <InvitationBody
        event={event}
        slug={slug}
        search={search}
        admin={admin}
        inviteError={inviteError}
        eventTypeProfile={eventTypeProfile}
      />
    </Suspense>
  );
}

/**
 * The invitation itself. Split out of the page component so a Suspense boundary
 * can sit between the routing decisions (which must settle the HTTP status) and
 * the body work (which is slow). Nothing here moved a line — it is the same
 * code, one function deeper.
 */
async function InvitationBody({
  event,
  slug,
  search,
  admin,
  inviteError,
  eventTypeProfile,
}: {
  event: EventShellRow;
  slug: string;
  search: Awaited<Props['searchParams']>;
  admin: ReturnType<typeof createAdminClient>;
  inviteError: string | null;
  eventTypeProfile: Awaited<ReturnType<typeof resolveProfile>>;
}) {
  // Hero / photos / monogram / Save-the-Date media resolution — moved verbatim
  // to `loadMedia` (_lib/loaders.ts · OPEN-BROWSE PR2). Runs BEFORE the private
  // gate exactly as the inline block did (PrivateLanding consumes the monogram
  // quartet); destructured so every render branch below reads the same names.
  const {
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
  } = await loadMedia(admin, event);

  // Per-event widget registry — moved verbatim to `loadWidgets`
  // (_lib/loaders.ts), which carries the registry's full doc block.
  const widgets = await loadWidgets(admin, event.event_id);

  // Read the guest-session cookie up-front so the private-gate below can
  // accept a session-cookie-bearing guest without re-fetching guests
  // unnecessarily. The same `session` reference is consumed by the
  // existing guest-vs-public branch a few lines down — no extra DB call.
  const session = await readGuestSession();

  // Private-mode gate (CLAUDE.md 2026-05-22 owner directive).
  //
  // 'public' + 'unlisted' render identically on this page — the difference
  // is search-engine indexing + future "browse weddings" surfaces (V1.1).
  // 'private' restricts the page to:
  //   (a) signed-in hosts in event_members / event_moderators, OR
  //   (b) signed-in guests with a valid guest-session cookie for this event.
  //
  // The `?invite=<token>` route fires above this block (redirects to the
  // redeem handler that writes the cookie), so a guest landing with their
  // personal link is automatically allowed even on a private event — they
  // come back through here without `?invite=` and the cookie matches.
  // Private by default (owner 2026-06-20): a wedding page is private until the
  // couple LAUNCHES their Save-the-Date (which flips this to 'public'). NULL /
  // legacy rows coalesce to 'private' so they fail safe, not open.
  //
  // SCHEDULED launch (owner 2026-06-28): if the couple set a future go-live and
  // that moment has passed, the page reads as 'public' right now — visibility is
  // exact at the scheduled instant. Cron-free (no timer flips the row): we
  // persist the flip + push Save-the-Date emails AFTER the response, on this
  // first load past the schedule. Idempotent — once visibility is 'public' the
  // branch never re-fires, and per-guest guests.std_sent_at guards the emails.
  if (isScheduledLaunchDue(event)) {
    after(async () => {
      try {
        const published = await publishSaveTheDate(admin, event.event_id);
        if (published?.slug) revalidatePath(`/${published.slug}`);
        await fanOutSaveTheDateEmails(event.event_id);
      } catch {
        /* best-effort — the page already renders public this request */
      }
    });
  }
  const visibility = resolveEffectiveVisibility(event);

  if (visibility === 'private') {
    // Path A — guest cookie session for this exact event. Legitimate
    // invited guest already redeemed their personal link.
    const guestSessionMatches = session?.event_id === event.event_id;

    // Path B — signed-in host. event_members (V1 couple membership) OR
    // event_moderators (iteration 0048 multi-host invite path). The query pair
    // lives in `loadHostMembership` (_lib/loaders.ts) — React.cache'd, so the
    // `?phase=` preview gate below reuses this result instead of re-querying.
    // The cookie-scoped auth read stays HERE (never inside a cached loader).
    let isAuthedHost = false;
    if (!guestSessionMatches) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        isAuthedHost = await loadHostMembership(admin, event.event_id, user.id);
      }
    }

    if (!guestSessionMatches && !isAuthedHost) {
      return (
        <PrivateLanding
          event={event}
          monogram={monogram}
          animatedMonogram={animatedMonogram}
          bespokeSvg={bespokeSvg}
          proWatermarkHidden={proWatermarkHidden}
          siteColorVars={siteColorVars}
        />
      );
    }
    // Otherwise fall through — public / unlisted rendering path below
    // handles the rest of the page exactly as it would for a public event.
  }

  // Website lifecycle-phase engine. The 4-path lifecycle (save_the_date →
  // rsvp → event → editorial) ships ON for weddings — this whole surface is
  // wedding-only (non-weddings notFound() above), so the lifecycle is the
  // wedding website. The WEBSITE_PHASES_ENABLED env flag stays as an override
  // for any future non-wedding event types.
  const phasesEnabled = isWebsitePhasesEnabled() || surfaceEnabled(eventTypeProfile, 'website');

  // Date-driven phase by default. PREVIEW override: `?phase=rsvp|event|
  // editorial` shows any phase regardless of date (the live "event" phase is
  // otherwise only a T-1h..T+8h window, so it can't be previewed otherwise).
  // Honored for TWO viewers only:
  //   (a) demo events (slug `test-*` or `[TEST]` name) — anyone, for demos;
  //   (b) the event's own signed-in HOSTS (owner ask 2026-06-11 "can you
  //       always preview that?") — a couple/moderator can preview their
  //       on-the-day page and editorial ANY time; this also powers the
  //       site-editor's per-phase preview tabs.
  // A crafted link still can't force a phase on a real couple's wedding for
  // guests/anonymous visitors — the host check runs against the VIEWER's own
  // session. Host lookups fire only when a phase param is present, so the
  // normal guest path pays zero extra queries.
  const isDemoEvent =
    event.slug?.toLowerCase().startsWith('test-') === true ||
    (event.display_name ?? '').toUpperCase().includes('[TEST]');
  const phaseParam = typeof search.phase === 'string' ? search.phase.toLowerCase() : '';
  const isValidPhaseParam =
    phaseParam === 'save_the_date' ||
    phaseParam === 'rsvp' ||
    phaseParam === 'event' ||
    phaseParam === 'editorial';
  let phasePreviewAllowed = isDemoEvent;
  if (phasesEnabled && isValidPhaseParam && !phasePreviewAllowed) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      // Same host-membership pair as the private gate above — served from the
      // React.cache'd `loadHostMembership`, so a host previewing a private
      // event's phases costs ONE pair of queries where it used to cost two.
      phasePreviewAllowed = await loadHostMembership(admin, event.event_id, user.id);
    }
  }
  const phaseOverride: LifecyclePhase | null =
    phasesEnabled && isValidPhaseParam && phasePreviewAllowed
      ? (phaseParam as LifecyclePhase)
      : null;

  // Unified Website Editor (PR-1) — `?editor=1` mounts the click-to-edit bridge
  // for the couple's own preview iframe. STRICTER than the phase override: real
  // host membership only (no demo-event shortcut), because the bridge posts
  // edit intents to a parent editor window. The lookup fires only when the param
  // is present, so the normal guest path pays zero extra queries — and with the
  // param absent (every guest, always) `editorMode` is false and the bridge is
  // never rendered, so guest HTML is unchanged byte-for-byte.
  let editorMode = false;
  if (search.editor === '1') {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      // React.cache'd — shares the lookup with the private gate / phase preview.
      editorMode = await loadHostMembership(admin, event.event_id, user.id);
    }
  }

  // Task #13 — day-of phase (drives the live badge + pinned schedule). Real,
  // unless the demo override forces a phase (event→live so the day-of UI shows).
  const dayOfPhase: DayOfPhase = phaseOverride
    ? phaseOverride === 'event'
      ? 'live'
      : phaseOverride === 'editorial'
        ? 'post'
        : 'pre'
    : event.event_date
      ? getDayOfPhase(event.event_date, eventTimezoneFromCoords(event.venue_latitude, event.venue_longitude))
      : 'inactive';

  // `lifecyclePhase` is only consumed when `phasesEnabled`; threads into
  // SiteBody like heroPhotoUrl.
  const lifecyclePhase: LifecyclePhase = phaseOverride ?? getLifecyclePhase(event.event_date);

  // PR4 P1 — flag-gate the auto-playing Save-the-Date "film". The bare film is
  // the free base (the static STD view is the fallback); the cinematic openings
  // (RevealOverlay) layer ON TOP and become the ₱999 premium (P5 gate). Env
  // for a global rollout, ?film=1 for a per-visit preview while it bakes.
  // Film is on by default for the STD phase; ?film=0 disables it for a
  // plain-countdown fallback (useful for testing the static path).
  const stdFilm = search.film !== '0';

  // (Note: guest-session cookie was already read above for the private-gate
  // check — reuse the same `session` reference rather than re-fetching.)

  // Day-of layer — public schedule + RSVP-era backdrop + live-window Watch-Live
  // / Live Photo Wall + the anonymous event-day chrome. Moved verbatim to
  // `loadLiveLayer` (_lib/loaders.ts), branching on the same dayOfPhase.
  const {
    scheduleBlocks,
    backdropConfig,
    liveWall,
    watchLive,
    publicCandidCameraActive,
    hostCameraOpen,
    publicAlbumHref,
  } = await loadLiveLayer(admin, event, dayOfPhase);
  // The loader returns the parsed CONFIG; the JSX wrap stays here (same
  // truthiness guard the inline block applied).
  const backdrop: React.ReactNode = backdropConfig ? (
    <SpatialBackdrop config={backdropConfig} />
  ) : null;

  // ONE viewer-account read for the whole request. Previously the only auth
  // read on the render path lived down in the guest branch (the claim-account
  // CTA); the owner gate below needs the same answer, so it is hoisted here
  // and the guest branch reuses `viewerAccount` instead of re-reading. Auth /
  // cookie reads stay OUT of the React.cache'd loaders (loaders.ts hard rule).
  const cookieScopedClient = await createClient();
  const {
    data: { user: viewerAccount },
  } = await cookieScopedClient.auth.getUser();

  // ── OWNER LAYER · FOUNDATION ONLY (owner-locked 2026-07-26) ──────────────
  // The event owner opens `/[slug]` like a guest and gets owner controls
  // unlocked on top of it. This resolves WHETHER this viewer holds that
  // capability; NOTHING consumes it yet, so this render is byte-identical to
  // the pre-PR page for every visitor including the owner. A later PR mounts
  // the controls on it.
  //
  // The gate is the DATABASE, not the UI: `loadHostMembership` — the same
  // React.cache'd event_members + event_moderators pair that already gates the
  // private-event view, `?phase=` preview and `?editor=1` above, so a host who
  // hits any of those pays ONE query pair for all of them. No query param,
  // header or cookie can shortcut it, and a guest-session cookie is not an
  // account (viewerAccount is null for a cookie-only guest → no capability).
  const ownerCapability: OwnerCapability | null = await resolveOwnerCapability({
    eventId: event.event_id,
    viewerUserId: viewerAccount?.id ?? null,
    checkHostMembership: (userId) => loadHostMembership(admin, event.event_id, userId),
  });

  // The supplier doorway's grant. Same shape and same discipline as the owner
  // capability above: one query, answered by the DB, bound to this event and
  // this auth user. A cookie-only guest has no account, so no capability.
  const vendorCapability = await resolveVendorCapability({
    eventId: event.event_id,
    viewerUserId: viewerAccount?.id ?? null,
    checkVendorBooking: (userId) => loadVendorBooking(admin, event.event_id, userId),
  });
  // The coordinator's announcement for the guests in the room. Live window
  // only — the loader returns null outside it, so nothing stale survives the
  // day. Guests only; see the render site in site-body.
  const dayOfBroadcast = await loadDayOfBroadcast(admin, event.event_id, dayOfPhase === 'live');

  // Shared SiteBody props — identical for every identity tier. The per-tier
  // delta travels in the `identity` union (see _lib/site-identity.ts): the
  // anonymous variant is built by `anonymousIdentity()` (the key-pick
  // firewall) and structurally cannot carry guest-derived data.
  const siteProps = {
    event,
    monogram,
    animatedMonogram,
    studioAnim,
    bespokeSvg,
    dayOfPhase,
    hostCameraOpen,
    dayOfBroadcast,
    phasesEnabled,
    lifecyclePhase,
    stdFilm,
    stdBackground,
    stdBackgroundUrl,
    stdVideoUrl,
    stdVideoPosterUrl,
    stdVenues,
    heroPhotoUrl,
    heroVideoUrl,
    bgMusicUrl,
    ownsStdReveal,
    ourPhotoUrls,
    widgets,
    scheduleBlocks,
    backdrop,
    liveWall,
    watchLive,
    proWatermarkHidden,
    siteColorVars,
    editorMode,
    // Declared-but-unconsumed foundation (see the owner-layer block above).
    ownerCapability,
    vendorCapability,
  };
  const renderAnonymous = (reason: AnonymousReason) => (
    <SiteBody
      {...siteProps}
      identity={anonymousIdentity({
        reason,
        publicCandidCameraActive,
        publicAlbumHref,
      })}
    />
  );

  // ── EDITOR "RSVP'd" PREVIEW TAB (2026-07-26) ─────────────────────────────
  // The RSVPed fork (keepsake ticket instead of the ask) is keyed on a GUEST's
  // own rsvp_status, so a host previewing `?phase=rsvp` can never see it — they
  // have no guest row. `?as=replied` substitutes a FABRICATED guest so they can.
  //
  // Gated on `ownerCapability` and nothing else — the same server-verified host
  // membership that gates `?phase=` and `?editor=1`. For a guest or an anonymous
  // visitor the param is ignored outright and the branches below run unchanged.
  //
  // The substituted identity is built from constants in
  // lib/simulated-guest-preview.ts — no `guests` read happens here or there, so
  // no real guest's name, meal preference or dietary notes can surface in a
  // host's preview. Placed above the session branches so it also wins for a host
  // who happens to hold a guest cookie for their own event: they asked for the
  // simulated view explicitly. Preview only — nothing is written or persisted.
  if (
    shouldSimulateRepliedGuest({
      ownerCapability,
      asParam: search.as,
      lifecyclePhase,
      eventId: event.event_id,
    })
  ) {
    return (
      <SiteBody
        {...siteProps}
        identity={buildSimulatedGuestIdentity({ slug: event.slug ?? slug })}
      />
    );
  }

  if (!session) {
    return renderAnonymous(inviteError === 'invalid_token' ? 'invalid_invite' : null);
  }

  // Cookie session is for a different event → bail to public landing.
  // (Sign-out from the footer is how a guest swaps between events.)
  if (session.event_id !== event.event_id) {
    return renderAnonymous('wrong_event');
  }

  // Guest-scoped context — moved verbatim to `loadGuestContext`
  // (_lib/loaders.ts), THE ONLY loader that selects guest columns. Reached only
  // past the `!session` / wrong-event branches above, so the session argument
  // is always verified for THIS event (the loader never reads cookies itself).
  // Control flow — the invalid-invite landing and the /welcome redirect — stays
  // here, keyed off the loader's discriminated result.
  const guestContext = await loadGuestContext(
    admin,
    event,
    session,
    dayOfPhase,
    slug,
    scheduleBlocks,
    monogram,
  );

  // A cookie-holder whose guest row no longer exists (replaced invite) gets
  // the stale-cookie messaging — the same `invalid_invite` reason variant as
  // the `?invite_error=invalid_token` URL path above.
  if (guestContext.kind === 'not_found') {
    return renderAnonymous('invalid_invite');
  }

  // TBA +1 still hasn't confirmed their name — re-route them to onboarding.
  // (The check runs inside loadGuestContext, before any further guest reads,
  // exactly where it ran inline — only the redirect() throw stays out here,
  // since a thrown redirect must never be cached.)
  if (guestContext.kind === 'unconfirmed_tba') {
    redirect(`/${slug}/welcome`);
  }

  const {
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
  } = guestContext;

  // Invite/Join v2: offer an accountless guest a "claim your account by email"
  // prompt on the lifecycle site (RSVP/Event/Editorial). A signed-in account-
  // holder doesn't need it, so gate on the absence of a Supabase auth session.
  // (`viewerAccount` is read once, above the siteProps block — same request,
  // same cookies, same answer; the owner gate shares it.)

  // Invite/Join v2 — a no-login guest's photo access closes once the post-event
  // grace ends (dayOfPhase leaves live/post, ~24h after the wedding). Past that,
  // their gallery is closed and we nudge an account (the files persist on R2, so
  // syncing restores them). eventIsPast disambiguates a post-event 'inactive'
  // from the far-pre-event 'inactive'. Account-holders are never closed.
  const eventIsPast = event.event_date
    ? new Date(event.event_date).getTime() < Date.now()
    : false;
  const accountlessPhotosClosed =
    !viewerAccount && eventIsPast && dayOfPhase !== 'live' && dayOfPhase !== 'post';

  // (eventVendorCredits — "vendors who made this day" — now resolves inside
  // loadGuestContext, destructured above.)
  // The guest's reply either landed or it did not, and until now BOTH outcomes
  // rendered the same page with no message. Success at least left their answer
  // on the form; a failure left the form showing whatever was there before,
  // which for a first-time reply is an empty form — indistinguishable from
  // never having tapped Save.
  const rsvpFlash =
    search.rsvp === 'ok'
      ? { tone: 'ok' as const, text: 'Your reply is in — thank you.' }
      : search.rsvp === 'error'
        ? {
            tone: 'error' as const,
            text: 'We could not save your reply just now. Please try again — it has not been recorded yet.',
          }
        : null;

  const saveFlash =
    search.save === 'ok'
      ? 'Saved to your account — find it in your Library for your own plans.'
      : search.save === 'needs_account'
        ? 'Make a free account (the box above) to save vendors for your future plans.'
        : search.save === 'error'
          ? 'Couldn’t save that just now — please try again.'
          : null;

  // (rsvpFaceMode — the effective face-tag mode for the RSVP selfie + day-of
  // enroll surfaces — now resolves inside loadGuestContext, destructured above.)

  return (
    <>
      <SiteBody
        {...siteProps}
        identity={guestIdentity({
          guest,
          qrSvg,
          invitationUrl,
          guestLiveGallery,
          seatPassActive,
          needsFaceEnroll,
          guestHubData,
          seatMap,
          papicGuest,
          pabati,
          showClaimAccountCta: !viewerAccount,
          accountlessPhotosClosed,
          eventVendorCredits,
          saveFlash,
          rsvpFlash,
          faceMode: rsvpFaceMode,
        })}
      />
      {/* Guest event-page hub bar (owner 2026-06-26) — fixed bottom control bar
          (My QR · Camera · Photos) + top-right account affordance. Replaces the
          two lone floating Papic CTAs that used to sit here; everything it needs
          is already computed above (no new DB reads). The #claim-account anchor
          only exists when the claim section renders (no account + not STD). */}
      <GuestHubBar
        qrToken={guest.qr_token}
        invitationUrl={invitationUrl}
        qrSvg={qrSvg}
        cameraReady={guestRollCameraReady}
        papicGuestActive={papicGuestActive}
        hasAccount={Boolean(viewerAccount)}
        galleryCount={guestLiveGallery?.total ?? 0}
        showClaimAnchor={!viewerAccount && lifecyclePhase !== 'save_the_date'}
        hubHref={
          dayOfPhase === 'live' || dayOfPhase === 'post'
            ? `/${event.slug}/hub`
            : null
        }
        selfRotateEnabled={process.env.GUEST_QR_SELF_ROTATE === 'true'}
        dayOfLive={dayOfPhase === 'live'}
        slug={event.slug ?? slug}
        // Resolved from the SAME two inputs as the menu itself (site-body.tsx),
        // so the bar this component gives up and the bar that replaces it can
        // never disagree — and neither can the two owners of `#site-me`.
        menuOn={siteMenuEnabled({
          flag: process.env.NEXT_PUBLIC_WEBSITE_MENU_ENABLED,
          isSample: Boolean(event.is_sample),
        })}
      />
    </>
  );
}
