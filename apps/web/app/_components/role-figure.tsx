import type { CSSProperties } from 'react';
import { CHILD_SCALE, FIGURE_ART, figureIsChild, unsetSilhouette } from '@/lib/attire-figures';
import { roleFigurePeople, type FigurePerson, type FigurePick } from '@/lib/role-figure';

/**
 * 👗 THE ILLUSTRATED PERSON IN A ROLE'S COLOURS (owner 2026-09-27, "an ILLUSTRATED person in the exact role colours —
 * not AI, exact colour, free"; redrawn 2026-10-14 — DECISION_LOG "EFFECTS + ATTIRE DESIGN APPROVED", then the owner's
 * pick of the AI-drawn figures). ONE component, TWO places: the guest's dress code (server-rendered, no script) and the
 * Studio's Attire blocks (the Mood Board's lazy chunk).
 *
 * Each person is the garment's drawing (`lib/attire-figures.ts`, the artwork seam) with a layer of the role's colour
 * laid over it, clipped to the garment's mask, multiplied — the shading survives, the colour is the role's hex. "Not
 * said yet" is a dashed silhouette (the Studio passes it; a guest page never shows one). Nothing to wear → nothing.
 *
 * Either the role's colours (`roleKey` + `hexes`, and its `picks` — who and what each wears) or the `people`
 * themselves. `className` sets the picture's HEIGHT (an adult stands the full height, a child four-fifths of it).
 *
 * No hooks, no state. Decorative: hidden from assistive tech (the words beside it say what to wear).
 */
export function RoleFigure({
  roleKey,
  hexes = [],
  meaning = 'outfit',
  picks = null,
  people = null,
  className = 'h-16',
}: {
  /** A Mood Board `PaletteKey`, a `custom:<slug>`, or a guest-list role. */
  roleKey: string;
  hexes?: readonly string[];
  /** `options` = the guests: a colour each, never combined. */
  meaning?: 'outfit' | 'options';
  /** Who the role's people are and what each wears (`picksOf`, `lib/attire-rows.ts`). */
  picks?: readonly FigurePick[] | null;
  /** The people, drawn exactly — overrides the rest. */
  people?: readonly FigurePerson[] | null;
  className?: string;
}) {
  const drawn = people ?? roleFigurePeople(roleKey, hexes, meaning, picks);
  if (!drawn.length) return null;
  return (
    <span aria-hidden data-role-figure={roleKey} className={`inline-flex shrink-0 items-end gap-0.5 ${className}`}>
      {drawn.map((p, i) => (
        <FigurePersonView key={i} person={p} />
      ))}
    </span>
  );
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function FigurePersonView({ person }: { person: FigurePerson }) {
  const height = figureIsChild(person.who) ? `${(CHILD_SCALE * 100).toFixed(1)}%` : '100%';
  if (person.garment === 'unset') {
    const s = unsetSilhouette(person.who);
    return (
      <span data-person={person.who} data-garment="unset" className="block h-full" style={{ height }}>
        <svg viewBox={s.viewBox} className="block h-full w-auto" focusable="false">
          <path d={s.d} fill="none" stroke="#8E8880" strokeWidth={1.6} strokeDasharray="4 4" opacity={0.8} />
        </svg>
      </span>
    );
  }
  const art = FIGURE_ART[person.garment];
  const tint: CSSProperties = {
    backgroundColor: HEX.test(person.main) ? person.main : '#9B9B9B',
    WebkitMaskImage: `url(${art.mask})`,
    maskImage: `url(${art.mask})`,
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    mixBlendMode: 'multiply',
  };
  return (
    <span data-person={person.who} data-garment={person.garment} data-colour={person.main} className="relative block [isolation:isolate]" style={{ height, aspectRatio: `${art.w} / ${art.h}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a 7–9 KB still the tint layer must sit exactly over */}
      <img src={art.src} alt="" width={art.w} height={art.h} loading="lazy" decoding="async" className="block h-full w-full" />
      <span className="absolute inset-0" style={tint} />
    </span>
  );
}
