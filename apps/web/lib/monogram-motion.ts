/**
 * apps/web/lib/monogram-motion.ts
 *
 * The Monogram Motion Library — six premium animation signatures for the paid
 * ANIMATED_MONOGRAM SKU. Replaces the single hardcoded stroke-trace draw-on
 * (the market-default effect every template tool ships) with a motion
 * vocabulary the couple chooses from in the Monogram Maker.
 *
 * The first six signatures (draw·foil·bloom·editorial·halo·stardust) are
 * implemented in AnimatedMonogramHero (app/_components/animated-monogram-hero.tsx)
 * as pure SVG + CSS — no Lottie, no JS animation runtime, SSR-safe, and every one
 * collapses to the static painted monogram under `prefers-reduced-motion: reduce`.
 *
 * Two premium signatures join them (owner 2026-06-22 "this is monogram
 * animation"): GOLD ('gold', a flowing-gold turn — the composed-CSS
 * GoldMonogramReveal in inline mode) and MOLTEN ('molten', molten metal floods
 * the mark then hardens to gold — the WebGL MoltenMonogramReveal). These two are
 * NOT pure-CSS-SSR: gold is a composed CSS reveal; molten is a three.js shader
 * (lazy-loaded, ssr:false) that renders live on at most one large surface at a
 * time and falls back to a static gold mark elsewhere. They route through
 * HeroMonogram, not AnimatedMonogramHero. Both were previously Save-the-Date
 * reveal OPENINGS; they now live only as monogram animations.
 *
 * The chosen key persists as `events.monogram_motion_key`
 * (20261111000000_event_monogram_motion.sql; gold/molten added by
 * 20270219143725_monogram_motion_gold_molten.sql). NULL means 'draw' so every
 * pre-library Animated Monogram keeps its exact original render. WHICH
 * animation plays is a free choice; WHETHER the monogram animates at all stays
 * gated by ANIMATED_MONOGRAM order ownership (lib/animated-monogram.ts).
 */

export type MonogramMotionKey =
  | 'draw'
  | 'foil'
  | 'bloom'
  | 'editorial'
  | 'halo'
  | 'stardust'
  | 'gold'
  | 'molten';

export type MonogramMotion = {
  key: MonogramMotionKey;
  label: string;
  /** One-line picker hint (Monogram Maker tile). */
  hint: string;
  /** Longer marketing line (add-ons detail page). */
  description: string;
};

export const MONOGRAM_MOTIONS: MonogramMotion[] = [
  {
    key: 'draw',
    label: 'Drawn',
    hint: 'Traced in by an invisible pen',
    description:
      'Your initials trace themselves on, line by line, then settle into ink — the classic drawn-live reveal.',
  },
  {
    key: 'foil',
    label: 'Foil',
    hint: 'A band of light sweeps the letters',
    description:
      'Your monogram appears in ink, then a band of golden light sweeps across it — like gold-foil stationery catching the light.',
  },
  {
    key: 'bloom',
    label: 'Bloom',
    hint: 'Ink blooms out from the center',
    description:
      'Your initials bloom outward from the heart of the circle, like ink spreading through fine paper.',
  },
  {
    key: 'editorial',
    label: 'Editorial',
    hint: 'Rises and settles like a magazine title',
    description:
      'Your initials rise into place and the letter-spacing settles — the quiet confidence of a fashion-magazine masthead.',
  },
  {
    key: 'halo',
    label: 'Halo',
    hint: 'The ring sweeps around first',
    description:
      'The circle sweeps itself around your initials first, then the letters fade up inside it — a ring before the names.',
  },
  {
    key: 'stardust',
    label: 'Stardust',
    hint: 'Gold sparks twinkle as letters appear',
    description:
      'Tiny gold sparks twinkle around the circle as your initials fade in — a little celebration every time a guest arrives.',
  },
  {
    key: 'gold',
    label: 'Gold Turn',
    hint: 'Your mark turns in, in flowing gold',
    description:
      'Your monogram turns into view in flowing gold and catches the light as it settles forward — a polished metal medallion.',
  },
  {
    key: 'molten',
    label: 'Molten Gold',
    hint: 'Molten metal floods the mark, then hardens',
    description:
      'Your monogram pours in as glowing molten gold, then cools, crusts over, and hardens into solid, gleaming metal.',
  },
];

export const MONOGRAM_MOTION_KEYS = MONOGRAM_MOTIONS.map((m) => m.key);

export function isMonogramMotionKey(value: unknown): value is MonogramMotionKey {
  return (
    typeof value === 'string' &&
    (MONOGRAM_MOTION_KEYS as string[]).includes(value)
  );
}

/**
 * Resolve a stored events.monogram_motion_key to a renderable key.
 * NULL / unknown → 'draw' (the pre-library default) so legacy owners keep
 * their exact original animation.
 */
export function resolveMonogramMotion(
  value: string | null | undefined,
): MonogramMotionKey {
  return isMonogramMotionKey(value) ? value : 'draw';
}
