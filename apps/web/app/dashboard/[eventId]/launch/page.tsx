import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import { resolveStdBackground, stdFollowsTheme } from '@/lib/std-backgrounds';
import Link from 'next/link';
import { studioHubHref } from '@/lib/studio-hub';
import { guestsMaySeeSeatsFor } from '@/lib/guests-may-see-seats';
import { redirect } from 'next/navigation';
import {
  MonitorPlay,
  Radio,
  Camera,
  ArrowRight,
  Plus,
  PencilLine,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Suspense, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/server';
import { isStoreShellRequest } from '@/lib/request-platform';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { isTransientReadError, schemaBlipError, withSchemaRetry } from '@/lib/read-retry';
import { getCurrentUser } from '@/lib/auth';
import { eventPapicActive } from '@/lib/papic-seats';
import { GENERIC_PROFILE, profileSetup, resolveProfile, resolveProfileByEvent, surfaceEnabled } from '@/lib/event-type-profile';
import { publicUrlForStoredAsset } from '@/lib/uploads';
import { pickableInviteThemes, resolveInviteTheme, themeMatchingFeel } from '@/lib/invite-themes';
import { resolveHero } from '@/lib/event-hero';
import { siteMediaServeRef } from '@/lib/site-media-ref';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { resolveWeddingOnlyParts } from '@/lib/wedding-only-parts';
import { eventSkuActive } from '@/lib/entitlements';
import { resolveAddOnState } from '@/lib/add-on-state';
import { liveStudioControllerHref } from '@/lib/live-studio-control';
/* ⚠ TWO NEAR-IDENTICALLY NAMED RESOLVERS LIVE ONE IMPORT APART, AND THIS PAGE
   USED TO CALL BOTH BY HAND.
     · `getLifecyclePhase` (lib/invitation-widgets) is the PUBLIC-WEBSITE phase
       (save_the_date → rsvp → event → editorial). It reaches 'editorial' by a
       second path, so it is NOT a has-it-happened test.
     · `getMenuLifecyclePhase` (lib/day-of-mode) IS.

   🔒 NEITHER IS CALLED FROM THIS FILE ANY MORE. Both are asked through
   `lib/event-hub-control.ts` — `resolveHubStage` for the first, `resolveHubPhase`
   for the second — so the split is held by a TEST that fails when they are
   swapped (`event-hub-control.test.ts`) instead of by a comment asking you not
   to. Do not reintroduce a direct call here; add it to that module. */
import { PUBLIC_SITE_PAGES } from '@/lib/public-site-pages';
import { guestColumnsActive } from '@/lib/guest-columns-gate';
import { PageMasthead } from '@/app/_components/page-masthead';
import { HubStage } from './_components/hub-stage';
import { MakerShell } from './_components/maker-shell';
import { HubDraftDock } from '../website/_components/hub-draft-dock';
import { readHubDraft } from '@/lib/hub-draft-store';
import { overlayHubDraftEvent } from '@/lib/hub-draft';
import { hubMainGround, sanitizeHubMainGround } from '@/lib/hub-canvas';
import { mainColoursOf, sanitizeMainColourDraft } from '@/lib/main-colours';
import type { MarchStep } from '@/lib/march-drag';
import { resolveReplyBy, sanitizeRsvpAskConfig, type RsvpAskConfig } from '@/lib/rsvp-ask';
import { makerPageCanvasSrc } from '@/lib/maker-made-once-pages';
import { readMakerRevealStages } from './_components/maker-made-once';
import { MoodBoardMakerBody, MoodBoardMakerControls, MoodBoardStudioBody } from '../studio/mood-board/_components/mood-board-editor';
import { PUBLIC_STAGE_LABELS } from '@/lib/public-site-stage-labels';
import { MakerRsvpCanvas } from './_components/maker-page';
/* ⚡ Loads when Details › RSVP is opened — never with the Maker (`details-lazy.tsx`). */
import { MakerRsvpSettings, MakerRsvpStage } from './_components/details-lazy';
import { celebrationColours } from '@/lib/rsvp-celebration';
import { boardSwatches } from '@/lib/mood-board-palette-set';
import OurStoryEditorPage from '../website/our-story/page';
import CoupleSchedulePage from '../schedule/page';
import CoupleSeatingPage from '../seating/page';
import RequestsPage from '../guests/claims/page';
import type { LoveStoryBlob } from '../website/our-story/_components/story-fields';
import { resolveMoments } from '@/lib/love-story-moments';
/* Constants and pure helpers from `maker-bar.ts`, never from a `'use client'`
   file — a server page gets a client REFERENCE for those, not the value. */
import { MAKER_TOUR_KEY, isStagePhase } from './_components/maker-bar';
import { makerTourSlideViews } from './_components/maker-tour-slides';
import { MiniTour } from '@/app/_components/mini-tour';
import { completeTour } from '@/lib/tour-actions';
import WebsiteEditorPage from '../website/editor/page';
import { updateEventSlug } from '../invitation/actions';
import { HubProOffer } from './_components/hub-pro-offer';
import { MakerDetails, detailsFactEditors } from './_components/maker-details';
import { loadYourEvent } from './_components/details-your-event-load';
import { venuesEditorFor } from './_components/details-your-event-parts';
import { eventWordsFromProfile } from '@/app/[slug]/_lib/event-words';
import { hasOwnLook } from '@/lib/theme-own-look';
import { detailsItemApplies, detailsItemFor, makerHasWork, makerToolFor, schedulePieces, type DetailsItemKey } from '@/lib/maker-details-items';
import { guidedPlanFromFacts, isUnfinished, parseGuideParam } from '@/lib/details-guided-flow';
import { parentsOffered } from '@/lib/details-your-event';
import { countSetupGuests, guidedFactsFrom, readBackgroundChosen, guidedPresent, hubSetupFactsFrom, readGuidedPlan, setupRoundFor, type SetupScheduleBlock } from './_components/details-guided-progress';
import { hubSetupApplies, hubSetupGuestsHref, type HubSetupFacts } from '@/lib/hub-setup-steps';
import { formatBlockTime } from '@/lib/schedule';
import { isCoordinatorP3Enabled } from '@/lib/coordinator-broadcasts-server';
import { findSampleEventId } from '@/app/tour/_lib/sample-event';
import { GuestCardBody } from '../guests/_components/guest-card-body';
import { fetchInvitationBase, loadGuestCard } from '../guests/_components/guest-card-data';
import { qrLookChoicesFromRow } from '@/lib/qr-look.server';
import { updateQrStyle } from './qr-look-actions';
import { boardIsTheCouples, sampleBoardQuery, themeSeedPalettes } from '@/lib/theme-colours';
import { parentGuestsForEvent, printInputsVersion, printOwnsPro, printThemeFor, readMenuSources, readPrintEvent, readRsvpHosts } from '@/lib/print-set.server';
import { printPreviewVersion } from '@/lib/print-preview-cache';
import { printDraftOf } from '@/lib/ceremony-time';
import { updateSpecialMessage } from '../website/special-message/actions';
import { fetchEgiftMethods, isPabuyaPublicRouteEnabled, readEgiftMethods } from '@/lib/egift';
import { HubSavesImmediately } from '../website/_components/hub-draft-field';
// ⚡ Through the lazy stand-in — never the manager's own module (the Maker's first-load budget).
import { PabuyaManager } from './_components/details-lazy';
import { formatFor, parsePrintDetails, storyHasMoments } from '@/lib/print-pieces';
import { printStoryChapters } from '@/lib/love-story-moments';
import { passCardDesignFrom, passCardsZipFileNameOf } from '@/lib/pass-card';
import { isHostMemberType } from '@/app/[slug]/_lib/host-scope';
import { fetchEventViewer, isDelegateWithoutArea } from '@/lib/event-viewer.server';
import { fetchGuestsByEventMeasured } from '@/lib/guests';
import {
  resolveHubStanding,
  resolveHubFacts,
  resolveHubNextStep,
  hubOffersAllowed,
  hubPreviewRoles,
  resolveArmedHubRole,
  resolveHubRoleView,
  resolveHubStageSelection,
  type HubEventRead,
  type HubGuestRead,
  type HubEditorialRead,
} from '@/lib/event-hub-control';
import { readChapterOverrides } from '@/app/[slug]/_components/editorial/data';
import { resolveHubProOffer } from '@/lib/event-hub-pro';
import {
  eventCoupleWebsiteProActive,
  eventOwnsCoupleWebsitePro,
} from '@/lib/couple-website-pro';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { formatPhp } from '@/lib/orders';
import { hubNamedGuestPreviewEnabled } from '@/lib/hub-named-guest-flag';
import { asViewed, viewAsFreeSwitch } from '@/lib/view-as-free.server';
import { planMyselfOn } from '@/lib/plan-myself';
import { makerStagesStudioEnabled } from '@/lib/maker-stages-studio-flag';
import { manualLaunchPhase } from '@/lib/invitation-widgets';
import { publicEventPath } from '@/lib/public-event-url';
import { studioTiles, type StudioTileModel } from '@/lib/studio-tiles';
import { yourEventLabel } from '@/lib/details-your-event';

// ⭐ THE ONLY SURFACE THAT MAY DECLARE THIS NAME (owner ruling 2026-09-02 —
// "if it is the same then adjust"). `/website` wore `title: 'Event Hub'` too
// while doing the same job; it is a redirect stub now, and this page carries
// the name alone. `one-event-hub-door.test.ts` fails if a second surface ever
// re-claims it.
//
// ✏️ THE NAME ITSELF CHANGED 2026-09-03 (LS8): "Event Hub" is the GUEST-FACING
// SITE, and this page is the dashboard that governs it — the "Event Hub
// CONTROLLER". The distinction is not cosmetic: the couple stands HERE looking
// at a preview of a page their guests open SOMEWHERE ELSE, and one word for
// both screens is what the ruling closed. The masthead below carries the same
// name in all three phases. Route, metadata KEY and every href are unchanged —
// this is display copy only.
//
// 🛠 AND AGAIN 2026-09-25: THE EVENT HUB MAKER. Owner, verbatim: the Event Hub
// Controller becomes the **Event Hub Maker** — "label change only; menu key
// `launch` and routes unchanged". This page is now the Maker's full-screen
// shell (`MakerShell`); everything the controller measured and offered below
// is kept, word for word, and lives in the Maker's ⋯ sheet.
export const metadata = { title: 'Event Hub Maker' };

type Props = {
  params: Promise<{ eventId: string }>;
  /** `?viewas=<role>` — VIEW AS. A string from the address bar and nothing
   *  more: `resolveArmedHubRole` checks it against the list this viewer was
   *  offered, so it can never arm a read they may not have.
   *  `open` · `pin` · `scene` · `chain` are the Maker's: where a save lands
   *  back (the row, the pin result, the scene) and the rest of a drag. */
  searchParams?: Promise<{
    viewas?: string | string[];
    stage?: string | string[];
    open?: string | string[];
    pin?: string | string[];
    scene?: string | string[];
    chain?: string | string[];
    /** Phase 6: `?tool=hero|reveal|logo` opens that made-once workspace.
     *  `?tool=details&item=<key>` opens Details on one item; an old
     *  `?tool=prints` (Prints & Tickets, folded into Details 2026-09-28) opens
     *  Details at the same piece, and an old `print_theme` on its Theme item
     *  (`lib/maker-details-items.ts`). */
    tool?: string | string[];
    item?: string | string[];
    /** 🪜 `?guide=1` opens Details on its guided "What's left" — "Which stage do you
     *  want ready?" (PR-2); `?guide=walk-rsvp` walks the Invitation, `?guide=ready-event`
     *  is The Day's Ready screen (`lib/details-guided-flow.ts` `parseGuideParam`). */
    guide?: string | string[];
    /** `?date=help` — Details › Date opens on "Help me choose" (where /find-date lands). */
    date?: string | string[];
    print_theme?: string | string[];
    print_saved?: string | string[];
    print_error?: string | string[];
    /** A draft save that did NOT land (`hubDraftBounceHref` in `lib/hub-draft.ts`):
     *  `too_large` · `failed`. The toolbar says it beside Apply. */
    draft_error?: string | string[];
    pass_format?: string | string[];
    invitation_format?: string | string[];
    card_format?: string | string[];
    /** The Menu editor's save result (`/api/hub-print/menu`). */
    menu_saved?: string | string[];
    menu_error?: string | string[];
    /** 🪑 Details › Seat plan: the plan's view — `3d` streams the 3D lab in, `list` opens on the List. */
    seat?: string | string[];
    /** 📦 Details › Schedule (the Schedule page, moved whole): its own query. */
    view?: string | string[];
    ros?: string | string[];
    note?: string | string[];
    host_answers?: string | string[];
    /** 📦 Details › Love Story (the scrapbook, moved whole): a save's flash. */
    saved?: string | string[];
    drafted?: string | string[];
    error?: string | string[];
    pro?: string | string[];
    slotted?: string | string[];
  }>;
};

const one = (v: string | string[] | undefined): string | undefined =>
  typeof v === 'string' ? v : undefined;

/**
 * THE EVENT HUB CONTROLLER — the couple's side of their one public address.
 *
 * Design: `EVENT_HUB_CONTROLLER_DESIGN_2026-09-02.md` (§ 2 the five jobs, § 3.3
 * the seven slots, § 4 the craft numbers, § 6 the twelve inputs).
 * Drawing: `prototypes/event_hub_controller_2026-09-02.html`.
 *
 * ── WHAT CHANGED, AND WHAT DELIBERATELY DID NOT ────────────────────────────
 * This page already held BOTH halves the owner asked to integrate: the three
 * day-of services with their day-of verb, and the four public stages of the one
 * link via `PUBLIC_SITE_PAGES`, with "Active now" on the live one. What was
 * wrong was the ORDER (rows of text first, the couple's actual page nowhere)
 * and the AUDIENCE (every branch was written for the wedding day, so the months
 * before — when the save-the-date and the invitation ARE the product — and the
 * months after, when the story is, got the day-of page with one word changed).
 *
 * So this is a promotion and a restructure, not a build. The order is now the
 * control-centre order:
 *
 *   S1 the stage · S2 the four facts · S3 one next step · S4 the parts
 *   (four stages, then three services) · S5 set once · S7 offers last
 *
 * Every route, every ownership predicate and every card body below is the one
 * that already shipped. `resolveAddOnState` / `eventSkuActive('LIVE_WALL')` /
 * `eventPapicActive()` are read exactly as they were.
 *
 * ⛔ NO OFFERS ON THE EVENT DAY (§ 5.1 rule 3). `hubOffersAllowed` is true only
 * in `plan`: on the day the upsell branch collapses to nothing, because an offer
 * never outranks the day. After the day the row CLOSES ("Event over") rather
 * than selling a night that has finished — the shipped behaviour, kept.
 * ⛔ AND NO CONFIRMATION DIALOG on any day-of verb. Friction at a ceremony is
 * worse than the thing it prevents.
 *
 * ── 🔑 UNREAD IS NOT EMPTY, AND THE MEASUREMENT REACHES THE RENDER ─────────
 * Both reads this page states facts from now carry a `measured` flag. Without
 * it a refused `events` read yields a null date, and BOTH resolvers answer that
 * null honestly — 'save_the_date' and 'plan' — so a wedding that happened last
 * month renders as "Save-the-Date live · Stage 1 of 4", byte-identical to a
 * brand-new event. A refused guest read would print "0 of 0 in" to a couple with
 * 180 names. A log line never changed a pixel; the flag is what reaches the eye.
 *
 * ── OWNERSHIP NOTES CARRIED FORWARD, UNCHANGED ─────────────────────────────
 * ⚠ PAPIC'S GATE WAS `eventPapicSeatsActive()` AND THAT CARD COULD NEVER LIGHT
 * UP (fixed 2026-07-30). `PAPIC_SEATS` — the five-seat pass — is `is_active =
 * false` in prod with ZERO orders ever, and the 2026-07-29 two-type lock retired
 * the product outright. So on the one page that exists to say "start this now,
 * it's your wedding day", Papic was permanently stuck on the upsell branch for
 * EVERY couple. Now gated on `eventPapicActive()`, the canonical predicate.
 *
 * Couple OR delegated coordinator (mirrors /live + /guests/checkin), asked
 * through `isHostMemberType` rather than a re-typed literal — one definition of
 * "host" is the whole lesson of `loadHostMembership`, which selected
 * `member_type` and then never compared it.
 */
export default async function LaunchHubPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = searchParams ? await searchParams : {};
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  // 🔁 A schema-cache blip retries, and one that outlasts it throws (the browser
  // shows "Reconnecting…") — never the redirect below. lib/read-retry.ts.
  const { data: membership, error: membershipError, status: membershipStatus } = await withSchemaRetry(() =>
    supabase.from('event_members').select('member_type').eq('event_id', eventId).eq('user_id', user.id).maybeSingle(),
  );
  if (isTransientReadError(membershipError, membershipStatus)) throw schemaBlipError('LaunchPage.membership', membershipError);
  if (membershipError) {
    logQueryError(
      'LaunchPage.membership',
      membershipError,
      { event_id: eventId },
      'graceful_degrade',
    );
  }
  if (!isHostMemberType((membership as { member_type?: string | null } | null)?.member_type)) {
    redirect(`/dashboard/${eventId}`);
  }

  /*
    🔒 MAY THIS VIEWER SEE THE REPLIES AT ALL?

    A delegate the host never shared the guest list with reads ZERO guest rows —
    an RLS refusal and an empty event are the same value — so without this the
    facts strip would tell a coordinator that nobody has replied. That is a
    third state, and it is NOT the refused-read state: `event-viewer.ts` says it
    in its own words, "a stranger and a delegate-without-the-grant both read
    nothing and the screen must say different things to them."

    ⛔ AND IT IS NOT A LOCKED PAGE. The rest of this controller — the stage, the
    four channels, the three day-of services — is exactly what a coordinator is
    here to run. Only the two reply facts are withheld, and they say so.
  */
  const viewer = await fetchEventViewer(supabase, eventId, user.id);
  const mayReadGuestList = !isDelegateWithoutArea(viewer, 'guest_list');

  /*
    The gated read gets its OWN statement rather than sitting as a ternary inside
    the `Promise.all([…])` array — a source guard walking back from the call to
    find its condition stops at the enclosing `(` and cannot see a gate that far
    out. Concurrency is unchanged: the promise is still started here and awaited
    with the others below.
  */
  const guestReadPromise = mayReadGuestList
    ? fetchGuestsByEventMeasured(supabase, eventId)
    : Promise.resolve({ rows: [], measured: false });

  const base = `/dashboard/${eventId}`;
  // Every paid-feature read below asks "does THIS EVENT hold it?" (owner
  // 2026-10-02) — the one host-facing resolver, never the visitor's own session.
  const ent = await eventEntitlementClient(eventId);
  const [
    ownsLiveWall,
    panoodState,
    hasPapic,
    eventRes,
    guestRead,
    proActive,
    proOwned,
    proSku,
    guestColumnsOn,
  ] = await Promise.all([
    eventSkuActive(ent, eventId, 'LIVE_WALL'),
    // ⭐ 2026-07-27 — 'live-studio-roam', NOT 'panood'. ADD_ON_SKU_MAP (lib/add-on-stats.ts)
    // maps `panood` → the two RETIRED Cast SKUs and `live-studio-roam` → the live
    // `LIVE_STUDIO`. SKU_OWNERSHIP_ALIASES does NOT expand at this layer, so
    // keying on `panood` means the first couple who actually PAYS resolves to
    // not-owned — an "Add" button on the day of their wedding instead of "Go live".
    resolveAddOnState(ent, eventId, 'live-studio-roam', 'couple'),
    eventPapicActive(ent, eventId),
    // Slug + date drive the stage and the four facts. `timezone` + `event_end_date`
    // added 2026-08-21: the resolvers used to read the SERVER's clock (UTC on
    // Vercel), so which named page the live QR was said to resolve to could be a
    // day out.
    supabase
      .from('events')
      // `event_type` added 2026-09-02 (EH6): the retired /website hub showed its
      // "Our story" door to weddings only, and that door moved here. One more
      // column on a query already running — not a second read.
      .select('slug, event_date, event_end_date, cleared_at, timezone, event_type, planning_mode')
      .eq('event_id', eventId)
      .maybeSingle(),
    // S2 fact 2 + 3. The MEASURED read, never the array-only wrapper: this page
    // renders a count and a zero-state, which is exactly the case its docblock
    // says must not use the wrapper. Asked only when this viewer may have it —
    // see `mayReadGuestList` above.
    guestReadPromise,
    /*
      🔒 THE OFFER'S GATE, MEASURED — NOT INFERRED FROM A DEFAULT.

      Papic's card could never light up for a year because it was gated on a
      retired SKU, and a gate that can only answer one way renders identically to
      a gate that works. So BOTH readers are asked, and both are the canonical
      ones already used by the shipped buy surface (`studio/website-pro`):

        · `eventCoupleWebsiteProActive` — admin-approved, the feature gate.
        · `eventOwnsCoupleWebsitePro`   — counts a still-in-reconciliation
          'submitted' order, so a couple mid-review is never asked to buy the
          same unlock twice.

      The offer is suppressed by EITHER. Both graceful-degrade to `false` — which
      SHOWS the offer — so a refused entitlement read can at worst offer an
      upgrade to somebody who has it, never hide a page behind a lock.
    */
    // 👁 Both as the viewer is SHOWN them (`lib/view-as-free.server.ts`).
    asViewed(eventCoupleWebsiteProActive(ent, eventId).catch(() => false)),
    asViewed(eventOwnsCoupleWebsitePro(ent, eventId).catch(() => false)),
    /*
      ⛔ THE PRICE, READ LIVE. `platform_retail_catalog_v2` is admin-managed and
      is the only figure a customer is ever charged. Null on failure, and the
      panel then renders with no number rather than a remembered one.
    */
    formatV2Sku('COUPLE_WEBSITE_PRO').catch(() => null),
    /*
      The Guest Columns door's gate, carried over with the door from the retired
      /website hub — the env flag AND the `guest_columns` DPO control, asked
      through the one shipped resolver rather than re-derived here.

      ⚠ FALSE ON FAILURE, which is the opposite default from the Pro offer above
      and deliberately so: a refused read there can only over-OFFER, while here
      it would show a door into a feature that is switched off. The hub's own
      words for this were "no dead door".
    */
    guestColumnsActive().catch(() => false),
  ]);

  if (eventRes.error) {
    logQueryError(
      'LaunchPage.event',
      eventRes.error,
      { event_id: eventId },
      'graceful_degrade',
    );
  }
  const eventRow = eventRes.data as {
    slug?: string | null;
    event_date?: string | null;
    event_end_date?: string | null;
    cleared_at?: string | null;
    timezone?: string | null;
    event_type?: string | null;
    planning_mode?: string | null;
  } | null;

  /*
    🔑 `measured: false` means WE DO NOT KNOW — not "no event". A refused read
    and an event whose row is genuinely absent are different facts, and only the
    first one must silence the stage. (`maybeSingle` returns `data: null` with
    no error for a genuinely missing row; that is a measured absence.)
  */
  const eventRead: HubEventRead = {
    measured: !eventRes.error,
    eventDate: eventRow?.event_date ?? null,
    eventEndDate: eventRow?.event_end_date ?? null,
    clearedAt: eventRow?.cleared_at ?? null,
    timezone: eventRow?.timezone ?? null,
    slug: eventRow?.slug ?? null,
  };
  const eventSlug: string | null = eventRead.slug ?? null;

  const guestFacts: HubGuestRead = {
    shared: mayReadGuestList,
    measured: guestRead.measured,
    invited: guestRead.rows.length,
    replied: guestRead.rows.filter((g) => g.rsvp_status !== 'pending').length,
  };

  const standing = resolveHubStanding(eventRead);

  /*
    ══ EH5 · THE WORKROOM'S OWN READ ══
    Asked ONLY when the live channel is the story — every couple still in
    `plan`/`dayof` costs this page nothing extra for a channel they cannot
    reach yet. `event_editorial` and `guest_columns` are both composer/guest
    -owned and read via the admin client (design § 2.4's own words), beside
    the event row read under RLS above — the same split `studio/guest-columns`
    already uses.
  */
  let editorialRead: HubEditorialRead | null = null;
  if (standing.stage === 'editorial') {
    let admin: ReturnType<typeof createAdminClient> | null = null;
    try {
      admin = createAdminClient();
    } catch {
      admin = null;
    }
    const editorialRes = admin
      ? await admin
          .from('event_editorial')
          .select('status, draft_json, essay_photo_ids')
          .eq('event_id', eventId)
          .maybeSingle()
      : { data: null, error: new Error('admin client unavailable') };
    if (editorialRes.error) {
      logQueryError(
        'LaunchPage.editorial',
        editorialRes.error,
        { event_id: eventId },
        'graceful_degrade',
      );
    }
    const editorialRow = editorialRes.data as {
      status?: string | null;
      draft_json?: Record<string, unknown> | null;
      essay_photo_ids?: string[] | null;
    } | null;
    const chaptersWritten = readChapterOverrides(editorialRow?.draft_json ?? {}).filter(
      (o) => !o.hidden && !!o.writeUp,
    ).length;

    let columnsMeasured = false;
    let columnsPending = 0;
    if (guestColumnsOn && admin) {
      const { count, error: colErr } = await admin
        .from('guest_columns')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('status', 'pending');
      if (colErr) {
        logQueryError(
          'LaunchPage.guestColumnsPending',
          colErr,
          { event_id: eventId },
          'graceful_degrade',
        );
      } else {
        columnsMeasured = true;
        columnsPending = count ?? 0;
      }
    }

    editorialRead = {
      measured: !editorialRes.error,
      status: editorialRes.error
        ? null
        : ((editorialRow?.status as 'draft' | 'published' | null) ?? 'draft'),
      chaptersWritten: editorialRes.error ? null : chaptersWritten,
      photosIn: editorialRes.error ? null : (editorialRow?.essay_photo_ids?.length ?? 0),
      columnsOn: guestColumnsOn,
      columnsMeasured,
      columnsPending,
    };
  }

  const facts = resolveHubFacts(eventRead, guestFacts, undefined, editorialRead);
  const nextStep = resolveHubNextStep(standing, eventRead, guestFacts, editorialRead);
  const offersAllowed = hubOffersAllowed(standing.phase);

  /*
    ══ THE ONE UNLOCK, RESOLVED FOR THE CHANNEL THE COUPLE IS STANDING ON ══
    § 5.3: the nine Pro items are ONE purchase, so the controller does not grow
    nine upgrade slots — it grows one, and moves it to whichever of the four
    public pages is live. `resolveHubProOffer` returns null far more often than
    not: when the couple owns it, when the read did not happen, on the day, and
    after it.

    ⚠ THE GATE IS EH1'S, IS CALLED, AND IS NEVER RE-DERIVED. `hubOffersAllowed`
    is `phase === 'plan'`, and that ONE LINE DOES THREE JOBS — its own docblock
    in `lib/event-hub-control.ts` names all three: on the day (an offer never
    outranks the day), after the day (the owner's 2026-08-21 ruling, "stop
    selling the day itself once the day is over", guarded by
    `lib/stop-selling-the-day-after-the-day.test.ts`), and UNMEASURED, where we
    do not know whether it is their wedding day and an unread state must never
    become a sale. 🛑 Settled and owner-ruled: do not widen it, do not relax it to
    day-only, and do not add a second gate here. A consequence worth naming
    rather than discovering: the Day-of and Editorial channels therefore never
    carry an offer, because the stage only reaches them once the phase is
    'dayof' or 'after' — that is the ruling working, not a gap.
  */
  const proOffer = resolveHubProOffer({
    channel: standing.stage,
    phase: standing.phase,
    ownsPro: proActive || proOwned,
  });
  const proPriceLabel = proSku?.price_php != null ? formatPhp(proSku.price_php) : null;

  // 🔒 The Event Hub itself is a planning surface and stays open in the store
  // shell; only the PRO upsell — which prints a peso price for a digital SKU —
  // is withheld (App Review 3.1.1). See lib/store-shell.ts.
  const storeShell = await isStoreShellRequest();

  /* 👁 VIEW AS A FREE COUPLE — offered to an internal (§10a) viewer only, and
     read through the same per-request cache every Pro read above passed
     through, so the switch's state and what the page drew cannot disagree. */
  const freeSwitch = await viewAsFreeSwitch();

  /*
    ─── VIEW AS ──────────────────────────────────────────────────────────────
    Owner 2026-09-02: "make sure it also has view as (they pick what each role
    sees)."

    🔒 The offer list is computed from `membership.member_type` through
    `hubPreviewRoles`, which asks `isHostMemberType` — the ONE definition of
    "host" this repo keeps, and the comparison whose absence once let a
    `guest`-typed `event_members` row open a private site and jump to phases the
    couple had not launched. The gate above already redirected such a viewer;
    this is the same fact asked a second time, at the place that hands out the
    doors, so no future refactor of the redirect can silently open them.

    The NAMED read — one real guest's personal page rendered to the host — is
    the only privacy surface here and ships DARK behind
    `hubNamedGuestPreviewEnabled()`. Nothing on this page reads a guest by name
    either way: even with the flag on, the seat-holder door is the FABRICATED
    sample that `lib/simulated-guest-preview.ts` already ships.
  */
  const offeredRoles = hubPreviewRoles({
    memberType: (membership as { member_type?: string | null } | null)?.member_type,
    namedGuestEnabled: hubNamedGuestPreviewEnabled(),
  });
  const armedRole = resolveArmedHubRole({ param: search.viewas, offered: offeredRoles });
  /*
    ─── WHO × WHEN ─────────────────────────────────────────────────────────
    Owner 2026-09-24, pointing at "View as" and the four stage cards: *"this 2
    can integrate to each other"*. So each role's read is resolved for EACH of
    the four stages, here, by the same pure function — and the stage picks the
    row for whichever stage the couple is looking at. Five roles × four stages
    of plain strings; no I/O, nothing new asked of the database.

    `?stage=` is the "When" switch's deep link, checked against the four real
    phases by `resolveHubStageSelection`; anything else opens on today's.
  */
  const roleViewsByPhase = Object.fromEntries(
    PUBLIC_SITE_PAGES.map((page) => [
      page.phaseParam,
      offeredRoles.map((role) =>
        resolveHubRoleView({ role, standing, slug: eventSlug, guests: guestFacts, stage: page.phaseParam }),
      ),
    ]),
  );
  const initialStage = resolveHubStageSelection({ param: search.stage, live: standing.stage });

  /*
    ─── HAS THIS CELEBRATION ALREADY HAPPENED? ──────────────────────────────
    ONE resolver — the same one the Overview, the rail, the guest list, the
    Hosts page and the Suite ask, reached here through `resolveHubPhase`. Owner
    2026-08-21 on the day-of services: **"stop offering them."**
  */
  const eventHasHappened = standing.phase === 'after';
  const activeChannel = PUBLIC_SITE_PAGES.find((p) => p.phaseParam === standing.stage) ?? null;

  type Service = {
    key: string;
    name: string;
    blurb: string;
    owned: boolean;
    launchLabel: string;
    launchHref: string;
    addHref: string;
    Icon: LucideIcon;
  };

  const services: Service[] = [
    {
      key: 'panood',
      name: 'Live Watch — livestream',
      blurb: eventHasHappened
        ? 'This one runs during the celebration.'
        : 'Bring everyone who could not make it into the room.',
      owned: panoodState.state === 'launch',
      launchLabel: 'Go live',
      // ONE CONTROLLER (Wave 6): the day-of "Go live" button follows the flag —
      // unified controller when it's on, legacy Cast control room until then.
      // This is the highest-stakes doorway in the app (it is pressed once, at the
      // wedding), so it must never be the one left pointing at the retired room.
      launchHref: liveStudioControllerHref(eventId),
      // The BUY doorway follows the same unification: `/studio/panood` is the Cast
      // detail page for a retired SKU and offers no buy control.
      addHref: `${base}/studio/live-studio-control`,
      Icon: Radio,
    },
    {
      key: 'livewall',
      name: 'Live Photo Wall',
      blurb: eventHasHappened
        ? 'This one runs at the venue, on the day.'
        : 'Project guest photos at the venue in real time.',
      owned: ownsLiveWall,
      launchLabel: 'Open the wall',
      launchHref: `${base}/live`,
      addHref: studioHubHref(eventId),
      Icon: MonitorPlay,
    },
    {
      key: 'papic',
      name: 'Papic — candid capture',
      // ⚠ "share these 5 seat links" / "shooter seats" was the retired five-seat
      // pass talking (owner naming lock 2026-07-30: the two products are Papic
      // Pool and Papic One — there is no seat pass and no "seat link"). It also
      // stated a COUNT the app cannot honour: Papic One has no seat cap, and Pool
      // cameras are unlimited by construction. No number here: the crew page
      // derives what this event actually holds.
      blurb: eventHasHappened
        ? hasPapic
          ? 'Your cameras have stood down — the photos are in your galleries.'
          : 'Cameras are handed out on the day.'
        : hasPapic
          ? 'Your cameras are ready — hand them out and the day gets caught from every angle.'
          : 'Hand a camera to anyone you trust and the day gets caught from every angle.',
      owned: hasPapic,
      launchLabel: 'Hand out cameras',
      launchHref: `${base}/studio/papic/crew`,
      addHref: `${base}/studio/papic`,
      Icon: Camera,
    },
  ];

  /*
    S5 · SET ONCE. Doors, never editors — the pattern licenses NO deletions and
    every one of these screens keeps its own page and its own route (prototype
    § 5, the port contract). Recreating a working screen is a defect.
  */
  /*
    ⭐ TWO DOORS MOVED HERE FROM THE RETIRED /website HUB (2026-09-02, EH6).

    The hub carried six QuickLinks. Four of its destinations are reached from
    elsewhere and were left alone — `/invitation` from the checklist, guest
    detail and the QR page; `/website/privacy` from the editorial editor;
    `/website/editor` and `/story` already sit above. TWO were
    reachable from the hub and NOWHERE else, and folding the hub without them
    would have orphaned a shipped page each:

      · `/website/our-story`      — no other link in the tree
      · `/studio/guest-columns`   — not in the catalog, no other link

    `lint-port-no-lost-controls` is what caught this, which is the whole reason
    that guard exists: the merge looked complete and typechecked clean, and two
    pages had quietly become unreachable.

    🔒 BOTH GATES ARE THE HUB'S OWN, REPRODUCED, NOT RE-DECIDED. Our story was
    wedding-only there; Guest columns was behind `guestColumnsActive()` — the
    env flag AND the DPO control — under the hub's own comment "no dead door".
    A door shown for a feature that is off is worse than no door.
  */
  /*
    The E-Gifts door's OWN gate, REPRODUCED and not re-decided.

    There is exactly one other dashboard door to the same page — the Studio tile
    — and it gates on `surfaceEnabled(profile, 'website')` (studio/page.tsx
    `websiteOn`). Same helper, same fallback, same spelling. `resolveProfileByEvent`
    is cache()d, so this is not a second read.

    ⚠ ITS OWN `await`, DELIBERATELY OUTSIDE THE `Promise.all([…])` ABOVE — that
    array carries a source guard which walks back from a call to find its
    condition and stops at the enclosing `(`. Adding a gated entry inside it
    would hide the gate from the guard, which is the exact trap the comment
    above `guestReadPromise` already documents.

    ⚖ NOT gated on `PABUYA_PUBLIC_ROUTE_ENABLED`, and NOT on having a method
    already: this is the SET-UP page. Its own three-state preview explains a
    dark flag, and the whole reason to show the door is so the couple can add
    their first destination. A door that appears only once you no longer need it
    is not a door.
  */
  const websiteOn = surfaceEnabled(await resolveProfileByEvent(eventId), 'website');

  /*
    B4 — the footnote's own budget link, gated on the SAME check the
    destination performs (budget/page.tsx: `if (!surfaceEnabled(profile,
    'budget')) redirect(...)`). Without this the footnote offers a link that
    immediately bounces back here — a circular door. `resolveProfileByEvent`
    is cache()d, so this is not a second read.
  */
  const budgetOn = surfaceEnabled(await resolveProfileByEvent(eventId), 'budget');

  const setOnce: Array<{ key: string; label: string; hint: string; href: string }> = [
    { key: 'editor', label: 'The page itself', hint: 'Copy, photos, colours, music', href: `${base}/website/editor` },
    { key: 'story', label: 'The story', hint: 'Chapters, guest columns, the album', href: `${base}/story` },
    ...(eventRow?.event_type === 'wedding'
      ? [{ key: 'ourstory', label: 'Our story', hint: 'How you met, the spark, the yes', href: `${base}/website/our-story` }]
      : []),
    ...(guestColumnsOn
      ? [{ key: 'columns', label: 'Guest columns', hint: 'Approve or return what your guests wrote', href: `${base}/studio/guest-columns` }]
      : []),
    /*
      🔴 THE THIRD ORPHAN — CTRL-B3 build 3, added 2026-09-22.

      `/website/stories` is the host deciding which supplier-authored stories
      appear on their celebration (owner, 2026-08-15: *"the user can decide to
      add it or not"*). It shipped with **no link from anywhere in the app** —
      only its own `actions.ts` and two test files named the path. The register
      chased every apparent orphan route in the tree and found the rest were
      deliberate redirects; this was the single real exception.

      🔑 IT BELONGS ON EXACTLY THIS LIST, for the reason the comment above
      gives: `our-story` and `guest-columns` were "reachable from the hub and
      NOWHERE else", and folding the hub would have orphaned a shipped page
      each. This one was already in that state before the fold — it simply had
      no hub entry to lose.
    */
    { key: 'stories', label: 'Stories about your day', hint: 'Choose which supplier stories appear on your page', href: `${base}/website/stories` },
    { key: 'guests', label: 'Guests and replies', hint: 'Names, invites, who is coming', href: `${base}/guests` },
    { key: 'schedule', label: 'The running order', hint: 'What happens, and when', href: `${base}/schedule` },
    /*
      E-Gifts. The couple's gift page was reachable from the customer nav and
      from the Studio tile, but NOT from the Event Hub Controller — the surface
      whose whole job is to list the rooms of their event. `label` is spelled
      exactly as the Studio tile spells it, so one page does not answer to two
      names on the couple's own side.
    */
    ...(websiteOn
      ? [{ key: 'pabuya', label: 'E-Gifts', hint: 'Your own GCash, Maya or bank account', href: `${base}/pabuya` }]
      : []),
  ];

  const phaseTitle =
    standing.phase === 'dayof'
      ? 'Your Event Hub Maker — today'
      : standing.phase === 'after'
        ? 'Your Event Hub Maker'
        : 'Your Event Hub Maker';

  /*
    ══ THE EVENT HUB MAKER (2026-09-25) ══════════════════════════════════════
    The couple edits here: the work area is the editor page's own component,
    rendered with every panel it always built (`maker=1` tells it it is inside).
    A coordinator — or an event type with no Event Hub — gets the controller
    below as the whole canvas, exactly as before; the editor was always
    couple-only, and it still is (its own gate redirects anybody else).
  */
  const memberType = (membership as { member_type?: string | null } | null)?.member_type;
  const hasWork = makerHasWork(memberType, websiteOn);

  /* First visit = ONE quiet line on the canvas, "Tap anything to change it"
     (the Maker in 4, 2026-10-02 — no slides and no Pro before the first tap;
     the first touch records it). The same read `MiniTour` makes.
     ⚠ A refused read shows nothing: an unread row must not replay the line on
     every visit, and ⋯ › About the Maker still opens the short tour. */
  const { data: seenRow, error: seenError } = await supabase
    .from('users')
    .select('tour_seen_keys')
    .eq('user_id', user.id)
    .maybeSingle();
  if (seenError) {
    logQueryError('LaunchPage.tourSeen', seenError, { event_id: eventId }, 'graceful_degrade');
  }
  const firstVisit =
    hasWork &&
    !seenError &&
    !(((seenRow as { tour_seen_keys?: string[] | null } | null)?.tour_seen_keys ?? []) as string[]).includes(
      MAKER_TOUR_KEY,
    );

  const liveStage = activeChannel && isStagePhase(activeChannel.phaseParam) ? activeChannel.phaseParam : null;
  const makerStage = initialStage ?? liveStage ?? 'rsvp';

  const controller = (
    /* THE STAGE MEASURE (`app/[slug]/_lib/measures.ts` STAGE = max-w-5xl): the
       widest anything may ever be. Everything under the stage keeps the PLATE. */
    <div className="mx-auto w-full max-w-5xl">
      <PageMasthead title={phaseTitle} />

      {/* ══ S1 · THE STAGE + S2 · THE FOUR FACTS ══
          The content is the first paint, never a form. Lives in its own file so
          a test can RENDER it at all three phases — see `hub-stage.tsx`. */}
      <HubStage
        slug={eventSlug}
        standing={standing}
        facts={facts}
        livePhase={activeChannel ? activeChannel.phaseParam : null}
        initialPhase={initialStage}
        /* 🛑 PLAIN DATA ONLY — `PUBLIC_SITE_PAGES` carries a lucide `Icon` per
           stage, and the stage is a client component. A component crossing
           server→client took production down on 2026-09-23. */
        stages={PUBLIC_SITE_PAGES.map((page) => ({ phase: page.phaseParam, blurb: page.blurb }))}
        editHref={`${base}/website/editor`}
        rolesByPhase={roleViewsByPhase}
        armedRole={armedRole}
        /* EH5 · channel 4 opens a workroom — same tab, the SHIPPED route. */
        workroomHref={`${base}/story`}
        eventId={eventId}
        /* Lands BACK here. The action's seven redirects used to name the
           invitation page literally — see `lib/slug-return.ts`. */
        slugAction={updateEventSlug.bind(null, eventId, 'launch')}
      />

      {/* ══ S3 · ONE NEXT STEP ══ */}
      {nextStep.key === 'unreadable' ? (
        /* The shape `/guests` uses for a refused read: what broke, what SURVIVED,
           what to do — survived first, because an error that only says what broke
           reads as loss. A plain anchor, not a Link: this needs a real round trip. */
        <section
          role="status"
          className="mt-6 rounded-xl border-t-[3px] border-mulberry/70 bg-mulberry/5 p-5 sm:p-6"
        >
          <p className="text-base font-extrabold tracking-tight text-ink">{nextStep.headline}</p>
          <p className="mt-2 max-w-prose text-sm text-ink/70">{nextStep.blurb}</p>
          <a href={`${base}${nextStep.ctaPath}`} className="button-secondary mt-4 inline-flex items-center">
            {nextStep.ctaLabel}
          </a>
        </section>
      ) : (
        <section className="mt-6 rounded-xl border border-terracotta/40 bg-terracotta/[0.04] p-5 sm:p-6">
          <p className="sn-eye">
            <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Right now
          </p>
          <p className="mt-1 text-base font-semibold tracking-tight text-ink">{nextStep.headline}</p>
          <p className="mt-1 max-w-prose text-sm text-ink/60">{nextStep.blurb}</p>
          <Link
            href={nextStep.ctaPath === '' && eventSlug ? `/${eventSlug}` : `${base}${nextStep.ctaPath}`}
            className="button-primary mt-4 inline-flex"
            {...(nextStep.ctaPath === '' && eventSlug
              ? { target: '_blank', rel: 'noopener noreferrer' }
              : {})}
          >
            {nextStep.ctaLabel}
          </Link>
        </section>
      )}

      {/* ══ S4 · THE FOUR STAGES OF THE ONE LINK — folded INTO the stage ══
          Owner 2026-09-24: *"this 2 can integrate to each other"*. The four
          bordered cards that stood here (Save-the-Date · RSVP · Day-of ·
          Editorial, each with Preview ↗, Editorial with "Open the workroom →")
          are now the stage's "When" switch: one frame, "Active now" on today's
          stage, ONE Preview ↗ for the stage picked, and the workroom door when
          Editorial is picked. Nothing was removed without its function moving —
          see `SiteStage`. */}
      {/* ══ THE ONE UNLOCK, OFFERED AT THE POINT OF ABSENCE (§ 5.1 rule 1) ══
            Attached to the stage above it, not parked in a rail at the foot of
            the page: the controller sells only what the couple is currently
            looking at and cannot have. Null — owned, unmeasured, or the day
            itself — renders nothing at all, and the stage above is UNCHANGED in
            either case. Nothing here dims, greys or locks it. */}
      {proOffer && !storeShell && (
        <section className="mt-6">
          <HubProOffer
            offer={proOffer}
            channelName={activeChannel?.name ?? null}
            priceLabel={proPriceLabel}
            base={base}
          />
        </section>
      )}

      {/* ══ S4b · THE PARTS — then the three services that run on the day ══ */}
      <section className="mt-10">
        <header className="space-y-1">
          <p className="sn-eye">
            <Radio aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> The Day
          </p>
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
            {standing.phase === 'dayof' ? 'Running now' : 'What runs on the day'}
          </h2>
          <p className="max-w-prose text-sm text-ink/60">
            {standing.phase === 'dayof'
              ? 'One press each — no confirmations, and nothing here is for sale today.'
              : eventHasHappened
                ? 'These ran during the celebration. What they caught is in your galleries.'
                : 'They stay quiet until the day, then they are one press each from here.'}
          </p>
        </header>

        <div className="mt-4 space-y-3">
          {services.map((s) => {
            const Icon = s.Icon;
            return (
              <article
                key={s.key}
                className={`sn-row flex items-center justify-between gap-4 p-4 sm:p-5 ${
                  s.owned ? '' : 'border-dashed'
                }`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      s.owned ? 'bg-terracotta/10 text-terracotta' : 'bg-ink/5 text-ink/40'
                    }`}
                  >
                    <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <h3 className={`text-sm font-semibold ${s.owned ? 'text-ink' : 'text-ink/70'}`}>{s.name}</h3>
                    <p className="text-xs text-ink/55">{s.blurb}</p>
                  </div>
                </div>
                {s.owned ? (
                  /* ⛔ NO CONFIRMATION DIALOG. One press, at a ceremony. */
                  <Link
                    href={s.launchHref}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-terracotta-700 px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-terracotta-800"
                  >
                    {s.launchLabel}
                    <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
                  </Link>
                ) : eventHasHappened ? (
                  /* ⚠ CLOSED, NOT HIDDEN — the same shape the Suite uses. The row
                     still says what the service was; it just stops offering to
                     sell it for a night that has finished. */
                  <span
                    aria-disabled="true"
                    className="inline-flex shrink-0 items-center rounded-full border border-ink/10 bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/45"
                  >
                    Event over
                  </span>
                ) : offersAllowed ? (
                  <Link
                    href={s.addHref}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink"
                  >
                    <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Add
                  </Link>
                ) : null /* ⛔ THE DAY. The upsell branch collapses to nothing. */}
              </article>
            );
          })}
        </div>
      </section>

      {/* ══ S5 · SET ONCE — doors, never editors ══ */}
      <section className="mt-10">
        <header className="space-y-1">
          <p className="sn-eye">
            <PencilLine aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Set once
          </p>
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Where each part is written</h2>
        </header>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {setOnce.map((door) => (
            <Link
              key={door.key}
              href={door.href}
              className="sn-row flex items-center justify-between gap-3 p-4 transition-colors hover:bg-ink/[0.02]"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{door.label}</span>
                <span className="block text-xs text-ink/55">{door.hint}</span>
              </span>
              <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-ink/35" strokeWidth={2} />
            </Link>
          ))}
        </div>
      </section>

      {/* ══ S7 · THE BOUNDARY, DRAWN RATHER THAN IMPLIED (§ 5.1 rule 6) ══
          So the couple never hunts this page for something that was never here. */}
      <p className="mt-8 rounded-xl border border-dashed border-ink/15 p-4 text-xs text-ink/50">
        Booking suppliers lives in the <Link href="/marketplace" className="underline underline-offset-2">Merkado</Link>
        {budgetOn ? (
          <>
            , and what you have spent lives in your{' '}
            <Link href={`${base}/budget`} className="underline underline-offset-2">budget</Link>. Neither is here on
            purpose — this page is your public address and the things that run on it.
          </>
        ) : (
          <>. That is not here on purpose — this page is your public address and the things that run on it.</>
        )}
      </p>
    </div>
  );

  /* ══ PRINTS & TICKETS (Phase 9) ══ The couple's workspace only. One event
     read (the theme and the card words) and the Pro question — the pieces
     themselves are drawn by /api/hub-print, which asks the Pro question again
     and refuses on its own. */
  let details: { page: ReactNode; controls: ReactNode } | null = null;
  /* 🗳 The RSVP stage (owner 2026-09-30 re-plan) — built beside Details' RSVP
     item from the SAME reads, so the two can never show different settings. */
  let rsvpStage: ReactNode = null;
  /* 🪜 Is anything still left in the guided flow? (Details part 5) — decided
     from the same facts Details' rows are drawn from (`guidedFactsFrom`). An
     unfinished event's Maker opens on What's left unless the address names a
     place; the stages are never blocked. */
  let detailsUnfinished = false;
  const guideAddress = parseGuideParam(one(search.guide));
  const rawTool = one(search.tool);
  const itemNamed = Boolean(one(search.item));
  /* ✍ The Details items' own editors — ONE set, drawn by Details and by the
     stage's inspector when a fact is tapped there (`detailsFactEditors`). */
  let factEditors: Partial<Record<DetailsItemKey, ReactNode>> = {};
  /* 🧭 THE NEW MAKER — "Stages | Studio" (owner 2026-10-06; plan
     `EVENT_HUB_MAKER_STAGES_STUDIO_BUILD_PLAN_2026-10-06.md` PR 1): ON for the
     flag, or for an internal viewer (the reading View-as-free already made), and
     only where there is work. The ONE place it is decided — `MakerShell` is handed
     the boolean, and Studio's tiles are built only while it is on. */
  const stagesStudio = hasWork && makerStagesStudioEnabled({ internal: freeSwitch.offered });
  let studio: { tiles: StudioTileModel[] } | null = null;
  if (hasWork) {
    const printAdmin = createAdminClient();
    /* 🎁 Started beside the reads below, awaited where the E-Gifts field is built. */
    const egiftAllP = readEgiftMethods(supabase, eventId);
    const egiftVisibilityP = supabase.from('events').select('landing_page_visibility').eq('event_id', eventId).maybeSingle();
    /* 🧭 Studio › Info's Your Event Hub rows and What to bring — read only while the new Maker is on. */
    const studioHubP = stagesStudio
      ? supabase
          .from('events')
          .select('slug, landing_page_visibility, launch_mode, manual_phase, website_open_browse, std_launched_at, scheduled_launch_at, what_to_bring')
          .eq('event_id', eventId)
          .maybeSingle()
      : null;
    /* 🧱 THE MISSING FIELDS (owner 2026-10-07) — the registry link and the QR switch,
       and the live main background (the hero row's `main`). Read on their own so a
       refusal here never blanks Your Event Hub; each refusal is said, never guessed. */
    const studioMissingP = stagesStudio
      ? Promise.all([
          supabase.from('events').select('gift_registry_url, qr_shown').eq('event_id', eventId).maybeSingle(),
          printAdmin.from('invitation_widgets').select('config_json').eq('event_id', eventId).eq('widget_type', 'hero').maybeSingle(),
        ])
      : null;
    const [printEvent, printPro, rsvpHosts, printParents, egifts, printInputs, sampleVersion, feelRes, storyLiveRes, scheduleRes, announceOn] = await Promise.all([
      readPrintEvent(printAdmin, eventId),
      printOwnsPro(eventId),
      readRsvpHosts(eventId),
      parentGuestsForEvent(eventId),
      fetchEgiftMethods(printAdmin, eventId, { enabledOnly: true }),
      // ⚡ What the print previews are drawn from, hashed — their cache key.
      printInputsVersion(eventId).catch(() => null),
      // 🖼 The SAMPLE's print inputs, hashed — the theme gallery's prints are the
      // sample's (the same for every couple), cached once by this key.
      findSampleEventId()
        .then((id) => (id ? printInputsVersion(id) : null))
        .catch(() => null),
      // 💡 The onboarding feel — the gallery's "Suggested for you" label only; + the own-look columns (a re-tap of the current theme hands them back).
      printAdmin.from('events').select('mood_feel_key, site_bg_color, site_button_color, site_font_key, std_background').eq('event_id', eventId).maybeSingle(),
      // 💌 The live Love Story (the draft, read below, wins) — Details › Love Story.
      supabase.from('events').select('love_story').eq('event_id', eventId).maybeSingle(),
      // 🗓 The schedule's moments — Details › Schedule's ✓ and its pieces (a refused read says so, never "0").
      supabase
        .from('event_schedule_blocks')
        .select('block_id, label, start_at, parent_block_id, block_type, is_public')
        .eq('event_id', eventId)
        .order('start_at', { ascending: true })
        .order('sort_order', { ascending: true }),
      // Announce is a piece of the Schedule where it is on (the schedule page's own flag).
      isCoordinatorP3Enabled().catch(() => false),
    ]);
    if (storyLiveRes.error) logQueryError('LaunchPage.loveStory', storyLiveRes.error, { event_id: eventId }, 'graceful_degrade');
    if (scheduleRes.error) logQueryError('LaunchPage.scheduleMoments', scheduleRes.error, { event_id: eventId }, 'graceful_degrade');
    const scheduleMoments = scheduleRes.error
      ? null
      : ((scheduleRes.data ?? []) as Array<{
          block_id: string;
          label: string | null;
          start_at: string;
          parent_block_id: string | null;
          block_type: string | null;
          is_public: boolean | null;
        }>).filter(
          (b) => b.parent_block_id === null,
        );
    if (feelRes.error) logQueryError('LaunchPage.moodFeel', feelRes.error, { event_id: eventId }, 'graceful_degrade');
    if (printEvent) {
      const stored = parsePrintDetails(printEvent.print_details);
      // The Menu card's other sources (a booked caterer's lines, the schedule's food moments).
      const menuSources = await readMenuSources(eventId, stored.menu);
      /* 💾 The special message AND "what do you ask your guests?" both save
         into the DRAFT from here (the same door the editor's Text panel and
         the reveal picker use), so each shows the drafted value when the
         draft holds one. A draft that cannot be read shows the live value for
         both — ONE read serves them, so a couple with an unreadable draft
         does not also lose their special message to a second failed call. */
      let specialMessage: string | null = printEvent.special_message;
      /* ⏳ "DRAFT 1-3" (owner 2026-10-08): the thank-you words, Reply by and the opening line read
         the draft over live here, as every other drafted field does. `undefined` = not drafted. */
      let pabuyaMessage: string | null = printEvent.pabuya_message;
      let draftedDeadline: string | null | undefined = undefined;
      let draftedOpeningLine: string | null | undefined = undefined;
      let rsvpAsk: RsvpAskConfig = sanitizeRsvpAskConfig(printEvent.rsvp_ask_config);
      let rsvpAskDrafted = false;
      // 🎨 The theme being edited — drafted over live (picked on Details).
      let themeSaved: unknown = printEvent.invite_theme;
      // 💌 The Love Story's words — drafted over live, like the scrapbook shows them.
      let storyRaw: unknown = storyLiveRes.error ? null : (storyLiveRes.data as { love_story?: unknown } | null)?.love_story;
      // 🎨 The Look's "done" marks read the draft over live too (Details part 3).
      let draftedEvents: Record<string, unknown> = {};
      // 🏛 The venue cards' source and photo, drafted (owner 2026-10-04: venues wait for Apply).
      let draftedVenue: unknown = null;
      // 🖼 The drafted Look › Background (the hero row's `main`) — the guided Look step's "done" reads it.
      let draftedMain: unknown = undefined;
      // 🔳 The QR look being edited — drafted over live (owner 2026-09-29, "yes to all 3").
      let qrPrefs: unknown = printEvent.style_preferences;
      // 🚶 The Wedding March's drafted moves (owner 2026-10-06, "Wait for apply"); null = the draft could not be read.
      let draftedMarch: MarchStep[][] | null = null;
      try {
        const d = await readHubDraft(supabase, eventId);
        draftedMarch = d?.march ?? [];
        if (d) draftedEvents = d.events as Record<string, unknown>;
        if (d) draftedVenue = d.widgets.venue_map?.venue ?? null;
        if (d && d.widgets.hero && 'main' in d.widgets.hero) draftedMain = d.widgets.hero.main ?? null;
        if (d && 'invite_theme' in d.events) themeSaved = d.events.invite_theme;
        if (d && 'love_story' in d.events) storyRaw = d.events.love_story;
        if (d && 'style_preferences' in d.events) qrPrefs = d.events.style_preferences;
        if (d && 'special_message' in d.events) specialMessage = (d.events.special_message as string | null) ?? null;
        if (d && 'pabuya_message' in d.events) pabuyaMessage = (d.events.pabuya_message as string | null) ?? null;
        if (d && 'guest_list_edit_deadline' in d.events) draftedDeadline = (d.events.guest_list_edit_deadline as string | null) ?? null;
        const pd = d && 'print_details' in d.events ? (d.events.print_details as Record<string, unknown> | null) : null;
        if (pd && 'opening_line' in pd) draftedOpeningLine = (pd.opening_line as string | null) ?? null;
        if (d && 'rsvp_ask_config' in d.events) {
          rsvpAsk = sanitizeRsvpAskConfig(d.events.rsvp_ask_config);
          rsvpAskDrafted = true;
        }
      } catch (e) {
        console.error('[hub-draft] details could not read the draft:', e instanceof Error ? e.message : e);
      }
      /* ⏳ The opening line as drafted (owner 2026-10-08, "draft 1-3") — every Maker door reads `stored`. */
      if (draftedOpeningLine !== undefined) stored.openingLine = draftedOpeningLine;
      /* 🔢 ONE COUNT, STARTED NOW (owner 2026-10-05: "10 of 18" here, "9 of 18"
         on Event Details; review 2026-10-05: it ran serially, re-reading what
         this page had just read, on every refresh). The plan Home and Event
         Details count from (\`readGuidedPlan\`) — handed this page's own reads so
         it repeats none of them, and left running beside the rest of the page;
         awaited only where the guide is drawn. */
      /* 🎞 The film's background as the couple is editing it — the draft's, else
         live (`undefined` = unreadable: no "Same as theme" line is offered). */
      const filmBackgroundRead: unknown =
        'std_background' in draftedEvents
          ? draftedEvents.std_background
          : feelRes.error
            ? undefined
            : ((feelRes.data as { std_background?: unknown } | null)?.std_background ?? null);
      const sharedPlanP = readGuidedPlan({
        supabase,
        admin: printAdmin,
        eventId,
        pre: { event: printEvent, hosts: rsvpHosts, parents: printParents, drafted: draftedEvents, scheduleRows: scheduleMoments },
      }).catch(() => null);
      /* Each column "as the couple is editing it" (the draft's, else live) for the
         Look's ✓ is `guidedFactsFrom` below — one derivation, shared with the
         guided flow's decision to open (Details part 5). */
      /* ══ DETAILS (made-once) ══ what the stages and prints include, and every
         line of wording — each read from its one home. A PAGE in the Maker's
         body (owner 2026-09-25): what the details feed is the page, these
         fields its controls. */
      /* 🎨 THE THEME PICKER (owner 2026-09-28) — the ten, for every
         event type (Pro ones still Pro — DECISION_LOG 2026-10-01 "PRO THEMES
         OPEN TO EVERY EVENT TYPE"), Pro as `printPro` measured it,
         and the one the couple is editing through the one theme rule. */
      const mayShowStdFilm = await resolveProfile(printEvent.event_type ?? '')
        .then((p) => resolveWeddingOnlyParts(p).save_the_date_film)
        .catch(() => false);
      // 💎 On the web a drafted Pro theme is the one being edited even without
      // Pro — it is tried here and held at Apply (owner 2026-09-28, #6091). The
      // shell keeps the ownership half of the gate.
      const themeCurrent = resolveInviteTheme({ saved: themeSaved, ownsPro: printPro || !storeShell });
      /* 🎂 The celebration's type decides Details' items and switches (DECISION_LOG
         "THE PLAN ADAPTS TO EVERY EVENT TYPE — BUILT IN, NOT BOLTED ON"). An
         unreadable profile is the generic one — never a wedding. */
      const detailsProfile = await resolveProfile(printEvent.event_type ?? '').catch(() => GENERIC_PROFILE);
      /* 🎁 E-GIFTS, IN PLACE (owner 2026-10-06, "EVENT DETAILS IS REBUILT": "Give
         details: where you will receive egifts and the complete details"): the
         E-Gifts page's OWN manager — every method (shown and hidden), read through
         the couple's client exactly as that page reads it — drawn in the Your
         event form under "Accept gifts?". It writes live, as it always has. */
      const egiftManager = await (async () => {
        const [{ methods: all, read }, chrome] = await Promise.all([egiftAllP, egiftVisibilityP]);
        if (chrome.error) logQueryError('LaunchPage.egiftChrome', chrome.error, { event_id: eventId }, 'graceful_degrade');
        /* A refused read is SAID — never "no methods yet" with an add form under it. */
        if (!read) {
          return (
            <p role="alert" className="text-sm text-terracotta-700" data-details-egifts-failed="">
              Your gift details could not be read just now. Nothing was changed — please reopen this in a moment.
            </p>
          );
        }
        const row = (chrome.data ?? null) as { landing_page_visibility: string | null } | null;
        const words = eventWordsFromProfile(detailsProfile);
        const qrDisplayUrls: Record<string, string> = {};
        for (const m of all) if (m.qr_r2_key && m.qrDisplayUrl) qrDisplayUrls[m.qr_r2_key] = m.qrDisplayUrl;
        return (
          <>
          {/* The E-Gifts page's own writes — live, and said so (the thank-you beside it is too). */}
          <HubSavesImmediately />
          <PabuyaManager
            eventId={eventId}
            /* The preview's heading reads "E-Gifts for <the organizer word>" here — this
               page reads no name it does not need (`the-controller-wires-what-it-measured`). */
            coupleName={null}
            organizerPossessive={words.theOrganizerPossessive}
            theOrganizer={words.theOrganizer}
            slug={printEvent.slug}
            visibility={row?.landing_page_visibility ?? null}
            eventWasRead={row !== null}
            publicRouteEnabled={isPabuyaPublicRouteEnabled()}
            initialMethods={all.map((m) => ({
              egift_method_id: m.egift_method_id,
              method_kind: m.method_kind,
              label: m.label,
              account_name: m.account_name,
              handle: m.handle,
              qr_r2_key: m.qr_r2_key,
              note: m.note,
              is_enabled: m.is_enabled,
              qrDisplayUrl: m.qrDisplayUrl,
            }))}
            qrDisplayUrls={qrDisplayUrls}
          />
          </>
        );
      })();
      const themes = pickableInviteThemes();
      /* 🖨 THE COUPLE'S OWN PRINTS, folded in from Prints & Tickets (owner
         2026-09-28: "1 fold prints and tickets into details") — drawn in the
         theme being edited; the access is part of each picture's cache key. */
      const prints = {
        eventId,
        slug: printEvent.slug,
        theme: printThemeFor(printEvent, themeCurrent),
        ownsPro: printPro,
        storeShell,
        previewVersion: printInputs ? printPreviewVersion({ printInputs, ownsPro: printPro, storeShell }) : null,
        /* ✍ The drafted facts the previews draw (names, date, 🕒 ceremony time) —
           named in each preview's address, so the invitation shows them before Apply. */
        draftVersion: (() => {
          const printed = printDraftOf(draftedEvents);
          return printed ? printPreviewVersion({ draft: printed }) : null;
        })(),
        /* The Our Story poster prints the Love Story — the same read the print uses. */
        storyEmpty: !storyHasMoments(printStoryChapters(printEvent.love_story)),
        /* 🎫 The pass guests save — its saved look and the couple's zip's name. */
        /* …the DRAFTED look when the draft holds one (owner Q7 2026-10-02: it waits for Apply). */
        passDesign:
          typeof draftedEvents.print_details === 'object' && draftedEvents.print_details && 'pass_design' in draftedEvents.print_details
            ? passCardDesignFrom((draftedEvents.print_details as { pass_design?: unknown }).pass_design)
            : stored.passDesign,
        /* 🖼 The Our Story poster's own photo (owner 2026-09-29). */
        posterPhoto: stored.posterPhoto ?? null,
        passCardsZip: passCardsZipFileNameOf(printEvent),
        formats: {
          pass: formatFor('pass', one(search.pass_format))!,
          invitation: formatFor('invitation', one(search.invitation_format))!,
          card: formatFor('card', one(search.card_format))!,
        },
      };
      /* 👪 Each parent's OWN guest card (Details → The Invitation, option (a)):
         the one loader the Guest list uses, so the card posts every column. */
      const invitationBase = await fetchInvitationBase(eventId, printEvent.slug).catch(() => null);
      const parentCards = await Promise.all(
        printParents.map(async (p) => {
          const data = p.guestId ? await loadGuestCard(supabase, eventId, p.guestId).catch(() => null) : null;
          return {
            guestId: data ? p.guestId : null,
            name: p.name,
            card: data ? (
              <GuestCardBody
                eventId={eventId}
                data={data}
                invitationBase={invitationBase}
                photoDisplayUrl={null}
                variant="panel"
                returnTo={`/dashboard/${eventId}/launch?tool=details&item=invitation`}
                errorMessage={null}
                inviteFlash={null}
              />
            ) : null,
          };
        }),
      );
      /* 🗓 Details part 2a — "Your event": names, date, venues, parents &
         hosts, the march — each read from the column its own screen reads. */
      const yourEvent = await loadYourEvent({
        supabase,
        admin: printAdmin,
        eventId,
        mayShowStdFilm,
        parentCount: printParents.length,
        hostCount: rsvpHosts.length,
        helpFirst: one(search.date) === 'help',
        // ✍ The names, the date and the venues as the couple is editing them (drafted until Apply).
        drafted: draftedEvents,
        draftedVenue,
        draftedMarch,
      }).catch((e: unknown) => {
        console.error('[details] your event could not be read:', e instanceof Error ? e.message : e);
        return null;
      });
      /* ══ RSVP (guest pathway — owner 2026-09-27; moved WHOLE into Details ›
         Story & plans › RSVP, Details part 2b) ══ The guest's RSVP as they
         meet it is the item's picture (the Invitation on the SAMPLE
         seat-holder, reply open — `makerPageCanvasSrc`), and its settings sit
         beside it: one question at a time, what you ask, who can RSVP, reply
         by, and who is waiting in Requests. Every setting is ONE key of
         `events.rsvp_ask_config`, drafted like the rest of the Maker. */
      /* A COUNT, never names: this page reads no guest by name
         (`the-controller-wires-what-it-measured.test.ts`), and only a viewer
         who may read the guest list asks at all (`mayReadGuestList`). */
      const requestsCountRead = mayReadGuestList
        ? printAdmin
            .from('guests')
            .select('guest_id', { count: 'exact', head: true })
            .eq('event_id', eventId)
            .eq('entry_source', 'self_added_unlisted')
            .is('deleted_at', null)
        : null;
      const [deadlineRes, requestsRes] = await Promise.all([
        printAdmin.from('events').select('guest_list_edit_deadline, adaptive_pricing_mode').eq('event_id', eventId).maybeSingle(),
        requestsCountRead,
      ]);
      if (deadlineRes.error) logQueryError('LaunchPage.rsvpDeadline', deadlineRes.error, { event_id: eventId }, 'graceful_degrade');
      /* ⏳ Reply by as the couple is editing it — the draft's, else live (owner 2026-10-08, "draft 1-3"). */
      const deadlineNow: string | null =
        draftedDeadline !== undefined ? draftedDeadline : ((deadlineRes.data?.guest_list_edit_deadline as string | null) ?? null);
      if (requestsRes?.error) logQueryError('LaunchPage.rsvpRequests', requestsRes.error, { event_id: eventId }, 'graceful_degrade');
      const rsvpHome = printEvent.slug ? `/${printEvent.slug}` : null;
      const rsvpSrc = makerPageCanvasSrc(rsvpHome, 'rsvp-page', 'rsvp');
      const rsvpRepliedSrc = makerPageCanvasSrc(rsvpHome, 'rsvp-page', 'rsvp', { rsvpView: 'replied' });
      const rsvpStamp = String(Date.now());
      const rsvpItem = {
        page: rsvpSrc && rsvpRepliedSrc ? (
          <>
            <MakerRsvpCanvas questionsSrc={rsvpSrc} repliedSrc={rsvpRepliedSrc} stamp={rsvpStamp} />
          </>
        ) : (
          <p className="m-auto max-w-sm px-4 text-center text-sm text-ink/70" data-maker-page-no-address="">
            Set your Event Hub address in Event Details to see your RSVP here.
          </p>
        ),
        settings: (
          <MakerRsvpSettings
            eventId={eventId}
            /* 🧭 Studio › RSVP — the prototype's tool, over the same saves (new Maker only). */
            {...(stagesStudio
              ? { studio: true, celebration: { ownsPro: printPro, storeShell, colours: celebrationColours(boardSwatches(printEvent.role_palette)) } }
              : {})}
            current={rsvpAsk}
            drafted={rsvpAskDrafted}
            /* The couple's own deadline wins and is never overwritten; unset,
               the default of 30 days before the day is SHOWN (resolveReplyBy). */
            replyBy={
              deadlineRes.error
                ? null
                : resolveReplyBy({
                    deadline: deadlineNow,
                    eventDate: printEvent.event_date,
                  })
            }
            /* The 30-days-before default the field shows while no date of their own is set. */
            replyByFallback={resolveReplyBy({ deadline: null, eventDate: printEvent.event_date })?.date ?? null}
            /* ✍ Typed right here (no link out): the couple's own date and the
               pricing view its one writer (`updatePaxSettings`) posts beside it. */
            replyByOwn={
              deadlineRes.error
                ? null
                : {
                    deadline: deadlineNow,
                    pricingMode:
                      (deadlineRes.data as { adaptive_pricing_mode?: string | null } | null)?.adaptive_pricing_mode === 'final_only'
                        ? 'final_only'
                        : 'realtime',
                  }
            }
            requests={{
              /* A refused (or unasked) read is SAID (null), never a "0" that reads as nobody. */
              count: !requestsRes || requestsRes.error ? null : (requestsRes.count ?? 0),
              /* The shipped Requests rows (Keep · Remove · Link), in place — only
                 for a viewer who may read the guest list (the page checks the
                 couple itself). */
              list: mayReadGuestList ? (
                <Suspense fallback={<p className="text-sm text-ink/60">Opening your requests…</p>}>
                  <RequestsPage params={Promise.resolve({ eventId })} searchParams={Promise.resolve({ maker: '1' })} />
                </Suspense>
              ) : null,
            }}
          />
        ),
      };
      /* 🗳 THE RSVP STAGE — its three scenes on the REAL guest pages (a SAMPLE
         guest, host-verified), its controls the same `MakerRsvpSettings` with a
         `scene`. Lazy: it rides the `maker-details` chunk, never the first load. */
      {
        const ownDeadline = deadlineRes.error ? null : (deadlineNow);
        rsvpStage = (
          <MakerRsvpStage
            eventId={eventId}
            publicLandingUrl={rsvpHome}
            solemn={eventWordsFromProfile(detailsProfile).solemn}
            current={rsvpAsk}
            drafted={rsvpAskDrafted}
            replyBy={deadlineRes.error ? null : resolveReplyBy({ deadline: ownDeadline, eventDate: printEvent.event_date })}
            replyByOwn={
              deadlineRes.error
                ? null
                : {
                    deadline: ownDeadline,
                    pricingMode:
                      (deadlineRes.data as { adaptive_pricing_mode?: string | null } | null)?.adaptive_pricing_mode === 'final_only'
                        ? 'final_only'
                        : 'realtime',
                  }
            }
            replyByFallback={resolveReplyBy({ deadline: null, eventDate: printEvent.event_date })?.date ?? null}
            /* 🎉 When yes's Celebration ▾ — its ◆ marks ask the SAME measured
               Pro the QR look asks (`printPro`); its previews wear the board. */
            celebration={{ ownsPro: printPro, colours: celebrationColours(boardSwatches(printEvent.role_palette)) }}
          />
        );
      }
      /* 💌 LOVE STORY, moved whole (Details part 2b): only where this event type
         has two named people (`detailsItemApplies`). Its WORDS editor only when
         the story was read — a form built on an unread story would save it
         empty; Details then says it could not be read. */
      const eventContext = { profile: detailsProfile, solemn: eventWordsFromProfile(detailsProfile).solemn };
      /* 🪑 THE SEAT PLAN (Details part 4) — the shipped seating page, streamed
         so the Maker never waits on it; only where this type has a seat plan
         (`detailsItemApplies`). Its navigator row reads three COUNTS (never a
         name — this page reads no guest by name); a refused read is said. */
      let seatPlan: { page: ReactNode; tables: number | null; seated: number | null; open: boolean | null } | null = null;
      if (detailsItemApplies('seating', eventContext)) {
        const [seatTablesRes, seatSeatedRes, seatDoorRes] = await Promise.all([
          supabase.from('event_tables').select('table_id', { count: 'exact', head: true }).eq('event_id', eventId),
          supabase.from('event_seat_assignments').select('guest_id', { count: 'exact', head: true }).eq('event_id', eventId),
          // 🪑 Do guests see their seats? The one rule (lib/guests-may-see-seats.ts):
          // on the event's day by itself, or earlier by "Show guests their seats early".
          guestsMaySeeSeatsFor(supabase, eventId, { throwOnReadError: true }).catch((e: unknown) => {
            logQueryError('LaunchPage.seatDoor', { message: e instanceof Error ? e.message : String(e) }, { event_id: eventId }, 'graceful_degrade');
            return null;
          }),
        ]);
        if (seatTablesRes.error) logQueryError('LaunchPage.seatTables', seatTablesRes.error, { event_id: eventId }, 'graceful_degrade');
        if (seatSeatedRes.error) logQueryError('LaunchPage.seatSeated', seatSeatedRes.error, { event_id: eventId }, 'graceful_degrade');
        seatPlan = {
          page: (
            <Suspense fallback={<p className="p-6 text-sm text-ink/60">Opening your seat plan…</p>}>
              <CoupleSeatingPage
                params={Promise.resolve({ eventId })}
                searchParams={Promise.resolve({ maker: '1', seat: one(search.seat) })}
              />
            </Suspense>
          ),
          tables: seatTablesRes.error ? null : (seatTablesRes.count ?? 0),
          seated: seatSeatedRes.error ? null : (seatSeatedRes.count ?? 0),
          open: seatDoorRes,
        };
      }
      /* 🪜 THE ONE DERIVATION of what each guided step's "done" reads — handed to
         Details' rows below (theme, Mood Board, logo, hero) AND to the decision
         to open on What's left, so the two can never disagree. */
      const guided = guidedFactsFrom({
        event: printEvent,
        drafted: draftedEvents,
        liveLoveStory: storyLiveRes.error ? undefined : ((storyLiveRes.data as { love_story?: unknown } | null)?.love_story ?? null),
        yourEvent: yourEvent ? { facts: yourEvent.facts, kind: yourEvent.kind } : null,
        storyApplies: detailsItemApplies('love-story', eventContext),
        scheduleMoments: scheduleMoments ? scheduleMoments.length : null,
        // 🪑 The Seat plan row's own done (its door) — read above, never re-read.
        // 🪑 Done = ARRANGED (a guest seated), never "guests can see it".
        seatPlanArranged: seatPlan ? (seatPlan.seated === null ? null : seatPlan.seated > 0) : undefined,
        backgroundChosen: await readBackgroundChosen(printAdmin, eventId, draftedMain),
      });
      const sharedPlan = await sharedPlanP;
      /* 🖼 The cover photo itself — what the guided cover step shows behind its
         sheet (owner 2026-10-05: the page lays the invitation card over it).
         Drafted over live, signed the way the hero panel signs it. */
      const coverRef = resolveHero({
        landing_page_hero_image_url:
          'landing_page_hero_image_url' in draftedEvents
            ? (draftedEvents.landing_page_hero_image_url as string | null)
            : printEvent.landing_page_hero_image_url,
        landing_page_hero_video_r2_key: null,
      }).photoRef;
      const coverUrl = coverRef ? await displayUrlForStoredAsset(siteMediaServeRef(coverRef)).catch(() => null) : null;
      /* 🧭 "FINISH YOUR EVENT HUB" (the setup, B — lib/hub-setup-steps.ts): its
         facts from what this page already read (the draft over live), plus the
         guests' count — the SAME derivation Home's card reads
         (`hubSetupFactsFrom`), so the three doors count the same steps. */
      let setupFacts: HubSetupFacts | null = null;
      if (hubSetupApplies(printEvent.event_type)) {
        const slotOf = (k: 'ceremony' | 'reception') => yourEvent?.venues.slots.find((sl) => sl.slot === k);
        setupFacts = hubSetupFactsFrom({
          rsvpAsk,
          schedule: scheduleMoments as readonly SetupScheduleBlock[] | null,
          venuesLocked: yourEvent ? { ceremony: Boolean(slotOf('ceremony')?.booked), reception: Boolean(slotOf('reception')?.booked) } : null,
          // What the Hub shows by name — locked first, the typed name as fallback (the Hub's own resolver).
          venuesShown: yourEvent ? yourEvent.venues.resolved : null,
          loveStoryMoments: detailsItemApplies('love-story', eventContext) ? (guided.story ? resolveMoments(guided.story).length : null) : 0,
          dressCode: 'dress_code_config' in draftedEvents ? draftedEvents.dress_code_config : printEvent.dress_code_config,
          replyBy: deadlineRes.error ? undefined : (deadlineNow),
          guests: mayReadGuestList ? await countSetupGuests(printAdmin, eventId) : null,
        });
      }
      /* 🗂 STUDIO'S TILES — their ✓ / Missing from the SAME facts the rows above read
         (`guided`, the setup's reply-by, the seat counts, the E-Gifts manager's own read). */
      if (stagesStudio) {
        const gifts = await egiftAllP;
        studio = {
          tiles: studioTiles({
            facts: guided,
            setup: setupFacts,
            giftMethods: gifts.read ? gifts.methods.filter((m) => m.is_enabled).length : null,
            seat: seatPlan ? { tables: seatPlan.tables, seated: seatPlan.seated } : null,
            offered: (item) => (item === 'seating' ? seatPlan !== null : item === 'rsvp' ? rsvpItem !== null : detailsItemApplies(item, eventContext)),
            marchLabel: yourEvent ? yourEventLabel('march', yourEvent.kind) : undefined,
          }),
        };
      }
      const guidedPresentHere = guidedPresent({
        yourEvent: yourEvent ? { kind: yourEvent.kind, namesWritable: yourEvent.names !== null } : null,
        storyApplies: detailsItemApplies('love-story', eventContext),
        hasSlug: Boolean(printEvent.slug),
        seatPlan: seatPlan !== null,
      });
      detailsUnfinished = isUnfinished(
        guidedPlanFromFacts({
          ctx: eventContext,
          present: guidedPresentHere,
          facts: guided,
          parentsOffered: yourEvent ? parentsOffered(yourEvent.kind) : false,
          setup: setupRoundFor(setupFacts, guidedPresentHere, eventContext),
        }),
      );
      /* A plain landing on Details — nothing else named — is where the flow opens. */
      const detailsLandsPlain =
        !itemNamed && !one(search.print_theme) && !one(search.menu_saved) && !one(search.menu_error) && (rawTool === undefined || rawTool === 'details');
      const story: LoveStoryBlob | null =
        storyLiveRes.error && storyRaw == null
          ? null
          : storyRaw && typeof storyRaw === 'object' && !Array.isArray(storyRaw)
            ? (storyRaw as LoveStoryBlob)
            : {};
      const storyApplies = detailsItemApplies('love-story', eventContext);
      const withStory = story !== null && storyApplies;
      factEditors = detailsFactEditors({
        eventId,
        specialMessage,
        specialMessageAction: updateSpecialMessage.bind(null, eventId),
        pabuyaMessage,
        // A sixth moment's gate — the Story row's own (`proActive`, as the viewer is shown it).
        loveStory: withStory ? { story: story!, ownsPro: proActive } : null,
      });
      // 🏛 A venue card tapped on a stage opens the SAME Venues editor Details draws.
      if (yourEvent) factEditors = { ...factEditors, venues: venuesEditorFor(eventId, yourEvent) };
      /* 🗓 THE SCHEDULE, moved whole — the shipped page, streamed so the Maker
         never waits on it, with its own query when Details › Schedule is the item. */
      const schedulePage = (
        <Suspense fallback={<p className="p-6 text-sm text-ink/60">Opening your schedule…</p>}>
          <CoupleSchedulePage
            params={Promise.resolve({ eventId })}
            searchParams={Promise.resolve({
              maker: '1',
              view: one(search.view),
              ros: one(search.ros),
              note: one(search.note),
              host_answers: one(search.host_answers),
            })}
          />
        </Suspense>
      );
      const loveStoryBook = storyApplies ? (
        <Suspense fallback={<p className="p-6 text-sm text-ink/60">Opening your Love Story…</p>}>
          <OurStoryEditorPage
            params={Promise.resolve({ eventId })}
            searchParams={Promise.resolve({
              maker: '1',
              saved: one(search.saved),
              drafted: one(search.drafted),
              error: one(search.error),
              pro: one(search.pro),
              slotted: one(search.slotted),
            })}
          />
        </Suspense>
      ) : null;
      /* 🧭 STUDIO (the new Maker only) — Info's Your Event Hub facts and What to bring, E-Gifts' methods. A
         refused read is said by the form, never a guessed "Private" or an empty gift list. */
      const studioDetails = studioHubP
        ? await (async () => {
            const [hubRes, gifts, missing] = await Promise.all([studioHubP, egiftAllP, studioMissingP]);
            const [fieldsRes, heroRes] = missing ?? [null, null];
            if (fieldsRes?.error) logQueryError('LaunchPage.studioMissingFields', fieldsRes.error, { event_id: eventId }, 'graceful_degrade');
            if (heroRes?.error) logQueryError('LaunchPage.studioMainGround', heroRes.error, { event_id: eventId }, 'graceful_degrade');
            const fields = fieldsRes && !fieldsRes.error ? (fieldsRes.data as { gift_registry_url?: string | null; qr_shown?: boolean | null } | null) : null;
            /* The main background as the Maker shows it: the drafted one over live. */
            const liveMain = heroRes && !heroRes.error ? hubMainGround((heroRes.data as { config_json?: unknown } | null)?.config_json) : undefined;
            const studioMain = draftedMain !== undefined ? sanitizeHubMainGround(draftedMain) : liveMain;
            /* The five main colours as the page wears them — the Mood Board drafted over live. */
            const dressedRow = overlayHubDraftEvent(
              { role_palette: printEvent.role_palette, invite_theme: printEvent.invite_theme } as Record<string, unknown>,
              { events: draftedEvents, widgets: {} },
            );
            if (hubRes.error) logQueryError('LaunchPage.studioHub', hubRes.error, { event_id: eventId }, 'graceful_degrade');
            const row = hubRes.error ? null : (hubRes.data as Record<string, unknown> | null);
            const visibility = row?.landing_page_visibility;
            const hubSlug = typeof row?.slug === 'string' ? row.slug : null;
            return {
              hub: row
                ? {
                    visibility: (visibility === 'public' || visibility === 'unlisted' ? visibility : 'private') as 'public' | 'unlisted' | 'private',
                    /* `manualLaunchPhase` answers only the four pinnable phases (or null). */
                    pinned: manualLaunchPhase(row.launch_mode as string | null, row.manual_phase as string | null) as 'save_the_date' | 'rsvp' | 'event' | 'editorial' | null,
                    openBrowse: row.website_open_browse === true,
                    launched: Boolean(row.std_launched_at) || visibility === 'public',
                    scheduledAt: typeof row.scheduled_launch_at === 'string' ? row.scheduled_launch_at : null,
                  }
                : null,
              egiftMethods: gifts.read
                ? gifts.methods.map((m) => ({
                    egift_method_id: m.egift_method_id,
                    method_kind: m.method_kind,
                    label: m.label,
                    account_name: m.account_name,
                    handle: m.handle,
                    qr_r2_key: m.qr_r2_key,
                    note: m.note,
                    is_enabled: m.is_enabled,
                    qrDisplayUrl: m.qrDisplayUrl,
                  }))
                : null,
              whatToBring:
                'what_to_bring' in draftedEvents
                  ? ((draftedEvents.what_to_bring as string | null) ?? null)
                  : ((row?.what_to_bring as string | null | undefined) ?? null),
              livePath: hubSlug ? publicEventPath(hubSlug) : null,
              registryUrl: fields ? (fields.gift_registry_url ?? null) : undefined,
              qrShown: ('qr_shown' in draftedEvents ? draftedEvents.qr_shown : fields?.qr_shown) !== false,
              main: studioMain,
              mainColours: mainColoursOf(dressedRow.role_palette, dressedRow.invite_theme),
              mainColourDraft: sanitizeMainColourDraft(draftedEvents.main_colours) ?? {},
            };
          })()
        : null;
      details = {
        page: (
          <MakerDetails
            studio={studioDetails}
            coverUrl={coverUrl}
            yourEvent={yourEvent}
            seatPlan={seatPlan}
            /* 🙋 Plan it myself (owner 2026-10-02, tracker d4) — the same
               `planning_mode` the Setnayan AI page flips; null when the read failed. */
            planMyself={{ on: eventRes.error ? null : planMyselfOn(eventRow?.planning_mode) }}
            /* 🪜 Details part 5 — the guided "What's left" over these very items. */
            guide={{
              open: guideAddress !== null || (detailsUnfinished && detailsLandsPlain),
              address: guideAddress,
              itemNamed,
              guideNamed: guideAddress !== null,
              // Never on the Maker's very first visit — its own welcome is showing.
              // 🧭 Seeing it also answers the setup's once-offer on Home (`HUB_SETUP_OFFER_TOUR`).
              tour: !firstVisit ? <MiniTour tourKey="customer_details_guided_v1" storeShell={storeShell} /> : null,
              setup: setupFacts,
              guestsHref: hubSetupGuestsHref(eventId),
              // 🔢 One count: the facts Home and Event Details count from.
              doneFacts: guided,
              shared: sharedPlan ? sharedPlan.plan : null,
            }}
            eventId={eventId}
            slug={printEvent.slug}
            slugAction={updateEventSlug.bind(null, eventId, 'launch')}
            // The QR's look (lib/qr-look.server.ts): Pro as `printOwnsPro` measured
            // it, the saved choices, and the contrast-passing Mood Board colours.
            qr={{ ...qrLookChoicesFromRow({ ...printEvent, style_preferences: qrPrefs }, printPro), storeShell }}
            qrStyleAction={updateQrStyle.bind(null, eventId)}
            theme={{
              themes: themes.map((t) => ({ id: t.id, name: t.name, tier: t.tier })),
              current: themeCurrent,
              ownsPro: printPro,
              storeShell,
              suggested: themeMatchingFeel(feelRes.data?.mood_feel_key),
              sampleVersion,
              // Each theme's SAVED poster (already on R2) — the gallery's picture until a page is there.
              posters: Object.fromEntries(themes.map((t) => [t.id, t.media ? publicUrlForStoredAsset(t.media.poster) : null])),
              // Never on the Maker's very first visit — its own welcome is showing.
              tour: !firstVisit,
              chosen: guided.themeChosen,
              /* 🎞 The film keeps a background of its own (draft over live) — Theme
                 then offers "Same as theme" (owner, live walk 2026-10-05). Only
                 where the type has the film at all. */
              filmOwnBackground: mayShowStdFilm && filmBackgroundRead !== undefined && !stdFollowsTheme(filmBackgroundRead),
              filmLegibility: resolveStdBackground(filmBackgroundRead).legibility ?? 'auto',
              // The look they set themselves (draft over live) — a re-tap of the current theme hands it back.
              ownLook: hasOwnLook(feelRes.data as Record<string, unknown> | null, draftedEvents),
              /* 🎨 THE MOOD BOARD PALETTE IS THE PRIORITY (owner 2026-10-05): an
                 board that is not the couple's (empty, or filled by an earlier
                 pick) takes the picked theme's colours (into the draft) —
                 owner: "New theme refills them"; a board the couple painted
                 dresses every sample and is never written by a pick. */
              seeds: boardIsTheCouples(printEvent.role_palette) ? null : themeSeedPalettes(),
              samplePalette: sampleBoardQuery(printEvent.role_palette, eventId),
            }}
            prints={prints}
            menu={{
              saved: stored.menu,
              ...menuSources,
              flash: one(search.menu_saved) ? 'saved' : one(search.menu_error) ? 'error' : null,
            }}
            stored={stored}
            hosts={rsvpHosts}
            parents={parentCards}
            pabuyaMessage={pabuyaMessage}
            specialMessage={specialMessage}
            facts={factEditors}
            loveStory={loveStoryBook ? { book: loveStoryBook, moments: story ? resolveMoments(story).length : null } : null}
            schedule={{
              page: schedulePage,
              moments: scheduleMoments ? scheduleMoments.length : null,
              pieces: schedulePieces(
                (scheduleMoments ?? []).map((b) => ({ id: b.block_id, label: b.label ?? '', time: formatBlockTime(b.start_at) })),
                announceOn,
              ),
            }}
            rsvp={rsvpItem}
            /* 🗂 THE ONBOARDING'S ANSWERS (owner 2026-10-02, "EVERY ANSWER … LIVES IN
               EVENT DETAILS"): each its own column, as the couple is editing it —
               the draft over live, like every Your info row. Offered where the
               event type asks it (`profileSetup`: a camera, a gift word). */
            answers={(() => {
              const setupOfType = profileSetup(detailsProfile);
              const drafted = (c: 'papic_on' | 'gifts_on' | 'logo_wanted' | 'cover_photo_wanted'): boolean | null => {
                const v = c in draftedEvents ? draftedEvents[c] : printEvent[c];
                return typeof v === 'boolean' ? v : null;
              };
              return {
                solemn: eventContext.solemn,
                twoPeople: yourEvent ? yourEvent.kind.words.twoPeople : false,
                giftsMode: setupOfType.giftsMode,
                papic: { offered: setupOfType.cameraDefault !== 'off', value: drafted('papic_on') },
                gifts: { offered: setupOfType.giftsMode !== 'none', value: drafted('gifts_on') },
                logo: drafted('logo_wanted'),
                cover: drafted('cover_photo_wanted'),
              };
            })()}
            hasPalette={guided.palette}
            hasGifts={egifts.length > 0}
            egiftManager={egiftManager}
            flash={one(search.print_saved) ? 'saved' : one(search.print_error) ? 'error' : null}
            stamp={String(Date.now())}
            eventContext={eventContext}
            initialItem={detailsItemFor({
              tool: one(search.tool),
              item: one(search.item),
              printTheme: one(search.print_theme),
              menuFlash: Boolean(one(search.menu_saved) || one(search.menu_error)),
            })}
            /* 🎨 THE LOOK (Details part 3, DECISION_LOG "OPTION B …" + "SCHEDULE,
               MOOD BOARD AND SEAT PLAN MOVE INSIDE…"): the Mood Board studio,
               streamed so the Maker never waits on it; Logo, Hero and Reveal
               come from the work area. "Done" is read from the columns they
               already write, drafted over live. */
            look={{
              /* 🧭 The new Maker draws Studio › Mood Board & Dress Code — full screen, its tools inside it (plan PR 5). */
              moodBoard: stagesStudio ? (
                <Suspense fallback={<p className="py-6 text-sm text-ink/60">Opening your Mood Board…</p>}>
                  <MoodBoardStudioBody eventId={eventId} />
                </Suspense>
              ) : (
                <Suspense fallback={<p className="py-6 text-sm text-ink/60">Opening your Mood Board…</p>}>
                  <MoodBoardMakerBody eventId={eventId} />
                </Suspense>
              ),
              moodBoardControls: stagesStudio ? null : (
                <Suspense fallback={<p className="text-sm text-ink/60">Opening your Mood Board…</p>}>
                  <MoodBoardMakerControls eventId={eventId} />
                </Suspense>
              ),
              logoDone: guided.logo,
              heroDone: guided.hero,
              // The hero panel's own claim: made once, shown on these three and the poster.
              heroOn: [PUBLIC_STAGE_LABELS.save_the_date, PUBLIC_STAGE_LABELS.rsvp, PUBLIC_STAGE_LABELS.event, 'The poster'],
              revealOn: (await readMakerRevealStages(eventId)).map((s) => PUBLIC_STAGE_LABELS[s]),
            }}
          />
        ),
        controls: null,
      };
    }
  }

  /* 🪜 A new couple's Maker opens on What's left (DECISION_LOG 2026-09-29 "THE
     GUIDED FLOW IS APPROVED…"): an unfinished event, and the address names no
     place — no tool, scene, stage or pin. */
  const opensOnGuide =
    hasWork &&
    detailsUnfinished &&
    !rawTool &&
    !one(search.scene) &&
    !one(search.open) &&
    !one(search.stage) &&
    !one(search.pin) &&
    !one(search.chain);

  return (
    <MakerShell
      eventId={eventId}
      slug={eventSlug}
      liveStage={liveStage}
      initialStage={isStagePhase(makerStage) ? makerStage : 'rsvp'}
      /* `?tool=hero|reveal|logo` opens that made-once workspace (Phase 6), and
         `?tool=details|prints` the Phase 9 panels — a save lands back on the
         panel the couple was using. */
      initialSelection={(() => {
        // An old `?tool=prints` (Prints & Tickets) is Details now.
        const tool = makerToolFor(one(search.tool));
        if (hasWork && (tool === 'hero' || tool === 'reveal' || tool === 'logo' || tool === 'details')) {
          return { kind: 'tool', key: tool } as const;
        }
        // 🪜 `?guide=`, or an unfinished event with no place named: Details, on What's left.
        return hasWork && (guideAddress !== null || opensOnGuide) ? ({ kind: 'tool', key: 'details' } as const) : null;
      })()}
      opensOnGuide={opensOnGuide && guideAddress === null}
      details={details}
      rsvpStage={rsvpStage}
      factEditors={factEditors}
      storeShell={storeShell}
      /* ⋯ › About the Maker. The short tour sells nothing (2026-10-02); the
         store-shell and price rules still apply should a slide ever carry one. */
      tourSlides={makerTourSlideViews({ storeShell, priceLabel: storeShell ? null : proPriceLabel })}
      firstVisit={firstVisit}
      completeTourAction={completeTour}
      renderStamp={String(Date.now())}
      hasWork={hasWork}
      /* ⋯ holds SETTINGS only (owner 2026-09-25: "why is this here when we
         already have the actual editor") — who can view, which version guests
         see, open browsing and go live, portalled in by the work area. The old
         controller's stage duplicated the canvas; its View as is now the
         toolbar's switch, and the address moves to the Details panel (P9). */
      more={null}
      /* 💾 Phase 2: the draft's Apply · Restore · Reset, in the toolbar. Only
         where the work area is the editor — a coordinator has nothing to draft. */
      applySlot={hasWork ? <HubDraftDock eventId={eventId} saveError={one(search.draft_error)} /> : null}
      viewAsFree={freeSwitch.offered ? { on: freeSwitch.on } : null}
      stagesStudio={stagesStudio}
      studio={studio}
      /* Who Details is for, in the event type's own words (a coordinator is told
         why it is shut) — `EventWords`, never a typed "couple". */
      theHost={eventWordsFromProfile(await resolveProfileByEvent(eventId)).theHost}
      /* 📖 POST EVENT (Maker Phase 8) — its own first-visit hint, mounted by the
         shell only once the couple is ON Post Event (the Maker in 4, 2026-10-02:
         nothing pitches Pro before the first tap — its last slide names Pro).
         Since 2026-09-25 ("POST EVENT IS MANY SMALL SCENES") Post Event is its
         scenes BEFORE the day too, so it no longer waits for the day. Never on
         the Maker's very first visit — two first-visit things must not stack.
         Inside the shell so its dialog sits in the shell's layer. */
      postEventTour={hasWork && !firstVisit ? <MiniTour tourKey="customer_post_event_v1" storeShell={storeShell} /> : null}
    >
      {hasWork ? (
        <WebsiteEditorPage
          params={Promise.resolve({ eventId })}
          searchParams={Promise.resolve({
            maker: '1',
            open: one(search.open),
            pin: one(search.pin),
            scene: one(search.scene),
            chain: one(search.chain),
          })}
        />
      ) : (
        <div className="h-full overflow-y-auto px-4 py-6 sm:px-6">{controller}</div>
      )}
    </MakerShell>
  );
}
