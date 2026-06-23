/**
 * apps/web/lib/monogram-motion.ts
 *
 * The Monogram Motion Library — six premium animation signatures for the paid
 * ANIMATED_MONOGRAM SKU. Replaces the single hardcoded stroke-trace draw-on
 * (the market-default effect every template tool ships) with a motion
 * vocabulary the couple chooses from in the Monogram Maker.
 *
 * These six signatures (draw·foil·bloom·editorial·halo·stardust) are the LETTERED
 * lockup motions, implemented in AnimatedMonogramHero
 * (app/_components/animated-monogram-hero.tsx) as pure SVG + CSS — no Lottie, no
 * JS runtime, SSR-safe, and every one collapses to the static painted monogram
 * under `prefers-reduced-motion: reduce`.
 *
 * GOLD TURN + MOLTEN GOLD are NOT here — they are BESPOKE (studio/uploaded) mark
 * reveals chosen in the Vector Studio "Animate the reveal" panel and stored in
 * `monogram_studio_config.anim` (lib/monogram-studio-shared.ts ANIM_KINDS), not
 * `monogram_motion_key` (owner 2026-06-23 unification). So the lettered library
 * stays the six CSS signatures, matching the live `events_monogram_motion_key_check`
 * constraint (which was never widened — gold/molten live in the studio jsonb).
 *
 * The chosen key persists as `events.monogram_motion_key`
 * (20261111000000_event_monogram_motion.sql). NULL means 'draw' so every
 * pre-library Animated Monogram keeps its exact original render. WHICH animation
 * plays is a free choice; WHETHER the monogram animates at all stays gated by
 * ANIMATED_MONOGRAM order ownership (lib/animated-monogram.ts).
 */

export type MonogramMotionKey =
  | 'draw'
  | 'foil'
  | 'bloom'
  | 'editorial'
  | 'halo'
  | 'stardust';

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
];
// NOTE: Gold Turn + Molten Gold are NOT lettered motions — they're bespoke-mark
// studio reveals (monogram_studio_config.anim / ANIM_KINDS), chosen in the Vector
// Studio "Animate the reveal" panel. See lib/monogram-studio-shared.ts.

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
