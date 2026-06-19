import Link from 'next/link';
import { ArrowLeft, Check, ChevronRight, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { StudioCardDemo, RICH_DEMO_SLUGS, type DemoFrame } from './studio-card-demo';
import type { ReactNode } from 'react';

// Shared App Store-style detail layout. Used by:
//   • Customer add-on detail (apps/web/app/dashboard/[eventId]/studio/[addon]/page.tsx)
//   • Vendor service detail (apps/web/app/explore/[slug]/services/[serviceId]/page.tsx)
//     — fan-out planned after the 2026-05-17 Panood pilot ships.
//
// The layout is content-agnostic: every section accepts plain data props.
// Data-fetching lives in the page that mounts the layout.

export type StatTile = {
  // Lead value, big. e.g. "4.8", "312 events", "From ₱499/day"
  value: string;
  // Optional star fill for the rating tile (0-5).
  starFill?: number;
  // Tiny mono uppercase eyebrow above the value.
  eyebrow: string;
  // One-line caption below the value.
  caption: string;
};

export type PreviewItem = {
  // Caption shown under each card. e.g. "Broadcaster grid", "Camera operator phone".
  caption: string;
  // Optional eyebrow — surfaces "Desktop", "Mobile", "Server" etc.
  context?: string;
  // Plain content rendered inside the card frame. Pages can pass a static
  // illustration component, an <Image>, or just descriptive text.
  body: ReactNode;
  // Aspect ratio hint — defaults to 16/10. Mobile-first card width matches
  // App Store's portrait-ish ratio.
  aspect?: '16/10' | '9/16' | '1/1';
};

export type SampleItem = {
  title: string;
  caption: string;
  badge?: string; // "YouTube", "MP4", etc.
  href?: string;  // external link to an actual sample, when one exists
  body?: ReactNode;
};

export type PlanRow = {
  name: string;
  scope: string;       // e.g. "One day of broadcasting · single-cam by default"
  price: string;       // formatted PHP string
  unit: string;        // "/day", "/year", "each", ""
  // Optional callout — "Most popular", "Bundle", "New".
  badge?: string;
};

export type PrivacyCategory = {
  // e.g. "Event details"
  category: string;
  // e.g. ["Event date", "Couple names", "Venue address"]
  items: string[];
  // Optional purpose copy.
  purpose?: string;
};

export type AccessibilityItem = {
  label: string;     // "Keyboard shortcuts"
  detail: string;    // "Single-key cam switching · take/preview pattern."
};

export type Highlights = {
  // Optional section heading override — defaults to "What's included".
  title?: string;
  // Benefit-led bullets — "what you actually get" for this feature.
  items: string[];
};

export type AppStoreLayoutProps = {
  back: {
    href: string;
    label: string;
  };
  hero: {
    Icon: LucideIcon;
    eyebrow: string;
    title: string;
    tagline: string;
    statusPill?: { label: string; tone: 'accent' | 'muted' | 'success' };
    cta: ReactNode;
    secondary?: ReactNode;
  };
  // Optional across the board so a lighter catalog-driven feature page can pass
  // only what it has — every section below renders only when given content.
  // The Panood pilot passes them all; generic add-on detail pages pass a subset.
  stats?: StatTile[];
  justLaunchedChip?: string | null;
  preview?: PreviewItem[];
  /** Auto-playing on-card demo. When present, plays instead of the glyph rail. */
  demo?: DemoFrame[];
  /** Feature slug — enables high-fidelity native demo scenes when registered. */
  demoSlug?: string;
  samples?: SampleItem[];
  // Optional "What's included" bullet list, rendered right under About.
  highlights?: Highlights;
  description: {
    paragraphs: string[];
    plans?: PlanRow[];
    notIncluded?: string[];
  };
  reviews?: {
    href: string;
    avgRating: number | null;
    reviewCount: number;
    distribution?: ReadonlyArray<{ stars: 1 | 2 | 3 | 4 | 5; count: number }>;
  };
  privacy?: PrivacyCategory[];
  dataLinked?: { linked: string[]; notLinked: string[] };
  accessibility?: AccessibilityItem[];
};

export function AppStoreLayout({
  back,
  hero,
  stats,
  justLaunchedChip,
  preview,
  demo,
  demoSlug,
  samples,
  highlights,
  description,
  reviews,
  privacy,
  dataLinked,
  accessibility,
}: AppStoreLayoutProps) {
  const { Icon } = hero;
  return (
    <section className="space-y-8">
      <Link
        href={back.href}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        {back.label}
      </Link>

      {/* Hero */}
      <header className="space-y-4">
        <div className="flex items-start gap-4 sm:gap-5">
          <span
            aria-hidden
            className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-terracotta/10 text-terracotta sm:h-20 sm:w-20"
          >
            <Icon className="h-8 w-8 sm:h-10 sm:w-10" strokeWidth={1.5} />
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-terracotta">
              {hero.eyebrow}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {hero.title}
            </h1>
            <p className="max-w-prose text-sm text-ink/65 sm:text-base">
              {hero.tagline}
            </p>
            {hero.statusPill ? (
              <span
                className={
                  hero.statusPill.tone === 'accent'
                    ? 'inline-flex items-center rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta'
                    : hero.statusPill.tone === 'success'
                      ? 'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-900'
                      : 'inline-flex items-center rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55'
                }
              >
                {hero.statusPill.label}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hero.cta}
          {hero.secondary}
        </div>
      </header>

      {/* Stat carousel — App Store row */}
      {stats && stats.length > 0 ? (
        <StatCarousel stats={stats} justLaunchedChip={justLaunchedChip ?? null} />
      ) : null}

      {/* Preview — the auto-playing demo (what it does + how to operate it)
          when present, otherwise the static glyph rail. */}
      {(demo && demo.length > 0) || (demoSlug && RICH_DEMO_SLUGS.includes(demoSlug)) ? (
        <Section title="Preview" id="preview">
          <StudioCardDemo frames={demo ?? []} slug={demoSlug} />
        </Section>
      ) : preview && preview.length > 0 ? (
        <Section title="Preview" id="preview">
          <HorizontalRail>
            {preview.map((item, i) => (
              <PreviewCard key={i} item={item} />
            ))}
          </HorizontalRail>
        </Section>
      ) : null}

      {/* Sample outputs — what the customer actually receives */}
      {samples && samples.length > 0 ? (
        <Section
          title="Sample outputs"
          id="samples"
          subtitle="What customers walk away with after using this feature."
        >
          <HorizontalRail>
            {samples.map((s, i) => (
              <SampleCard key={i} sample={s} />
            ))}
          </HorizontalRail>
        </Section>
      ) : null}

      {/* Service Description */}
      <Section title="About this feature" id="about">
        <div className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
          {description.paragraphs.map((p, i) => (
            <p key={i} className="text-sm text-ink/75 sm:text-base">
              {p}
            </p>
          ))}
        </div>

        {description.plans && description.plans.length > 0 ? (
          <div className="space-y-2 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
              Plans &amp; pricing
            </p>
            <h3 className="text-lg font-semibold tracking-tight">Buy what you need</h3>
            <ul className="divide-y divide-ink/10">
              {description.plans.map((plan) => (
                <li
                  key={plan.name}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="flex items-center gap-2 text-sm font-medium text-ink">
                      {plan.name}
                      {plan.badge ? (
                        <span className="rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta">
                          {plan.badge}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-ink/60">{plan.scope}</p>
                  </div>
                  <p className="font-mono text-sm text-ink/85">
                    {plan.price}
                    <span className="text-xs text-ink/55">{plan.unit}</span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {description.notIncluded && description.notIncluded.length > 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/15 bg-cream/60 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
              Not included
            </p>
            <ul className="mt-2 space-y-1 text-xs text-ink/65">
              {description.notIncluded.map((item, i) => (
                <li key={i}>· {item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>

      {/* What's included — benefit-led bullets */}
      {highlights && highlights.items.length > 0 ? (
        <Section title={highlights.title ?? "What's included"} id="included">
          <ul className="grid gap-2.5 rounded-2xl border border-ink/10 bg-cream p-5 sm:grid-cols-2 sm:p-6">
            {highlights.items.map((item, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-ink/75">
                <Check
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-600"
                  strokeWidth={2.25}
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* Ratings & Reviews ▸ */}
      {reviews ? (
        <Link
          href={reviews.href}
          className="group block rounded-2xl border border-ink/10 bg-cream p-5 transition-colors hover:border-terracotta/40 hover:bg-terracotta/5 sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
                Ratings &amp; Reviews
              </p>
              <h3 className="text-lg font-semibold tracking-tight">
                {reviews.avgRating === null
                  ? 'No reviews yet'
                  : `${reviews.avgRating.toFixed(1)} out of 5`}
              </h3>
              <p className="text-xs text-ink/60">
                {reviews.reviewCount === 0
                  ? 'Be the first to write a review after your event.'
                  : `${reviews.reviewCount} review${reviews.reviewCount === 1 ? '' : 's'} from couples who used it`}
              </p>
            </div>
            {reviews.avgRating !== null ? (
              <span className="flex items-center gap-0.5 text-amber-500">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    aria-hidden
                    className={
                      s <= Math.round(reviews.avgRating ?? 0)
                        ? 'h-4 w-4 fill-current'
                        : 'h-4 w-4 stroke-current opacity-30'
                    }
                    strokeWidth={1.5}
                  />
                ))}
              </span>
            ) : null}
            <ChevronRight
              aria-hidden
              className="h-4 w-4 text-ink/40 transition-transform group-hover:translate-x-0.5"
              strokeWidth={2}
            />
          </div>
        </Link>
      ) : null}

      {/* Event Privacy */}
      {privacy && privacy.length > 0 ? (
      <Section
        title="Event Privacy"
        id="privacy"
        subtitle="What this feature accesses on your event, and why."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {privacy.map((c) => (
            <article
              key={c.category}
              className="space-y-2 rounded-xl border border-ink/10 bg-cream p-4"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                {c.category}
              </p>
              <ul className="space-y-1 text-sm text-ink/75">
                {c.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden className="text-ink/40">
                      ·
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              {c.purpose ? <p className="text-xs text-ink/55">{c.purpose}</p> : null}
            </article>
          ))}
        </div>
      </Section>
      ) : null}

      {/* Data Linked to You */}
      {dataLinked && (dataLinked.linked.length > 0 || dataLinked.notLinked.length > 0) ? (
      <Section title="Data Linked to You" id="data-linked">
        <div className="grid gap-3 sm:grid-cols-2">
          <article className="space-y-2 rounded-xl border border-ink/10 bg-cream p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
              Linked to your event
            </p>
            <ul className="space-y-1 text-sm text-ink/75">
              {dataLinked.linked.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden className="text-terracotta/70">
                    ●
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </article>
          <article className="space-y-2 rounded-xl border border-ink/10 bg-cream p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
              Not linked to your event
            </p>
            <ul className="space-y-1 text-sm text-ink/75">
              {dataLinked.notLinked.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden className="text-emerald-600/70">
                    ○
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </Section>
      ) : null}

      {/* Accessibility */}
      {accessibility && accessibility.length > 0 ? (
      <Section title="Accessibility" id="accessibility">
        <ul className="divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-cream">
          {accessibility.map((a) => (
            <li key={a.label} className="flex flex-col gap-0.5 px-5 py-3 sm:flex-row sm:gap-4">
              <p className="text-sm font-medium text-ink sm:w-56">{a.label}</p>
              <p className="text-sm text-ink/65">{a.detail}</p>
            </li>
          ))}
        </ul>
      </Section>
      ) : null}
    </section>
  );
}

function Section({
  title,
  subtitle,
  id,
  children,
}: {
  title: string;
  subtitle?: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`section-${id}`} className="space-y-3">
      <div className="space-y-0.5">
        <h2 id={`section-${id}`} className="text-xl font-semibold tracking-tight">
          {title}
        </h2>
        {subtitle ? <p className="max-w-prose text-sm text-ink/60">{subtitle}</p> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function HorizontalRail({ children }: { children: ReactNode }) {
  // Snap-scroll on mobile (matches App Store gesture), spacious row on
  // desktop. The negative-margin trick lets the rail bleed to the page
  // padding edge so the last card hints there's more to scroll.
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex snap-x snap-mandatory gap-3 pb-2">{children}</ul>
    </div>
  );
}

function StatCarousel({
  stats,
  justLaunchedChip,
}: {
  stats: StatTile[];
  justLaunchedChip: string | null;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
      <ul className="flex snap-x snap-mandatory gap-3 pb-1 sm:grid sm:snap-none sm:grid-cols-4">
        {stats.map((s, i) => (
          <li
            key={i}
            className="flex min-w-[8.5rem] shrink-0 snap-start flex-col rounded-2xl border border-ink/10 bg-cream px-4 py-3 sm:min-w-0"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
              {s.eyebrow}
            </p>
            <div className="mt-0.5 flex items-baseline gap-1">
              <p className="text-xl font-semibold tracking-tight text-ink">{s.value}</p>
              {typeof s.starFill === 'number' ? (
                <span className="flex items-center text-amber-500">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      aria-hidden
                      className={
                        star <= Math.round(s.starFill ?? 0)
                          ? 'h-3 w-3 fill-current'
                          : 'h-3 w-3 stroke-current opacity-30'
                      }
                      strokeWidth={1.5}
                    />
                  ))}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-ink/55">{s.caption}</p>
          </li>
        ))}
      </ul>
      {justLaunchedChip ? (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-terracotta/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
          ★ {justLaunchedChip}
        </p>
      ) : null}
    </div>
  );
}

function PreviewCard({ item }: { item: PreviewItem }) {
  const aspectClass =
    item.aspect === '9/16'
      ? 'aspect-[9/16] w-44'
      : item.aspect === '1/1'
        ? 'aspect-square w-60'
        : 'aspect-[16/10] w-72 sm:w-80';
  return (
    <li className="snap-start shrink-0 space-y-2">
      <div
        className={`${aspectClass} overflow-hidden rounded-2xl border border-ink/10 bg-gradient-to-br from-cream via-cream to-terracotta/10`}
      >
        <div className="flex h-full w-full items-center justify-center p-4 text-center text-xs text-ink/60">
          {item.body}
        </div>
      </div>
      <div className="space-y-0.5 px-1">
        {item.context ? (
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
            {item.context}
          </p>
        ) : null}
        <p className="text-xs text-ink/75">{item.caption}</p>
      </div>
    </li>
  );
}

function SampleCard({ sample }: { sample: SampleItem }) {
  const inner = (
    <div className="space-y-2">
      <div className="flex aspect-video w-72 items-center justify-center overflow-hidden rounded-2xl border border-ink/10 bg-gradient-to-br from-ink/5 via-cream to-terracotta/10 p-4 text-center text-xs text-ink/65 sm:w-80">
        {sample.body ?? (
          <span>
            <span aria-hidden className="block text-2xl">
              ▶
            </span>
            <span className="mt-1 block text-[11px] text-ink/55">Sample output</span>
          </span>
        )}
      </div>
      <div className="space-y-0.5 px-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-ink">{sample.title}</p>
          {sample.badge ? (
            <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
              {sample.badge}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-ink/60">{sample.caption}</p>
      </div>
    </div>
  );
  return (
    <li className="snap-start shrink-0">
      {sample.href ? (
        <Link href={sample.href} target="_blank" rel="noreferrer" className="block">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </li>
  );
}
