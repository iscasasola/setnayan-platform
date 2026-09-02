/**
 * /pa3d — public marketing landing page for 3D Plan (www.setnayan.com/pa3d).
 *
 * ─── WHY THIS IS NOT A `DoorwayPage` ANY MORE (owner 2026-09-02) ───────────
 * Owner: *"follow the concept of papic but still adjust it to its best flow to
 * make sure it is delivered attractive to the viewers."*
 *
 * Six sibling product pages render through `DoorwayPage` and should keep doing
 * so — it is the right shape for a product you can only describe. `/papic`
 * left it because Papic can be HANDED to you on the page itself, and 3D Plan
 * is the only other product that can. Papic's concept, beat for beat:
 *
 *   1. the premise in one frame, no buttons competing with it
 *   2. try it RIGHT NOW, on this page, with a linkable address
 *   3. the product actually running — never a mock-up
 *   4. only then, the argument, the steps, the price
 *
 * ─── WHERE IT DEVIATES, AND WHY ───────────────────────────────────────────
 * Papic's beats 1 and 2 are separate because its premise is a PHOTOGRAPH and
 * its interaction is two QR codes — genuinely two moments. 3D Plan's premise
 * *is* the interaction: the room. Splitting them would put a picture of a room
 * above a button that opens the room, and argue against itself. So beats 1–3
 * collapse into one: the room is the hero, and stepping into it is the demo.
 *
 * ─── IMAGE-LED, AND WITH NO BUTTONS (owner 2026-09-02) ────────────────────
 * *"more photos and imagery. less text. important to use animations and effect
 * to make this attractive to the users browsing."* — so the copy carries only
 * what a photograph cannot, real frames from the sample wedding do the rest,
 * and the motion lives in `_pa3d-motion.tsx` / `_pa3d.css` (CSS only, every
 * effect off under `prefers-reduced-motion`).
 *
 * Then, of the closing CTA block: *"i don't think we need this."* It is gone,
 * which lands this page on Papic's shape exactly — **no buttons at all.** The
 * room IS the door, and `/pa3d/try` is the link you can paste. One consequence
 * is recorded rather than absorbed: with no primary CTA there is nothing for
 * `studioKey` to swap, so `AddToEventCta` left with it and a signed-in couple
 * loses the *Add to an event* shortcut FROM THIS PAGE (the capability is
 * unchanged — 3D Plan is added from the Studio inside the celebration). See
 * the second entry in `add-to-event-is-the-only-difference.test.ts`.
 *
 * The seating plan stays FREE (locked); 3D Plan is the paid walk. Copy sells
 * benefits only — no mechanism, no prices (admin-managed; /pricing owns them).
 */

import Link from 'next/link';
import Image from 'next/image';
import { Reveal, Blob } from '@/app/_components/marketing/_motion';
import { KenBurns, PhotoRail } from './_pa3d-motion';
import { studioDescription } from '@/lib/studio-apps';
import { Pa3dRoom } from './_pa3d-room';

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = '3D Plan — Walk Your Reception in 3D Before the Day · Setnayan';
/** The document title ONLY — the root layout appends "· Setnayan" via its
 *  `template`, so a PAGE_TITLE that already carries the brand came out doubled
 *  on 11 live pages. Share cards and structured data do NOT go through that
 *  template and are correct WITH the brand, which is why this strips it here
 *  and nowhere else. */
const DOC_TITLE = PAGE_TITLE.replace(/ · Setnayan$/, '');
/*
 * 🔑 THE DESCRIPTION IS NOT AUTHORED HERE — it is read from `lib/studio-apps.ts`,
 * the ONE place the Studio products are described, so this page's search result
 * and the rail's row for it can never disagree. Do not re-inline it: two
 * hand-typed strings that must agree is not a mechanism, it is a future drift.
 */
const PAGE_DESCRIPTION = studioDescription('pa3d');
const OG_IMAGE = `${SITE_URL}/brand/og-card.webp`;

/*
  ⚠ `dynamic` IS DECLARED ONCE, ON `app/(shell)/layout.tsx`, NOT HERE.
  The shared shell reads the session, so every route in this group must be
  dynamic — and a layout's `dynamic` DOES cover its children. This file used to
  carry its own copy along with a docblock asserting a layout could not do this.
  That assertion was false. Do not re-add it.
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
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: '3D Plan — walk your reception in 3D before the day',
      },
    ],
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
  name: '3D Plan',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: `${SITE_URL}/pa3d`,
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
    n: '01',
    t: 'Lay out your tables',
    d: 'The seating plan — free, in every wedding.',
    img: '/demo/maria-jose/reception.webp',
    alt: 'A laid reception table set for a Filipino wedding',
  },
  {
    n: '02',
    t: 'Stand the room up',
    d: 'Your flat plan becomes a room you can walk.',
    img: '/demo/maria-jose/details.webp',
    alt: 'Table details and place settings at a reception',
  },
  {
    n: '03',
    t: 'Fix it before the day',
    d: 'The tight aisle. The blocked view. While it is still a plan.',
    img: '/demo/maria-jose/firstdance.webp',
    alt: 'A couple’s first dance on the reception floor',
  },
];

/** Real photographs from the sample wedding — the day the room becomes. */
const RAIL = [
  { src: '/demo/maria-jose/ceremony.webp', alt: 'The ceremony' },
  { src: '/demo/maria-jose/reception.webp', alt: 'The reception, set' },
  { src: '/demo/maria-jose/toast.webp', alt: 'A toast at the table' },
  { src: '/demo/maria-jose/firstdance.webp', alt: 'The first dance' },
  { src: '/demo/maria-jose/details.webp', alt: 'Place settings and details' },
  { src: '/demo/maria-jose/wall-2.webp', alt: 'Guests together on the floor' },
  { src: '/demo/maria-jose/wall-5.webp', alt: 'A candid from a guest’s seat' },
  { src: '/demo/maria-jose/wall-8.webp', alt: 'Late in the night' },
] as const;

const VS = [
  ['A flat chart from above', 'A room you can stand inside'],
  ['Guess what each guest sees', 'See it from any seat'],
  ['Surprises on the day', 'Fixes while there’s still time'],
  ['Picture it in your head', 'Show everyone the same room'],
] as const;

export default function ThreeDPlanLandingPage() {
  return (
    <main className="relative px-5 pb-24 pt-10 sm:pt-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(APP_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }}
      />
      <Blob top={-40} right={-120} size={520} color="var(--m-orange)" opacity={0.09} />

      {/* ── HERO ──────────────────────────────────────────────────────────
          One line, one photograph, then the room. No competing buttons —
          Papic's rule, and it matters more here: the only thing anyone should
          want to do at the top of this page is step into the room. */}
      <section className="mx-auto max-w-2xl">
        <h1 className="font-serif text-[2.05rem] leading-[1.14] tracking-tight text-[var(--m-ink)] sm:text-5xl">
          Walk your reception before it’s built.
        </h1>
        <Reveal>
          <figure className="relative mt-6 overflow-hidden rounded-2xl border border-[var(--m-line)]">
            <KenBurns
              src="/demo/maria-jose/reception.webp"
              alt="A Filipino wedding reception, laid and lit before the guests arrive"
              priority
              className="aspect-[4/5] sm:aspect-[16/10]"
            />
            <figcaption className="pa3d-scrim absolute inset-x-0 bottom-0 px-4 pb-4 pt-12">
              <p className="font-serif text-lg text-[var(--m-paper)] sm:text-xl">
                This is the night. You get to stand in it first.
              </p>
            </figcaption>
          </figure>
        </Reveal>
        <div className="mt-4">
          <Pa3dRoom />
        </div>
        <p className="mt-3 text-sm text-[var(--m-slate-2)]">
          Sending this to someone?{' '}
          <Link href="/pa3d/try" className="font-medium text-[var(--m-mulberry)] hover:opacity-80">
            setnayan.com/pa3d/try
          </Link>
        </p>
      </section>

      {/* ── THE DAY IT BECOMES ────────────────────────────────────────────
          Photographs, drifting. One line of copy, because the pictures are
          the argument here and text would only get in their way. */}
      <section className="mt-16" aria-label="The day the room becomes">
        <p className="mx-auto max-w-2xl font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[var(--m-orange-2)]">
          The room, hours later
        </p>
        <div className="mt-4">
          <PhotoRail photos={RAIL} />
        </div>
      </section>

      {/* ── THE ARGUMENT ──────────────────────────────────────────────────
          Below the room on purpose: having just stood in it, the contrast is
          something they felt rather than something we claimed. */}
      <section className="mx-auto mt-16 max-w-2xl" aria-label="Why a room beats a chart">
        <h2 className="font-serif text-2xl tracking-tight text-[var(--m-ink)] sm:text-3xl">
          A plan tells you who sits where. A room tells you how it feels.
        </h2>
        <dl className="mt-5 border-t border-[var(--m-line)]">
          {VS.map(([flat, room]) => (
            <div
              key={flat}
              className="grid grid-cols-1 gap-1 border-b border-[var(--m-line)] py-3.5 sm:grid-cols-2 sm:gap-4"
            >
              <dt className="text-[0.93rem] text-[var(--m-slate-2)] line-through decoration-[var(--m-line)]">
                {flat}
              </dt>
              <dd className="text-[0.98rem] font-medium text-[var(--m-ink)]">{room}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── THREE STEPS — a picture and a line each. ──────────────────────── */}
      <section className="mx-auto mt-16 max-w-2xl" aria-label="How 3D Plan works">
        <h2 className="font-serif text-2xl tracking-tight text-[var(--m-ink)] sm:text-3xl">
          It’s the plan you already made.
        </h2>
        <ol className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 90}>
              <li className="pa3d-lift h-full overflow-hidden rounded-2xl border border-[var(--m-line)] bg-[var(--m-paper)]">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={s.img}
                    alt={s.alt}
                    fill
                    sizes="(min-width:640px) 220px, 100vw"
                    className="object-cover"
                  />
                </div>
                <div className="px-4 pb-5 pt-3.5">
                  <span className="font-mono text-xs text-[var(--m-orange-2)]">{s.n}</span>
                  <h3 className="mt-1 font-serif text-[1.05rem] text-[var(--m-ink)]">{s.t}</h3>
                  <p className="mt-1 text-[0.9rem] text-[var(--m-slate-2)]">{s.d}</p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* ── THE GUEST'S SIDE ──────────────────────────────────────────────
          The half a static page cannot show. Picture-led, two lines. */}
      <section className="mx-auto mt-16 max-w-2xl" aria-label="What your guests get">
        <Reveal>
          <figure className="relative overflow-hidden rounded-2xl border border-[var(--m-line)]">
            <div className="relative aspect-[16/10]">
              <Image
                src="/demo/maria-jose/toast.webp"
                alt="Guests raising a toast at their table"
                fill
                sizes="(min-width:768px) 672px, 100vw"
                className="object-cover"
              />
            </div>
            <figcaption className="pa3d-scrim absolute inset-x-0 bottom-0 px-4 pb-4 pt-12">
              <p className="font-serif text-lg text-[var(--m-paper)] sm:text-xl">
                Your guests find their own seat.
              </p>
            </figcaption>
          </figure>
        </Reveal>
        <p className="mt-3 text-sm text-[var(--m-slate-2)]">
          No app, no account, no line at the entrance squinting at a board. Tap any seated guest in
          the room above and you’ll get the exact code one of them would.
        </p>
      </section>

      {/* ── QUESTIONS — closed by default, matching /papic. ───────────────── */}
      <section className="mx-auto mt-16 max-w-2xl" aria-label="Questions about 3D Plan">
        <h2 className="font-serif text-2xl tracking-tight text-[var(--m-ink)] sm:text-3xl">
          Questions, answered
        </h2>
        <div className="mt-4 border-t border-[var(--m-line)]">
          {FAQ.map((f) => (
            <details key={f.q} className="border-b border-[var(--m-line)]">
              <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4 py-3.5 text-[0.98rem] font-semibold text-[var(--m-ink)] [&::-webkit-details-marker]:hidden">
                {f.q}
                <span aria-hidden className="flex-none font-mono text-[var(--m-orange-2)]">
                  +
                </span>
              </summary>
              <p className="pb-4 text-[0.93rem] text-[var(--m-slate-2)]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

    </main>
  );
}
