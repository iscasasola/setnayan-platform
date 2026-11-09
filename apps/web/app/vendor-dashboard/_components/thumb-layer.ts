/**
 * 🥞 THE LAYER A THUMB ROW FLOATS IN — set by a full-screen pop-up that draws supplier pages inside itself.
 *
 * `SupplierThumbRow` portals to `<body>` at `--sn-z-thumb` (25) so `position: fixed` is never trapped by a transformed
 * ancestor. Under a pop-up that is a layer of its own — the picked client (`picked-client-shell.tsx`, `--sn-z-pop`,
 * 40) — that put the row UNDER the screen it belongs to: Picked client › Schedule's "My times" and "+ My moment" drew
 * behind the client and could not be tapped (release check, 8 Nov 2026), and Payment · Report · Forms · Hub carry the
 * same row.
 *
 * Such a pop-up provides this context with a host element INSIDE its own layer (outside its animated page body), and
 * the row portals there instead of `<body>`: still `position: fixed` at the foot, now painted over the pop-up's page
 * and under anything that pops over the pop-up (a Sheet, a menu). `column` is the element whose left/right edges the
 * row spans from 701 px. `host: null` means "inside the layer, host not mounted yet" — the row waits rather than
 * landing on `<body>` under the pop-up for a frame.
 *
 * 🔒 app/vendor-dashboard/clients/[eventId]/the-thumb-row-floats-over-the-picked-client.test.ts
 */
import { createContext } from 'react';

export type ThumbLayer = { host: HTMLElement | null; column: HTMLElement | null };

export const ThumbLayerContext = createContext<ThumbLayer | null>(null);
