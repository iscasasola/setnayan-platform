/**
 * ✏ THE LOGO MAKER ON A PHONE — the one layout (owner 2026-10-08, verbatim: *"when opening logo make on
 * studio, i get stuck with 1 layer and cannot access anything more … no more asking do you want a logo?
 * this is direct edit already"*; approved design `LOGO_MAKER_REPLOT_2026-10-08_fable.md`, PR L1).
 *
 * The cause it ends: the Logo's two panels were Maker TOOLS (`useMakerTool`) opened from tiles portalled
 * into the lower third's navigator (`ltNav`) — and that navigator goes `inert` whenever a tool is open. So
 * one panel open = the other's tile unreachable, and the editor opened with nothing picked ("Pick a layer").
 *
 * Now: the logo on top, then ONE row (Layers | the picked layer), then the open panel — all in the page's
 * own flow, under the logo, never `fixed` over the lower third, never registered as a tool, so nothing can
 * fold them away. The editor opens with the top layer picked. Guided flow (the shipped Maker's What's left):
 * its half sheet is the step, so the panels step aside there.
 *
 * Pure strings — no React — so the guard can read the contract without a DOM.
 */
/** The layers carousel over the panel, its margin included (74 px cards + 8 px margin) — L2. */
export const LOGO_PANEL_ROW_PX = 82;
/**
 * The open panel, under the logo on a phone (a desk keeps its side columns). The row and the panel
 * TOGETHER are the lower third's height (`--maker-lt-h`): Studio draws no lower third for the Logo
 * (`maker-shell.tsx`, `studioCovers`) and sets that height to `MAKER_LT_HALF`, so the Logo's tools take
 * exactly the room a Studio tool rests at — the logo keeps the rest.
 */
export const LOGO_PANEL_PHONE =
  'max-lg:order-last max-lg:h-[calc(var(--maker-lt-h)-82px)] max-lg:shrink-0 max-lg:min-h-0 max-lg:border-t max-lg:border-ink/10 max-lg:bg-cream max-lg:group-data-[details-mode=guided]/ws:hidden';

/** A card's half width — the pointer is "over" another card when within this of its middle (prototype `.card` 66 px). */
export const LOGO_CARD_HALF_PX = 33;
/**
 * Where a held card lands: the index of the OTHER card whose middle the pointer is over, else where it is.
 * `mids` are the cards' middles along the strip, in strip order.
 */
export function cardDropIndex(mids: readonly number[], from: number, pointer: number): number {
  const over = mids.findIndex((m, i) => i !== from && Math.abs(m - pointer) < LOGO_CARD_HALF_PX);
  return over < 0 ? from : over;
}
