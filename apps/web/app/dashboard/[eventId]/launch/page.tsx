import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  MonitorPlay,
  Radio,
  Camera,
  ArrowRight,
  Plus,
  Globe,
  ExternalLink,
  PencilLine,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { getCurrentUser } from '@/lib/auth';
import { eventPapicActive } from '@/lib/papic-seats';
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
import { PageMasthead } from '@/app/_components/page-masthead';
import { HubStage } from './_components/hub-stage';
import { HubProOffer } from './_components/hub-pro-offer';
import { isHostMemberType } from '@/app/[slug]/_lib/host-scope';
import { fetchEventViewer, isDelegateWithoutArea } from '@/lib/event-viewer.server';
import { fetchGuestsByEventMeasured } from '@/lib/guests';
import {
  resolveHubStanding,
  resolveHubFacts,
  resolveHubNextStep,
  hubOffersAllowed,
  type HubEventRead,
  type HubGuestRead,
} from '@/lib/event-hub-control';
import { resolveHubProOffer } from '@/lib/event-hub-pro';
import {
  eventCoupleWebsiteProActive,
  eventOwnsCoupleWebsitePro,
} from '@/lib/couple-website-pro';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { formatPhp } from '@/lib/orders';

// ⭐ THE ONLY SURFACE THAT MAY DECLARE THIS NAME (owner ruling 2026-09-02 —
// "if it is the same then adjust"). `/website` wore `title: 'Event Hub'` too
// while doing the same job; it is a redirect stub now, and this page carries
// the name alone. `one-event-hub-door.test.ts` fails if a second surface ever
// re-claims it.
export const metadata = { title: 'Event Hub' };

type Props = { params: Promise<{ eventId: string }> };

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
export default async function LaunchHubPage({ params }: Props) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const { data: membership, error: membershipError } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
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
  const [
    ownsLiveWall,
    panoodState,
    hasPapic,
    eventRes,
    guestRead,
    proActive,
    proOwned,
    proSku,
  ] = await Promise.all([
    eventSkuActive(supabase, eventId, 'LIVE_WALL'),
    // ⭐ 2026-07-27 — 'live-studio-roam', NOT 'panood'. ADD_ON_SKU_MAP (lib/add-on-stats.ts)
    // maps `panood` → the two RETIRED Cast SKUs and `live-studio-roam` → the live
    // `LIVE_STUDIO`. SKU_OWNERSHIP_ALIASES does NOT expand at this layer, so
    // keying on `panood` means the first couple who actually PAYS resolves to
    // not-owned — an "Add" button on the day of their wedding instead of "Go live".
    resolveAddOnState(supabase, eventId, 'live-studio-roam', 'couple'),
    eventPapicActive(supabase, eventId),
    // Slug + date drive the stage and the four facts. `timezone` + `event_end_date`
    // added 2026-08-21: the resolvers used to read the SERVER's clock (UTC on
    // Vercel), so which named page the live QR was said to resolve to could be a
    // day out.
    supabase
      .from('events')
      .select('slug, event_date, event_end_date, cleared_at, timezone')
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
    eventCoupleWebsiteProActive(supabase, eventId).catch(() => false),
    eventOwnsCoupleWebsitePro(supabase, eventId).catch(() => false),
    /*
      ⛔ THE PRICE, READ LIVE. `platform_retail_catalog_v2` is admin-managed and
      is the only figure a customer is ever charged. Null on failure, and the
      panel then renders with no number rather than a remembered one.
    */
    formatV2Sku('COUPLE_WEBSITE_PRO').catch(() => null),
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
  const facts = resolveHubFacts(eventRead, guestFacts);
  const nextStep = resolveHubNextStep(standing, eventRead, guestFacts);
  const offersAllowed = hubOffersAllowed(standing.phase);

  /*
    ══ THE ONE UNLOCK, RESOLVED FOR THE CHANNEL THE COUPLE IS STANDING ON ══
    § 5.3: the seven Pro items are ONE purchase, so the controller does not grow
    seven upgrade slots — it grows one, and moves it to whichever of the four
    public pages is live. `resolveHubProOffer` returns null far more often than
    not: when the couple owns it, when the read did not happen, on the day, and
    after it.

    ⚠ THE DAY GATE IS EH1'S AND IS CALLED, NEVER RE-DERIVED. `hubOffersAllowed`
    is `phase === 'plan'` — STRICTER than the design text ("no offers on the
    event day"), because it also silences the offer AFTER the day. That reads as
    intended: it is the owner's 2026-08-21 ruling on the day-of services,
    "stop offering them", and the shipped "Event over" chip beside it does the
    same thing. A consequence worth naming rather than discovering: the Day-of
    and Editorial channels can therefore never carry an offer, because the stage
    only reaches them once the phase is 'dayof' or 'after'.
  */
  const proOffer = resolveHubProOffer({
    channel: standing.stage,
    phase: standing.phase,
    ownsPro: proActive || proOwned,
  });
  const proPriceLabel = proSku?.price_php != null ? formatPhp(proSku.price_php) : null;

  /*
    ─── HAS THIS CELEBRATION ALREADY HAPPENED? ──────────────────────────────
    ONE resolver — the same one the Overview, the rail, the guest list, the
    Hosts page and the Suite ask, reached here through `resolveHubPhase`. Owner
    2026-08-21 on the day-of services: **"stop offering them."**
  */
  const eventHasHappened = standing.phase === 'after';
  const activeChannelIndex = PUBLIC_SITE_PAGES.findIndex((p) => p.phaseParam === standing.stage);
  const activeChannel = activeChannelIndex >= 0 ? PUBLIC_SITE_PAGES[activeChannelIndex] : null;

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
      name: 'Live Studio — livestream',
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
      addHref: `${base}/studio`,
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
  const setOnce: Array<{ key: string; label: string; hint: string; href: string }> = [
    { key: 'editor', label: 'The page itself', hint: 'Copy, photos, colours, music', href: `${base}/website/editor` },
    { key: 'story', label: 'The story', hint: 'Chapters, guest columns, the album', href: `${base}/website/editorial` },
    { key: 'guests', label: 'Guests and replies', hint: 'Names, invites, who is coming', href: `${base}/guests` },
    { key: 'schedule', label: 'The running order', hint: 'What happens, and when', href: `${base}/schedule` },
  ];

  const phaseTitle =
    standing.phase === 'dayof'
      ? 'Your Event Hub — today'
      : standing.phase === 'after'
        ? 'Your Event Hub'
        : 'Your Event Hub';

  return (
    /* THE STAGE MEASURE (`app/[slug]/_lib/measures.ts` STAGE = max-w-5xl): the
       widest anything may ever be. Everything under the stage keeps the PLATE. */
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <PageMasthead title={phaseTitle} />

      {/* ══ S1 · THE STAGE + S2 · THE FOUR FACTS ══
          The content is the first paint, never a form. Lives in its own file so
          a test can RENDER it at all three phases — see `hub-stage.tsx`. */}
      <HubStage
        slug={eventSlug}
        standing={standing}
        facts={facts}
        channelName={activeChannel?.name ?? null}
        channelBlurb={activeChannel?.blurb ?? null}
        channelIndex={activeChannel ? activeChannelIndex + 1 : null}
        channelCount={PUBLIC_SITE_PAGES.length}
        editHref={`${base}/website/editor`}
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

      {/* ══ S4 · THE PARTS — the four stages of the ONE link first ══
          One engine, one URL: `/[slug]` already renders each of these per
          lifecycle phase. These cards NAME + PREVIEW them; the live QR keeps
          resolving to the active one with no change. */}
      <section className="mt-10">
        <header className="space-y-1">
          <p className="sn-eye">
            <Globe aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Your public site
          </p>
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
            The four stages of your one link
          </h2>
          <p className="max-w-prose text-sm text-ink/60">
            Your site changes with the day. Preview each stage below — the one marked{' '}
            <span className="font-medium text-ink/80">Active now</span> is what your QR opens today.
          </p>
        </header>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PUBLIC_SITE_PAGES.map((page) => {
            const Icon = page.Icon;
            const isActive = page.phaseParam === standing.stage;
            const previewHref = eventSlug ? `/${eventSlug}?phase=${page.phaseParam}` : null;
            return (
              <article
                key={page.key}
                className={`sn-row flex flex-col gap-3 p-4 sm:p-5 ${
                  isActive ? 'border-terracotta/40 bg-terracotta/[0.03]' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      isActive ? 'bg-terracotta/10 text-terracotta' : 'bg-ink/5 text-ink/40'
                    }`}
                  >
                    <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-ink">{page.name}</h3>
                      {isActive && (
                        <span className="inline-flex items-center rounded-full bg-terracotta-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cream">
                          Active now
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-ink/55">{page.blurb}</p>
                  </div>
                </div>
                {previewHref ? (
                  <Link
                    href={previewHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-fit items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
                  >
                    Preview
                    <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  </Link>
                ) : (
                  <span className="text-xs text-ink/40">Preview available once your link is set.</span>
                )}
              </article>
            );
          })}
        </div>

        {/* ══ THE ONE UNLOCK, OFFERED AT THE POINT OF ABSENCE (§ 5.1 rule 1) ══
            Attached to the channel above it, not parked in a rail at the foot of
            the page: the controller sells only what the couple is currently
            looking at and cannot have. Null — owned, unmeasured, or the day
            itself — renders nothing at all, and the cards above are UNCHANGED in
            either case. Nothing here dims, greys or locks them. */}
        {proOffer && (
          <HubProOffer
            offer={proOffer}
            channelName={activeChannel?.name ?? null}
            priceLabel={proPriceLabel}
            base={base}
          />
        )}
      </section>

      {/* ══ S4b · THE PARTS — then the three services that run on the day ══ */}
      <section className="mt-10">
        <header className="space-y-1">
          <p className="sn-eye">
            <Radio aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> On the day
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
        Booking suppliers lives in the <Link href="/marketplace" className="underline underline-offset-2">Merkado</Link>,
        and what you have spent lives in your{' '}
        <Link href={`${base}/budget`} className="underline underline-offset-2">budget</Link>. Neither is here on
        purpose — this page is your public address and the things that run on it.
      </p>
    </div>
  );
}
