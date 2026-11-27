/**
 * ⌨ A LEAFLET MAP IS ONE TAB STOP (27 Nov 2026, MASTER-PLAN A2 — "map Zoom +/−/© add 6 stops per venue").
 *
 * Leaflet draws its corner controls as links — Zoom in, Zoom out, the "Leaflet" prefix and every credit link — and
 * each is a Tab stop, so a keyboard walking a form stops five or six times on one map. The map's own box is already
 * the keyboard's way in (Leaflet's `keyboard` option, on by default: the arrows pan, + / − zoom), so the corner
 * links leave the Tab order. A pointer presses them as before, and the credit stays on screen (OSM's licence).
 *
 * Call it once the tile layer (and its credit) is on the map.
 */
export const MAP_CORNER_CONTROLS = '.leaflet-control a, .leaflet-control button';

export function mapControlsLeaveTabOrder(container: ParentNode | null | undefined): void {
  if (!container) return;
  container.querySelectorAll<HTMLElement>(MAP_CORNER_CONTROLS).forEach((el) => {
    el.tabIndex = -1;
  });
}
