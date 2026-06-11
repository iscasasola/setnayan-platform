import 'server-only';

/**
 * apps/web/lib/bespoke-monogram.ts
 *
 * IO half of the Setnayan AI Bespoke Monogram engine — Phase 2 of the
 * 2026-06-11 monogram overhaul (revives iteration 0037 on a native-vector
 * pipeline). Calls the vector image model, downloads the candidate SVGs,
 * runs them through the pure sanitizer (lib/bespoke-monogram-engine.ts),
 * and hands them back for storage + display. The client-safe registry lives
 * in lib/bespoke-monogram-shared.ts.
 *
 * BRANDING (locked, 0037 § 5): the customer-facing name is "Setnayan AI".
 * The underlying vendor (Recraft) is NEVER named in any customer-visible
 * string — it appears only here, server-side, and in the env var name.
 *
 * COST GUARD: generation is capped at MAX_BESPOKE_ROUNDS_PER_EVENT rounds
 * (×4 marks each, ~US$0.08/mark ≈ ₱4.6) so a single event's worst case is
 * bounded (~₱220). Whether/how the studio is priced as a SKU is batched to
 * the owner's holistic pricing review — V1 ships cap-guarded and ungated.
 */

import { CANDIDATES_PER_ROUND } from '@/lib/bespoke-monogram-shared';
import { PALETTE_RGB, sanitizeBespokeSvg } from '@/lib/bespoke-monogram-engine';
import { generateVectorSvg, decodeBase64Svg } from '@/lib/recraft';

export {
  MAX_BESPOKE_ROUNDS_PER_EVENT,
  CANDIDATES_PER_ROUND,
  BESPOKE_STYLES,
  isBespokeStyleKey,
  bespokeSvgToDataUri,
  type BespokeStyleKey,
  type BespokeStyle,
} from '@/lib/bespoke-monogram-shared';
export { buildBespokePrompt, sanitizeBespokeSvg } from '@/lib/bespoke-monogram-engine';

/** Is the bespoke studio usable in this deployment? (env key present) */
export function bespokeStudioEnabled(): boolean {
  return Boolean(process.env.RECRAFT_API_KEY);
}

export type BespokeCandidate = { svg: string };

// Palette steering for the house client (lib/recraft.ts) — verified live
// 2026-06-11 against recraftv4_1_vector + b64_json.
const BESPOKE_CONTROLS = {
  colors: PALETTE_RGB.map((rgb) => ({ rgb })),
  background_color: { rgb: [255, 255, 255] as [number, number, number] },
};

/**
 * Generate one round of candidate marks via the house Recraft client
 * (lib/recraft.ts · b64_json, no download round-trip), one parallel call per
 * candidate. Returns sanitized SVG strings. Throws with a customer-safe
 * message on failure (never names the vendor — the house client's error
 * messages do, so they are caught and rewrapped here).
 */
export async function generateBespokeCandidates(
  prompt: string,
): Promise<BespokeCandidate[]> {
  if (!bespokeStudioEnabled()) {
    throw new Error('Setnayan AI is not available right now.');
  }

  const one = async (): Promise<string | null> => {
    let b64: string;
    try {
      ({ b64Svg: b64 } = await generateVectorSvg({
        prompt,
        controls: BESPOKE_CONTROLS,
      }));
    } catch {
      // API-drift tolerance: retry once without palette controls before
      // giving up on this candidate.
      try {
        ({ b64Svg: b64 } = await generateVectorSvg({ prompt }));
      } catch {
        return null;
      }
    }
    return sanitizeBespokeSvg(decodeBase64Svg(b64));
  };

  const settled = await Promise.all(
    Array.from({ length: CANDIDATES_PER_ROUND }, () => one()),
  );
  const candidates = settled
    .filter((svg): svg is string => Boolean(svg))
    .map((svg) => ({ svg }));

  if (candidates.length === 0) {
    throw new Error(
      'Setnayan AI could not generate designs right now — please try again.',
    );
  }
  return candidates;
}
