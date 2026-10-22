/**
 * 🏷 The free print's brand line — its words and its ink — in ONE tiny home (owner 2026-10-21, "i want the prints
 * branded with setnayan"), so the PDF layout (`lib/print-layout.ts`, which re-exports both) and the browser-print HTML
 * pages (`lib/print-html-brand.ts`) can never say or colour it differently, and a dashboard page can carry the line
 * without pulling the whole print layout into its bundle.
 */
export const PRINT_BRAND_WORDS = 'Made with Setnayan · setnayan.com';
/** The free line's ink — the plain print's neutral grey (5.3 : 1 on white). */
export const PRINT_BRAND_GREY = '#6b6b6b';
