/**
 * /papic — public marketing landing page for Papic, the guest photo-gallery
 * experience (www.setnayan.com/papic).
 *
 * Part of the "lead with the media layer" public-surface pass (2026-06-20
 * demand-research verdict): Papic is one of the two proven differentiators that
 * incumbents (BridalPod, the ₱699 "photo wall" apps) don't have, and it had no
 * indexable, citable landing page. This is that page — the SEO/GEO surface for
 * "wedding photo sharing Philippines" / "guest photo gallery".
 *
 * Server component, statically rendered. The interactive guest tooling lives at
 * /papic/guest (auth/QR-scoped); this root route is pure marketing. The
 * persistent SiteChrome nav renders because '/papic' is registered in
 * NAV_ROUTES (site-chrome.tsx). Copy sells BENEFITS first (public-surface
 * hygiene) and still links to /pricing for the full ladder.
 *
 * ── THE PRICE ANCHOR IS DERIVED, NEVER TYPED (added 2026-07-30) ─────────────
 * This page used to quote no price at all, on the stated grounds that "prices are
 * admin-managed + provisional". That instinct was right about HARDCODING and
 * wrong about silence: the highest-intent Papic page in the product never told a
 * couple that Papic starts free, so the one fact most likely to convert was
 * missing. `resolvePapicAnchor()` below reads the live rung tables
 * (`papic_pass_tiers` / `papic_one_tiers`), the two admin-editable free
 * allowances (`papic_event_pool_config`) and the active catalog, then renders
 * through the `papic-tier-copy` helpers — so an admin reprice moves this page
 * without an edit, and a rung we cannot price DROPS OUT rather than rendering a
 * guess. If every read degrades (no service key at build time), the whole block
 * is omitted and the page is byte-identical to before.
 *
 * ⚠ AUTO FACE-MATCHING IS NOT PROMISED HERE (fixed 2026-07-30). Three places on
 * this page — a FAQ answer, step 02, and a comparison row — stated that Papic
 * "recognises faces and sorts each one to the guests in it, automatically, in
 * real time". There is no hosted matching model: enrollment ships, the matcher
 * does not, and QR-scan tagging carries the load. Those claims were also inside
 * the FAQPage JSON-LD, i.e. quotable by answer engines as a live capability.
 * Copy law (promotion BUILD SPEC §3-5): a surface may say photos are READY for
 * tagging, never that a guest WILL be found automatically.
 */

import Link from 'next/link';
import { Reveal } from '@/app/_components/marketing/_motion';
import { fetchV2CustomerCatalog } from '@/lib/v2-catalog';
import {
  readPapicPassTiers,
  readPapicOneTiers,
  readPapicFreeGrantPoints,
  readPapicFreeOneCameraPoints,
} from '@/lib/papic-tier-config-read';
import {
  papicPoolRungPhrase,
  papicOneRungPhrase,
  papicBucketPhrase,
  papicPointCurrencyTerms,
} from '@/lib/papic-tier-copy';
import {
  LineRevealHeading,
  RevealBand,
  RevealList,
  HowItWorksPanel,
  SettleTiles,
} from './_papic-motion';

export const dynamic = 'force-static';
export const revalidate = 3600;

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = 'Papic — Guest Photo Gallery for Weddings · Setnayan';
const PAGE_DESCRIPTION =
  'Papic turns your guests into your photo crew. Everyone shoots, every photo finds the people in it, and each guest goes home with their own gallery — plus a personal video reel set to music. The candid wedding moments one photographer can’t be everywhere for, delivered to everyone. Philippines-first.';
const OG_IMAGE = `${SITE_URL}/brand/og-card.webp`;

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/papic' },
  keywords: [
    'wedding photo sharing Philippines',
    'guest photo gallery',
    'wedding photo app',
    'QR wedding photos',
    'shared wedding gallery',
    'wedding video reel',
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

// SoftwareApplication JSON-LD — names the moat for AI answer engines. No price
// (admin-managed + provisional); publisher references the site-wide Organization
// (@id in app/layout.tsx).
const APP_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Papic — Guest Photo Gallery',
  url: `${SITE_URL}/papic`,
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Any (web browser)',
  description: PAGE_DESCRIPTION,
  featureList: [
    'One shared pot of shots any guest’s phone can spend from',
    'Give any camera its own shots, on its own QR, that nobody else can spend',
    'Free to start on every event — no card, no trial clock',
    'Guests become the photo crew — everyone contributes',
    'A QR scan tags who is in a photo — no typing',
    'Each guest gets their own personal gallery',
    'Personal souvenir video reels set to music',
    '10-second candid clips, not just photos',
    'Lives on the couple’s own wedding website',
    'The couple receives every photo, tagged or not',
  ],
  areaServed: 'Philippines',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const FAQ = [
  {
    q: 'Do my guests need to download an app?',
    a: 'No. Guests open a link or scan a QR code at the reception — their gallery and reel work right in the browser, no install and no account needed.',
  },
  {
    q: 'How does each guest get their own photos?',
    a: 'A quick QR scan does it. Whoever is shooting holds a guest’s place-card QR — or a table sign, which tags the whole table at once — in frame, and every photo from that moment lands in those guests’ own galleries. No typing, and no one has to scroll through thousands of photos to find themselves. Guests can also add a selfie so their photos are ready to be matched to them as well.',
  },
  {
    q: 'Isn’t this just a shared photo album?',
    a: 'No. A shared album is one big pile everyone digs through. Papic gives each guest their own tagged gallery and a personal video reel — and you, the couple, still receive every single photo, tagged or not.',
  },
  {
    q: 'What is a personal reel?',
    a: 'A short, vertical souvenir video. A guest picks a few favourite moments and Papic renders a polished reel set to music, ready to share — no editing skills required.',
  },
  {
    q: 'Who takes the photos?',
    a: 'Everyone, and you decide how. Every guest can shoot from their own phone into one shared gallery — like handing each table a digital disposable camera. And you can set aside some of your shots for one particular camera, so the friend you trust with the important moments has shots nobody else can spend.',
  },
  {
    q: 'Will we get all the photos?',
    a: 'Always. Every photo lands in your gallery in full quality, whether or not it was tagged. That is a promise — no moment is left behind.',
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
    t: 'Your guests become the crew',
    d: 'Designated friends and family — or every guest — shoot all night from their own phones. The candids, the laughter, the dance floor: the moments one photographer can never be everywhere for.',
  },
  {
    t: 'Every photo finds its people',
    d: 'A QR scan is the whole mechanic: hold a guest’s place card — or a table sign, for everyone at that table — in frame, and those photos sort straight into their own galleries in real time. No tagging marathon, no lost photos.',
  },
  {
    t: 'Everyone goes home with theirs',
    d: 'Each guest gets their own gallery and can render a personal souvenir reel set to music. And you, the couple, receive every single photo — tagged or not.',
  },
];

const VS = [
  ['A shared link everyone digs through', 'Each guest’s own gallery, sorted as you shoot'],
  ['Photos only', 'Photos and 10-second candid clips'],
  ['You scroll to find yourself', 'Your photos find you'],
  ['A separate site that expires', 'Lives on your own wedding website'],
  ['Some moments get lost', 'The couple receives every photo, guaranteed'],
];

/**
 * The live, derived price anchor. Every figure comes from a table an admin owns:
 * rung points from `papic_pass_tiers` / `papic_one_tiers`, prices from the ACTIVE
 * customer catalog, the two free allowances from `papic_event_pool_config`.
 *
 * Fails QUIET, not loud. Each reader degrades on its own (no service key at build
 * time returns [] / the documented seed), and a rung whose price is missing is
 * DROPPED — never rendered at ₱0, which on a price list reads as "free". If
 * nothing resolves, `null` omits the whole section and the page renders exactly as
 * it did before this block existed.
 */
type PapicAnchor = {
  freePoolPhrase: string | null;
  freeOnePhrase: string | null;
  poolRungs: string[];
  oneRungs: string[];
  fromPhp: number | null;
  currencyTerms: readonly [string, string];
};

async function resolvePapicAnchor(): Promise<PapicAnchor | null> {
  const [catalog, poolTiers, oneTiers, freePoolPoints, freeOnePoints] = await Promise.all([
    fetchV2CustomerCatalog(),
    readPapicPassTiers(),
    readPapicOneTiers(),
    readPapicFreeGrantPoints(),
    readPapicFreeOneCameraPoints(),
  ]);
  const priceOf = (code: string): number | null => {
    const row = catalog.find((c) => c.service_code === code);
    const php = row ? Number(row.retail_price_php) : NaN;
    return Number.isFinite(php) && php > 0 ? php : null;
  };
  // The repeatable top-up rung is excluded here for the same reason /pricing and
  // the onboarding services step exclude it: it is a re-buy for an event that
  // already holds a big pool, and listing it beside the base buckets reads as a
  // fourth product.
  const pool = poolTiers
    .filter((t) => !t.isTopup)
    .map((t) => ({ t, php: priceOf(t.serviceCode) }))
    .filter((r): r is { t: (typeof poolTiers)[number]; php: number } => r.php !== null)
    .sort((a, b) => a.php - b.php);
  const one = oneTiers
    .map((t) => ({ t, php: priceOf(t.serviceCode) }))
    .filter((r): r is { t: (typeof oneTiers)[number]; php: number } => r.php !== null)
    .sort((a, b) => a.php - b.php);
  const anyFree = freePoolPoints > 0 || freeOnePoints > 0;
  if (!anyFree && pool.length === 0 && one.length === 0) return null;
  return {
    freePoolPhrase: freePoolPoints > 0 ? papicBucketPhrase(freePoolPoints) : null,
    freeOnePhrase: freeOnePoints > 0 ? papicBucketPhrase(freeOnePoints) : null,
    poolRungs: pool.map(({ t, php }) => papicPoolRungPhrase(t.points, php)),
    oneRungs: one.map(({ t, php }) => papicOneRungPhrase(t.points, php)),
    fromPhp: pool.length > 0 ? pool[0]!.php : one.length > 0 ? one[0]!.php : null,
    currencyTerms: papicPointCurrencyTerms(),
  };
}

export default async function PapicLandingPage() {
  const anchor = await resolvePapicAnchor();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(APP_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />
      <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-10 sm:pt-14">
        {/* Hero — text-led; the line-reveal headline + quiet rise are the only
            motion here, so the step-02 sort stays the page's one spectacle. */}
        <header className="mx-auto max-w-2xl text-center">
          <LineRevealHeading
            as="h1"
            trigger="mount"
            className="mt-3 font-serif text-4xl leading-tight tracking-tight text-[var(--m-ink)] sm:text-5xl"
          >
            Every guest goes home with their own photos.
          </LineRevealHeading>
          <RevealBand stagger={0.08} y={14}>
            <p data-reveal-item className="mx-auto mt-4 max-w-xl text-base text-[#5F5E5A] sm:text-lg">
              Papic turns your guests into your photo crew. Everyone shoots, every photo finds the people in it, and each
              guest gets their own gallery — plus a personal video reel. The candids your photographer can’t be everywhere
              for, delivered to everyone.
            </p>
            <div data-reveal-item className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/onboarding/wedding?from=papic"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[var(--m-mulberry)] px-7 py-3 text-sm font-semibold text-[var(--m-paper)] transition-opacity hover:opacity-90"
              >
                Start planning · free
              </Link>
              <Link
                href="/pricing"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-[var(--m-ink)]/20 px-7 py-3 text-sm font-semibold text-[var(--m-ink)] transition-colors hover:bg-[var(--m-ink)]/[0.04]"
              >
                See pricing
              </Link>
            </div>
          </RevealBand>
        </header>

        {/* What it costs — DERIVED (resolvePapicAnchor). The lead is the free tier,
            because it is both true on every event and the fact most likely to move
            someone who came here from a search. The rungs follow so the page is
            honest about being metered, and /pricing still owns the full ladder. */}
        {anchor ? (
          <section className="mx-auto mt-14 max-w-2xl" aria-label="What Papic costs">
            <Reveal>
              <div className="rounded-2xl border border-[var(--m-ink)]/12 bg-[var(--m-ink)]/[0.02] px-6 py-7 sm:px-8">
                <p className="font-serif text-2xl leading-snug tracking-tight text-[var(--m-ink)]">
                  Papic starts free on every event.
                </p>
                {anchor.freePoolPhrase || anchor.freeOnePhrase ? (
                  <ul className="mt-3 space-y-1.5 text-sm text-[#5F5E5A]">
                    {anchor.freePoolPhrase ? (
                      <li>
                        <span className="font-medium text-[var(--m-ink)]">Shared shots</span> —
                        one pot for the whole celebration, {anchor.freePoolPhrase}.
                      </li>
                    ) : null}
                    {anchor.freeOnePhrase ? (
                      <li>
                        <span className="font-medium text-[var(--m-ink)]">A camera of its own</span> —
                        set aside shots for one QR, {anchor.freeOnePhrase}.
                      </li>
                    ) : null}
                  </ul>
                ) : null}
                <p className="mt-4 text-sm text-[#5F5E5A]">
                  Shots are the only thing counted: {anchor.currencyTerms[0]} ·{' '}
                  {anchor.currencyTerms[1]}. When you want more
                  {anchor.fromPhp != null
                    ? `, top-ups start at ₱${Math.round(anchor.fromPhp).toLocaleString('en-PH')}`
                    : ''}{' '}
                  — and every top-up stacks on what your event already holds.
                </p>
                {anchor.poolRungs.length > 0 || anchor.oneRungs.length > 0 ? (
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                    {anchor.poolRungs.length > 0 ? (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--m-ink)]/55">
                          Add to the shared pool
                        </dt>
                        <dd className="mt-1.5 space-y-1 text-sm text-[#5F5E5A]">
                          {anchor.poolRungs.map((r) => (
                            <p key={r}>{r}</p>
                          ))}
                        </dd>
                      </div>
                    ) : null}
                    {anchor.oneRungs.length > 0 ? (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--m-ink)]/55">
                          Reload one camera
                        </dt>
                        <dd className="mt-1.5 space-y-1 text-sm text-[#5F5E5A]">
                          {anchor.oneRungs.map((r) => (
                            <p key={r}>{r}</p>
                          ))}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                ) : null}
                <Link
                  href="/pricing"
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--m-mulberry)] hover:opacity-80"
                >
                  See the full price list →
                </Link>
              </div>
            </Reveal>
          </section>
        ) : null}

        {/* How it works — the SECTION is the one PanelThread panel; step 02 hosts
            the signature tile-settle (its own useSettle ref, scoped separately
            from this panel root so the two IO entrances don't double-fire). */}
        <section className="mx-auto mt-16 max-w-3xl" aria-label="How Papic works">
          <HowItWorksPanel>
            <ol className="grid gap-6 sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <li
                  key={s.t}
                  data-premium-item
                  className="rounded-2xl border border-[var(--m-ink)]/10 bg-white/60 p-5"
                >
                  <span className="font-mono text-xs text-[#8C6932]">{String(i + 1).padStart(2, '0')}</span>
                  <h2 className="mt-2 font-serif text-lg text-[var(--m-ink)]">{s.t}</h2>
                  <p className="mt-1.5 text-sm text-[#5F5E5A]">{s.d}</p>
                  {/* Step 02 · "Every photo finds its people" → the tile sort. */}
                  {i === 1 ? <SettleTiles /> : null}
                </li>
              ))}
            </ol>
          </HowItWorksPanel>
        </section>

        {/* Not a photo wall — the differentiator. Rows rise in a quiet ~60ms
            stagger; the strikethroughs are NOT animated. */}
        <section className="mx-auto mt-16 max-w-3xl" aria-label="What makes Papic different">
          <LineRevealHeading className="text-center font-serif text-2xl text-[var(--m-ink)] sm:text-3xl">
            Not a shared photo dump
          </LineRevealHeading>
          <p className="mx-auto mt-3 max-w-xl text-center text-base text-[#5F5E5A]">
            A photo wall gives everyone one pile to scroll. Papic gives each guest their own night back.
          </p>
          <RevealList
            className="mt-7 overflow-hidden rounded-2xl border border-[var(--m-ink)]/10"
            stagger={0.06}
            y={12}
          >
            {VS.map(([wall, papic], i) => (
              <li
                key={papic}
                data-reveal-item
                className={`grid grid-cols-1 gap-1 px-5 py-4 sm:grid-cols-2 sm:gap-6 ${i % 2 ? 'bg-white/40' : 'bg-white/70'}`}
              >
                <span className="text-sm text-[#9A8F86] line-through decoration-[#9A8F86]/40">{wall}</span>
                <span className="text-sm font-medium text-[var(--m-ink)]">{papic}</span>
              </li>
            ))}
          </RevealList>
        </section>

        {/* Two ways to run it — paired stagger-rise; clearProps:transform keeps
            any CSS hover-lift alive. */}
        <section className="mx-auto mt-16 max-w-3xl" aria-label="Two ways to use Papic">
          <LineRevealHeading className="text-center font-serif text-2xl text-[var(--m-ink)] sm:text-3xl">
            Two ways to run it
          </LineRevealHeading>
          {/* ⚠ STILL "two ways", and that is correct — it is two ways to use ONE
              product, not two products to buy. Since 2026-08-11 you buy shots
              once and then decide how much of them belongs to a particular
              camera; the choice below is what you DO with them, not what you
              pay for. The headings deliberately name the behaviour rather than
              a SKU, because a product name here is what taught people there
              were two things to buy. */}
          <RevealBand className="mt-7 grid gap-6 sm:grid-cols-2" stagger={0.08}>
            <div data-reveal-item className="rounded-2xl border border-[var(--m-ink)]/10 bg-white/60 p-6">
              <h3 className="font-serif text-lg text-[var(--m-ink)]">Give a camera its own shots</h3>
              <p className="mt-2 text-sm text-[#5F5E5A]">
                Set aside some of your shots for the few friends or family you trust — theirs alone, all night, on their
                own QR. Nobody else can spend them, and you can take back whatever they don’t use. Cameras are free, so
                make as many as you like.
              </p>
            </div>
            <div data-reveal-item className="rounded-2xl border border-[var(--m-ink)]/10 bg-white/60 p-6">
              <h3 className="font-serif text-lg text-[var(--m-ink)]">Let the whole room shoot</h3>
              <p className="mt-2 text-sm text-[#5F5E5A]">
                Everything you haven’t set aside stays in one shared pot, and every guest shoots from their own phone —
                like handing each table a digital disposable camera. The whole room shares its view of the night, and
                everyone keeps their own.
              </p>
            </div>
          </RevealBand>
        </section>

        {/* FAQ (backs the FAQPage schema) — incidental zero-dep fade-up. */}
        <section className="mx-auto mt-16 max-w-2xl" aria-label="Papic questions">
          <LineRevealHeading className="text-center font-serif text-2xl text-[var(--m-ink)] sm:text-3xl">
            Questions, answered
          </LineRevealHeading>
          <dl className="mt-7 divide-y divide-[var(--m-ink)]/10 border-y border-[var(--m-ink)]/10">
            {FAQ.map((f, i) => (
              <Reveal key={f.q} delay={i * 40}>
                <div className="py-5">
                  <dt className="font-serif text-base text-[var(--m-ink)]">{f.q}</dt>
                  <dd className="mt-1.5 text-sm text-[#5F5E5A]">{f.a}</dd>
                </div>
              </Reveal>
            ))}
          </dl>
        </section>

        {/* CTA — incidental fade; gold capped to a single --m-orange hairline
            border (no glow, no new gold fill). */}
        <Reveal>
          <section className="mx-auto mt-14 max-w-2xl rounded-3xl border border-[var(--m-orange)]/40 bg-[#FBF6EA] px-6 py-10 text-center">
            <h2 className="font-serif text-2xl text-[var(--m-ink)] sm:text-3xl">Give every guest the photos</h2>
            <p className="mx-auto mt-3 max-w-lg text-base text-[#5F5E5A]">
              Papic lives inside your free Setnayan wedding — alongside your guest list, RSVP, seating, and website. Start
              planning free, and add Papic when you’re ready.
            </p>
            <Link
              href="/onboarding/wedding?from=papic"
              className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[var(--m-mulberry)] px-7 py-3 text-sm font-semibold text-[var(--m-paper)] transition-opacity hover:opacity-90"
            >
              Start planning · free
            </Link>
          </section>
        </Reveal>
      </main>
    </>
  );
}
