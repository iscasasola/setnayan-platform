import Link from 'next/link';
/*
  🔑 DOORWAY_TONE LIVES IN ITS OWN FILE AND IS RE-EXPORTED FROM HERE.
  `/alaala` imports ONLY the tone — it does not render `DoorwayPage`. Once this
  file began importing `AppRailShell` (which is `server-only` and pulls
  `front-door.css`), that one import would have dragged the whole shared shell
  into a page that keeps `force-static` and never renders it. Splitting the
  constant costs one file and keeps the import graph honest.
*/
import { DOORWAY_TONE } from './_doorway-tone';
import { DemoOverlayHost } from './demo-overlay-host';
import { AddToEventCta } from './add-to-event-cta';

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

export { DOORWAY_TONE };

export type DoorwayStep = {
  t: string;
  d: string;
  /** An illustration belonging to THIS step, rendered inside its card — e.g.
   *  `/papic`'s tile-settle under "Every photo finds its people". It is the
   *  step's own CONTENT, like `t` and `d`, not a layout escape: a page still
   *  cannot move, resize or reorder the card that holds it. Without this the
   *  port would have had to leave `/papic` on a private fork of the whole
   *  spine to keep one animation. */
  figure?: React.ReactNode;
};
export type DoorwayFaq = { q: string; a: string };
/** `[what it is like without, what it is like with]` — struck-through, then affirmed. */
export type DoorwayVersus = readonly [string, string];

import { TryTheDemoButton } from './try-the-demo-button';
import type { DemoOverlayId } from '@/lib/demo-overlay-bus';

export type DoorwayProps = {
  /**
   * THE h1. One per page, rendered as an h1 by this component and only here.
   *
   * ── There is no `kicker` and no `lede` (owner 2026-08-19) ──────────────────
   * The hero used to be a gold mono eyebrow, then the h1, then a paragraph.
   * Owner, on that shape across the app: *"we do not need these. it just eats
   * up space and we want it to be simpler to understand on each page without
   * too much side comments"* — then, asked directly whether it applied to the
   * marketing pages too: *"build it."*
   *
   * The product is still explained, one screen lower and better: "How it
   * works" (three steps) and the differentiator both sit directly under this
   * hero. Nothing was deleted that was the only statement of anything.
   * ⚠ `differentiator.lede` is a DIFFERENT field and is untouched.
   */
  title: string;
  primary: { href: string; label: string };
  secondary: { href: string; label: string };
  /**
   * The product's LIVE demo — the one you can try from this page, right now,
   * without an account.
   *
   * 🔑 RESTORED 2026-08-14, NOT INVENTED. Papic, Live Studio and 3D Plan have
   * had working demos since 2026-07-03. They were opened from the cinematic
   * homepage, which was deleted on 2026-08-13 — taking with it the only five
   * `setOverlay(...)` call sites in the repo. The overlays stayed MOUNTED on
   * every one of these doorways the whole time, unreachable. Owner, 2026-08-14:
   * *"demo of Setnayan AI, Papic, Live Studio and 3D Plan is gone. we need to
   * add them back."*
   *
   * ⚠ THIS IS THE RIGHT HOME FOR THEM, not the front door. The overlay is
   * already mounted here, so this is a BUTTON, not a mount — whereas `/` is
   * deliberately absent from `NAV_ROUTES` and mounts no overlays at all, and
   * adding it there would render the marketing nav on top of the front door's
   * own bar. A demo also belongs on the page that sells the thing.
   *
   * ⚠ SETNAYAN AI HAS NONE, and that is measured, not an omission: its
   * homepage pop-up was a savings COMPARATOR, never a live trial. Do not add a
   * `demo` to `/setnayan-ai` without building one first.
   */
  demo?: { id: DemoOverlayId; label: string; sublabel?: string };
  /** Anchors each `aria-label` to the product's own name — "How 3D Plan works". */
  productName: string;
  /**
   * The `STUDIO_APPS` key, when this doorway sells a service that can be added
   * to a celebration. Present ⇒ the PRIMARY CTA becomes "Add to an event" for a
   * signed-in person and stays the ordinary link for everyone else. Absent ⇒
   * the page renders exactly as before, which is why `/alaala` and any future
   * non-service doorway need no change.
   */
  studioKey?: string;
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

/*
 * ─── THE PALETTE, AS TOKENS ──────────────────────────────────────────────
 * Every colour below is a locked `--m-*` token read from globals.css, never a
 * hex typed here. That is the whole point: the Warm Editorial Archive lock
 * moved FOUR times in three weeks, and `lib/palette-lock.test.ts` proves the
 * TOKENS stay accessible — but it cannot see a hex a component typed instead.
 * These eight pages were copy-pasted from one another, so each raw hex was
 * eight pages wide.
 *
 * TWO THINGS CHANGED HERE, AND BOTH WERE DEFECTS RATHER THAN TASTE:
 *
 * 1 · THE CARDS WERE WHITE ON A CREAM PAGE. `bg-white/60` over `bg-cream`
 *     composites to #FEFDFC — pure white for all practical purposes — on a
 *     page. The lock says the page and its cards are BOTH the same ground and
 *     are separated by a border and a shadow, so that is what they now are.
 *
 * 2 · THE STRUCK-THROUGH COLUMN FAILED AA. #9A8F86 measures 3.06:1 on cream,
 *     below the 4.5:1 floor for normal text — on every doorway, in the one
 *     section whose entire job is the comparison. `--m-slate-3` (3.55:1) fails
 *     too; `--m-slate-2` clears it at 5.21:1 and still reads as the quiet half
 *     against ink's 13.82:1, so the hierarchy survives the fix.
 *     ⚠ `lint-label-on-fill-contrast.mjs` could never catch this: it judges
 *     only pairings where BOTH sides are opaque, and the fill was an alpha
 *     white over an unknown parent. `doorway-palette.test.ts` closes that gap.
 *
 * 🪤 SIZE AGAINST CREAM, NOT WHITE. Gold `--m-orange-2` on cream is 4.79:1 and
 * passes; on `--m-paper-2` it is 4.42:1 and fails. That is why the step cards
 * are `--m-paper` and only the zebra rows alternate into `--m-paper-2` — the
 * rows carry no gold. Do not "tidy" the two to one value.
 */
/**
 * EXPORTED, because one doorway cannot mount the spine. `/alaala` is the
 * umbrella page for the other five — an orb, a five-way pillar grid and two
 * closing destinations — so forcing it through `DoorwayPage` would mean
 * INVENTING a how-it-works panel and a differentiator lede it has never had,
 * and dropping one of its two CTAs. That is redrawing, not porting. It shares
 * the archetype's COLOURS from here instead, so there is still exactly one
 * place a doorway's palette is decided. `doorway-palette.test.ts` bans a raw
 * hex in any of the eight, which is what makes that sharing enforced rather
 * than merely offered.
 */

const MUTED = DOORWAY_TONE.muted;
const GOLD = DOORWAY_TONE.gold;
const CARD = DOORWAY_TONE.card;

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
  title,
  primary,
  secondary,
  demo,
  productName,
  studioKey,
  steps,
  differentiator,
  faq,
  closing,
  structuredData,
  children,
  epilogue,
}: DoorwayProps) {
  return (
    /*
      🔑 THE SHELL IS NOT MOUNTED HERE ANY MORE (2026-08-15). It moved to
      `app/(shell)/layout.tsx` so it SURVIVES navigation — mounted in a
      component, it was inside the subtree Next swaps, so the bar and rail were
      torn down and rebuilt on every click. Measured on the live site: the
      document survived, `.fd-topbar` and `.fd-rail` did not.

      ⚠ THE REASON IT WAS HERE RATHER THAN IN A `layout.tsx` STILL STANDS, and
      it is why the group holds only `page.tsx` + `loading.tsx` for these
      routes. Beneath these seven directories live the paparazzo's camera
      (`/papic/seat/[token]`), the guest gallery whose URL is a bearer
      credential, the owner-locked control room (`/panood/control/[eventId]`)
      and the program pop-out the host's OBS window-CAPTURES AND BROADCASTS —
      chrome on that last one goes out on the wedding's live stream. Those all
      stayed OUTSIDE `app/(shell)/`, so they inherit nothing. Verified in a
      scratch build: a route below the group but outside it carried zero of the
      layout's markup.
    */
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
          {/* as="h1" is written HERE and nowhere else — see the docblock. */}
          <LineRevealHeading
            as="h1"
            trigger="mount"
            className="font-serif text-4xl leading-tight tracking-tight text-[var(--m-ink)] sm:text-5xl"
          >
            {title}
          </LineRevealHeading>
          <RevealBand stagger={0.08} y={14}>
            <div data-reveal-item className="mt-7 flex flex-wrap items-center justify-center gap-3">
              {/*
                THE ONE DIFFERENCE BETWEEN SIGNED OUT AND SIGNED IN, and it is
                deliberately a SWAP rather than an addition: owner 2026-08-21,
                the page must otherwise be identical. `AddToEventCta` renders
                this very link when nobody is signed in, so the signed-out page
                is byte-identical to what it was.
              */}
              {studioKey ? (
                <AddToEventCta studioKey={studioKey} primary={primary} />
              ) : (
                <Link href={primary.href} className={PRIMARY_CTA}>
                  {primary.label}
                </Link>
              )}
              <Link href={secondary.href} className={SECONDARY_CTA}>
                {secondary.label}
              </Link>
            </div>
            {/*
              THE LIVE DEMO — its own row under the two CTAs, not a third
              pill beside them. It is a different KIND of offer: the CTAs send
              you somewhere, this one happens here, on this page, with your
              phone. Crowding it into the same row would read as a third
              equal-weight destination and would wrap badly on a phone at three
              items. It renders nothing at all when no demo is available or
              when the chrome that hosts it is not mounted — see
              `try-the-demo-button.tsx`; "no fake doors" is a locked rule and
              this control's whole history is a button whose target vanished.
            */}
            {demo ? (
              <div data-reveal-item className="mt-4 flex justify-center">
                <TryTheDemoButton
                  demo={demo.id}
                  label={demo.label}
                  sublabel={demo.sublabel}
                />
              </div>
            ) : null}
          </RevealBand>
        </header>

        {/* How it works — the one PanelThread panel. */}
        <section className="mx-auto mt-16 max-w-3xl" aria-label={`How ${productName} works`}>
          <HowItWorksPanel>
            <ol className="grid gap-6 sm:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.t} data-premium-item className={`${CARD} p-5`}>
                  <span className={`font-mono text-xs ${GOLD}`}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h2 className="mt-2 font-serif text-lg text-[var(--m-ink)]">{s.t}</h2>
                  <p className={`mt-1.5 text-sm ${MUTED}`}>{s.d}</p>
                  {s.figure}
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
            className="mt-7 overflow-hidden rounded-2xl border border-[var(--m-line)] shadow-[var(--m-shadow-sm)]"
            stagger={0.06}
            y={12}
          >
            {differentiator.rows.map(([before, after], i) => (
              <li
                key={after}
                data-reveal-item
                className={`grid grid-cols-1 gap-1 px-5 py-4 sm:grid-cols-2 sm:gap-6 ${
                  i % 2 ? 'bg-[var(--m-paper-2)]' : 'bg-[var(--m-paper)]'
                }`}
              >
                <span
                  className={`text-sm line-through decoration-[var(--m-slate-3)] ${MUTED}`}
                >
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
          <section
            className={`mx-auto mt-14 max-w-2xl px-6 py-10 text-center ${DOORWAY_TONE.closingPanel}`}
          >
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
      {/* The demo overlays' host. These pages left NAV_ROUTES, so SiteChrome —
          which used to mount HomeOverlays for them — no longer runs here, and
          without this the "Try the demo" button below becomes a fake door. */}
      <DemoOverlayHost />
    </>
  );
}
