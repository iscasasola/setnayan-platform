import Link from 'next/link';
import { ArrowRight, Calendar, Inbox, FileText, Star } from 'lucide-react';

// Vendor hero — outcome-led ("Run your wedding business in one app").
// Different from the main homepage hero. Per iteration 0015 § Routes
// /for-vendors is a vendor-side deep dive; this hero leads with the
// merchant outcome (Shopify pattern) rather than the couple-side
// "Set na 'yan." brand line.

export function Hero() {
  return (
    <section className="border-b border-ink/5 bg-cream">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 pt-16 pb-24 sm:px-6 sm:pt-20 lg:grid-cols-2 lg:px-8 lg:pt-24">
        <div className="space-y-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            For Filipino wedding vendors · Founding cohort
          </p>
          <h1 className="font-sans text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-6xl">
            Run your wedding business in one app.
          </h1>
          <p className="max-w-prose text-lg text-ink/70">
            Listing. Calendar. Chat. Proposals. Payments. Reviews. Built for
            Filipino vendors who&rsquo;d rather book the gig than chase the
            GCash receipt.
          </p>
          <div className="rounded-2xl border-2 border-terracotta/40 bg-terracotta/5 p-4 sm:p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
              Founding-vendor window — June 1 → Dec 1, 2026
            </p>
            <p className="mt-2 text-sm text-ink">
              Pre-register today and lock in <strong>10 months of Pro tier FREE</strong>{' '}
              (until March 31, 2027). Couples open Dec 1 — get your portfolio,
              pricing, and contracts ready before the engagement-season surge.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              className="button-primary inline-flex items-center justify-between gap-3 px-5 py-3 text-sm"
              href="/signup?as=vendor"
            >
              <span className="flex flex-col items-start text-left">
                <span className="font-semibold">Pre-register your business</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] opacity-80">
                  Free forever to list · Pro free until Mar 31, 2027
                </span>
              </span>
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </Link>
            <Link
              className="button-secondary inline-flex items-center justify-between gap-3 px-5 py-3 text-sm"
              href="/help#contact"
            >
              <span className="flex flex-col items-start text-left">
                <span className="font-semibold">Talk to a human</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                  We&rsquo;ll reply same day
                </span>
              </span>
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </Link>
          </div>
          <p className="text-xs text-ink/55">
            Free to list · Pro &amp; All Tools FREE until Mar 31, 2027 · BIR receipts handled
          </p>
          <p className="text-xs text-ink/50">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-medium text-terracotta underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>

        <div className="relative isolate">
          <DashboardMock />
        </div>
      </div>
    </section>
  );
}

function DashboardMock() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="rounded-3xl border border-ink/10 bg-cream p-6 shadow-[0_30px_80px_-40px_rgba(26,26,26,0.25)]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
              Mariposa Bloom Photography
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-terracotta">
              Pro · active
            </span>
          </div>
          <p className="text-xl font-semibold tracking-tight text-ink">
            This week
          </p>
          <p className="text-sm text-ink/55">3 inquiries · 2 proposals out · ₱68,500 invoiced</p>

          <div className="rounded-2xl border border-terracotta/30 bg-terracotta/5 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
              New inquiry
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">
              Aira &amp; Boy — Nov 14, 2026 · Tagaytay
            </p>
            <p className="mt-1 text-xs text-ink/55">
              &ldquo;Hi po! Whole-day documentary, around 120 pax. Available?&rdquo;
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-1">
            {[
              { Icon: Calendar, label: 'Calendar' },
              { Icon: Inbox, label: 'Inbox' },
              { Icon: FileText, label: 'Proposals' },
              { Icon: Star, label: 'Reviews' },
            ].map(({ Icon, label }) => (
              <span
                key={label}
                className="flex h-12 flex-col items-center justify-center gap-1 rounded-lg border border-ink/10 bg-cream text-terracotta"
              >
                <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </span>
            ))}
          </div>
        </div>
      </div>
      <p
        aria-hidden
        className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40"
      >
        Vendor home · Setnayan dashboard
      </p>
    </div>
  );
}
