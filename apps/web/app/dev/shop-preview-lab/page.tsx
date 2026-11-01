/**
 * /dev/shop-preview-lab — the team banner a shop's owner and helpers see on their own page before couples can
 * (lib/own-shop-preview.ts, owner 23 Oct 2026), with no sign-in and no database. DEV-ONLY: production builds 404
 * this route first thing. It draws the REAL `TeamPreviewBanner` under the shop page's own header, and the REAL
 * bare-root not-found a stranger gets instead.
 *
 *   ?reason=documents|in_review|listing|demo   which banner (default: demo — SetnaProd's state)
 *   ?view=stranger                             the not-found page a stranger gets for the same address
 *   ?view=inspiration                          🔗🖼 Services (each card's looks strip) + the Inspiration section (2026-10-30)
 *   ?events=N                                  the shop's badge pills under its name, as the page draws them
 *                                              (`lib/shop-badges.ts`: Verified · the step N reached · ★ 4.8 from 31)
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Wordmark } from '@/app/_components/brand-marks';
import { TeamPreviewBanner } from '@/app/v/[slug]/_components/team-preview-banner';
import SlugNotFound from '@/app/[slug]/not-found';
import { TEAM_PREVIEW_COPY, type ShopPreviewReason } from '@/lib/own-shop-preview';
import { ShopBadgePill } from '@/app/_components/shop-badge-pill';
import { shopBadges } from '@/lib/shop-badges';
import { ServicesGallery } from '@/app/v/[slug]/_components/services-gallery';
import { ShopInspirationSection } from '@/app/v/[slug]/_components/shop-inspiration-section';
import { LAB_INSPIRATION_CARDS, LAB_INSPIRATION_TILES } from './inspiration-lab-fixture';

export default async function ShopPreviewLabPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; view?: string; events?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  if (sp.view === 'stranger') return <SlugNotFound />;
  if (sp.view === 'inspiration') {
    /* 🔗🖼 The shop page's Services (each card with its looks strip) + the Inspiration section, on lab data — the REAL
       components the page mounts (owner 2026-10-30, "connected four ways"). */
    return (
      <main className="min-h-dvh bg-cream" data-lab-inspiration="">
        <article className="mx-auto w-full max-w-3xl px-4 sm:px-6">
          <section className="space-y-6 border-b border-ink/10 py-8">
            <header className="space-y-1">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Services &amp; pricing</h2>
              <p className="text-sm text-ink/65">Starting prices set by Bloom &amp; Co. Final quotes happen in chat.</p>
            </header>
            <ServicesGallery groups={[{ key: 'florist', label: 'Flowers & styling', cards: LAB_INSPIRATION_CARDS }]} />
          </section>
          <ShopInspirationSection tiles={LAB_INSPIRATION_TILES} shopName="Bloom & Co." />
        </article>
      </main>
    );
  }
  const reason: ShopPreviewReason =
    sp.reason && sp.reason in TEAM_PREVIEW_COPY ? (sp.reason as ShopPreviewReason) : 'demo';

  return (
    <main className="min-h-dvh bg-cream">
      <header className="border-b border-ink/5">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center text-ink">
            <Wordmark size={22} />
          </Link>
        </div>
      </header>
      <TeamPreviewBanner reason={reason} />
      {/* Stand-in for the shop's own page under the band — the band is the change, not this. */}
      <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <div className="flex items-center gap-4">
          <span className="inline-flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-terracotta/15 text-xl font-semibold text-terracotta-700">
            SP
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">SetnaProd</h1>
            <p className="mt-1 text-sm text-ink/60">Pabati · Metro Manila</p>
            {sp.events !== undefined ? (
              <div className="mt-2 flex flex-wrap gap-2" data-lab-shop-pills="">
                {shopBadges({
                  verified: true,
                  completedEvents: Number(sp.events) || 0,
                  trusted: { trusted_avg_rating: 4.8, trusted_review_count: 31 },
                  inBusinessSinceYear: null,
                  awards: [],
                  nowYear: 2026,
                }).map((b) => (
                  <ShopBadgePill key={b.key} badge={b} className="w-fit" />
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-8 h-48 rounded-2xl bg-ink/[0.06]" />
      </article>
    </main>
  );
}
