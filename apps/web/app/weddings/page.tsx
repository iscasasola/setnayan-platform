import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteHeader } from '@/app/_components/site-header';

// /weddings — public showcase index (iteration 0046, post-rename to
// "Wedding Showcase Index" per CLAUDE.md decision-log row 426, 2026-05-19).
//
// V1 cutover lands Dec 1, 2026 alongside couple-launch. Until then the route
// is reserved as a public landing surface so that:
//   - the Browse → Weddings nav entry resolves (no 404 in production)
//   - early SEO crawlers index a real page with intent-aligned copy
//   - the URL is committed before any real wedding edits its consent state
//
// Empty-state copy follows the "no dev text post-launch" memory rule — polite
// brand voice, never engineering jargon ("skeleton placeholder", "wire in",
// "coming soon stub"). Canonical model from the memory file is the
// "This vendor still has no review." pattern: a single, complete sentence
// that reads as production copy.

// GEO Phase G5 (2026-05-28) — canonical URL + keywords added. Page is
// pre-launch ("open December 1, 2026") so the description honestly states
// status. AI engines can extract that timing for "when do real weddings
// publish on Setnayan" queries.
export const metadata: Metadata = {
  title: 'Real weddings · Setnayan',
  description:
    'Real Filipino weddings curated by the couples who lived them. Browse by ceremony type, venue, theme, and budget. Editorials open December 1, 2026 with explicit couple consent per RA 10173.',
  alternates: { canonical: '/weddings' },
  keywords: [
    'real Filipino weddings',
    'Philippines wedding inspiration',
    'Setnayan real weddings',
    'Filipino wedding photos',
    'wedding editorial Philippines',
    'Filipino wedding stories',
  ],
  openGraph: {
    title: 'Real weddings · Setnayan',
    description:
      'Real Filipino weddings curated by the couples who lived them. Editorials open December 1, 2026.',
    url: '/weddings',
  },
};

// Static — no dynamic data sources yet. Phase B (Dec 1, 2026 cutover) wires
// this route to the event_editorials index + faceted browse.
export const dynamic = 'force-static';
export const revalidate = false;

export default function WeddingsIndexPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex min-h-[60dvh] w-full max-w-3xl flex-col items-center justify-center gap-6 px-6 py-20 text-center sm:py-28">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          Real weddings · Coming December&nbsp;1,&nbsp;2026
        </p>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Real Filipino weddings, told by the couples who lived them.
        </h1>
        <p className="text-balance text-base text-ink/70 sm:text-lg">
          Setnayan&rsquo;s first weddings appear here as couples celebrate &mdash; with their
          stories, their photos, their vendor team, and the way the day actually
          unfolded. Browse by ceremony, venue, theme, and budget once the first
          editorials publish.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/vendors"
            className="button-primary inline-flex h-11 items-center justify-center px-6 text-sm font-semibold"
          >
            Browse vendors in the meantime
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-11 items-center justify-center rounded-md border border-ink/15 px-6 text-sm font-medium text-ink hover:bg-ink/5"
          >
            Create an account
          </Link>
        </div>
      </main>
    </>
  );
}
