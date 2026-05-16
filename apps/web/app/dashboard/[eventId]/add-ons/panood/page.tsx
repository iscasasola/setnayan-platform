import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowLeft,
  Tv,
  Video,
  Camera,
  Sparkles,
  MonitorPlay,
  Clock3,
  CheckCircle2,
  Lock,
  Star,
  Radio,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatPhp } from '@/lib/orders';
import { CopyLink } from './_components/copy-link';

export const metadata = { title: 'Panood · Setnayan' };

// Iteration 0011 — Panood scaffold-level launch (V1.5+ unlock 2026-05-16).
//
// What this page is: the couple-facing setup + broadcaster admin surface for
// Panood. It replaces the IterationPlaceholder shim under the `panood` key.
//
// What this page is NOT: a real broadcaster. Every integration seam — SFU
// ingest, RTMP relay, AI render pipeline, projector cast, camera-operator
// handshake — is stubbed with mock data and a `// TODO(0011):` marker so the
// real wiring drops into clear seams in a follow-up iteration. Vendor-
// infrastructure procurement (Cloudflare Stream Live entitlement + YouTube
// master-channel provisioning) is the precondition for that follow-up.
//
// Prices below are sourced from the 2026-05-09 decision log (the
// composite-era SKU lock that is still the price floor surfaced to couples
// in V1.5+ today). The newer 2026-05-16 BYO-YouTube pivot in the spec is
// pricing-only and does NOT change this scaffold surface; it changes the
// SKU codes the orders system writes, which is a separate concern.

// V1.5+ price floors — see CLAUDE.md decision log row 2026-05-09 (apparatus
// rule) for the source. Do NOT invent new prices; if the spec moves, this
// constant moves with it. All values are PHP whole pesos.
const PANOOD_BASE_PHP = 2500;
const CAMERA_ADDON_PHP = 1000;
const HOUR_ADDON_PHP = 1000;
const STYLE_PACK_PHP = 3000;
const STYLE_PACK_MODES = 4;
const AI_EDITED_HIGHLIGHT_PHP = 5000;
const CUSTOM_MONOGRAM_PHP = 1999;
const SAME_DAY_EDIT_PHP = 24999;

// Mock event state. TODO(0011): replace with a real Supabase read against
// `events.panood_state` (or wherever the orchestrator settles) once the
// schema lands. For the scaffold we surface a typical "base + 1 extra cam +
// 1 extra hour, no premium packs yet" configuration so the UI shows both
// the "owned" and "not yet owned" states side by side.
type PanoodSetup = {
  baseOwned: boolean;
  extraCameras: number;     // count of `panood_camera_addon` purchases
  extraHours: number;       // count of `panood_hour_addon` purchases
  customMonogramOwned: boolean;
  broadcastStyleOwned: boolean;
  aiEditedHighlightCount: number; // multi-purchase
  // Surface-only state — once the broadcaster session goes live we record
  // the YouTube watch URL on the event row; null while the broadcast is
  // staged but not yet running.
  youtubeWatchUrl: string | null;
};

function mockPanoodSetup(): PanoodSetup {
  return {
    baseOwned: true,
    extraCameras: 1,
    extraHours: 1,
    customMonogramOwned: false,
    broadcastStyleOwned: false,
    aiEditedHighlightCount: 0,
    // Mock YouTube watch URL — appears once the setup is "complete". The
    // real value lands here from the YouTube Data API after broadcast
    // creation (TODO(0011): wire that call).
    youtubeWatchUrl: null,
  };
}

type Props = { params: Promise<{ eventId: string }> };

export default async function PanoodSetupPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase
    .from('events')
    .select('event_id, public_id, display_name')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) notFound();

  const setup = mockPanoodSetup();

  const totalCameras = 3 + setup.extraCameras;
  const totalHours = 3 + setup.extraHours;
  // Mock consumption — a freshly-purchased event hasn't used any hours yet.
  // TODO(0011): once broadcasts persist, read elapsed broadcast time from
  // the broadcast session ledger.
  const hoursConsumed = 0;
  const hoursRemaining = totalHours - hoursConsumed;

  // Stub broadcaster + camera-operator setup URLs. The slug uses the
  // event's public_id (the canonical, share-safe id) so the URL stays
  // consistent across the four hand-offs we'd make in the real system.
  const slug = event.public_id;
  const broadcasterUrl = `setnayan.com/v/panood/${slug}/broadcaster`;
  // TODO(0011): camera-operator URLs should embed a per-camera session
  // token and a per-cam slot id once the orchestrator can mint them.
  const cameraUrl = (n: number) => `setnayan.com/v/panood/${slug}/cam/${n}`;

  return (
    <section className="space-y-8">
      <Link
        href={`/dashboard/${eventId}/add-ons`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to add-ons
      </Link>

      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
          Panood · live stream
        </p>
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          <Tv aria-hidden className="h-7 w-7 text-terracotta" strokeWidth={1.75} />
          Broadcast your wedding live
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Set up the broadcaster, send a setup link to each camera operator, and we&rsquo;ll
          relay the composited feed to YouTube so family abroad can watch in real time.
          Highlight markers, projector cast, and YouTube auto-archive are included in the
          base SKU.
        </p>
      </header>

      <SetupStatus
        eventId={eventId}
        setup={setup}
        totalCameras={totalCameras}
        totalHours={totalHours}
        hoursConsumed={hoursConsumed}
        hoursRemaining={hoursRemaining}
      />

      <BroadcastSetup
        eventId={eventId}
        broadcasterUrl={broadcasterUrl}
        cameraUrl={cameraUrl}
        totalCameras={totalCameras}
      />

      <StyleAndAddOns setup={setup} />

      <YouTubeDelivery youtubeWatchUrl={setup.youtubeWatchUrl} />
    </section>
  );
}

// -----------------------------------------------------------------------------
// Section 1 — Setup status
// -----------------------------------------------------------------------------

function SetupStatus({
  eventId,
  setup,
  totalCameras,
  totalHours,
  hoursConsumed,
  hoursRemaining,
}: {
  eventId: string;
  setup: PanoodSetup;
  totalCameras: number;
  totalHours: number;
  hoursConsumed: number;
  hoursRemaining: number;
}) {
  return (
    <section
      aria-labelledby="setup-status-heading"
      className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Section 1 of 4
          </p>
          <h2 id="setup-status-heading" className="text-xl font-semibold tracking-tight">
            What you&rsquo;ve unlocked
          </h2>
        </div>
        {setup.baseOwned ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-900">
            <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Live Stream base owned
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
            <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Base SKU not yet purchased
          </span>
        )}
      </div>

      <p className="text-sm text-ink/70">
        Live Stream base &middot; 1 broadcaster + 3 cameras + 3hr capacity &middot;{' '}
        <span className="font-mono text-ink">{formatPhp(PANOOD_BASE_PHP)}</span>
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Cameras"
          value={`${totalCameras}`}
          sub={
            setup.extraCameras > 0
              ? `3 base + ${setup.extraCameras} add-on${setup.extraCameras === 1 ? '' : 's'}`
              : '3 base · no add-ons yet'
          }
          Icon={Camera}
        />
        <Stat
          label="Stream-capacity hours"
          value={`${hoursRemaining}`}
          sub={`${hoursConsumed} used / ${totalHours} total`}
          Icon={Clock3}
        />
        <Stat
          label="Highlight markers"
          value="Unlimited"
          sub="Included in base"
          Icon={Star}
        />
      </div>

      <ul className="divide-y divide-ink/10 rounded-lg border border-ink/10 bg-cream/60 text-sm">
        <AddOnRow
          label="Live Stream base (1 broadcaster · 3 cams · 3hr)"
          price={formatPhp(PANOOD_BASE_PHP)}
          owned={setup.baseOwned}
        />
        <AddOnRow
          label={`+1 camera (${setup.extraCameras} purchased · max 2)`}
          price={`${formatPhp(CAMERA_ADDON_PHP)} each`}
          owned={setup.extraCameras > 0}
        />
        <AddOnRow
          label={`+1 hour (${setup.extraHours} purchased · unlimited)`}
          price={`${formatPhp(HOUR_ADDON_PHP)} each`}
          owned={setup.extraHours > 0}
        />
      </ul>

      <p className="text-xs text-ink/55">
        Need more cameras or hours? Open the{' '}
        <Link
          href={`/dashboard/${eventId}/orders/new?service=panood-add-on`}
          className="text-terracotta hover:underline"
        >
          orders page
        </Link>{' '}
        &mdash; same apply-then-pay flow as every other Setnayan purchase. Prices are
        locked V1; we never auto-charge.
      </p>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  Icon,
}: {
  label: string;
  value: string;
  sub: string;
  Icon: typeof Camera;
}) {
  return (
    <div className="rounded-lg border border-ink/10 bg-cream/80 p-3">
      <div className="flex items-center gap-2 text-ink/60">
        <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em]">{label}</span>
      </div>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-ink/55">{sub}</p>
    </div>
  );
}

function AddOnRow({
  label,
  price,
  owned,
}: {
  label: string;
  price: string;
  owned: boolean;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
      <span className="flex items-center gap-2 text-ink/80">
        {owned ? (
          <CheckCircle2
            aria-hidden
            className="h-4 w-4 text-emerald-600"
            strokeWidth={2}
          />
        ) : (
          <span
            aria-hidden
            className="inline-block h-4 w-4 rounded-full border border-ink/20"
          />
        )}
        {label}
      </span>
      <span className="font-mono text-xs text-ink/65">{price}</span>
    </li>
  );
}

// -----------------------------------------------------------------------------
// Section 2 — Broadcast setup
// -----------------------------------------------------------------------------

function BroadcastSetup({
  eventId,
  broadcasterUrl,
  cameraUrl,
  totalCameras,
}: {
  eventId: string;
  broadcasterUrl: string;
  cameraUrl: (n: number) => string;
  totalCameras: number;
}) {
  return (
    <section
      aria-labelledby="broadcast-setup-heading"
      className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6"
    >
      <div className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          Section 2 of 4
        </p>
        <h2
          id="broadcast-setup-heading"
          className="flex items-center gap-2 text-xl font-semibold tracking-tight"
        >
          <Radio aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          Get the broadcaster + cameras online
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          The broadcaster runs the show: switches between cameras, marks highlights, and
          decides when to cut to standby. Each camera is a phone running the Panood
          camera-operator web client &mdash; no install, just open the link.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="space-y-3 rounded-xl border border-ink/10 bg-cream/70 p-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
            <Video aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
            Broadcaster URL
          </h3>
          <p className="text-sm text-ink/65">
            Open this on a laptop or tablet on broadcast day. Recommended: a screen with
            enough room for the camera grid plus the program feed.
          </p>
          <CopyLink
            label="Broadcaster admin"
            url={broadcasterUrl}
            hint="Only the broadcaster should hold this link. Single concurrent session."
          />
          <Link
            href={`/dashboard/${eventId}/add-ons/panood/broadcast`}
            className="inline-flex items-center gap-2 rounded-md bg-terracotta px-3 py-1.5 text-sm font-medium text-cream transition-colors hover:bg-terracotta-600"
          >
            <Tv aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Open broadcaster preview
          </Link>
        </article>

        <article className="space-y-3 rounded-xl border border-ink/10 bg-cream/70 p-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
            <Camera aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
            Camera operators
          </h3>
          <p className="text-sm text-ink/65">
            Send each operator their own setup link. The web client runs on any modern
            phone browser; no install required.
          </p>
          <div className="space-y-3">
            {Array.from({ length: Math.min(totalCameras, 3) }, (_, i) => i + 1).map((n) => (
              <CopyLink
                key={n}
                label={`Camera ${n} setup link`}
                url={cameraUrl(n)}
                hint={
                  n === 1
                    ? 'Camera 1 is the default wide / program-camera mic source.'
                    : undefined
                }
              />
            ))}
          </div>
          {totalCameras > 3 ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
              You&rsquo;ve added {totalCameras - 3} extra camera
              {totalCameras - 3 === 1 ? '' : 's'} &mdash; setup links for cameras 4
              {totalCameras > 4 ? '/5' : ''} appear once the broadcaster session opens.
            </p>
          ) : null}
        </article>
      </div>

      <p className="text-xs text-ink/55">
        Pro tip: each phone needs ~500 kbps sustained upload. Run the Venue Check tool a
        week ahead to flag low-connectivity venues so you can rent a portable hotspot if
        needed.
      </p>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Section 3 — Style + add-ons promo
// -----------------------------------------------------------------------------

function StyleAndAddOns({ setup }: { setup: PanoodSetup }) {
  return (
    <section
      aria-labelledby="addons-heading"
      className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6"
    >
      <div className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          Section 3 of 4
        </p>
        <h2
          id="addons-heading"
          className="flex items-center gap-2 text-xl font-semibold tracking-tight"
        >
          <Sparkles aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          Make it look like a film
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          Optional packs that elevate the broadcast and the post-event recap. Buy any of
          them through the normal orders flow; refunds follow the standard 24-hour SLA.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <PackCard
          Icon={Sparkles}
          title="Broadcast Style Pack"
          price={formatPhp(STYLE_PACK_PHP)}
          owned={setup.broadcastStyleOwned}
          blurb={`${STYLE_PACK_MODES} modes (News · Cinematic · Sports · Royalty) + transitions + color presets. Switch modes mid-event from the broadcaster admin.`}
          state="purchasable"
        />
        <PackCard
          Icon={Video}
          title="AI Edited Highlight"
          price={`${formatPhp(AI_EDITED_HIGHLIGHT_PHP)} / 3 min`}
          owned={setup.aiEditedHighlightCount > 0}
          blurb="A 3-minute storyline cut of the event — beats, music, and pacing chosen by Claude vision. Multi-purchase if you want alternate cuts."
          state="purchasable"
        />
        <PackCard
          Icon={Star}
          title="Custom Monogram Pack"
          price={formatPhp(CUSTOM_MONOGRAM_PHP)}
          owned={setup.customMonogramOwned}
          blurb="Replaces Setnayan branding on the broadcast watermark, intro/outro, and landing-page chrome. Includes Custom Standby screens."
          state="purchasable"
        />
        <PackCard
          Icon={Video}
          title="Same-Day Edit"
          price={`${formatPhp(SAME_DAY_EDIT_PHP)} flagship`}
          owned={false}
          blurb="The cinematic 3–5 minute film, delivered before the reception ends. Played live on the LED background screen at the climactic moment."
          state="v1_1"
        />
      </div>

      <p className="text-xs text-ink/55">
        Highlight markers (the &ldquo;★ Mark&rdquo; button on the broadcaster) and cast-to-projector
        are <span className="font-medium text-ink/75">free</span> with the base SKU.
      </p>
    </section>
  );
}

function PackCard({
  Icon,
  title,
  price,
  blurb,
  owned,
  state,
}: {
  Icon: typeof Sparkles;
  title: string;
  price: string;
  blurb: string;
  owned: boolean;
  state: 'purchasable' | 'v1_1';
}) {
  const disabled = state === 'v1_1';
  const cardClass = disabled
    ? 'flex h-full flex-col gap-3 rounded-xl border border-dashed border-ink/15 bg-cream/50 p-4 opacity-80'
    : 'flex h-full flex-col gap-3 rounded-xl border border-ink/10 bg-cream/80 p-4';

  return (
    <article className={cardClass}>
      <div className="flex items-start justify-between">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
          <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </span>
        {owned ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-900">
            <CheckCircle2 aria-hidden className="h-3 w-3" strokeWidth={2} />
            Owned
          </span>
        ) : disabled ? (
          <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            V1.1 · coming soon
          </span>
        ) : (
          <span className="rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
            Add-on
          </span>
        )}
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <p className="font-mono text-xs text-ink/65">{price}</p>
      </div>
      <p className="text-sm text-ink/70">{blurb}</p>
      <div className="mt-auto">
        {disabled ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-ink/45">
            <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Not yet available
          </span>
        ) : owned ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Active on this event
          </span>
        ) : (
          <span className="text-xs text-ink/55">
            Open the orders page to purchase. Refundable per the standard 24-hour SLA.
          </span>
        )}
      </div>
    </article>
  );
}

// -----------------------------------------------------------------------------
// Section 4 — YouTube delivery info
// -----------------------------------------------------------------------------

function YouTubeDelivery({
  youtubeWatchUrl,
}: {
  youtubeWatchUrl: string | null;
}) {
  return (
    <section
      aria-labelledby="youtube-heading"
      className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6"
    >
      <div className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          Section 4 of 4
        </p>
        <h2
          id="youtube-heading"
          className="flex items-center gap-2 text-xl font-semibold tracking-tight"
        >
          <MonitorPlay aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          How viewers watch
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          Setnayan ingests every camera, composites them server-side with your monogram
          and broadcast style, then relays the program feed to YouTube Live. Viewers
          watching on your Setnayan landing page and viewers watching on YouTube directly
          see the same broadcast served from YouTube&rsquo;s CDN.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        <DeliveryFact
          label="End-to-end latency"
          value="~10 seconds"
          sub="Ultra-low-latency mode + a couple seconds of composite headroom"
        />
        <DeliveryFact
          label="Audience cap"
          value="Unlimited"
          sub="YouTube&rsquo;s CDN handles 100 or 100,000 viewers at no extra cost"
        />
        <DeliveryFact
          label="Auto-archive"
          value="Unlisted on Setnayan&rsquo;s master channel"
          sub="Downloadable from your dashboard after the event"
        />
        <DeliveryFact
          label="Cast to projector"
          value="Included free"
          sub="HDMI from the broadcaster device — full polished feed on a laptop, raw camera feed on iPhone"
        />
      </ul>

      <div className="rounded-lg border border-ink/10 bg-cream/60 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
          YouTube watch URL
        </p>
        {youtubeWatchUrl ? (
          <p className="mt-1 font-mono text-sm text-ink/85">{youtubeWatchUrl}</p>
        ) : (
          <p className="mt-1 text-sm text-ink/60">
            Available once the broadcaster opens the session for the first time.
            We&rsquo;ll auto-create the YouTube broadcast with{' '}
            <span className="font-mono text-ink/75">monetization=false</span> and
            <span className="font-mono text-ink/75"> latencyPreference=ultraLow</span>{' '}
            so the broadcast is structurally incapable of running ads.
          </p>
        )}
      </div>

      <p className="text-xs text-ink/55">
        Want to share with smart-TV viewers? Once the broadcast is live, the YouTube
        watch URL can be cast to any Chromecast / Apple TV / Fire TV &mdash; the same URL
        works on every device.
      </p>
    </section>
  );
}

function DeliveryFact({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <li className="rounded-lg border border-ink/10 bg-cream/70 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
        {label}
      </p>
      <p className="mt-0.5 text-base font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-ink/55">{sub}</p>
    </li>
  );
}

// =============================================================================
// Integration seams — every TODO below is a real follow-up engineering ticket.
// Listed here in one place so a future iteration can grep for the marker and
// see the entire shape of the work without reading every JSX block.
//
// TODO(0011): Cloudflare Stream Live SFU connection — ingest WebRTC publishes
//             from each camera operator's phone; per-camera health pings up
//             to the broadcaster admin grid. Vendor entitlement is a Stripe
//             billing prerequisite Setnayan does not yet have.
// TODO(0011): YouTube RTMP relay — create the per-event broadcast via the
//             YouTube Data API with monetization=false + latencyPreference=
//             ultraLow, push the composited program feed via RTMP, and write
//             the resulting watch URL back to the event row so the landing
//             page can embed the IFrame Player.
// TODO(0011): Camera-operator handshake / session tokens — mint a short-
//             lived per-cam token at the moment the broadcaster issues a
//             "Send setup link" CTA. Token binds the phone to a specific
//             slot id so reconnects survive battery handoffs.
// TODO(0011): AI Edited Highlight render pipeline — pull from the YouTube
//             archive once recording lands, run the Claude vision pass on
//             the captured clips, render a 3-min cut via Remotion + Lottie
//             + LUT in the matching feel-category template.
// TODO(0011): Broadcast Style Pack runtime mode switching — the ffmpeg
//             compositor reads `events.panood_state.style_mode` per frame.
//             Mode switching is a JSONB patch the broadcaster admin pushes
//             via a server action.
// TODO(0011): Projector cast — wire the laptop popup-window + iPhone
//             external-display flow on the broadcaster admin. WebRTC client
//             pulls the composited feed (laptop) or raw active-camera feed
//             (iPhone) into a fullscreen <video> for the secondary display.
// =============================================================================
