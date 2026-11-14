/**
 * 🎟 THE REWARD TICKET'S PICTURE — a faithful port of `tkSvg` from the owner-approved prototype
 * `Setnayan/prototypes/supplier_badges_2026-11-15/badge-milestones_v35.html` (owner 15 Nov: *"we want a realistic
 * effect of that ticket as well"*): a printed voucher, not a flat sticker — grained paper, guilloche security print,
 * a metal foil frame in the tier's metal, a real torn-stub perforation with notches, embossed foil numerals, a
 * Setnayan watermark, a serial number, a holographic strip on the top plans, and a light sheen.
 *
 * PURE: a string of SVG per ticket kind, drawn once and cached as a data URI, so a row of 35 tickets costs six
 * drawings. No DOM, no server, safe in a server render.
 *
 * The KINDS are the reward ladder's (owner 15 Nov: Papic 150 · Papic 150 · Papic 1000 · Papic 3000 · Event Plus ·
 * Event Pro · Event Ultra). A caller may pass its own `TicketSpec` for a kind added later.
 */
import { SY_PATH } from '@/lib/photo-mark-geometry';

export type TicketRim = 'bronze' | 'silver' | 'gold' | 'plat';
export type TicketSpec = {
  /** Small word over the number ("PAPIC", "EVENT"). */
  w: string;
  /** The embossed number or plan ("150", "PRO"). */
  n: string;
  /** Word under the number ("CREDITS", "PLAN"). */
  s: string;
  /** Stub icon. */
  ic: 'cam' | 'heart';
  /** Face radial: highlight, body, shadow. */
  face: readonly [string, string, string];
  /** Foil frame metal. */
  rim: TicketRim;
  /** Holographic strip (the top plans). */
  holo?: boolean;
};

export const TICKET_SPECS = {
  papic150: { w: 'PAPIC', n: '150', s: 'CREDITS', ic: 'cam', face: ['#F7A08F', '#D63A55', '#5E0D24'], rim: 'bronze' },
  papic1000: { w: 'PAPIC', n: '1000', s: 'CREDITS', ic: 'cam', face: ['#F7A08F', '#C92F4E', '#55091F'], rim: 'silver' },
  papic3000: { w: 'PAPIC', n: '3000', s: 'CREDITS', ic: 'cam', face: ['#FFB39A', '#C42645', '#4A061A'], rim: 'gold' },
  eplus: { w: 'EVENT', n: 'PLUS', s: 'PLAN', ic: 'heart', face: ['#8FEBD6', '#17927B', '#063A32'], rim: 'silver' },
  epro: { w: 'EVENT', n: 'PRO', s: 'PLAN', ic: 'heart', face: ['#C9B6FF', '#5E38D0', '#1D0B52'], rim: 'gold', holo: true },
  eultra: { w: 'EVENT', n: 'ULTRA', s: 'PLAN', ic: 'heart', face: ['#5A4A7E', '#18121F', '#030204'], rim: 'plat', holo: true },
} as const satisfies Record<string, TicketSpec>;

export type TicketKind = keyof typeof TICKET_SPECS;

const TKRIM: Readonly<Record<TicketRim, readonly [string, string, string, string, string]>> = {
  bronze: ['#5A2E12', '#F2B98C', '#A65F2C', '#FFD9B5', '#7A3E16'],
  silver: ['#4B525A', '#FFFFFF', '#8F98A2', '#F4F7FA', '#59616A'],
  gold: ['#6E4606', '#FFF3B8', '#C8921A', '#FFE68A', '#7A4E08'],
  plat: ['#2A2E36', '#FFFFFF', '#9AA6BC', '#E8F0FF', '#3A4150'],
};

/** Drawn size (the viewBox is padded for the drop shadow). */
export const TICKET_W = 316;
export const TICKET_H = 170;

/** The ticket as an SVG string. `id` scopes the gradient ids (a data-URI image is its own document, but keep them unique anyway). */
export function ticketSvg(id: string, T: TicketSpec): string {
  const R = TKRIM[T.rim];
  const F = T.face;
  const u = 'tq' + id.replace(/[^a-zA-Z0-9]/g, '');
  const W = 300;
  const H = 150;
  const SX = 92;
  const body = `M14,2 H${SX - 9} A9,9 0 0 0 ${SX + 9},2 H${W - 14} A12,12 0 0 1 ${W - 2},14 V${H - 14} A12,12 0 0 1 ${W - 14},${H - 2} H${SX + 9} A9,9 0 0 0 ${SX - 9},${H - 2} H14 A12,12 0 0 1 2,${H - 14} V14 A12,12 0 0 1 14,2Z`;
  let gl = '';
  for (let r = 0; r < 26; r++) {
    let p = '';
    for (let a = 0; a <= 72; a++) {
      const t = (a / 72) * Math.PI * 2;
      const rr = 18 + r * 5.2 + 2.2 * Math.sin(t * 9 + r * 0.7);
      p += (a ? 'L' : 'M') + (196 + rr * Math.cos(t)).toFixed(1) + ',' + (75 + rr * 0.62 * Math.sin(t)).toFixed(1);
    }
    gl += `<path d="${p}Z"/>`;
  }
  let wv = '';
  for (let r = 0; r < 9; r++) {
    let p = '';
    for (let x = 4; x <= SX - 6; x += 3) p += (x > 4 ? 'L' : 'M') + x + ',' + (10 + r * 16 + 3 * Math.sin(x / 6 + r)).toFixed(1);
    wv += `<path d="${p}"/>`;
  }
  let holes = '';
  for (let y = 16; y <= H - 16; y += 7.2) holes += `<circle cx="${SX}" cy="${y.toFixed(1)}" r="1.7" fill="#000"/>`;
  const ic =
    T.ic === 'cam'
      ? `<path d="M-11,-7 H11 A4,4 0 0 1 15,-3 V9 A4,4 0 0 1 11,13 H-11 A4,4 0 0 1 -15,9 V-3 A4,4 0 0 1 -11,-7Z M-6,-7 L-4,-11.5 H4 L6,-7" fill="none" stroke-width="2.6" stroke-linejoin="round"/><circle cx="0" cy="3" r="5.6" fill="none" stroke-width="2.6"/><circle cx="10" cy="-2.5" r="1.6" stroke="none"/>`
      : `<path d="M0,12 C-16,1 -14,-12.5 -6,-12 C-2.6,-11.8 0,-9 0,-6.2 C0,-9 2.6,-11.8 6,-12 C14,-12.5 16,1 0,12Z" stroke="none"/>`;
  const big = T.n.length > 4 ? 30 : T.n.length > 3 ? 36 : 42;
  const sx = (W - 12) / W;
  const sy = (H - 12) / H;
  const inset = `translate(${W / 2} ${H / 2}) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(${-W / 2} ${-H / 2})`;
  const mid = (SX + W - (T.holo ? 40 : 0)) / 2;
  const serial = `Nº ${id.toUpperCase().slice(0, 3)}-0${T.n.length}7${T.n.charCodeAt(0) % 10}4`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -6 ${W + 16} ${H + 20}" width="${W + 16}" height="${H + 20}"><defs>
<linearGradient id="${u}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${R[0]}"/><stop offset=".18" stop-color="${R[1]}"/><stop offset=".38" stop-color="${R[2]}"/><stop offset=".55" stop-color="${R[3]}"/><stop offset=".78" stop-color="${R[2]}"/><stop offset="1" stop-color="${R[4]}"/></linearGradient>
<radialGradient id="${u}f" cx=".3" cy=".1" r="1.15"><stop offset="0" stop-color="${F[0]}"/><stop offset=".26" stop-color="${F[1]}"/><stop offset=".62" stop-color="${F[1]}"/><stop offset="1" stop-color="${F[2]}"/></radialGradient>
<linearGradient id="${u}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${R[3]}"/><stop offset=".45" stop-color="${R[1]}"/><stop offset=".55" stop-color="${R[2]}"/><stop offset="1" stop-color="${R[3]}"/></linearGradient>
<linearGradient id="${u}h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7ad9"/><stop offset=".2" stop-color="#ffe27a"/><stop offset=".4" stop-color="#7affc4"/><stop offset=".6" stop-color="#7ab8ff"/><stop offset=".8" stop-color="#c77aff"/><stop offset="1" stop-color="#ff7ad9"/></linearGradient>
<linearGradient id="${u}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="${u}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".42" stop-color="#fff" stop-opacity=".04"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>
<filter id="${u}n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
<filter id="${u}d" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#000" flood-opacity=".38"/></filter>
<filter id="${u}e"><feDropShadow dx="0" dy="1.2" stdDeviation=".4" flood-color="#000" flood-opacity=".55"/><feDropShadow dx="0" dy="-.6" stdDeviation=".2" flood-color="#fff" flood-opacity=".35"/></filter>
<mask id="${u}m"><path d="${body}" fill="#fff"/>${holes}</mask>
<clipPath id="${u}c"><path d="${body}"/></clipPath></defs>
<g filter="url(#${u}d)"><g mask="url(#${u}m)">
<path d="${body}" fill="url(#${u}r)"/>
<path d="${body}" fill="url(#${u}f)" transform="${inset}"/>
<g clip-path="url(#${u}c)">
<rect x="0" y="0" width="${SX}" height="${H}" fill="#000" opacity=".2"/>
<g fill="none" stroke="#fff" stroke-opacity=".13" stroke-width=".7">${gl}</g>
<g fill="none" stroke="#fff" stroke-opacity=".12" stroke-width=".7">${wv}</g>
<path fill="#fff" opacity=".07" transform="translate(${W - 112} ${H - 104}) scale(.03 -.03) translate(0 -4000)" d="${SY_PATH}"/>
${T.holo ? `<rect x="${W - 38}" y="0" width="16" height="${H}" fill="url(#${u}h)" opacity=".75"/><rect x="${W - 38}" y="0" width="16" height="${H}" fill="url(#${u}g)"/>` : ''}
<rect x="0" y="0" width="${W}" height="${H}" filter="url(#${u}n)" opacity=".22"/>
<rect x="0" y="0" width="${W}" height="${H}" fill="url(#${u}g)"/>
<rect x="-60" y="-20" width="40" height="${H + 40}" fill="url(#${u}s)" transform="rotate(18)"/>
</g>
<path d="${body}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1.2" transform="${inset}"/>
<path d="${body}" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width=".8"/>
</g></g>
<g transform="translate(${SX / 2} ${H / 2 - 12})" fill="url(#${u}t)" stroke="url(#${u}t)" filter="url(#${u}e)">${ic}</g>
<text x="${SX / 2}" y="${H / 2 + 22}" text-anchor="middle" fill="url(#${u}t)" filter="url(#${u}e)" style="font:800 8px system-ui,sans-serif;letter-spacing:1.6px">REWARD</text>
<text x="${SX / 2}" y="${H - 16}" text-anchor="middle" fill="#fff" fill-opacity=".55" style="font:600 6.5px ui-monospace,Menlo,monospace;letter-spacing:.8px">${serial}</text>
<text x="${mid}" y="34" text-anchor="middle" fill="#fff" fill-opacity=".92" filter="url(#${u}e)" style="font:800 10px system-ui,sans-serif;letter-spacing:3px">SETNAYAN · ${T.w}</text>
<text x="${mid}" y="${78 + big * 0.36}" text-anchor="middle" fill="url(#${u}t)" stroke="${F[2]}" stroke-width="3" paint-order="stroke" stroke-linejoin="round" filter="url(#${u}e)" style="font:900 ${big}px Georgia,'Times New Roman',serif;letter-spacing:-.5px">${T.n}</text>
<text x="${mid}" y="${H - 22}" text-anchor="middle" fill="#fff" fill-opacity=".85" style="font:800 9px system-ui,sans-serif;letter-spacing:3px">${T.s}</text>
</svg>`;
}

const URI_CACHE = new Map<string, string>();

/** The ticket as an `<img src>` — drawn once per kind (the prototype's blob-URL cache, as a data URI so a server render can draw it too). */
export function ticketDataUri(id: string, spec: TicketSpec): string {
  const key = id + '|' + JSON.stringify(spec);
  let uri = URI_CACHE.get(key);
  if (!uri) {
    uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ticketSvg(id, spec));
    URI_CACHE.set(key, uri);
  }
  return uri;
}
