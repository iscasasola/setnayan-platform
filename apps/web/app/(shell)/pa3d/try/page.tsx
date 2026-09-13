/**
 * /pa3d/try — the room, at an address you can paste into a group chat.
 *
 * ─── WHY IT EXISTS ────────────────────────────────────────────────────────
 * Mirrors `/papic/try` for the same reason it exists: Messenger is the
 * dominant channel here, and a section of a page cannot be pasted into a group
 * chat — a link can. **A demo nobody can link to is a demo that cannot spread.**
 * It is also the honest destination for "show this to your coordinator", which
 * the parent page promises: you send the room, not a page about the room.
 *
 * ── IT IS THE SAME DEMO, NOT A SECOND ONE ─────────────────────────────────
 * This route mounts `<Pa3dRoom />`, the identical component `/pa3d` mounts:
 * same server action, same sample event, same QR mint, same nothing-persisted
 * posture. It is a DOOR to the demo, not a copy of it. If this file ever grows
 * its own scene-loading path, that is the bug.
 *
 * ⛔ NO `force-static` HERE. Like every route in `app/(shell)/`, the group
 * layout owns the caching decision; re-declaring it makes `cookies()` return an
 * empty jar and serves a signed-in person a signed-out rail from the edge cache.
 */

import Link from 'next/link';
import { studioDescription } from '@/lib/studio-apps';
import { Pa3dRoom } from '../_pa3d-room';

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = 'Walk a real reception in 3D — right now, no sign-up';
const PAGE_DESCRIPTION = studioDescription('pa3d');
const OG_IMAGE = `${SITE_URL}/brand/og-card.webp`;

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/pa3d/try' },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/pa3d/try',
    type: 'website',
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'Walk a sample wedding reception in 3D — no sign-up',
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

export default function ThreeDPlanTryPage() {
  return (
    <main className="px-5 pb-24 pt-10 sm:pt-14">
      <section className="mx-auto max-w-2xl">
        <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[var(--m-orange-2)]">
          3D Plan · live demo
        </p>
        <h1 className="mt-2 font-serif text-[2.05rem] leading-[1.14] tracking-tight text-[var(--m-ink)] sm:text-5xl">
          Stand in a real reception.
        </h1>
        <p className="mt-3 text-[0.98rem] text-[var(--m-slate-2)]">
          This is Maria &amp; Jose’s sample room — their tables, their seats, their colours. Walk
          it, or tap anyone seated to open the room from that guest’s own chair.
        </p>
        <div className="mt-6">
          <Pa3dRoom />
        </div>
        <p className="mt-6 text-sm text-[var(--m-slate-2)]">
          This is what 3D Plan does with your own seating plan —{' '}
          <Link href="/pa3d" className="font-medium text-[var(--m-mulberry)] hover:opacity-80">
            read what it’s for
          </Link>{' '}
          or{' '}
          <Link
            href="/onboarding/wedding?from=pa3d-try"
            className="font-medium text-[var(--m-mulberry)] hover:opacity-80"
          >
            start planning free
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
