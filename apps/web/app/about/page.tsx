import Link from 'next/link';
import {
  Heart,
  MapPin,
  Languages,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { HELP_TOPICS } from '@/lib/help';
// Client motion island (the page itself stays a force-static Server Component).
// Renders the hero so the serif line-reveal ref sits on the real <h1>, and
// provides container wrappers that attach the shared quiet reveal to
// server-passed children. Additive-only: no copy / IA / CTA changes.
import {
  AboutHero,
  RevealGrid,
  RevealSection,
} from './_about-motion';

// /about — the canonical brand/entity page. Fully static: brand facts, no DB,
// no session. This is the surface SEO + GEO engines (ChatGPT-User, Perplexity,
// Claude, Gemini AI Overviews) cite when grounding "what is Setnayan". Ships
// AboutPage + Organization + BreadcrumbList + FAQPage JSON-LD; the FAQ reuses
// the already-approved about-setnayan help copy (single source of truth in
// lib/help.ts).
export const dynamic = 'force-static';
export const revalidate = 3600;

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');

const PAGE_TITLE = 'About Setnayan — the Philippines-first wedding platform';
// (Description carries no free-claims — clean under the 2026-06-13 reprice
// scrub of Pricing.md § 00.D, which retired "free RSVP / free website" copy.)
const PAGE_DESCRIPTION =
  "Setnayan is the Philippines' own all-in-one wedding & life-events platform — the first built here to plan the event, run a 0%-commission marketplace of verified local vendors, and capture the day so every guest goes home with a personal highlight reel.";

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: `${SITE_URL}/about`,
    languages: {
      'en-PH': `${SITE_URL}/about`,
      'tl-PH': `${SITE_URL}/tl/about`,
      'x-default': `${SITE_URL}/about`,
    },
  },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/about`,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    siteName: 'Setnayan',
    locale: 'en_PH',
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

// The about-setnayan help topic is the single source of brand/entity Q&A copy.
// `how-much-does-setnayan-cost` is deliberately excluded from this entity page
// (it carries a detailed price breakdown that drifts between catalog states —
// pricing lives on /pricing, the source of truth). Every other about-topic
// answer is a stable brand/feature/policy fact.
const PRICING_DETAIL_SLUG = 'how-much-does-setnayan-cost';

const ABOUT_FAQ = (HELP_TOPICS.find((t) => t.key === 'about-setnayan')?.articles ?? [])
  .filter((a) => a.slug !== PRICING_DETAIL_SLUG);

const FACTS: Array<{ icon: typeof Heart; label: string; value: string }> = [
  {
    icon: MapPin,
    label: 'Built in the Philippines',
    value:
      'Designed and operated for Filipino weddings — from Metro Manila and Cavite to Cebu, Davao, Tagaytay, and anywhere Filipino vendors serve.',
  },
  {
    icon: Heart,
    label: 'Free to start',
    value:
      'Guest list, seating, budget, schedule, the mood board, vendor browse, and in-app chat are free with every account. You only pay for premium tools you choose to add.',
  },
  {
    icon: ShieldCheck,
    label: '0% commission, ever',
    value:
      'Setnayan never takes a cut of what couples pay vendors. Couples and vendors transact directly; revenue comes from software services and vendor subscriptions.',
  },
  {
    icon: Languages,
    label: 'In your language',
    value:
      'English-primary, with Taglish — wedding planning the way Filipino couples actually talk about their day.',
  },
];

export default function AboutPage() {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'About',
        item: `${SITE_URL}/about`,
      },
    ],
  };

  const aboutPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': `${SITE_URL}/about#webpage`,
    url: `${SITE_URL}/about`,
    name: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    inLanguage: 'en-PH',
    isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}/#website` },
    about: { '@type': 'Organization', '@id': `${SITE_URL}/#organization` },
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: ABOUT_FAQ.map((a) => ({
      '@type': 'Question',
      name: a.title,
      acceptedAnswer: { '@type': 'Answer', text: a.body },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />


      <main className="min-h-dvh bg-cream">
        {/* Hero — rendered by the client island so the serif line-reveal ref
            sits on the real <h1>; eyebrow / breadcrumb / leads rise after as one
            quiet beat. Text ships in the SSR HTML (client components still SSR). */}
        <AboutHero />

        {/* Fact grid — one whole-group reveal with a short stagger across the 4
            cards (each marked data-reveal-item). CSS hover-lift survives via the
            hook's clearProps:transform. Fact-card icons demoted gold→ink/55. */}
        <section className="mx-auto w-full max-w-4xl px-4 pb-12 sm:px-6 lg:px-8">
          <RevealGrid>
            {FACTS.map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                data-reveal-item
                className="rounded-xl border border-ink/10 bg-white p-5"
              >
                <div className="mb-2 inline-flex items-center gap-2 text-ink/55">
                  <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  <span className="text-sm font-semibold text-ink">{label}</span>
                </div>
                <p className="text-sm leading-relaxed text-ink/70">{value}</p>
              </div>
            ))}
          </RevealGrid>
        </section>

        {/* What Setnayan is — single whole-section reveal (no inner stagger). */}
        <section className="mx-auto w-full max-w-4xl px-4 pb-12 sm:px-6 lg:px-8">
          <RevealSection className="max-w-3xl space-y-4">
            <h2 className="font-display text-2xl text-ink sm:text-3xl">
              Software, not an agency
            </h2>
            <p className="text-base leading-relaxed text-ink/75">
              Setnayan isn&rsquo;t a wedding coordinator and doesn&rsquo;t take a
              cut of your supplier bills. It&rsquo;s the toolkit: a guest list,
              seating, budget, and schedule workspace, a free mood board, a
              marketplace of
              verified Filipino wedding vendors you message directly, and
              in-app services — free single-camera livestreaming to your own
              YouTube (Panood), candid photo capture (Papic), a custom wedding
              song (Pakanta), and bespoke monograms. Every service is free to
              use; some have clearly priced upgrades, like Panood&rsquo;s
              multicam control room. Couples and vendors
              agree on bookings between themselves; Setnayan never holds the
              money.
            </p>
            <p className="text-base leading-relaxed text-ink/75">
              The first surface is weddings, but the platform is built for the
              wider Filipino life-events market — birthdays, debuts,
              christenings, and more unlock as those iterations ship.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/how-it-works" className="button-primary h-11 px-5 text-sm">
                How it works
              </Link>
              <Link
                href="/pricing"
                className="inline-flex h-11 items-center justify-center rounded-sm border border-ink/20 px-5 text-sm font-medium tracking-wide text-ink transition-colors hover:bg-ink/5"
              >
                See transparent pricing
              </Link>
            </div>
          </RevealSection>
        </section>

        {/* FAQ — reuses approved about-setnayan help copy; each links to the
            full help center. Doubles as GEO grounding (verbatim Q&A pairs).
            ONE whole-section fade (no per-row stagger — scannable reference). */}
        <section className="mx-auto w-full max-w-4xl px-4 pb-16 sm:px-6 lg:px-8">
          <RevealSection>
          <h2 className="font-display text-2xl text-ink sm:text-3xl">
            Frequently asked
          </h2>
          <dl className="mt-6 divide-y divide-ink/10 border-y border-ink/10">
            {ABOUT_FAQ.map((a) => (
              <div key={a.slug} className="py-5">
                <dt className="text-base font-semibold text-ink">
                  <Link
                    href={`/help#${a.slug}`}
                    className="underline-offset-4 hover:text-terracotta hover:underline"
                  >
                    {a.title}
                  </Link>
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-ink/70">
                  {a.body}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-sm text-ink/60">
            For full pricing see{' '}
            <Link
              href="/pricing"
              className="font-medium text-terracotta underline-offset-4 hover:underline"
            >
              the pricing page
            </Link>
            , or browse{' '}
            <Link
              href="/help"
              className="font-medium text-terracotta underline-offset-4 hover:underline"
            >
              the full help center
            </Link>
            .
          </p>
          </RevealSection>
        </section>

        {/* Closing CTA — single reveal on scroll-in; buttons untouched. */}
        <section className="mx-auto w-full max-w-4xl px-4 pb-20 sm:px-6 lg:px-8">
          <RevealSection className="rounded-2xl border border-ink/10 bg-white p-6 sm:p-10">
            <h2 className="font-display text-2xl text-ink sm:text-3xl">
              Start planning — free.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/70">
              Build your guest list, sketch your seating and budget, and browse
              verified Filipino wedding vendors with 0% booking commission. No
              card required to begin.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/signup" className="button-primary h-11 px-6 text-sm">
                Create your account
                <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" strokeWidth={2} />
              </Link>
              <Link
                href="/explore"
                className="inline-flex h-11 items-center justify-center rounded-sm border border-ink/20 px-6 text-sm font-medium tracking-wide text-ink transition-colors hover:bg-ink/5"
              >
                Browse vendors
              </Link>
            </div>
          </RevealSection>
        </section>
      </main>

    </>
  );
}
