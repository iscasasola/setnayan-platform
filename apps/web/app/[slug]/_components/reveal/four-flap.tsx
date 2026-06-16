'use client';

/**
 * Four-flap envelope reveal (rigid family · template 1 of 7).
 *
 * A full-screen paper "envelope" whose four triangular flaps are pinned to the
 * screen edges and fold open to their corners, revealing the invitation beneath.
 * Pure CSS 3D — no WebGL dependency, so it stays inside the guest-site bundle /
 * Lighthouse budget. The WebGL veils + curtain land in a later PR behind the
 * same flag and overlay contract.
 *
 * Colour: styled entirely with the moodboard-recoloured Tailwind tokens
 * (cream / mulberry / terracotta / ink) that app/[slug] already overrides per
 * event via buildSitePaletteVars — so it recolours automatically, ₱0.
 */

type Props = {
  /** Short couple monogram shown on the seal, e.g. "A & J". */
  monogram: string;
  /** Once true, the flaps fold open and the overlay fades out. */
  open: boolean;
  /** Fired when the guest triggers the open (tap / scroll). */
  onOpen: () => void;
};

export function FourFlapEnvelope({ monogram, open, onOpen }: Props) {
  // Each flap is a full-screen triangle clipped to one edge; on open it folds
  // away toward that edge, uncovering the content layer underneath.
  const flap =
    'absolute inset-0 bg-cream transition-transform duration-[1100ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] will-change-transform';

  return (
    <div
      className={`absolute inset-0 transition-opacity duration-700 ${
        open ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      {/* soft stage behind the flaps so the seam reads */}
      <div className="absolute inset-0 bg-ink" />

      {/* top */}
      <div
        className={flap}
        style={{
          clipPath: 'polygon(0 0, 100% 0, 50% 50%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
          transform: open ? 'translateY(-101%)' : 'translateY(0)',
        }}
      />
      {/* bottom */}
      <div
        className={flap}
        style={{
          clipPath: 'polygon(0 100%, 100% 100%, 50% 50%)',
          transform: open ? 'translateY(101%)' : 'translateY(0)',
        }}
      />
      {/* left */}
      <div
        className={flap}
        style={{
          clipPath: 'polygon(0 0, 0 100%, 50% 50%)',
          transform: open ? 'translateX(-101%)' : 'translateX(0)',
        }}
      />
      {/* right */}
      <div
        className={flap}
        style={{
          clipPath: 'polygon(100% 0, 100% 100%, 50% 50%)',
          transform: open ? 'translateX(101%)' : 'translateX(0)',
        }}
      />

      {/* wax seal + cue at the centre seam */}
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
