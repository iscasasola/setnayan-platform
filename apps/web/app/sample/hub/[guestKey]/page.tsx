import Link from 'next/link';
import { loadSampleGuestOrNotFound } from '@/lib/sample-event/switch.server';

/**
 * `/sample/hub/[guestKey]` — the Event Hub as one sample guest (owner 2026-11-02:
 * "see the event hub of any guest"; first visible slice = the two persona guests,
 * `sample-guest-bride-cousin` and `sample-guest-maid-of-honor`).
 *
 * S1 (this slice) is the ROUTE AND THE GATE: the key resolves only to a fixture
 * guest (`readSampleGuest`), anything else is a 404, and the row it hands over is
 * already the [slug] Hub's own `GuestRow` shape. S3 replaces the body below with
 * the SHIPPED Hub and ticket components fed from the fixture loader — never a
 * drawing of them.
 */
export default async function SampleGuestHubPage({ params }: { params: Promise<{ guestKey: string }> }) {
  const { guestKey } = await params;
  const { sample, guest } = await loadSampleGuestOrNotFound(guestKey);
  return (
    <main className="min-h-dvh w-full bg-cream text-ink" data-sample-hub={guest.guestKey}>
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-10 sm:px-8 sm:pt-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60">Sample event · {sample.displayName}</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
          {guest.first_name} {guest.last_name}
        </h1>
        <p className="mt-3 text-base text-ink/75">Their Event Hub opens here soon.</p>
        <p className="mt-10">
          <Link href="/sample" className="inline-flex min-h-11 items-center text-sm font-medium text-mulberry hover:text-mulberry-600">
            Back to the sample
          </Link>
        </p>
      </div>
    </main>
  );
}
