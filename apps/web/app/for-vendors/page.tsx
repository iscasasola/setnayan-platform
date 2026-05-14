import Link from 'next/link';
import {
  Users,
  Star,
  Shield,
  MapPin,
  Wallet,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';

// Vendor-acquisition SEO landing page per
// 17_SEO_and_AI_Discoverability_Playbook.md §11.1.
// Target keyword family: "list my wedding business Philippines",
// "free wedding vendor directory PH", "wedding photographer directory listing".
// Page is intentionally accessible even to signed-in users — vendors and
// couples both occasionally land here via SERP and shouldn't be redirected
// off to a dashboard before they see the value prop.

export const metadata = {
  title: 'Free Wedding Vendor Profile Philippines — Get Found by Couples',
  description:
    'List your wedding business free during launch on Setnayan. Verified profile, real reviews, in-platform messaging — reach Filipino couples planning their weddings across the Philippines.',
};

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(
  /\/$/,
  '',
);

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'What does it cost to list my business on Setnayan?',
    a: 'Free during launch. There is no listing fee, no per-lead fee, and no commission on bookings made through the platform. You only pay if you opt into a Setnayan service yourself (e.g. a Setnayan Pro upgrade for your own event).',
  },
  {
    q: 'Who verifies vendor profiles?',
    a: 'The Setnayan team reviews every vendor profile before it goes live. We confirm your business name, primary contact, and at least one verifiable trade reference (a past wedding, a venue partnership, or a published portfolio). Verified profiles get a Verified badge that couples can see on every listing.',
  },
  {
    q: 'What information appears on my public profile?',
    a: 'Your business name, services, coverage cities, package summaries, photos you upload, and reviews from couples you have worked with via Setnayan. Your private contact details (mobile, personal email) are never shown publicly — couples message you through Setnayan.',
  },
  {
    q: 'Can couples message me directly?',
    a: 'Yes — through Setnayan. Couples send inquiries from your public profile, and you reply from your vendor dashboard. Your personal phone and email stay private until you choose to share them in the conversation.',
  },
  {
    q: 'Is there a commission on bookings I get from Setnayan?',
    a: 'No. Vendors keep 100% of what they charge couples for services booked off-platform. Setnayan does not take a percentage of vendor revenue.',
  },
  {
    q: 'How do I update my profile after I sign up?',
    a: 'After your account is approved, you have a vendor dashboard where you can edit services, packages, photos, coverage cities, and team members at any time. Changes are live immediately.',
  },
  {
    q: 'I serve weddings outside Metro Manila — can I still list?',
    a: 'Yes. Setnayan covers the entire Philippines — Manila, Cebu, Davao, Tagaytay, Iloilo, Baguio, Pampanga, Cavite, Batangas, Laguna, Bulacan, Pasig, and any city you serve. You set your coverage cities in your profile.',
  },
];

const FOR_VENDORS_JSONLD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Setnayan',
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/icon-512.svg`,
      areaServed: { '@type': 'Country', name: 'Philippines' },
    },
    {
      '@type': 'Offer',
      '@id': `${SITE_URL}/for-vendors#offer`,
      name: 'Verified Wedding Vendor Profile (Free during launch)',
      description:
        'Free verified business profile on the Setnayan wedding vendor directory. Includes public profile page, in-platform messaging with couples, real review collection, and coverage-city visibility across the Philippines.',
      price: '0',
      priceCurrency: 'PHP',
      availability: 'https://schema.org/InStock',
      seller: { '@id': `${SITE_URL}/#organization` },
      url: `${SITE_URL}/signup?as=vendor`,
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${SITE_URL}/for-vendors#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: `${SITE_URL}/`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'For Vendors',
          item: `${SITE_URL}/for-vendors`,
        },
      ],
    },
    {
      '@type': 'FAQPage',
      '@id': `${SITE_URL}/for-vendors#faq`,
      mainEntity: FAQS.map((faq) => ({
        '@type': 'Question',
        name: faq.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.a,
        },
      })),
    },
  ],
};

export default function ForVendorsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FOR_VENDORS_JSONLD) }}
      />
      <main className="min-h-dvh">
        <TopNav />
        <Hero />
        <ValueProps />
        <HowItWorks />
        <FAQ />
        <ClosingCta />
        <SiteFooter />
      </main>
    </>
  );
}

function TopNav() {
  return (
    <header className="border-b border-ink/5">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-terracotta font-semibold text-cream"
          >
            S
          </span>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink/70">
            Setnayan · For Vendors
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline sm:inline"
          >
            Sign in
          </Link>
          <Link href="/signup?as=vendor" className="button-primary h-10 px-5 text-sm">
            List my services
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="border-b border-ink/5 bg-cream">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:px-8 lg:py-24">
        <div className="space-y-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            For Filipino wedding suppliers
          </p>
          <h1 className="font-sans text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            Get found by Filipino couples — free during launch.
          </h1>
          <p className="max-w-prose text-lg text-ink/70">
            Setnayan is the Philippines-first wedding planning platform.
            Couples plan their wedding here from start to finish — and they
            book photographers, caterers, planners, florists, and more from
            the verified vendor directory. Add your business to the directory
            in about two minutes.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              className="button-primary inline-flex items-center justify-between gap-3 px-5 py-3 text-sm"
              href="/signup?as=vendor"
            >
              <span className="flex flex-col items-start text-left">
                <span className="font-semibold">List my services</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] opacity-80">
                  Free during launch
                </span>
              </span>
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </Link>
            <Link
              className="button-secondary inline-flex items-center justify-between gap-3 px-5 py-3 text-sm"
              href="/vendors"
            >
              <span className="flex flex-col items-start text-left">
                <span className="font-semibold">Browse the directory</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                  See how it looks
                </span>
              </span>
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </Link>
          </div>
          <p className="text-xs text-ink/50">
            No listing fee · no per-lead fee · no commission on bookings ·{' '}
            <Link
              href="/login"
              className="font-medium text-terracotta underline-offset-4 hover:underline"
            >
              Sign in if you already have an account
            </Link>
          </p>
        </div>

        <div className="relative isolate">
          <ProfileMock />
        </div>
      </div>
    </section>
  );
}

function ProfileMock() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="rounded-3xl border border-ink/10 bg-cream p-6 shadow-[0_30px_80px_-40px_rgba(26,26,26,0.25)]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
              Verified vendor
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-terracotta">
              <Shield aria-hidden className="h-2.5 w-2.5" strokeWidth={2} />
              Setnayan Verified
            </span>
          </div>
          <p className="text-xl font-semibold tracking-tight text-ink">
            Maria Santos Photography
          </p>
          <p className="text-sm text-ink/55">Wedding photography · Cebu &amp; nearby</p>

          <div className="flex items-center gap-1 pt-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                aria-hidden
                className="h-4 w-4 fill-terracotta text-terracotta"
                strokeWidth={1.5}
              />
            ))}
            <span className="ml-1 text-xs text-ink/55">
              4.9 · 23 couple reviews
            </span>
          </div>

          <div className="rounded-2xl border border-terracotta/30 bg-terracotta/5 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
              Inquiry from a couple
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">
              Lara &amp; Mike — Aug 16, 2026 wedding
            </p>
            <p className="mt-1 text-xs text-ink/55">
              &ldquo;Hi! Are you available for our intimate beach wedding in
              Mactan?&rdquo;
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            {[Users, MessageSquare, Wallet].map((I, i) => (
              <span
                key={i}
                className="flex h-12 flex-col items-center justify-center gap-1 rounded-lg border border-ink/10 bg-cream text-terracotta"
              >
                <I aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </span>
            ))}
          </div>
        </div>
      </div>
      <p
        aria-hidden
        className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40"
      >
        Public vendor profile · /v/maria-santos-photography
      </p>
    </div>
  );
}

const VALUE_PROPS: Array<{ Icon: LucideIcon; label: string; sub: string }> = [
  {
    Icon: Wallet,
    label: 'Free during launch',
    sub: 'No listing fee, no per-lead fee, no booking commission. You keep 100% of what couples pay you.',
  },
  {
    Icon: Shield,
    label: 'Verified by the Setnayan team',
    sub: 'Every profile is reviewed before it goes live. Couples see a Verified badge they can trust.',
  },
  {
    Icon: Star,
    label: 'Real reviews from real couples',
    sub: 'Reviews come only from couples who actually messaged or booked you on Setnayan. No drive-by ratings.',
  },
  {
    Icon: MapPin,
    label: 'Reach Filipino couples nationwide',
    sub: 'Manila, Cebu, Davao, Tagaytay, Iloilo, Baguio, and any city you serve. You set your coverage areas.',
  },
];

function ValueProps() {
  return (
    <section className="border-b border-ink/5">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        {VALUE_PROPS.map((b) => {
          const { Icon } = b;
          return (
            <div key={b.label} className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
                <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-ink">{b.label}</p>
                <p className="text-[11px] text-ink/55">{b.sub}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const HOW_STEPS: Array<{ step: string; title: string; body: string }> = [
  {
    step: '1',
    title: 'Create your vendor account',
    body: "Takes about two minutes. We'll ask for your business name, primary contact, and the services you offer. You don't need any prior portfolio link to start.",
  },
  {
    step: '2',
    title: 'Setnayan verifies your business',
    body: 'Our team reviews your account against publicly available business records. Most verifications complete in 1–2 business days. We only ask for additional info if something needs clarifying.',
  },
  {
    step: '3',
    title: 'Your profile goes live at /v/your-business',
    body: 'Once verified, your public profile is indexed by Google + linked from the Setnayan vendor directory. Couples find you by category, city, and search.',
  },
  {
    step: '4',
    title: 'Couples message you on the platform',
    body: 'Inquiries land in your vendor dashboard. Reply, share packages, close bookings off-platform. We never take a cut.',
  },
];

function HowItWorks() {
  return (
    <section className="border-b border-ink/5">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mb-10 max-w-2xl space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            How it works
          </p>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Four steps from sign-up to your first inquiry.
          </h2>
        </div>
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {HOW_STEPS.map((s) => (
            <li
              key={s.step}
              className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-5"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta text-cream">
                <span className="font-mono text-sm font-semibold">{s.step}</span>
              </span>
              <h3 className="text-base font-semibold tracking-tight text-ink">{s.title}</h3>
              <p className="text-sm text-ink/65">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function FAQ() {
  return (
    <section className="border-b border-ink/5 bg-cream">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mb-8 max-w-2xl space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Common questions
          </p>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            What vendors usually ask before signing up.
          </h2>
        </div>
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {FAQS.map((faq) => (
            <li
              key={faq.q}
              className="flex flex-col gap-2 rounded-xl border border-ink/10 bg-cream p-5"
            >
              <h3 className="flex items-start gap-2 text-base font-semibold tracking-tight text-ink">
                <CheckCircle2
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
                  strokeWidth={1.75}
                />
                {faq.q}
              </h3>
              <p className="text-sm text-ink/65">{faq.a}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="border-b border-ink/5">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 sm:py-20 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="max-w-2xl space-y-3">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Ready when you are.
          </h2>
          <p className="text-base text-ink/65">
            Free vendor profiles during launch. No commitment, no card,
            cancel any time.
          </p>
        </div>
        <div className="grid w-full gap-3 sm:max-w-md sm:grid-cols-2">
          <Link
            className="button-primary inline-flex items-center justify-center gap-2 text-sm"
            href="/signup?as=vendor"
          >
            List my services
            <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </Link>
          <Link
            className="button-secondary inline-flex items-center justify-center gap-2 text-sm"
            href="/vendors"
          >
            See the directory
            <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-ink/55 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-terracotta text-[10px] font-semibold text-cream"
          >
            S
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
            Setnayan · setnayan.com
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span>© 2026 Setnayan</span>
          <span aria-hidden>·</span>
          <span>Made in the Philippines</span>
          <span aria-hidden>·</span>
          <Link href="/help" className="hover:text-ink">
            Help
          </Link>
          <Link href="/vendors" className="hover:text-ink">
            Browse vendors
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
          <Link href="/login" className="hover:text-ink">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
