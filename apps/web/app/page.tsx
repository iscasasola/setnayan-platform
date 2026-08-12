/**
 * Homepage · / — THE FRONT DOOR (owner-ruled 2026-08-13).
 *
 * ─── WHAT THIS REPLACED, AND ON WHOSE WORD ───────────────────────────────
 * Until today `/` rendered `HomeReskin` — the ELN cinematic no-scroll gate +
 * 5-pillar dock, owner-approved 2026-06-29. The owner was asked directly
 * whether the new front door replaces the homepage ("yes we want the new
 * website") and then what becomes of the cinematic opening: **"Retire it
 * completely."** He was told in the question itself that this discards
 * finished, approved work. `DECISION_LOG.md` 2026-08-13.
 *
 * So this is a REVERSAL OF AN OWNER LOCK, taken on the owner's own sentence —
 * not a redesign anyone drifted into.
 *
 * ─── PORTED, NOT REDRAWN ─────────────────────────────────────────────────
 * Binding sources: `prototypes/front_door_and_seam_2026-08-12.html` (rev 3)
 * and `FRONT_DOOR_AND_SEAM_FINAL_2026-08-12.md`. A delta between this page and
 * the prototype is a defect in the PORT, not a fresh design decision.
 *
 * ─── PRESERVED, deliberately (no visual footprint) ───────────────────────
 *   • GEO/SERP metadata + the WebSite + SoftwareApplication JSON-LD graph, so
 *     AI answer engines and search cards keep their extractable surface. The
 *     shape of the page changed; what a machine reads about the brand did not.
 *   • All three CRON-FREE after() jobs — the admin morning digest, the daily
 *     email jobs and the interconnection probes. These have no scheduler
 *     behind them; they piggyback on this page's guaranteed public traffic, so
 *     dropping them while rewriting the page would have silently stopped the
 *     anniversary digests, the renewal reminders and the Papic drop warning.
 *
 * ⚠ RETIRED WITH THE REMOVED PAGE: the catalog-driven pricing read, the admin
 * background videos, and the Spotlight strip. They were props of the cinematic
 * homepage only. `/pricing` remains the source of truth for prices and is
 * untouched.
 *
 * The persistent SiteChrome top-nav stays suppressed on `/` (site-chrome.tsx
 * omits it) because the front door renders its own top bar — same reason as
 * before, different bar.
 */

import { after } from 'next/server';
import './_components/home/home-reskin.css';
import './_components/frontdoor/front-door.css';
import { HomeReskin } from './_components/home/HomeReskin';
import { HomeSpotlightStrip } from './_components/home/HomeSpotlightStrip';
import { getHomePricingData } from './_components/home/pricing-data';
import { FrontDoor } from './_components/frontdoor/front-door';
import { newFrontDoorEnabled } from '@/lib/front-door-flag';
import { fetchHomepageSpotlight } from '@/lib/spotlight-awards';
import { loadPublishedShowcases } from '@/lib/showcase-db';
import { publishedBlogArticles } from '@/lib/blog';
import { fetchPublishedBackgroundVideos } from '@/lib/background-videos';
import { runAdminDigestFlush } from '@/lib/admin/digest-flush';
import { runDailyEmailJobs } from '@/lib/daily-email-jobs';
import { maybeRunInterconnectionProbes } from '@/lib/interconnect/run';

// GEO Phase G2 (2026-05-28) — brand-first title + value-prop description.
// Carried forward so AI answer engines + SERP cards keep extracting the same
// brand + price + 0% commission signals.
const HOME_TITLE = 'Setnayan · Plan your Filipino wedding free — keep it forever';
const HOME_DESCRIPTION =
  'Plan your whole Filipino wedding free — then keep every photo, video, and memory in one place, for life. Verified vendor marketplace at 0% commission. Your wedding is just where your life-events collection starts.';

export const metadata = {
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  // 🔒 Restated, not inherited-by-luck. `applicationName` renders
  // <meta name="application-name"> — one of the two places a machine reader
  // (and Google's OAuth homepage review) looks for the app's NAME. It is set on
  // the root layout and would normally cascade, but stating it on the single
  // page the reviewer is sent to means a future layout edit cannot quietly
  // remove it from THIS url. Guarded by app/home-brand-name.test.ts.
  applicationName: 'Setnayan',
  alternates: { canonical: '/' },
  keywords: [
    'Filipino wedding planning',
    'Philippines wedding vendors',
    'wedding marketplace Manila',
    'Filipino wedding app',
    'Setnayan',
    'verified Filipino vendors',
    "Set na 'yan",
    'Filipino wedding software',
    'wedding photo gallery app',
    'keep wedding photos safe',
    'Filipino life events app',
  ],
  // 🚨 `openGraph` and `twitter` are REPLACED wholesale by the child segment,
  // not deep-merged — next/dist/lib/metadata/resolve-metadata.js does
  // `target.openGraph = resolveOpenGraph(source.openGraph, …)` on a plain
  // `case 'openGraph':`. So until 2026-08-09 this three-key object silently
  // DELETED the root layout's og:site_name ("Setnayan"), og:type, og:locale and
  // the 1200×630 og:image — on the homepage ONLY, which is the one page where
  // the brand name matters most. Measured on the live site 2026-08-09: `/`
  // served og:title, og:description and og:url and NOTHING else, and
  // twitter:card had degraded to the tiny "summary" thumbnail because Next's
  // auto-fill could no longer see a large image. Every other public page was
  // correct, which is exactly why nobody noticed.
  // 🔑 If you add a key to the layout's openGraph, add it here too — an
  // override object must be COMPLETE, not a patch. Guarded by
  // app/home-brand-name.test.ts.
  openGraph: {
    type: 'website',
    siteName: 'Setnayan',
    locale: 'en_PH',
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    url: '/',
    images: [
      {
        url: '/brand/og-card.webp',
        width: 1200,
        height: 630,
        alt: "Setnayan · Set na 'yan. · Filipino wedding planning · verified vendors · 0% commission",
        type: 'image/webp',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: ['/brand/og-card.webp'],
  },
};

// ISR, unchanged from the 2026-07-02 perf sweep — the homepage is the
// highest-traffic public URL and edge-caching it removes the per-visit function
// invocation. revalidate=300 also keeps the three cron-free after() jobs below
// firing on a bounded schedule; `home-carries-the-cron-free-jobs.test.ts`
// asserts this number for exactly that reason.
//
// ⚠ WHY THIS IS NOT `force-dynamic`, though the front door reads the session.
// An earlier cut of this change set `force-dynamic`, which would have made the
// page dynamic for BOTH branches — costing the CURRENTLY LIVE homepage its
// caching during the whole flag-off window, for a page that does not read the
// session at all. Instead the route stays ISR and Next's own dynamic bailout
// handles it: `cookies()` is reached only inside <FrontDoor>, so it runs only
// once the flag is on, and the route becomes dynamic then rather than now.
//
// ⏭ KNOWN FOLLOW-UP AT THE FLIP: with the flag on, this route renders
// per-request. If that proves too expensive once there is real traffic, cache
// the four feed reads behind `unstable_cache` so only the session lookup stays
// per-request. Named now so it is a decision later, not a surprise.
export const revalidate = 300;

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');

// Homepage JSON-LD graph — the canonical WebSite node + a SoftwareApplication
// whose featureList enumerates the differentiated capture/media layer so
// ChatGPT / Perplexity / Claude / Gemini ground on the moat. Facts only — no SKU
// prices (those drift; /pricing is the source of truth); the free couple
// baseline is expressed as a single ₱0 Offer.
const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: `${SITE_URL}/`,
  name: 'Setnayan',
  inLanguage: 'en-PH',
  publisher: { '@type': 'Organization', '@id': `${SITE_URL}/#organization` },
  // Sitelinks search box — lets Google surface a search field for the brand
  // SERP, pointed at the vendor-discovery surface.
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/explore?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

const softwareAppJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  '@id': `${SITE_URL}/#software`,
  url: `${SITE_URL}/`,
  name: 'Setnayan',
  applicationCategory: 'LifestyleApplication',
  operatingSystem: 'Web, iOS, Android, macOS, Windows',
  inLanguage: 'en-PH',
  publisher: { '@type': 'Organization', '@id': `${SITE_URL}/#organization` },
  isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}/#website` },
  description:
    "The Philippines-first wedding platform — plan your wedding free, then keep it for life. Couples plan free, then add optional paid upgrades that set the day apart — Papic candid photo-and-video capture with QR-tagged galleries and personal reels (free to start on every event), Live Studio livestream on the event page, the Setnayan AI planner, a custom Pakanta song, and an Animated Monogram, each priced individually in PHP. Every photo, video, and milestone gathers into one living memory (Alaala) the couple keeps, and the wedding becomes its own recurring anniversary — so Setnayan grows from a wedding into the home for every celebration that follows. 0% commission on verified vendor bookings.",
  featureList: [
    // 2026-06-13 reprice scrub (Pricing.md § 00.D): RSVP is a paid SKU —
    // the "Free" prefix stays only on tools the ₱0 tier actually includes.
    'Guest list & RSVP management (guest list free with every account)',
    'Seating chart editor (free)',
    'Budget tracker with payment-deadline calendar export (free)',
    'Pakulay mood board (free)',
    'Personal event website with branded QR invitations',
    'Papic — guests’ phones become a coordinated photo-and-video crew, with QR-tagged galleries and per-guest personal highlight reels (free on every event; paid top-ups for more shots)',
    'Live Studio — day-of livestream to YouTube, embedded on the event website (free single camera; paid multicam control room)',
    'Setnayan AI — assisted planner that drafts timelines and matches verified vendors (paid add-on)',
    'Pakanta — a custom Filipino-style wedding song produced for the couple (paid add-on)',
    'Animated Monogram — a bespoke monogram + animation across invites, website, and signage (paid add-on)',
    'Alaala living memory — every photo, video, and milestone from the day gathered into one place the couple keeps, for life',
    'Grows beyond the wedding — your event becomes its own recurring anniversary with a yearly reminder, and the same tools carry across debuts, birthdays, christenings, and anniversaries as those event types unlock',
    'Verified Filipino wedding vendor marketplace with 0% commission on every booking',
  ],
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'PHP',
    description:
      'Free baseline planning tools for couples; premium services priced individually in PHP.',
  },
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // These three reads are fully independent — none consumes another's output —
  // so run them CONCURRENTLY. Each degrades to a safe fallback ([]/null) when the
  // service-role key is absent, so this is safe at build-time prerender under ISR.
  // (OAuth-button visibility is now resolved client-side in HomeOverlays, so this
  // page no longer reads headers()/cookies() — that's what makes it cacheable.)
  //
  //   • getHomePricingData        — catalog-driven pricing for the Prices overlay
  //   • fetchPublishedBackgroundVideos — admin homepage videos: slot 0 = hero
  //                                 backdrop, slots 1-5 = pillar dock videos, in
  //                                 PILLAR_HEROES order (each null until published,
  //                                 falling back to the gradient scene).
  //   • fetchHomepageSpotlight    — public Spotlight strip; DOUBLE-GATED + inert by
  //                                 default (returns []).
  // Real published weddings for the homepage rail. The four that shipped here
  // were HARDCODED — "Claire & Ice", "Maria & Jose", "Lena turns 18", "The Reyes
  // Reunion" — so a real couple publishing their day changed nothing on the front
  // page. `loadPublishedShowcases` is the reader /realstories already uses, and it
  // fails soft to [] (it even catches the admin-client constructor), so a failed
  // read and a genuinely empty archive both arrive as zero. That is the right
  // direction here: below the threshold the rail renders a written invitation
  // instead of a grid, and an invitation is honest in both cases.
  /*
    ⚠ AWAITING `searchParams` IS ITSELF A DYNAMIC OPT-OUT, IN BOTH BRANCHES.
    An earlier cut awaited it unconditionally at the top of this function — so
    the CURRENTLY LIVE homepage lost its static generation the moment this
    landed, which is precisely the regression the `revalidate` note above says
    was avoided. Reading a request-scoped value is dynamic whether or not the
    value is used.

    `newFrontDoorEnabled()` reads a NEXT_PUBLIC_* var, which is inlined at
    build time — so with the flag off this expression is a compile-time false
    and the await never appears in the executed path. Flag off ⇒ still ISR.
  */
  const newDoor = newFrontDoorEnabled();
  const chipParam = newDoor ? (await searchParams).c : undefined;
  const chip = Array.isArray(chipParam) ? chipParam[0] : chipParam;

  // The retired page's reads. They stay until the flag flips, at which point
  // this block and the four imports above go with it — one commit, once
  // somebody has actually seen what replaces it.
  // ⚠ These four run in BOTH branches, deliberately. Gating them on the flag
  // was tried and reverted: it forces every downstream prop nullable for a
  // saving that only exists in the flag-ON state, and the adversarial review
  // explicitly refuted "the retired reads are wasted work" as a defect. They
  // disappear with the block below at the flip.
  const [pricing, bg, spotlightVendors, showcases] = await Promise.all([
    getHomePricingData(),
    fetchPublishedBackgroundVideos(),
    fetchHomepageSpotlight(),
    loadPublishedShowcases(4).catch(() => []),
  ]);

  const bgVideos = {
    main: bg.main?.url ?? null,
    pillars: [1, 2, 3, 4, 5].map(
      (slot) => bg.pillars.find((p) => p.slot === slot)?.url ?? null,
    ),
  };

  // Admin morning-digest flush — cron-free, piggybacks on the homepage's
  // guaranteed public traffic so the digest reaches an admin who isn't in the
  // console even on a quiet day. Throttled + single-claim + gated OFF by
  // default internally; uses the service-role client (no cookies → safe in
  // after()). See lib/admin/digest-flush.ts.
  after(() => runAdminDigestFlush().catch(() => {}));
  // Daily email jobs (anniversary digest · renewal reminders · Papic drop
  // warning) — CRON-FREE: public traffic + a per-job daily DB claim, so they
  // run even when no admin/vendor is online (replaces the retired crons).
  after(() => runDailyEmailJobs().catch(() => {}));
  // Interconnection probes — same cron-free shape, ~4×/day. Reports on the
  // JOINTS between subsystems (does each booked vendor still reach their desk;
  // can anyone see the pending song requests) rather than on any one part, which
  // is where the song desk broke while 8 PRs of part-level checks stayed green.
  // Verdicts land on /admin/app-performance?tab=interconnections.
  after(() => maybeRunInterconnectionProbes());

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppJsonLd) }}
      />
      {newDoor ? (
        <FrontDoor chip={chip} />
      ) : (
        <>
          {/* The June cinematic homepage, still standing until the flip.
              The owner HAS ruled it retired — this is about ORDER, not doubt:
              deleting a finished, approved page before its replacement has
              been looked at on a real screen is the one step here that cannot
              be undone, and the standing rule is that the owner LOOKING beats
              every automated check. */}
          <HomeReskin
            pricing={pricing}
            bgVideos={bgVideos}
            showcases={showcases}
            articles={publishedBlogArticles().slice(0, 3)}
          />
          <HomeSpotlightStrip vendors={spotlightVendors} />
        </>
      )}
    </>
  );
}
