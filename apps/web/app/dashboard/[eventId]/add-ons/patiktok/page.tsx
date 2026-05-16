import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowLeft,
  Film,
  Hash,
  Music,
  QrCode,
  ShoppingCart,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { SubmitButton } from '@/app/_components/submit-button';
import { formatPhp } from '@/lib/orders';
import {
  PATIKTOK_CATEGORIES,
  PATIKTOK_OVERAGE_PHP,
  PATIKTOK_TEMPLATES,
  PATIKTOK_TIERS,
  PATIKTOK_VIDEO_SOFT_CAP,
  type PatiktokCategory,
  type PatiktokTemplate,
} from '@/lib/patiktok';
import { createOrder } from '../../orders/actions';

type PatiktokTier = (typeof PATIKTOK_TIERS)[number];

export const metadata = { title: 'Patiktok · Setnayan' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ category?: string }>;
};

export default async function PatiktokGallery({
  params,
  searchParams,
}: Props) {
  const { eventId } = await params;
  const { category } = await searchParams;

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

  return (
    <section className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/add-ons`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to add-ons
      </Link>

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
          V1.5+ scaffold · purchase live · render pipeline ships in Phase 2
        </p>
      </header>

      <PricingTiers eventId={eventId} couplePurchasable />

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

function PricingTiers({
  eventId,
  couplePurchasable,
}: {
  eventId: string;
  couplePurchasable: boolean;
}) {
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {PATIKTOK_TIERS.map((tier) => (
        <TierCard
          key={tier.key}
          eventId={eventId}
          tier={tier}
          purchasable={couplePurchasable}
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
}: {
  eventId: string;
  tier: PatiktokTier;
  purchasable: boolean;
}) {
  const serviceKey =
    tier.key === 'personal'
      ? 'patiktok:personal_daily'
      : 'patiktok:setnayan_daily';
  const description =
    tier.key === 'personal'
      ? `Patiktok booth — Personal TikTok tier (₱${tier.pricePhpPerDay}/day · auto-post to couple's own TikTok via OAuth · 40-video soft cap).`
      : `Patiktok booth — Setnayan TikTok tier (₱${tier.pricePhpPerDay}/day · auto-post to @SetnayanWeddings · 40-video soft cap).`;
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
      {purchasable ? (
        <form action={createOrder} className="mt-auto pt-1">
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="service_key" value={serviceKey} />
          <input type="hidden" name="description" value={description} />
          <input
            type="hidden"
            name="requested_total_php"
            value={tier.pricePhpPerDay}
          />
          <SubmitButton
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-terracotta px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-terracotta-600 disabled:opacity-70"
            pendingLabel="Submitting…"
          >
            <ShoppingCart className="h-4 w-4" strokeWidth={1.75} />
            Buy 1 day · {formatPhp(tier.pricePhpPerDay)}
          </SubmitButton>
          <p className="pt-2 text-[11px] text-ink/55">
            Apply-then-pay · Setnayan confirms inside 24 h after BDO / GCash
            payment is logged.
          </p>
        </form>
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
    <section className="space-y-3 rounded-2xl border border-amber-200/60 bg-amber-50/60 p-4">
      <p className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-900">
        <Sparkles className="h-4 w-4" strokeWidth={1.75} />
        How Patiktok runs at your event
      </p>
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {steps.map((s) => (
          <li key={s.title} className="space-y-1">
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-900">
              <s.Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              {s.title}
            </p>
            <p className="text-xs text-amber-900/85">{s.body}</p>
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
            ? `/dashboard/${eventId}/add-ons/patiktok`
            : `/dashboard/${eventId}/add-ons/patiktok?category=${item.key}`;
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
          href={`/dashboard/${eventId}/add-ons/patiktok/${template.slug}`}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-terracotta px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-terracotta-600"
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
