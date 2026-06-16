'use client';

/**
 * Rigid-panel reveals (envelope family · templates 2–4 of 7).
 *
 * The same pure-CSS-3D engine as the four-flap envelope, parameterised over the
 * three remaining rigid openings:
 *   - two-flap-vertical    — splits left | right, the two flaps swing open
 *   - two-flap-horizontal  — splits top | bottom, the two flaps swing open
 *   - church-doors         — two grand arched doors swing wide
 *
 * No WebGL dependency, so these stay inside the guest-site bundle / Lighthouse
 * budget (the veils carry the only three.js cost, code-split behind the same
 * flag). Each flap is two-sided — paper on the front, the liner accent on the
 * back — so as it swings past upright you glimpse the inner colour, exactly like
 * a real envelope. Everything is styled with the moodboard-recoloured Tailwind
 * tokens (cream / terracotta / mulberry / ink) that app/[slug] already overrides
 * per event via buildSitePaletteVars, so it recolours automatically, ₱0.
 */

import type { CSSProperties, ReactNode } from 'react';

export type RigidVariant = 'two-flap-vertical' | 'two-flap-horizontal' | 'church-doors';

type Props = {
  /** Which rigid opening to render. */
  variant: RigidVariant;
  /** Short couple monogram shown on the seal, e.g. "A & J". */
  monogram: string;
  /** Once true, the flaps swing open and the overlay fades out. */
  open: boolean;
  /** Fired when the guest triggers the open (tap). */
  onOpen: () => void;
};

const FOLD =
  'absolute transition-transform duration-[1100ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] will-change-transform [transform-style:preserve-3d]';

/**
 * One two-sided rigid flap. `openTransform` is applied while open; `backRotate`
 * flips the liner face 180° about the flap's own hinge axis so it shows once the
 * flap turns past upright.
 */
function Flap({
  className,
  style,
  faceClass = 'bg-cream',
  backClass = 'bg-terracotta',
  faceStyle,
  openTransform,
  backRotate,
  open,
  children,
}: {
  className: string;
  style?: CSSProperties;
  faceClass?: string;
  backClass?: string;
  faceStyle?: CSSProperties;
  openTransform: string;
  backRotate: string;
  open: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={`${FOLD} ${className}`} style={{ ...style, transform: open ? openTransform : 'none' }}>
      {/* front (paper) */}
      <div
        className={`absolute inset-0 overflow-hidden [backface-visibility:hidden] ${faceClass}`}
        style={{ boxShadow: 'inset 0 0 60px rgba(0,0,0,0.06)', ...faceStyle }}
      >
        {children}
      </div>
      {/* back (liner accent) */}
      <div
        className={`absolute inset-0 [backface-visibility:hidden] ${backClass}`}
        style={{ transform: backRotate }}
      />
    </div>
  );
}

/** Decorative two-panel inset + gold trim that turns a plain flap into a door. */
function DoorPanels({ trim }: { trim: 'left' | 'right' }) {
  return (
    <>
      <div className="absolute inset-[9%] flex flex-col gap-[9%]">
        <div className="flex-1 rounded-md ring-1 ring-ink/15 shadow-[inset_0_2px_10px_rgba(0,0,0,0.10)]" />
        <div className="flex-[1.4] rounded-md ring-1 ring-ink/15 shadow-[inset_0_2px_10px_rgba(0,0,0,0.10)]" />
      </div>
      <div
        className="absolute top-[6%] bottom-[6%] w-px bg-[#cb9e4b]/50"
        style={trim === 'left' ? { right: '5%' } : { left: '5%' }}
      />
    </>
  );
}

export function RigidReveal({ variant, monogram, open, onOpen }: Props) {
  return (
    <div
      className={`absolute inset-0 transition-opacity duration-700 ${
        open ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      {/* soft stage behind the flaps so the seam / arch surround reads */}
      <div className="absolute inset-0 bg-ink" />

      {/* the 3D stage holding the flaps */}
      <div className="absolute inset-0" style={{ perspective: '2000px' }}>
        {variant === 'two-flap-vertical' ? (
          <>
            <Flap
              className="left-0 top-0 h-full w-1/2 origin-left"
              openTransform="rotateY(-122deg)"
              backRotate="rotateY(180deg)"
              open={open}
            />
            <Flap
              className="right-0 top-0 h-full w-1/2 origin-right"
              openTransform="rotateY(122deg)"
              backRotate="rotateY(180deg)"
              open={open}
            />
          </>
        ) : variant === 'two-flap-horizontal' ? (
          <>
            <Flap
              className="left-0 top-0 h-1/2 w-full origin-top"
              openTransform="rotateX(122deg)"
              backRotate="rotateX(180deg)"
              open={open}
            />
            <Flap
              className="left-0 bottom-0 h-1/2 w-full origin-bottom"
              openTransform="rotateX(-122deg)"
              backRotate="rotateX(180deg)"
              open={open}
            />
          </>
        ) : (
          <>
            <Flap
              className="left-0 top-0 h-full w-1/2 origin-left"
              openTransform="rotateY(-138deg)"
              backRotate="rotateY(180deg)"
              backClass="bg-mulberry"
              faceStyle={{ borderTopRightRadius: '42%' }}
              open={open}
            >
              <DoorPanels trim="left" />
            </Flap>
            <Flap
              className="right-0 top-0 h-full w-1/2 origin-right"
              openTransform="rotateY(138deg)"
              backRotate="rotateY(180deg)"
              backClass="bg-mulberry"
              faceStyle={{ borderTopLeftRadius: '42%' }}
              open={open}
            >
              <DoorPanels trim="right" />
            </Flap>
          </>
        )}
      </div>

      {/* wax seal + cue where the panels meet */}
      <div className="absolute inset-0 flex items-center justify-center">
        <button
          type="button"
          onClick={onOpen}
          aria-label="Open the invitation"
          className={`group flex flex-col items-center gap-3 transition-opacity duration-500 ${
            open ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-mulberry text-cream shadow-2xl ring-4 ring-cream/30 transition-transform group-hover:scale-105 group-active:scale-95">
            <span className="font-display text-lg italic">{monogram}</span>
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-cream/85">
            Tap to open
          </span>
        </button>
      </div>
    </div>
  );
}
