import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

// Features-page hero. Per iteration 0015 § Routes — /features is the
// "deep-dive (each tab + service explained more)" surface for couples
// who want depth before applying. The hero stays restrained: editorial
// promise, single primary CTA. No vendor toggle here — vendor visitors
// have their own /for-vendors page.
export function FeaturesHero() {
  return (
    <section className="border-b border-ink/5 bg-cream">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="max-w-3xl space-y-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            For couples · the full feature catalog
          </p>
          <h1 className="font-display text-5xl font-medium tracking-tight text-ink sm:text-6xl lg:text-7xl">
            Every part of your event,
            <span className="block text-ink/65">in one place.</span>
          </h1>
          <p className="max-w-2xl text-lg text-ink/70">
            From the first guest invite to the same-day highlight reel —
            here&rsquo;s everything Setnayan does. Read as much or as little as
            you want; when you&rsquo;re ready, apply and the Setnayan Team will
            quote your event.
          </p>
          <div className="pt-2">
            <Link
              className="button-primary inline-flex items-center justify-between gap-3 px-5 py-3 text-sm sm:max-w-xs"
              href="/signup"
            >
              <span className="flex flex-col items-start text-left">
                <span className="font-semibold">Start planning &middot; free</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] opacity-80">
                  We quote per event &middot; no card
                </span>
              </span>
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
