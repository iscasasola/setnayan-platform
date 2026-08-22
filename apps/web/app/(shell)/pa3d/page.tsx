/**
 * /pa3d — public marketing landing page for 3D Plan, the 3D reception-walkthrough
 * experience (www.setnayan.com/pa3d).
 *
 * Part of the "Pa-" public-surface wave (owner-approved 2026-06-27; Pa- naming
 * LOCKED). Mirrors the /papic + /setnayan-ai pattern exactly: force-static
 * Server Component, static `metadata`, SoftwareApplication + FAQPage JSON-LD,
 * hero + benefit sections + FAQ + a Mulberry-accent primary CTA, and the shared
 * SiteFooter. The persistent SiteChrome nav renders because '/pa3d' is
 * registered in NAV_ROUTES.
 *
 * POSITIONING (locked "seat plan stays free" + "3D seat-plan roadmap"): the 2D
 * seating plan is FREE and complete on its own; 3D Plan is the premium tier that
 * lets a couple walk their reception in 3D before the day. Sell the value, not
 * the price (admin-managed + provisional — links to /pricing). Copy sells
 * BENEFITS only (public-surface hygiene).
 */

import { DoorwayPage } from '@/app/_components/marketing/_doorway';
import { studioApp, studioDescription } from '@/lib/studio-apps';


const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = '3D Plan — Walk Your Reception in 3D Before the Day · Setnayan';
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
const PAGE_DESCRIPTION = studioDescription('pa3d');
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
  alternates: { canonical: '/pa3d' },
  keywords: [
    '3D wedding seating plan',
    'wedding reception 3D',
    'visualize wedding reception',
    'wedding floor plan tool',
    '3D table layout wedding',
    'wedding seating chart Philippines',
    '3D Plan',
    'Setnayan',
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/pa3d',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: '3D Plan — walk your reception in 3D before the day' }],
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
  name: '3D Plan — Reception Walkthrough',
  url: `${SITE_URL}/pa3d`,
  applicationCategory: 'DesignApplication',
  operatingSystem: 'Any (web browser)',
  description: PAGE_DESCRIPTION,
  featureList: [
    'Walk your reception in 3D before the day',
    'See the room the way your guests will',
    'Built on your seating plan — no extra setup',
    'Catch a tight aisle or a blocked view in time to fix it',
    'Share the walkthrough with your coordinator and family',
    'The 2D seating plan stays free; the 3D walk is the upgrade',
  ],
  areaServed: 'Philippines',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const FAQ = [
  {
    q: 'Do I need to build the room from scratch?',
    a: 'No. 3D Plan builds on the seating plan you already make in Setnayan — your tables, your head table, your dance floor. Switch to the 3D view and your plan stands up into a room you can walk.',
  },
  {
    q: 'Isn’t the seating plan enough on its own?',
    a: 'The seating plan is free and complete — you can run your whole wedding on it. 3D Plan is for when you want to feel the room before it’s real: how close the tables sit, what the lola at table 3 actually sees, whether the aisle has space to breathe.',
  },
  {
    q: 'What can I catch with it?',
    a: 'The things a flat chart hides — a sightline blocked by a pillar, a path too tight for the gown, a head table that reads smaller than you pictured. You see it while there’s still time to move things.',
  },
  {
    q: 'Can I show it to other people?',
    a: 'Yes. Walk your coordinator, your family, or your stylist through the exact room, so everyone pictures the same day before it arrives.',
  },
  {
    q: 'Does my guest need anything special to view it?',
    a: 'No special device and no install — it runs right in the browser. You explore on the same phone or laptop you plan everything else on.',
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
    t: 'Plan your tables — free',
    d: 'Lay out your reception in Setnayan’s seating plan: your tables, your head table, your dance floor, every guest in a seat. The whole tool is free.',
  },
  {
    t: 'Stand up the room',
    d: 'Switch to 3D Plan and your flat plan rises into a room you can walk. See the space the way your guests will, from any seat in the house.',
  },
  {
    t: 'Get it right before the day',
    d: 'Spot the tight aisle, the blocked view, the head table that feels off — and fix it now, while it’s still just a plan. Walk in on the day to exactly what you pictured.',
  },
];

const VS = [
  ['A flat chart from above', 'A room you can stand inside'],
  ['Guess what each guest sees', 'See it from any seat'],
  ['Surprises on the day', 'Fixes while there’s still time'],
  ['Picture it in your head', 'Show everyone the same room'],

] as const;

export default function ThreeDPlanLandingPage() {
  return (
    <DoorwayPage
      demo={studioApp('pa3d')?.demo}
      title={'Walk your reception before it’s built.'}
      primary={{ href: '/onboarding/wedding?from=pa3d', label: 'Start planning · free' }}
      secondary={{ href: '/pricing', label: 'See pricing' }}
      productName="3D Plan"
      studioKey="pa3d"
      steps={STEPS}
      differentiator={{
        heading: 'More than a chart',
        lede: 'The free seating plan tells you who sits where. 3D Plan shows you what it actually feels like.',
        rows: VS,
      }}
      faq={FAQ}
      closing={{
        heading: 'See the room before the day',
        body: 'The seating plan is free inside every Setnayan wedding. Start planning free, lay out your tables, and add 3D Plan when you want to walk the room.',
        href: '/onboarding/wedding?from=pa3d',
        label: 'Start planning · free',
      }}
      structuredData={[APP_LD, FAQ_LD]}
    />
  );
}
