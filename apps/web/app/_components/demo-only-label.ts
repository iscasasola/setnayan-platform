/**
 * The owner's words for every demo shop and demo event, verbatim — brackets included (DECISION_LOG 2026-11-06 "DEMO
 * SHOPS + DEMO EVENTS": *"… but has a marking of (DEMO ONLY)"*).
 *
 * A plain module with no React and no client import, so a surface that cannot render the marker component — the share
 * image (`app/api/og/v/[slug]/route.tsx`, satori), a page `<title>` — prints the same words. The chip itself is
 * `DemoOnlyMarker` in `./sample-marker.tsx`, which re-exports this. Never retype it; import it.
 */
export const DEMO_ONLY_LABEL = '(DEMO ONLY)';
