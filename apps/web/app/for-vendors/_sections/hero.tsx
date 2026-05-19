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
        <div className="space-y-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Pioneer vendors · Pre-launch
          </p>
          <h1 className="font-display text-[44px] font-medium leading-[1.02] tracking-tight text-ink sm:text-[60px] lg:text-[80px]">
            Scale your wedding business.{' '}
            <span className="text-ink/55">One app.</span>
          </h1>
          <p className="max-w-prose text-xl leading-relaxed text-ink/70 sm:text-2xl">
            Get found by couples planning weddings across the Philippines.
            Pro tier <strong className="text-ink">free for 10 months</strong>{' '}
            when you pre-register today.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              className="button-primary inline-flex min-h-[52px] items-center justify-center gap-2 px-8 text-base font-semibold"
              href="/signup?as=vendor"
            >
              Pre-register your business
              <ArrowRight aria-hidden className="h-5 w-5" strokeWidth={2} />
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-ink/55 underline-offset-4 hover:text-terracotta hover:underline"
            >
              Already have an account? Sign in
            </Link>
          </div>
          <p className="text-xs text-ink/45">
            Free forever to list · Pro &amp; All Tools FREE until Mar 31, 2027 · BIR receipts handled
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
