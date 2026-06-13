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

// /tl/about — Tagalog edition of the brand/entity page (iteration 0046-adjacent
// localization, first slice). SEO/GEO: locale-subpath URL (/tl/...) + reciprocal
// hreflang (en-PH ↔ tl-PH, x-default → en) so Google + AI engines serve the
// Tagalog page for Tagalog "ano ang Setnayan" queries. Fully static, no DB.
//
// First slice of the Cebuano-moat localization (SEO playbook §0.14): proves the
// subpath + hreflang + locale-switch pattern. /ceb/about and more pages follow
// the same shape; a shared per-locale content dictionary is the scale-up step.
export const dynamic = 'force-static';
export const revalidate = 3600;

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');

const PAGE_TITLE = 'Tungkol sa Setnayan — ang Philippines-first na wedding platform';
const PAGE_DESCRIPTION =
  'Ang Setnayan ang sariling all-in-one wedding at life-events platform ng Pilipinas — ang una ditong ginawa para planuhin ang kasal, magpatakbo ng 0%-commission na marketplace ng verified na local vendors, at i-capture ang araw para may sariling highlight reel ang bawat bisita.';

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
      'Dinisenyo at pinapatakbo para sa mga Pinoy na kasal — mula Metro Manila at Cavite hanggang Cebu, Davao, Tagaytay, at saanman may Pilipinong vendor.',
  },
  {
    icon: Heart,
    label: 'Libre ang simula',
    value:
      'Libre sa bawat account ang guest list, seating, budget, schedule, mood board, vendor browse, at in-app chat. Babayaran lang ninyo ang mga premium na tool na pipiliin ninyong idagdag.',
  },
  {
    icon: ShieldCheck,
    label: '0% commission, habambuhay',
    value:
      'Hindi kailanman kumukuha ang Setnayan ng porsyento sa binabayad ninyo sa vendor. Direktang nag-uusap ang mag-asawa at vendor; galing ang kita sa software services at vendor subscriptions.',
  },
  {
    icon: Languages,
    label: 'Sa wika ninyo',
    value:
      'English-primary, na may Tagalog at Cebuano na inilalabas — pagpaplano ng kasal sa paraang totoong pinag-uusapan ng mga Pinoy.',
  },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Ano ang Setnayan?',
    a: 'Ang Setnayan (SET-na-yan, mula sa Tagalog na “Set na ’yan.”) ang Philippines-first na wedding at life-events software platform. Gawa at pinapatakbo sa Pilipinas para sa mga Pinoy na kasal. Libre ang simula ng mga mag-asawa sa planning workspace; nagla-list ang mga verified na Pilipinong vendor nang walang commission sa booking.',
  },
  {
    q: 'Libre ba ang Setnayan para sa mga mag-asawa?',
    a: 'Libre ang simula — schedule, budget, guest list, seat plan, at mood board ay kasama sa bawat account, plus ang marketplace browse at preview ng inyong vendor matches. Bayad ang premium na tools tulad ng Setnayan AI, Event Website, at premium RSVP. Babayaran lang ninyo ang pipiliin ninyong idagdag.',
  },
  {
    q: 'May commission ba ang Setnayan sa booking ng vendor?',
    a: 'Wala. 0% commission sa bawat booking, sa bawat tier. Hindi kailanman hinahawakan ng Setnayan ang pera sa pagitan ng mag-asawa at vendor — galing ang kita sa software services at vendor subscriptions.',
  },
  {
    q: 'Sumusuporta ba ang Setnayan sa mga tradisyong Pinoy sa kasal?',
    a: 'Oo. Sumusuporta sa pitong uri ng seremonya (Catholic, Civil, INC, Christian, Muslim, Cultural, Mixed) at sa buong Pinoy na entourage — principal sponsors, ninong, ninang, candle/veil/cord sponsors, at mga bearer.',
  },
  {
    q: 'Saan gumagana ang Setnayan?',
    a: 'Sa Pilipinas — Metro Manila, Cebu, Davao, Tagaytay, Iloilo, Baguio, Pampanga, Cavite, Batangas, Laguna, Bulacan, at saanman may Pilipinong wedding vendor na nagse-serve.',
  },
];

export default function AboutPageTagalog() {
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

      <SiteHeader />

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
            {/* Locale switch */}
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
            Set na &rsquo;yan. Ang inyong kasal, ayos na — sa isang Filipino platform.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink/75">
            Ang Setnayan (<span className="font-medium">SET-na-yan</span>, mula sa
            Tagalog na <em>&ldquo;Set na &rsquo;yan.&rdquo;</em>) ang sariling
            all-in-one wedding at life-events platform ng Pilipinas — at ang una
            ditong ginawa para gawin ang buong selebrasyon sa isang lugar:
            planuhin ang event, kumuha mula sa 0%-commission na marketplace ng
            verified na local vendors, at i-capture ang araw para may sariling
            highlight reel na maiuuwi ang bawat bisita.
          </p>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink/75">
            Hindi ito dayuhang directory na may Pilipinong filter — software na
            ginawa at pinapatakbo dito mismo sa Pilipinas, para sa paraan ng
            pagpaplano ng mga Pinoy: libreng planning workspace, verified na local
            vendors, malinaw na presyo sa piso, at walang commission sa binabayad
            ninyo sa inyong mga supplier.
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
              Software, hindi ahensiya
            </h2>
            <p className="text-base leading-relaxed text-ink/75">
              Hindi wedding coordinator ang Setnayan at hindi kumukuha ng kabahagi
              sa bayad ninyo sa suppliers. Toolkit ito: workspace para sa guest
              list, seating, budget, at schedule; libreng mood board; marketplace
              ng mga verified na Pilipinong wedding vendor na direktang ka-message
              ninyo; at mga opsyonal na in-app service — live streaming (Panood),
              candid photo capture (Papic), custom na kanta para sa kasal
              (Pakanta), at bespoke monograms — bawat isa&rsquo;y malinaw ang
              presyo sa piso. Ang mag-asawa at vendor ang nagkakasundo sa booking;
              hindi hinahawakan ng Setnayan ang pera.
            </p>
            <p className="text-base leading-relaxed text-ink/75">
              Kasal ang unang surface, pero gawa ang platform para sa mas malawak
              na Filipino life-events — birthdays, debut, binyag, at iba pa habang
              lumalabas ang mga susunod na bahagi.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/how-it-works" className="button-primary h-11 px-5 text-sm">
                Paano ito gumagana
              </Link>
              <Link
                href="/pricing"
                className="inline-flex h-11 items-center justify-center rounded-sm border border-ink/20 px-5 text-sm font-medium tracking-wide text-ink transition-colors hover:bg-ink/5"
              >
                Tingnan ang presyo
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
            Para sa kumpletong presyo, tingnan ang{' '}
            <Link href="/pricing" className="font-medium text-terracotta underline-offset-4 hover:underline">
              pricing page
            </Link>
            . Available pa sa English ang buong{' '}
            <Link href="/help" className="font-medium text-terracotta underline-offset-4 hover:underline">
              help center
            </Link>
            .
          </p>
        </section>

        <section className="mx-auto w-full max-w-4xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-ink/10 bg-white p-6 sm:p-10">
            <h2 className="font-display text-2xl text-ink sm:text-3xl">
              Magsimula — libre.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/70">
              Gawin ang inyong guest list, i-sketch ang seating at budget, at
              mag-browse ng verified na Pilipinong wedding vendor na 0% booking
              commission. Walang card na kailangan para magsimula.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/signup" className="button-primary h-11 px-6 text-sm">
                Gumawa ng account
                <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" strokeWidth={2} />
              </Link>
              <Link
                href="/vendors"
                className="inline-flex h-11 items-center justify-center rounded-sm border border-ink/20 px-6 text-sm font-medium tracking-wide text-ink transition-colors hover:bg-ink/5"
              >
                Mag-browse ng vendors
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
