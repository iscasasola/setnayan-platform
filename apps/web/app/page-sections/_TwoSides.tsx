import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

// Section 5 — Built for both sides of the celebration (iteration 0015 § Section 5)
// Core positioning — the "Why Setnayan" two-column block. Six couple beats
// + six vendor beats, copy verbatim from the spec.
//
// Below the columns: soft link to /for-vendors.

const COUPLE_BEATS: Array<{ title: string; body: string }> = [
  {
    title: 'Free to plan.',
    body: 'Guest list, RSVP, seating, budget, mood board. No subscription, no paywall.',
  },
  {
    title: 'Personal QR invitations',
    body: 'for every guest, with branded monogram if you want it.',
  },
  {
    title: 'Day-of live broadcast',
    body: "so anyone who can't be there sees every moment.",
  },
  {
    title: 'Paparazzi capture',
    body: "— your guests' phones become a coordinated photo crew.",
  },
  {
    title: 'Same-day highlight reel',
    body: 'delivered 30 minutes before the reception starts.',
  },
  {
    title: 'One bill, BIR-compliant.',
    body: 'Pay for what you book. No wallets, no surprises.',
  },
];

const VENDOR_BEATS: Array<{ title: string; body: string }> = [
  {
    title: 'Free listing.',
    body: 'Profile, chat with couples, accept bookings — no monthly fee to start.',
  },
  {
    title: 'Real calendar',
    body: 'with team roles, agent privacy redaction, per-service scoping.',
  },
  {
    title: 'In-app payments',
    body: 'with BIR receipts and EWT / 2307 handled for you.',
  },
  {
    title: 'Pipeline and proposals',
    body: 'from inquiry to completed booking.',
  },
  {
    title: 'Sponsored boost',
    body: "when you're ready to scale — 10km → 30km visibility.",
  },
  {
    title: 'Crew-rate marketplace',
    body: '— coming soon. List your team and earn from every job.',
  },
];

function BeatList({
  beats,
  eyebrow,
  ariaLabel,
}: {
  beats: Array<{ title: string; body: string }>;
  eyebrow: string;
  ariaLabel: string;
}) {
  return (
    <div aria-label={ariaLabel} className="space-y-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
        {eyebrow}
      </p>
      <ul className="space-y-5">
        {beats.map((b) => (
          <li key={b.title} className="border-l-2 border-terracotta/30 pl-4">
            <p className="text-base text-ink sm:text-[17px]">
              <span className="font-semibold">{b.title}</span>{' '}
              <span className="text-ink/70">{b.body}</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TwoSides() {
  return (
    <section
      aria-labelledby="two-sides-heading"
      className="border-b border-ink/5"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
        <div className="max-w-3xl space-y-4">
          <h2
            id="two-sides-heading"
            className="text-balance font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl lg:text-6xl"
          >
            Built for both sides of the celebration.
          </h2>
          <p className="text-base text-ink/65 sm:text-lg">
            Most event apps pick a side. Setnayan is the only Filipino events
            platform with real operating tools on both sides.
          </p>
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-16">
          <BeatList
            beats={COUPLE_BEATS}
            eyebrow="For couples"
            ariaLabel="Couple beats"
          />
          <BeatList
            beats={VENDOR_BEATS}
            eyebrow="For vendors"
            ariaLabel="Vendor beats"
          />
        </div>

        <div className="mt-12 border-t border-ink/5 pt-8">
          <Link
            href="/for-vendors"
            className="inline-flex items-center gap-2 text-sm font-medium text-terracotta underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline sm:text-base"
          >
            Learn more about Setnayan for vendors
            <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </div>
      </div>
    </section>
  );
}
