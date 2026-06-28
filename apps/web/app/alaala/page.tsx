/**
 * /alaala — public marketing landing page for Alaala, the living-memory pillar
 * (www.setnayan.com/alaala).
 *
 * Part of the "Pa-" public-surface wave + the all-events website repositioning
 * (Website_Master_Plan_2026-06-28 §0/§6, Phase 1). Mirrors the /panood + /papic
 * pattern exactly: force-static Server Component, static `metadata`,
 * SoftwareApplication + FAQPage JSON-LD, hero + benefit sections + FAQ + a
 * Mulberry-accent primary CTA, and the shared SiteFooter. The persistent
 * SiteChrome nav renders because '/alaala' is registered in NAV_ROUTES.
 *
 * Alaala is the PRODUCTIZED memory-dashboard doorway for the Living Memories
 * pillar (the fuller manifesto lives at /our-story, deep-linked below). It is
 * the cross-event umbrella, so copy is event-AGNOSTIC ("your day", "every
 * event") — previewing the all-events lead while weddings stay the deepest path.
 *
 * POSITIONING (locked Living Memories thesis): sell FEELING — moments, people,
 * stories, forever — never implementation names; honor the load-bearing
 * guardrail "the essence of the day is never ruined" (presence over production).
 * Copy sells BENEFITS only (public-surface hygiene) and quotes NO price
 * (admin-managed + provisional — links to /pricing).
 */

import Link from 'next/link';
import { SiteFooter } from '@/app/features/_sections/_SiteFooter';
import { AlaalaOrb } from '@/app/_components/marketing/AlaalaOrb';
import { Reveal } from '@/app/_components/marketing/_motion';
import {
  LineRevealHeading,
  RevealBand,
  RevealList,
  HowItWorksPanel,
} from '@/app/_components/marketing/_pa-motion';

export const dynamic = 'force-static';
export const revalidate = 3600;

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = 'Alaala — A New Way to Remember · Setnayan';
const PAGE_DESCRIPTION =
  'Alaala gathers everything from your day — the candid photos, the people who joined from afar, the messages, the story — into one living memory you can open any time. A new way to remember, for every event you’ll ever hold.';
const OG_IMAGE = `${SITE_URL}/brand/og-card.webp`;

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/alaala' },
  keywords: [
    'living wedding memories',
    'a new way to remember',
    'wedding memory app',
    'remember your wedding',
    'event memories',
    'memories that move',
    'Alaala',
    'Setnayan',
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/alaala',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Alaala — a new way to remember' }],
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
  name: 'Alaala — Living Event Memories',
  url: `${SITE_URL}/alaala`,
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Any (web browser)',
  description: PAGE_DESCRIPTION,
  featureList: [
    'Gathers candid photos, live moments, messages, and your story into one place',
    'A living memory you can relive, share, and keep — not a folder of files',
    'Guests join from your event link — nothing to download',
    'Works for every kind of event, not just weddings',
    'Stays with you long after the day',
    'Complements your photographer — it never gets in the way of the moment',
  ],
  areaServed: 'Philippines',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const FAQ = [
  {
    q: 'What is Alaala?',
    a: 'Alaala (ah-LAH-lah) is Tagalog for the memory you keep. It’s how Setnayan gathers everything from your day — the candid photos, the people who joined from afar, the messages, and the story — into one living place you can return to any time.',
  },
  {
    q: 'Is it free?',
    a: 'Your Setnayan event is free to plan, and your memories gather as you go. Some pieces — like live broadcast or extra capture — are upgrades. You’ll always see what’s free and what’s an add-on before anything.',
  },
  {
    q: 'Do my guests need an app?',
    a: 'No. They join straight from your event link — press play, open a photo, leave a message. Nothing to download, no account to make.',
  },
  {
    q: 'What happens after the day?',
    a: 'Your Alaala stays with you. Relive it, share it with the people you love, and keep it for as long as you like.',
  },
  {
    q: 'Does it replace our photographer?',
    a: 'No. Your photographer still makes the grand keepsake. Alaala holds the moments in between and the people who couldn’t be there — it adds to the day, and is built so the tech never gets in the way of being present.',
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

// The four ways one builds an Alaala — each links to its own doorway where one
// exists (honest doorways: no dead links). Stories + keepsake live inside the
// story page + event website today.
const PILLARS: { role: string; name: string; desc: string; href: string }[] = [
  {
    role: 'Capture',
    name: 'Papic',
    desc: 'The candid moments you’d never have seen — caught by the people all around you.',
    href: '/papic',
  },
  {
    role: 'Presence',
    name: 'Panood',
    desc: 'Everyone who couldn’t be there, in the room with you — live, as it happens.',
    href: '/panood',
  },
  {
    role: 'Stories',
    name: 'Kwento',
    desc: 'The messages and well-wishes from the people who came, kept beside the photos.',
    href: '/our-story',
  },
  {
    role: 'Keepsake',
    name: 'Editorial',
    desc: 'The front-page story of your day — beautiful enough to print, alive enough to revisit.',
    href: '/pawebsite',
  },
];

// paper album → digital album → living memory: the evolution the pillar dramatizes.
const VS = [
  ['A box of prints in the closet', 'A living memory you open anytime'],
  ['One camera’s point of view', 'Every angle, every voice'],
  ['Photos you sort through later', 'Your day, already gathered for you'],
  ['A keepsake that fades', 'One that stays — and stays alive'],
];

export default function AlaalaLandingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(APP_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />
      <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-10 sm:pt-14">
        {/* Hero — text-led; line-reveal headline + quiet rise. */}
        <header className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#8C6932]">
            Alaala · the memory you keep
          </p>
          <LineRevealHeading
            as="h1"
            trigger="mount"
            className="mt-3 font-serif text-4xl leading-tight tracking-tight text-[var(--m-ink)] sm:text-5xl"
          >
            A new way to remember.
          </LineRevealHeading>
          <RevealBand stagger={0.08} y={14}>
            <p data-reveal-item className="mx-auto mt-4 max-w-xl text-base text-[#5F5E5A] sm:text-lg">
              Albums freeze a day into a few still frames. Alaala holds what it was really like — moving,
              many-voiced, alive. Every photo, every face, every word, gathered into one living memory you can
              open any time.
            </p>
            <div data-reveal-item className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/onboarding/wedding?from=alaala"
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

        {/* The orb — the signature moment. Wrapped in a <section> so its
            cursor/gyro parallax can measure a stable ancestor. */}
        <section className="mt-14 flex flex-col items-center" aria-label="A living memory">
          <AlaalaOrb className="h-[260px] w-[260px] sm:h-[320px] sm:w-[320px]" />
          <p className="mt-6 max-w-md text-center text-sm text-[#5F5E5A]">
            Capture, presence, stories, and keepsake — woven into one. Memories that move.
          </p>
        </section>

        {/* The four ways — mirrors the proven HowItWorksPanel pattern. */}
        <section className="mx-auto mt-16 max-w-3xl" aria-label="The four ways an Alaala is made">
          <LineRevealHeading className="text-center font-serif text-2xl text-[var(--m-ink)] sm:text-3xl">
            Four ways to remember, one living memory
          </LineRevealHeading>
          <p className="mx-auto mt-3 max-w-xl text-center text-base text-[#5F5E5A]">
            Each one stands on its own — and together they become your Alaala.
          </p>
          <HowItWorksPanel>
            <ol className="grid gap-6 sm:grid-cols-2">
              {PILLARS.map((p) => (
                <li key={p.name} data-premium-item className="rounded-2xl border border-[var(--m-ink)]/10 bg-white/60">
                  <Link href={p.href} className="group block rounded-2xl p-5 transition-colors hover:bg-white/80">
                    <span className="font-mono text-xs uppercase tracking-[0.18em] text-[#8C6932]">{p.role}</span>
                    <h2 className="mt-2 font-serif text-lg text-[var(--m-ink)]">{p.name}</h2>
                    <p className="mt-1.5 text-sm text-[#5F5E5A]">{p.desc}</p>
                    <span className="mt-3 inline-block text-sm font-medium text-[var(--m-ink)] group-hover:underline">
                      Explore {p.name} →
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </HowItWorksPanel>
        </section>

        {/* The memory dashboard — create + collect into one living place. */}
        <section className="mx-auto mt-16 max-w-2xl text-center" aria-label="One home for every memory">
          <LineRevealHeading className="font-serif text-2xl text-[var(--m-ink)] sm:text-3xl">
            One home for every memory
          </LineRevealHeading>
          <RevealBand stagger={0.08} y={14}>
            <p data-reveal-item className="mx-auto mt-3 max-w-xl text-base text-[#5F5E5A]">
              Everything from your day lands in one living place — yours to relive, to share with the people you
              love, and to keep for good. Not a folder of files. A memory that moves.
            </p>
            <p data-reveal-item className="mx-auto mt-4 max-w-xl text-base text-[#5F5E5A]">
              And it never gets in the way. The tech stays in the background, so you and your guests can simply
              be there — present for the day itself.
            </p>
          </RevealBand>
        </section>

        {/* The evolution — paper → digital → living. Rows rise in a stagger. */}
        <section className="mx-auto mt-16 max-w-3xl" aria-label="How remembering has changed">
          <LineRevealHeading className="text-center font-serif text-2xl text-[var(--m-ink)] sm:text-3xl">
            Albums kept the photo. Alaala keeps the day.
          </LineRevealHeading>
          <RevealList className="mt-7 overflow-hidden rounded-2xl border border-[var(--m-ink)]/10" stagger={0.06} y={12}>
            {VS.map(([before, after], i) => (
              <li
                key={after}
                data-reveal-item
                className={`grid grid-cols-1 gap-1 px-5 py-4 sm:grid-cols-2 sm:gap-6 ${i % 2 ? 'bg-white/40' : 'bg-white/70'}`}
              >
                <span className="text-sm text-[#9A8F86] line-through decoration-[#9A8F86]/40">{before}</span>
                <span className="text-sm font-medium text-[var(--m-ink)]">{after}</span>
              </li>
            ))}
          </RevealList>
        </section>

        {/* FAQ (backs the FAQPage schema) — incidental fade-up. */}
        <section className="mx-auto mt-16 max-w-2xl" aria-label="Alaala questions">
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

        {/* CTA — incidental fade; gold capped to a single --m-orange hairline. */}
        <Reveal>
          <section className="mx-auto mt-14 max-w-2xl rounded-3xl border border-[var(--m-orange)]/40 bg-[#FBF6EA] px-6 py-10 text-center">
            <h2 className="font-serif text-2xl text-[var(--m-ink)] sm:text-3xl">Start the memory</h2>
            <p className="mx-auto mt-3 max-w-lg text-base text-[#5F5E5A]">
              Your Alaala gathers as you plan — free, from the first day. Begin your event, and your memory
              begins with it.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/onboarding/wedding?from=alaala"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[var(--m-mulberry)] px-7 py-3 text-sm font-semibold text-[var(--m-paper)] transition-opacity hover:opacity-90"
              >
                Start planning · free
              </Link>
              <Link
                href="/our-story"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-[var(--m-ink)]/20 px-7 py-3 text-sm font-semibold text-[var(--m-ink)] transition-colors hover:bg-[var(--m-ink)]/[0.04]"
              >
                Read the whole story
              </Link>
            </div>
          </section>
        </Reveal>
      </main>
      <SiteFooter />
    </>
  );
}
