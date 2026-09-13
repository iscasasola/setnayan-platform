/**
 * /pawebsite — public marketing landing page for the EVENT HUB, the editorial
 * event website (www.setnayan.com/pawebsite).
 *
 * ⚠ THE NAME AND THE ROUTE DIVERGE ON PURPOSE (owner 2026-08-15). The product
 * was renamed "Pawebsite" → "Event Hub"; the route stays `/pawebsite` because
 * it is sitemapped and indexed, and moving it would forfeit that search history
 * to rename a string no visitor reads. Live Studio already ships in exactly
 * this shape — named "Live Studio", served from `/panood`. Do NOT reconcile
 * them by moving the route.
 *
 * Part of the "Pa-" public-surface wave (owner-approved 2026-06-27; the Pa-
 * ROUTES stay locked, the display names do not). Mirrors /papic + /setnayan-ai
 * exactly: force-static
 * Server Component, static `metadata`, SoftwareApplication + FAQPage JSON-LD,
 * hero + benefit sections + FAQ + a Mulberry-accent primary CTA, and the shared
 * SiteFooter. The persistent SiteChrome nav renders because '/pawebsite' is
 * registered in NAV_ROUTES.
 *
 * POSITIONING (locked "Editorial human positioning"): the couple website is the
 * "front-page story of your life" — save-the-date, RSVP, the event page, and the
 * editorial story, all under one address. Sell the BENEFIT (one beautiful home
 * for your whole wedding) and quote NO price (admin-managed + provisional —
 * links to /pricing). Copy sells BENEFITS only (public-surface hygiene).
 */

import { DoorwayPage } from '@/app/_components/marketing/_doorway';
import { SpotlightSection, type Spotlight } from '@/app/_components/marketing/_spotlights';
import { studioDescription } from '@/lib/studio-apps';


const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

/*
 * 🔑 "Wedding Website" STAYS IN THE TITLE ON PURPOSE. It is the phrase couples
 * actually type into Google; "Event Hub" is the phrase they will only know
 * after they meet us. The brand leads, the search term follows it — the same
 * split every product page makes between what a thing is CALLED and what it IS.
 */
const PAGE_TITLE = 'Event Hub — Your Editorial Wedding Website · Setnayan';
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
const PAGE_DESCRIPTION = studioDescription('pawebsite');
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
  alternates: { canonical: '/pawebsite' },
  keywords: [
    'wedding website Philippines',
    'wedding website builder',
    'online wedding invitation',
    'wedding RSVP website',
    'save the date website',
    'editorial wedding website',
    'Setnayan Event Hub',
    'Setnayan',
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/pawebsite',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Event Hub — your editorial wedding website' }],
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
  name: 'Event Hub — Editorial Wedding Website',
  url: `${SITE_URL}/pawebsite`,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Any (web browser)',
  description: PAGE_DESCRIPTION,
  featureList: [
    'One home for your whole wedding — one address to share',
    'Save-the-date that announces the day beautifully',
    'RSVP your guests answer in seconds',
    'Event details: when, where, what to wear, how to get there',
    'Your love story, told like a magazine feature',
    'Looks designed, not templated — on every phone and laptop',
  ],
  areaServed: 'Philippines',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const FAQ = [
  {
    q: 'What’s on the website?',
    a: 'Everything your guests need in one place: your save-the-date, your RSVP, the event details — when, where, dress code, directions — and your love story, told like an editorial feature. One address you share once.',
  },
  {
    q: 'Do I need to design or code anything?',
    a: 'No. You fill in your details and the website composes itself into something that looks designed, not templated. It reads beautifully on any phone or laptop without you touching a single setting.',
  },
  {
    q: 'How does the RSVP work?',
    a: 'Your guests tap a button on the site and they’re counted — no forms to print, no replies to chase. You see who’s coming in real time, right alongside your guest list and seating.',
  },
  {
    q: 'What makes it “editorial”?',
    a: 'Most wedding sites are a form with a photo on top. Yours reads like the front-page story of your life — your story laid out with the care of a magazine feature, not a fill-in template.',
  },
  {
    q: 'Can it grow with everything else?',
    a: 'Yes. The same website is where your guest gallery, your live stream, and your day-of details live too — so one address carries your whole wedding, before, during, and after.',
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
    t: 'Tell your story once',
    d: 'Add your details and your story — how you met, your date, your venue, what to wear. No design work, no code; the website composes itself around you.',
  },
  {
    t: 'Share one address',
    d: 'Your save-the-date, RSVP, event details, and love story all live at one beautiful address. Send it once and your guests have everything they need.',
  },
  {
    t: 'Watch the replies roll in',
    d: 'Guests RSVP in a tap, and you see who’s coming in real time — right beside your guest list and seating, all in the same place.',
  },
];

const VS = [
  ['A separate site that expires', 'Your wedding’s permanent home'],
  ['A form with a photo on top', 'Your story, told like a feature'],
  ['Chase replies by message', 'Guests RSVP in a tap'],
  ['Five links for five things', 'One address for the whole day'],

] as const;

/*
 * ─── THE FEATURE SPOTLIGHTS (2026-09-05) ─────────────────────────────────
 * One idea · one picture · one sentence — the shape the owner approved for
 * `/papic` and asked for on every Studio page (`_components/marketing/
 * _spotlights.tsx`). Every sentence is traceable to copy already on this
 * page, the product record, or the demo scenes' captions. Left out on
 * purpose: the Custom QR scenes' "Upgrade" / "Default — free" tier labels
 * (a price path this page must not quote). The stills are frames of the
 * product's own demo scenes, captured by `scripts/capture-demo-stills.mjs`.
 */
const SPOTLIGHTS: readonly Spotlight[] = [
  {
    chip: 'One address',
    t: 'Everything your guests need, one link',
    d: 'Your save-the-date, RSVP, event details, and love story all live at one beautiful address. Send it once and your guests have everything they need.',
    media: { kind: 'still', src: '/add-ons/demo/stills/landing-page-0.jpg', alt: 'Event Hub — one page behind every link you share' },
  },
  {
    chip: 'No design work',
    t: 'Tell your story once, it composes itself',
    d: 'Add how you met, your date, your venue, what to wear. The website composes itself around you — no design work, no code.',
    media: { kind: 'still', src: '/add-ons/demo/stills/landing-page-1.jpg', alt: 'Event Hub — your colors and story, automatically' },
  },
  {
    chip: 'RSVP',
    t: 'Guests answer in a tap',
    d: 'Your guests tap a button on the site and they’re counted — no forms to print, no replies to chase. You see who’s coming in real time, right beside your guest list and seating.',
    media: { kind: 'still', src: '/add-ons/demo/stills/landing-page-2.jpg', alt: 'Event Hub — guests RSVP and reserve their place' },
  },
  {
    chip: 'Save the date',
    t: 'Your news arrives, beautifully sealed',
    d: 'Guests swipe the wax seal to open it, watch your story play like a little film, and put the day on their calendar in one tap.',
    media: { kind: 'still', src: '/add-ons/demo/stills/save-the-date-0.jpg', alt: 'Save the date — your news arrives, beautifully sealed' },
  },
  {
    chip: 'Editorial',
    t: 'Your story, told like a feature',
    d: 'Most wedding sites are a form with a photo on top. Yours reads like the front-page story of your life, laid out with the care of a magazine feature.',
    media: { kind: 'photo', src: '/demo/maria-jose/hero.webp', alt: 'A bride and groom forehead to forehead on a hillside terrace at golden hour' },
  },
  {
    chip: 'Permanent home',
    t: 'One address, before, during, and after',
    d: 'After the day, the same address is where your guest gallery, your live stream, and your day-of details live too. Not a separate site that expires — your wedding’s permanent home.',
    media: { kind: 'still', src: '/add-ons/demo/stills/landing-page-3.jpg', alt: 'Event Hub — after the day, it becomes your story' },
  },
];

export default function PawebsiteLandingPage() {
  return (
    <DoorwayPage
      title={'One beautiful home for your whole wedding.'}
      primary={{ href: '/onboarding/wedding?from=pawebsite', label: 'Start planning · free' }}
      secondary={{ href: '/pricing', label: 'See pricing' }}
      productName="Event Hub"
      studioKey="pawebsite"
      steps={STEPS}
      differentiator={{
        heading: 'Not just a wedding form',
        lede: 'Most wedding sites are a date and a button. Yours reads like the front-page story of your life.',
        rows: VS,
      }}
      faq={FAQ}
      closing={{
        heading: 'Give your wedding its home',
        body: 'Your Event Hub lives inside your free Setnayan wedding — alongside your guest list, RSVP, seating, and gallery. Start planning free, and make it yours.',
        href: '/onboarding/wedding?from=pawebsite',
        label: 'Start planning · free',
      }}
      structuredData={[APP_LD, FAQ_LD]}
    >
      <SpotlightSection
        productName="Event Hub"
        heading="One address, and everything behind it"
        lede="What the one link you share actually carries — and what it becomes once the day is over."
        items={SPOTLIGHTS}
      />
    </DoorwayPage>
  );
}
