import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Users,
  QrCode,
  Palette,
  ListChecks,
  Send,
  LayoutGrid,
  Briefcase,
  Wallet,
  CalendarDays,
  Camera,
  Tv,
  CloudUpload,
  ArrowRight,
  Apple,
  MapPin,
  ShieldCheck,
  Receipt,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { SiteHeader } from '@/app/_components/site-header';
import { Logo } from '@/app/_components/logo';

export const metadata = {
  title: 'Wedding Suppliers & Supplies Philippines',
  description:
    'Find verified wedding supplies, suppliers, and rentals across the Philippines — from Manila to Cebu, Davao, and Tagaytay. Free planning tools, transparent PHP pricing.',
};

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(
  /\/$/,
  '',
);

const HOMEPAGE_JSONLD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Setnayan',
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/icon-512.svg`,
      description:
        'Filipino-first wedding and life-events platform. Verified Philippine wedding suppliers and supplies with transparent PHP pricing.',
      areaServed: { '@type': 'Country', name: 'Philippines' },
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: 'Setnayan',
      inLanguage: 'en-PH',
      publisher: { '@id': `${SITE_URL}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_URL}/vendors?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${SITE_URL}/#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: `${SITE_URL}/`,
        },
      ],
    },
  ],
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(HOMEPAGE_JSONLD) }}
      />
      <main className="min-h-dvh">
        <SiteHeader />
        <Hero />
        <TrustSignals />
        <Shipping />
        <Pricing />
        <RoadmapCompact />
        <ClosingCta />
        <SiteFooter />
      </main>
    </>
  );
}

function Hero() {
  return (
    <section className="border-b border-ink/5 bg-cream">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:px-8 lg:py-24">
        <div className="space-y-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Philippines · life events · weddings first
          </p>
          <h1 className="font-sans text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-6xl">
            Set na &lsquo;yan.
            <span className="mt-2 block text-2xl font-normal text-ink/65 sm:text-3xl">
              Your wedding, planned end-to-end on one platform.
            </span>
          </h1>
          <p className="max-w-prose text-lg text-ink/70">
            From the guest list to the QR invitations to the seating plan and the highlight
            reel — Setnayan is the Filipino-first home for everything around a wedding day.
            Built for couples, sponsors, vendors, and family on every device.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              className="button-primary inline-flex items-center justify-between gap-3 px-5 py-3 text-sm"
              href="/signup"
            >
              <span className="flex flex-col items-start text-left">
                <span className="font-semibold">Plan our wedding</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] opacity-80">
                  I&rsquo;m a couple
                </span>
              </span>
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </Link>
            <Link
              className="button-secondary inline-flex items-center justify-between gap-3 px-5 py-3 text-sm"
              href="/signup?as=vendor"
            >
              <span className="flex flex-col items-start text-left">
                <span className="font-semibold">List my services</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                  I&rsquo;m a vendor
                </span>
              </span>
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </Link>
          </div>
          <p className="text-xs text-ink/50">
            Free to start · no credit card · pay-as-you-go for premium services ·{' '}
            <Link
              href="/login"
              className="font-medium text-terracotta underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
          <p className="text-xs text-ink/50">
            On a Mac?{' '}
            <Link
              href="/download"
              className="inline-flex items-center gap-1 font-medium text-terracotta underline-offset-4 hover:underline"
            >
              <Apple aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Download Setnayan for macOS
            </Link>
          </p>
        </div>

        <div className="relative isolate">
          <DeviceMock />
        </div>
      </div>
    </section>
  );
}

function DeviceMock() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="rounded-3xl border border-ink/10 bg-cream p-6 shadow-[0_30px_80px_-40px_rgba(26,26,26,0.25)]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
              Good evening, Maria
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40">
              12 · 12 · 26
            </span>
          </div>
          <p className="text-xl font-semibold tracking-tight text-ink">
            Maria &amp; Juan
          </p>
          <p className="text-sm text-ink/55">213 days to go · La Castellana</p>

          <div className="flex flex-wrap gap-2 pt-1">
            {['Dreaming', 'Booking', 'Inviting', 'Finalizing', 'Day', 'After'].map((s, i) => (
              <span
                key={s}
                className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                  i === 2
                    ? 'bg-terracotta text-cream'
                    : i < 2
                      ? 'bg-terracotta/15 text-terracotta-700'
                      : 'bg-ink/5 text-ink/55'
                }`}
              >
                {s}
              </span>
            ))}
          </div>

          <div className="rounded-2xl border border-terracotta/30 bg-terracotta/5 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
              Next up
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">
              Send invites to 47 pending guests
            </p>
            <p className="mt-1 text-xs text-ink/55">
              Print the QR sheet or share individual links.
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-1">
            {[Users, Send, Briefcase, LayoutGrid].map((I, i) => (
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
        Couple home · Setnayan Default theme
      </p>
    </div>
  );
}

const TRUST_BADGES: Array<{ Icon: LucideIcon; label: string; sub: string }> = [
  { Icon: MapPin, label: 'Built in the Philippines', sub: 'For Filipino weddings, by a Filipino team' },
  { Icon: Receipt, label: 'BIR-compliant receipts', sub: '12% VAT split · auto OR · receipt log' },
  { Icon: ShieldCheck, label: 'RA 10173 compliant', sub: 'Privacy-first · data export · account deletion' },
  { Icon: Sparkles, label: 'Free to start', sub: 'Pay only for premium add-ons, when you opt in' },
];

function TrustSignals() {
  return (
    <section className="border-b border-ink/5">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-4 px-4 py-8 sm:grid-cols-4 sm:px-6 lg:px-8">
        {TRUST_BADGES.map((b) => {
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

const SHIPPING_FEATURES: Array<{ Icon: LucideIcon; title: string; body: string }> = [
  {
    Icon: Users,
    title: 'Guest List built for Filipino weddings',
    body: '18 role tiers — from the maid of honor to candle, veil, cord, and coin sponsors. Plus-ones are first-class rows, not afterthoughts.',
  },
  {
    Icon: QrCode,
    title: 'QR invitations, on-brand',
    body: 'Each guest gets a personal invitation site with a branded QR — your monogram in the center, your colors, your URL. Print sheet ready.',
  },
  {
    Icon: Send,
    title: 'RSVP that just works',
    body: "Three buttons: I'll be there, I can't make it, maybe. Couples see live counts; guests skip the spreadsheet.",
  },
  {
    Icon: Palette,
    title: 'Four ready-made looks',
    body: 'Setnayan Default · Victorian · Classy · iOS. Switch your couple dashboard chrome to whichever feels like yours.',
  },
  {
    Icon: ListChecks,
    title: 'Guided planner — or freestyle',
    body: 'A 9-step checklist that auto-checks date, venue, slug, and guest list as you go. Prefer to roam? Flip to DIY in one click.',
  },
  {
    Icon: CalendarDays,
    title: 'Countdown + 6-stage strip',
    body: "We compute what stage you're in — Dreaming, Booking, Inviting, Finalizing, Day, After — so you always know what's next.",
  },
];

function Shipping() {
  return (
    <section className="border-b border-ink/5">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mb-10 max-w-2xl space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Live today
          </p>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything you need for the couple side of the story.
          </h2>
          <p className="text-base text-ink/65">
            We started where the work starts: the couple&rsquo;s planning home, the guest list,
            and the invitation flow. These are shipped, deployed, and in use right now.
          </p>
        </div>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SHIPPING_FEATURES.map((f) => {
            const { Icon } = f;
            return (
              <li
                key={f.title}
                className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-5"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
                  <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <h3 className="text-base font-semibold tracking-tight text-ink">{f.title}</h3>
                <p className="text-sm text-ink/65">{f.body}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

const PRICING_ROWS: Array<{ label: string; price: string; note: string }> = [
  { label: 'Guest list, RSVPs, QR invitations, seating', price: 'Free', note: 'Unlimited guests' },
  { label: 'Mood Board, Budget, 9-step Guided Planner', price: 'Free', note: 'Included' },
  { label: 'Save the Date — vertical + square + horizontal MP4', price: '₱49', note: 'Per render' },
  { label: 'Pro tier per Invitation Widget (Hero / Story / Schedule)', price: '₱99', note: 'Or ₱199 bundle' },
  { label: 'Custom Monogram Pack (remove watermark, event-wide)', price: '₱1,999', note: 'One time' },
  { label: 'Papic (3 candid-capture phone seats)', price: '₱1,499', note: 'Per event' },
  { label: 'Live Stream — base broadcast (1 cam · 3 hours)', price: '₱2,499', note: 'Per event' },
];

function Pricing() {
  return (
    <section className="border-b border-ink/5">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mb-8 max-w-2xl space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Transparent pricing
          </p>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Free to plan. Pay only for what you opt into.
          </h2>
          <p className="text-base text-ink/65">
            No subscription, no per-guest fee, no commission on vendor bookings. You only
            pay when you choose a premium add-on for your event.
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-ink/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink/[0.03] text-[11px] uppercase tracking-[0.12em] text-ink/55">
              <tr>
                <th className="px-4 py-3 font-medium">What you get</th>
                <th className="px-4 py-3 font-medium text-right">Price</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Notes</th>
              </tr>
            </thead>
            <tbody>
              {PRICING_ROWS.map((r) => (
                <tr key={r.label} className="border-t border-ink/5">
                  <td className="px-4 py-3 font-medium text-ink">{r.label}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-terracotta">
                    {r.price}
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-[11px] text-ink/55 sm:table-cell">
                    {r.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink/55">
          Payments via BDO bank transfer or GCash. Receipts are BIR-compliant with the 12%
          VAT split, issued automatically per order.
        </p>
      </div>
    </section>
  );
}

const ROADMAP_HIGHLIGHTS: Array<{ Icon: LucideIcon; title: string }> = [
  { Icon: Briefcase, title: 'Vendor Marketplace' },
  { Icon: Camera, title: 'Papic candid capture' },
  { Icon: Tv, title: 'Panood live stream' },
  { Icon: CloudUpload, title: 'Photo Delivery' },
];

function RoadmapCompact() {
  return (
    <section className="border-b border-ink/5 bg-cream">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="max-w-xl space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Rolling out next
          </p>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            More features ship over 2026.
          </h2>
          <p className="text-sm text-ink/65">
            Vendor discovery, candid capture, live streaming, and post-event photo
            delivery are next. Start your event today — you&rsquo;ll grow with the platform.
          </p>
        </div>
        <ul className="flex flex-wrap gap-2 lg:max-w-md">
          {ROADMAP_HIGHLIGHTS.map((r) => {
            const { Icon } = r;
            return (
              <li
                key={r.title}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/65"
              >
                <Icon aria-hidden className="h-3.5 w-3.5 text-terracotta" strokeWidth={1.75} />
                {r.title}
              </li>
            );
          })}
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
            Pick your path.
          </h2>
          <p className="text-base text-ink/65">
            Couples plan end-to-end. Vendors list their services and reach Filipino
            couples. Both free to start.
          </p>
        </div>
        <div className="grid w-full gap-3 sm:max-w-md sm:grid-cols-2">
          <Link
            className="button-primary inline-flex items-center justify-center gap-2 text-sm"
            href="/signup"
          >
            Plan our wedding
            <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </Link>
          <Link
            className="button-secondary inline-flex items-center justify-center gap-2 text-sm"
            href="/signup?as=vendor"
          >
            List my services
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
          <Link href="/terms" className="hover:text-ink">
            Terms
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
