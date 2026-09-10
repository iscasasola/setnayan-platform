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
import { SpotlightSection, type Spotlight } from '@/app/_components/marketing/_spotlights';
import { studioDescription } from '@/lib/studio-apps';


const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = 'Patiktok — Short-Form Highlight Reels From Your Day · Setnayan';
/** The document title ONLY. `metadata.title` is rendered through the root
 *  layout's `template: '%s · Setnayan'`, so a PAGE_TITLE that already ends in
 *  the brand came out as "… · Setnayan · Setnayan" on 11 live pages. The share
 *  cards and the structured-data name do NOT go through that template and are
 *  correct WITH the brand — which is why this strips it here and nowhere else. */
const DOC_TITLE = PAGE_TITLE.replace(/ · Setnayan$/, '');
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

/*
  ⚠ `dynamic` IS DECLARED ONCE, ON `app/(shell)/layout.tsx`, NOT HERE.
  The shared shell reads the session, so every route in this group must be
  dynamic — and a layout's `dynamic` DOES cover its children (measured: with
  the pages declaring nothing, `force-dynamic` on the group layout alone moved
  them from `○ Static` to `ƒ Dynamic` in the build table). This file used to
  carry its own copy, along with a docblock asserting a layout could not do
  this. That assertion was false. Twenty copies of one rule is twenty places
  for it to disagree with itself — do not re-add it here.
*/

export const metadata = {
  title: DOC_TITLE,
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

/*
 * ─── THE FEATURE SPOTLIGHTS (2026-09-05) ─────────────────────────────────
 * One idea · one picture · one sentence — the shape the owner approved for
 * `/papic` and asked for on every Studio page (`_components/marketing/
 * _spotlights.tsx`). Every sentence is traceable to copy already on this
 * page, the product record, or the demo scenes' captions. Left out on
 * purpose: the scenes' "15s" slider and "68%" progress figures (no number on
 * this page is hand-written), the template's name and its filter chips (a
 * catalogue the page never promises), and any named song or genre (music is
 * Setnayan-owned and never named). The stills are frames of the product's
 * own demo scenes, captured by `scripts/capture-demo-stills.mjs`.
 */
const SPOTLIGHTS: readonly Spotlight[] = [
  {
    chip: 'Your moments',
    t: 'Choose the beats you love most',
    d: 'The entrance, the first dance, the toast — you pick the moments, and a short, vertical reel composes itself around them, set to music.',
    media: { kind: 'photo', src: '/demo/maria-jose/firstdance.webp', alt: 'A couple mid first dance under the lights' },
  },
  {
    chip: 'Your look',
    t: 'Tap a style to choose it',
    d: 'Pick a vertical look you love — every reel comes out short and upright, the shape made to fly around your group chats.',
    media: { kind: 'still', src: '/add-ons/demo/stills/patiktok-0.jpg', alt: 'Patiktok — pick a vertical look you love' },
  },
  {
    chip: 'Music',
    t: 'Set the length and the song',
    d: 'Slide the length and pick a track, or let the template pick one for you. Every reel is set to music that’s cleared for sharing, so you can post it anywhere without worry.',
    media: { kind: 'still', src: '/add-ons/demo/stills/patiktok-1.jpg', alt: 'Patiktok — set the length and the song' },
  },
  {
    chip: 'No editing',
    t: 'Watch it come together right here',
    d: 'Tap Render and keep the tab open — the reel builds in your browser, no server, no wait queue. No timeline, no editing app, no skills required.',
    media: { kind: 'still', src: '/add-ons/demo/stills/patiktok-2.jpg', alt: 'Patiktok — watch it come together right here' },
  },
  {
    chip: 'Same night',
    t: 'Share it the day it happens',
    d: 'Download the reel and post it to your stories, the group chat, everyone who wants to relive the day. It’s saved to your event gallery too, alongside everything else from your wedding.',
    media: { kind: 'still', src: '/add-ons/demo/stills/patiktok-3.jpg', alt: 'Patiktok — your reel, ready to share' },
  },
  {
    chip: 'Not the film',
    t: 'The big film still takes its time',
    d: 'Your videographer still makes the keepsake film. Patiktok is the fast, shareable version — the highlights that go out the same night while the big film is on its way.',
    media: { kind: 'photo', src: '/demo/maria-jose/ceremony.webp', alt: 'A wedding ceremony in progress' },
  },
];

export default function PatiktokLandingPage() {
  return (
    <DoorwayPage
      title={'The moments that travel, ready the same night.'}
      primary={{ href: '/onboarding/wedding?from=patiktok', label: 'Start planning · free' }}
      secondary={{ href: '/pricing', label: 'See pricing' }}
      productName="Patiktok"
      studioKey="patiktok"
      steps={STEPS}
      differentiator={{ heading: 'Made to be shared', lede: 'The keepsake film is for keeping. Patiktok is for sharing — fast, vertical, and ready the same night.', rows: VS }}
      faq={FAQ}
      closing={{ heading: 'Share the day, the day it happens', body: 'Patiktok lives inside your free Setnayan wedding — alongside your gallery, website, and guest list. Start planning free, and add your highlight reels when you’re ready.', href: '/onboarding/wedding?from=patiktok', label: 'Start planning · free' }}
      structuredData={[APP_LD, FAQ_LD]}
    >
      <SpotlightSection
        productName="Patiktok"
        heading="From the moment to the group chat"
        lede="You choose the moments and the song. The reel composes itself."
        items={SPOTLIGHTS}
      />
    </DoorwayPage>
  );
}
