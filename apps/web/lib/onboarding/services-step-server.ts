/**
 * services-step-server.ts — the LIVE reader behind the onboarding services step.
 *
 * The server half of `services-step-data.ts`, split out so the pure half stays
 * importable from the two client onboarding wizards without dragging
 * `createAdminClient` into a browser bundle. Everything server-only lives here:
 * the catalog fetch, the three admin-editable Papic columns, the event-type
 * profile, and the Setnayan AI price resolver.
 *
 * ── THE ONE RULE: NOTHING HERE IS A LITERAL ──────────────────────────────────
 * Every figure the card can print is read at request time:
 *   • Pool rung points   → papic_pass_tiers          (lib/papic-pass-tiers.ts)
 *   • One rung points    → papic_one_tiers           (lib/papic-one.ts)
 *   • Every rung price   → platform_retail_catalog_v2 (active rows only)
 *   • Free pool points   → papic_event_pool_config.free_grant_points
 *   • Free One points    → papic_event_pool_config.free_one_camera_points
 *   • Photo / clip weight→ lib/papic-cameras.ts constants, via papic-tier-copy
 *   • Setnayan AI price  → the type's tier SKU, via resolveSetnayanAiTypePricePhp
 * A rung whose tier row is inactive, or whose catalog price is missing/inactive,
 * DISAPPEARS from the ladder rather than rendering at a stale or invented price.
 * That degradation is the point: the couple sees a shorter true ladder, never a
 * fake door. (Same doctrine as /pricing's "never hardcode a missing SKU".)
 *
 * ── THE SETNAYAN AI GATE ─────────────────────────────────────────────────────
 * Two independent checks, both required (BUILD SPEC § 0). They fail closed on
 * different axes: `marketplaceEnabled` catches a FUTURE vendor-free type that
 * nobody remembered to tier, while the SKU check catches a type with no sellable
 * row. A brand-new type defaults to tier C — which HAS a SKU — so the SKU check
 * alone would wrongly offer the assistant on a vendor-free event, where all nine
 * of its capabilities (rank vendors, route the first inquiry, chase the quiet
 * ones, flag their payments) would be fake doors.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { fetchV2CustomerCatalog } from '@/lib/v2-catalog';
import {
  readPapicOneTiers,
  readPapicPassTiers,
  readPapicFreeGrantPoints,
  readPapicFreeOneCameraPoints,
} from '@/lib/papic-tier-config-read';
import { resolveSetnayanAiDisplayPricePhp } from '@/lib/setnayan-ai-server';
import { setnayanAiTierSkuForEventType } from '@/lib/setnayan-ai-type-pricing';
import { resolveProfile } from '@/lib/event-type-profile';
import { buildServicesStepView, type ServicesStepView } from './services-step-data';

/**
 * The live view-model for one event type. Server-only (it reads the catalog with
 * an admin client under the hood) and never throws — every reader it calls
 * degrades on its own, so the worst case is a card with a shorter ladder.
 *
 * @param client a request-scoped Supabase client, used ONLY for the Setnayan AI
 *   catalog read — mirroring how the AI studio resolves the very price this card
 *   quotes, so the card and its destination can never disagree.
 */
export async function readServicesStepView(
  client: SupabaseClient,
  eventType: string,
): Promise<ServicesStepView> {
  const profile = await resolveProfile(eventType);

  // BOTH gate checks, before we spend a query on a price we will not show.
  const aiOffered =
    profile.marketplaceEnabled === true &&
    setnayanAiTierSkuForEventType(eventType) !== null;

  const [customerSkus, poolTiers, oneTiers, freePoolPoints, freeOnePoints, aiPricePhp] =
    await Promise.all([
      fetchV2CustomerCatalog(),
      readPapicPassTiers(),
      readPapicOneTiers(),
      readPapicFreeGrantPoints(),
      readPapicFreeOneCameraPoints(),
      aiOffered
        ? // 🔴 THROUGH THE SHARED RESOLVER, IN ONBOARDING CONTEXT. This used to
          // call the raw per-type resolver directly and UNGATED — the exact
          // shape of the bug `setnayan-ai-price-display-matches-charge.test.ts`
          // was written for on the studio page, sitting unnoticed on this one
          // because the guard only ever covered that other screen. With the
          // per-type model switched off, this card showed a tier price while
          // checkout charged the flat row.
          resolveSetnayanAiDisplayPricePhp(client, eventType, 'onboarding').catch(
            () => 0,
          )
        : Promise.resolve(0),
    ]);

  const pricePhpByCode = new Map<string, number>(
    customerSkus.map((s) => [s.service_code, Number(s.retail_price_php)]),
  );

  return buildServicesStepView({
    eventWord: profile.terminology.eventWord,
    poolTiers,
    oneTiers,
    pricePhpByCode,
    freePoolPoints,
    freeOnePoints,
    aiPricePhp: aiOffered ? aiPricePhp : null,
  });
}
