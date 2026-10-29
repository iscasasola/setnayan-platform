/**
 * /dev/shop-page-lab — the public shop page's (`/v/[slug]`) identity block on fixture data, for the supplier website
 * by plan (owner-approved 2026-10-30, `prototypes/build-contracts-2026-10-30/supplier-website-by-plan/`). No sign-in,
 * no database. DEV-ONLY: production builds 404 this route first thing. It mounts the REAL pieces the page renders —
 * `ShopSinceLine` (and its events-by-kind sheet), `CheckADateLink`, `ShareButton`, `ShopBadgePill` — inside the page's
 * own markup, so what it shows is what ships. The Inquire link is the page's own anchor, which goes nowhere here.
 *
 *   ?exp=verified|self|none     "In business since 2019" ✓ DTI · self-reported · never said
 *   ?events=full|declared|none  receipt-backed rows by kind + the shop's own wedding count · the own count only · nothing
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, MessageCircle, Send } from 'lucide-react';
import { Wordmark } from '@/app/_components/brand-marks';
import { ShopBadgePill } from '@/app/_components/shop-badge-pill';
import { ShareButton } from '@/app/v/[slug]/_components/share-button';
import { ShopSinceLine } from '@/app/v/[slug]/_components/shop-since-line';
import { CheckADateLink } from '@/app/v/[slug]/_components/check-a-date-link';
import { shopBadges, verifiedBadge } from '@/lib/shop-badges';
import { eventsByKind } from '@/lib/shop-events-by-kind';
import { onSetnayanSinceLine } from '@/lib/in-business-since';
import { formatEventTypeLabel } from '@/lib/reviews';

const NAME = 'Sampaguita Table';
const LABELS: Record<string, string> = { wedding: 'Wedding', debut: 'Debut', corporate: 'Corporate event', birthday: 'Birthday' };

export default async function ShopPageLabPage({
  searchParams,
}: {
  searchParams: Promise<{ exp?: string; events?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const exp = sp.exp === 'self' || sp.exp === 'none' ? sp.exp : 'verified';
  const ev = sp.events === 'declared' || sp.events === 'none' ? sp.events : 'full';

  const completed =
    ev === 'full'
      ? ['wedding', 'debut', 'debut', 'corporate'].map((event_type) => ({ event_type }))
      : [];
  const events = eventsByKind({
    completed,
    completedCapped: false,
    declaredWeddings: ev === 'none' ? null : 84,
    labelFor: (k) => LABELS[k] ?? formatEventTypeLabel(k || null),
  });
  const pills = shopBadges({
    verified: false,
    completedEvents: completed.length,
    trusted: { trusted_avg_rating: 4.5, trusted_review_count: 2 },
    inBusinessSinceYear: null,
    awards: [],
    nowYear: 2026,
  });

  return (
    <main className="min-h-dvh bg-cream">
      <header className="border-b border-ink/5">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center text-ink">
            <Wordmark size={22} />
          </Link>
          <span className="hidden text-sm font-medium text-ink/70 sm:inline">Plan with Setnayan</span>
        </div>
      </header>
      <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <section className="flex flex-col items-start gap-6 border-b border-ink/10 pb-8 sm:flex-row">
          <span className="inline-flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-terracotta/15 text-xl font-semibold text-terracotta-700">
            ST
          </span>
          <div className="min-w-0 space-y-2">
            <h1 className="font-serif text-4xl font-normal italic tracking-[-0.02em] text-ink sm:text-5xl">{NAME}</h1>
            <p className="text-base text-ink/70">Filipino feasts, plated or family-style</p>
            <ShopBadgePill badge={verifiedBadge()} className="w-fit" />
            {pills.map((b) => (
              <ShopBadgePill key={b.key} badge={b} className="w-fit" />
            ))}
            <ShopSinceLine
              sinceYear={exp === 'none' ? null : 2019}
              sinceVerified={exp === 'verified'}
              events={events}
              onSetnayanSince={onSetnayanSinceLine('2026-10-02T03:00:00Z')}
              shopName={NAME}
            />
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink/60">
              <span className="inline-flex items-center gap-1">
                <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Tagaytay
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Replies in your Setnayan inbox
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-4">
              <a href="#get-in-touch" className="button-primary inline-flex items-center gap-2">
                <Send className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                Inquire
              </a>
              <ShareButton title={NAME} className="button-secondary inline-flex items-center gap-2" />
              <CheckADateLink slug="sampaguita-table" className="button-secondary inline-flex items-center gap-2" />
            </div>
          </div>
        </section>
      </article>
    </main>
  );
}
