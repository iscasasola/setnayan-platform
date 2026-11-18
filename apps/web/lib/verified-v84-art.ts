/**
 * ✅ THE APPROVED SETNAYAN VERIFIED — the plain blue circle with the check, copied VERBATIM from the owner-approved
 * prototype `prototypes/supplier_badges_2026-11-15/badge-milestones_v84.html` ("Setnayan Verified": *"Just the blue
 * circle with the check … no rosette, no laurels, no crown, no ribbon, no plaque. At 40 px and smaller the word
 * VERIFIED is dropped and the check alone remains"*). Never redrawn: only the gradient ids are made unique per drawing
 * (two on one page must not share `#b147_f`), the prototype's two empty <text> nodes and its screen-only light sweep
 * are left out.
 *
 *   `word: true`   the large look, with VERIFIED under the check (screens, above 40 px);
 *   `word: false`  the small look, the check alone — also EVERY PRINT's, since a print file carries no web font and
 *                  this look has no letters to outline (owner 17 Nov: *"Prints did not use Setnayan Verified badge"*).
 *
 * The art's own box is the prototype's `viewBox="12.5 12.5 75 75"`. PURE — strings only.
 * 🔒 lib/verified-v84-art.test.ts
 */

/** The prototype's view box: the circle sits centred in it. */
export const VERIFIED_V84_VIEWBOX = '12.5 12.5 75 75';
export const VERIFIED_V84_ORIGIN = 12.5;
export const VERIFIED_V84_SIDE = 75;

/** Marks every drawing of it, so a guard can tell the approved art from a hand-drawn tick. */
export const VERIFIED_V84_MARK = 'data-verified-v84';

function safeUid(uid: string): string {
  return uid.replace(/[^A-Za-z0-9_-]/g, '') || 'vr';
}

/** The art's inner markup (no <svg> wrapper), its ids prefixed with `uid`. */
export function verifiedV84Body(uid: string, word: boolean): string {
  const u = safeUid(uid);
  return word
    ? `<defs><linearGradient id="${u}_m" x1="0" y1="0" x2="1" y2="1"><stop offset="0.00" stop-color="#EAF3FA"/><stop offset="0.20" stop-color="#FFFFFF"/><stop offset="0.40" stop-color="#9FB4C6"/><stop offset="0.60" stop-color="#EAF3FA"/><stop offset="0.80" stop-color="#9FB4C6"/><stop offset="1.00" stop-color="#3A4854"/></linearGradient><linearGradient id="${u}_ink" x1="0" y1="0" x2="0" y2="1"><stop offset="0.00" stop-color="#FFFFFF"/><stop offset="0.50" stop-color="#FFFFFF"/><stop offset="1.00" stop-color="#D5E6F5"/></linearGradient><linearGradient id="${u}_tail" x1="0" y1="0" x2="0" y2="1"><stop offset="0.00" stop-color="#5C9BFF"/><stop offset="0.50" stop-color="#1F4CBA"/><stop offset="1.00" stop-color="#0B1D5A"/></linearGradient><linearGradient id="${u}_bv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset=".42" stop-color="#fff" stop-opacity=".1"/><stop offset=".6" stop-color="#000" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".62"/></linearGradient>
<radialGradient id="${u}_f" cx=".4" cy=".24" r=".95"><stop offset="0.00" stop-color="#5C9BFF"/><stop offset="0.50" stop-color="#1F4CBA"/><stop offset="1.00" stop-color="#0B1D5A"/></radialGradient>
<linearGradient id="${u}_gl" x1="0" y1="0" x2="0" y2="1"><stop offset=".5" stop-color="#fff" stop-opacity="0.42"/><stop offset="1" stop-color="#fff" stop-opacity="0.12"/></linearGradient>
<radialGradient id="${u}_sp"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<clipPath id="${u}_c"><path d="M50,4 A6.4,6.4 0 0 1 61.9,5.6 A6.4,6.4 0 0 1 73,10.2 A6.4,6.4 0 0 1 82.5,17.5 A6.4,6.4 0 0 1 89.8,27 A6.4,6.4 0 0 1 94.4,38.1 A6.4,6.4 0 0 1 96,50 A6.4,6.4 0 0 1 94.4,61.9 A6.4,6.4 0 0 1 89.8,73 A6.4,6.4 0 0 1 82.5,82.5 A6.4,6.4 0 0 1 73,89.8 A6.4,6.4 0 0 1 61.9,94.4 A6.4,6.4 0 0 1 50,96 A6.4,6.4 0 0 1 38.1,94.4 A6.4,6.4 0 0 1 27,89.8 A6.4,6.4 0 0 1 17.5,82.5 A6.4,6.4 0 0 1 10.2,73 A6.4,6.4 0 0 1 5.6,61.9 A6.4,6.4 0 0 1 4,50 A6.4,6.4 0 0 1 5.6,38.1 A6.4,6.4 0 0 1 10.2,27 A6.4,6.4 0 0 1 17.5,17.5 A6.4,6.4 0 0 1 27,10.2 A6.4,6.4 0 0 1 38.1,5.6 A6.4,6.4 0 0 1 50,4Z"/></clipPath><clipPath id="${u}_fc"><path d="M16,50 A34,34 0 1 1 84,50 A34,34 0 1 1 16,50Z"/></clipPath><linearGradient id="${u}_cm" x1="0" y1="0" x2="1" y2="1"><stop offset="0.00" stop-color="#FFE27A"/><stop offset="0.20" stop-color="#FFF3B8"/><stop offset="0.40" stop-color="#D9A21E"/><stop offset="0.60" stop-color="#FFE27A"/><stop offset="0.80" stop-color="#D9A21E"/><stop offset="1.00" stop-color="#7A4E08"/></linearGradient></defs><path d="M16,50 A34,34 0 1 1 84,50 A34,34 0 1 1 16,50Z" fill="none" stroke="#FFFFFF" stroke-opacity=".6" stroke-width="4.6" stroke-linejoin="round"/><path d="M16,50 A34,34 0 1 1 84,50 A34,34 0 1 1 16,50Z" fill="#141D26" stroke="#141D26" stroke-width="3" stroke-linejoin="round"/><path d="M16,50 A34,34 0 1 1 84,50 A34,34 0 1 1 16,50Z" fill="url(#${u}_f)"/><g clip-path="url(#${u}_fc)"><path d="M16,50 A34,34 0 1 1 84,50 A34,34 0 1 1 16,50Z" fill="none" stroke="#000" stroke-opacity=".34" stroke-width="5" transform="translate(0 1.4)"/><ellipse cx="50" cy="20.1" rx="47.6" ry="28.6" fill="url(#${u}_gl)"/></g><text x="50" y="66.8" text-anchor="middle" fill="#FFFFFF" stroke="#07153F" stroke-width="1.4" stroke-linejoin="round" paint-order="stroke" style="font-family:var(--font-body);font-weight:800;font-size:5.5px;letter-spacing:.8px">VERIFIED</text><path d="M35.5,45.5 L46,56 L65.5,34.5" transform="translate(0 1.9)" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke="#000" stroke-opacity=".42" stroke-width="11.5"/><path d="M35.5,45.5 L46,56 L65.5,34.5" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke="#07153F" stroke-width="11.5"/><path d="M35.5,45.5 L46,56 L65.5,34.5" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke="url(#${u}_ink)" stroke-width="7.2"/><path d="M38,44.8 L45.6,52.4 M48.4,52.6 L63.2,36.2" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke="#fff" stroke-opacity=".75" stroke-width="1.3"/>`
    : `<defs><linearGradient id="${u}_m" x1="0" y1="0" x2="1" y2="1"><stop offset="0.00" stop-color="#EAF3FA"/><stop offset="0.20" stop-color="#FFFFFF"/><stop offset="0.40" stop-color="#9FB4C6"/><stop offset="0.60" stop-color="#EAF3FA"/><stop offset="0.80" stop-color="#9FB4C6"/><stop offset="1.00" stop-color="#3A4854"/></linearGradient><linearGradient id="${u}_ink" x1="0" y1="0" x2="0" y2="1"><stop offset="0.00" stop-color="#FFFFFF"/><stop offset="0.50" stop-color="#FFFFFF"/><stop offset="1.00" stop-color="#D5E6F5"/></linearGradient><linearGradient id="${u}_tail" x1="0" y1="0" x2="0" y2="1"><stop offset="0.00" stop-color="#5C9BFF"/><stop offset="0.50" stop-color="#1F4CBA"/><stop offset="1.00" stop-color="#0B1D5A"/></linearGradient><linearGradient id="${u}_bv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset=".42" stop-color="#fff" stop-opacity=".1"/><stop offset=".6" stop-color="#000" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".62"/></linearGradient>
<radialGradient id="${u}_f" cx=".4" cy=".24" r=".95"><stop offset="0.00" stop-color="#5C9BFF"/><stop offset="0.50" stop-color="#1F4CBA"/><stop offset="1.00" stop-color="#0B1D5A"/></radialGradient>
<linearGradient id="${u}_gl" x1="0" y1="0" x2="0" y2="1"><stop offset=".5" stop-color="#fff" stop-opacity="0.42"/><stop offset="1" stop-color="#fff" stop-opacity="0.12"/></linearGradient>
<radialGradient id="${u}_sp"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<clipPath id="${u}_c"><path d="M50,4 A6.4,6.4 0 0 1 61.9,5.6 A6.4,6.4 0 0 1 73,10.2 A6.4,6.4 0 0 1 82.5,17.5 A6.4,6.4 0 0 1 89.8,27 A6.4,6.4 0 0 1 94.4,38.1 A6.4,6.4 0 0 1 96,50 A6.4,6.4 0 0 1 94.4,61.9 A6.4,6.4 0 0 1 89.8,73 A6.4,6.4 0 0 1 82.5,82.5 A6.4,6.4 0 0 1 73,89.8 A6.4,6.4 0 0 1 61.9,94.4 A6.4,6.4 0 0 1 50,96 A6.4,6.4 0 0 1 38.1,94.4 A6.4,6.4 0 0 1 27,89.8 A6.4,6.4 0 0 1 17.5,82.5 A6.4,6.4 0 0 1 10.2,73 A6.4,6.4 0 0 1 5.6,61.9 A6.4,6.4 0 0 1 4,50 A6.4,6.4 0 0 1 5.6,38.1 A6.4,6.4 0 0 1 10.2,27 A6.4,6.4 0 0 1 17.5,17.5 A6.4,6.4 0 0 1 27,10.2 A6.4,6.4 0 0 1 38.1,5.6 A6.4,6.4 0 0 1 50,4Z"/></clipPath><clipPath id="${u}_fc"><path d="M16,50 A34,34 0 1 1 84,50 A34,34 0 1 1 16,50Z"/></clipPath><linearGradient id="${u}_cm" x1="0" y1="0" x2="1" y2="1"><stop offset="0.00" stop-color="#FFE27A"/><stop offset="0.20" stop-color="#FFF3B8"/><stop offset="0.40" stop-color="#D9A21E"/><stop offset="0.60" stop-color="#FFE27A"/><stop offset="0.80" stop-color="#D9A21E"/><stop offset="1.00" stop-color="#7A4E08"/></linearGradient></defs><path d="M16,50 A34,34 0 1 1 84,50 A34,34 0 1 1 16,50Z" fill="none" stroke="#FFFFFF" stroke-opacity=".6" stroke-width="4.6" stroke-linejoin="round"/><path d="M16,50 A34,34 0 1 1 84,50 A34,34 0 1 1 16,50Z" fill="#141D26" stroke="#141D26" stroke-width="3" stroke-linejoin="round"/><path d="M16,50 A34,34 0 1 1 84,50 A34,34 0 1 1 16,50Z" fill="url(#${u}_f)"/><g clip-path="url(#${u}_fc)"><path d="M16,50 A34,34 0 1 1 84,50 A34,34 0 1 1 16,50Z" fill="none" stroke="#000" stroke-opacity=".34" stroke-width="5" transform="translate(0 1.4)"/><ellipse cx="50" cy="20.1" rx="47.6" ry="28.6" fill="url(#${u}_gl)"/></g><g transform="translate(0 4.75)"><path d="M35.5,45.5 L46,56 L65.5,34.5" transform="translate(0 1.9)" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke="#000" stroke-opacity=".42" stroke-width="11.5"/></g><g transform="translate(0 4.75)"><path d="M35.5,45.5 L46,56 L65.5,34.5" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke="#07153F" stroke-width="11.5"/></g><g transform="translate(0 4.75)"><path d="M35.5,45.5 L46,56 L65.5,34.5" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke="url(#${u}_ink)" stroke-width="7.2"/></g><g transform="translate(0 4.75)"><path d="M38,44.8 L45.6,52.4 M48.4,52.6 L63.2,36.2" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke="#fff" stroke-opacity=".75" stroke-width="1.3"/></g>`;
}

/** The art as one <svg> element, `size` px square (screens: `word` above 40 px, as the prototype does). */
export function verifiedV84Svg({ uid, size, word = size > 40, label }: { uid: string; size: number; word?: boolean; label?: string }): string {
  const a11y = label ? `role="img" aria-label="${label.replace(/[<>&"]/g, '')}"` : 'aria-hidden="true"';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VERIFIED_V84_VIEWBOX}" width="${size}" height="${size}" ${a11y} ${VERIFIED_V84_MARK}="">${verifiedV84Body(uid, word)}</svg>`;
}

/**
 * The art placed in a print: a <g> drawing the small look (no letters) as a `box`-wide square centred on (cx, cy) —
 * the same call shape as `setnayanMarkSvg`, so it drops into the pieces where the Verified mark goes.
 */
export function verifiedV84PrintG(cx: number, cy: number, box: number, uid: string): string {
  const k = box / VERIFIED_V84_SIDE;
  const x = cx - box / 2 - VERIFIED_V84_ORIGIN * k;
  const y = cy - box / 2 - VERIFIED_V84_ORIGIN * k;
  const r = (v: number) => Number(v.toFixed(3));
  return `<g ${VERIFIED_V84_MARK}="" transform="translate(${r(x)} ${r(y)}) scale(${k.toFixed(6)})">${verifiedV84Body(uid, false)}</g>`;
}

type FlatOp = { t: 'path'; d: string; fill?: string; stroke?: string; sw?: number };

/** A round dot as a path (two arcs) — kept off the `circle` op, which a sheet's layout counts as one pill each. */
function dot(cx: number, cy: number, rad: number): string {
  const r = (v: number) => Number(v.toFixed(3));
  return `M${r(cx - rad)},${r(cy)} A${r(rad)},${r(rad)} 0 1 0 ${r(cx + rad)},${r(cy)} A${r(rad)},${r(rad)} 0 1 0 ${r(cx - rad)},${r(cy)} Z`;
}

/**
 * The same art for a PDF backend (the door sticker's print ops), which draws flat inks only: each part of the v84
 * drawing in its own principal colour — the dark ring #141D26, the disc's middle stop #1F4CBA, the check's navy edge
 * #07153F under its white ink — the same flattening the pills' foil gets there. The check's round caps and joins are
 * drawn as dots, since the backend's strokes end square. Same geometry as the vector, `box`-wide, centred on (cx, cy).
 */
export function verifiedV84Ops(cx: number, cy: number, box: number): FlatOp[] {
  const k = box / VERIFIED_V84_SIDE;
  const X = (v: number) => cx + (v - 50) * k;
  const Y = (v: number) => cy + (v - 50 + 4.75) * k;
  const r = (v: number) => Number(v.toFixed(3));
  const pts: Array<[number, number]> = [
    [35.5, 45.5],
    [46, 56],
    [65.5, 34.5],
  ];
  const d = `M${pts.map(([a, b]) => `${r(X(a))},${r(Y(b))}`).join(' L')}`;
  const check = (sw: number, ink: string): FlatOp[] => [
    { t: 'path', d, stroke: ink, sw: sw * k },
    ...pts.map(([a, b]): FlatOp => ({ t: 'path', d: dot(X(a), Y(b), (sw * k) / 2), fill: ink })),
  ];
  return [
    { t: 'path', d: dot(cx, cy, 35.5 * k), fill: '#141D26' },
    { t: 'path', d: dot(cx, cy, 34 * k), fill: '#1F4CBA' },
    ...check(11.5, '#07153F'),
    ...check(7.2, '#FFFFFF'),
  ];
}
