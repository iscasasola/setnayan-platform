/**
 * /palogo — public marketing landing page for Logo Maker, the animated monogram
 * (the Animated Monogram) carried across the whole wedding
 * (www.setnayan.com/palogo).
 *
 * Part of the "Pa-" public-surface wave (owner-approved 2026-06-27; Pa- naming
 * LOCKED). Mirrors the /papic + /setnayan-ai pattern exactly: force-static
 * Server Component, static `metadata`, SoftwareApplication + FAQPage JSON-LD,
 * hero + benefit sections + FAQ + a Mulberry-accent primary CTA, and the shared
 * SiteFooter. The persistent SiteChrome nav renders because '/palogo' is
 * registered in NAV_ROUTES.
 *
 * ACCURACY GUARDRAIL (locked "AI-content disclosure" + public-surface hygiene):
 * the underlying image model is NEVER named — the brand-facing name is the
 * Animated Monogram. Sell the BENEFIT (one mark, your initials, alive across
 * everything) and quote NO price (admin-managed + provisional — links to
 * /pricing). A free no-signup monogram preview already lives at /monogram, so
 * the secondary CTA points there.
 */

import { DoorwayPage } from '@/app/_components/marketing/_doorway';
import { SpotlightSection, type Spotlight } from '@/app/_components/marketing/_spotlights';
import { studioDescription } from '@/lib/studio-apps';


const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = 'Logo Maker — Your Animated Wedding Monogram · Setnayan';
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
const PAGE_DESCRIPTION = studioDescription('palogo');
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
  alternates: { canonical: '/palogo' },
  keywords: [
    'wedding monogram',
    'animated wedding logo',
    'custom wedding monogram Philippines',
    'wedding initials design',
    'monogram for wedding website',
    'animated monogram',
    'Logo Maker',
    'Setnayan',
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/palogo',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Logo Maker — your animated wedding monogram' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

// SoftwareApplication JSON-LD — no model name, no price (admin-managed +
// provisional); publisher references the site-wide Organization.
const APP_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Logo Maker — Animated Wedding Monogram',
  url: `${SITE_URL}/palogo`,
  applicationCategory: 'DesignApplication',
  operatingSystem: 'Any (web browser)',
  description: PAGE_DESCRIPTION,
  featureList: [
    'A custom monogram drawn from your initials',
    'Animated — your mark comes alive, not just a static logo',
    'Carries across your save-the-date, website, reception screens, and videos',
    'Refine it until it feels like yours',
    'Tuned to your wedding’s colours and feel',
    'One signature for the whole day',
  ],
  areaServed: 'Philippines',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const FAQ = [
  {
    q: 'What exactly do I get?',
    a: 'A monogram of your own — your initials drawn into a single mark, with a short animation that brings it to life. It becomes the signature of your whole wedding, the same way a brand has its logo.',
  },
  {
    q: 'Where does it show up?',
    a: 'Everywhere that matters. It opens your save-the-date, signs your Event Hub, glows on the screen at the reception, marks your signage, and closes every Setnayan video you make for the day.',
  },
  {
    q: 'Can I make it look the way I want?',
    a: 'Yes. You describe the feel you’re after and refine it until it’s right — no design skills needed. It’s shaped around your initials, your colours, and your wedding’s mood.',
  },
  {
    q: 'Is it really animated, or just an image?',
    a: 'Both. You get the still mark for print and small spaces, and a living version that draws itself in for screens, your Event Hub, and your videos.',
  },
  {
    q: 'Can I try one first?',
    a: 'Yes — you can preview a monogram for your initials free, no sign-up, before you decide. The animated version that follows you across the whole wedding is the upgrade.',
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
    t: 'Start from your initials',
    d: 'Tell Setnayan your initials and the feel you’re after — classic, modern, playful, grand. Your mark begins to take shape around the two of you.',
  },
  {
    t: 'Refine it until it’s yours',
    d: 'Nudge the look until it’s exactly right — no design skills required. When it clicks, it becomes the signature of your whole wedding.',
  },
  {
    t: 'It follows you everywhere',
    d: 'Your monogram opens your save-the-date, signs your Event Hub, glows at the reception, and closes every video — one mark, carried beautifully across the day.',
  },
];

const VS = [
  ['A stock template everyone uses', 'A mark drawn from your initials'],
  ['A flat, static logo', 'A monogram that comes alive'],
  ['Different look on every piece', 'One signature across the day'],
  ['Stuck on the invite only', 'On screens, website, and videos too'],

] as const;

/*
 * ─── THE FEATURE SPOTLIGHTS (2026-09-05) ─────────────────────────────────
 * One idea · one picture · one sentence — the shape the owner approved for
 * `/papic` and asked for on every Studio page (`_components/marketing/
 * _spotlights.tsx`). Every sentence is traceable to copy already on this
 * page, the product record, or the demo scenes' captions. Left out on
 * purpose: the demo's font names and "Vector studio" chrome (not a promise
 * the page makes), and the retired LED wall.
 *
 * 🔴 SCENE 1'S STILL IS BANNED, AND THAT IS A CORRECTION. "Your initials,
 * drawn live" was first illustrated with `animated-monogram-1.jpg` — and the
 * frame reads **"One price for your wedding · ₱1,000"** with an "Upgrade"
 * pill. This page's whole pricing rule is that it quotes NO price, because
 * prices are admin-managed and move; a screenshot showing one is a price on an
 * indexed page that nobody will remember to update. Dropping it from the COPY
 * and then showing it in the PICTURE is the same claim by another route.
 * 🔑 A PICTURE IS A CLAIM — look at the frame, do not trust the caption.
 * `spotlights-are-real.test.ts` bans that file by name with the reason. The
 * other three monogram stills were opened and carry no price or tier.
 */
const SPOTLIGHTS: readonly Spotlight[] = [
  {
    chip: 'Your initials',
    t: 'A mark drawn from the two of you',
    d: 'Tell Setnayan your initials and the feel you’re after — classic, modern, playful, grand — then nudge the look until it’s exactly right. Tap a letter to restyle; no design skills required.',
    media: { kind: 'still', src: '/add-ons/demo/stills/animated-monogram-0.jpg', alt: 'Logo Maker — design a mark that’s truly yours' },
  },
  {
    chip: 'Alive',
    t: 'Your initials, drawn live',
    d: 'Not just an image. You get the still mark for print and small spaces, and a living version that draws itself in for screens, your Event Hub, and your videos.',
    media: { kind: 'photo', src: '/demo/maria-jose/details.webp', alt: 'An invitation card with two gold rings resting on it, beside a bouquet of white roses' },
  },
  {
    chip: 'Event Hub',
    t: 'It opens your Event Hub',
    d: 'Guests see it bloom in as the page loads — your mark, then your names and the date, right above the RSVP.',
    media: { kind: 'still', src: '/add-ons/demo/stills/animated-monogram-2.jpg', alt: 'Logo Maker — it opens your Event Hub' },
  },
  {
    chip: 'Keepsakes',
    t: 'The same mark on every keepsake',
    d: 'Your mark sits at the heart of your QR and on your save-the-date, so nothing about your wedding wears a different look.',
    media: { kind: 'still', src: '/add-ons/demo/stills/animated-monogram-3.jpg', alt: 'Logo Maker — and every keepsake carries it' },
  },
  {
    chip: 'At the reception',
    t: 'It glows on the screen at the reception',
    d: 'The same mark glows on the screen at the reception, marks your signage, and closes every Setnayan video you make for the day.',
    media: { kind: 'photo', src: '/demo/maria-jose/reception.webp', alt: 'A long reception table under strings of lights, candles lit' },
  },
  {
    chip: 'Try it free',
    t: 'Preview yours before you decide',
    d: 'You can preview a monogram for your initials free, no sign-up, before you decide. The animated version that follows you across the whole wedding is the upgrade.',
    media: { kind: 'photo', src: '/demo/maria-jose/hero.webp', alt: 'A couple on a hillside terrace at golden hour, a lake and volcano behind them' },
  },
];

export default function LogoMakerLandingPage() {
  return (
    <DoorwayPage
      title={'One mark, alive across your whole wedding.'}
      primary={{ href: '/onboarding/wedding?from=palogo', label: 'Start planning · free' }}
      secondary={{ href: '/monogram', label: 'Preview yours · free' }}
      productName="Logo Maker"
      studioKey="palogo"
      steps={STEPS}
      differentiator={{ heading: 'Not a clip-art logo', lede: 'A template looks like everyone else’s. Logo Maker looks like you — and it moves.', rows: VS }}
      faq={FAQ}
      closing={{ heading: 'Give your wedding its signature', body: 'Logo Maker lives inside your free Setnayan wedding — alongside your save-the-date, website, and videos. Start planning free, and add your animated monogram when you’re ready.', href: '/onboarding/wedding?from=palogo', label: 'Start planning · free' }}
      structuredData={[APP_LD, FAQ_LD]}
    >
      <SpotlightSection
        productName="Logo Maker"
        heading="One mark, and everywhere it goes"
        lede="Your initials, drawn once, carried across the whole day."
        items={SPOTLIGHTS}
      />
    </DoorwayPage>
  );
}
