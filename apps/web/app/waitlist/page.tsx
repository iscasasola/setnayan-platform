import Link from 'next/link';
import { ArrowRight, CalendarHeart, CheckCircle2 } from 'lucide-react';
import { SiteHeader } from '@/app/_components/site-header';
import { Logo } from '@/app/_components/logo';
import { SubmitButton } from '@/app/_components/submit-button';
import { createClient } from '@/lib/supabase/server';
import { joinCoupleWaitlist } from './actions';

// SEO/GEO Bucket 8 (CLAUDE.md 2026-05-29 SEO/GEO Sprint row) — 1hr Vercel
// edge cache so static marketing routes serve Google's crawl rate-limit
// budget without origin pressure. Each page rebuilds at most once per hour.
export const revalidate = 3600;

export const metadata = {
  title: 'Couple waitlist — Setnayan',
  description:
    'Setnayan launches for couples on December 1, 2026. Join the waitlist and we’ll email you the moment we go live — free planning tools, a verified vendor marketplace, and 0% commission on vendor bookings.',
  alternates: { canonical: '/waitlist' },
  openGraph: {
    title: 'Couple waitlist — Setnayan',
    description:
      'Setnayan launches for couples on December 1, 2026. Join the waitlist.',
    url: '/waitlist',
    type: 'website',
    siteName: 'Setnayan',
  },
};

const ERROR_COPY: Record<string, string> = {
  missing_email: 'Email is required.',
  invalid_email: 'That email looks off — double-check the format.',
  invalid_date: 'Pick a valid wedding date or leave it blank.',
  name_too_long: 'Your name is over 200 characters.',
  partner_name_too_long: 'Partner name is over 200 characters.',
  city_too_long: 'City is over 100 characters.',
  server: 'Something broke on our side. Try again in a minute.',
};

type Props = {
  searchParams: Promise<{ status?: string; error?: string }>;
};

export default async function WaitlistPage({ searchParams }: Props) {
  const search = await searchParams;
  const joined = search.status === 'joined';
  const errorMessage = search.error ? ERROR_COPY[search.error] ?? null : null;

  // Page is already dynamic via searchParams, so the auth fetch costs
  // nothing extra over the existing render. See SiteHeader's auth-aware
  // CTA swap (2026-05-20) for the broader rationale.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const headerUser = user ? { id: user.id, email: user.email ?? null } : null;

  return (
    <div className="min-h-screen bg-cream text-ink">
      <SiteHeader user={headerUser} />

      <section className="border-b border-ink/5">
        <div className="mx-auto w-full max-w-3xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24 sm:pb-28 lg:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Couple waitlist
          </p>
          <h1 className="mt-3 text-balance font-display text-5xl font-medium tracking-tight sm:text-6xl lg:text-7xl">
            Setnayan opens to couples on{' '}
            <span className="text-terracotta">December 1, 2026</span>.
          </h1>
          <p className="mt-6 max-w-2xl text-base text-ink/65 sm:text-lg">
            Vendors are pre-registering now so by launch day you&rsquo;ll land
            on a marketplace with real photographers, caterers, florists,
            coordinators and venues — already with portfolios, pricing, and
            contracts ready to sign. Add your email and we&rsquo;ll write the
            moment we&rsquo;re live.
          </p>

          {joined ? (
            <div className="mt-10 rounded-2xl border-2 border-emerald-300/60 bg-emerald-50 p-6 text-emerald-900">
              <div className="flex items-start gap-3">
                <CheckCircle2
                  aria-hidden
                  className="mt-0.5 h-6 w-6 shrink-0"
                  strokeWidth={2}
                />
                <div className="space-y-1">
                  <p className="text-lg font-semibold">You&rsquo;re on the list.</p>
                  <p className="text-sm">
                    We&rsquo;ll email you on December 1, 2026 with the sign-in
                    link and a welcome guide. In the meantime, browse vendors
                    on the marketplace to see who&rsquo;s already on board.
                  </p>
                  <p className="pt-2">
                    <Link
                      href="/explore"
                      className="inline-flex items-center gap-1.5 font-semibold underline-offset-4 hover:underline"
                    >
                      Browse vendors
                      <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <form action={joinCoupleWaitlist} className="mt-10 space-y-5">
              <input type="hidden" name="source" value="waitlist_page" />

              {errorMessage ? (
                <p
                  role="alert"
                  className="rounded-md border border-rose-300/60 bg-rose-50 px-4 py-3 text-sm text-rose-900"
                >
                  {errorMessage}
                </p>
              ) : null}

              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-medium text-ink">
                  Your email <span className="text-terracotta">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="input-field"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="full_name" className="block text-sm font-medium text-ink">
                    Your name (optional)
                  </label>
                  <input
                    id="full_name"
                    name="full_name"
                    type="text"
                    maxLength={200}
                    autoComplete="name"
                    placeholder="Maria"
                    className="input-field"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="partner_name" className="block text-sm font-medium text-ink">
                    Partner&rsquo;s name (optional)
                  </label>
                  <input
                    id="partner_name"
                    name="partner_name"
                    type="text"
                    maxLength={200}
                    placeholder="Juan"
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="wedding_date" className="block text-sm font-medium text-ink">
                    Wedding date (optional)
                  </label>
                  <div className="relative">
                    <CalendarHeart
                      aria-hidden
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40"
                      strokeWidth={1.75}
                    />
                    <input
                      id="wedding_date"
                      name="wedding_date"
                      type="date"
                      min="2026-12-01"
                      className="input-field pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="location_city" className="block text-sm font-medium text-ink">
                    City (optional)
                  </label>
                  <input
                    id="location_city"
                    name="location_city"
                    type="text"
                    maxLength={100}
                    placeholder="Manila / Cebu / Davao …"
                    className="input-field"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
                <SubmitButton
                  className="button-primary inline-flex min-h-[48px] items-center justify-center gap-2 px-7 text-sm font-semibold sm:text-base"
                  pendingLabel="Adding you…"
                >
                  Join the waitlist
                  <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
                </SubmitButton>
                <p className="text-xs text-ink/55">
                  Single email on launch day. No marketing spam. Unsubscribe
                  anytime.
                </p>
              </div>
            </form>
          )}
        </div>
      </section>

      <section className="border-b border-ink/5 bg-ink/[0.02]">
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            What&rsquo;s already ready
          </p>
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
            Vendor? <Link href="/for-vendors" className="font-semibold text-terracotta underline-offset-4 hover:underline">Skip the waitlist — pre-register today</Link>.
          </p>
        </div>
      </section>

      <footer className="border-t border-ink/5">
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Logo />
            <p className="text-xs text-ink/55">
              © Setnayan · setnayan.com · Manila, Philippines
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
