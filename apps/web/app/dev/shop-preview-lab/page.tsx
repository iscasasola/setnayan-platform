/**
 * /dev/shop-preview-lab — the team banner a shop's owner and helpers see on their own page before couples can
 * (lib/own-shop-preview.ts, owner 23 Oct 2026), with no sign-in and no database. DEV-ONLY: production builds 404
 * this route first thing. It draws the REAL `TeamPreviewBanner` under the shop page's own header, and the REAL
 * bare-root not-found a stranger gets instead.
 *
 *   ?reason=documents|in_review|listing|demo   which banner (default: demo — SetnaProd's state)
 *   ?view=stranger                             the not-found page a stranger gets for the same address
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Wordmark } from '@/app/_components/brand-marks';
import { TeamPreviewBanner } from '@/app/v/[slug]/_components/team-preview-banner';
import SlugNotFound from '@/app/[slug]/not-found';
import { TEAM_PREVIEW_COPY, type ShopPreviewReason } from '@/lib/own-shop-preview';

export default async function ShopPreviewLabPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; view?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  if (sp.view === 'stranger') return <SlugNotFound />;
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
          </div>
        </div>
        <div className="mt-8 h-48 rounded-2xl bg-ink/[0.06]" />
      </article>
    </main>
  );
}
