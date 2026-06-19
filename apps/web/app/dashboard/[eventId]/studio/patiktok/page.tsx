import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  Film,
  Hash,
  Loader2,
  Music,
  QrCode,
  ShoppingCart,
  Smartphone,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { presignDisplayUrl } from '@/lib/uploads';
import { isR2Configured, R2_BUCKETS } from '@/lib/r2';
import { SubmitButton } from '@/app/_components/submit-button';
import { formatPhp } from '@/lib/orders';
import {
  PATIKTOK_CATEGORIES,
  PATIKTOK_OVERAGE_PHP,
  PATIKTOK_TEMPLATES,
  PATIKTOK_TIERS,
  PATIKTOK_VIDEO_SOFT_CAP,
  findPatiktokTemplate,
  type PatiktokCategory,
  type PatiktokTemplate,
} from '@/lib/patiktok';
import { createOrder } from '../../orders/actions';
// 2026-05-29 Day 2 inline-checkout sprint (CLAUDE.md Day 2 row · V1 SCOPE
// EXPANSION). The per-tier "Buy 1 day" form now opens the InlineCheckoutDrawer
// inline instead of routing to /orders/[id]. service_key is the canonical
// SKU code (patiktok_setnayan_tiktok or patiktok_personal_tiktok) so the
// voucher coverage check works. The TikTok-OAuth gate stays in place — couples
// must connect TikTok before the buy CTA shows for the Personal tier.
// Cross-refs:
//   • apps/web/app/dashboard/[eventId]/_components/inline-checkout-drawer.tsx
//   • apps/web/app/dashboard/[eventId]/checkout/actions.ts
//   • PR #594 + PR #595 voucher schema substrate
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { InlineCheckoutDrawer } from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';
import { disconnectPatiktokTiktok } from './actions';
import { ReelRenderer } from './_components/reel-renderer';

type RenderJobRow = {
  job_id: string;
  template_slug: string;
  duration_sec: number;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  output_url: string | null;
  output_object_key: string | null;
  failure_reason: string | null;
  enqueued_at: string;
  completed_at: string | null;
};

type TiktokGrant = {
  tiktok_handle: string | null;
  tiktok_open_id: string;
  expires_at: string;
};

type PatiktokTier = (typeof PATIKTOK_TIERS)[number];

export const metadata = { title: 'Patiktok · Setnayan' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    category?: string;
    queued?: string;
    tiktok_connected?: string;
    tiktok_disconnected?: string;
    tiktok_error?: string;
    missing?: string;
  }>;
};

export default async function PatiktokGallery({
  params,
  searchParams,
}: Props) {
  const { eventId } = await params;
  const {
    category,
    queued,
    tiktok_connected: tiktokConnected,
    tiktok_disconnected: tiktokDisconnected,
    tiktok_error: tiktokError,
    missing: tiktokMissing,
  } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase
    .from('events')
    .select('display_name, event_date')
    .eq('event_id', eventId)
    .maybeSingle();

  const activeCategory: PatiktokCategory | 'all' =
    PATIKTOK_CATEGORIES.find((c) => c.key === category)?.key ?? 'all';

  const visibleTemplates =
    activeCategory === 'all'
      ? PATIKTOK_TEMPLATES
      : PATIKTOK_TEMPLATES.filter((t) => t.category === activeCategory);

  const { data: jobsRaw } = await supabase
    .from('patiktok_render_jobs')
    .select(
      'job_id, template_slug, duration_sec, status, output_url, output_object_key, failure_reason, enqueued_at, completed_at',
    )
    .eq('event_id', eventId)
    .order('enqueued_at', { ascending: false })
    .limit(20);
  const jobs = (jobsRaw ?? []) as RenderJobRow[];

  // Resolve a fresh presigned download URL for completed reels (the stored
  // output_url presign expires; output_object_key is the durable pointer).
  const downloadUrls: Record<string, string> = {};
  const completedJobs = jobs.filter(
    (j) => j.status === 'completed' && j.output_object_key,
  );
  if (isR2Configured() && completedJobs.length > 0) {
    const entries = await Promise.all(
      completedJobs.map(
        async (j) =>
          [
            j.job_id,
            await presignDisplayUrl(
              R2_BUCKETS.media,
              j.output_object_key as string,
              60 * 60 * 24 * 7,
            ),
          ] as const,
      ),
    );
    for (const [id, url] of entries) downloadUrls[id] = url;
  }

  const { data: grantRaw } = await supabase
    .from('patiktok_oauth_grants')
    .select('tiktok_handle, tiktok_open_id, expires_at')
    .eq('event_id', eventId)
    .is('revoked_at', null)
    .maybeSingle();
  const tiktokGrant = (grantRaw ?? null) as TiktokGrant | null;

  // 2026-05-29 Day 2 · BDO + GCash for the InlineCheckoutDrawer rendered
  // per-tier below. Cheaper to fetch once at page level than per TierCard.
  const settings = await fetchPlatformSettings(supabase);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/dashboard/${eventId}/studio`}
          className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Back to add-ons
        </Link>
        <Link
          href={`/dashboard/${eventId}/studio/patiktok/booth`}
          className="inline-flex items-center gap-1.5 rounded-md bg-mulberry px-3 py-1.5 text-xs font-medium text-cream hover:bg-mulberry-600"
        >
          Open booth dashboard →
        </Link>
      </div>

      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
          Patiktok · TikTok-style mimic station
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Pick the reel templates for your booth
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Patiktok places an X-mark booth at your venue. Guests stand on the
          mark, mimic your chosen reel through the Setnayan app, and we
          auto-compile a viral-ready group video.{' '}
          <span className="font-mono text-ink">9:16 · 1080×1920 · 1–30s</span>{' '}
          per clip.
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          V1.5+ build · purchase live · render queue active
        </p>
      </header>

      {queued ? (
        <p
          role="status"
          className="inline-flex items-center gap-2 rounded-2xl border border-success-300/70 bg-success-50 px-4 py-3 text-sm text-success-900"
        >
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Render queued. Render it right here in your browser below — it&rsquo;s
          ready to download the moment it finishes.
        </p>
      ) : null}

      {queued ? <ReelRenderer jobId={queued} eventId={eventId} /> : null}

      {tiktokConnected ? (
        <p
          role="status"
          className="inline-flex items-center gap-2 rounded-2xl border border-success-300/70 bg-success-50 px-4 py-3 text-sm text-success-900"
        >
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          TikTok connected
          {tiktokGrant?.tiktok_handle
            ? ` — @${tiktokGrant.tiktok_handle}`
            : ''}
          . Your Patiktok renders will auto-post here.
        </p>
      ) : null}

      {tiktokDisconnected ? (
        <p
          role="status"
          className="inline-flex items-center gap-2 rounded-2xl border border-ink/15 bg-cream px-4 py-3 text-sm text-ink/70"
        >
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          TikTok disconnected. Re-connect anytime to resume Personal-tier posting.
        </p>
      ) : null}

      {tiktokError ? (
        <p
          role="alert"
          className="inline-flex items-start gap-2 rounded-2xl border border-danger-300/70 bg-danger-50 px-4 py-3 text-sm text-danger-900"
        >
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          <span>
            TikTok connection failed (
            <span className="font-mono text-xs">{tiktokError}</span>
            {tiktokMissing
              ? `; env missing: ${tiktokMissing}`
              : ''}
            ). Try again or contact support if this persists.
          </span>
        </p>
      ) : null}

      <PricingTiers
        eventId={eventId}
        couplePurchasable
        tiktokGrant={tiktokGrant}
        settings={settings}
      />

      <YourRenders jobs={jobs} eventId={eventId} downloadUrls={downloadUrls} />

      <HowItWorks />

      <CategoryChips eventId={eventId} active={activeCategory} />

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleTemplates.map((t) => (
          <li key={t.slug}>
            <TemplateCard
              eventId={eventId}
              template={t}
              coupleName={event?.display_name ?? ''}
            />
          </li>
        ))}
      </ul>

      {visibleTemplates.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink/15 bg-cream p-6 text-center text-sm text-ink/55">
          No templates in this category yet — pick another above.
        </p>
      ) : null}

      <p className="text-xs text-ink/55">
        Need a custom reel template? Open a{' '}
        <Link
          href={`/help#contact`}
          className="text-terracotta hover:underline"
        >
          support request
        </Link>{' '}
        — describe the vibe + reference TikTok link and our team will quote.
      </p>
    </section>
  );
}

function YourRenders({
  jobs,
  eventId: _eventId,
  downloadUrls,
}: {
  jobs: ReadonlyArray<RenderJobRow>;
  eventId: string;
  downloadUrls: Record<string, string>;
}) {
  if (jobs.length === 0) return null;
  return (
    <section className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Your renders</h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          Latest {Math.min(jobs.length, 20)} · live queue state
        </p>
      </header>
      <ul className="divide-y divide-ink/5">
        {jobs.map((job) => {
          const template = findPatiktokTemplate(job.template_slug);
          const templateName = template?.name ?? job.template_slug;
          return (
            <li
              key={job.job_id}
              className="flex flex-wrap items-center gap-3 py-3 text-sm"
            >
              <RenderStatusPill status={job.status} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{templateName}</p>
                <p className="font-mono text-[11px] text-ink/55">
                  {job.duration_sec}s · queued{' '}
                  {new Date(job.enqueued_at).toLocaleString('en-PH', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
                {job.status === 'failed' && job.failure_reason ? (
                  <p className="text-[11px] text-danger-700">
                    {job.failure_reason}
                  </p>
                ) : null}
              </div>
              {job.status === 'completed' && downloadUrls[job.job_id] ? (
                <a
                  href={downloadUrls[job.job_id]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-mulberry px-2.5 py-1.5 text-xs font-medium text-cream transition-colors hover:bg-mulberry-600"
                >
                  <Download aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Download
                </a>
              ) : job.status === 'completed' ? (
                <p className="font-mono text-[11px] text-ink/55">Ready</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RenderStatusPill({ status }: { status: RenderJobRow['status'] }) {
  const map: Record<
    RenderJobRow['status'],
    { Icon: typeof Clock3; cls: string; label: string }
  > = {
    queued: {
      Icon: Clock3,
      cls: 'bg-ink/5 text-ink/70',
      label: 'Queued',
    },
    processing: {
      Icon: Loader2,
      cls: 'bg-warn-100 text-warn-900',
      label: 'Rendering',
    },
    completed: {
      Icon: CheckCircle2,
      cls: 'bg-success-100 text-success-900',
      label: 'Completed',
    },
    failed: {
      Icon: XCircle,
      cls: 'bg-danger-100 text-danger-900',
      label: 'Failed',
    },
    cancelled: {
      Icon: XCircle,
      cls: 'bg-ink/5 text-ink/55',
      label: 'Cancelled',
    },
  };
  const { Icon, cls, label } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${cls}`}
    >
      <Icon
        aria-hidden
        className={`h-3 w-3 ${status === 'processing' ? 'animate-spin' : ''}`}
        strokeWidth={1.75}
      />
      {label}
    </span>
  );
}

function PricingTiers({
  eventId,
  couplePurchasable,
  tiktokGrant,
  settings,
}: {
  eventId: string;
  couplePurchasable: boolean;
  tiktokGrant: TiktokGrant | null;
  settings: {
    bdo_account_name: string | null;
    bdo_account_number: string | null;
    bdo_qr_url: string | null;
    gcash_account_name: string | null;
    gcash_number: string | null;
    gcash_qr_url: string | null;
  };
}) {
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {PATIKTOK_TIERS.map((tier) => (
        <TierCard
          key={tier.key}
          eventId={eventId}
          tier={tier}
          purchasable={couplePurchasable}
          tiktokGrant={tier.key === 'personal' ? tiktokGrant : null}
          settings={settings}
        />
      ))}
      <p className="sm:col-span-2 text-xs text-ink/55">
        Soft cap: {PATIKTOK_VIDEO_SOFT_CAP} captured videos per booth per day.
        Stack +10-video overage blocks at{' '}
        <span className="font-mono text-ink">
          {formatPhp(PATIKTOK_OVERAGE_PHP)} / +10
        </span>{' '}
        in-event if your crowd outruns the cap.
      </p>
    </section>
  );
}

function TierCard({
  eventId,
  tier,
  purchasable,
  tiktokGrant,
  settings,
}: {
  eventId: string;
  tier: PatiktokTier;
  purchasable: boolean;
  tiktokGrant: TiktokGrant | null;
  settings: {
    bdo_account_name: string | null;
    bdo_account_number: string | null;
    bdo_qr_url: string | null;
    gcash_account_name: string | null;
    gcash_number: string | null;
    gcash_qr_url: string | null;
  };
}) {
  const isPersonal = tier.key === 'personal';
  // 2026-05-29 Day 2 · canonical SKU codes (matches apps/web/lib/sku-catalog.ts
  // which sources from supabase service_catalog) so voucher coverage_service_keys
  // lookups land. Old `patiktok:personal_daily` / `patiktok:setnayan_daily`
  // pseudo-keys were never in service_catalog · drift cleanup.
  const serviceKey = isPersonal
    ? 'patiktok_personal_tiktok'
    : 'patiktok_setnayan_tiktok';
  const description = isPersonal
    ? `Patiktok booth · Personal tier · ${tier.label}`
    : `Patiktok booth · Setnayan tier · ${tier.label}`;
  const needsTiktokConnect = isPersonal && !tiktokGrant;
  return (
    <article className="flex h-full flex-col gap-3 rounded-2xl border border-ink/10 bg-cream p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Per-day tier
          </p>
          <h2 className="text-lg font-semibold tracking-tight">{tier.label}</h2>
        </div>
        <span className="rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.15em] text-terracotta-700">
          {formatPhp(tier.pricePhpPerDay)} / day
        </span>
      </div>
      <p className="text-sm text-ink/70">{tier.blurb}</p>

      {isPersonal && tiktokGrant ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="inline-flex items-center gap-1.5 rounded-md bg-success-50 px-2.5 py-1 text-[11px] text-success-900">
            <CheckCircle2 aria-hidden className="h-3 w-3" strokeWidth={1.75} />
            TikTok connected
            {tiktokGrant.tiktok_handle ? `: @${tiktokGrant.tiktok_handle}` : ''}
          </p>
          <form action={disconnectPatiktokTiktok}>
            <input type="hidden" name="event_id" value={eventId} />
            <SubmitButton
              className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-2.5 py-1 text-[11px] text-ink/70 hover:border-danger-300 hover:text-danger-700 disabled:opacity-70"
              pendingLabel="Disconnecting…"
            >
              Disconnect TikTok
            </SubmitButton>
          </form>
        </div>
      ) : null}

      {purchasable && needsTiktokConnect ? (
        <div className="mt-auto space-y-2 pt-1">
          <Link
            href={`/api/tiktok/auth/start?event_id=${eventId}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-terracotta bg-cream px-4 py-2 text-sm font-medium text-terracotta-700 transition-colors hover:bg-terracotta/10"
          >
            <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
            Connect TikTok to enable buy
          </Link>
          <p className="text-[11px] text-ink/55">
            Personal tier auto-posts to your own TikTok. One-time OAuth — we
            store the access token scoped to this event only.
          </p>
        </div>
      ) : null}

      {purchasable && !needsTiktokConnect ? (
        <div className="mt-auto pt-1">
          {/*
            2026-05-29 Day 2 inline-checkout · replaces the legacy
            <form action={createOrder}> that submitted to /orders/[id].
            The drawer renders voucher + QR + screenshot + submit on
            the same page · couples stay in the patiktok detail surface
            through the whole flow.
          */}
          <InlineCheckoutDrawer
            eventId={eventId}
            serviceKey={serviceKey}
            displayName={description}
            originalPriceCentavos={String(
              Math.round(tier.pricePhpPerDay * 100),
            )}
            settings={settings}
            triggerLabel={`Buy 1 day · ${formatPhp(tier.pricePhpPerDay)}`}
            triggerClassName="inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
          />
          <p className="pt-2 text-[11px] text-ink/55">
            Apply-then-pay · Setnayan confirms inside 24 h after BDO / GCash
            payment is logged.
          </p>
        </div>
      ) : null}
    </article>
  );
}

function HowItWorks() {
  const steps: ReadonlyArray<{
    Icon: typeof Music;
    title: string;
    body: string;
  }> = [
    {
      Icon: Music,
      title: '1 · Pick 2 templates',
      body: 'Browse below and lock in one primary + one backup reel. Setnayan-owned music pairs to each template — no licensing surprises.',
    },
    {
      Icon: QrCode,
      title: '2 · Print the booth QR',
      body: 'We email a print-ready PDF. Hand it to your coordinator or booth operator — they scan it to open the live dashboard.',
    },
    {
      Icon: Smartphone,
      title: '3 · Guests cycle through',
      body: 'Operator picks template per guest, app captures the mimic with face-lock, app compiles all clips into a single 9:16 reel.',
    },
  ];
  return (
    <section className="space-y-3 rounded-2xl border border-warn-200/60 bg-warn-50/60 p-4">
      <p className="inline-flex items-center gap-1.5 text-sm font-medium text-warn-900">
        <Sparkles className="h-4 w-4" strokeWidth={1.75} />
        How Patiktok runs at your event
      </p>
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {steps.map((s) => (
          <li key={s.title} className="space-y-1">
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-warn-900">
              <s.Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              {s.title}
            </p>
            <p className="text-xs text-warn-900/85">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function CategoryChips({
  eventId,
  active,
}: {
  eventId: string;
  active: PatiktokCategory | 'all';
}) {
  const items: ReadonlyArray<{ key: PatiktokCategory | 'all'; label: string }> = [
    { key: 'all', label: 'All templates' },
    ...PATIKTOK_CATEGORIES,
  ];
  return (
    <nav
      aria-label="Filter templates by category"
      className="flex flex-wrap gap-2"
    >
      {items.map((item) => {
        const isActive = item.key === active;
        const href =
          item.key === 'all'
            ? `/dashboard/${eventId}/studio/patiktok`
            : `/dashboard/${eventId}/studio/patiktok?category=${item.key}`;
        return (
          <Link
            key={item.key}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={
              isActive
                ? 'inline-flex items-center gap-1.5 rounded-full bg-terracotta px-3 py-1 text-xs font-medium text-cream'
                : 'inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-cream px-3 py-1 text-xs font-medium text-ink/70 hover:border-terracotta/40 hover:text-terracotta-700'
            }
          >
            <Hash aria-hidden className="h-3 w-3" strokeWidth={1.75} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function TemplateCard({
  eventId,
  template,
  coupleName,
}: {
  eventId: string;
  template: PatiktokTemplate;
  coupleName: string;
}) {
  return (
    <article className="flex h-full flex-col gap-3 overflow-hidden rounded-xl border border-ink/10 bg-cream">
      <Preview template={template} coupleName={coupleName} />
      <div className="space-y-2 px-4 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">{template.name}</h2>
            <p className="text-xs text-ink/55">{template.bestFor}</p>
          </div>
          <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/65">
            {template.defaultDurationSec}s
          </span>
        </div>
        <p className="text-xs text-ink/70">{template.vibe}</p>
        <Link
          href={`/dashboard/${eventId}/studio/patiktok/${template.slug}`}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
        >
          <Film className="h-4 w-4" strokeWidth={1.75} />
          Choose template
        </Link>
      </div>
    </article>
  );
}

function Preview({
  template,
  coupleName,
}: {
  template: PatiktokTemplate;
  coupleName: string;
}) {
  const [bg, accent1, accent2, dark] = template.palette;
  const display = coupleName.length > 0 ? coupleName : 'Your name & Their name';
  return (
    <div
      aria-hidden
      className="relative flex aspect-[9/16] items-center justify-center"
      style={{ backgroundColor: bg }}
    >
      <div
        className="absolute inset-x-0 top-0 h-1.5"
        style={{ backgroundColor: accent1 }}
      />
      <div
        className="absolute inset-x-0 bottom-0 flex h-2 items-stretch"
        style={{ backgroundColor: dark }}
      >
        <span className="block flex-1" style={{ backgroundColor: accent1 }} />
        <span className="block flex-1" style={{ backgroundColor: accent2 }} />
        <span className="block flex-1" style={{ backgroundColor: dark }} />
        <span className="block flex-1" style={{ backgroundColor: bg }} />
      </div>
      <div className="flex flex-col items-center gap-2 px-4 text-center">
        <p
          className="font-mono text-[10px] uppercase tracking-[0.3em]"
          style={{ color: dark }}
        >
          Patiktok · 9:16
        </p>
        <p
          className={`text-xl tracking-tight ${template.fontClass}`}
          style={{ color: dark }}
        >
          {display}
        </p>
        <span
          className="inline-block h-px w-12"
          style={{ backgroundColor: accent2 }}
        />
        <p
          className="font-mono text-[9px] uppercase tracking-[0.25em]"
          style={{ color: accent2 }}
        >
          {template.name}
        </p>
      </div>
    </div>
  );
}
