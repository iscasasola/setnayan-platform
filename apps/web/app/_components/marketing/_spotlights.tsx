import Image from 'next/image';
import { DemoFilm } from './_demo-film';

/**
 * THE FEATURE SPOTLIGHTS — one idea, one picture, one sentence. Shared.
 *
 * ─── WHERE THIS SHAPE COMES FROM ─────────────────────────────────────────
 * Owner, 2026-08-29, pointing at a rival's features page: *"this is the style
 * i want. simple, easy to understand, clean output."* Measured then rather than
 * guessed at: their page is a handful of blocks, each a small chip, a short
 * name, ONE sentence and one picture of the product — no lists, no tables, no
 * numbers. `/papic` shipped it that day as `PapicFeatures`.
 *
 * Owner, 2026-09-05, pointing at the same rival again from `/setnayan-ai`:
 * *"i like how this page presents its features"* … *"we also want to deliver
 * the same concept across the rest of the studio description pages."*
 *
 * So the block is now built ONCE, here, and a page supplies only content —
 * the archetype rule `_doorway.tsx` already encodes (*design the archetype,
 * never the screen*). The `<article>` markup below is `PapicFeatures`' own,
 * lifted verbatim, and Papic renders through it unchanged.
 *
 * ─── WHAT IS DELIBERATELY NOT HERE ───────────────────────────────────────
 * Papic's folded "everything else" list stays in `_papic-sections.tsx`. It is
 * pinned there by `papic-page-says-only-what-is-true.test.ts` (the `<details>`
 * fold and the derived `{EVERYTHING_ELSE.length}` count), and that pin is the
 * point: the fold exists because the owner read that page on a phone and said
 * *"cut it down"*. Pages that need a folded list get `SpotlightExtras` below;
 * Papic keeps its own so the guard keeps guarding it.
 *
 * ─── THE PICTURE IS THE HONESTY TEST ─────────────────────────────────────
 * 🔑 A PICTURE IS A CLAIM, AND A CAPTION IS NOT THE PICTURE. On the day this
 * shipped, four spotlights were illustrated by reading a demo scene's caption
 * without opening the frame — and three of them showed the PAID branded QR
 * where the free per-guest QR was claimed, while the fourth showed
 * "One price for your wedding · ₱1,000" on a page whose rule is that it quotes
 * no price. OPEN THE IMAGE. `spotlights-are-real.test.ts` bans those four by
 * name, with the reason, and fails if any page names a picture that is not on
 * disk.
 *
 * Three kinds, all real:
 *   • `still` — a captured frame of the product's OWN demo scene, the same
 *     scenes `studio-card-demo.tsx` renders and `public/add-ons/demo/*.mp4`
 *     records. A picture of the actual UI, never a drawn mock-up.
 *   • `film`  — that product's looping recording, via `DemoFilm`.
 *   • `photo` — a photograph from our own demo celebration, for a MOMENT
 *     rather than a screen (the Papic pattern).
 * A page cannot pass a bare URL to something outside those roots, which is
 * how the "one picture" stays a picture of us.
 *
 * Server component: no state, no client bundle of its own. Only `DemoFilm`
 * is client, and only when a page asks for a film.
 */

export type SpotlightMedia =
  | { kind: 'still'; src: `/add-ons/demo/stills/${string}.jpg`; alt: string }
  | { kind: 'film'; slug: string; title: string }
  | { kind: 'photo'; src: `/demo/${string}`; alt: string };

export type Spotlight = {
  /** 1–3 words. A category label, mono, gold. */
  chip: string;
  /** The idea, 4–8 words. */
  t: string;
  /** One to two sentences. */
  d: string;
  media: SpotlightMedia;
};

export type SpotlightExtra = { t: string; d: string; paid?: boolean };

/**
 * Column rhythm: alternate sides on wide screens so the page has a rhythm
 * instead of N identical rows — Papic's rule, kept.
 */
export function Spotlights({ items }: { items: readonly Spotlight[] }) {
  return (
    <div className="mt-10 space-y-16">
      {items.map((f, i) => (
        <article key={f.t} className="sm:flex sm:items-center sm:gap-8">
          <SpotlightFigure media={f.media} flip={i % 2 === 1} />
          <div className="mt-5 sm:mt-0">
            <p className="inline-flex rounded-full border border-[var(--m-line)] px-3 py-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--m-orange-2)]">
              {f.chip}
            </p>
            <h3 className="mt-3 font-serif text-xl leading-snug tracking-tight text-[var(--m-ink)] sm:text-2xl">
              {f.t}
            </h3>
            <p className="mt-2 text-[0.98rem] leading-relaxed text-[var(--m-slate-2)]">{f.d}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function SpotlightFigure({ media, flip }: { media: SpotlightMedia; flip: boolean }) {
  const order = flip ? 'sm:order-2' : '';

  if (media.kind === 'photo') {
    // Papic's frame, verbatim: 4:3 on a phone, square beside the text.
    return (
      <div
        className={`relative aspect-[4/3] overflow-hidden rounded-2xl sm:aspect-square sm:w-[44%] sm:flex-none ${order}`}
      >
        <Image
          src={media.src}
          alt={media.alt}
          fill
          sizes="(min-width:640px) 320px, 100vw"
          className="object-cover"
        />
      </div>
    );
  }

  /*
    A phone, standing on the card's own cream. The still and the film are both
    9:19 recordings of the app on a phone, so the frame is their own ratio and
    nothing is cropped — it reads as what it is: the app, running.

    The frame sits centred in the same 44% column a photograph would fill, so
    a page mixing photographs and screens keeps one rhythm.
  */
  return (
    <div
      className={`flex justify-center rounded-2xl border border-[var(--m-line)] bg-[var(--m-paper-2)] px-6 py-6 sm:w-[44%] sm:flex-none ${order}`}
    >
      {media.kind === 'film' ? (
        <DemoFilm slug={media.slug} title={media.title} size="spotlight" />
      ) : (
        <div className="aspect-[460/972] w-[150px] flex-none overflow-hidden rounded-2xl border border-[var(--m-line)] sm:w-[180px]">
          <Image
            src={media.src}
            alt={media.alt}
            width={460}
            height={972}
            sizes="180px"
            className="h-full w-full object-cover"
          />
        </div>
      )}
    </div>
  );
}

/**
 * The breadth, kept but folded — for a page whose long list would otherwise
 * stand between the reader and the price. `<details>` keeps every line in the
 * DOM, so it stays indexed and openable. The count is DERIVED, never typed.
 */
export function SpotlightExtras({
  items,
  label = 'And everything else',
}: {
  items: readonly SpotlightExtra[];
  label?: string;
}) {
  if (items.length === 0) return null;
  return (
    <details className="group mt-16 border-t border-[var(--m-line)] pt-8">
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4 text-[0.98rem] font-semibold text-[var(--m-ink)] [&::-webkit-details-marker]:hidden">
        <span>
          {label}
          <span className="ml-2 font-mono text-[0.72rem] font-normal tabular-nums text-[var(--m-slate-2)]">
            {items.length} more
          </span>
        </span>
        <span aria-hidden className="flex-none font-mono text-[var(--m-orange-2)] group-open:hidden">
          +
        </span>
        <span aria-hidden className="hidden flex-none font-mono text-[var(--m-orange-2)] group-open:block">
          −
        </span>
      </summary>
      <dl className="mt-5 space-y-3.5">
        {items.map((f) => (
          <div key={f.t} className="sm:flex sm:gap-4">
            <dt className="flex flex-wrap items-baseline gap-x-2 text-[0.94rem] font-semibold text-[var(--m-ink)] sm:w-[38%] sm:flex-none">
              {f.t}
              {f.paid ? (
                <span className="rounded-full border border-[var(--m-line)] px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.08em] text-[var(--m-slate-2)]">
                  Paid add-on
                </span>
              ) : null}
            </dt>
            <dd className="mt-0.5 text-[0.94rem] text-[var(--m-slate-2)] sm:mt-0">{f.d}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/**
 * The whole section, for a `DoorwayPage` `children` slot: heading, one quiet
 * line, the spotlights, and an optional folded remainder. Papic composes its
 * own section (it owns the fold); every other doorway can use this as-is.
 */
export function SpotlightSection({
  productName,
  heading,
  lede,
  items,
  extras,
}: {
  productName: string;
  heading: string;
  lede?: string;
  items: readonly Spotlight[];
  extras?: readonly SpotlightExtra[];
}) {
  return (
    <section className="mx-auto mt-20 max-w-3xl" aria-label={`What ${productName} does`}>
      <h2 className="font-serif text-2xl tracking-tight text-[var(--m-ink)] sm:text-3xl">{heading}</h2>
      {lede ? <p className="mt-2 text-sm text-[var(--m-slate-2)]">{lede}</p> : null}
      <Spotlights items={items} />
      {extras ? <SpotlightExtras items={extras} /> : null}
    </section>
  );
}
