import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

// SEO/GEO Bucket 8 (CLAUDE.md 2026-05-29 SEO/GEO Sprint row) — 1hr Vercel
// edge cache so static marketing routes serve Google's crawl rate-limit
// budget without origin pressure. Each page rebuilds at most once per hour.
export const revalidate = 3600;

// 2026-07-24 — Setnayan is LIVE for couples now (owner decision). This route
// used to be a "launching December 1, 2026" waitlist with an email-capture
// form; that contradicted the live homepage ("Plan your wedding free") and the
// working sign-up/dashboard. Reframed to a truthful "we're live, start now"
// landing that sends couples straight into planning. The old
// `joinCoupleWaitlist` action is no longer wired here.
export const metadata = {
  title: 'Plan your wedding free — Setnayan',
  description:
    'Setnayan is live for couples. Start planning free today — guest list, seating, budget, mood board, and a verified vendor marketplace with 0% commission on bookings.',
  alternates: { canonical: '/waitlist' },
  openGraph: {
    title: 'Plan your wedding free — Setnayan',
    description:
      'Setnayan is live for couples. Start planning free today.',
    url: '/waitlist',
    type: 'website',
    siteName: 'Setnayan',
  },
};

export default function WaitlistPage() {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <section className="border-b border-ink/5">
        <div className="mx-auto w-full max-w-3xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24 sm:pb-28 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-terracotta">
            Setnayan is live
          </p>
          <h1 className="mt-3 text-balance font-display text-5xl font-medium tracking-tight sm:text-6xl lg:text-7xl">
            Start planning your wedding — <span className="text-terracotta">free</span>.
          </h1>
          <p className="mt-6 max-w-2xl text-base text-ink/65 sm:text-lg">
            Your planning workspace is ready today — guest list, seating, budget,
            mood board, and schedule. Browse a marketplace of real
            photographers, caterers, florists, coordinators and venues, each
            with portfolios and contracts you can sign in-app. No waitlist, no
            commission on bookings.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/onboarding/wedding"
              className="button-primary inline-flex min-h-[48px] items-center justify-center gap-2 px-7 text-sm font-semibold sm:text-base"
            >
              Plan your wedding free
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center gap-1.5 px-2 text-sm font-semibold text-ink underline-offset-4 hover:underline"
            >
              Browse vendors first
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-ink/5 bg-ink/[0.02]">
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <ul className="mt-4 space-y-2 text-sm text-ink/70">
            {/* 2026-06-13 reprice scrub (Pricing.md § 00.D): the wedding
                website, RSVP, and QR invitations are paid SKUs — listed as
                ready, not as free. */}
            <li>· Free planning workspace — guest list, seating, budget, mood board, schedule</li>
            <li>· Wedding website at setnayan.com/your-slug — branded QR, RSVP, event details</li>
            <li>· Marketplace browsing — real vendor portfolios + free vendor subdomain at slug.setnayan.com</li>
            <li>· Setnayan AI — Filipino-wedding AI guide that surfaces the next step</li>
            <li>· Vendor contracts hosted in-app — both sides keep a copy alongside the chat thread</li>
            <li>· Zero commission on vendor bookings — Setnayan only sells software</li>
            <li>· A receipt on every software purchase, archived in your dashboard</li>
          </ul>
          <p className="mt-6 text-xs text-ink/55">
            Vendor? <Link href="/vendors" className="font-semibold text-terracotta underline-offset-4 hover:underline">Pre-register your business today</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
