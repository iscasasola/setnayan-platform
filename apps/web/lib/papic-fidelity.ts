/**
 * apps/web/lib/papic-fidelity.ts
 *
 * Papic per-event FIDELITY tier — brief PR-4 (Papic_Build_Brief_2026-07-17
 * ruling #2). ONE column (`events.papic_quality_tier`), two seams: the couple's
 * setup surface (Studio → Papic) WRITES it, the capture ingest READS it. This
 * module is the shared vocabulary both seams import, so the value written is
 * by construction the value read — no write/read mismatch is possible.
 *
 * `PapicFidelityTier` is deliberately DISTINCT from `PapicQualityTier` in
 * lib/papic-adaptive-quality.ts: that one is the CLIENT-side network-adaptive
 * tier ('full' | 'reduced' | 'queue_only') that reacts to venue signal at
 * capture time. This one is the couple's per-event STORAGE fidelity decision,
 * applied server-side at ingest.
 *
 * Tier ladder (Papic_Good_Better_Best_Pricing_2026-07-17 § 5):
 *   full_res        — keep the uploaded original 1:1, untouched. DEFAULT —
 *                     exactly the shipped pre-PR-4 behavior, so absent/legacy
 *                     rows and un-migrated envs behave as today.
 *   optimal         — ~4256px long edge · ~12 MP · sharp to A3. Wedding
 *                     recommended: guests' phones shoot ≈12 MP, essentially
 *                     native. The 12 MP copy IS the high-res that downloads /
 *                     Drive-syncs.
 *   high_efficiency — ~2560px long edge · ~4 MP · screen/social/crowd. The
 *                     Papic Lite tier (fixed per product when Lite ships).
 *
 * STILLS ONLY: the server never transcodes video (Vercel has no ffmpeg), so
 * clip fidelity is governed client-side at capture (1080p) regardless of tier.
 *
 * Client-safe: no server-only imports (same pattern as papic-photo-styles.ts).
 * The sharp-powered ingest half lives in lib/papic-ingest-fidelity.ts.
 */

export type PapicFidelityTier = 'full_res' | 'optimal' | 'high_efficiency';

/** DB default + the pre-PR-4 shipped behavior (originals kept 1:1). */
export const DEFAULT_PAPIC_FIDELITY: PapicFidelityTier = 'full_res';

export interface PapicFidelityMeta {
  id: PapicFidelityTier;
  /** Picker card label. */
  label: string;
  /** One-line couple-facing description. */
  blurb: string;
  /** Secondary spec line shown under the blurb. */
  spec: string;
}

/** Ordered for the picker — recommended (Optimal) first. */
export const PAPIC_FIDELITY_TIERS: readonly PapicFidelityMeta[] = [
  {
    id: 'optimal',
    label: 'Optimal',
    blurb: 'Phone-native sharpness, prints beautifully up to A3.',
    spec: '~12 MP · 3–5 MB per photo',
  },
  {
    id: 'full_res',
    label: 'Full resolution',
    blurb: 'Keep every photo exactly as the camera uploaded it.',
    spec: '1:1 original · largest files',
  },
  {
    id: 'high_efficiency',
    label: 'High efficiency',
    blurb: 'Light files for screens and social — great for huge crowds.',
    spec: '~4 MP · under 1 MB per photo',
  },
];

const TIER_IDS: ReadonlySet<PapicFidelityTier> = new Set(
  PAPIC_FIDELITY_TIERS.map((t) => t.id),
);

export const PAPIC_FIDELITY_VALUES: readonly PapicFidelityTier[] =
  PAPIC_FIDELITY_TIERS.map((t) => t.id);

/**
 * Coerce a raw DB / form value to a valid tier. Anything absent, unknown, or
 * pre-migration falls back to the default — i.e. exactly today's behavior.
 */
export function asPapicFidelityTier(
  value: string | null | undefined,
): PapicFidelityTier {
  return value && TIER_IDS.has(value as PapicFidelityTier)
    ? (value as PapicFidelityTier)
    : DEFAULT_PAPIC_FIDELITY;
}

/**
 * Ingest processing parameters per tier — the single tier→parameter mapping
 * (unit-tested in papic-fidelity.test.ts).
 *
 * `maxLongEdgePx: null` means NO ingest processing at all: the uploaded bytes
 * are stored verbatim (the full_res / legacy path — one code path shared by
 * absent, legacy, and explicit-full_res rows).
 *
 * For downscaling tiers, ingest only ever DOWNSCALES: a photo already within
 * the long-edge cap is stored verbatim too (no upscale, no pointless second
 * lossy pass — honours the one-compression-pass rule of papic-derivatives.ts).
 */
export interface FidelityIngestParams {
  /** Long-edge cap in px, or null = store bytes verbatim (no processing). */
  maxLongEdgePx: number | null;
  /** JPEG quality for the re-encode when a downscale happens. */
  jpegQuality: number;
}

/** ~4256px long edge ≈ 12 MP at 3:2 — "sharp to A3" (GBB § 5). */
export const OPTIMAL_LONG_EDGE_PX = 4256;
/** ~2560px long edge ≈ 4 MP — screen/social/crowd (GBB § 5). */
export const HIGH_EFFICIENCY_LONG_EDGE_PX = 2560;

export function fidelityIngestParams(
  tier: PapicFidelityTier,
): FidelityIngestParams {
  switch (tier) {
    case 'optimal':
      return { maxLongEdgePx: OPTIMAL_LONG_EDGE_PX, jpegQuality: 85 };
    case 'high_efficiency':
      return { maxLongEdgePx: HIGH_EFFICIENCY_LONG_EDGE_PX, jpegQuality: 80 };
    case 'full_res':
      return { maxLongEdgePx: null, jpegQuality: 90 };
  }
}
