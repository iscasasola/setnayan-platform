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
  type LucideIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Setnayan — Philippines-first life-events platform',
  description:
    "Setnayan is the Philippines-first life-events platform. V1 weddings — guest lists, QR invitations, branded sites, planner, and more. Set na 'yan.",
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
    <main className="min-h-dvh">
      <TopNav />
      <Hero />
      <Shipping />
      <Roadmap />
      <ClosingCta />
      <SiteFooter />
    </main>
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
            Setnayan
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline sm:inline"
          >
            Sign in
          </Link>
          <Link href="/signup" className="button-primary h-10 px-5 text-sm">
            Create account
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
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link className="button-primary" href="/signup">
              Start planning · free
            </Link>
            <Link
              className="button-secondary inline-flex items-center gap-2"
              href="/login"
            >
              I already have an account
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </Link>
          </div>
          <p className="text-xs text-ink/50">
            Free to start · no credit card · pay-as-you-go for premium services
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

const ROADMAP: Array<{ Icon: LucideIcon; title: string; when: string; body: string }> = [
  {
    Icon: Briefcase,
    title: 'Vendors',
    when: 'Coming next',
    body: '28 service categories · 6-stage readiness tracker · flexible payment milestones · crew meals.',
  },
  {
    Icon: LayoutGrid,
    title: 'Seating Chart Editor',
    when: 'Coming next',
    body: '13-entry table catalog · free-placed stage · role-tier ring auto-fill · QR on publish.',
  },
  {
    Icon: Wallet,
    title: 'Budget & Expenses',
    when: '2026 H2',
    body: '3 line items per vendor · payment log · .ics calendar export.',
  },
  {
    Icon: Camera,
    title: 'Papic',
    when: '2026 H2',
    body: 'Candid capture · gesture shutter · QR tagging · personal reels from your wedding.',
  },
  {
    Icon: Tv,
    title: 'Panood',
    when: '2026 H2',
    body: 'Live stream · YouTube delivery · AI Highlights · Same-Day Edit.',
  },
  {
    Icon: CloudUpload,
    title: 'Photo Delivery',
    when: '2026 H2',
    body: 'Google Drive handoff for full-resolution photo delivery.',
  },
];

function Roadmap() {
  return (
    <section className="border-b border-ink/5 bg-cream">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mb-10 max-w-2xl space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Shipping over 2026
          </p>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            On the way.
          </h2>
          <p className="text-base text-ink/65">
            Setnayan is a live build. We&rsquo;re shipping the rest of the V1 surface across
            2026 — start now and you&rsquo;ll grow with the platform.
          </p>
        </div>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROADMAP.map((r) => {
            const { Icon } = r;
            return (
              <li
                key={r.title}
                className="flex flex-col gap-3 rounded-xl border border-dashed border-ink/15 bg-cream p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-ink/5 text-ink/55">
                    <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <span className="rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
                    {r.when}
                  </span>
                </div>
                <h3 className="text-base font-semibold tracking-tight text-ink">{r.title}</h3>
                <p className="text-sm text-ink/65">{r.body}</p>
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
            Start with your guest list.
          </h2>
          <p className="text-base text-ink/65">
            Sign up free, create your event, and have invitations going out in an
            afternoon. Pay only for premium services as you opt into them.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link className="button-primary" href="/signup">
            Create your account
          </Link>
          <Link className="button-secondary" href="/login">
            Sign in
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
