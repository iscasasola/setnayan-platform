import Link from 'next/link';
import {
  Heart,
  MapPin,
  Languages,
  ShieldCheck,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Footer } from '@/app/_components/marketing/_sections';

// /tl/about — Taglish edition of the brand/entity page (localization first
// slice). The two public locales are ENGLISH (root) and TAGLISH (the real
// conversational register Filipino couples use — English + Tagalog mixed), per
// owner direction. "Taglish" has no ISO/hreflang code, so the URL + hreflang use
// `tl` (Tagalog family) — the closest standard — while the copy and the locale
// switcher say "Taglish". Fully static, no DB.
//
// SEO/GEO: locale-subpath URL (/tl/...) + reciprocal hreflang (en-PH ↔ tl-PH,
// x-default → en). First slice of the marketing-site localization; more pages
// follow the same shape.
export const dynamic = 'force-static';
export const revalidate = 3600;

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');

const PAGE_TITLE = 'Tungkol sa Setnayan — ang Philippines-first wedding platform';
const PAGE_DESCRIPTION =
  'Ang Setnayan ang all-in-one wedding at life-events platform ng Pilipinas — ang una ditong gawa para i-plan ang kasal, mag-run ng 0%-commission marketplace ng verified local vendors, at i-capture ang araw para may sariling highlight reel ang bawat guest.';

// Reciprocal hreflang — both /about and /tl/about list the same alternates.
const LANGUAGES = {
  'en-PH': `${SITE_URL}/about`,
  'tl-PH': `${SITE_URL}/tl/about`,
  'x-default': `${SITE_URL}/about`,
};

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: `${SITE_URL}/tl/about`,
    languages: LANGUAGES,
  },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/tl/about`,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    siteName: 'Setnayan',
    locale: 'tl_PH',
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

const FACTS: Array<{ icon: typeof Heart; label: string; value: string }> = [
  {
    icon: MapPin,
    label: 'Gawa sa Pilipinas',
    value:
      'Designed at pinapatakbo para sa Pinoy weddings — from Metro Manila at Cavite hanggang Cebu, Davao, Tagaytay, at kahit saan may Pinoy vendor.',
  },
  {
    icon: Heart,
    label: 'Free ang simula',
    value:
      'Free sa bawat account ang guest list, seating, budget, schedule, mood board, vendor browse, at in-app chat. Babayaran mo lang ang premium tools na gusto mong i-add.',
  },
  {
    icon: ShieldCheck,
    label: '0% commission, forever',
    value:
      'Hindi kailanman kumukuha ang Setnayan ng cut sa binabayad mo sa vendor. Direkta kayong nag-uusap ng vendor; galing ang kita sa software services at vendor subscriptions.',
  },
  {
    icon: Languages,
    label: 'Sa wika mo',
    value:
      'English-primary, with Taglish — wedding planning na kung paano talaga mag-usap ang mga Pinoy tungkol sa big day nila.',
  },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Ano ang Setnayan?',
    a: 'Ang Setnayan (SET-na-yan, galing sa “Set na ’yan.”) ang Philippines-first na wedding at life-events software platform. Gawa at pinapatakbo sa Pilipinas para sa Pinoy weddings. Free ang simula ng couples sa planning workspace; nagla-list ang verified Pinoy vendors nang walang booking commission.',
  },
  {
    q: 'Free ba ang Setnayan para sa couples?',
    a: 'Free ang simula — schedule, budget, guest list, seat plan, at mood board, kasama na ang marketplace browse at preview ng vendor matches mo. Bayad ang premium tools tulad ng Setnayan AI, Event Website, at premium RSVP. Babayaran mo lang ang gusto mong i-add.',
  },
  {
    q: 'May commission ba ang Setnayan sa vendor bookings?',
    a: 'Wala. 0% commission sa bawat booking, sa bawat tier. Hindi kailanman hinahawakan ng Setnayan ang pera sa pagitan ng couple at vendor — galing ang kita sa software services at vendor subscriptions.',
  },
  {
    q: 'Supported ba ang mga Pinoy wedding traditions?',
    a: 'Oo. Supported ang pitong ceremony types (Catholic, Civil, INC, Christian, Muslim, Cultural, Mixed) at ang buong Pinoy entourage — principal sponsors, ninong, ninang, candle/veil/cord sponsors, at mga bearer.',
  },
  {
    q: 'Saan gumagana ang Setnayan?',
    a: 'Sa Pilipinas — Metro Manila, Cebu, Davao, Tagaytay, Iloilo, Baguio, Pampanga, Cavite, Batangas, Laguna, Bulacan, at kahit saan may Pinoy wedding vendor na nagse-serve.',
  },
];

export default function AboutPageTaglish() {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Tungkol', item: `${SITE_URL}/tl/about` },
    ],
  };
  const aboutPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': `${SITE_URL}/tl/about#webpage`,
    url: `${SITE_URL}/tl/about`,
    name: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    inLanguage: 'tl-PH',
    isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}/#website` },
    about: { '@type': 'Organization', '@id': `${SITE_URL}/#organization` },
  };
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: 'tl-PH',
    mainEntity: FAQ.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutPageJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />


      <main className="min-h-dvh bg-cream">
        <section className="mx-auto w-full max-w-4xl px-4 pb-12 pt-16 sm:px-6 sm:pt-20 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-8 flex items-center justify-between gap-4 text-sm text-ink/50">
            <span>
              <Link href="/" className="hover:text-ink hover:underline">
                Home
              </Link>
              <span className="mx-2">/</span>
              <span className="text-ink/80">Tungkol</span>
            </span>
            {/* Locale switch — English edition (hreflang reciprocal) */}
            <Link
              href="/about"
              hrefLang="en-PH"
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55 underline-offset-4 hover:text-ink hover:underline"
            >
              English
            </Link>
          </nav>

          <p className="mb-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Tungkol sa Setnayan
          </p>
          <h1 className="max-w-3xl font-display text-4xl leading-tight text-ink sm:text-5xl">
            Set na &rsquo;yan. Your whole wedding, all set — sa isang Filipino platform.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink/75">
            Ang Setnayan (<span className="font-medium">SET-na-yan</span>, galing sa
            Tagalog na <em>&ldquo;Set na &rsquo;yan.&rdquo;</em>) ang all-in-one
            wedding at life-events platform ng Pilipinas — at ang una ditong gawa
            para gawin ang buong celebration sa isang place: i-plan ang event,
            mag-hire from a 0%-commission marketplace ng verified local vendors, at
            i-capture ang araw para may sariling highlight reel ang bawat guest.
          </p>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink/75">
            Hindi &rsquo;to foreign directory na may Philippine filter — software
            na gawa at pinapatakbo dito mismo sa Pilipinas, para sa paraan ng
            pag-plan ng mga Pinoy: free planning workspace, verified local vendors,
            transparent peso pricing, at zero commission sa binabayad mo sa
            suppliers mo.
          </p>
        </section>

        <section className="mx-auto w-full max-w-4xl px-4 pb-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FACTS.map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-xl border border-ink/10 bg-white p-5">
                <div className="mb-2 inline-flex items-center gap-2 text-terracotta">
                  <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  <span className="text-sm font-semibold text-ink">{label}</span>
                </div>
                <p className="text-sm leading-relaxed text-ink/70">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-4xl px-4 pb-12 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4">
            <h2 className="font-display text-2xl text-ink sm:text-3xl">
              Software, not an agency
            </h2>
            <p className="text-base leading-relaxed text-ink/75">
              Hindi wedding coordinator ang Setnayan, at hindi kumukuha ng cut sa
              supplier bills mo. Toolkit &rsquo;to: workspace para sa guest list,
              seating, budget, at schedule; free mood board; marketplace ng
              verified Pinoy wedding vendors na direkta mong ma-message; at optional
              in-app services — live streaming (Panood), candid photo capture
              (Papic), custom wedding song (Pakanta), at bespoke monograms — each
              clear ang presyo sa piso. Kayo ng vendor ang nag-uusap sa booking;
              hindi hinahawakan ng Setnayan ang pera.
            </p>
            <p className="text-base leading-relaxed text-ink/75">
              Weddings muna ang first surface, pero gawa ang platform para sa mas
              malawak na Filipino life-events — birthdays, debut, binyag, at iba pa
              habang lumalabas ang next iterations.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/how-it-works" className="button-primary h-11 px-5 text-sm">
                How it works
              </Link>
              <Link
                href="/pricing"
                className="inline-flex h-11 items-center justify-center rounded-sm border border-ink/20 px-5 text-sm font-medium tracking-wide text-ink transition-colors hover:bg-ink/5"
              >
                Tingnan ang pricing
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-4xl px-4 pb-16 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl text-ink sm:text-3xl">
            Mga madalas itanong
          </h2>
          <dl className="mt-6 divide-y divide-ink/10 border-y border-ink/10">
            {FAQ.map((f) => (
              <div key={f.q} className="py-5">
                <dt className="text-base font-semibold text-ink">{f.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-ink/70">{f.a}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-sm text-ink/60">
            Para sa complete pricing, tingnan ang{' '}
            <Link href="/pricing" className="font-medium text-terracotta underline-offset-4 hover:underline">
              pricing page
            </Link>
            . Nasa English pa ang buong{' '}
            <Link href="/help" className="font-medium text-terracotta underline-offset-4 hover:underline">
              help center
            </Link>
            .
          </p>
        </section>

        <section className="mx-auto w-full max-w-4xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-ink/10 bg-white p-6 sm:p-10">
            <h2 className="font-display text-2xl text-ink sm:text-3xl">
              Start planning — free.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/70">
              Gawin ang guest list mo, i-sketch ang seating at budget, at mag-browse
              ng verified Pinoy wedding vendors na 0% booking commission. No card
              needed para magsimula.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/signup" className="button-primary h-11 px-6 text-sm">
                Gumawa ng account
                <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" strokeWidth={2} />
              </Link>
              <Link
                href="/explore"
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
