'use client';

/**
 * Client motion island for /setnayan-ai — the page itself stays a force-static
 * Server Component (metadata + 2× JSON-LD live in page.tsx). This file owns the
 * only motion on the surface and imports the shared premium primitives (the
 * read-only foundation in `_premium.tsx`). It adds NOTHING to the page's
 * information architecture: every wrapper just renders the server-passed children
 * and attaches a motion ref. No copy / route / CTA / metadata / JSON-LD change.
 *
 * Signature (the ONE spectacle): the hero <h1> — "Say it once. Find your perfect
 * fit." — self-composes once via the serif line-reveal, then rests. It fires above
 * the fold after fonts settle (trigger:'mount'), NOT IO-gated, NOT scrubbed. The
 * eyebrow / subcopy / CTAs settle in a single quiet beat right after (one useReveal
 * group). The product promise is "say it once → a resolved answer", so the page
 * resolves itself exactly once and never competes with a second moment below.
 *
 * a11y / SSR contract:
 *   • Client components still SSR, so all hero + section text ships in the static
 *     HTML and stays in the DOM/a11y tree. All motion is opacity/transform only —
 *     never visibility/display — so nothing leaves the screen-reader tree.
 *   • prefers-reduced-motion → the foundation hooks rest everything visible.
 *   • Gold budget: exactly ONE PanelThread on the whole page (How-it-works). The
 *     other panel intros run thread-less (headline line-reveal + quiet item rise).
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  useReveal,
  useLineReveal,
  usePanelIntro,
  PanelThread,
} from '@/app/_components/marketing/_premium';

type Step = { t: string; d: string };

/**
 * SetnayanAiHero — renders the hero block so `useLineReveal`'s ref sits directly on
 * the real <h1>. The eyebrow + subcopy + CTAs share one quiet `useReveal` group
 * (each marked `data-reveal-item`); the h1 is NOT a reveal-item (the line-reveal
 * owns it), so the two hooks never fight over the same element. Above the fold →
 * the line-reveal fires on `mount` (after fonts.ready) and the group's IO resolves
 * immediately. Copy is verbatim from the original server hero.
 */
export function SetnayanAiHero() {
  const headingRef = useLineReveal({ trigger: 'mount' });
  const groupRef = useReveal({ stagger: 0.08, y: 14 });

  return (
    <header
      ref={groupRef as React.RefObject<HTMLElement>}
      className="mx-auto max-w-2xl text-center"
    >
      <h1
        ref={headingRef as React.RefObject<HTMLHeadingElement>}
        className="mt-3 font-serif text-4xl leading-tight tracking-tight text-[var(--m-ink)] sm:text-5xl"
      >
        It doesn&rsquo;t chat. It watches your wedding for you.
      </h1>
      <p
        data-reveal-item
        className="mx-auto mt-4 max-w-xl text-base text-[#5F5E5A] sm:text-lg"
      >
        Every other wedding AI waits for you to ask a question. Setnayan AI keeps an eye on your vendors — the ones
        you&rsquo;re eyeing and the ones you&rsquo;ve booked — and taps you only when something needs you: a deposit due, a
        price that moved, a date about to clash. Every planning tool stays free; Setnayan AI is the paid brain on top.
      </p>
      <div
        data-reveal-item
        className="mt-7 flex flex-wrap items-center justify-center gap-3"
      >
        <Link
          href="/onboarding/wedding?from=setnayan-ai"
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
    </header>
  );
}

/**
 * HowItWorks — the ONE PanelThread section. `usePanelIntro` orchestrates the
 * champagne thread draw + a quiet staggered rise of the 3 step cards
 * (`data-premium-item`). The original section has no visible heading (it's
 * labelled via aria-label), so we add NO `data-premium-headline` — keeping the
 * a11y tree byte-identical; the thread carries the section's gold moment. The
 * 01/02/03 mono numerals are preserved; cards keep their CSS hover-lift (the hook
 * does clearProps:transform on finish).
 */
export function HowItWorks({ steps }: { steps: Step[] }) {
  const ref = usePanelIntro();

  return (
    <section
      ref={ref}
      className="relative mx-auto mt-16 max-w-3xl"
      aria-label="How Setnayan AI works"
    >
      <PanelThread tone="light" />
      <ol className="relative z-10 grid gap-6 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li
            key={s.t}
            data-premium-item
            className="rounded-2xl border border-[var(--m-ink)]/10 bg-white/60 p-5 transition-transform hover:-translate-y-0.5"
          >
            <span className="font-mono text-xs text-[#8C6932]">{String(i + 1).padStart(2, '0')}</span>
            <h2 className="mt-2 font-serif text-lg text-[var(--m-ink)]">{s.t}</h2>
            <p className="mt-1.5 text-sm text-[#5F5E5A]">{s.d}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Matchmaking — thread-less `usePanelIntro`: the section headline gets the serif
 * line-reveal (`data-premium-headline`) and the before/after rows rise in a quiet
 * stagger (`data-premium-item`). Deliberately a row-rise, NOT a morph/collapse —
 * the static struck-through → affirmed contrast already carries the idea, and a
 * second spectacle would compete with the hero. No PanelThread here (gold cap = 1).
 */
export function Matchmaking({ rows }: { rows: ReadonlyArray<readonly string[]> }) {
  const ref = usePanelIntro();

  return (
    <section
      ref={ref}
      className="mx-auto mt-16 max-w-3xl"
      aria-label="What makes Setnayan AI different"
    >
      <h2 data-premium-headline className="text-center font-serif text-2xl text-[var(--m-ink)] sm:text-3xl">
        A chatbot waits. Setnayan AI watches.
      </h2>
      <p data-premium-item className="mx-auto mt-3 max-w-xl text-center text-base text-[#5F5E5A]">
        Like a price watcher for flights or a home-search alert — but for your actual vendors, not the whole internet.
        It comes to you.
      </p>
      <ul className="mt-7 overflow-hidden rounded-2xl border border-[var(--m-ink)]/10">
        {rows.map(([before, after], i) => (
          <li
            key={after}
            data-premium-item
            className={`grid grid-cols-1 gap-1 px-5 py-4 sm:grid-cols-2 sm:gap-6 ${i % 2 ? 'bg-white/40' : 'bg-white/70'}`}
          >
            <span className="text-sm text-[#9A8F86] line-through decoration-[#9A8F86]/40">{before}</span>
            <span className="text-sm font-medium text-[var(--m-ink)]">{after}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * RevealBlock — a single whole-element `useReveal` (no inner stagger): the ref
 * element itself rises once on scroll-in. Used for the FAQ list, which should
 * arrive as one quiet beat, not row-by-row (it's a scannable reference). Renders
 * the server-passed children unchanged.
 */
export function RevealBlock({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useReveal();
  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className={className}>
      {children}
    </div>
  );
}

/**
 * CtaPanel — thread-less `usePanelIntro`: the headline gets the serif line-reveal
 * (`data-premium-headline`); the subcopy + button rise quietly (`data-premium-item`).
 * Gold stays a hairline border on cream — no fill, no glow. No PanelThread (gold
 * cap = 1, spent on How-it-works).
 */
export function CtaPanel() {
  const ref = usePanelIntro();

  return (
    <section
      ref={ref}
      className="mx-auto mt-14 max-w-2xl rounded-3xl border border-[var(--m-orange)]/40 bg-[#FBF6EA] px-6 py-10 text-center"
    >
      <h2 data-premium-headline className="font-serif text-2xl text-[var(--m-ink)] sm:text-3xl">
        Let it watch your back
      </h2>
      <p data-premium-item className="mx-auto mt-3 max-w-lg text-base text-[#5F5E5A]">
        Planning on Setnayan is free to start — guest list, RSVP, seating, budget, and your wedding website. Setnayan AI
        is the paid brain that watches your vendors so you don&rsquo;t have to — a job you&rsquo;d otherwise need a small team
        for. Add it when you want it; 0% vendor commission, so it recommends what fits you, never what pays us.
      </p>
      <Link
        data-premium-item
        href="/onboarding/wedding?from=setnayan-ai"
        className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[var(--m-mulberry)] px-7 py-3 text-sm font-semibold text-[var(--m-paper)] transition-opacity hover:opacity-90"
      >
        Start planning · free
      </Link>
    </section>
  );
}
