/**
 * The static sections that are Papic's own — the feature spotlights and the
 * Event Hub panel. Server components: no state, no client bundle.
 *
 * The "why" for each half lives directly above it: the spotlight docblock below
 * records how this section is shaped and what may not be claimed in it; the
 * Event Hub docblock further down records why that panel reuses the shipped
 * obsidian surface instead of re-typing its colours.
 */

import Image from 'next/image';

/**
 * ── HOW THIS SECTION IS SHAPED, AND WHY IT CHANGED ────────────────────────
 * Owner, 2026-08-29, pointing at a rival's features page: *"this is the style i
 * want. simple, easy to understand, clean output."*
 *
 * Measured what that actually IS rather than guessing at a mood: their whole
 * page is SEVEN blocks. Each one is a small chip, a short name, ONE sentence,
 * and one picture of the product. No lists, no tables, no numbers, one action
 * at the end.
 *
 * Ours was twenty-five features in five dense definition lists with no picture
 * on any of them — a specification sheet, not a story. So the strongest six now
 * get a block each with a photograph, one idea at a time, and the rest survive
 * as a quiet list underneath.
 *
 * ⛔ THE BREADTH IS NOT DELETED, and that is deliberate: the same owner asked
 * for exactly this inventory a few hours earlier (*"but where are the other
 * features"*). Leading with six is a change of ORDER and WEIGHT, never a cut.
 * If a spotlight is ever dropped, its line still has to exist below.
 *
 * ⛔ AND THE DARK GRADIENT, THE PINNED SCROLL AND THE COPY ARE NOT TAKEN. The
 * palette is owner-locked (white page, ink, one action colour) and a
 * scroll-jacked hero is the opposite of "simple". What is borrowed is the
 * STRUCTURE — one idea, one picture, one sentence.
 *
 * 🔒 EVERY CLAIM HERE WAS CHECKED AGAINST A SHIPPED SURFACE OR THE LIVE CATALOG.
 * What is NOT here, so nobody adds it back:
 *   • Shutter (the in-app camera) — ships with the native app, Phase 2.
 *   • DSLR pairing — Phase 2.
 *   • Credits per guest — being built; may be claimed only once it ships.
 *   • "The year" / linking two celebrations — not built. `papic-chapters.ts`
 *     groups ONE gallery by distance from the day, a different thing wearing
 *     the same word. The chapters line below means only that.
 *   • Stories (₱2,000) — off sale and not in the free set.
 *
 * 💰 FREE vs PAID, read out of the live catalog and `FREE_FOR_ALL_SKUS`:
 *   • The live wall is FREE — `LIVE_WALL` is inactive in the catalog *because*
 *     it is in the free set, not because it was retired.
 *   • The keepsake magazine (`KWENTO`) is FREE for the same reason.
 *   • The Thank-You film (`PAPIC_ADDON_THANK_YOU`) is ACTIVE at a real price,
 *     so it carries a paid marker. Listing it beside the free things unmarked
 *     would be the one dishonest line on the page.
 *
 * 📷 The photographs are our own demo celebration, already in `public/`. They
 * are illustrative of the MOMENT each feature is for — they are not screenshots
 * of the feature. Recordings of each screen would be better and are a
 * production job, not a copy change; said here rather than implied.
 */

type Spotlight = {
  chip: string;
  t: string;
  d: string;
  img: string;
  alt: string;
};

/** Six blocks. One idea, one picture, one sentence. */
const SPOTLIGHTS: readonly Spotlight[] = [
  {
    chip: 'Everyone shoots',
    t: 'Your guests are the crew',
    d: 'Every guest shoots from their own phone — no app, no account, just a code. You get the whole room’s view of the night, from the seats a photographer never sits in.',
    img: '/demo/maria-jose/toast.webp',
    alt: 'A toast, seen over the heads of the guests watching it',
  },
  {
    chip: 'Tagging',
    t: 'Every photo finds its people',
    d: 'Hold a place card in frame for one guest, or a table sign for the whole table. Those photos go straight to them — nobody types a name all night.',
    img: '/demo/maria-jose/wall-6.webp',
    alt: 'A printed place card on a table setting',
  },
  {
    chip: 'Snippets',
    t: 'Ten seconds of sound and movement',
    d: 'A Snippet is the toast, the laugh, the entrance — the one thing a photograph cannot keep.',
    img: '/demo/maria-jose/firstdance.webp',
    alt: 'A couple dancing under lights',
  },
  {
    chip: 'The live wall',
    t: 'The night, on the venue screen',
    d: 'The wall has its own web address. Open it on whatever the venue has — a TV, a projector, a laptop — type the short code once, and the night plays there as it happens. Included.',
    img: '/demo/maria-jose/reception.webp',
    alt: 'A reception laid out under strings of lights',
  },
  {
    chip: 'Each guest’s own',
    t: 'Everybody goes home with theirs',
    d: 'Nobody gets one big pile to scroll. Each guest gets their own gallery, and can turn it into a short video set to music.',
    img: '/demo/maria-jose/wall-8.webp',
    alt: 'A guest, mid-laugh, at a wedding',
  },
  {
    chip: 'For good',
    t: 'Nothing here expires',
    d: 'No renewal, no subscription, no email a year from now saying your photos are about to go. They are simply yours.',
    img: '/demo/maria-jose/wall-4.webp',
    alt: 'Two guests embracing at a wedding',
  },
];

type Extra = { t: string; d: string; paid?: boolean };

/** Everything else, kept — the breadth, in one quiet list. */
const EVERYTHING_ELSE: readonly Extra[] = [
  { t: 'Face tagging', d: 'A guest adds a selfie once and their photos find them. Anyone who skips it is never matched.' },
  { t: 'Face blocking', d: 'Anyone can ask not to be shown. We blur the picture itself, and if the blurring fails it does not go up at all.' },
  { t: 'Nothing unscreened is ever shown', d: 'Every photo is checked before it can appear, and that cannot be switched off.' },
  { t: 'Photo challenges', d: 'Little missions for the room — a written library to choose from, or write your own.' },
  { t: 'Video greetings', d: 'Ask your guests to leave a short message on camera instead of signing a book.' },
  { t: 'Challenges your suppliers suggest', d: 'Your photographer can propose one. Nothing appears until you approve it.' },
  { t: 'A recap page', d: 'The celebration gathered into one page you can send.' },
  { t: 'A keepsake magazine', d: 'Your photographs laid out to print, with your guests’ words beside the picture each one is about. Free.' },
  { t: 'Life flash', d: 'The whole story, cut short and set to music.' },
  { t: 'A thank-you film', d: 'Made from the night and addressed to the people who came.', paid: true },
  { t: 'A gallery that reads in chapters', d: 'Grouped by how far from the day each photo was taken, so the run-up reads as the run-up.' },
  { t: 'A copy in your own Google Drive', d: 'Connect it and your originals land there too.' },
  { t: 'Posters and place cards you can print', d: 'The codes come ready to put on the tables.' },
  { t: 'It works with no signal', d: 'Photos wait on the phone and send themselves when the venue’s signal comes back.' },
  { t: 'Start months early', d: 'Cameras can open well before the day, so the engagement shoot is already in there.' },
  { t: 'Five looks', d: 'Pick how the night is graded and every camera follows.' },
  { t: 'You moderate', d: 'Anything can be taken down, by you, at any time.' },
  { t: 'Decide who sees the shared gallery', d: 'Open it to your guests or keep it to yourselves.' },
  { t: 'Your suppliers’ photos, on your terms', d: 'What they hand over reaches you, and you say what happens to it.' },
  { t: 'Add your own', d: 'Your photographs and videos go into the same library as everyone else’s.' },
];

export function PapicFeatures() {
  return (
    <section className="mx-auto mt-20 max-w-3xl" aria-label="What Papic does">
      <h2 className="font-serif text-2xl tracking-tight text-[var(--m-ink)] sm:text-3xl">
        Everything it does
      </h2>
      <p className="mt-2 text-sm text-[var(--m-slate-2)]">
        Credits are the only thing you ever pay for. All of this comes with them.
      </p>

      <div className="mt-10 space-y-16">
        {SPOTLIGHTS.map((f, i) => (
          <article key={f.t} className="sm:flex sm:items-center sm:gap-8">
            <div
              className={`relative aspect-[4/3] overflow-hidden rounded-2xl sm:aspect-square sm:w-[44%] sm:flex-none ${
                // Alternate sides on wide screens so the page has a rhythm
                // instead of six identical rows.
                i % 2 === 1 ? 'sm:order-2' : ''
              }`}
            >
              <Image
                src={f.img}
                alt={f.alt}
                fill
                sizes="(min-width:640px) 320px, 100vw"
                className="object-cover"
              />
            </div>
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

      {/* The breadth, kept but quiet. A reader who wants the specification can
          have it; a reader who wants the story has already had it above. */}
      <div className="mt-16 border-t border-[var(--m-line)] pt-8">
        <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[var(--m-orange-2)]">
          And everything else
        </p>
        <dl className="mt-4 space-y-3.5">
          {EVERYTHING_ELSE.map((f) => (
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
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */

/**
 * WHERE IT LIVES — the celebration page's own gallery, reproduced.
 *
 * Owner, 2026-08-29: *"can we show the exact feel of the event hub papic
 * part?"* So this is not designed here. It reuses the SHIPPED obsidian surface
 * classes (`sn-gal`, `sn-gal-kick`, `sn-gal-soft`, `sn-gal-text`) and the real
 * copy from `live-wall-block.tsx` and `photos-of-you-gallery.tsx` — the pulsing
 * gold dot, the mono kicker, the serif italic count, the "Not me" line.
 *
 * 🚨 USE THE CLASSES, NEVER RE-TYPE THE COLOURS. This is a DARK ISLAND on a
 * light page, not dark mode: page theme colours resolve to their LIGHT values
 * here and ink measures 1.27:1 against the obsidian. `sn-gal` is the only thing
 * that gets this right, and it cannot drift from the real gallery.
 *
 * ⚠ The photographs are our own demo wedding, already in `public/`. The numbers
 * are illustrative and belong to a made-up celebration — they are not read from
 * anything, and they must never be presented as a real event's totals.
 */
const WALL = [
  { src: '/demo/maria-jose/wall-3.webp', cam: 'Camera 2' },
  { src: '/demo/maria-jose/wall-5.webp', cam: 'Camera 1' },
  { src: '/demo/maria-jose/wall-6.webp', cam: 'Camera 3' },
] as const;

const MINE = [
  '/demo/maria-jose/wall-8.webp',
  '/demo/maria-jose/wall-1.webp',
  '/demo/maria-jose/toast.webp',
] as const;

export function PapicHub() {
  return (
    <section className="mx-auto mt-16 max-w-2xl" aria-label="Where Papic lives">
      <h2 className="font-serif text-2xl tracking-tight text-[var(--m-ink)] sm:text-3xl">
        On your own page, not on ours
      </h2>
      <p className="mt-2 text-sm text-[var(--m-slate-2)]">
        Papic is a part of the celebration page you already have — the same page holding your
        details and your RSVP. There is no second website, and nothing to send anyone twice.
      </p>

      <div className="mt-6 overflow-hidden rounded-[var(--m-r-lg)] border border-[var(--m-line)]">
        {/* A sliver of the celebration page above, so the obsidian panel is
            visibly INSIDE something rather than floating. */}
        <div className="border-b border-[var(--m-line)] bg-[var(--m-paper)] px-4 py-4">
          <p className="text-[1.05rem] font-semibold tracking-tight text-[var(--m-ink)]">Maria &amp; Jose</p>
          <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.09em] text-[var(--m-slate-2)]">
            14 February 2027 · Tagaytay
          </p>
          <div className="mt-3 flex gap-4 text-[0.78rem] text-[var(--m-slate-2)]">
            <span>Details</span>
            <span>RSVP</span>
            <span>Seating</span>
            <span className="border-b-2 border-[var(--m-mulberry)] pb-0.5 font-semibold text-[var(--m-mulberry)]">
              Photos
            </span>
          </div>
        </div>

        <div className="sn-gal p-5">
          <HubHead kick="Live from the wedding" big="1,284" small="moments and counting" />
          <div className="mt-3.5 grid grid-cols-3 gap-1.5">
            {WALL.map((w) => (
              <figure key={w.src} className="relative m-0 aspect-square overflow-hidden rounded-lg">
                <Image src={w.src} alt="" fill sizes="(min-width:640px) 200px, 32vw" className="object-cover" />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgb(23_22_15/0.85)] to-transparent px-1.5 pb-1 pt-4 font-mono text-[0.5rem] uppercase tracking-[0.04em] text-[var(--sn-ob-text)]">
                  {w.cam}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>

        <div className="sn-gal border-t border-[rgb(251_250_247/0.12)] p-5">
          <HubHead kick="Photos of you — so far" big="34" small="so far" />
          <div className="mt-3.5 grid grid-cols-3 gap-1.5">
            {MINE.map((src) => (
              <div key={src} className="relative aspect-square overflow-hidden rounded-lg">
                <Image src={src} alt="" fill sizes="(min-width:640px) 200px, 32vw" className="object-cover" />
              </div>
            ))}
          </div>
          <p className="sn-gal-soft mt-3.5 rounded-lg border border-[rgb(251_250_247/0.12)] px-3 py-3 text-sm">
            Tap <span className="sn-gal-text font-medium">Not me</span> on any photo that isn’t you,
            and it leaves your gallery.
          </p>
          <p className="sn-gal-text mt-3 rounded-lg border-l-2 border-[var(--sn-ob-gold)] bg-[rgb(203_167_102/0.12)] px-3 py-2 text-sm">
            These are yours to keep. Nothing here expires.
          </p>
        </div>
      </div>
    </section>
  );
}

function HubHead({ kick, big, small }: { kick: string; big: string; small: string }) {
  return (
    <div className="flex items-start justify-between gap-2.5">
      <p className="sn-gal-kick inline-flex items-center gap-2 font-mono text-[0.58rem] font-bold uppercase tracking-[0.14em]">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--sn-ob-gold)]" />
        {kick}
      </p>
      <p className="sn-gal-soft flex flex-none items-baseline gap-1.5 text-[0.72rem]">
        <span className="sn-gal-text font-serif text-xl italic leading-none tabular-nums">{big}</span>
        <span>{small}</span>
      </p>
    </div>
  );
}
