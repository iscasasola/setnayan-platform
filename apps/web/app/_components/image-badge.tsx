/**
 * 🏅 IMAGE BADGE — the badge PICTURES (owner v110: "Badges = Fable's IMAGE badges"), ported from the approved corpus art
 * `prototypes/for_suppliers_2026-11-06/index.html` ("ibgrid": the Setnayan Verified seal · In business since · the
 * Events hex · the First star · the monthly rosette). Four shapes, one set of materials; the rung a ladder reached
 * picks its material (Bronze → Black Diamond, the shipped tier names in `lib/badge-tiers.ts`).
 *
 * Inline SVG, no image file, no client code: a server component can draw it. Gradient ids are scoped by `uid` so two
 * badges on one page never borrow each other's paint. Grey (`on={false}`) = not yet.
 *
 * Drawn by Shop's one badge row and its sheet (`shop/_components/shop-badge-row.tsx`, `badge-sheet.tsx`).
 */
import type { BadgeFace, BadgeShape } from '@/lib/shop-badge-row';

type Paint = { face: [string, string]; ink: string; hl: string; rim: string; foilInk?: boolean };

const RIM: Readonly<Record<string, readonly string[]>> = {
  gold: ['#7A5C22', '#FBEFC4', '#B88D3B', '#EBD08A', '#7A5C22'],
  bronze: ['#4E2A10', '#E8B088', '#8C4F22', '#D08C5A', '#4E2A10'],
  silver: ['#4F555C', '#F7F9FB', '#8E959C', '#DCE0E4', '#4F555C'],
  plat: ['#35404A', '#F4F8FA', '#8A98A4', '#D8E0E6', '#35404A'],
  // Diamond has no corpus face — its rim is the shipped tier's own edge (`lib/badge-tiers.ts`, tier5).
  diamond: ['#6fa3c4', '#ffffff', '#a8d4ee', '#e8f6ff', '#6fa3c4'],
  ruby: ['#4E0A16', '#F7B9C3', '#A0203A', '#DC607A', '#4E0A16'],
  black: ['#8E949A', '#FFFFFF', '#5C6269', '#F0F2F4', '#8E949A'],
};

const PAINT: Readonly<Record<BadgeFace, Paint>> = {
  navy: { face: ['#335282', '#101C36'], ink: '#FBEFC4', hl: '#000000', rim: 'gold', foilInk: true },
  ivory: { face: ['#FFFEFA', '#ECE1CB'], ink: '#7F5F20', hl: '#FFFFFF', rim: 'gold' },
  gold: { face: ['#FFF9E4', '#E3BF68'], ink: '#5A400E', hl: '#FFFBEA', rim: 'gold' },
  first: { face: ['#FFFCF0', '#EDD08A'], ink: '#6B4D14', hl: '#FFFFFF', rim: 'gold' },
  month: { face: ['#AA2539', '#520A18'], ink: '#FBEFC4', hl: '#000000', rim: 'gold', foilInk: true },
  bronze: { face: ['#F9E8D8', '#D09A70'], ink: '#4A2810', hl: '#FFF3E6', rim: 'bronze' },
  silver: { face: ['#FBFCFD', '#C0C6CC'], ink: '#363C43', hl: '#FFFFFF', rim: 'silver' },
  plat: { face: ['#F5F8FB', '#B2C0CB'], ink: '#1F2A33', hl: '#FFFFFF', rim: 'plat' },
  diamond: { face: ['#F3F8FC', '#A8D4EE'], ink: '#1F4E6B', hl: '#FFFFFF', rim: 'diamond' },
  ruby: { face: ['#CF3552', '#560817'], ink: '#FFE6EA', hl: '#2A0309', rim: 'ruby' },
  black: { face: ['#3E4047', '#08080A'], ink: '#F4F6F8', hl: '#000000', rim: 'black' },
};

const SEAL =
  'M50,4 A6.4,6.4 0 0 1 61.9,5.6 A6.4,6.4 0 0 1 73,10.2 A6.4,6.4 0 0 1 82.5,17.5 A6.4,6.4 0 0 1 89.8,27 A6.4,6.4 0 0 1 94.4,38.1 A6.4,6.4 0 0 1 96,50 A6.4,6.4 0 0 1 94.4,61.9 A6.4,6.4 0 0 1 89.8,73 A6.4,6.4 0 0 1 82.5,82.5 A6.4,6.4 0 0 1 73,89.8 A6.4,6.4 0 0 1 61.9,94.4 A6.4,6.4 0 0 1 50,96 A6.4,6.4 0 0 1 38.1,94.4 A6.4,6.4 0 0 1 27,89.8 A6.4,6.4 0 0 1 17.5,82.5 A6.4,6.4 0 0 1 10.2,73 A6.4,6.4 0 0 1 5.6,61.9 A6.4,6.4 0 0 1 4,50 A6.4,6.4 0 0 1 5.6,38.1 A6.4,6.4 0 0 1 10.2,27 A6.4,6.4 0 0 1 17.5,17.5 A6.4,6.4 0 0 1 27,10.2 A6.4,6.4 0 0 1 38.1,5.6 A6.4,6.4 0 0 1 50,4Z';
const HEX_RIM = '100,50 75,93.3 25,93.3 0,50 25,6.7 75,6.7';
const HEX_FACE = '87.5,50 68.75,82.5 31.25,82.5 12.5,50 31.25,17.5 68.75,17.5';
const HEX_LINE = '84.5,50 67.25,79.9 32.75,79.9 15.5,50 32.75,20.1 67.25,20.1';
const STAR =
  '50,0 60.1,12.3 75,6.7 77.6,22.4 93.3,25 87.7,39.9 100,50 87.7,60.1 93.3,75 77.6,77.6 75,93.3 60.1,87.7 50,100 39.9,87.7 25,93.3 22.4,77.6 6.7,75 12.3,60.1 0,50 12.3,39.9 6.7,25 22.4,22.4 25,6.7 39.9,12.3';

/** The rosette's scalloped edge — 48 points round a circle, as the corpus draws it. */
function rosetteEdge(): string {
  const pts: string[] = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 50 : 45.6;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}
const ROSETTE = rosetteEdge();

export function ImageBadge({
  shape,
  face,
  num,
  mini,
  on = true,
  uid,
  size = 64,
  label,
}: {
  shape: BadgeShape;
  face: BadgeFace;
  num: string;
  mini: string;
  /** Coloured; false = grey ("not yet"). */
  on?: boolean;
  /** Scopes the gradient ids — unique per badge drawn on the page. */
  uid: string;
  size?: number;
  /** The badge in words, for a screen reader. Absent = decorative (the caption beside it says it). */
  label?: string;
}) {
  const p = PAINT[face];
  const id = (n: string) => `ib-${uid.replace(/[^a-zA-Z0-9_-]/g, '_')}-${n}`;
  const url = (n: string) => `url(#${id(n)})`;
  const ink = p.foilInk ? url('foil') : p.ink;
  const rim = RIM[p.rim]!;
  const numCls = num.length > 3 ? 18 : num.length > 2 ? 22 : 26;
  const height = shape === 'rosette' ? (size * 125) / 100 : size;
  const face2 = shape === 'star' ? 34.2 : shape === 'rosette' ? 36.3 : 39.5;
  return (
    <svg
      viewBox={shape === 'rosette' ? '0 0 100 125' : '0 0 100 100'}
      width={size}
      height={height}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-image-badge={shape}
      data-badge-on={on ? '' : undefined}
      style={on ? undefined : { filter: 'grayscale(1)', opacity: 0.5 }}
    >
      <defs>
        <radialGradient id={id('face')} cx=".38" cy=".3" r=".85">
          <stop offset="0" stopColor={p.face[0]} />
          <stop offset="1" stopColor={p.face[1]} />
        </radialGradient>
        <linearGradient id={id('rim')} x1="0" y1="0" x2="1" y2="1">
          {rim.map((c, i) => (
            <stop key={i} offset={[0, 0.28, 0.5, 0.74, 1][i]} stopColor={c} />
          ))}
        </linearGradient>
        <linearGradient id={id('gloss')} x1="0" y1="0" x2=".8" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".62" />
          <stop offset=".42" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id('faceGloss')} x1="0" y1="0" x2=".3" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".5" />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id('shade')} x1="0" y1="0" x2=".8" y2="1">
          <stop offset=".55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".34" />
        </linearGradient>
        <linearGradient id={id('foil')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FBEFC4" />
          <stop offset=".45" stopColor="#D9B463" />
          <stop offset=".6" stopColor="#F6E4A6" />
          <stop offset="1" stopColor="#B88D3B" />
        </linearGradient>
        <linearGradient id={id('tail')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#B8324A" />
          <stop offset="1" stopColor="#7A1426" />
        </linearGradient>
      </defs>

      {shape === 'seal' ? (
        <>
          <path d={SEAL} fill={url('rim')} />
          <path d={SEAL} fill={url('gloss')} />
          <path d={SEAL} fill={url('shade')} />
          <circle cx="50" cy="50" r="42" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth=".9" />
          <circle cx="50" cy="50" r="40.6" fill="none" stroke="#000" strokeOpacity=".28" strokeWidth=".9" />
        </>
      ) : shape === 'hex' ? (
        <>
          <polygon points={HEX_RIM} fill={url('rim')} />
          <polygon points={HEX_RIM} fill={url('shade')} />
          <polygon points="91,50 70.5,85.5 29.5,85.5 9,50 29.5,14.5 70.5,14.5" fill="none" stroke="#000" strokeOpacity=".3" strokeWidth=".9" />
        </>
      ) : shape === 'star' ? (
        <>
          <polygon points={STAR} fill={url('rim')} />
          <polygon points={STAR} fill={url('shade')} />
          <circle cx="50" cy="50" r="36.5" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth=".9" />
          <circle cx="50" cy="50" r="35.2" fill="none" stroke="#000" strokeOpacity=".3" strokeWidth=".9" />
        </>
      ) : (
        <>
          <polygon points="27,64 45,67 41,122 34,113 25,121" fill={url('tail')} />
          <polygon points="73,64 55,67 59,122 66,113 75,121" fill={url('tail')} />
          <polygon points={ROSETTE} fill={url('rim')} />
          <polygon points={ROSETTE} fill={url('gloss')} />
          <polygon points={ROSETTE} fill={url('shade')} />
          <circle cx="50" cy="50" r="38.6" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth=".9" />
        </>
      )}

      {shape === 'hex' ? (
        <>
          <polygon points={HEX_FACE} fill={url('face')} />
          <polygon points={HEX_FACE} fill={url('faceGloss')} />
          <polygon points={HEX_LINE} fill="none" stroke={p.ink} strokeOpacity=".4" strokeWidth=".7" />
        </>
      ) : (
        <>
          <circle cx="50" cy="50" r={face2} fill={url('face')} />
          <circle cx="50" cy="50" r={face2} fill={url('faceGloss')} />
          <circle cx="50" cy="50" r={face2 - 2} fill="none" stroke={ink} strokeOpacity=".5" strokeWidth=".7" />
          <circle cx="50" cy="50" r={face2 - 4} fill="none" stroke={ink} strokeOpacity=".38" strokeWidth=".6" strokeDasharray="1 2.1" />
        </>
      )}

      <g style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 600 }}>
        <text x="50" y="53.5" dy=".9" textAnchor="middle" fontSize={numCls} fill={p.hl} opacity=".55">
          {num}
        </text>
        <text x="50" y="53.5" textAnchor="middle" fontSize={numCls} fill={ink}>
          {num}
        </text>
      </g>
      <text
        x="50"
        y={shape === 'star' ? 63.5 : 66}
        textAnchor="middle"
        fill={ink}
        style={{ fontFamily: 'var(--font-body), system-ui, sans-serif', fontWeight: 600, fontSize: mini.length > 8 ? 6.5 : 8, letterSpacing: 1 }}
      >
        {mini}
      </text>
    </svg>
  );
}
