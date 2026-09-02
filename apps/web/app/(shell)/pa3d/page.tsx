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
 * The seating plan stays FREE (locked); 3D Plan is the paid walk. Copy sells
 * benefits only — no mechanism, no prices (admin-managed; /pricing owns them).
 */

import Link from 'next/link';
import { Reveal } from '@/app/_components/marketing/_motion';
import { AddToEventCta } from '@/app/_components/marketing/add-to-event-cta';
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
    t: 'Plan your tables — free',
    d: 'Lay out your reception in Setnayan’s seating plan: your tables, your head table, your dance floor, every guest in a seat. The whole tool is free.',
  },
  {
    n: '02',
    t: 'Stand up the room',
    d: 'Switch to 3D Plan and your flat plan rises into a room you can walk. See the space the way your guests will, from any seat in the house.',
  },
  {
    n: '03',
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
    <main className="px-5 pb-24 pt-10 sm:pt-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(APP_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }}
      />

      {/* ── HERO ──────────────────────────────────────────────────────────
          One line, then the room. No buttons competing with it — Papic's rule
          (owner 2026-08-29), and it matters more here: the only thing anyone
          should want to do at the top of this page is step into the room. */}
      <section className="mx-auto max-w-2xl">
        <h1 className="font-serif text-[2.05rem] leading-[1.14] tracking-tight text-[var(--m-ink)] sm:text-5xl">
          Walk your reception before it’s built.
        </h1>
        <div className="mt-6">
          <Pa3dRoom />
        </div>
        <p className="mt-3 text-sm text-[var(--m-slate-2)]">
          Sending this to someone?{' '}
          <Link href="/pa3d/try" className="font-medium text-[var(--m-mulberry)] hover:opacity-80">
            setnayan.com/pa3d/try
          </Link>{' '}
          opens straight to the room.
        </p>
      </section>

      {/* ── THE ARGUMENT ──────────────────────────────────────────────────
          Placed AFTER the room on purpose: having just stood in it, the
          contrast lands as something they felt, not something we claimed. */}
      <section className="mx-auto mt-16 max-w-2xl" aria-label="Why a 3D room beats a flat chart">
        <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[var(--m-orange-2)]">
          More than a chart
        </p>
        <h2 className="mt-2 font-serif text-2xl tracking-tight text-[var(--m-ink)] sm:text-3xl">
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

      {/* ── HOW ───────────────────────────────────────────────────────────── */}
      <section className="mx-auto mt-16 max-w-2xl" aria-label="How 3D Plan works">
        <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[var(--m-orange-2)]">
          Three steps
        </p>
        <h2 className="mt-2 font-serif text-2xl tracking-tight text-[var(--m-ink)] sm:text-3xl">
          It’s the plan you already made.
        </h2>
        <ol className="mt-5 space-y-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 60}>
              <li className="rounded-2xl border border-[var(--m-line)] bg-[var(--m-paper)] p-5">
                <p className="font-mono text-[0.7rem] tracking-[0.1em] text-[var(--m-orange-2)]">
                  {s.n}
                </p>
                <h3 className="mt-1 font-serif text-[1.15rem] text-[var(--m-ink)]">{s.t}</h3>
                <p className="mt-1.5 text-[0.93rem] text-[var(--m-slate-2)]">{s.d}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* ── EVERY GUEST'S ROOM, NOT JUST YOURS ────────────────────────────
          The half of the product a static page cannot show and the demo can:
          the couple builds it, but the GUEST is who walks it on the day. */}
      <section className="mx-auto mt-16 max-w-2xl" aria-label="What your guests get">
        <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[var(--m-orange-2)]">
          On the day
        </p>
        <h2 className="mt-2 font-serif text-2xl tracking-tight text-[var(--m-ink)] sm:text-3xl">
          Your guests find their own seat.
        </h2>
        <p className="mt-2 text-sm text-[var(--m-slate-2)]">
          You built the room to get it right. They open it to know where they’re sitting — their
          name, their table, the walk to their chair, on the phone already in their hand. No app,
          no account, no line at the entrance squinting at a board.
        </p>
        <p className="mt-3 text-sm text-[var(--m-slate-2)]">
          Tap any seated guest in the room above and you’ll get the exact code one of your guests
          would.
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

      {/* ── CLOSING ───────────────────────────────────────────────────────
          One button, not two. The room above is the other door, and it is a
          better one than a second link to the same place. */}
      <section className="mx-auto mt-16 max-w-2xl" aria-label="Start planning">
        <p className="font-serif text-2xl leading-snug tracking-tight text-[var(--m-ink)] sm:text-3xl">
          The seating plan is free. The walk is the upgrade.
        </p>
        <p className="mt-3 text-sm text-[var(--m-slate-2)]">
          Lay out your tables inside your Setnayan celebration — free, for every wedding — and add
          3D Plan when you want to stand in the room.
        </p>
        {/* ⚠ `AddToEventCta`, NOT a bare Link — signed OUT it renders exactly
            this page's primary CTA, signed IN it becomes the "Add to an event"
            picker. Papic dropped its `studioKey` when the owner removed every
            button from that page, so there was no CTA left to swap; this page
            still has one, so dropping it here would silently cost a signed-in
            couple the shortcut. `add-to-event-is-the-only-difference.test.ts`
            keeps `pa3d` on its expected list for that reason. */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <AddToEventCta
            studioKey="pa3d"
            primary={{ href: '/onboarding/wedding?from=pa3d', label: 'Start planning · free' }}
          />
          <Link
            href="/pricing"
            className="inline-flex items-center rounded-full border border-[var(--m-line)] px-6 py-3 text-sm font-medium text-[var(--m-ink)]"
          >
            See pricing
          </Link>
        </div>
      </section>
    </main>
  );
}
