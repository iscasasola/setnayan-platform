/**
 * /patiktok — public marketing landing page for Patiktok, the short-form
 * highlight reels from the wedding day (www.setnayan.com/patiktok).
 *
 * Part of the "Pa-" public-surface wave (owner-approved 2026-06-27; Pa- naming
 * LOCKED). Mirrors the /papic + /setnayan-ai pattern exactly: force-static
 * Server Component, static `metadata`, SoftwareApplication + FAQPage JSON-LD,
 * hero + benefit sections + FAQ + a Mulberry-accent primary CTA, and the shared
 * SiteFooter. The persistent SiteChrome nav renders because '/patiktok' is
 * registered in NAV_ROUTES.
 *
 * POSITIONING: short, vertical highlight reels of your day, ready to share —
 * the moments that travel, made the moment they happen. Music is Setnayan-owned
 * (never named, never implied to be major-label). Sell the BENEFIT (shareable
 * reels, no editing) and quote NO price (admin-managed + provisional — links to
 * /pricing). Copy sells BENEFITS only (public-surface hygiene).
 */

import { DoorwayPage } from '@/app/_components/marketing/_doorway';
import { studioDescription } from '@/lib/studio-apps';

/*
  🔴 force-dynamic IS LOAD-BEARING, NOT A PREFERENCE.
  This page mounts the shared shell, which reads the session. Under
  `dynamic = 'force-static'` — what this file used to declare — Next 15.5.21
  returns an EMPTY cookie jar from `cookies()` and does NOT throw and does NOT
  bail out of static generation (`next/dist/server/request/cookies.js`, the
  forceStatic branch sits BEFORE both). The page would have built green, stayed
  edge-cached, and served a PERMANENTLY SIGNED-OUT rail for an hour at a time to
  people who are signed in. Nothing thrown, nothing logged: the only symptom is
  an absence.
  ⚠ A LAYOUT CANNOT SET THIS FOR US — `create-component-tree.js` resolves
  `dynamic` nested-most-wins, and the children traversal completes before a
  parent layout's component is created. It is seven separate edits and missing
  one is invisible, which is why `doorway-shell.test.ts` counts them.
*/
export const dynamic = 'force-dynamic';

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = 'Patiktok — Short-Form Highlight Reels From Your Day · Setnayan';
/*
 * 🔑 THE DESCRIPTION IS NOT AUTHORED HERE ANY MORE — it is read from
 * `lib/studio-apps.ts`, the ONE place the seven Studio products are
 * described, so this page's search result and the rail's row for it can
 * never disagree about what the product does. The string itself is
 * UNCHANGED (moved verbatim); rewording it would have quietly rewritten a
 * live, indexed search result.
 * ⚠ Do not re-inline it. Two hand-typed strings that must agree is not a
 * mechanism, it is a future drift.
 */
const PAGE_DESCRIPTION = studioDescription('patiktok');
const OG_IMAGE = `${SITE_URL}/brand/og-card.webp`;

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/patiktok' },
  keywords: [
    'wedding highlight reel',
    'short wedding video',
    'vertical wedding reel',
    'wedding video for social',
    'wedding reel maker Philippines',
    'shareable wedding video',
    'Patiktok',
    'Setnayan',
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/patiktok',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Patiktok — short-form highlight reels from your day' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

// SoftwareApplication JSON-LD — no price (admin-managed + provisional);
// publisher references the site-wide Organization.
const APP_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Patiktok — Short-Form Wedding Reels',
  url: `${SITE_URL}/patiktok`,
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Any (web browser)',
  description: PAGE_DESCRIPTION,
  featureList: [
    'Turns your wedding moments into short, vertical reels',
    'Set to music, ready to share — no editing skills needed',
    'The moments that travel, made the moment they happen',
    'Pick your favourite beats and a reel composes itself',
    'Perfect for sharing the day with everyone, fast',
    'Lives alongside your gallery and Event Hub',
  ],
  areaServed: 'Philippines',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const FAQ = [
  {
    q: 'What is a Patiktok reel?',
    a: 'A short, vertical highlight video of your day — the entrance, the first dance, the toast — set to music and ready to share. The kind of clip made to fly around your group chats the same night.',
  },
  {
    q: 'Do I need to edit anything?',
    a: 'No. You pick the moments you love and a polished reel composes itself, music and all. No timeline, no editing app, no skills required.',
  },
  {
    q: 'Where do the clips come from?',
    a: 'From your wedding — the photos and short clips captured on the day. Patiktok pulls your favourite moments together into something shareable, right inside Setnayan.',
  },
  {
    q: 'What about the music?',
    a: 'Every reel is set to music that’s cleared for sharing, so you can post it anywhere without worry — no surprise takedowns, no licensing headaches.',
  },
  {
    q: 'Does this replace our wedding film?',
    a: 'No. Your videographer still makes the keepsake film. Patiktok is the fast, shareable version — the highlights that go out the same night while the big film takes its time.',
  },
];

const FAQ_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

const STEPS = [
  {
    t: 'The day gets captured',
    d: 'Photos and short clips from your wedding gather inside Setnayan — the entrance, the dance floor, the toast, the laughter.',
  },
  {
    t: 'Pick your moments',
    d: 'Choose the beats you love most. A short, vertical reel composes itself around them, set to music — no editing, no timeline, no skills needed.',
  },
  {
    t: 'Share it the same night',
    d: 'Out it goes — to the group chat, to your stories, to everyone who wants to relive the day. The highlights travel while the big film takes its time.',
  },
];

const VS = [
  ['Wait weeks for the final film', 'Highlights ready the same night'],
  ['Edit it yourself in an app', 'A reel composes itself'],
  ['Music you can’t safely post', 'Set to music cleared to share'],
  ['One long video few rewatch', 'Short reels made to fly around'],

] as const;

export default function PatiktokLandingPage() {
  return (
    <DoorwayPage
      kicker="In your wedding · highlight reels"
      title={'The moments that travel, ready the same night.'}
      lede={'Patiktok turns your wedding moments into short, vertical highlight reels — set to music, ready to share, no editing required. The entrance, the first dance, the toast: made the moment they happen.'}
      primary={{ href: '/onboarding/wedding?from=patiktok', label: 'Start planning · free' }}
      secondary={{ href: '/pricing', label: 'See pricing' }}
      productName="Patiktok"
      steps={STEPS}
      differentiator={{ heading: 'Made to be shared', lede: 'The keepsake film is for keeping. Patiktok is for sharing — fast, vertical, and ready the same night.', rows: VS }}
      faq={FAQ}
      closing={{ heading: 'Share the day, the day it happens', body: 'Patiktok lives inside your free Setnayan wedding — alongside your gallery, website, and guest list. Start planning free, and add your highlight reels when you’re ready.', href: '/onboarding/wedding?from=patiktok', label: 'Start planning · free' }}
      structuredData={[APP_LD, FAQ_LD]}
    />
  );
}
