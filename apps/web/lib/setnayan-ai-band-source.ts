import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AI_TIER_DEFAULT,
  type AiPriceTier,
  setnayanAiTierForEventType,
} from '@/lib/setnayan-ai-type-pricing';

/**
 * WHICH BAND A KIND OF CELEBRATION IS IN — read from the owner's own screen.
 *
 * 🔴 THE DEFECT THIS EXISTS TO CLOSE, measured 2026-08-29 against production.
 * `/admin/pricing?tab=setnayan-ai` gives the owner a tick-box that moves a kind
 * of celebration into a price band. It writes `event_type_vocab.ai_price_tier`.
 * That column had exactly THREE readers — the screen that draws it, the action
 * that writes it, and a `SECURITY DEFINER` function called by NOTHING BUT TESTS.
 *
 * **Every charge resolved the band from a HARDCODED MAP IN TYPESCRIPT.** So
 * moving a kind into a different band changed what the admin screen said and
 * nothing whatsoever about what anybody paid. The control looked like a price
 * decision and was a no-op — the "gate with no handle" shape, on money.
 *
 * ⚠ NOBODY WAS MISPRICED WHEN THIS WAS FOUND, and that is worth stating rather
 * than dramatising: all 17 kinds had identical values in the column and in the
 * map, so the two agreed by luck of never having been used. The defect was
 * latent and would have fired on the owner's FIRST use of the feature.
 *
 * ── WHY THE MAP SURVIVES AT ALL ────────────────────────────────────────────
 * It is now a genuine last resort, not a second authority. It answers only when
 * the row is legitimately ABSENT — an unseeded CI database, a preview build, a
 * kind of celebration nobody has banded yet — which is exactly the case
 * `AI_TIER_DEFAULT` was written for. A failed READ is a different fact and is
 * never answered from it; see below.
 */

export type AiBandResolution =
  | { status: 'resolved'; band: AiPriceTier; source: 'owner' | 'fallback' }
  | { status: 'read_error'; message: string };

const BANDS: ReadonlySet<string> = new Set(['A', 'B', 'C', 'D', 'E']);

/**
 * The band for an event type, preferring the owner's stored choice.
 *
 * 🔑 A READ ERROR IS NOT AN UNBANDED TYPE. Supabase RESOLVES with `{ error }`,
 * so discarding it here would turn "the database refused to answer" into "this
 * kind has no band", which silently resolves to the middle band and charges a
 * price nobody chose. That is the same collapse SEC-7 removed from the price
 * read one layer down; it must not be reintroduced one layer up.
 */
export async function resolveAiBandForEventType(
  client: SupabaseClient,
  eventType: string | null | undefined,
): Promise<AiBandResolution> {
  // No type at all is a product fact, not a failed read — nothing to ask.
  if (!eventType) {
    return { status: 'resolved', band: AI_TIER_DEFAULT, source: 'fallback' };
  }

  const { data, error } = await client
    .from('event_type_vocab')
    .select('ai_price_tier')
    .eq('event_type', eventType)
    .maybeSingle();

  if (error) {
    return {
      status: 'read_error',
      message: `event_type_vocab(${eventType}): ${error.message}`,
    };
  }

  const stored = (data as { ai_price_tier?: string | null } | null)?.ai_price_tier ?? null;

  // An unrecognised value must never be cast into the band type and charged.
  // It falls back like an absent one, so a typo in the column cannot invent a
  // price — it degrades to the locked ladder instead.
  if (typeof stored === 'string' && BANDS.has(stored)) {
    return { status: 'resolved', band: stored as AiPriceTier, source: 'owner' };
  }

  return {
    status: 'resolved',
    band: setnayanAiTierForEventType(eventType),
    source: 'fallback',
  };
}
