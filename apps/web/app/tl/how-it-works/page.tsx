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
import { Logo } from '@/app/_components/logo';
import { getVendorPrices } from '@/lib/v2-catalog';

// /tl/how-it-works — Taglish edition of /how-it-works (localization). English +
// Taglish are the two public locales (owner: "english and taglish"). Live vendor
// price comes from the SAME getVendorPrices() source as the EN page — no price
// drift; only the prose is translated. Reciprocal hreflang (en-PH ↔ tl-PH,
// x-default → en). "Taglish" has no ISO code → tl is the closest standard.
export const dynamic = 'force-dynamic';

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(
  /\/$/,
  '',
);

const LANGUAGES = {
  'en-PH': `${SITE_URL}/how-it-works`,
  'tl-PH': `${SITE_URL}/tl/how-it-works`,
  'x-default': `${SITE_URL}/how-it-works`,
};

export const metadata = {
  title: 'Paano gumagana ang Setnayan — couples, vendors, guests, admins',
  description:
    'Ang buong mapa kung sino-sino sa Setnayan at saan gumugugol ng oras ang bawat isa. Isang talata bawat role, plus kung paano nagkokonekta ang flow.',
  alternates: {
    canonical: `${SITE_URL}/tl/how-it-works`,
    languages: LANGUAGES,
  },
};

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
      '@id': `${SITE_URL}/tl/how-it-works#webpage`,
      url: `${SITE_URL}/tl/how-it-works`,
      name: 'Paano gumagana ang Setnayan',
      isPartOf: { '@id': `${SITE_URL}/#website` },
      about: { '@id': `${SITE_URL}/#organization` },
      inLanguage: 'tl-PH',
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
};

const ROLE_CARDS: ReadonlyArray<RoleCard> = [
  {
    key: 'couple',
    label: 'Couple',
    entryPath: '/dashboard',
    icon: Heart,
    who: 'Nagpaplano ka ng kasal. Isang event, isang owner ngayon.',
    where: [
      'Guest list, invitation site, vendors, budget, seating, mood board',
      'Day-of mode from T-1h to T+8h — table + schedule + photo wall',
      'Add-ons (LED, photo delivery, Panood, Papic, supplies marketplace, at iba pa)',
    ],
    helpHref: '/help?role=couple',
  },
  {
    key: 'vendor',
    label: 'Vendor',
    entryPath: '/vendor-dashboard',
    icon: Briefcase,
    who: 'Nagbebenta ka sa couples. Free profile, optional Pro subscription para sa mas maraming reach.',
    where: [
      'Services, bookings inbox, team roles, earnings rollup',
      'Reply-only chat — couples ang lalapit, ikaw ang sasagot with quotes + files',
      'Verification badge, reviews from completed events',
    ],
    helpHref: '/help?role=vendor',
  },
  {
    key: 'guest',
    label: 'Guest',
    entryPath: '/e/[event-slug]',
    icon: Mailbox,
    who: 'Na-invite ka. No sign-up needed — buksan mo lang ang link mo.',
    where: [
      'Save-the-Date → Invitation → Logistics → Post-event (4 phases)',
      'RSVP, meal preference, plus-one naming',
      'Day-of: hanapin ang table mo, tingnan ang live schedule, mag-upload ng photos',
    ],
    helpHref: '/help?role=guest',
  },
  {
    key: 'admin',
    label: 'Admin',
    entryPath: '/admin',
    icon: Shield,
    who: 'Setnayan operations team. Naka-gate sa likod ng is_internal.',
    where: [
      'Users, vendors, orders, reviews — ang araw-araw na moderation',
      'Funnels, force-majeure escalations, verification queue',
      'Website editor (8th surface) para sa marketing-site widgets',
    ],
    helpHref: '/help?role=admin',
  },
  {
    key: 'public-landing',
    label: 'Public landing',
    entryPath: '/',
    icon: Globe,
    who: 'Ang marketing site sa setnayan.com. Kung nasaan ka ngayon.',
    where: [
      'Couple-side waitlist + vendor-side pre-registration',
      'Browse vendors, basahin ang features, tingnan ang pricing, humingi ng help',
      'No login needed — i-bookmark at i-share',
    ],
    helpHref: '/help',
  },
  {
    key: 'event-landing',
    label: 'Event landing',
    entryPath: '/e/[slug]',
    icon: QrCode,
    who: 'Per-couple public page. Ang link na i-share mo sa lahat.',
    where: [
      'Auto-shift sa 4 phases habang papalapit ang date',
      'May sariling slug ang bawat guest para sa personalised RSVP',
      'Nag-a-activate ng day-of mode from T-1h sa wedding day',
    ],
    helpHref: '/help?role=guest',
  },
];

const FLOW_STEPS: ReadonlyArray<{ from: string; to: string; what: string }> = [
  {
    from: 'Couple',
    to: 'Vendors',
    what: 'Nagba-browse ang couple sa /vendors, nagbubukas ng chat thread sa isa (hindi pwedeng mag-cold-DM ang vendors).',
  },
  {
    from: 'Vendor',
    to: 'Couple',
    what: 'Sumasagot ang vendor with a quote + files. Iisang thread ang nakikita ng dalawa.',
  },
  {
    from: 'Couple',
    to: 'Guests',
    what: 'Ginagawa ng couple ang guest list at nagpi-print / nag-share ng QR-coded invites.',
  },
  {
    from: 'Guests',
    to: 'Couple',
    what: 'Ini-scan ng bawat guest ang QR nila, lalapag sa personal page nila, at mag-RSVP.',
  },
  {
    from: 'Day-of',
    to: 'Everyone',
    what: 'Sa T-1h nagiging live mode ang event — tables, schedule, photo wall, broadcast.',
  },
  {
    from: 'Post-event',
    to: 'Couple ↔ Vendor',
    what: 'Lalabas ang reviews 24h after the event; ang force-majeure flags ay pupunta sa admin kung may na-file.',
  },
];

export default async function HowItWorksPageTaglish() {
  const p = await getVendorPrices();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(HOW_IT_WORKS_JSONLD) }}
      />
      <main className="min-h-dvh bg-cream pb-24 sm:pb-0">

        {/* Hero */}
        <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
              How it works
            </p>
            <Link
              href="/how-it-works"
              hrefLang="en-PH"
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55 underline-offset-4 hover:text-ink hover:underline"
            >
              English
            </Link>
          </div>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            Isang platform, anim na klaseng tao. Eto ang mapa.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-ink/70 sm:text-lg">
            Pinagsasama ng Setnayan ang couples, ang vendors nila, at ang guests
            nila sa isang platform — with an admin team behind the scenes. Itong
            page ang cheat-sheet kung sino ang gumagawa ng ano, at saan sila
            pumupunta.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="button-primary inline-flex h-11 items-center px-5 text-sm">
              Magsimula — free
            </Link>
            <Link
              href="/for-vendors"
              className="inline-flex h-11 items-center rounded-md border border-ink/15 px-5 text-sm font-medium text-ink hover:bg-ink/5"
            >
              Vendor ako
            </Link>
          </div>
        </section>

        {/* Role cards */}
        <section
          aria-label="Ang anim na klaseng tao sa Setnayan"
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
                    Help para sa role na ito
                    <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        {/* How they connect */}
        <section
          aria-label="Paano nagkokonekta ang lahat"
          className="mx-auto mt-16 w-full max-w-6xl px-4 sm:px-6 lg:px-8"
        >
          <div className="max-w-2xl space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
              Ang flow
            </p>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Paano nagkokonekta ang lahat, in order
            </h2>
            <p className="text-base text-ink/70">
              Dumadaan ang tipikal na Setnayan wedding sa anim na handoff na ito.
              Ipinapakita ng bawat row kung sino ang nag-uusap at ano ang
              nangyayari.
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

        {/* Coming next */}
        <section
          aria-label="Ang susunod"
          className="mx-auto mt-16 w-full max-w-6xl px-4 sm:px-6 lg:px-8"
        >
          <div className="rounded-2xl border border-ink/10 bg-white p-6 sm:p-8">
            <div className="flex items-center gap-2 text-terracotta">
              <Clock aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              <p className="font-mono text-[11px] uppercase tracking-[0.25em]">Susunod na</p>
            </div>
            <h2 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
              Pagdagdag ng isa pang planner sa event mo
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-ink/70 sm:text-base">
              Ngayon, isang owner lang ang bawat event. Ang pag-share ng access sa
              partner, magulang, o coordinator ay nasa V1.2 roadmap bilang
              multi-moderator event access — invite by email, role-scoped
              permissions, role-aware notifications. Hanggang hindi pa ito lumalabas,
              ang workaround ay i-share ang login credentials sa loob ng isang
              trusted household.
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              <span className="rounded-full bg-terracotta/10 px-3 py-1 font-medium text-terracotta-700">
                V1.2
              </span>
              <span className="rounded-full border border-ink/15 px-3 py-1 text-ink/65">
                Multi-payer cart, queued din for V1.2
              </span>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section
          aria-label="Magsimula"
          className="mx-auto mt-16 w-full max-w-6xl px-4 pb-16 sm:px-6 lg:px-8"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border border-ink/10 bg-white p-6">
              <div className="flex items-center gap-2 text-terracotta">
                <Heart aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                <p className="font-mono text-[11px] uppercase tracking-[0.25em]">Para sa couples</p>
              </div>
              <h3 className="mt-2 text-lg font-semibold tracking-tight">
                Magsimulang magplano, free.
              </h3>
              <p className="mt-2 text-sm text-ink/70">
                Guest list, seating, budget, schedule, mood board — plus ang buong
                vendor marketplace. No card needed to start.
              </p>
              <Link
                href="/signup"
                className="button-primary mt-4 inline-flex h-10 items-center px-5 text-sm"
              >
                Magsimula — free
              </Link>
            </article>
            <article className="rounded-2xl border border-ink/10 bg-white p-6">
              <div className="flex items-center gap-2 text-terracotta">
                <Briefcase aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                <p className="font-mono text-[11px] uppercase tracking-[0.25em]">Para sa vendors</p>
              </div>
              <h3 className="mt-2 text-lg font-semibold tracking-tight">
                I-list ang wedding business mo — free.
              </h3>
              <p className="mt-2 text-sm text-ink/70">
                Free verified profile at in-app chat with couples. Ang Pro sa
                {p.proMonthly} / 28 days ay nag-a-unlock ng unlimited services,
                custom slug + bid CTA sa profile mo, advanced proposal builder, at
                editorial credits sa weddings na kuha mo.
              </p>
              <Link
                href="/signup?as=vendor"
                className="button-primary mt-4 inline-flex h-10 items-center px-5 text-sm"
              >
                I-list ang business mo — free
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
