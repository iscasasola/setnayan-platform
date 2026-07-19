/**
 * /creators — "Everywhere else, they watch. Here, they book."
 *
 * The public marketing page for Setnayan STORYTELLERS (owner-ratified word,
 * 2026-07-16): any Setnayan user who publishes real events as public
 * "Chapters" on their own page (setnayan.com/u/[slug]). Mirrors the /vendors
 * marketing-page structure (photographic hero → dark thesis strip → narrative
 * sections → dark signature → CTA) and its Clean Editorial --m-* vocabulary —
 * no new design system.
 *
 * Narrative flow (top→bottom):
 *   photographic hero → thesis strip (₱0 · yours · courted) → the wedge (a
 *   reel dead-ends; a Chapter carries the bookable event) → anatomy of a
 *   Chapter (dark signature: embed + shop-this-event vendor cards + audience
 *   layer) → why storytellers publish here → who it's for → the one-breath
 *   band (owner-ratified copy) → CTA "Publish your story" → /signup.
 *
 * COPY DISCIPLINE — everything pitched here is SHIPPED: public Chapters on
 * /u/[slug] (lib/creator-public.ts), embeds from YouTube / TikTok / Instagram
 * only (lib/creator-chapters.ts EMBED_PROVIDERS — Setnayan never hosts the
 * edit), shoppable vendor cards (substrate vendor_ids), followers + view
 * counts (lib/creator-audience.ts), the Storyteller badge
 * (app/_components/creator-badge.tsx), Real Stories featuring, and token-gated
 * vendor→storyteller discount offers (lib/creator-offers.ts). NOT promised
 * (not live): audience promos on the Book button, tier names, per-booking
 * earnings, cash of any kind.
 *
 * Fully static — no DB reads, no prices (storytellers are free, forever), so
 * no force-dynamic. The persistent glass nav + footer are global site-chrome
 * (SiteChrome — '/creators' is registered in its NAV_ROUTES) — this page
 * renders neither.
 */

import type { Metadata } from 'next';
import { CreatorStoryHero } from './_components/creator-story-hero';
import {
  CreatorStoryThesis,
  CreatorStoryWedge,
  CreatorStoryChapter,
  CreatorStoryWhy,
  CreatorStoryWho,
  CreatorStoryOneBreath,
  CreatorStoryCTA,
  CreatorStoryStyles,
} from './_components/creator-story-sections';
import { RevealOnView } from './_components/creators-motion';

const TITLE = 'Setnayan for Storytellers · Publish your events as bookable Chapters — free';
const DESCRIPTION =
  'Everywhere else, they watch. Here, they book. Publish your real events as public Chapters on your own page — your edit embedded from your channel, the real vendors behind it shoppable. Free forever; you keep your own monetization, and vendors who like your audience send you exclusive discount offers.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/creators' },
  openGraph: {
    title: TITLE,
    description:
      'Publish your real events as Chapters — your edit embedded, the vendors shoppable. Free forever · your channel keeps its monetization · vendors court you with exclusive rates.',
    url: '/creators',
    type: 'website',
    siteName: 'Setnayan',
    images: [
      {
        url: '/brand/og-card.webp',
        width: 1200,
        height: 630,
        alt: "Setnayan · Set na 'yan. · Storytellers publish real events as bookable Chapters — free",
        type: 'image/webp',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description:
      'Everywhere else, they watch. Here, they book. Chapters are free for storytellers, forever — and your edit stays earning on your own channel.',
    images: ['/brand/og-card.webp'],
  },
};

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(
  /\/$/,
  '',
);

// Schema.org — a WebPage + breadcrumb only. Deliberately NO Offer nodes:
// storytellers are free, forever, and there is no SKU to structure.
const creatorsJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Setnayan',
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/icon-512.svg`,
      areaServed: { '@type': 'Country', name: 'Philippines' },
    },
    {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/creators#webpage`,
      url: `${SITE_URL}/creators`,
      name: TITLE,
      description: DESCRIPTION,
      isPartOf: { '@id': `${SITE_URL}/#website` },
      about: { '@id': `${SITE_URL}/#organization` },
      audience: {
        '@type': 'Audience',
        audienceType:
          'Wedding, travel and event content creators in the Philippines',
        geographicArea: { '@type': 'Country', name: 'Philippines' },
      },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${SITE_URL}/creators#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'For Storytellers',
          item: `${SITE_URL}/creators`,
        },
      ],
    },
  ],
};

export default function ForCreatorsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(creatorsJsonLd) }}
      />
      <main className="m-surface min-h-dvh">
        <CreatorStoryHero />
        <CreatorStoryThesis />
        <RevealOnView>
          <CreatorStoryWedge />
        </RevealOnView>
        <CreatorStoryChapter />
        <RevealOnView>
          <CreatorStoryWhy />
        </RevealOnView>
        <RevealOnView>
          <CreatorStoryWho />
        </RevealOnView>
        <CreatorStoryOneBreath />
        <CreatorStoryCTA />
        <CreatorStoryStyles />
      </main>
    </>
  );
}
