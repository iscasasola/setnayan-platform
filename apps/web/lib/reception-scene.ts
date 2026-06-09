/**
 * Reception scene — a stylized, palette-tinted SVG venue that updates as the
 * couple picks a treatment per part (owner directive 2026-06-09: "editing the
 * actual feel of the whole venue"). Pure + DOM-free so it renders identically
 * server-side, in the React designer, and in a rasterizer for visual testing.
 *
 * Composition: a gentle one-point view down the aisle — ceiling overhead,
 * entrance/tunnel arches over the aisle, the couple's stage + backdrop at the
 * far end, guest tables flanking. Treatments swap the shapes; the couple's
 * shared palette drives the colors.
 */

export type PartId = 'ceiling' | 'walls' | 'stage' | 'tables' | 'entrance';

export type Treatment = { id: string; label: string };

export const RECEPTION_PARTS: ReadonlyArray<{
  id: PartId;
  label: string;
  blurb: string;
  treatments: Treatment[];
}> = [
  {
    id: 'ceiling',
    label: 'Ceiling',
    blurb: 'What hangs overhead',
    treatments: [
      { id: 'chandeliers', label: 'Chandeliers' },
      { id: 'draped', label: 'Draped fabric' },
      { id: 'string_lights', label: 'String lights' },
      { id: 'florals', label: 'Floral cloud' },
    ],
  },
  {
    id: 'walls',
    label: 'Backdrop',
    blurb: 'Behind the couple',
    treatments: [
      { id: 'draped', label: 'Draped' },
      { id: 'floral', label: 'Floral wall' },
      { id: 'greenery', label: 'Greenery' },
      { id: 'marquee', label: 'Marquee lights' },
    ],
  },
  {
    id: 'stage',
    label: 'Stage',
    blurb: 'The couple’s spot',
    treatments: [
      { id: 'sweetheart', label: 'Sweetheart table' },
      { id: 'long_head', label: 'Long head table' },
      { id: 'arch', label: 'Arch + lounge' },
    ],
  },
  {
    id: 'tables',
    label: 'Tables',
    blurb: 'Where guests sit',
    treatments: [
      { id: 'round_tall', label: 'Round · tall florals' },
      { id: 'round_low', label: 'Round · low florals' },
      { id: 'long_banquet', label: 'Long banquet' },
    ],
  },
  {
    id: 'entrance',
    label: 'Entrance tunnel',
    blurb: 'The grand entrance',
    treatments: [
      { id: 'floral_arch', label: 'Floral arches' },
      { id: 'draped_arch', label: 'Draped arches' },
      { id: 'light_tunnel', label: 'Light tunnel' },
    ],
  },
];

export type ReceptionDesign = Partial<Record<PartId, string>>;

export const DEFAULT_DESIGN: Record<PartId, string> = {
  ceiling: 'chandeliers',
  walls: 'draped',
  stage: 'sweetheart',
  tables: 'round_tall',
  entrance: 'floral_arch',
};

// ---- palette ----
const DEFAULTS = ['#C9A059', '#8C6BA6', '#D98BA6', '#9CB29A', '#F3ECE0'];
const LINEN = '#FBF7F0';
const WALL = '#ECE6DD';
const FLOOR = '#E4D9CC';
const WARM_LIGHT = '#FCE4A6';
const LEAF = '#7F9A6E';
const INK = '#5b5048';

function clampHex(h: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(h) ? h : '#CCCCCC';
}
/** palette accessor with graceful defaults so the scene always renders. */
function paletteFn(palette: string[]) {
  const p = palette.filter((c) => /^#[0-9a-fA-F]{6}$/.test(c));
  return (i: number) => clampHex(p[i] ?? p[p.length - 1] ?? DEFAULTS[i] ?? DEFAULTS[0]!);
}
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r + amt)));
  g = Math.max(0, Math.min(255, Math.round(g + amt)));
  b = Math.max(0, Math.min(255, Math.round(b + amt)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// small helpers -------------------------------------------------------------
const flower = (cx: number, cy: number, r: number, fill: string, center = WARM_LIGHT) =>
  [0, 1, 2, 3, 4]
    .map((k) => {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
      return `<circle cx="${(cx + Math.cos(a) * r).toFixed(1)}" cy="${(cy + Math.sin(a) * r).toFixed(1)}" r="${r * 0.62}" fill="${fill}"/>`;
    })
    .join('') + `<circle cx="${cx}" cy="${cy}" r="${(r * 0.5).toFixed(1)}" fill="${center}"/>`;
const leaf = (cx: number, cy: number, r: number, rot: number) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${(r * 0.45).toFixed(1)}" fill="${LEAF}" transform="rotate(${rot} ${cx} ${cy})"/>`;
const bulb = (cx: number, cy: number, r = 3) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${WARM_LIGHT}" stroke="#E6C677" stroke-width="0.6"/>`;

// ---- per-part renderers ----------------------------------------------------
function ceiling(t: string, P: (i: number) => string): string {
  const fab = P(0);
  if (t === 'draped') {
    // swagged fabric across the top
    let s = '';
    for (let i = 0; i < 6; i++) {
      const x0 = 60 + i * 145,
        x1 = x0 + 145;
      s += `<path d="M ${x0} 8 Q ${(x0 + x1) / 2} 96 ${x1} 8 L ${x1} 0 L ${x0} 0 Z" fill="${fab}" opacity="0.92"/>`;
      s += `<path d="M ${x0} 8 Q ${(x0 + x1) / 2} 96 ${x1} 8" fill="none" stroke="${shade(fab, -25)}" stroke-width="1.5" opacity="0.5"/>`;
    }
    return s;
  }
  if (t === 'string_lights') {
    let s = '';
    for (let row = 0; row < 3; row++) {
      const y = 18 + row * 26;
      let d = `M 30 ${y - 8}`;
      const pts: [number, number][] = [];
      for (let i = 0; i <= 12; i++) {
        const x = 30 + (i * 900) / 12;
        const yy = y + (i % 2 === 0 ? 16 : 0);
        pts.push([x, yy]);
        d += ` Q ${x - 35} ${y + 18} ${x} ${yy}`;
      }
      s += `<path d="${d}" fill="none" stroke="${shade(WALL, -40)}" stroke-width="1"/>`;
      s += pts.map(([x, y]) => bulb(x, y)).join('');
    }
    return s;
  }
  if (t === 'florals') {
    let s = '';
    for (let i = 0; i < 7; i++) {
      const cx = 90 + i * 130,
        cy = 20 + (i % 2) * 26;
      s += `<line x1="${cx}" y1="0" x2="${cx}" y2="${cy}" stroke="${LEAF}" stroke-width="1.5"/>`;
      s += flower(cx, cy + 12, 14, P(2));
      s += leaf(cx - 12, cy + 10, 11, -30) + leaf(cx + 12, cy + 14, 11, 30);
    }
    return s;
  }
  // chandeliers (default)
  let s = '';
  for (const cx of [200, 480, 760]) {
    s += `<line x1="${cx}" y1="0" x2="${cx}" y2="34" stroke="${shade(WARM_LIGHT, -60)}" stroke-width="2"/>`;
    s += `<ellipse cx="${cx}" cy="44" rx="46" ry="12" fill="none" stroke="${WARM_LIGHT}" stroke-width="3"/>`;
    s += `<ellipse cx="${cx}" cy="62" rx="30" ry="9" fill="none" stroke="${WARM_LIGHT}" stroke-width="3"/>`;
    for (let k = -2; k <= 2; k++) {
      s += bulb(cx + k * 22, 44, 3.2);
      s += `<line x1="${cx + k * 22}" y1="44" x2="${cx + k * 18}" y2="74" stroke="${WARM_LIGHT}" stroke-width="1"/>`;
      s += bulb(cx + k * 18, 76, 2.6);
    }
    s += bulb(cx, 88, 3.5);
  }
  return s;
}

function backdrop(t: string, P: (i: number) => string): string {
  // panel behind the stage
  const x = 330,
    y = 150,
    w = 300,
    h = 210;
  const panel = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${shade(WALL, 6)}"/>`;
  if (t === 'floral') {
    let s = panel;
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 6; c++)
        s += flower(x + 28 + c * 49, y + 26 + r * 42, 13, P(2), P(0));
    return s;
  }
  if (t === 'greenery') {
    let s = panel + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${shade(LEAF, 60)}" opacity="0.35"/>`;
    for (let i = 0; i < 70; i++) {
      const cx = x + 14 + ((i * 53) % (w - 28));
      const cy = y + 14 + (((i * 31) % (h - 28)) | 0);
      s += leaf(cx, cy, 12, (i * 47) % 180);
    }
    return s;
  }
  if (t === 'marquee') {
    let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${shade(P(0), -50)}"/>`;
    // big initials arch of bulbs
    s += `<path d="M ${x + 40} ${y + 150} Q ${x + w / 2} ${y + 20} ${x + w - 40} ${y + 150}" fill="none" stroke="${shade(WARM_LIGHT, -40)}" stroke-width="2"/>`;
    for (let i = 0; i <= 18; i++) {
      const tt = i / 18;
      const px = x + 40 + tt * (w - 80);
      const py = y + 150 - Math.sin(tt * Math.PI) * 130;
      s += bulb(px, py, 4);
    }
    return s;
  }
  // draped (default) — vertical fabric folds
  let s = panel;
  const fab = P(0);
  for (let i = 0; i < 9; i++) {
    const fx = x + 8 + i * ((w - 16) / 9);
    s += `<rect x="${fx}" y="${y + 4}" width="${(w - 16) / 9 - 2}" height="${h - 8}" rx="6" fill="${i % 2 ? shade(fab, 14) : fab}"/>`;
  }
  s += `<path d="M ${x + 8} ${y + 30} Q ${x + w / 2} ${y + 70} ${x + w - 8} ${y + 30}" fill="none" stroke="${shade(fab, -30)}" stroke-width="3" opacity="0.6"/>`;
  return s;
}

function stage(t: string, P: (i: number) => string): string {
  const cx = 480;
  const platform = `<ellipse cx="${cx}" cy="392" rx="150" ry="26" fill="${shade(FLOOR, -14)}"/><rect x="${cx - 150}" y="372" width="300" height="22" fill="${shade(FLOOR, -8)}"/><ellipse cx="${cx}" cy="372" rx="150" ry="22" fill="${shade(FLOOR, 4)}"/>`;
  const chair = (x: number, y: number) =>
    `<rect x="${x - 7}" y="${y - 22}" width="14" height="26" rx="4" fill="${P(1)}"/><rect x="${x - 9}" y="${y}" width="18" height="8" rx="3" fill="${shade(P(1), -20)}"/>`;
  if (t === 'long_head') {
    let s = platform;
    s += `<rect x="${cx - 110}" y="338" width="220" height="34" rx="5" fill="${LINEN}"/>`;
    s += `<rect x="${cx - 110}" y="360" width="220" height="14" fill="${P(0)}"/>`;
    for (let k = -3; k <= 3; k++) s += chair(cx + k * 30, 340);
    s += flower(cx - 70, 332, 9, P(2)) + flower(cx, 330, 10, P(2)) + flower(cx + 70, 332, 9, P(2));
    return s;
  }
  if (t === 'arch') {
    let s = '';
    // arch behind a lounge sofa
    s += `<path d="M ${cx - 90} 372 Q ${cx - 90} 250 ${cx} 250 Q ${cx + 90} 250 ${cx + 90} 372" fill="none" stroke="${P(0)}" stroke-width="14"/>`;
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * (i / 10);
      s += flower(cx - Math.cos(a) * 90, 372 - Math.sin(a) * 122 - 0, 9, P(2));
    }
    s += platform;
    s += `<rect x="${cx - 70}" y="346" width="140" height="30" rx="10" fill="${P(1)}"/><rect x="${cx - 70}" y="336" width="140" height="16" rx="8" fill="${shade(P(1), 18)}"/>`;
    return s;
  }
  // sweetheart (default)
  let s = platform;
  s += chair(cx - 26, 348) + chair(cx + 26, 348);
  s += `<ellipse cx="${cx}" cy="356" rx="40" ry="16" fill="${LINEN}"/><path d="M ${cx - 40} 356 a 40 16 0 0 0 80 0 l 0 6 a 40 16 0 0 1 -80 0 Z" fill="${P(0)}"/>`;
  s += flower(cx, 342, 11, P(2));
  return s;
}

function tables(t: string, P: (i: number) => string): string {
  // two rows flanking the aisle, bigger in front (gentle perspective)
  const linenA = LINEN;
  const drawRound = (cx: number, cy: number, r: number, tall: boolean) => {
    let s = '';
    // chairs ringing the table (so it reads as dining, not a flower)
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
      const chx = cx + Math.cos(a) * r * 1.16;
      const chy = cy + Math.sin(a) * r * 0.55;
      s += `<ellipse cx="${chx.toFixed(1)}" cy="${chy.toFixed(1)}" rx="${(r * 0.22).toFixed(1)}" ry="${(r * 0.16).toFixed(1)}" fill="${shade(P(1), -10)}"/>`;
    }
    s += `<ellipse cx="${cx}" cy="${cy + r * 0.36}" rx="${r}" ry="${(r * 0.4).toFixed(1)}" fill="${shade(FLOOR, -26)}" opacity="0.16"/>`;
    s += `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${(r * 0.42).toFixed(1)}" fill="${linenA}" stroke="${shade(linenA, -16)}" stroke-width="1"/>`;
    s += `<ellipse cx="${cx}" cy="${cy}" rx="${(r * 0.62).toFixed(1)}" ry="${(r * 0.26).toFixed(1)}" fill="${P(1)}" opacity="0.5"/>`;
    if (tall) {
      s += `<line x1="${cx}" y1="${cy - 2}" x2="${cx}" y2="${(cy - r * 0.9).toFixed(1)}" stroke="${LEAF}" stroke-width="2"/>`;
      s += leaf(cx - r * 0.2, cy - r * 0.52, r * 0.26, -28) + leaf(cx + r * 0.2, cy - r * 0.48, r * 0.26, 28);
      s += flower(cx, cy - r * 0.95, r * 0.3, P(2));
    } else {
      s += flower(cx, cy - r * 0.05, r * 0.3, P(2));
    }
    return s;
  };
  const drawLong = (cx: number, cy: number, w: number) => {
    let s = `<rect x="${cx - w / 2}" y="${cy - 8}" width="${w}" height="20" rx="4" fill="${linenA}" stroke="${shade(linenA, -16)}" stroke-width="1"/>`;
    s += `<rect x="${cx - w / 2}" y="${cy - 2}" width="${w}" height="8" fill="${P(1)}" opacity="0.8"/>`;
    for (let i = 0; i < 3; i++) s += flower(cx - w / 2 + (w / 3) * (i + 0.5), cy + 2, 7, P(2));
    return s;
  };
  // positions: left & right rows at two depths
  const spots: [number, number, number][] = [
    [150, 520, 60],
    [810, 520, 60],
    [240, 432, 44],
    [720, 432, 44],
  ];
  let s = '';
  for (const [cx, cy, r] of spots) {
    if (t === 'long_banquet') s += drawLong(cx, cy, r * 2.2);
    else s += drawRound(cx, cy, r, t !== 'round_low');
  }
  return s;
}

function qpoint(
  p0: [number, number],
  c: [number, number],
  p2: [number, number],
  t: number,
): [number, number] {
  const u = 1 - t;
  return [
    u * u * p0[0] + 2 * u * t * c[0] + t * t * p2[0],
    u * u * p0[1] + 2 * u * t * c[1] + t * t * p2[1],
  ];
}

function entrance(t: string, P: (i: number) => string): string {
  // tunnel of arches over the aisle, receding toward the stage (smaller back)
  const cx = 480;
  const depths = [
    { top: 470, half: 178, y0: 636 },
    { top: 432, half: 124, y0: 588 },
    { top: 404, half: 86, y0: 548 },
  ];
  let s = '';
  depths.forEach((d, idx) => {
    const left = cx - d.half,
      right = cx + d.half;
    const springY = d.top + 70;
    const p0: [number, number] = [left, springY];
    const ctl: [number, number] = [cx, d.top - 36];
    const p2: [number, number] = [right, springY];
    const legL = `M ${left} ${d.y0} L ${left} ${springY}`;
    const legR = `M ${right} ${d.y0} L ${right} ${springY}`;
    const top = `M ${p0[0]} ${p0[1]} Q ${ctl[0]} ${ctl[1]} ${p2[0]} ${p2[1]}`;
    if (t === 'draped_arch') {
      const sw = 13 - idx * 3;
      const col = P(0);
      s += `<path d="${legL}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"/>`;
      s += `<path d="${legR}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"/>`;
      s += `<path d="${top}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"/>`;
      s += `<path d="M ${p0[0]} ${p0[1]} Q ${cx} ${d.top + 4} ${p2[0]} ${p2[1]}" fill="none" stroke="${shade(col, 20)}" stroke-width="${sw - 3}" opacity="0.85"/>`;
    } else if (t === 'light_tunnel') {
      const sw = 4.5 - idx;
      s += `<path d="${legL}" fill="none" stroke="${shade(WALL, -34)}" stroke-width="${sw}"/>`;
      s += `<path d="${legR}" fill="none" stroke="${shade(WALL, -34)}" stroke-width="${sw}"/>`;
      s += `<path d="${top}" fill="none" stroke="${shade(WALL, -34)}" stroke-width="${sw}"/>`;
      const n = 9 - idx * 2;
      for (let i = 0; i <= n; i++) {
        const [px, py] = qpoint(p0, ctl, p2, i / n);
        s += bulb(px, py, 4.2 - idx);
      }
      for (let j = 1; j <= 3; j++) {
        const yy = springY + ((d.y0 - springY) * j) / 4;
        s += bulb(left, yy, 4.2 - idx) + bulb(right, yy, 4.2 - idx);
      }
    } else {
      // floral arches (default)
      const col = LEAF;
      s += `<path d="${legL}" fill="none" stroke="${col}" stroke-width="${9 - idx * 2}" stroke-linecap="round"/>`;
      s += `<path d="${legR}" fill="none" stroke="${col}" stroke-width="${9 - idx * 2}" stroke-linecap="round"/>`;
      s += `<path d="${top}" fill="none" stroke="${col}" stroke-width="${9 - idx * 2}"/>`;
      const n = 8 - idx * 2;
      for (let i = 0; i <= n; i++) {
        const [px, py] = qpoint(p0, ctl, p2, i / n);
        s += flower(px, py, 11 - idx * 2, P(2));
      }
      s += flower(left, springY + 44, 9 - idx * 2, P(2)) + flower(right, springY + 44, 9 - idx * 2, P(2));
    }
  });
  return s;
}

/** Compose the full venue SVG for a given design + palette. */
export function renderVenueSvg(design: ReceptionDesign, palette: string[]): string {
  const P = paletteFn(palette);
  const sel = { ...DEFAULT_DESIGN, ...design };
  const W = 960,
    H = 640;
  const bg = `
    <defs>
      <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${shade(WALL, 10)}"/>
        <stop offset="1" stop-color="${WALL}"/>
      </linearGradient>
      <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${shade(FLOOR, 10)}"/>
        <stop offset="1" stop-color="${shade(FLOOR, -8)}"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#wall)"/>
    <rect y="372" width="${W}" height="${H - 372}" fill="url(#floor)"/>
    <polygon points="380,372 580,372 760,640 200,640" fill="${shade(P(1), 70)}" opacity="0.55"/>`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
    bg,
    backdrop(sel.walls, P),
    stage(sel.stage, P),
    ceiling(sel.ceiling, P),
    tables(sel.tables, P),
    entrance(sel.entrance, P),
    // subtle floor seam
    `<line x1="0" y1="372" x2="${W}" y2="372" stroke="${shade(WALL, -18)}" stroke-width="1" opacity="0.5"/>`,
    `</svg>`,
  ].join('');
}
