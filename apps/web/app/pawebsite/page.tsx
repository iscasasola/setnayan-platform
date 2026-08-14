/**
 * /pawebsite — public marketing landing page for Pawebsite, the editorial
 * wedding website (www.setnayan.com/pawebsite).
 *
 * Part of the "Pa-" public-surface wave (owner-approved 2026-06-27; Pa- naming
 * LOCKED). Mirrors the /papic + /setnayan-ai pattern exactly: force-static
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
import { studioDescription } from '@/lib/studio-apps';

export const dynamic = 'force-static';
export const revalidate = 3600;

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = 'Pawebsite — Your Editorial Wedding Website · Setnayan';
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

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/pawebsite' },
  keywords: [
    'wedding website Philippines',
    'wedding website builder',
    'online wedding invitation',
    'wedding RSVP website',
    'save the date website',
    'editorial wedding website',
    'Pawebsite',
    'Setnayan',
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/pawebsite',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Pawebsite — your editorial wedding website' }],
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
  name: 'Pawebsite — Editorial Wedding Website',
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

export default function PawebsiteLandingPage() {
  return (
    <DoorwayPage
      kicker="In your wedding · editorial website"
      title={'One beautiful home for your whole wedding.'}
      lede={'Pawebsite brings your save-the-date, your RSVP, your event details, and your love story under one address — told like a magazine feature. Share it once, and everything your guests need is there.'}
      primary={{ href: '/onboarding/wedding?from=pawebsite', label: 'Start planning · free' }}
      secondary={{ href: '/pricing', label: 'See pricing' }}
      productName="Pawebsite"
      steps={STEPS}
      differentiator={{
        heading: 'Not just a wedding form',
        lede: 'Most wedding sites are a date and a button. Yours reads like the front-page story of your life.',
        rows: VS,
      }}
      faq={FAQ}
      closing={{
        heading: 'Give your wedding its home',
        body: 'Your wedding website lives inside your free Setnayan wedding — alongside your guest list, RSVP, seating, and gallery. Start planning free, and make it yours.',
        href: '/onboarding/wedding?from=pawebsite',
        label: 'Start planning · free',
      }}
      structuredData={[APP_LD, FAQ_LD]}
    />
  );
}
