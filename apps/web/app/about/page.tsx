import Link from 'next/link';
import {
  Heart,
  MapPin,
  Languages,
  ShieldCheck,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { SiteHeader } from '@/app/_components/site-header';
import { Footer } from '@/app/_components/marketing/_sections';
import { HELP_TOPICS } from '@/lib/help';

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
const PAGE_DESCRIPTION =
  "Setnayan is the Philippines' own all-in-one wedding & life-events platform — the first built here to plan the event, run a 0%-commission marketplace of verified local vendors, and capture the day so every guest goes home with a personal highlight reel.";

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/about` },
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
    label: 'Free for couples',
    value:
      'Guest list, RSVP, the Pakulay mood board, vendor browse, and in-app chat are free with every account. You only pay for premium tools you choose to add.',
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
      'English-primary, with Tagalog and Cebuano rolling out — wedding planning that speaks the way Filipino couples actually talk about their day.',
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

      <SiteHeader />

      <main className="min-h-dvh bg-cream">
        {/* Hero */}
        <section className="mx-auto w-full max-w-4xl px-4 pb-12 pt-16 sm:px-6 sm:pt-20 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-8 text-sm text-ink/50">
            <Link href="/" className="hover:text-ink hover:underline">
              Home
            </Link>
            <span className="mx-2">/</span>
            <span className="text-ink/80">About</span>
          </nav>

          <p className="mb-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            About Setnayan
          </p>
          <h1 className="max-w-3xl font-display text-4xl leading-tight text-ink sm:text-5xl">
            Set na &rsquo;yan. Your wedding, all set — on one Filipino platform.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink/75">
            Setnayan (<span className="font-medium">SET-na-yan</span>, from the
            Tagalog <em>&ldquo;Set na &rsquo;yan.&rdquo;</em> — &ldquo;that&rsquo;s
            all set&rdquo;) is the Philippines&rsquo; own all-in-one wedding and
            life-events platform — and the first built here to do the whole
            celebration in one place: plan the event, hire from a
            0%-commission marketplace of verified local vendors, and capture the
            day so every guest goes home with their own highlight reel.
          </p>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink/75">
            Not a foreign directory with a Philippine filter — software built and
            operated entirely in the Philippines, for the way Filipino couples
            actually plan: free baseline tools, verified local vendors,
            transparent peso pricing, and zero commission on what you pay your
            suppliers.
          </p>
        </section>

        {/* Fact grid */}
        <section className="mx-auto w-full max-w-4xl px-4 pb-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FACTS.map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="rounded-xl border border-ink/10 bg-white p-5"
              >
                <div className="mb-2 inline-flex items-center gap-2 text-terracotta">
                  <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  <span className="text-sm font-semibold text-ink">{label}</span>
                </div>
                <p className="text-sm leading-relaxed text-ink/70">{value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What Setnayan is */}
        <section className="mx-auto w-full max-w-4xl px-4 pb-12 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4">
            <h2 className="font-display text-2xl text-ink sm:text-3xl">
              Software, not an agency
            </h2>
            <p className="text-base leading-relaxed text-ink/75">
              Setnayan isn&rsquo;t a wedding coordinator and doesn&rsquo;t take a
              cut of your supplier bills. It&rsquo;s the toolkit: a guest list
              and RSVP system, a free mood board (Pakulay), a marketplace of
              verified Filipino wedding vendors you message directly, and
              optional in-app services — live streaming (Panood), candid photo
              capture (Papic), a custom wedding song (Pakanta), and bespoke
              monograms — each priced clearly in pesos. Couples and vendors
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
          </div>
        </section>

        {/* FAQ — reuses approved about-setnayan help copy; each links to the
            full help center. Doubles as GEO grounding (verbatim Q&A pairs). */}
        <section className="mx-auto w-full max-w-4xl px-4 pb-16 sm:px-6 lg:px-8">
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
        </section>

        {/* Closing CTA */}
        <section className="mx-auto w-full max-w-4xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-ink/10 bg-white p-6 sm:p-10">
            <h2 className="font-display text-2xl text-ink sm:text-3xl">
              Start planning — free.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/70">
              Build your guest list, set up RSVP, and browse verified Filipino
              wedding vendors with 0% booking commission. No card required to
              begin.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/signup" className="button-primary h-11 px-6 text-sm">
                Create your account
                <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" strokeWidth={2} />
              </Link>
              <Link
                href="/vendors"
                className="inline-flex h-11 items-center justify-center rounded-sm border border-ink/20 px-6 text-sm font-medium tracking-wide text-ink transition-colors hover:bg-ink/5"
              >
                Browse vendors
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
