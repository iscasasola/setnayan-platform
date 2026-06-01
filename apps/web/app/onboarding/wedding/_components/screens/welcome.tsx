/**
 * Screen 0 — Welcome.
 *
 * Full-bleed hero photo (a Filipino couple at golden hour) with the brand
 * promise overlaid on a bottom scrim. No interaction beyond the bottom-bar
 * "Let's go" CTA — this screen exists to set tone.
 *
 * Photo at /onboarding/welcome.webp — generated via Recraft, copied from
 * the locked /proto. Production swaps to the owned-asset pipeline per the
 * iteration 0010 Mood Board lock (V1 = internet/Recraft placeholders OK,
 * V1.x = Higgsfield batch).
 */

import Image from 'next/image';

export function ScreenWelcome() {
  return (
    <div className="relative isolate flex h-[calc(100svh-117px)] w-full overflow-hidden">
      {/* Full-bleed photo */}
      <Image
        src="/onboarding/welcome.webp"
        alt="A Filipino couple at golden hour on a hilltop overlooking the sea"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />

      {/* Bottom scrim with the brand promise */}
      <div className="relative z-10 mt-auto w-full bg-gradient-to-t from-black/70 via-black/30 to-transparent px-6 pb-10 pt-24 text-cream">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cream/75">
          Let&apos;s build it together
        </p>
        <h1 className="mt-2 font-serif text-3xl italic leading-tight sm:text-4xl">
          Let&apos;s plan your wedding.
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-cream/90">
          A few quick questions and we&apos;ll build a plan made for your day —
          every vendor sorted to fit. Free to start, always.
        </p>
      </div>
    </div>
  );
}
