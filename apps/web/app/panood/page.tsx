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
 * provisional — links to /pricing). Never names YouTube / the streaming stack.
 */

import Link from 'next/link';
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

const PAGE_TITLE = 'Live Studio — Live-Stream Your Wedding · Setnayan';
const PAGE_DESCRIPTION =
  'Live Studio brings the people who can’t be in the room into your day — live. The lola overseas, the friends who couldn’t fly home, the family who couldn’t make it: they watch your wedding as it happens, right on your own wedding website. Presence across distance, for everyone you love.';
const OG_IMAGE = `${SITE_URL}/brand/og-card.webp`;

export const metadata = {
  title: PAGE_TITLE,
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
    'Watched right on your own wedding website — no separate app',
    'Family overseas join in real time',
    'No login or install for the people watching',
    'Costs the same whether ten watch or ten thousand',
    'The recording stays with your wedding afterwards',
  ],
  areaServed: 'Philippines',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const FAQ = [
  {
    q: 'How do my guests watch?',
    a: 'They open your wedding website and press play — that’s it. No app to download, no account to make, no link to lose. It works on any phone, tablet, or laptop, anywhere in the world.',
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
    a: 'Yes. After the day, the stream stays with your wedding so anyone who missed it — or wants to relive it — can watch it back.',
  },
  {
    q: 'Does it replace our videographer?',
    a: 'No. Live Studio is about presence in the moment — letting people who can’t be there feel like they are. Your videographer still makes the keepsake film; Live Studio makes sure no one misses the day itself.',
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
    d: 'Live Studio lives inside your Setnayan wedding. Switch it on for the day, and a live broadcast appears right on your own wedding website — nothing for your guests to set up.',
  },
  {
    t: 'Everyone who can’t be there, watches',
    d: 'Share your wedding website and they’re in. The lola overseas, the friends who couldn’t fly home, the family who couldn’t make it — all in the room, together, in real time.',
  },
  {
    t: 'And it stays after',
    d: 'When the day ends, the broadcast stays with your wedding. Anyone who missed it can watch it back, whenever they’re ready.',
  },
];

const VS = [
  ['A private link people lose', 'Right on your own wedding website'],
  ['Guests fumble with an app', 'They just press play'],
  ['Costs more as more tune in', 'Same for ten or ten thousand'],
  ['Gone the moment it ends', 'Stays with your wedding afterwards'],
];

export default function PanoodLandingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(APP_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />
      <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-10 sm:pt-14">
        {/* Hero — text-led; the line-reveal headline + quiet rise are the only
            motion here. */}
        <header className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#8C6932]">In your wedding · live stream</p>
          <LineRevealHeading
            as="h1"
            trigger="mount"
            className="mt-3 font-serif text-4xl leading-tight tracking-tight text-[var(--m-ink)] sm:text-5xl"
          >
            Everyone you love, in the room — even from afar.
          </LineRevealHeading>
          <RevealBand stagger={0.08} y={14}>
            <p data-reveal-item className="mx-auto mt-4 max-w-xl text-base text-[#5F5E5A] sm:text-lg">
              Live Studio brings the people who can’t be there into your day, live. The lola overseas, the friends who
              couldn’t fly home, the family who couldn’t make it — they watch your wedding as it happens, right on
              your own wedding website.
            </p>
            <div data-reveal-item className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/onboarding/wedding?from=panood"
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

        {/* How it works — the one PanelThread panel. */}
        <section className="mx-auto mt-16 max-w-3xl" aria-label="How Live Studio works">
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
                </li>
              ))}
            </ol>
          </HowItWorksPanel>
        </section>

        {/* The differentiator — rows rise in a quiet stagger. */}
        <section className="mx-auto mt-16 max-w-3xl" aria-label="What makes Live Studio different">
          <LineRevealHeading className="text-center font-serif text-2xl text-[var(--m-ink)] sm:text-3xl">
            Presence, not just a link
          </LineRevealHeading>
          <p className="mx-auto mt-3 max-w-xl text-center text-base text-[#5F5E5A]">
            A live stream shouldn’t feel like homework. Live Studio lives where your guests already are — your wedding.
          </p>
          <RevealList
            className="mt-7 overflow-hidden rounded-2xl border border-[var(--m-ink)]/10"
            stagger={0.06}
            y={12}
          >
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
        <section className="mx-auto mt-16 max-w-2xl" aria-label="Live Studio questions">
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

        {/* CTA — incidental fade; gold capped to a single --m-orange hairline border. */}
        <Reveal>
          <section className="mx-auto mt-14 max-w-2xl rounded-3xl border border-[var(--m-orange)]/40 bg-[#FBF6EA] px-6 py-10 text-center">
            <h2 className="font-serif text-2xl text-[var(--m-ink)] sm:text-3xl">Let everyone be there</h2>
            <p className="mx-auto mt-3 max-w-lg text-base text-[#5F5E5A]">
              Live Studio lives inside your free Setnayan wedding — alongside your guest list, RSVP, seating, and website.
              Start planning free, and add Live Studio when you’re ready.
            </p>
            <Link
              href="/onboarding/wedding?from=panood"
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
