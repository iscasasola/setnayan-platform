import type { SupabaseClient } from '@supabase/supabase-js';
import { CARD_ORDER } from '@/app/vendor-dashboard/performance/_components/analytics-cards';
import { SHOP_BADGE_FAMILIES } from './public-badges';
import { SUPPLIER_QR_MODES } from './supplier-qr-codes';
import { PRINT_DESIGNS, PRINT_PIECES } from './supplier-prints';
import { SPECIALIZED_TOOLS, listedWidgets } from './specialized-tools';
import { HUB_TOOL_LIBRARY } from './hub-tools';
import { AVAILABILITY_STYLES, CARD_STYLES_COMING_SOON } from './availability-styles';

/**
 * supplier-toolkit-count.ts — THE ONE READER AND THE ONE FORMATTER of how many tools and templates a supplier gets
 * (owner, 23 Nov 2026: "put 390+ tools and templates on /for-suppliers"; then "Should be adaptive to a rounded off
 * number. So when we add a toolkit, it adapts to itself"). First drafted in closed #8249.
 *
 * The count is never typed. `toolkitTotal` adds up what the app ships, each item ONCE:
 *   · the starting "What's included" card templates the admin keeps (`service_included_templates`, read live by
 *     `readCardTemplateCount`, so a template the admin adds moves the count);
 *   · the Toolkit's widgets as a shop sees them with the Papic camera's switch OFF (`listedWidgets(false)`), plus the
 *     shipped `HUB_TOOL_LIBRARY` tools that are not one of them (a hub tool that IS a widget, by `hubKeys`, counts once);
 *   · the graphs (`CARD_ORDER`), the shop badge families, the QR modes, the print designs and pieces;
 *   · the availability styles a card can pick today.
 * Left out, so the figure stays a floor: payment splits (their presets live in a client component), scanner modes,
 * quick replies, status presets and table shapes.
 *
 * `toolkitClaim` rounds the total DOWN to the nearest 10 and adds "+" (394 → "390+", 401 → "400+"); never up. A few
 * items are paid widgets (Cake Maker, Song bank, Papic challenge, 3D plan), so the line never says "free".
 * /for-suppliers shows THIS count and no other total. `app/for-suppliers/the-toolkit-claim-is-true.test.ts` runs the
 * same reader on the seeded templates and fails if the honest total falls under `TOOLKIT_CLAIM_FLOOR`.
 */

/** The lowest honest total the page may stand on (the owner's "390+"); the guard holds the shipped seed above it. */
export const TOOLKIT_CLAIM_FLOOR = 390;

/** Everything the code ships, by part — the card templates are the one part read from the database. */
export function toolkitCodeParts() {
  const counted = new Set<string>();
  for (const t of SPECIALIZED_TOOLS) {
    counted.add(t.key);
    for (const k of t.hubKeys) counted.add(k);
  }
  return {
    widgets: listedWidgets(false).length,
    otherShippedHubTools: HUB_TOOL_LIBRARY.filter((t) => t.shipped && !counted.has(t.key)).length,
    graphs: CARD_ORDER.length,
    badgeFamilies: SHOP_BADGE_FAMILIES.length,
    qrModes: SUPPLIER_QR_MODES.length,
    printDesigns: PRINT_DESIGNS.length,
    printPieces: PRINT_PIECES.length,
    availabilityStyles: AVAILABILITY_STYLES.filter((s) => !CARD_STYLES_COMING_SOON.has(s.value)).length,
  };
}

/** The honest total: the card templates plus every code part. `null` templates (an unread count) = no total. */
export function toolkitTotal(cardTemplates: number | null): number | null {
  if (cardTemplates == null || !Number.isFinite(cardTemplates) || cardTemplates < 0) return null;
  return cardTemplates + Object.values(toolkitCodeParts()).reduce((a, b) => a + b, 0);
}

/** "400+ tools and templates" — the total rounded DOWN to the nearest 10, then "+". No total = no words (never 0+). */
export function toolkitClaim(total: number | null): string | null {
  if (total == null || !Number.isFinite(total) || total < 10) return null;
  return `${Math.floor(total / 10) * 10}+ tools and templates`;
}

/** How many starting card templates the admin keeps; `null` when the count was refused (never 0). */
export async function readCardTemplateCount(db: SupabaseClient): Promise<number | null> {
  const { count, error } = await db.from('service_included_templates').select('template_id', { count: 'exact', head: true });
  if (error || count == null) {
    if (error) console.error('[supabase-error] lib/supplier-toolkit-count.ts · from:service_included_templates.count', error);
    return null;
  }
  return count;
}
