/**
 * /our-story — the "Living Memories" brand manifesto page.
 *
 * Owner 2026-06-14: "I want to share this idea with the world … embrace this new
 * concept of memories." The umbrella story over Papic / Panood / Kwento /
 * Editorial — memory-keeping evolved from paper albums → digital albums →
 * LIVING memories. The page body lives in OurStoryManifesto so the homepage can
 * route into it (OurStoryTeaser) without duplicating copy.
 *
 * Server component, statically generated (no per-request data). The nav "Our
 * story" link now points here (was /about — the company/brand page; this is the
 * product-philosophy page).
 */

import Link from 'next/link';
import { OurStoryManifesto } from '@/app/_components/marketing/OurStory';
import { SiteFooter } from '@/app/features/_sections/_SiteFooter';

export const dynamic = 'force-static';
export const revalidate = 3600;

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = 'A new way to remember · Setnayan';
const PAGE_DESCRIPTION =
  'Your wedding was never still. We used to keep weddings in albums — paper, then digital. Setnayan keeps them alive: the moments you missed, the people who couldn’t come, and the stories your guests tell, in one living page you keep forever.';
const OG_IMAGE = `${SITE_URL}/api/og/manifesto`;

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/our-story' },
  keywords: [
    'a new way to remember',
    'living wedding memories',
    'Filipino wedding memories',
    'wedding livestream Philippines',
    'guest photo capture wedding',
    'Setnayan',
    "Set na 'yan",
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/our-story',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Setnayan — a new way to remember' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
    { '@type': 'ListItem', position: 2, name: 'Our story', item: `${SITE_URL}/our-story` },
  ],
};

const aboutPageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  '@id': `${SITE_URL}/our-story#aboutpage`,
  url: `${SITE_URL}/our-story`,
  name: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  inLanguage: 'en-PH',
  isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}/#website` },
  about: { '@type': 'Organization', '@id': `${SITE_URL}/#organization` },
};

export default function OurStoryPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutPageJsonLd) }}
      />
      <main className="bg-[var(--m-paper)] text-[var(--m-ink)]">
        <OurStoryManifesto />

        {/* "What Setnayan is" — a plain-language description of the product and
            the features behind the Google scopes. This is the page Google's
            OAuth reviewers read to confirm the app's purpose (the consent
            screen's "Application home page" points here), so it names the
            Google Drive (Papic / Photo Delivery) + YouTube (Panood) features
            and links the privacy policy. Keeps the cinematic front page + the
            manifesto above untouched. */}
        <section className="border-t border-[var(--m-line)] px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <p className="m-eyebrow text-[var(--m-orange)]">What Setnayan is</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              The free, all-in-one app for your wedding
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-[var(--m-slate)]">
              Setnayan is a wedding-planning platform for couples in the
              Philippines. You plan your whole wedding in one place — and the day
              itself comes home to you, in photos and in a livestream the people
              who can&rsquo;t be there can still watch.
            </p>
            <ul className="mt-8 space-y-5">
              <li>
                <span className="font-medium">Plan everything in one place.</span>{' '}
                <span className="text-[var(--m-slate)]">
                  Guest list &amp; RSVPs, a seating chart, a budget with
                  payment-deadline reminders, your run-of-show timeline, a mood
                  board, and a personal wedding website with QR invitations —
                  free.
                </span>
              </li>
              <li>
                <span className="font-medium">Find your vendors.</span>{' '}
                <span className="text-[var(--m-slate)]">
                  Browse and message verified Filipino wedding vendors, with 0%
                  commission on every booking.
                </span>
              </li>
              <li>
                <span className="font-medium">
                  Keep your photos — in your own Google Drive.
                </span>{' '}
                <span className="text-[var(--m-slate)]">
                  With Papic and Photo Delivery, you connect your Google Drive
                  and Setnayan copies your finished wedding photos and videos
                  into a folder it creates for you. We only ever touch that
                  folder — never the files you already keep in your Drive.
                </span>
              </li>
              <li>
                <span className="font-medium">
                  Livestream your day — on your own YouTube channel.
                </span>{' '}
                <span className="text-[var(--m-slate)]">
                  With Panood, the loved ones who can&rsquo;t be there watch your
                  wedding live, embedded right on your event page.
                </span>
              </li>
            </ul>
            <p className="mt-8 text-base text-[var(--m-slate)]">
              Setnayan is free to start. Read how we handle your data — including
              the Google Drive and YouTube connections above — in our{' '}
              <Link
                href="/privacy"
                className="font-medium text-[var(--m-orange)] underline-offset-2 hover:underline"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
