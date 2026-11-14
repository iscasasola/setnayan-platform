import type { CSSProperties } from 'react';
import { SetnayanMark } from '@/app/_components/setnayan-mark-icon';
import type { GiftSeal } from '@/lib/gift-moment';

/**
 * 🎁 THE GIFT, DRAWN IN CODE (owner 2026-11-14: "no Higgsfield video — two stills + code burst/confetti"). The two
 * pictures — the wrapped gift and the opened box — are drawn here from the owner's two stills
 * (build-sessions/HIGGSFIELD-GIFT-UNWRAP-2026-11-14.md): a square box in the app's terracotta, a gold ribbon and bow,
 * the floor shadow kept. Colours are the app's tokens (`--m-mulberry` · `--m-orange` · `--m-ivory`), never typed, so
 * dark mode follows. A pure view — no hooks — so the burst can draw the wrapped gift again as its pieces.
 *
 * The SEAL is drawn by the app OVER each picture (owner: "add the shops logo on the gift on the circular wax seal
 * design"), so every giver gets their own: the logo pressed into the wax in one darker tone, the giver's two initials
 * when there is no logo, Setnayan's mark for a gift from Setnayan.
 */

const fill = (v: string): CSSProperties => ({ fill: v });
const PAPER = 'var(--m-mulberry)';
const PAPER_DEEP = 'var(--m-mulberry-deep)';
const RIBBON = 'var(--m-orange)';
const RIBBON_DEEP = 'var(--m-orange-deep)';
const INSIDE = 'var(--m-ivory)';

function Shadow() {
  return <ellipse cx="100" cy="184" rx="64" ry="8" style={{ fill: 'currentColor', opacity: 0.18 }} />;
}

/** The wrapped gift — still 1. `withSeal` false draws it without the seal (the burst's pieces). */
export function WrappedGiftSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <Shadow />
      {/* the box */}
      <rect x="40" y="90" width="120" height="90" rx="7" style={fill(PAPER)} />
      <rect x="40" y="90" width="120" height="12" style={{ ...fill(PAPER_DEEP), opacity: 0.55 }} />
      {/* the lid */}
      <rect x="32" y="70" width="136" height="26" rx="6" style={fill(PAPER)} />
      <rect x="32" y="88" width="136" height="8" rx="3" style={{ ...fill(PAPER_DEEP), opacity: 0.45 }} />
      {/* the ribbon */}
      <rect x="91" y="70" width="18" height="110" style={fill(RIBBON)} />
      <rect x="91" y="70" width="5" height="110" style={{ ...fill(RIBBON_DEEP), opacity: 0.25 }} />
      {/* the bow */}
      <path d="M100 70 C 78 40, 52 52, 66 68 C 74 76, 90 74, 100 70 Z" style={fill(RIBBON)} />
      <path d="M100 70 C 122 40, 148 52, 134 68 C 126 76, 110 74, 100 70 Z" style={fill(RIBBON)} />
      <path d="M100 70 C 92 80, 84 92, 80 100 L 88 100 C 92 92, 96 84, 100 74 Z" style={fill(RIBBON_DEEP)} />
      <path d="M100 70 C 108 80, 116 92, 120 100 L 112 100 C 108 92, 104 84, 100 74 Z" style={fill(RIBBON_DEEP)} />
      <circle cx="100" cy="70" r="8" style={fill(RIBBON_DEEP)} />
    </svg>
  );
}

/** The opened box — still 2: the lid lifted off to the side, the inside showing, a soft light from within. */
export function OpenedGiftSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <defs>
        <radialGradient id="gm-glow" cx="50%" cy="60%" r="50%">
          <stop offset="0%" stopColor="var(--m-orange)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--m-orange)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="70" rx="80" ry="60" fill="url(#gm-glow)" />
      <Shadow />
      {/* the inside */}
      <path d="M40 98 L 160 98 L 150 86 L 50 86 Z" style={fill(INSIDE)} />
      {/* the box */}
      <rect x="40" y="98" width="120" height="82" rx="7" style={fill(PAPER)} />
      <rect x="91" y="98" width="18" height="82" style={fill(RIBBON)} />
      {/* the lid, lifted and tipped */}
      <g transform="translate(118 30) rotate(24)">
        <rect x="0" y="0" width="76" height="22" rx="5" style={fill(PAPER)} />
        <rect x="29" y="0" width="18" height="22" style={fill(RIBBON)} />
        <path d="M38 0 C 26 -22, 8 -14, 18 -4 Z" style={fill(RIBBON)} />
        <path d="M38 0 C 50 -22, 68 -14, 58 -4 Z" style={fill(RIBBON)} />
      </g>
    </svg>
  );
}

/**
 * The wax seal, laid over the picture at its own place (the box's front, under the ribbon's knot). `size` is a share
 * of the stage so it scales with it.
 */
export function GiftSealMark({ seal, label, top = '62%' }: { seal: GiftSeal; label: string; top?: string }) {
  const wax: CSSProperties = {
    background:
      'radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--m-mulberry) 70%, white), var(--m-mulberry-deep) 72%)',
    boxShadow: 'inset 0 0 0 3px color-mix(in srgb, var(--m-mulberry-deep) 70%, black), 0 3px 8px rgb(0 0 0 / 0.25)',
  };
  // Pressed into the wax in ONE darker tone of the wax itself.
  const pressed = 'color-mix(in srgb, var(--m-mulberry-deep) 72%, black)';
  return (
    <span
      role="img"
      aria-label={label}
      data-gift-seal={seal.kind}
      className="absolute left-1/2 flex aspect-square w-[26%] -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full"
      style={{ ...wax, top }}
    >
      <span
        aria-hidden
        className="absolute inset-[9%] rounded-full"
        style={{ boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${pressed} 60%, transparent)` }}
      />
      {seal.kind === 'logo' ? (
        // eslint-disable-next-line @next/next/no-img-element -- a presigned logo, sized by the seal; no optimiser hop
        <img
          src={seal.src}
          alt=""
          className="h-[62%] w-[62%] rounded-full object-cover"
          style={{ filter: 'grayscale(1) contrast(1.3) brightness(0.55) sepia(0.6)', mixBlendMode: 'multiply', opacity: 0.9 }}
        />
      ) : seal.kind === 'initials' ? (
        <span
          aria-hidden
          className="font-serif text-[clamp(14px,6vw,26px)] font-semibold tracking-wide"
          style={{ color: pressed, textShadow: '0 1px 0 color-mix(in srgb, var(--m-mulberry) 60%, white)' }}
        >
          {seal.initials}
        </span>
      ) : (
        <SetnayanMark aria-hidden className="h-[58%] w-[58%]" style={{ color: pressed }} />
      )}
    </span>
  );
}

/**
 * The burst's pieces: the wrapped gift cut six ways, each flying its own way. Points and moves are shares of the stage
 * (x, y in hundredths), turned into the CSS the module reads (`clip-path`, `--gm-dx/-dy/-rot`) by `shardStyle`.
 */
type Shard = { points: ReadonlyArray<readonly [number, number]>; move: readonly [number, number]; turn: number };
const SHARD_CUTS: readonly Shard[] = [
  { points: [[0, 0], [50, 0], [40, 45], [0, 40]], move: [-38, -34], turn: -28 },
  { points: [[50, 0], [100, 0], [100, 40], [60, 45]], move: [38, -36], turn: 30 },
  { points: [[0, 40], [40, 45], [35, 75], [0, 80]], move: [-46, 4], turn: -18 },
  { points: [[60, 45], [100, 40], [100, 80], [65, 75]], move: [46, 6], turn: 20 },
  { points: [[0, 80], [35, 75], [50, 100], [0, 100]], move: [-30, 34], turn: -34 },
  { points: [[65, 75], [100, 80], [100, 100], [50, 100], [40, 45], [60, 45]], move: [30, 36], turn: 26 },
];

const pct = (n: number) => `${n}%`;
export const SHARDS: ReadonlyArray<{ clip: string; dx: string; dy: string; rot: string }> = SHARD_CUTS.map((c) => ({
  clip: `polygon(${c.points.map(([x, y]) => `${pct(x)} ${pct(y)}`).join(', ')})`,
  dx: pct(c.move[0]),
  dy: pct(c.move[1]),
  rot: `${c.turn}deg`,
}));

/** Confetti, drawn once in a fixed pattern (no randomness, so a re-render never reshuffles it). */
const CONFETTI_COLOURS = ['var(--m-orange)', 'var(--m-mulberry)', 'var(--m-sage-deep)', 'var(--m-blush-deep)', 'var(--m-ivory)'];
export const CONFETTI: ReadonlyArray<{ left: string; colour: string; delay: string; drift: string; spin: string }> = Array.from(
  { length: 36 },
  (_, i) => ({
    left: `${(i * 37) % 100}%`,
    colour: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length]!,
    // a share of one "elem", so the whole fall still reads the token
    delay: `calc(var(--sn-dur-elem) * ${((i * 7) % 10) / 10})`,
    drift: `${((i * 53) % 21) - 10}vw`,
    spin: `${((i * 97) % 720) - 360}deg`,
  }),
);
