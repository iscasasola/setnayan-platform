/**
 * /pakanta — the public product page for Pakanta, the couple's own wedding song
 * (www.setnayan.com/pakanta).
 *
 * ─── WHY IT EXISTS AT ALL ────────────────────────────────────────────────
 * Owner, 2026-08-21: *"pakanta is paid. so add this to the studio."*
 *
 * Pakanta has been SOLD since 2026-05-14 and, until today, had no public page
 * of any kind — the only way to meet it was to already own a wedding and open
 * the Studio hub. `front-door-invariants.test.ts` therefore held a guard whose
 * whole job was to keep it OUT of the rail: *"Pakanta has no public page — a
 * rail row for it would be a fake door."* That guard was right, and the honest
 * way to satisfy the owner's instruction is to remove its REASON, not the
 * guard. So the page lands first and the rail row lands with it; the guard is
 * inverted in the same commit and now fails if the page ever disappears while
 * the row stays.
 *
 * ─── NOTHING HERE IS NEWLY INVENTED COPY ─────────────────────────────────
 * The words are the ones the product already ships with. `add-ons-detail.ts`
 * has carried Pakanta's hero, tagline, paragraphs and highlights since the
 * App Store detail pages were built — *"A song that's only yours"*, *"written
 * from your love story"*, *"it scores the videos from your day"*. Writing a
 * second set for the public page would be the paid-twice mistake in miniature
 * AND would give a couple two different accounts of one product.
 *
 * ⚠ THE DESCRIPTION IS NOT AUTHORED HERE. It comes from `lib/studio-apps.ts`,
 * the one place the Studio products are described, so this page's search
 * result and the rail's row for it cannot disagree. Do not re-inline it.
 *
 * ─── NO PRICE ON THE PAGE, AND THAT IS THE HOUSE RULE ────────────────────
 * Prices are admin-managed in the live catalog and move; every doorway sells
 * the BENEFIT and links to /pricing. Quoting a number here is how a dead one
 * ends up on an indexed page.
 *
 * ⚠ AND NO CLAIM ABOUT HOW THE SONG IS MADE. The composition tool is never
 * named on a public surface (same rule the monogram page follows about its
 * own), and the in-app surface already carries the AI disclosure a couple must
 * see BEFORE they buy. A marketing page is not the place that disclosure
 * lives, so this one makes no claim it would have to disclose.
 */

import { DoorwayPage } from '@/app/_components/marketing/_doorway';
import { studioDescription } from '@/lib/studio-apps';

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = 'Pakanta — Your Wedding’s Own Song · Setnayan';
/** The document title ONLY — the root layout appends the brand via its
 *  `template: '%s · Setnayan'`, and a PAGE_TITLE that already ends in the brand
 *  came out as "… · Setnayan · Setnayan" on 11 live pages once. The share cards
 *  and the structured-data name do NOT go through that template and are correct
 *  WITH the brand, which is why this strips it here and nowhere else. */
const DOC_TITLE = PAGE_TITLE.replace(/ · Setnayan$/, '');
const PAGE_DESCRIPTION = studioDescription('pakanta');
const OG_IMAGE = `${SITE_URL}/brand/og-card.webp`;

export const metadata = {
  title: DOC_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/pakanta' },
  keywords: [
    'custom wedding song',
    'original wedding song Philippines',
    'personalised wedding song',
    'wedding first dance song written for you',
    'love story song',
    'Pakanta',
    'Setnayan',
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/pakanta',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Pakanta — your wedding’s own song' }],
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
  name: 'Pakanta — Your Wedding’s Own Song',
  url: `${SITE_URL}/pakanta`,
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Any (web browser)',
  description: PAGE_DESCRIPTION,
  featureList: [
    'An original song, written for the two of you',
    'Composed from the love story you already shared',
    'Yours to keep, forever',
    'Becomes the music behind the videos from your day',
    'Plays on your Event Hub',
    'Cleared for sharing — post it anywhere',
  ],
  areaServed: 'Philippines',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const FAQ = [
  {
    q: 'What is Pakanta?',
    a: 'An original song written for your wedding — words drawn from your own story, not a template with your names dropped in. It is finished music you can play at the reception, keep afterwards, and use behind the videos from your day.',
  },
  {
    q: 'Do we have to write anything?',
    a: 'No. The song is built from the love story you already told us when you set up your wedding. There is no blank page and no awkward interview — we only ask a few short things the story does not carry, like what you call each other and the kind of music you both like.',
  },
  {
    q: 'Is the song really ours?',
    a: 'Yes. It is written for the two of you and it is yours to keep, with nothing to renew and nothing that expires.',
  },
  {
    q: 'Where does it get used?',
    a: 'Wherever your wedding is. It can play on your Event Hub, and it becomes the music behind the videos Setnayan makes from your day — so the whole wedding sounds like you instead of like stock music.',
  },
  {
    q: 'Can we post it online?',
    a: 'Yes. The song is cleared for sharing, so a video scored with it can go anywhere without a takedown or a licensing headache.',
  },
  {
    q: 'When do we get it?',
    a: 'After you order, it is written and produced and then delivered to you inside Setnayan. You will see its status on your own Pakanta page while it is being made.',
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
    t: 'You already told us the story',
    d: 'How you met, what changed, why it is this person — the same story your wedding page is built from. Nothing to write again.',
  },
  {
    t: 'It becomes a song',
    d: 'Your story is turned into lyrics and produced into a finished, original track, in the kind of music the two of you actually listen to.',
  },
  {
    t: 'It plays everywhere your day does',
    d: 'On your Event Hub, behind the videos from your wedding, and on your phone for good. Yours to keep, and cleared to share.',
  },
];

const VS = [
  ['A popular song ten other weddings used', 'A song that exists only for yours'],
  ['Lyrics that are almost about you', 'Words from your own story'],
  ['Stock music behind your videos', 'Your song behind your videos'],
  ['A licence that can be pulled', 'Cleared to post anywhere'],
] as const;

export default function PakantaLandingPage() {
  return (
    <DoorwayPage
      title={'A song that’s only yours.'}
      primary={{ href: '/onboarding/wedding?from=pakanta', label: 'Start planning · free' }}
      secondary={{ href: '/pricing', label: 'See pricing' }}
      productName="Pakanta"
      studioKey="pakanta"
      steps={STEPS}
      differentiator={{
        heading: 'Written for you, not chosen for you',
        lede: 'Every wedding picks a song. This one has a song nobody else can use — and it carries through the whole day.',
        rows: VS,
      }}
      faq={FAQ}
      closing={{
        heading: 'Your day should sound like you',
        body: 'Pakanta lives inside your free Setnayan wedding — beside your gallery, your Event Hub and your guest list. Start planning free, and add your song when you are ready.',
        href: '/onboarding/wedding?from=pakanta',
        label: 'Start planning · free',
      }}
      structuredData={[APP_LD, FAQ_LD]}
    />
  );
}
