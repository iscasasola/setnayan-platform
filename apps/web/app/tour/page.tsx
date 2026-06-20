import Link from 'next/link';
import { getSampleEvent } from './_lib/sample-event';

/**
 * /tour — the public "walk through a real wedding" intro + stop index.
 *
 * Resolving getSampleEvent() here means a missing/de-flagged sample 404s the
 * whole tour up front (fail-safe). Stop 1 (the Save-the-Date) deep-links to the
 * already-public /maria-and-jose page; stops 2–5 are marked "soon" until their
 * routes ship (no dead links).
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Walk through a real wedding · Setnayan',
  description:
    'Explore a complete sample wedding on Setnayan — the invitation, the vendors, the seating, the budget, and the gallery. No sign-up, and nothing is saved.',
  alternates: { canonical: '/tour' },
  openGraph: {
    title: 'Walk through a real wedding · Setnayan',
    description: 'Explore a complete sample wedding on Setnayan — no sign-up, nothing saved.',
    url: '/tour',
    type: 'website',
  },
};

const STOPS: Array<{ n: number; title: string; blurb: string; href: string; live: boolean }> = [
  { n: 1, title: 'The invitation', blurb: 'A cinematic Save-the-Date that announces the date.', href: '/maria-and-jose', live: true },
  { n: 2, title: 'The vendors', blurb: 'How Setnayan AI shortlists the team that fits.', href: '/tour/vendors', live: true },
  { n: 3, title: 'The seating', blurb: 'Every guest finds their table.', href: '/tour/seating', live: true },
  { n: 4, title: 'The budget', blurb: 'Every peso tracked, every deadline in view.', href: '/tour/budget', live: true },
  { n: 5, title: 'The gallery', blurb: 'The day, captured by everyone.', href: '/tour/gallery', live: true },
];

export default async function TourIntroPage() {
  const ev = await getSampleEvent();
  const bride = ev.bride_name ?? 'Maria';
  const groom = ev.groom_name ?? 'Jose';

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-20 pt-12 sm:pt-16">
      <header className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#8C6932]">A real wedding, start to finish</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight tracking-tight text-[#1E2229] sm:text-5xl">
          Walk through {bride} &amp; {groom}&rsquo;s wedding
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-[#5F5E5A] sm:text-lg">
          See exactly how a couple plans on Setnayan — the invitation, their vendors, the seating, the budget, and the
          gallery. No sign-up, and nothing you tap is ever saved.
        </p>
        <Link
          href="/maria-and-jose"
          className="mt-7 inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#5C2542] px-7 py-3 text-sm font-semibold text-[#FBFBFA] transition-opacity hover:opacity-90"
        >
          Start the tour &rarr;
        </Link>
      </header>

      <ol className="mx-auto mt-14 grid max-w-3xl gap-4 sm:grid-cols-2" aria-label="Tour stops">
        {STOPS.map((s) => {
          const card = (
            <div
              className={`h-full rounded-2xl border p-5 ${
                s.live ? 'border-[#C5A059]/40 bg-[#FBF8F1]' : 'border-[#1E2229]/10 bg-white/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[#8C6932]">{String(s.n).padStart(2, '0')}</span>
                {!s.live && (
                  <span className="font-mono text-[11px] uppercase tracking-wider text-[#9A8F86]">soon</span>
                )}
              </div>
              <h2 className="mt-2 font-serif text-lg text-[#1E2229]">{s.title}</h2>
              <p className="mt-1.5 text-sm text-[#5F5E5A]">{s.blurb}</p>
            </div>
          );
          return s.live ? (
            <li key={s.n}>
              <Link href={s.href} className="block transition-opacity hover:opacity-90">
                {card}
              </Link>
            </li>
          ) : (
            <li key={s.n} aria-disabled="true" className="opacity-80">
              {card}
            </li>
          );
        })}
      </ol>

      <section className="mx-auto mt-14 max-w-2xl rounded-3xl border border-[#C5A059]/40 bg-[#FBF6EA] px-6 py-10 text-center">
        <h2 className="font-serif text-2xl text-[#1E2229] sm:text-3xl">Like what you see?</h2>
        <p className="mx-auto mt-3 max-w-lg text-base text-[#5F5E5A]">
          Start your own wedding on Setnayan — free, in minutes. Set na &rsquo;yan.
        </p>
        <Link
          href="/onboarding/wedding?from=tour"
          className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#5C2542] px-7 py-3 text-sm font-semibold text-[#FBFBFA] transition-opacity hover:opacity-90"
        >
          Start planning &middot; free
        </Link>
      </section>
    </main>
  );
}
