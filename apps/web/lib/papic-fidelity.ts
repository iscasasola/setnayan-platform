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
 *   full_res        — keep the uploaded original 1:1, untouched. The READ
 *                     FAIL-SAFE (absent/legacy/unreadable values land here, so
 *                     a failure never processes anything), and the default that
 *                     every event created before 2026-08-10 keeps.
 *   optimal         — ~4256px long edge · ~12 MP · sharp to A3. What NEW events
 *                     start on since 2026-08-10 (owner ruling). Wedding
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

/**
 * ⚠ TWO CONSTANTS, ON PURPOSE — one used to serve both jobs and they have
 * since been pulled apart. Do NOT re-merge them, and do NOT "align" one to the
 * other.
 *
 * Until 2026-08-10 a single `DEFAULT_PAPIC_FIDELITY = 'full_res'` answered two
 * completely different questions:
 *
 *   1. "What tier does an event nobody has configured START on?"  — a PRODUCT
 *      decision, owner-set, and as of 2026-08-10 the answer is **optimal**
 *      ("photo quality starts at optimal and not full resolution").
 *   2. "What tier do we assume when we FAILED to read the event's tier?" — a
 *      SAFETY decision, and the answer must stay **full_res** forever.
 *
 * Flipping the merged constant would have answered (2) with 'optimal', which
 * means a failed database read silently DOWNSCALES someone's originals — an
 * irreversible loss of resolution caused by an error, with nothing thrown and
 * nothing logged. The split is what makes that impossible to do by accident.
 */

/**
 * What a BRAND-NEW event starts on — the product default (owner, 2026-08-10:
 * "photo quality starts at optimal and not full resolution").
 *
 * The real default lives in the database (`public.events.papic_quality_tier
 * DEFAULT 'optimal'`, migration 20271127772092) because that is what actually
 * materializes onto an inserted row; this constant is the TypeScript mirror of
 * it, and papic-fidelity.test.ts asserts the two cannot drift apart.
 *
 * ⚠ NOT a fallback. Nothing may use this when a read fails — see
 * FIDELITY_READ_FAILSAFE.
 *
 * Existing events are NEVER migrated: the column is NOT NULL, so every stored
 * row already carries its own value and a default change cannot reach it.
 */
export const NEW_EVENT_PAPIC_FIDELITY: PapicFidelityTier = 'optimal';

/**
 * What we assume when the tier could not be read — a missing row, a PostgREST
 * error, a pre-migration column, an unknown/mangled value.
 *
 * 🔒 MUST STAY 'full_res'. Ingest only ever acts on a DOWNSCALING tier, so
 * full_res is the one value that means "do nothing to the uploaded bytes". Any
 * other value here turns a transient read failure into permanent, silent loss
 * of resolution on somebody's wedding photos. An error must never destroy
 * data; the worst a failed read may cost us is disk.
 */
export const FIDELITY_READ_FAILSAFE: PapicFidelityTier = 'full_res';

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
 * Coerce a raw DB / form value to a valid tier.
 *
 * ⚠ The fallback here is FIDELITY_READ_FAILSAFE, never
 * NEW_EVENT_PAPIC_FIDELITY. Every caller of this function is reading a value
 * that was supposed to already exist (the ingest's tier read, the setup
 * picker's "which card is selected") — reaching the fallback therefore means
 * the read went wrong, not that the event is new. A new event's tier is
 * materialized by the database DEFAULT at INSERT time and arrives here as a
 * real 'optimal' string; it never needs a fallback to get one.
 */
export function asPapicFidelityTier(
  value: string | null | undefined,
): PapicFidelityTier {
  return value && TIER_IDS.has(value as PapicFidelityTier)
    ? (value as PapicFidelityTier)
    : FIDELITY_READ_FAILSAFE;
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
