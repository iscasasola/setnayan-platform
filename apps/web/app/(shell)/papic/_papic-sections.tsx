/**
 * The static sections that are Papic's own — the feature inventory and the
 * Event Hub panel. Server components: no state, no client bundle.
 *
 * ── THE FEATURE INVENTORY ─────────────────────────────────────────────────
 * Owner, 2026-08-29: *"but where are the other features. what else can we
 * offer? Papic Challenge, Video Greetings, Thank You, Face Tagging, Face
 * Blocking, and more"*. He was right: the page showed the mechanic and hid the
 * product.
 *
 * 🔒 EVERY ROW BELOW WAS CHECKED AGAINST A SHIPPED SURFACE OR THE LIVE CATALOG.
 * The temptation on a page like this is to list the roadmap. What is NOT here,
 * and why, so nobody adds it back:
 *   • Shutter (the in-app camera) — ships with the native app, Phase 2.
 *   • DSLR pairing — Phase 2.
 *   • Shots per guest — being built; may be claimed only once it ships.
 *   • "The year" / linking two celebrations — not built. `papic-chapters.ts`
 *     groups ONE gallery by distance from the day, which is a different thing
 *     wearing the same word. The chapters row below means only that.
 *   • Stories (₱2,000) — off sale and not in the free set.
 *
 * 💰 FREE vs PAID, read out of the live catalog and `FREE_FOR_ALL_SKUS`:
 *   • The live wall is FREE — `LIVE_WALL` is inactive in the catalog *because*
 *     it is in the free set, not because it was retired.
 *   • The keepsake magazine (`KWENTO`) is FREE for the same reason.
 *   • The Thank-You film (`PAPIC_ADDON_THANK_YOU`) is ACTIVE at a real price,
 *     so it carries a paid marker. Listing it beside the free things unmarked
 *     would be the one dishonest row on the page.
 */

import Image from 'next/image';

type Feature = { t: string; d: string; paid?: boolean };
type Group = { heading: string; items: readonly Feature[] };

const GROUPS: readonly Group[] = [
  {
    heading: 'Everyone shoots',
    items: [
      {
        t: 'Cameras for as many as you like',
        d: 'You never pay for a camera. Make one for a friend, one for each table, or one for every guest.',
      },
      {
        t: 'A place card tags a guest, a table sign tags the table',
        d: 'Hold it in frame. Those photos go straight to the people it names — no typing, no tagging marathon.',
      },
      {
        t: 'Posters and place cards you can print',
        d: 'The codes come ready to put on the tables.',
      },
      {
        t: 'Snippets, not just photographs',
        d: 'Ten seconds of sound and movement — the toast, the laugh, the entrance. A Snippet is the one thing a photograph cannot keep.',
      },
      {
        t: 'It works with no signal',
        d: 'Photos wait on the phone and send themselves when the venue’s signal comes back.',
      },
      {
        t: 'Start months early',
        d: 'Cameras can open well before the day, so the engagement shoot and the rehearsal are already in there.',
      },
    ],
  },
  {
    heading: 'Every face finds itself',
    items: [
      {
        t: 'Face tagging',
        d: 'A guest adds a selfie once and their photos find them. Nobody who skips it is ever matched.',
      },
      {
        t: 'Face blocking',
        d: 'Anyone can ask not to be shown. We blur the picture itself — a real blurred copy, not a filter — and if the blurring fails, the photo does not go up at all.',
      },
      {
        t: '“Not me”',
        d: 'One tap takes a photo out of your own gallery.',
      },
      {
        t: 'Nothing unscreened is ever shown',
        d: 'Every photo is checked before it can appear anywhere, and that cannot be switched off.',
      },
    ],
  },
  {
    heading: 'Things to play on the night',
    items: [
      {
        t: 'Photo challenges',
        d: 'Set the room little missions — a written library to choose from, or write your own.',
      },
      {
        t: 'Video greetings',
        d: 'Ask your guests to leave you a short message on camera instead of a signature in a book.',
      },
      {
        t: 'Challenges your suppliers suggest',
        d: 'Your photographer can propose one. Nothing appears until you approve it.',
      },
      {
        /* Owner, 2026-08-29: "it has an address where you can place to a
           monitor so it will show the live photo wall there via browser."
           Verified against the shipped route: /wall/[eventId] is a full-screen,
           no-chrome projection a venue screen reaches by opening the address
           and typing a six-character code. LIVE_WALL is in FREE_FOR_ALL_SKUS,
           so "included" is true for every celebration. */
        t: 'The live wall, on any screen at the venue',
        d: 'The wall has its own web address. Open it on whatever screen the venue has — a TV, a projector, a laptop — type the short code once, and the night plays there as it happens. No app, no cable, nothing to install. Included; there is nothing to buy.',
      },
    ],
  },
  {
    heading: 'What you keep',
    items: [
      {
        t: 'A gallery that reads in chapters',
        d: 'Grouped by how far from the day each photo was taken, so the run-up reads as the run-up.',
      },
      {
        t: 'A recap page',
        d: 'The celebration, gathered into one page you can send.',
      },
      {
        t: 'A keepsake magazine',
        d: 'Your photographs laid out as a printable magazine, with your guests’ words beside the picture each one is about. Free.',
      },
      {
        t: 'Life flash',
        d: 'The whole story, cut short and set to music.',
      },
      {
        t: 'A thank-you film',
        d: 'Made from the night and addressed to the people who came.',
        paid: true,
      },
      {
        t: 'A souvenir video for every guest',
        d: 'Each guest can turn their own photos into a short vertical video set to music, and keep it. Free.',
      },
      {
        t: 'A copy in your own Google Drive',
        d: 'Connect it and your originals land there too.',
      },
    ],
  },
  {
    heading: 'Your say over all of it',
    items: [
      {
        t: 'Five looks',
        d: 'Pick how the night is graded and every camera follows.',
      },
      {
        t: 'You moderate',
        d: 'Anything can be taken down, by you, at any time.',
      },
      {
        t: 'Decide who sees the shared gallery',
        d: 'Open it to your guests or keep it to yourselves.',
      },
      {
        t: 'Your suppliers’ photos, on your terms',
        d: 'What they hand over reaches you, and you say what happens to it.',
      },
      {
        t: 'Add your own',
        d: 'Your photographs and videos go into the same library as everyone else’s.',
      },
    ],
  },
];

export function PapicFeatures() {
  return (
    <section className="mx-auto mt-16 max-w-3xl" aria-label="What Papic does">
      <h2 className="font-serif text-2xl tracking-tight text-[var(--m-ink)] sm:text-3xl">
        Everything it does
      </h2>
      <p className="mt-2 text-sm text-[var(--m-ink)]/65">
        Credits are the only thing you ever pay for. All of this comes with them.
      </p>

      <div className="mt-8 space-y-9">
        {GROUPS.map((g) => (
          <div key={g.heading}>
            <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[var(--m-orange-2)]">
              {g.heading}
            </p>
            <dl className="mt-3 space-y-4 border-t border-[var(--m-line)] pt-4">
              {g.items.map((f) => (
                <div key={f.t}>
                  <dt className="flex flex-wrap items-baseline gap-x-2 text-[0.98rem] font-semibold text-[var(--m-ink)]">
                    {f.t}
                    {f.paid ? (
                      <span className="rounded-full border border-[var(--m-line)] px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.08em] text-[var(--m-ink)]/55">
                        Paid add-on
                      </span>
                    ) : null}
                  </dt>
                  <dd className="mt-1 text-sm text-[var(--m-ink)]/65">{f.d}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
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
      <p className="mt-2 text-sm text-[var(--m-ink)]/65">
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
