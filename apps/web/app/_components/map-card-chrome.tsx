/**
 * 🗺 THE MAP CARD'S OWN PARTS — the small "© OpenStreetMap" corner tag and the round "bigger map" button (map card +
 * Get directions, owner-approved 2026-11-14, `prototypes/map_card_open_in_maps_2026-11-14_fable.html`).
 *
 * One set for every map that draws OpenStreetMap tiles as pictures: the one-place map (`VendorLocationMap`), the
 * Event Hub's one map for every venue (`PinnedMap`, venue-styles.tsx) and the supplier's reach ring (`ReachMap` /
 * `ShopReachMap`). No zoom buttons and no sprawling credit bar: the credit stays (OSM's licence requires it) as a
 * small tag, and the map you can move is one press away on openstreetmap.org.
 *
 * 🎨 ON THE TILES, NOT ON THE PAGE. OSM's tiles are drawn light whatever the theme, so the tag and the button take the
 * tiles' own white (`bg-white/…` + `text-ink-on-light`) — a theme token would turn dark in dark mode and vanish
 * (the same reason as `ReachMap`'s `ON_TILES`). Server-safe markup: no hooks, no client code.
 */

/** The card's frame: 18 px corners, a hairline, the tiles' paper while they load. 9 : 5, never taller than 250 px. */
export const MAP_CARD_FRAME = 'relative w-full overflow-hidden border border-ink/15 bg-veil';

/**
 * "© OpenStreetMap" — a small tag in the bottom-right corner. The LINK around it is a 44 px corner, so a thumb that
 * reaches for the credit lands on it. `link={false}` (a sample page that must lead nowhere) draws the words alone.
 */
export function MapCredit({ link = true }: { link?: boolean }) {
  const tag = (
    <span className="rounded-full bg-white/85 px-2 py-1 font-sans text-[10.5px] font-medium leading-none text-ink-on-light">
      © OpenStreetMap
    </span>
  );
  if (!link) {
    return (
      <span data-map-credit="" className="absolute bottom-1.5 right-1.5">
        {tag}
      </span>
    );
  }
  return (
    <a
      href="https://www.openstreetmap.org/copyright"
      target="_blank"
      rel="noopener noreferrer"
      data-map-credit=""
      className="absolute bottom-0 right-0 flex min-h-[44px] min-w-[44px] items-end justify-end p-1.5"
    >
      {tag}
    </a>
  );
}

/** The round button, top-right, that opens the map you can move (openstreetmap.org, a new tab). */
export function BiggerMapButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open a bigger map"
      data-map-bigger=""
      className="absolute right-1.5 top-1.5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-ink-on-light shadow-sm transition-transform active:scale-95"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
      </svg>
    </a>
  );
}

/**
 * The place's pin — its point exactly on the spot (`left`/`top` in percent of the tile layer). The accent with the
 * tiles' white edge — the colour and shape `ReachMap` draws for a supplier's HQ.
 */
export function MapPinMark({ leftPct = 50, topPct = 50 }: { leftPct?: number; topPct?: number }) {
  return (
    <svg
      aria-hidden
      data-map-pin=""
      viewBox="0 0 22 30"
      className="absolute h-[30px] w-[22px] -translate-x-1/2 -translate-y-full drop-shadow"
      style={{ left: `${leftPct}%`, top: `${topPct}%` }}
    >
      <path
        d="M11 0C4.9 0 0 4.9 0 11c0 8.2 11 19 11 19s11-10.8 11-19C22 4.9 17.1 0 11 0z"
        style={{ fill: 'rgb(var(--sn-accent))' }}
        stroke="white"
        strokeWidth={1.5}
      />
      <circle cx={11} cy={11} r={4} fill="white" />
    </svg>
  );
}
