// Papic adaptive capture quality (Group A · PR A2).
//
// Venue WiFi at a wedding is often weak + congested. Encoding every photo at
// full JPEG quality and every clip at the browser's default (highest) bitrate
// makes uploads slow + failure-prone exactly when the network is worst. This
// module picks an encode quality from a rolling estimate of the connection so
// captures shrink under pressure — and, when the link is effectively unusable,
// signals the capture surface to skip the doomed live upload and hand the shot
// straight to the offline queue (PR A1) at the reduced size.
//
// The estimate blends two signals:
//   1. MEASURED throughput — an EMA of bytes/ms from completed uploads
//      (`recordUploadSample`). The ground truth; available on every browser.
//   2. The Network Information API (`navigator.connection`) as the COLD-START
//      hint before any upload has completed. Present on Chrome/Android; absent
//      on iOS Safari, where we start optimistic ('full') and self-correct from
//      the first measured sample.
//
// Module-singleton state (not React) so the estimate persists across capture
// re-renders within a session.

export type PapicQualityTier = 'full' | 'reduced' | 'queue_only';

/** EMA of measured upload throughput in kbps. null until the first sample. */
let emaKbps: number | null = null;
const EMA_ALPHA = 0.4; // weight on the newest sample (responsive but not jumpy)

/** kbps thresholds. >=3 Mbps → full; >=600 kbps → reduced; below → queue-only. */
const FULL_MIN_KBPS = 3_000;
const REDUCED_MIN_KBPS = 600;

/** Feed one completed upload's throughput into the rolling estimate. */
export function recordUploadSample(bytes: number, ms: number): void {
  if (!(bytes > 0) || !(ms > 0)) return;
  const kbps = (bytes * 8) / ms; // bits / ms = kbits per second
  emaKbps = emaKbps == null ? kbps : EMA_ALPHA * kbps + (1 - EMA_ALPHA) * emaKbps;
}

/** Current measured estimate in kbps, or null before the first sample. */
export function measuredKbps(): number | null {
  return emaKbps;
}

/** Test-only: clear the singleton estimate between cases. */
export function __resetAdaptiveQualityForTest(): void {
  emaKbps = null;
}

type NetworkInformationLike = { downlink?: number; effectiveType?: string };

function connection(): NetworkInformationLike | null {
  if (typeof navigator === 'undefined') return null;
  const c = (navigator as unknown as { connection?: NetworkInformationLike }).connection;
  return c ?? null;
}

/** Cold-start downlink hint (kbps) from the Network Information API, if present. */
function connectionHintKbps(): number | null {
  const c = connection();
  if (c && typeof c.downlink === 'number' && c.downlink > 0) return c.downlink * 1000;
  return null;
}

/** Cold-start tier from `effectiveType` when no numeric downlink is exposed. */
function effectiveTypeTier(): PapicQualityTier | null {
  const et = connection()?.effectiveType;
  if (et === '4g') return 'full';
  if (et === '3g') return 'reduced';
  if (et === '2g' || et === 'slow-2g') return 'queue_only';
  return null;
}

/**
 * Pick the capture quality tier from the best available signal. Pure read of
 * module + navigator state — safe to call per capture. Decision order:
 *   offline → queue_only · measured/downlink kbps → threshold map ·
 *   effectiveType → coarse map · nothing → optimistic 'full'.
 */
export function getPapicQualityTier(): PapicQualityTier {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'queue_only';
  const kbps = emaKbps ?? connectionHintKbps();
  if (kbps != null) {
    if (kbps >= FULL_MIN_KBPS) return 'full';
    if (kbps >= REDUCED_MIN_KBPS) return 'reduced';
    return 'queue_only';
  }
  return effectiveTypeTier() ?? 'full';
}

/** JPEG quality for the DELIVERY photo at this tier (the clean face frame is
 *  always kept at full fidelity so face descriptors aren't degraded). */
export function photoJpegQuality(tier: PapicQualityTier): number {
  return tier === 'full' ? 0.9 : 0.72;
}

/** MediaRecorder `videoBitsPerSecond` for a clip at this tier. `undefined` lets
 *  the browser pick its default (highest); reduced/queue-only cap it. */
export function clipVideoBitsPerSecond(tier: PapicQualityTier): number | undefined {
  return tier === 'full' ? undefined : 2_500_000; // ~2.5 Mbps, ample for 1080p
}
