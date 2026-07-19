/**
 * Client-safe loader-config shape + default (owner 2026-07-05).
 *
 * This tiny module holds ONLY the type + the default literal so it can be
 * imported from BOTH the server-only cached reader (lib/loader-settings.ts) and
 * the client provider (app/_components/loader-config-provider.tsx). The reader
 * is `server-only`, so the literal can't live there without poisoning the
 * client bundle — hence this split (mirrors lib/brand-constants.ts vs
 * lib/brand-settings.ts).
 */

export type LoaderVariant = 'gather' | 'aurora' | 'pulse';

export type LoaderConfig = {
  /** Which visual treatment of the shared mark to render. */
  variant: LoaderVariant;
  /** Blocking-overlay veil solidity, 70–100 (percent). */
  veilOpacity: number;
  /** Narration cadence in ms, 800–3000. */
  stepIntervalMs: number;
  /** Tap-to-pop micro-interaction on the loader mark. */
  popEnabled: boolean;
};

/** The shipped baseline — matches the migration column defaults exactly. */
export const DEFAULT_LOADER_CONFIG: LoaderConfig = {
  variant: 'gather',
  veilOpacity: 90,
  stepIntervalMs: 1500,
  popEnabled: true,
};

export const LOADER_VARIANTS: readonly LoaderVariant[] = [
  'gather',
  'aurora',
  'pulse',
] as const;

/** Clamp an arbitrary number into [min,max], falling back on non-finite input. */
export function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Coerce arbitrary input to a valid variant, else the default. */
export function coerceVariant(value: unknown): LoaderVariant {
  return value === 'gather' || value === 'aurora' || value === 'pulse'
    ? value
    : DEFAULT_LOADER_CONFIG.variant;
}
