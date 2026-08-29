/**
 * /papic/try — the live demo, at an address you can paste into a group chat.
 *
 * ─── WHY IT EXISTS ────────────────────────────────────────────────────────
 * The demo shipped reachable only by scrolling `/papic`. Messenger is the
 * dominant channel here, and a section of a page cannot be pasted into a group
 * chat — a link can. **A demo nobody can link to is a demo that cannot spread.**
 *
 * ── IT IS THE SAME DEMO, NOT A SECOND ONE ─────────────────────────────────
 * This route mounts `<PapicScan />`, the identical component `/papic` mounts:
 * same session, same QR renderer, same realtime channel, same
 * nothing-is-persisted posture. It is a DOOR to the demo, not a copy of it.
 * If this file ever grows its own capture path, that is the bug.
 *
 * ── ITS OWN SHARE CARD, ON PURPOSE ────────────────────────────────────────
 * This is the URL most likely to be pasted, so it carries the Papic photograph
 * rather than the house brand card — see the note beside OG_IMAGE on the parent
 * page. A share of a photography product should show a photograph.
 *
 * ⛔ NO `force-static` HERE. Like every route in `app/(shell)/`, the group
 * layout owns the caching decision; re-declaring it makes `cookies()` return an
 * empty jar and serves a signed-in person a signed-out rail from the edge cache.
 */

import Link from 'next/link';
import { PapicScan } from '../_papic-scan';

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = 'Try Papic with a friend — right now, no sign-up';
const PAGE_DESCRIPTION =
  'Two codes, two phones, one minute. Scan one each, your phone reads your own face, and the photos you take of each other come back knowing who is in them. Nothing is kept.';

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/papic/try' },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/papic/try',
    type: 'website',
    images: [
      {
        url: `${SITE_URL}/brand/og-papic.webp`,
        width: 1200,
        height: 630,
        alt: 'A toast at a Filipino reception, photographed from a guest’s own seat',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [`${SITE_URL}/brand/og-papic.webp`],
  },
};

export default function PapicTryPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 pb-24 pt-10 sm:pt-14">
      <h1 className="font-serif text-[2.05rem] leading-[1.14] tracking-tight text-[var(--m-ink)] sm:text-4xl">
        Try it with whoever is next to you.
      </h1>
      <p className="mt-3 text-[0.98rem] text-[var(--m-slate-2)]">
        Two codes, two phones, about a minute. Scan one each — your phone reads your own face, and
        the photos you take of each other come back knowing who is in them. No app, no sign-up.
      </p>

      <div className="mt-6">
        <PapicScan />
      </div>

      <p className="mt-8 text-sm text-[var(--m-slate-2)]">
        This is the real thing, in miniature. On a celebration it never rotates away, never leaves
        the people you invited, and never expires —{' '}
        <Link href="/papic" className="font-medium text-[var(--m-mulberry)] hover:opacity-80">
          see what Papic does →
        </Link>
      </p>
    </main>
  );
}
