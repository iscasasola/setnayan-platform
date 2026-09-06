/**
 * /samahan — the public product page for Samahan, the group space
 * (www.setnayan.com/samahan).
 *
 * ─── WHY IT EXISTS ───────────────────────────────────────────────────────
 * Owner, 2026-09-06: *"we also want to feature our samahan/groups. This has a
 * feature where they can share stories every hour, chat, and create events"*.
 *
 * ⚠ `/samahan` ALREADY EXISTED AS A ROUTE — but only `/samahan/join/[token]`,
 * the door an invited person walks through. There was no page that says what a
 * samahan IS, which is why the word was already reserved and yet nothing
 * public explained it. This is that page; the join route is untouched.
 *
 * ─── "EVERY HOUR" IS REAL, AND IT IS A CAP, NOT A CADENCE ────────────────
 * Checked rather than assumed, because the phrase could have been either. The
 * story API enforces ONE clip per member per hour — a UNIQUE index on
 * `(community_id, user_id, hour_bucket)` returning `one_per_hour`, and the
 * strip's own header reads *"one an hour, gone after 24"*. Separately, a clip
 * LIVES for 24 hours (`STORY_LIFETIME_MS`; the read filters `expires_at >
 * now()`). Both facts are true and they are different facts.
 *
 * 🔑 THE COPY CARRIES THE 24 HOURS AND NOT THE ONE-PER-HOUR. The lifetime is
 * the product's promise to a reader — it is why a story feels safe to post.
 * The cap is a rate limit: a number, invisible until you hit it, and nothing a
 * stranger deciding whether to make a group needs. Naming it here would also
 * put a figure on a page that otherwise prints none.
 *
 * ─── NOTHING HERE IS NEWLY INVENTED COPY ─────────────────────────────────
 * Traced to the shipped surface: `dashboard/(account)/samahan/` (the create
 * form, the identity header, the Usapan / Members / Events tabs), its
 * `actions.ts` (who may do what), `lib/samahan-stories.ts` + `samahan-notify.ts`
 * + `samahan-reel.ts`, `samahan/join/[token]`, and
 * `create-event/actions.ts` (a samahan CAN plan an event — and can never own a
 * wedding or another personal milestone). Drafted with the Fable model against
 * those and nothing else.
 *
 * ⚠ THE DESCRIPTION IS NOT AUTHORED HERE. It comes from `lib/studio-apps.ts`.
 *
 * ─── THE THINGS THIS PAGE MUST NEVER GROW ────────────────────────────────
 * 🔴 NUMBERS, other than the 24-hour story lifetime, which is the promise.
 * 🔴 A CLAIM THAT ANY NOTICE LEAVES THE APP. `samahan-notify.ts` puts neither
 * story nor message notices on the email or push allowlist — only the in-app
 * bell rings. Say "your Setnayan bell", never "we email your group".
 * 🔴 A SAMAHAN OWNING A WEDDING. `create-event/actions.ts` refuses it: a
 * wedding is 'personal' and stays with the person.
 * 🔴 AN INVITE EXPIRY. The join page has an 'expired' state, but nothing that
 * was read SETS one — so the page promises rotation, not expiry.
 */

import { DoorwayPage } from '@/app/_components/marketing/_doorway';
import { SpotlightSection, type Spotlight } from '@/app/_components/marketing/_spotlights';
import { studioDescription } from '@/lib/studio-apps';

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = 'Samahan — Your Barkada, Ninongs, Family · Setnayan';
/** The document title ONLY — see the sibling doorways. */
const DOC_TITLE = PAGE_TITLE.replace(/ · Setnayan$/, '');
const PAGE_DESCRIPTION = studioDescription('samahan');
const OG_IMAGE = `${SITE_URL}/brand/og-card.webp`;

export const metadata = {
  title: DOC_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/samahan' },
  keywords: [
    'samahan',
    'barkada group app',
    'family group chat Philippines',
    'reunion planner Philippines',
    'parish youth group',
    'ninong ninang group',
    'Setnayan',
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/samahan',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Samahan — your barkada, ninongs, family' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

const APP_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Samahan — Your Barkada, Ninongs, Family',
  url: `${SITE_URL}/samahan`,
  applicationCategory: 'SocialNetworkingApplication',
  operatingSystem: 'Any (web browser)',
  description: PAGE_DESCRIPTION,
  featureList: [
    'Create a samahan for your barkada, parish, or clan — a name, a line about it, a group photo',
    'Bring people in with a standing invite link organizers can rotate at any time',
    'Usapan, the group chat, where your own messages are yours to take down',
    'Samahan Stories — short clips recorded on your phone that are gone after 24 hours',
    'Play the day — every clip still up, watched in the order it happened',
    'Organizers plan a reunion, an outing, a tournament or a celebration for the whole group',
    'A samahan that lives for as long as one person is still in it',
  ],
  areaServed: 'Philippines',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const FAQ = [
  {
    q: 'What is a Samahan?',
    a: 'A samahan is a group in your Setnayan account: one shared space for your barkada, parish, or clan — their reunions, tournaments, and outings all in one place. It has a name and a group photo, a chat called Usapan, a strip of short stories, and the events an organizer plans for it. It belongs to you as a person, not to any one event.',
  },
  {
    q: 'How do we make one, and who runs it?',
    a: 'Give it a name, add a line about what it is if you like, and it is yours — creating one is free. You start as its organizer, and an invite link is ready the moment it is created. Any member can rename the samahan or change its photo, post in Usapan, record a story, and leave. Organizers hold the invite link, promote or demote members, remove someone, and plan events.',
  },
  {
    q: 'How does someone join?',
    a: 'An organizer shares the invite link. Whoever opens it sees the samahan’s name and how many people are in it, signs in or creates a free account, and taps Join. If the link leaks, an organizer rotates it and the old link stops working immediately.',
  },
  {
    q: 'What are Samahan Stories?',
    a: 'Tap Record and your phone camera takes a short clip, shrinks it, and posts it to the strip. The rest of the group is told your clip is there for the next 24 hours. When those hours are up it is gone — and you can take it down sooner yourself. Play the day plays every clip that is still up, from the oldest to the newest.',
  },
  {
    q: 'What is Usapan?',
    a: 'Usapan is the group chat. Say something and the rest of the samahan is told once in their Setnayan bell, however busy the chat gets. Your own messages are yours to take down.',
  },
  {
    q: 'Can a samahan plan an event?',
    a: 'Yes. An organizer plans a reunion, an outing, a tournament or a celebration from the Events tab, and it shows up there for every member. A samahan cannot own a wedding or another personal milestone — those stay with the person. You open the events you have been added to; for the rest, ask an organizer to add you.',
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
    t: 'Name your samahan',
    d: 'Give it a name and, if you like, a line about what it is. You start as its organizer, and an invite link is ready the moment it is created. Tap the photo to add one and tap the name to change it — any member can.',
  },
  {
    t: 'Bring everyone in',
    d: 'Share the invite link. Whoever opens it sees the samahan’s name and how many people are in it, signs in, and taps Join. Rotate the link whenever you want and the old one stops working immediately.',
  },
  {
    t: 'Live in it',
    d: 'Talk in Usapan, record a story that is gone after 24 hours, and when it is time for the reunion or the outing, an organizer plans it from the Events tab and every member finds it there.',
  },
];

const VS = [
  ['The reunion planned in a thread nobody can find again', 'The event on its own tab, where every member finds it'],
  ['Clips that sit in everyone’s phone forever', 'Stories that are gone after 24 hours'],
  ['An invite that keeps working after it leaks', 'A link an organizer can rotate — the old one stops immediately'],
  ['A group one person can shut down on everyone', 'A samahan that lives while one person is still in it'],
] as const;

/*
 * ─── THE FEATURE SPOTLIGHTS ──────────────────────────────────────────────
 * One idea · one picture · one sentence. Photographs only — a samahan is
 * people, and the `wall-*` frames are the candid guest shots from our own demo
 * celebration. Each file is used exactly once.
 */
const SPOTLIGHTS: readonly Spotlight[] = [
  {
    chip: 'Your samahan',
    t: 'Your barkada, ninongs and family, in one place',
    d: 'Name it, add a line about what it is, and give it a photo — the barkada, the parish youth, the clan. Every member sees the same space, and only members can open it.',
    media: { kind: 'photo', src: '/demo/maria-jose/wall-5.webp', alt: 'Friends raising their glasses together in a garden at dusk' },
  },
  {
    chip: 'Invite link',
    t: 'One link brings everyone in',
    d: 'Organizers share a standing invite link. Whoever opens it sees the samahan’s name and how many people are in it, signs in, and taps Join. If it leaks, rotate it — the old link stops working immediately.',
    media: { kind: 'photo', src: '/demo/maria-jose/wall-4.webp', alt: 'Two women embracing and laughing beside a sunlit window' },
  },
  {
    chip: 'Stories',
    t: 'Short clips, gone after 24 hours',
    d: 'Tap Record and your phone camera takes a short clip, shrinks it, and posts it to the strip. The group is told your clip is there for the next 24 hours; after that it is gone, and you can take it down sooner yourself.',
    media: { kind: 'photo', src: '/demo/maria-jose/wall-7.webp', alt: 'Guests dancing under string lights on an open-air floor at dusk' },
  },
  {
    chip: 'Play the day',
    t: 'Watch the day the way it happened',
    d: 'The strip shows what is new first. Play the day runs every clip still up from the oldest to the newest, one after another, and tapping any clip plays from there to now.',
    media: { kind: 'photo', src: '/demo/maria-jose/wall-3.webp', alt: 'Guests watching a couple dance beneath strings of lights at nightfall' },
  },
  {
    chip: 'Usapan',
    t: 'The group chat, inside the group',
    d: 'Say something to the group and the rest of the samahan is told once in their Setnayan bell, however busy the chat gets. Your own messages are yours to take down.',
    media: { kind: 'photo', src: '/demo/maria-jose/wall-8.webp', alt: 'Bridesmaids laughing together with their bouquets' },
  },
  {
    chip: 'Events',
    t: 'Plan the reunion from here',
    d: 'An organizer plans the reunion, the outing, the tournament or the celebration from the Events tab, and every member finds it there. A samahan cannot own a wedding or another personal milestone — those stay with the person.',
    media: { kind: 'photo', src: '/demo/maria-jose/toast.webp', alt: 'A wedding party raising their glasses over candlelight' },
  },
];

export default function SamahanLandingPage() {
  return (
    <DoorwayPage
      title={'Your barkada, ninongs and family — together.'}
      /*
        A samahan is ACCOUNT-LEVEL, so the primary door is making one rather
        than starting a wedding. `/dashboard/samahan/new` is the create form;
        a signed-out person meets the sign-in wall there, which is the honest
        first step for a thing that needs an account to exist.
      */
      primary={{ href: '/dashboard/samahan/new', label: 'Create a samahan' }}
      secondary={{ href: '/features', label: 'See what else is free' }}
      productName="Samahan"
      studioKey="samahan"
      steps={STEPS}
      differentiator={{
        heading: 'A group that belongs to you, not to one event',
        lede: 'A samahan lives in your Setnayan account, not inside any wedding or party — so it is there whether or not something is on the calendar, and the next reunion or outing is planned from the same place.',
        rows: VS,
      }}
      faq={FAQ}
      closing={{
        heading: 'Start with the people',
        body: 'Name your samahan, share the link, and the barkada is in — with Usapan, stories that are gone after 24 hours, and the reunion planned from the same place.',
        href: '/dashboard/samahan/new',
        label: 'Create a samahan',
      }}
      structuredData={[APP_LD, FAQ_LD]}
    >
      <SpotlightSection
        productName="Samahan"
        heading="Chat, stories, and the next get-together"
        lede="Inside your group, for members only."
        items={SPOTLIGHTS}
      />
    </DoorwayPage>
  );
}
