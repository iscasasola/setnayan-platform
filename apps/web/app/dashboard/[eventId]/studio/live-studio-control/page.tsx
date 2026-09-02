import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  Video,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Lock,
  Tv,
  Unlink2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { formatPhp } from '@/lib/orders';
import { AppStoreLayout, type PlanRow, type StatTile } from '@/app/_components/app-store/layout';
import { AddOnStateCta, statusPillForState } from '@/app/_components/app-store/state-cta';
import { ChoosePlanSheet, type ChoosePlanSheetProps } from '@/app/_components/app-store/choose-plan-sheet';
import { SubmitButton } from '@/app/_components/submit-button';
import { fetchAddOnStats } from '@/lib/add-on-stats';
import { resolveAddOnState } from '@/lib/add-on-state';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';
import { liveStudioControlPath, LIVE_STUDIO_HOSTED_CHANNEL_SKU } from '@/lib/live-studio-control';
import { getYoutubeOAuthConfig } from '@/lib/panood-youtube';
import { eventSkuActive } from '@/lib/entitlements';
import {
  liveStudioPoolOnly,
  poolOnlyConnectNotice,
} from '@/lib/live-studio-pool-only';
import { LEAD_TIME_NOTICE, YOUTUBE_READY_NOTICE } from '@/lib/live-studio-readiness';
import { setYoutubeLiveReadyAck } from './actions';

// UNIFIED Live Studio — one switching-based product that merges Cast (the directed
// single feed) + Roam (guests pick their view) into a directed Main Stage plus
// switchable guest cameras (owner 2026-07-25; Live_Studio_Unified_Spec_2026-07-25.md).
// App Store-style detail surface, built on the Roam substrate:
//
//   • PAID capability (no free tier — the single-camera livestream stays free).
//     serviceKey LIVE_STUDIO, priced LIVE from the admin catalog via formatV2Sku —
//     never hardcoded. The buy reuses AddOnStateCta / InlineCheckoutDrawer; the
//     checkout's serviceKey is LIVE_STUDIO so submitOrderAction re-resolves the price
//     from platform_retail_catalog_v2 (₱3,000 · per event · one_time) and rides the
//     QR rail → /admin/payments.
//   • Once OWNED, the CTA flips to "Open controller" → ./setup (the unified switching
//     controller: name cameras, cut them onto the Main Stage, set the default view).
//
// FLAG-GATED (NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED): the Studio tile that links here is
// already flag-gated (add-ons-catalog.ts); this page notFound()s when the flag is off as
// defense-in-depth. Live YouTube streaming is a further, separate owner-OAuth gate (pool
// channel — see ./setup) — configuring + buying Live Studio needs none of it.
//
// NOTE the route/feature key stays `live-studio-roam` (internal), the same way "Live
// Studio Cast" keeps the internal `panood` name — renaming the route is a separate,
// churny effort. Everything the customer sees says "Live Studio".

export const metadata = { title: 'Live Studio' };

type Props = {
  params: Promise<{ eventId: string }>;
  // The OAuth routes (api/oauth/youtube/{callback,disconnect}) bounce the host back
  // with one of these. They used to land on the retired Cast page; that page now
  // forwards them here, so this is where they have to be acknowledged.
  searchParams?: Promise<{
    youtube_connected?: string;
    youtube_disconnected?: string;
    youtube_error?: string;
  }>;
};

type YoutubeGrant = {
  external_account_id: string | null;
  external_account_display: string | null;
  granted_at: string;
};

const LIVE_STUDIO_SKU_CODE = 'LIVE_STUDIO';
const FEATURE_KEY = 'live-studio-roam';

export default async function LiveStudioPage({ params, searchParams }: Props) {
  if (!liveStudioRoamEnabled()) notFound();

  const { eventId } = await params;
  const sp = searchParams ? await searchParams : {};

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase
    .from('events')
    .select('event_id')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) notFound();

  // ✅ HAS THIS PERSON ALREADY CONFIRMED THEIR YOUTUBE CHANNEL IS LIVE-READY?
  //
  // Per-USER, deliberately — a channel belongs to the person, not to one celebration
  // (owner ruling 2026-09-02: "if they have accepted at least once, then the next
  // time they purchase, no more tick box"). Read here rather than inside the sheet so
  // the sheet stays a dumb client component with no data access of its own.
  //
  // A REFUSED READ MUST NOT SILENTLY DROP THE GATE. `.select()` returning an error
  // leaves `data` null, which is indistinguishable from "never acknowledged" — and
  // that is the SAFE direction here: the buyer is asked once more. The opposite
  // default (assume acknowledged) would remove the warning from someone who had never
  // seen it, on the one screen where seeing it matters.
  const { data: ackRow, error: ackError } = await supabase
    .from('users')
    .select('youtube_live_ready_ack_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (ackError) console.error('[live-studio] youtube ack read refused', ackError);
  const youtubeLiveReadyAcked = !!ackRow?.youtube_live_ready_ack_at;

  // ⭐ THE REVOKE CONTROL'S NEW HOME (2026-08-06).
  //
  // Until this page carried it, the ONLY way a host could disconnect their Google
  // account was a `<form action="/api/oauth/youtube/disconnect">` on the LEGACY Cast
  // setup screen — a page reached through a tile for a SKU that has been
  // is_active=false since 2026-07-26. The unified controller
  // (/panood/control/[eventId]) connects but never disconnects, and
  // /admin/live-studio-channels revokes SETNAYAN's own pool channels, not a couple's.
  // /privacy states, to the public, that this control exists.
  //
  // So it lives here now: the surface the SURVIVING Live Studio tile opens, which
  // cannot be retired without retiring the product. RLS scopes oauth_grants by
  // event_id IN current_event_ids(), so the user-session client is the right reader.
  const [oauthConfig, { data: grantRaw, error: grantRawError }] = await Promise.all([
    getYoutubeOAuthConfig(),
    supabase
      .from('oauth_grants')
      .select('external_account_id, external_account_display, granted_at')
      .eq('event_id', eventId)
      .eq('provider', 'youtube')
      .is('revoked_at', null)
      .maybeSingle(),
  ]);
  if (grantRawError) {
    logQueryError('LiveStudioControlPage.grantRaw', grantRawError, { event_id: eventId }, 'graceful_degrade');
  }
  const oauthReady = oauthConfig.ready;
  const youtubeGrant = (grantRaw ?? null) as YoutubeGrant | null;

  // ⭐ WAVE 8: the controller moved out of /dashboard (chrome-less, § 4g) — resolve
  // it through the shared helper so this doorway can never point at the old URL.
  const controllerHref = liveStudioControlPath(eventId);

  const [stats, stateCtx, settings, sku, hostedChannelSku, ownsHostedChannel] = await Promise.all([
    fetchAddOnStats(supabase, FEATURE_KEY),
    resolveAddOnState(supabase, eventId, FEATURE_KEY, 'couple', controllerHref),
    fetchPlatformSettings(supabase),
    formatV2Sku(LIVE_STUDIO_SKU_CODE).catch(() => null),
    formatV2Sku(LIVE_STUDIO_HOSTED_CHANNEL_SKU).catch(() => null),
    // ⭐ Does this event own the OPTIONAL hosted-channel add-on (owner ruling
    // 2026-09-02)? Read directly via eventSkuActive — NOT via ADD_ON_SKU_MAP /
    // resolveAddOnState, which drive whether the MULTICAM controller unlocks.
    // This entitlement decides WHICH CHANNEL NOTICE renders below, nothing else.
    eventSkuActive(supabase, eventId, LIVE_STUDIO_HOSTED_CHANNEL_SKU),
  ]);

  // Live catalog price (display only; the charge is re-resolved server-side from
  // LIVE_STUDIO_SKU_CODE in submitOrderAction, so a catalog miss only blanks the label).
  const centavos = sku?.price_centavos ?? 0;
  const priceLabel = sku ? formatPhp(sku.price_php) : '—';
  const hostedChannelCentavos = hostedChannelSku?.price_centavos ?? 0;
  const hostedChannelPriceLabel = hostedChannelSku ? formatPhp(hostedChannelSku.price_php) : '—';

  const planRow: PlanRow = {
    name: 'Live Studio',
    scope:
      'Everything unlocks for one event. Name multiple cameras across your angles, rooms, and venues; cut whichever one you want onto your directed Main Stage with a tap, and let remote guests pick their own view and switch live. Cameras join as phones via the event QR (no install, no per-camera fee).',
    price: priceLabel,
    unit: '',
    badge: 'Per event',
  };

  const stats4: StatTile[] = [
    {
      eyebrow: 'Rating',
      value: stats.avgRating === null ? '—' : stats.avgRating.toFixed(1),
      starFill: stats.avgRating ?? 0,
      caption:
        stats.reviewCount === 0
          ? 'No reviews yet'
          : `${stats.reviewCount} review${stats.reviewCount === 1 ? '' : 's'}`,
    },
    {
      eyebrow: 'Purchased',
      value: stats.paidOrderCount === 0 ? '—' : stats.paidOrderCount.toLocaleString('en-PH'),
      caption:
        stats.paidOrderCount === 0
          ? 'Be one of the first'
          : `${stats.eventsWithFeature} event${stats.eventsWithFeature === 1 ? '' : 's'}`,
    },
    {
      eyebrow: 'Cameras',
      value: 'Multi',
      caption: 'Cut + guest-pick',
    },
    {
      eyebrow: 'Pricing',
      value: priceLabel,
      caption: 'per event',
    },
  ];

  // One controller shared by free + paid (owner 2026-07-25): a host who hasn't
  // bought Live Studio can still OPEN the controller and go live free with a single
  // camera — the multi-camera extras simply show locked there.
  //
  // L8 (2026-09-02): for a non-owned host this doorway used to lead with the
  // ₱3,000 buy button and demote the free path to a plain text link beneath it —
  // at odds with the Wave 3 lock (§ 4d) that "seeing the cameras actually working
  // IS the conversion mechanism". So for any non-owned state the free controller
  // link now renders FIRST and at the same button weight as the buy CTA — order
  // and weight only; the price and the buy button are unchanged. When owned
  // ('launch'), the primary CTA already opens the controller, so nothing else
  // renders.
  const cta = (
    <div className="space-y-2">
      {stateCtx.state !== 'launch' ? (
        <Link
          href={controllerHref}
          className="inline-flex items-center gap-2 rounded-full border border-terracotta bg-cream px-5 py-2 text-sm font-semibold text-terracotta-700 transition-colors hover:bg-terracotta/10"
        >
          Open the controller — go live free with one camera
          <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </Link>
      ) : null}
      <AddOnStateCta
        context={stateCtx}
        launchLabel="Open controller"
        choosePlan={{
        eventId,
        triggerLabel: 'Add Live Studio',
        priceFromLabel: priceLabel,
        // Single per-event SKU. serviceKey = LIVE_STUDIO_SKU_CODE so the drawer's order
        // re-resolves the price from the admin catalog; priceCentavos is the live catalog
        // price threaded through for the inline voucher math.
        plans: [
          {
            sku_code: LIVE_STUDIO_SKU_CODE,
            name: planRow.name,
            scope: planRow.scope,
            price: planRow.price,
            unit: planRow.unit,
            badge: planRow.badge,
            priceCentavos: String(centavos),
          },
        ],
        settings,
        introCopy:
          'Live Studio streams your celebration live for everyone who can’t be there. One directed Main Stage plus switchable guest cameras — different angles, rooms, even different venues. Cut the Main Stage between them with a tap, or let remote guests pick their own view. Buy one Live Studio per event; set up your cameras right after.',
        // ⏳ THE LEAD-TIME NOTICE, prominent and above the price — not in the footnote
        // below it. Manual payment reconciliation runs to a 24-hour SLA, and a wedding
        // cannot wait for it: an unlock bought the night before may still be
        // unapproved when the ceremony starts, which is one camera on the day. Its
        // second sentence ("your day starts when you first go live, not when you pay")
        // is true only because of the 2026-07-27 anchor fix — the pair is what makes
        // "buy earlier" safe advice rather than advice to burn the day sooner.
        // TWO CLOCKS, TWO PARAGRAPHS, BOTH ABOVE THE PRICE. Ours is manual payment
        // reconciliation; theirs is Google's ~24-hour first-time live activation on
        // their OWN channel. They run in PARALLEL — a couple can activate YouTube
        // while payment is pending — so these are two sentences, not 24 hours added
        // to one. Merging them into a single paragraph would read as a 3-day wait
        // and talk buyers out of a purchase that only ever needed 2 days.
        notice: [LEAD_TIME_NOTICE, YOUTUBE_READY_NOTICE],
        // Shown ONLY until they have ticked it once, ever. Omitting the prop is how
        // "already accepted" is expressed — the sheet has no way to pre-tick a box,
        // which is what keeps this affirmative (see consent-is-affirmative.test.ts).
        acknowledgement: youtubeLiveReadyAcked
          ? undefined
          : {
              label:
                'I understand, and I already have a YouTube account that is ready for live streaming.',
              onChange: setYoutubeLiveReadyAck,
            },
        footnote:
          'Apply-then-pay flow · we confirm price before payment · refunds follow the standard 24-hour SLA. Cameras join as phones via the event QR — no per-camera fee. The free single-camera livestream is unchanged.',
        }}
      />
    </div>
  );

  const youtubeError = sp.youtube_error;

  return (
    <div className="space-y-8">
      {sp.youtube_connected ? (
        <p
          role="status"
          className="inline-flex items-center gap-2 rounded-2xl border border-success-300/70 bg-success-50 px-4 py-3 text-sm text-success-900"
        >
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          YouTube connected
          {youtubeGrant?.external_account_display
            ? ` — ${youtubeGrant.external_account_display}`
            : ''}
          . Your broadcast will go live on this channel.
        </p>
      ) : null}

      {sp.youtube_disconnected ? (
        <p
          role="status"
          className="inline-flex items-center gap-2 rounded-2xl border border-ink/15 bg-cream px-4 py-3 text-sm text-ink/75"
        >
          <Unlink2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          YouTube disconnected. Reconnect any time to re-enable the broadcast.
        </p>
      ) : null}

      {/* `pool_only` is NOT an error — Setnayan supplies the channel, so the couple
          reached a door that was never theirs to open. Nothing failed and retrying
          cannot help, so it renders as a STATUS, using the same shared constant the
          closed door and the controller use. Checked BEFORE the generic branch, or
          the couple reads "connection failed · contact support" about a non-event. */}
      {youtubeError === 'pool_only' ? (
        <p
          role="status"
          className="inline-flex items-start gap-2 rounded-2xl border border-ink/15 bg-cream px-4 py-3 text-sm text-ink/75"
        >
          <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          <span>{poolOnlyConnectNotice(ownsHostedChannel)}</span>
        </p>
      ) : youtubeError ? (
        <p
          role="alert"
          className="inline-flex items-start gap-2 rounded-2xl border border-danger-300/70 bg-danger-50 px-4 py-3 text-sm text-danger-900"
        >
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          <span>
            YouTube connection failed (
            <span className="font-mono text-xs">{youtubeError}</span>
            ). Try again, or contact support if this persists.
          </span>
        </p>
      ) : null}

      <AppStoreLayout
        back={{ href: `/dashboard/${eventId}/studio`, label: 'Back to add-ons' }}
        hero={{
          Icon: Video,
          eyebrow: 'Live Studio',
          title: 'Stream it live — your way.',
          tagline:
            'Give the people you love a front-row seat from anywhere. Direct a Main Stage between your cameras with a tap, or let each guest choose the angle they want to watch — every corner of your day, live.',
          statusPill: statusPillForState(stateCtx.state) ?? { label: 'Web V1', tone: 'accent' },
          cta,
        }}
        stats={stats4}
        justLaunchedChip={stats.hasLaunchSignal ? null : 'Just launched · early access'}
        highlights={{
          title: "What you'll have",
          items: [
            'One directed Main Stage you cut between cameras with a tap',
            'Multiple cameras — one per angle, room, or venue',
            'Guests can pick their own view and switch live',
            'Cameras join as phones via the event QR — no install, no per-camera fee',
            'Plays right on your event page, in your colors',
            'One price, per event — the free single-camera livestream stays free',
          ],
        }}
        description={{
          paragraphs: [
            'A celebration happens in more than one place at once — the ceremony up front, the reception floor, the photo booth in the corner, sometimes a whole second venue. Live Studio lets you direct all of it: line up your cameras, then cut whichever one matters most onto the Main Stage every remote guest is watching.',
            `You set it up in the controller (${priceLabel}, one price per event): name each camera, group them by venue, mark a default, and cut between them live on the day. Each camera is just a phone your paparazzi join by scanning the event QR — no install, no per-camera fee. Guests who want to wander can pick their own view; everyone else follows your directed Main Stage.`,
            'Live Studio merges the two things people asked for — a directed broadcast and a choose-your-own-camera experience — into one tool. The single-camera livestream stays free; Live Studio is the multi-camera upgrade.',
          ],
          plans: [planRow],
          notIncluded: [
            'Your camera people are friends or family with phones — not a hired crew.',
            'The free single-camera livestream is a separate, always-free service — Live Studio is the paid multi-camera upgrade.',
            'No compositing in this version — picture-in-picture, split-screen, and graphics overlays are a later Pro layer. Live Studio cuts cleanly between whole cameras.',
            'A Setnayan-provided camera kit is an optional add-on, not included in this price.',
            'Build state: the switching controller and picker are in place; live multi-camera streaming rolls out as the streaming infrastructure comes online.',
          ],
        }}
      />

      <YoutubeChannelPanel
        eventId={eventId}
        oauthReady={oauthReady}
        grant={youtubeGrant}
        ownsHostedChannel={ownsHostedChannel}
      />

      <HostedChannelUpsell
        eventId={eventId}
        owns={ownsHostedChannel}
        priceLabel={hostedChannelPriceLabel}
        priceCentavos={hostedChannelCentavos}
        settings={settings}
      />
    </div>
  );
}

/**
 * "Rather have Setnayan run the channel?" — the OPTIONAL upsell (owner ruling
 * 2026-09-02). Deliberately its OWN <ChoosePlanSheet>, not folded into the
 * LIVE_STUDIO plan above: `AddOnStateCta` only renders a plan sheet in the
 * 'add' state (state-cta.tsx) — once an event owns Live Studio the hero CTA
 * becomes a bare "Open controller" link with no sheet at all, which would
 * strand a couple who bought Live Studio FIRST and only decides later that
 * they'd rather not run their own channel. This section is independent of
 * `stateCtx` entirely, so it is reachable before OR after Live Studio itself
 * is bought — matching "STACKS on LIVE_STUDIO, does not replace it".
 */
function HostedChannelUpsell({
  eventId,
  owns,
  priceLabel,
  priceCentavos,
  settings,
}: {
  eventId: string;
  owns: boolean;
  priceLabel: string;
  priceCentavos: number;
  settings: ChoosePlanSheetProps['settings'];
}) {
  return (
    <section
      aria-labelledby="hosted-channel-heading"
      className="sn-tile space-y-3 p-5 sm:p-6"
    >
      <div className="space-y-1">
        <p className="sn-eye">Optional</p>
        <h2
          id="hosted-channel-heading"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <Tv aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          Have Setnayan run the channel
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          By default your broadcast goes out on your own YouTube — paste your watch
          link, or start your own broadcast, right in the controller. If you don&rsquo;t
          have live-stream access, or would rather not set it up yourself, add this and
          Setnayan supplies and runs the channel for you instead. It only changes which
          channel your broadcast goes to — everything else about Live Studio (cameras,
          cutting, guest-pick) is unaffected either way.
        </p>
      </div>

      {owns ? (
        <p className="inline-flex items-center gap-2 rounded-lg border border-success-200/80 bg-success-50/60 px-3 py-2.5 text-sm text-ink">
          <CheckCircle2 aria-hidden className="h-4 w-4 text-success-600" strokeWidth={2} />
          Setnayan is providing your channel for this event.
        </p>
      ) : (
        <ChoosePlanSheet
          eventId={eventId}
          triggerLabel="Add hosted channel"
          priceFromLabel={priceLabel === '—' ? undefined : `${priceLabel} / day`}
          plans={[
            {
              sku_code: LIVE_STUDIO_HOSTED_CHANNEL_SKU,
              name: 'Live Studio — hosted channel',
              scope:
                'Setnayan supplies and operates the YouTube channel your broadcast streams to. Buy alongside Live Studio, any time before or after — this does not include the multi-camera controller itself.',
              price: priceLabel,
              unit: ' / day',
              priceCentavos: String(priceCentavos),
            },
          ]}
          settings={settings}
          introCopy="For couples without live-stream access, or who'd rather not set one up themselves — Setnayan runs the channel so you don't have to."
          footnote="Apply-then-pay flow · we confirm price before payment. Stacks on Live Studio — buy this any time, before or after."
        />
      )}
    </section>
  );
}

/**
 * "Your YouTube channel" — connect, and (the part that matters) DISCONNECT.
 *
 * Four states, in the order the couple can be in:
 *   1. Setnayan supplies the channel (pool-only) → nothing to connect, and
 *      /api/oauth/youtube/start answers 409, so a button here would be a fake door.
 *   2. OAuth not configured yet → an honest "not available yet", never a dead button.
 *   3. Connected → who it is, when, and the way OUT.
 *   4. Otherwise → Connect.
 *
 * Pool-only is checked FIRST on purpose: it is a compliance boundary (an
 * Internal-audience OAuth client would refuse these users anyway), not a fallback.
 */
function YoutubeChannelPanel({
  eventId,
  oauthReady,
  grant,
  ownsHostedChannel,
}: {
  eventId: string;
  oauthReady: boolean;
  grant: YoutubeGrant | null;
  ownsHostedChannel: boolean;
}) {
  const poolOnly = liveStudioPoolOnly();
  const grantedDate = grant
    ? new Date(grant.granted_at).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <section
      aria-labelledby="live-studio-youtube-heading"
      className="sn-tile space-y-4 p-5 sm:p-6"
    >
      <div className="space-y-1">
        <p className="sn-eye">Your channel</p>
        <h2
          id="live-studio-youtube-heading"
          className="flex items-center gap-2 text-xl font-semibold tracking-tight"
        >
          <Tv aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          Your YouTube channel
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          Connect a channel and your broadcast goes out on <em>your</em> YouTube — the
          watch link and the recording stay yours. We ask for one permission, the
          narrowest one that can start a live broadcast: no upload access, and nothing
          about your email, profile, other videos, subscribers or comments.
        </p>
      </div>

      {poolOnly ? (
        <p className="rounded-xl border border-ink/15 bg-cream/80 p-5 text-sm text-ink/70">
          {poolOnlyConnectNotice(ownsHostedChannel)}
        </p>
      ) : !oauthReady ? (
        <div className="sn-row p-5">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-ink/5 text-ink/55"
            >
              <Lock className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-ink/85">Not available yet</p>
              <p className="max-w-prose text-xs text-ink/60">
                Setnayan&rsquo;s YouTube app review is still with Google. We&rsquo;ll email
                you the moment the Connect button lights up — everything else on this page
                works in the meantime.
              </p>
            </div>
          </div>
        </div>
      ) : grant ? (
        <div className="space-y-3 rounded-xl border border-success-200/80 bg-success-50/60 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-success-100 text-success-700"
              >
                <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-ink">
                  Connected to YouTube:{' '}
                  {grant.external_account_display ?? 'Connected channel'}
                </p>
                <p className="font-mono text-[11px] text-ink/55">
                  {grant.external_account_id ? `Channel id ${grant.external_account_id} · ` : ''}
                  Connected {grantedDate}
                </p>
              </div>
            </div>
            {/* ⭐ THE ONE CONTROL THIS PAGE EXISTS TO KEEP ALIVE. Guarded by
                lib/live-studio-cast-retirement.test.ts — do not remove it without
                putting it somewhere a couple can still reach. */}
            <form action="/api/oauth/youtube/disconnect" method="post">
              <input type="hidden" name="event_id" value={eventId} />
              <SubmitButton
                pendingLabel="Disconnecting…"
                className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
              >
                <Unlink2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Disconnect
              </SubmitButton>
            </form>
          </div>
          <p className="text-xs text-ink/65">
            Disconnecting stops Setnayan using this channel and deletes the key we hold
            for it, and we ask Google to cancel our access. That last step is
            best-effort — remove Setnayan from your Google account permissions if you
            want to be certain.{' '}
            <Link href="/privacy" className="text-terracotta hover:underline">
              How we handle Google data
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-2 rounded-xl border border-terracotta/30 bg-cream/80 p-5">
          <Link
            href={`/api/oauth/youtube/start?event_id=${eventId}`}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
          >
            <ExternalLink aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Connect YouTube
          </Link>
          <p className="text-xs text-ink/55">
            You&rsquo;ll go to Google to grant access, then come straight back here. About
            20 seconds — and you can disconnect from this page any time.
          </p>
        </div>
      )}
    </section>
  );
}
