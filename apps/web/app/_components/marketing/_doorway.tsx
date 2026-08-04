import Link from 'next/link';
import { Reveal } from './_motion';
import { LineRevealHeading, RevealBand, RevealList, HowItWorksPanel } from './_pa-motion';

/**
 * THE PUBLIC DOORWAY — one shape, eight pages.
 *
 * ─── WHY THIS EXISTS ─────────────────────────────────────────────────────
 * The Pa- doorways were built by copy-paste and it shows: `/pa3d` and
 * `/pawebsite` rendered **byte-identical JSX**, differing only in copy strings.
 * Six pages carried the same seven-section spine, hand-written six times, and
 * `/papic` carried a private fork of the motion primitives on top of that.
 *
 * That is the haystack the archetype kills. The owner approved the Editorial
 * archetype on 2026-08-04; this is that archetype as a component, so a doorway
 * becomes **content plus a route**, and a change to the shape happens once.
 *
 * ─── THE RULE THIS ENCODES ───────────────────────────────────────────────
 * Design the ARCHETYPE, never the screen. Everything variable here is COPY or
 * a DESTINATION. Nothing about layout, spacing, type or motion is a prop —
 * because a "just this one page" layout prop is how eight pages drift back
 * apart, one reasonable exception at a time.
 *
 * ─── THE h1, AND WHY IT IS NOT A PROP ────────────────────────────────────
 * `LineRevealHeading` defaults to `as = 'h2'`. Every doorway used to get its
 * only h1 from a prop passed at its own call site — seven separate chances to
 * forget, on pages whose whole job is to be found, with nothing in the repo
 * checking. Here `as="h1"` is written ONCE, below, and cannot be overridden.
 * `doorway-invariants.test.ts` asserts it stays exactly one.
 *
 * Server component: no 'use client'. The motion primitives are the only client
 * parts and they carry their own directive.
 */

export type DoorwayStep = { t: string; d: string };
export type DoorwayFaq = { q: string; a: string };
/** `[what it is like without, what it is like with]` — struck-through, then affirmed. */
export type DoorwayVersus = readonly [string, string];

export type DoorwayProps = {
  /** Mono eyebrow above the title. Omitted on `/papic`, which opens on its h1. */
  kicker?: string;
  /** THE h1. One per page, rendered as an h1 by this component and only here. */
  title: string;
  lede: string;
  primary: { href: string; label: string };
  secondary: { href: string; label: string };
  /** Anchors each `aria-label` to the product's own name — "How Pa3D works". */
  productName: string;
  steps: readonly DoorwayStep[];
  differentiator: { heading: string; lede: string; rows: readonly DoorwayVersus[] };
  faq: readonly DoorwayFaq[];
  closing: { heading: string; body: string; href: string; label: string };
  /** Structured data, rendered verbatim. Each doorway ships SoftwareApplication
   *  + FAQPage; losing it is invisible on screen and costs rich results. */
  structuredData: readonly unknown[];
  /** Sections a page needs that the archetype does not model — `/papic`'s price
   *  anchor, `/alaala`'s pillar grid. Rendered after the differentiator, so an
   *  exception is VISIBLE as an exception instead of being smuggled into the
   *  shared markup as a new prop nobody else uses. */
  children?: React.ReactNode;
  /** The same, but AFTER the FAQ — for text that must follow the questions.
   *  `/panood` carries a YouTube-API-Services disclosure there, deliberately,
   *  for an OAuth reviewer. Two named slots, not a general layout escape: a
   *  page still cannot reorder the spine. */
  epilogue?: React.ReactNode;
};

const MUTED = 'text-[#5F5E5A]';
const GOLD = 'text-[#8C6932]';

const PRIMARY_CTA =
  'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full ' +
  'bg-[var(--m-mulberry)] px-7 py-3 text-sm font-semibold text-[var(--m-paper)] ' +
  'transition-opacity hover:opacity-90';

const SECONDARY_CTA =
  'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full ' +
  'border border-[var(--m-ink)]/20 px-7 py-3 text-sm font-semibold text-[var(--m-ink)] ' +
  'transition-colors hover:bg-[var(--m-ink)]/[0.04]';

const SECTION_HEADING = 'text-center font-serif text-2xl text-[var(--m-ink)] sm:text-3xl';

export function DoorwayPage({
  kicker,
  title,
  lede,
  primary,
  secondary,
  productName,
  steps,
  differentiator,
  faq,
  closing,
  structuredData,
  children,
  epilogue,
}: DoorwayProps) {
  return (
    <>
      {structuredData.map((ld, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      ))}
      <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-10 sm:pt-14">
        {/* Hero */}
        <header className="mx-auto max-w-2xl text-center">
          {kicker ? (
            <p className={`font-mono text-xs uppercase tracking-[0.22em] ${GOLD}`}>{kicker}</p>
          ) : null}
          {/* as="h1" is written HERE and nowhere else — see the docblock. */}
          <LineRevealHeading
            as="h1"
            trigger="mount"
            className={`${kicker ? 'mt-3 ' : ''}font-serif text-4xl leading-tight tracking-tight text-[var(--m-ink)] sm:text-5xl`}
          >
            {title}
          </LineRevealHeading>
          <RevealBand stagger={0.08} y={14}>
            <p data-reveal-item className={`mx-auto mt-4 max-w-xl text-base sm:text-lg ${MUTED}`}>
              {lede}
            </p>
            <div data-reveal-item className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link href={primary.href} className={PRIMARY_CTA}>
                {primary.label}
              </Link>
              <Link href={secondary.href} className={SECONDARY_CTA}>
                {secondary.label}
              </Link>
            </div>
          </RevealBand>
        </header>

        {/* How it works — the one PanelThread panel. */}
        <section className="mx-auto mt-16 max-w-3xl" aria-label={`How ${productName} works`}>
          <HowItWorksPanel>
            <ol className="grid gap-6 sm:grid-cols-3">
              {steps.map((s, i) => (
                <li
                  key={s.t}
                  data-premium-item
                  className="rounded-2xl border border-[var(--m-ink)]/10 bg-white/60 p-5"
                >
                  <span className={`font-mono text-xs ${GOLD}`}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h2 className="mt-2 font-serif text-lg text-[var(--m-ink)]">{s.t}</h2>
                  <p className={`mt-1.5 text-sm ${MUTED}`}>{s.d}</p>
                </li>
              ))}
            </ol>
          </HowItWorksPanel>
        </section>

        {/* The differentiator — what it is like without, then with. */}
        <section
          className="mx-auto mt-16 max-w-3xl"
          aria-label={`What makes ${productName} different`}
        >
          <LineRevealHeading className={SECTION_HEADING}>
            {differentiator.heading}
          </LineRevealHeading>
          <p className={`mx-auto mt-3 max-w-xl text-center text-base ${MUTED}`}>
            {differentiator.lede}
          </p>
          <RevealList
            className="mt-7 overflow-hidden rounded-2xl border border-[var(--m-ink)]/10"
            stagger={0.06}
            y={12}
          >
            {differentiator.rows.map(([before, after], i) => (
              <li
                key={after}
                data-reveal-item
                className={`grid grid-cols-1 gap-1 px-5 py-4 sm:grid-cols-2 sm:gap-6 ${i % 2 ? 'bg-white/40' : 'bg-white/70'}`}
              >
                <span className="text-sm text-[#9A8F86] line-through decoration-[#9A8F86]/40">
                  {before}
                </span>
                <span className="text-sm font-medium text-[var(--m-ink)]">{after}</span>
              </li>
            ))}
          </RevealList>
        </section>

        {/* Anything this archetype does not model, visible as an exception. */}
        {children}

        {/* FAQ */}
        <section className="mx-auto mt-16 max-w-2xl" aria-label={`${productName} questions`}>
          <LineRevealHeading className={SECTION_HEADING}>Questions, answered</LineRevealHeading>
          <dl className="mt-7 divide-y divide-[var(--m-ink)]/10 border-y border-[var(--m-ink)]/10">
            {faq.map((f, i) => (
              <Reveal key={f.q} delay={i * 40}>
                <div className="py-5">
                  <dt className="font-serif text-base text-[var(--m-ink)]">{f.q}</dt>
                  <dd className={`mt-1.5 text-sm ${MUTED}`}>{f.a}</dd>
                </div>
              </Reveal>
            ))}
          </dl>
        </section>

        {epilogue}

        {/* Closing CTA */}
        <Reveal>
          <section className="mx-auto mt-14 max-w-2xl rounded-3xl border border-[var(--m-orange)]/40 bg-[#FBF6EA] px-6 py-10 text-center">
            <h2 className="font-serif text-2xl text-[var(--m-ink)] sm:text-3xl">
              {closing.heading}
            </h2>
            <p className={`mx-auto mt-3 max-w-lg text-base ${MUTED}`}>{closing.body}</p>
            <Link href={closing.href} className={`mt-5 ${PRIMARY_CTA}`}>
              {closing.label}
            </Link>
          </section>
        </Reveal>
      </main>
    </>
  );
}
