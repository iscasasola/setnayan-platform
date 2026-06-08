import Link from 'next/link';
import {
  Heart,
  Briefcase,
  Mailbox,
  Shield,
  Globe,
  QrCode,
  ArrowRight,
  CheckCircle2,
  Clock,
  Apple,
} from 'lucide-react';
import { SiteHeader } from '@/app/_components/site-header';
import { Logo } from '@/app/_components/logo';
import { getVendorPrices } from '@/lib/v2-catalog';

// SEO/GEO Bucket 8 (CLAUDE.md 2026-05-29 SEO/GEO Sprint row) — 1hr Vercel
// edge cache so static marketing routes serve Google's crawl rate-limit
// budget without origin pressure. Each page rebuilds at most once per hour.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'How Setnayan works — couples, vendors, guests, admins',
  description:
    "The complete map of who's who on Setnayan and where each person spends their time. One paragraph per role, plus how the flow connects.",
  alternates: {
    canonical: '/how-it-works',
  },
};

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(
  /\/$/,
  '',
);

const HOW_IT_WORKS_JSONLD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Setnayan',
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/icon-512.svg`,
    },
    {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/how-it-works#webpage`,
      url: `${SITE_URL}/how-it-works`,
      name: 'How Setnayan works',
      isPartOf: { '@id': `${SITE_URL}/#website` },
      about: { '@id': `${SITE_URL}/#organization` },
      inLanguage: 'en-PH',
    },
  ],
};

type RoleCard = {
  key: string;
  label: string;
  entryPath: string;
  icon: typeof Heart;
  who: string;
  where: string[];
  helpHref: string;
  shipped: boolean;
};

const ROLE_CARDS: ReadonlyArray<RoleCard> = [
  {
    key: 'couple',
    label: 'Couple',
    entryPath: '/dashboard',
    icon: Heart,
    who: "You're planning a wedding. One event, one owner today.",
    where: [
      'Guest list, invitation site, vendors, budget, seating, mood board',
      'Day-of mode from T-1h to T+8h with table + schedule + photo wall',
      'Add-ons (LED, photo delivery, Panood, Papic, supplies marketplace, more)',
    ],
    helpHref: '/help?role=couple',
    shipped: true,
  },
  {
    key: 'vendor',
    label: 'Vendor',
    entryPath: '/vendor-dashboard',
    icon: Briefcase,
    who: 'You sell to couples. Free profile, optional Pro subscription for more reach.',
    where: [
      'Services, bookings inbox, team roles, earnings rollup',
      'Reply-only chat — couples reach out, you reply with quotes + files',
      'Verification badge, reviews from completed events',
    ],
    helpHref: '/help?role=vendor',
    shipped: true,
  },
  {
    key: 'guest',
    label: 'Guest',
    entryPath: '/e/[event-slug]',
    icon: Mailbox,
    who: 'You got invited. No sign-up needed — just open your link.',
    where: [
      'Save-the-Date → Invitation → Logistics → Post-event (4 phases)',
      'RSVP, meal preference, plus-one naming',
      'Day-of: find your table, see the live schedule, upload photos',
    ],
    helpHref: '/help?role=guest',
    shipped: true,
  },
  {
    key: 'admin',
    label: 'Admin',
    entryPath: '/admin',
    icon: Shield,
    who: 'Setnayan operations team. Gated behind is_internal.',
    where: [
      'Users, vendors, orders, reviews — the day-to-day moderation',
      'Funnels, force-majeure escalations, verification queue',
      'Website editor (8th surface) for marketing-site widgets',
    ],
    helpHref: '/help?role=admin',
    shipped: true,
  },
  {
    key: 'public-landing',
    label: 'Public landing',
    entryPath: '/',
    icon: Globe,
    who: "The marketing site at setnayan.com. Where you're standing now.",
    where: [
      'Couple-side waitlist + vendor-side pre-registration',
      'Browse vendors, read features, see pricing, get help',
      'No login needed — bookmark and share',
    ],
    helpHref: '/help',
    shipped: true,
  },
  {
    key: 'event-landing',
    label: 'Event landing',
    entryPath: '/e/[slug]',
    icon: QrCode,
    who: 'Per-couple public page. The link you share with everyone.',
    where: [
      'Auto-shifts through 4 phases as the date approaches',
      'Each guest gets their own slug for personalised RSVP',
      'Activates day-of mode from T-1h on the wedding day',
    ],
    helpHref: '/help?role=guest',
    shipped: true,
  },
];

const FLOW_STEPS: ReadonlyArray<{ from: string; to: string; what: string }> = [
  {
    from: 'Couple',
    to: 'Vendors',
    what: 'Couple browses /vendors, opens a chat thread with one (vendors cannot DM cold).',
  },
  {
    from: 'Vendor',
    to: 'Couple',
    what: 'Vendor replies with a quote + files. Both sides see the same thread.',
  },
  {
    from: 'Couple',
    to: 'Guests',
    what: 'Couple builds the guest list and prints / shares QR-coded invites.',
  },
  {
    from: 'Guests',
    to: 'Couple',
    what: 'Each guest scans their QR, lands on their personal page, RSVPs.',
  },
  {
    from: 'Day-of',
    to: 'Everyone',
    what: 'T-1h flips the event into live mode — tables, schedule, photo wall, broadcast.',
  },
  {
    from: 'Post-event',
    to: 'Couple ↔ Vendor',
    what: 'Reviews land 24h after the event; force-majeure flags route to admin if filed.',
  },
];

export default async function HowItWorksPage() {
  const p = await getVendorPrices();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(HOW_IT_WORKS_JSONLD) }}
      />
      <main className="min-h-dvh bg-cream pb-24 sm:pb-0">
        <SiteHeader />

        {/* Hero */}
        <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            How it works
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            One platform, six kinds of people. Here&rsquo;s the map.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-ink/70 sm:text-lg">
            Setnayan brings couples, their vendors, and their guests onto one platform —
            with an admin team behind the scenes. This page is the cheat-sheet for who
            does what and where they go.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="button-primary inline-flex h-11 items-center px-5 text-sm">
              Start planning — free
            </Link>
            <Link
              href="/for-vendors"
              className="inline-flex h-11 items-center rounded-md border border-ink/15 px-5 text-sm font-medium text-ink hover:bg-ink/5"
            >
              I&rsquo;m a vendor
            </Link>
          </div>
        </section>

        {/* Role cards */}
        <section
          aria-label="The six kinds of people on Setnayan"
          className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ROLE_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <article
                  key={card.key}
                  className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-5"
                >
                  <header className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
                        <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                      </span>
                      <div>
                        <h2 className="text-base font-semibold text-ink">{card.label}</h2>
                        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                          {card.entryPath}
                        </p>
                      </div>
                    </div>
                  </header>
                  <p className="text-sm text-ink/75">{card.who}</p>
                  <ul className="space-y-1.5 text-sm text-ink/70">
                    {card.where.map((line) => (
                      <li key={line} className="flex gap-2">
                        <CheckCircle2
                          aria-hidden
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-terracotta/70"
                          strokeWidth={2}
                        />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={card.helpHref}
                    className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-terracotta hover:text-terracotta-700"
                  >
                    Help for this role
                    <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        {/* How they connect */}
        <section
          aria-label="How everyone connects"
          className="mx-auto mt-16 w-full max-w-6xl px-4 sm:px-6 lg:px-8"
        >
          <div className="max-w-2xl space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
              The flow
            </p>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              How everyone connects, in order
            </h2>
            <p className="text-base text-ink/70">
              A typical Setnayan wedding moves through these six handoffs. Each row shows who
              talks to whom and what happens.
            </p>
          </div>
          <ol className="mt-8 space-y-3">
            {FLOW_STEPS.map((step, idx) => (
              <li
                key={`${step.from}-${step.to}`}
                className="flex flex-col gap-2 rounded-xl border border-ink/10 bg-white p-4 sm:flex-row sm:items-center sm:gap-4"
              >
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracotta/10 font-mono text-xs font-semibold text-terracotta">
                  {idx + 1}
                </span>
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                  <span>{step.from}</span>
                  <ArrowRight aria-hidden className="h-4 w-4 text-ink/40" strokeWidth={2} />
                  <span>{step.to}</span>
                </div>
                <p className="text-sm text-ink/70 sm:ml-auto sm:max-w-xl sm:text-right">
                  {step.what}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Coming next — multi-moderator V1.2 */}
        <section
          aria-label="What's coming next"
          className="mx-auto mt-16 w-full max-w-6xl px-4 sm:px-6 lg:px-8"
        >
          <div className="rounded-2xl border border-ink/10 bg-white p-6 sm:p-8">
            <div className="flex items-center gap-2 text-terracotta">
              <Clock aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              <p className="font-mono text-[11px] uppercase tracking-[0.25em]">Coming next</p>
            </div>
            <h2 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
              Adding another planner to your event
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-ink/70 sm:text-base">
              Today every event has exactly one owner. Sharing access with a partner, parent, or
              coordinator is on the V1.2 roadmap as multi-moderator event access — invite by
              email, role-scoped permissions, role-aware notifications. Until that ships, the
              workaround is to share login credentials within a trusted household.
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              <span className="rounded-full bg-terracotta/10 px-3 py-1 font-medium text-terracotta-700">
                V1.2
              </span>
              <span className="rounded-full border border-ink/15 px-3 py-1 text-ink/65">
                Multi-payer cart also queued for V1.2
              </span>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section
          aria-label="Get started"
          className="mx-auto mt-16 w-full max-w-6xl px-4 pb-16 sm:px-6 lg:px-8"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border border-ink/10 bg-white p-6">
              <div className="flex items-center gap-2 text-terracotta">
                <Heart aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                <p className="font-mono text-[11px] uppercase tracking-[0.25em]">For couples</p>
              </div>
              <h3 className="mt-2 text-lg font-semibold tracking-tight">
                Plan one wedding, free.
              </h3>
              <p className="mt-2 text-sm text-ink/70">
                Guest list, invitations, vendors, budget, seating, mood board — and the day-of
                experience. No card needed to start.
              </p>
              <Link
                href="/signup"
                className="button-primary mt-4 inline-flex h-10 items-center px-5 text-sm"
              >
                Start planning — free
              </Link>
            </article>
            <article className="rounded-2xl border border-ink/10 bg-white p-6">
              <div className="flex items-center gap-2 text-terracotta">
                <Briefcase aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                <p className="font-mono text-[11px] uppercase tracking-[0.25em]">For vendors</p>
              </div>
              <h3 className="mt-2 text-lg font-semibold tracking-tight">
                List your wedding business — free.
              </h3>
              <p className="mt-2 text-sm text-ink/70">
                A free verified profile, in-app chat with couples, BIR-compliant receipts. Pro at
                {p.proMonthly} / 28 days unlocks unlimited services, custom slug + bid CTA on your
                profile, advanced proposal builder, and editorial credits on the weddings you shoot.
              </p>
              <Link
                href="/signup?as=vendor"
                className="button-primary mt-4 inline-flex h-10 items-center px-5 text-sm"
              >
                List your business — free
              </Link>
            </article>
          </div>
        </section>

        <Footer />
      </main>
    </>
  );
}

function Footer() {
  return (
    <footer className="border-t border-ink/5">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-ink/55 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-ink">
          <Logo height={24} />
          <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
            Setnayan · setnayan.com
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span>© 2026 Setnayan</span>
          <span aria-hidden>·</span>
          <span>Made in the Philippines</span>
          <span aria-hidden>·</span>
          <Link href="/features" className="hover:text-ink">
            Features
          </Link>
          <Link href="/help" className="hover:text-ink">
            Help
          </Link>
          <Link href="/download" className="inline-flex items-center gap-1 hover:text-ink">
            <Apple aria-hidden className="h-3 w-3" strokeWidth={1.75} />
            Mac app
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link href="/login" className="hover:text-ink">
            Sign in
          </Link>
          <Link href="/signup" className="hover:text-ink">
            Create account
          </Link>
        </div>
      </div>
    </footer>
  );
}
