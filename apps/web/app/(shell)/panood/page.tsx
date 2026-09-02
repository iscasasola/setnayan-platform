/**
 * /panood — public marketing landing page for Live Studio, the live-broadcast
 * experience (www.setnayan.com/panood).
 *
 * Part of the "Pa-" public-surface wave (owner-approved 2026-06-27; Pa- naming
 * LOCKED). Mirrors the /papic + /setnayan-ai pattern exactly: force-static
 * Server Component, generateMetadata-equivalent static `metadata`,
 * SoftwareApplication + FAQPage JSON-LD, hero + benefit sections + FAQ + a
 * Mulberry-accent primary CTA, and the layout-mounted SiteFooterChrome. The persistent
 * SiteChrome nav renders because '/panood' is registered in NAV_ROUTES.
 *
 * POSITIONING (locked "Live Studio human positioning"): sell PRESENCE ACROSS
 * DISTANCE — being there for the guests who can't be in the room. Copy sells
 * BENEFITS only (public-surface hygiene) and quotes NO price (admin-managed +
 * provisional — links to /pricing).
 *
 * ⚠ 2026-07-27 — the old "never names YouTube / the streaming stack" rule is
 * REVERSED. This is the primary public page for the feature that consumes a
 * Google SENSITIVE scope (auth/youtube). A product page that never mentions the
 * integration reads to an OAuth reviewer as concealment, whatever the marketing
 * rationale. The FAQ now names YouTube plainly and links /privacy. Keep it.
 * Describe whose channel is used as a function of how the event is set up —
 * both arrangements ship (setup/actions.ts:203-229) — and never claim Setnayan
 * transmits the video (panood-youtube.ts:266-274).
 */

import Link from 'next/link';
import { studioApp, studioDescription } from '@/lib/studio-apps';
import { DoorwayPage, DOORWAY_TONE } from '@/app/_components/marketing/_doorway';
import { PanoodFilm } from './_panood-film';


const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = 'Live Studio — Live-Stream Your Wedding · Setnayan';
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
const PAGE_DESCRIPTION = studioDescription('panood');
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
  alternates: { canonical: '/panood' },
  keywords: [
    'wedding live stream Philippines',
    'live stream wedding',
    'wedding broadcast',
    'watch wedding online',
    'wedding live stream app',
    'stream wedding to family abroad',
    'Live Studio',
    'Setnayan',
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/panood',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Live Studio — live-stream your wedding' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

// SoftwareApplication JSON-LD — names the moat for AI answer engines. No price
// (admin-managed + provisional); publisher references the site-wide Organization.
const APP_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Live Studio — Wedding Live Stream',
  url: `${SITE_URL}/panood`,
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Any (web browser)',
  description: PAGE_DESCRIPTION,
  featureList: [
    'Live-streams your wedding to guests who can’t attend',
    'Watched right on your own Event Hub — no separate app',
    'Family overseas join in real time',
    'No login or install for the people watching',
    'Costs the same whether ten watch or ten thousand',
    'Auto-archived on YouTube, with the watch link kept on your Event Hub afterwards',
  ],
  areaServed: 'Philippines',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const FAQ = [
  {
    // 💻 FIRST, not buried. This is the only requirement on this page a couple cannot
    // recover from: no laptop on the morning means no broadcast, and no amount of
    // money, support or waiting fixes it on a date that cannot move. It was mentioned
    // only inside the YouTube answer further down, which is not where somebody deciding
    // whether this product fits them will look.
    q: 'What do I need on the day?',
    a: 'Your guests’ phones are the cameras — they join by scanning your QR, with nothing to install. You will also need one Windows or Mac laptop at the celebration, running free streaming software (OBS) next to the Live Studio control room: that laptop is what actually sends the picture to YouTube. A phone or tablet on its own cannot do it, and neither can a web browser. Most couples hand the laptop to a friend or a coordinator, not a paid crew.',
  },
  {
    q: 'How do my guests watch?',
    a: 'They open your Event Hub and press play — that’s it. No app to download, no account to make, no link to lose. It works on any phone, tablet, or laptop, anywhere in the world.',
  },
  {
    q: 'Will it work for family overseas?',
    a: 'Yes — that’s exactly who it’s for. Anyone with an internet connection can watch your day as it happens, whether they’re across the city or across the ocean.',
  },
  {
    q: 'What if a lot of people watch at once?',
    a: 'It doesn’t matter. Live Studio handles ten viewers or ten thousand the same way — invite your whole barangay and everyone abroad without a second thought.',
  },
  {
    q: 'Can we keep the recording?',
    a: 'Yes — YouTube keeps the broadcast after the day, and the watch link stays on your Event Hub so anyone who missed it can watch it back. If it ran on your own YouTube channel, the recording is yours to keep, edit, or delete in YouTube Studio. If it ran on a Setnayan channel, we keep it as an unlisted video and give you the watch link — and we will delete it if you ask.',
  },
  {
    q: 'Does it replace our videographer?',
    a: 'No. Live Studio is about presence in the moment — letting people who can’t be there feel like they are. Your videographer still makes the keepsake film; Live Studio makes sure no one misses the day itself.',
  },
  {
    q: 'How does the stream actually work?',
    a: 'Live Studio broadcasts through YouTube. Setnayan sets the broadcast up and embeds it on your Event Hub, always unlisted — it never appears in YouTube search, and only people with your Event Hub or the link can watch. It runs on your own YouTube channel when you connect one, or on a Setnayan channel where we supply it. Your own streaming software, like OBS, sends the video to YouTube; Setnayan does not carry the video itself. How we handle the Google data involved is set out at setnayan.com/privacy.',
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
    t: 'Turn it on for your day',
    d: 'Live Studio lives inside your Setnayan wedding. Switch it on for the day, and a live broadcast appears right on your own Event Hub — nothing for your guests to set up.',
  },
  {
    t: 'Everyone who can’t be there, watches',
    d: 'Share your Event Hub and they’re in. The lola overseas, the friends who couldn’t fly home, the family who couldn’t make it — all in the room, together, in real time.',
  },
  {
    t: 'And it stays after',
    d: 'When the day ends, the broadcast stays with your wedding. Anyone who missed it can watch it back, whenever they’re ready.',
  },
];

const VS = [
  ['A private link people lose', 'Right on your own Event Hub'],
  ['Guests fumble with an app', 'They just press play'],
  ['Costs more as more tune in', 'Same for ten or ten thousand'],
  ['Gone the moment it ends', 'Stays with your wedding afterwards'],

] as const;

export default function PanoodLandingPage() {
  return (
    <DoorwayPage
      demo={studioApp('panood')?.demo}
      title={'Everyone you love, in the room — even from afar.'}
      primary={{ href: '/onboarding/wedding?from=panood', label: 'Start planning · free' }}
      secondary={{ href: '/pricing', label: 'See pricing' }}
      productName="Panood"
      studioKey="panood"
      steps={STEPS}
      differentiator={{ heading: 'Presence, not just a link', lede: 'A live stream shouldn’t feel like homework. Live Studio lives where your guests already are — your wedding.', rows: VS }}
      faq={FAQ}
      closing={{ heading: 'Let everyone be there', body: 'Live Studio lives inside your free Setnayan wedding — alongside your guest list, RSVP, seating, and website. Start planning free, and add Live Studio when you’re ready.', href: '/onboarding/wedding?from=panood', label: 'Start planning · free' }}
      structuredData={[APP_LD, FAQ_LD]}
      // Kept deliberately, and kept AFTER the questions: this is the
      // YouTube-API-Services disclosure an OAuth reviewer looks for. The 2026-06-29
      // "never name YouTube" rule was REVERSED for exactly this paragraph.
      epilogue={
        <p className={`mt-5 text-center text-sm ${DOORWAY_TONE.muted}`}>
          Live Studio uses YouTube API Services. How we handle the Google data
          involved is set out in our{' '}
          <Link href="/privacy" className="underline underline-offset-4">
            privacy policy
          </Link>
          .
        </p>
      }
    >
      {/* ── THE CONTROL ROOM, RUNNING ────────────────────────────────────────
          Same rule as `/papic`'s film: not a mock-up, a recording of the same
          control panel the live demo renders, so it can never drift from the
          product. Scoped to exactly what that recording can show — cutting
          between two camera feeds on the shipped controller — not the guest's
          Event Hub view, which this film does not capture. */}
      <section className="mx-auto mt-16 max-w-2xl" aria-label="The Live Studio control room">
        <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[var(--m-orange-2)]">
          The control room itself
        </p>
        <h2 className="mt-2 font-serif text-2xl tracking-tight text-[var(--m-ink)] sm:text-3xl">
          This is what turning it on looks like.
        </h2>
        <div className="mt-5 flex flex-wrap items-center gap-5">
          <PanoodFilm />
          <p className={`max-w-xs text-sm ${DOORWAY_TONE.muted}`}>
            Two phones become cameras the moment they scan a code. From here you cut between them —{' '}
            <span className="font-medium text-[var(--m-ink)]">this is the same control panel your wedding uses.</span>
          </p>
        </div>
      </section>
    </DoorwayPage>
  );
}
