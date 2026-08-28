/**
 * /papic — the public page for Papic, the guest photo-gallery experience.
 *
 * ─── WHY THIS PAGE LEFT THE SHARED DOORWAY TEMPLATE (2026-08-29) ──────────
 * Seven sibling product pages render through `DoorwayPage`, and that is still
 * right for them. Papic left it because the owner asked this page for four
 * things that CANNOT generalise to the other seven:
 *   1. *"we do not want the buttons on this page"* — the kit's hero is a
 *      headline plus a primary and secondary call to action.
 *   2. *"instead of showing the 16 different pricing tiers, we show +- and show
 *      what they can have"* — a live credit dial.
 *   3. *"QR codes should be ready for scan. these QR Codes should be face
 *      taggable"* — the demo, inline, instead of behind a button.
 *   4. *"can we show the exact feel of the event hub papic part?"* — the
 *      celebration page's own obsidian gallery, reproduced.
 * A credit dial and a pair of live QR codes have no meaning on the song page.
 * So this is a deliberate, Papic-only exception — NOT a template change.
 *
 * 🔒 THE THREE DOORWAY INVARIANTS SURVIVE THE EXIT, and they are the reason
 * `doorway-invariants.test.ts` still passes with no edit:
 *   • EXACTLY ONE <h1> — the hero heading below, and nothing else on the page.
 *   • ITS OWN canonical — `/papic`, declared once.
 *   • BOTH JSON-LD blocks — SoftwareApplication + FAQPage, emitted here as
 *     script tags because the kit is no longer doing it for us.
 * Losing any of these is silent on screen and fatal to a page whose whole job
 * is to be found. Do not "tidy" them away.
 *
 * ── NO PRICE IS TYPED ─────────────────────────────────────────────────────
 * `resolvePapicAnchor()` reads the rung tables, the free grant and the ACTIVE
 * catalog, so an admin reprice moves this page with no edit. A rung we cannot
 * price is DROPPED rather than rendered at ₱0, which on a price list reads as
 * "free". If every read degrades, the cost section is omitted entirely and the
 * rest of the page still stands. This file is on the
 * `lib/papic-copy-guardrails.test.ts` list: a literal photo count, clip count
 * or cap figure here fails CI, by design.
 *
 * ⚠ AUTO FACE-MATCHING IS PROMISED CAREFULLY. A guest who adds a selfie is
 * matched; a guest who never does is never matched at all. Say photos are READY
 * to find their people — never that a guest WILL be found automatically.
 */

import Link from 'next/link';
import Image from 'next/image';
import { studioDescription } from '@/lib/studio-apps';
import { Reveal } from '@/app/_components/marketing/_motion';
import { fetchV2CustomerCatalog } from '@/lib/v2-catalog';
import {
  readPapicPassTiers,
  readPapicFreeGrantPoints,
} from '@/lib/papic-tier-config-read';
import { PAPIC_POINTS_PER_PHOTO, PAPIC_POINTS_PER_CLIP } from '@/lib/papic-cameras-pure';
import { PapicScan } from './_papic-scan';
import { PapicFilm } from './_papic-film';
import { PapicDial, type PapicRung } from './_papic-dial';
import { PapicFeatures, PapicHub } from './_papic-sections';

/*
 * ⛔ NO `force-static` HERE, AND NO `revalidate`. This page sits inside
 * `app/(shell)/`, whose layout mounts a session-reading shell. In the installed
 * Next, `force-static` makes `cookies()` return an EMPTY JAR rather than
 * throwing — so the page would build green, stay edge-cached, and show a
 * signed-in person a signed-out rail for an hour at a time. The only symptom is
 * an absence. The group layout carries the caching decision; a page that
 * re-declares it is the bug. (`doorway-shell.test.ts` catches this.)
 */

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = 'Papic — Guest Photo Gallery for Weddings · Setnayan';
/** The document title ONLY. `metadata.title` is rendered through the root
 *  layout's `template: '%s · Setnayan'`, so a PAGE_TITLE that already ends in
 *  the brand came out as "… · Setnayan · Setnayan" on 11 live pages. The share
 *  cards and the structured-data name do NOT go through that template and are
 *  correct WITH the brand — which is why this strips it here and nowhere else. */
const DOC_TITLE = PAGE_TITLE.replace(/ · Setnayan$/, '');
// READ, never re-typed. The rail row and this page's search result are the same
// sentence by construction — `studio-apps.test.ts` fails the build if this page
// grows a literal of its own, which is the exact drift it exists to prevent.
const PAGE_DESCRIPTION = studioDescription('papic');
const OG_IMAGE = `${SITE_URL}/brand/og-card.webp`;

export const metadata = {
  title: DOC_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/papic' },
  keywords: [
    'wedding photo sharing Philippines',
    'guest photo gallery',
    'wedding photo app',
    'QR wedding photos',
    'shared wedding gallery',
    'candid wedding photos',
    'Papic',
    'Setnayan',
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/papic',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Papic — guest photo gallery for weddings' }],
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
  name: 'Papic — Guest Photo Gallery',
  url: `${SITE_URL}/papic`,
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Any (web browser)',
  description: PAGE_DESCRIPTION,
  featureList: [
    'Free credits on every celebration — no card, no trial clock',
    'Cameras are free and unlimited',
    'Guests become the photo crew — everyone contributes',
    'A QR scan tags who is in a photo — no typing',
    'Each guest gets their own personal gallery',
    'Face tagging a guest opts into, and can delete',
    'Anyone can ask not to be shown — the photo itself is blurred',
    'Every photo is screened before it can appear',
    'Photo challenges and video greetings',
    'A recap page, a keepsake magazine and a souvenir video',
    'The live wall, included',
    'Lives on the couple’s own celebration page',
    'The couple receives every photo, tagged or not',
  ],
  areaServed: 'Philippines',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

/**
 * The questions people actually stall on. The live page's old set answered
 * three things the page above already answers better, and covered none of
 * price, signal, opting out, retention or the shooting window.
 *
 * ⚠ Answer 5 must LEAD with "kept for life", and the shooting-window answer
 * must never be phrased as an expiry: nothing about Papic expires, and being
 * the one without an expiry is the strongest thing we can say.
 */
const FAQ = [
  {
    q: 'What is a credit?',
    a: `A credit is one photograph. A video costs by its length instead — the longer it runs, the more it takes, up to ${PAPIC_POINTS_PER_CLIP} credits for a ten-second video, which is the longest. Nothing else costs anything: the cameras and the live wall are free, however many you use.`,
  },
  {
    q: 'Do guests need an app?',
    a: 'No app and no account. A code and a browser is the whole thing.',
  },
  {
    q: 'Will we get all the photos?',
    a: 'Always — tagged or not, and whether or not the person in it asked to be hidden. That is the one promise with no exception.',
  },
  {
    q: 'What happens to the photos after the celebration?',
    a: 'They are kept for life, free, with nothing to renew. Nothing is ever deleted — after three months the original file is compressed, and the photograph stays.',
  },
  {
    q: 'What if the venue has no signal?',
    a: 'Shooting still works. Photos are held on the phone and send themselves when the signal comes back.',
  },
  {
    q: 'Can someone opt out of face matching?',
    a: 'Yes. A guest who never adds a selfie is never matched at all, and anyone can ask not to be shown — we blur the picture itself rather than hiding it behind a filter, and if the blurring fails the photo does not go up at all. Face data is deleted on request, and automatically three months after the celebration.',
  },
  {
    q: 'How long can we shoot for?',
    a: 'Cameras can open months before the day, so the engagement shoot and the rehearsal are already in there by the time the celebration arrives.',
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

/** The three steps. Copy kept from the live page — it was already good. */
const STEPS = [
  {
    n: '01',
    t: 'Your guests become the crew',
    img: '/demo/maria-jose/toast.webp',
    alt: 'A toast, photographed from a guest’s own seat',
    d: null,
  },
  {
    n: '02',
    t: 'Every photo finds its people',
    img: '/demo/maria-jose/details.webp',
    alt: 'A printed card on the table',
    d: 'Hold a guest’s place card — or a table sign, for everyone at that table — in frame, and those photos sort straight into their own galleries.',
  },
  {
    n: '03',
    t: 'Everyone goes home with theirs',
    img: '/demo/maria-jose/wall-8.webp',
    alt: 'A guest mid-laugh — the photograph she goes home with',
    d: null,
  },
] as const;

/** The comparison. These five rows are the shipped ones; the last is swapped
 *  for the privacy row, which is this page's entire privacy footprint in copy. */
const VS: readonly (readonly [string, string])[] = [
  ['A shared link everyone digs through', 'Each guest’s own gallery, sorted as you shoot'],
  ['Photos only', 'Photos and ten-second candid videos'],
  ['You scroll to find yourself', 'Your photos find you'],
  ['A separate site that expires', 'Lives on your own celebration page'],
  ['Someone always ends up in a photo they hate', 'Anyone can ask to disappear'],
];

/**
 * ⚠ THE ONE NUMBER ON THIS PAGE THAT IS NOT READ OUT OF THE PRODUCT.
 *
 * The owner asked the dial to name an ideal per celebration. The product has no
 * such figure to read. The nearest thing — 150 per guest, in
 * `papic_event_pool_config.points_per_guest` — is a SPEND CEILING for events
 * holding a flat pass (the most a celebration MAY capture), not a
 * recommendation; quoting it would point a 150-guest wedding at the top of the
 * ladder. So the recommendation is expressed as arithmetic anyone can check —
 * "enough for every guest to take about N photographs" — and N lives here,
 * alone, awaiting the owner. Moving this one number moves the page.
 */
const IDEAL_PHOTOGRAPHS_PER_GUEST = 15;

type PapicAnchor = { rungs: PapicRung[]; freeCredits: number };

/**
 * Fails QUIET, never loud. Each read degrades on its own, a rung with no price
 * is dropped rather than shown at ₱0, and if nothing resolves the whole cost
 * section is omitted and the page renders without it.
 */
async function resolvePapicAnchor(): Promise<PapicAnchor | null> {
  const [catalog, poolTiers, freeCredits] = await Promise.all([
    fetchV2CustomerCatalog(),
    readPapicPassTiers(),
    readPapicFreeGrantPoints(),
  ]);
  const priceOf = (code: string): number | null => {
    const row = catalog.find((c) => c.service_code === code);
    const php = row ? Number(row.retail_price_php) : NaN;
    return Number.isFinite(php) && php > 0 ? php : null;
  };
  // The repeatable top-up rung is excluded for the same reason /pricing
  // excludes it: it is a re-buy for an event that already holds a big pool.
  const priced = poolTiers
    .filter((t) => !t.isTopup)
    .map((t) => ({ bought: t.points, peso: priceOf(t.serviceCode) }))
    .filter((r): r is PapicRung => r.peso !== null && r.bought > 0)
    .sort((a, b) => a.peso - b.peso);

  if (priced.length === 0 && freeCredits <= 0) return null;
  // Rung zero is "buy nothing" — the free grant on its own. The dial opens here.
  return { rungs: [{ peso: 0, bought: 0 }, ...priced], freeCredits };
}

export default async function PapicLandingPage() {
  const anchor = await resolvePapicAnchor();
  const free = anchor?.freeCredits ?? 0;

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

      {/* ── HERO ────────────────────────────────────────────────────────────
          No eyebrow, no sub-paragraph (owner 2026-08-19), and NO BUTTONS
          (owner 2026-08-29). The photograph is ours and was shot from a
          guest's own seat — the product's premise in one frame. */}
      <section className="mx-auto max-w-2xl">
        <h1 className="font-serif text-[2.05rem] leading-[1.14] tracking-tight text-[var(--m-ink)] sm:text-5xl">
          Every guest goes home with their own photos.
        </h1>
        <div className="relative mt-6 aspect-[4/5] overflow-hidden rounded-2xl border border-[var(--m-line)] sm:aspect-[16/10]">
          <Image
            src="/demo/maria-jose/wall-1.webp"
            alt="A toast at a Filipino reception, photographed from a guest’s own seat"
            fill
            priority
            sizes="(min-width:768px) 672px, 100vw"
            className="object-cover"
          />
          {free > 0 ? (
            <p className="absolute bottom-3 left-3 rounded-lg bg-black/75 px-2.5 py-1.5 font-mono text-xs text-[var(--m-paper)] backdrop-blur">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--m-mulberry)] align-middle" />
              {free.toLocaleString('en-PH')} credits left
            </p>
          ) : null}
        </div>
      </section>

      {/* ── THE THREE FACTS ─────────────────────────────────────────────── */}
      <section className="mx-auto mt-8 max-w-2xl" aria-label="What Papic gives you">
        <ul className="space-y-2 text-[0.95rem]">
          {free > 0 ? (
            <Fact>
              <span className="font-mono tabular-nums text-[var(--m-ink)]">
                {free.toLocaleString('en-PH')}
              </span>{' '}
              free credits on every celebration
            </Fact>
          ) : null}
          <Fact>No app. No account.</Fact>
          <Fact>Yours for life.</Fact>
        </ul>
      </section>

      {/* ── SCAN IT ─────────────────────────────────────────────────────────
          With no buttons on the page, the code is the door. */}
      <section className="mx-auto mt-16 max-w-2xl" aria-label="Try Papic now">
        <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[var(--m-orange-2)]">
          Point your phone at this
        </p>
        <h2 className="mt-2 font-serif text-2xl tracking-tight text-[var(--m-ink)] sm:text-3xl">
          Two codes. Two phones. Right now.
        </h2>
        <p className="mt-2 text-sm text-[var(--m-ink)]/65">
          Scan one each, with someone next to you. Each phone reads its own face, and the photos you
          take of each other come back knowing who is in them.
        </p>
        <div className="mt-5">
          <PapicScan />
        </div>
      </section>

      {/* ── THE APP, RUNNING ────────────────────────────────────────────────
          Not a mock-up: a recording of the same scenes the live demo renders,
          so it can never drift from the product. Ours already, and it had never
          appeared on a public page. */}
      <section className="mx-auto mt-16 max-w-2xl" aria-label="The Papic camera">
        <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[var(--m-orange-2)]">
          The app itself
        </p>
        <h2 className="mt-2 font-serif text-2xl tracking-tight text-[var(--m-ink)] sm:text-3xl">
          This is all of it.
        </h2>
        <div className="mt-5 flex items-center gap-5">
          <PapicFilm />
          <p className="text-sm text-[var(--m-ink)]/65">
            There is nothing to install and nothing to set up. A guest points their phone at a code
            and the camera is already open —{' '}
            <span className="font-medium text-[var(--m-ink)]">
              this is the whole thing they ever see.
            </span>
          </p>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────── */}
      <section className="mx-auto mt-16 max-w-3xl" aria-label="How Papic works">
        <div className="grid gap-5 sm:grid-cols-3">
          {STEPS.map((s) => (
            <Reveal key={s.n}>
              <article className="overflow-hidden rounded-2xl border border-[var(--m-line)]">
                <div className="relative aspect-[9/11]">
                  <Image
                    src={s.img}
                    alt={s.alt}
                    fill
                    sizes="(min-width:640px) 300px, 100vw"
                    className="object-cover"
                  />
                </div>
                <div className="px-4 pb-5 pt-3.5">
                  <span className="font-mono text-xs text-[var(--m-orange-2)]">{s.n}</span>
                  <h3 className="mt-1 font-serif text-[1.02rem] text-[var(--m-ink)]">{s.t}</h3>
                  {s.d ? <p className="mt-1.5 text-sm text-[var(--m-ink)]/65">{s.d}</p> : null}
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        {/* The payoff the page claims and never showed: not one album, but a
            folder per person. Real guests, from our own demo celebration. */}
        <p className="mt-8 text-sm text-[var(--m-ink)]/65">
          By the end of the night nobody has one album. Everybody has their own.
        </p>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FOLDERS.map((f) => (
            <div key={f.src} className="w-[66px] flex-none text-center">
              <Image
                src={f.src}
                alt=""
                width={66}
                height={66}
                className="h-[66px] w-[66px] rounded-full border border-[var(--m-line)] object-cover"
              />
              <div className="mt-1.5 font-mono text-[0.6rem] tabular-nums text-[var(--m-ink)]/55">
                {f.n}
              </div>
            </div>
          ))}
        </div>
      </section>

      <PapicFeatures />
      <PapicHub />

      {/* ── NOT A SHARED PHOTO DUMP ─────────────────────────────────────── */}
      <section className="mx-auto mt-16 max-w-2xl" aria-label="How Papic differs">
        <h2 className="font-serif text-2xl tracking-tight text-[var(--m-ink)] sm:text-3xl">
          Not a shared photo dump
        </h2>
        <p className="mt-2 text-sm text-[var(--m-ink)]/65">
          A photo wall gives everyone one pile to scroll. Papic gives each guest their own night
          back.
        </p>
        <dl className="mt-5 border-t border-[var(--m-line)]">
          {VS.map(([them, us]) => (
            <div
              key={us}
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5 border-b border-[var(--m-line)] py-3 text-[0.92rem]"
            >
              <dt className="text-[var(--m-ink)]/55">{them}</dt>
              <span aria-hidden className="font-mono text-xs text-[var(--m-orange-2)]">
                →
              </span>
              <dd className="m-0 font-semibold text-[var(--m-ink)]">{us}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── TWO WAYS TO RUN IT — before the cost, so people know what they
             would be buying before they are told a number. ───────────────── */}
      <section className="mx-auto mt-16 max-w-3xl" aria-label="Two ways to use Papic">
        <h2 className="font-serif text-2xl tracking-tight text-[var(--m-ink)] sm:text-3xl">
          Two ways to run it
        </h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="rounded-2xl border border-[var(--m-line)] p-5">
            <h3 className="font-serif text-lg text-[var(--m-ink)]">Give a camera its own credits</h3>
            <p className="mt-2 text-sm text-[var(--m-ink)]/65">
              Set aside some of your credits for the few friends or family you trust — theirs alone,
              all night, on their own code. Nobody else can spend them, and you can take back
              whatever they don’t use.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--m-line)] p-5">
            <h3 className="font-serif text-lg text-[var(--m-ink)]">Let the whole room shoot</h3>
            <p className="mt-2 text-sm text-[var(--m-ink)]/65">
              Everything you haven’t set aside stays in one shared pot, and every guest shoots from
              their own phone — like handing each table a digital disposable camera.
            </p>
          </div>
        </div>
      </section>

      {/* ── WHAT IT COSTS — sixteen rows become one dial. ─────────────────── */}
      {anchor ? (
        <section className="mx-auto mt-16 max-w-2xl" aria-label="What Papic costs">
          <h2 className="font-serif text-2xl tracking-tight text-[var(--m-ink)] sm:text-3xl">
            What it costs
          </h2>
          <p className="mt-2 text-sm text-[var(--m-ink)]/65">
            Start free. Move the dial only if you run out.
          </p>

          {/* The credit, explained where the money is — not only in the FAQ.
              Both figures are DERIVED; a literal here fails the copy guard. */}
          <ul className="mt-4 list-none rounded-xl border border-[var(--m-line)] px-4 py-3">
            <li className="py-0.5 text-[0.88rem] text-[var(--m-ink)]/65">
              <Cost n={PAPIC_POINTS_PER_PHOTO} /> one photograph
            </li>
            <li className="py-0.5 text-[0.88rem] text-[var(--m-ink)]/65">
              <Cost n={PAPIC_POINTS_PER_CLIP} /> a ten-second video, the longest there is
            </li>
            <li className="py-0.5 text-[0.88rem] text-[var(--m-ink)]/65">
              A shorter video costs less, by how long it runs
            </li>
          </ul>

          <div className="mt-4">
            <PapicDial
              rungs={anchor.rungs}
              freeCredits={anchor.freeCredits}
              clipCost={PAPIC_POINTS_PER_CLIP}
              idealPerGuest={IDEAL_PHOTOGRAPHS_PER_GUEST}
            />
          </div>

          <p className="mt-4 text-sm text-[var(--m-ink)]/65">
            Every amount is repeatable and stacks on what the celebration already holds, credited in
            seconds, mid-party.{' '}
            <Link href="/pricing" className="font-medium text-[var(--m-mulberry)] hover:opacity-80">
              See every amount →
            </Link>
          </p>
        </section>
      ) : null}

      {/* ── QUESTIONS — closed by default. ───────────────────────────────── */}
      <section className="mx-auto mt-16 max-w-2xl" aria-label="Questions about Papic">
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
              <p className="pb-4 text-[0.93rem] text-[var(--m-ink)]/65">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── CLOSING — no buttons. The page ends on the fact; the codes above
             are the way in. ───────────────────────────────────────────────── */}
      <section className="mx-auto mt-16 max-w-2xl" aria-label="Papic, in one line">
        {free > 0 ? (
          <p className="font-serif text-2xl leading-snug tracking-tight text-[var(--m-ink)] sm:text-3xl">
            <span className="font-mono tabular-nums">{free.toLocaleString('en-PH')}</span> credits,
            free, on every celebration.
          </p>
        ) : null}
        <p className="mt-3 text-sm text-[var(--m-ink)]/65">
          Papic lives on the celebration page you already have, beside the guest list, the RSVP and
          the seating. There is nothing separate to buy, and nothing that expires.
        </p>
      </section>
    </main>
  );
}

/** Guest portraits from our own demo celebration, with their own counts. */
const FOLDERS = [
  { src: '/demo/maria-jose/portraits/084b7484-38a4-47c1-ac96-52ce38746c3c.webp', n: 34 },
  { src: '/demo/maria-jose/portraits/22d6a870-4090-4a2d-82ca-dc7c744e54c0.webp', n: 21 },
  { src: '/demo/maria-jose/portraits/25dd3409-063d-4d1d-b30c-22385048a0c3.webp', n: 58 },
  { src: '/demo/maria-jose/portraits/34b8e383-6bff-40c5-82d8-4f4b270cf163.webp', n: 12 },
  { src: '/demo/maria-jose/portraits/3a98be56-27e1-41c4-bd5f-dae5db45614a.webp', n: 47 },
  { src: '/demo/maria-jose/portraits/472ba3b1-032a-4346-a7fb-707d1614dc22.webp', n: 29 },
  { src: '/demo/maria-jose/portraits/4aeae921-655e-411d-ae16-d165c53bda03.webp', n: 63 },
  { src: '/demo/maria-jose/portraits/58d37cc7-2a0c-42e2-bd06-00925f3e5274.webp', n: 18 },
] as const;

function Fact({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-baseline gap-2.5">
      <span aria-hidden className="translate-y-px text-[var(--m-orange-2)]">
        ✓
      </span>
      <span className="text-[var(--m-ink)]/80">{children}</span>
    </li>
  );
}

function Cost({ n }: { n: number }) {
  return (
    <>
      <span className="mr-2 inline-block min-w-[2.2em] font-mono font-medium tabular-nums text-[var(--m-ink)]">
        {n}
      </span>
      <span className="mr-1.5">credit{n === 1 ? '' : 's'} ·</span>
    </>
  );
}
