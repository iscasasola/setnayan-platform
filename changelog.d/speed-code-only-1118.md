## 2026-11-18 · perf(speed): Prints previews stop waiting in single file; the stylesheet drops test-only rules; the stale-tab check waits for the page

Owner target, 18 Nov 2026: every page under 0.7 s at 390 px. A code-only pass on what a walker measured on live c1f9e2f. Nothing looks or behaves differently: every refused read still says so, no skeleton shows a number, no server action added, no migration.

- **`/api/hub-print/[piece]` (a cold call took 5.2 s).**
  - The route no longer loads the PDF writer (pdf-lib), the JPEG rasteriser (sharp) or the three seating routes when the module loads. They arrive through `lib/print-drawers-on-demand.ts`: the same functions, imported the first time a file is drawn. Everything ◆ imports pdf-lib and the seating routes inside its own function. The Maker's previews are SVG and never touch them.
  - In `loadPrintSet`, the reads that need nothing from each other start together with `startAhead`: the event row beside the Pro check, then the print inputs, the logo, the plan mark, the saved QR look, the event words and the poster photo, all before the Hub picture is fetched. Each is still awaited on the line that always awaited it. Inside the Hub look, the theme and the hero row are read together.
  - The route reads the host's draft beside its three gate reads.
  - `printInputsVersion` (the previews' cache key) reads the plan mark beside its other reads.
- **Stylesheet.** Tailwind no longer scans `*.test.*` files. A class quoted only in a guard can never be on a shipped element, so this is neutral for every page. Measured with the Tailwind CLI: 650,417 → 642,976 B minified (−114 selectors, −1.0 KB gzipped). `globals.css` gets a source ceiling of 635,000 B (now 605,109 B).
- **Stale-tab check.** Its one check on mount (`/api/health`) waits for `load` plus an idle moment (`lib/when-page-settles.ts`, at most 3 s). It still runs once per load with the same answer.

Not changed, with the reason:
- **Entrance video (`/cale-ice`):** it is 640 KB and already streams from the start (moov before mdat). No smaller copy exists (owner 2026-06-22: uploads keep full resolution), and R2 is not behind an edge that could resize it.
- **Unread count in the browser:** it is the live channel's catch-up read after joining. Skipping it would miss messages that arrive in the join gap.
- **`/api/unwrap`:** already asked after Home has drawn.
- **Scripts per page:** not changed. A local build with chunk stats waited 30 min behind the shared heavy-job lock and was withdrawn, and a static import trace was not reliable enough to move code on (server-action files overcount).
- **Prints' hidden live-hub canvas iframe:** a proposal for the owner, not built (`PROPOSAL-prints-hidden-canvas-iframe-2026-11-18.md` in the controller's notes).

Guards: `lib/hub-print-loads-heavy-drawers-on-demand.test.ts` · `lib/the-stylesheet-stays-in-budget.test.ts` · `lib/when-page-settles.test.ts`. Text-pinned guards updated to the new shape with the same checks: `old-photo-copies`, `the-poster-takes-your-photo`, `the-qr-sheet-follows-the-draft`.

SPEC IMPACT: None.
