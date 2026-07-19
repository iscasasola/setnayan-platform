// Stories SEARCH — shared config. Server-safe by design: this holds the display
// gate constant that the SERVER page (/realstories) reads to decide whether to
// mount the faceted search. It must live OUTSIDE the 'use client' search module,
// because a value exported from a client module and imported into a Server
// Component arrives as a client-reference proxy, not the real number — the RSC
// value-export gotcha (see project_setnayan_rsc_client_data_export). Types can
// still be `import type`-d from the client module; only this VALUE moves here.

/**
 * The display gate. When the already-public featured+curated pool (editorials
 * on the page + featured chapters) is below this, /realstories keeps its shelf
 * layout and the place/service/kind search UI stays dark — a search box over a
 * dozen items reads as a dead platform (Simplicity Canon: don't build search
 * before there's something to find). Tunable — the owner may retune as the
 * library grows.
 */
export const STORIES_SEARCH_MIN_POOL = 50;
