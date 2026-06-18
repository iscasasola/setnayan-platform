/**
 * /monogram — the FREE, no-login Vector Monogram Studio on www.setnayan.com.
 *
 * Owner 2026-06-19: "build this to www.setnayan.com" — a public version of the
 * couple-facing studio (which lives, auth-gated, at /dashboard/[eventId]/
 * monogram). A public visitor has no wedding to save into, so this is a free
 * design-and-download lead magnet: anyone can craft a real vector monogram,
 * download it (SVG + transparent PNG), and is invited to "start planning free"
 * so it becomes their wedding's mark everywhere. The static/vector mark is free
 * by the standing "the free monogram stays free" lock; the paid layer (the
 * Animated Monogram reveal + distribution) lives downstream in the app.
 *
 * Server component (statically rendered). The editor itself is a client-only
 * component (paper.js/opentype.js load after a dynamic import), so this page's
 * server render never touches them. The persistent SiteChrome nav renders
 * because '/monogram' is in NAV_ROUTES; per the locked 6-page IA it is NOT a
 * top-nav link — it surfaces as a contextual CTA + footer link.
 */

import Link from 'next/link';
import { SiteFooter } from '@/app/features/_sections/_SiteFooter';
import { PublicMonogramStudio } from './public-monogram-studio';

export const dynamic = 'force-static';
export const revalidate = 3600;

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = 'Free Monogram Maker · Setnayan';
const PAGE_DESCRIPTION =
  'Design your own wedding monogram, free — no sign-up. Combine your initials in real typefaces, weave and frame them your way, and download it as a crisp vector (SVG) or a transparent PNG. Then make it your wedding’s mark everywhere with Setnayan.';
// Use the neutral site-wide brand card (the /our-story manifesto card is
// off-topic for a tool page); a monogram-specific OG render is a nice follow-up.
const OG_IMAGE = `${SITE_URL}/brand/og-card.webp`;

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/monogram' },
  keywords: [
    'free monogram maker',
    'wedding monogram maker',
    'monogram generator',
    'wedding monogram Philippines',
    'custom monogram free',
    'monogram SVG download',
    'Setnayan',
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/monogram',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Setnayan free monogram maker' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

// WebApplication JSON-LD — a free interactive tool. Publisher references the
// site-wide Organization (@id defined in app/layout.tsx); no duplicate org.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Setnayan Free Monogram Maker',
  url: `${SITE_URL}/monogram`,
  applicationCategory: 'DesignApplication',
  operatingSystem: 'Any (web browser)',
  description: PAGE_DESCRIPTION,
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'PHP' },
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const STEPS = [
  { t: 'Combine your initials', d: 'Two letters in eight wedding typefaces — drag, resize, twist, and weave or merge where they cross.' },
  { t: 'Frame & finish', d: 'A mirrored fountain-pen frame, ornaments, your own colours, and an outline that never distorts the letterforms.' },
  { t: 'Download it free', d: 'Export a crisp vector SVG or a transparent PNG that stays sharp at any size — from a ring engraving to a stage backdrop.' },
];

export default function PublicMonogramPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <main className="mx-auto w-full max-w-5xl px-5 pb-20 pt-10 sm:pt-14">
        <header className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#8C6932]">Free · no sign-up</p>
          <h1 className="mt-3 font-serif text-4xl leading-tight tracking-tight text-[#1E2229] sm:text-5xl">
            Make your wedding monogram
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-[#5F5E5A] sm:text-lg">
            Two initials, your way — real vector outlines you can interlock, frame, and colour. Design it here for
            free and download it crisp. No account needed.
          </p>
        </header>

        <section className="mt-9" aria-label="Monogram studio">
          <PublicMonogramStudio />
        </section>

        <section className="mx-auto mt-16 max-w-3xl">
          <ol className="grid gap-6 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.t} className="rounded-2xl border border-[#1E2229]/10 bg-white/60 p-5">
                <span className="font-mono text-xs text-[#8C6932]">{String(i + 1).padStart(2, '0')}</span>
                <h2 className="mt-2 font-serif text-lg text-[#1E2229]">{s.t}</h2>
                <p className="mt-1.5 text-sm text-[#5F5E5A]">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto mt-14 max-w-2xl rounded-3xl border border-[#C5A059]/40 bg-[#FBF6EA] px-6 py-10 text-center">
          <h2 className="font-serif text-2xl text-[#1E2229] sm:text-3xl">Make it official</h2>
          <p className="mx-auto mt-3 max-w-lg text-base text-[#5F5E5A]">
            Couples on Setnayan don&rsquo;t just download their monogram — it becomes their wedding&rsquo;s signature
            across their website, QR invitations, save-the-date, and signage, and can come alive as an animated reveal.
            Planning is free to start.
          </p>
          <Link
            href="/onboarding/wedding?from=monogram"
            className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#5C2542] px-7 py-3 text-sm font-semibold text-[#FBFBFA] transition-opacity hover:opacity-90"
          >
            Start planning · free
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
