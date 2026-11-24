import type { SupabaseClient } from '@supabase/supabase-js';
import { SHELF_BADGE_KEYS } from './shop-badge-shelf';
import { formatCount } from './format-number';
import { toolkitCounts } from './supplier-store';
import { PRINT_DESIGNS, PRINT_PIECES } from './supplier-prints';
import { SPECIALIZED_TOOLS } from './specialized-tools';
import { HUB_TOOL_LIBRARY } from './hub-tools';
import { AVAILABILITY_STYLES, CARD_STYLES_COMING_SOON } from './availability-styles';

/**
 * supplier-toolkit-count.ts — THE ONE READER AND THE ONE FORMATTER of how many tools and templates a supplier gets
 * (owner, 23 Nov 2026: "put 390+ tools and templates on /for-suppliers"; then "Should be adaptive to a rounded off
 * number. So when we add a toolkit, it adapts to itself"; specs DECISION_LOG 2026-11-24 "The Toolkit count follows the
 * real total, rounded down"). First drafted in closed #8249; re-cut onto main's Toolkit port in place of #8255.
 *
 * The count is never typed. `toolkitTotal` adds up what the app ships, each item ONCE:
 *   · the Toolkit's own list, counted by its one reader (`toolkitCounts`, lib/supplier-store.ts) as a shop sees it
 *     with the Papic camera's switch OFF: the widgets, the payment-plan and availability templates, the QR designs,
 *     the graphs and the badges (the shelf's one list, `SHELF_BADGE_KEYS`: Verified + the five, as the Toolkit counts);
 *   · the starting "What's included" card templates the admin keeps (`service_included_templates`, read live by
 *     `readCardTemplateCount`, so a template the admin adds moves the count);
 *   · the shipped `HUB_TOOL_LIBRARY` tools that are not a widget (a hub tool that IS a widget, by `hubKeys`, counts
 *     once, as the widget);
 *   · the print designs and pieces, and the availability styles a card can pick today.
 * Left out, so the figure stays a floor: scanner modes, quick replies, status presets and table shapes.
 *
 * `toolkitClaim` rounds the total DOWN to the nearest 10 and adds "+" (394 → "390+", 401 → "400+", 1,234 → "1,230+", with commas by `formatCount`); never up. A few
 * items are paid widgets (Cake Maker, Song bank, Papic challenge, 3D plan), so the line never says "free".
 * /for-suppliers shows THIS count and no other total. `app/for-suppliers/the-toolkit-claim-is-true.test.ts` runs the
 * same reader on the seeded templates and fails if the honest total falls under `TOOLKIT_CLAIM_FLOOR`.
 */

/** The lowest honest total the page may stand on (the owner's "390+"); the guard holds the shipped seed above it. */
export const TOOLKIT_CLAIM_FLOOR = 390;

/** Everything the code ships, by part — the card templates are the one part read from the database. */
export function toolkitCodeParts() {
  const kit = toolkitCounts({ papicCapture: false, badges: SHELF_BADGE_KEYS });
  const widgetKeys = new Set<string>();
  for (const t of SPECIALIZED_TOOLS) {
    widgetKeys.add(t.key);
    for (const k of t.hubKeys) widgetKeys.add(k);
  }
  return {
    widgets: kit.widgets ?? 0,
    toolkitTemplates: kit.templates ?? 0,
    qrDesigns: kit.qr ?? 0,
    graphs: kit.graphs ?? 0,
    badges: kit.badges ?? 0,
    otherShippedHubTools: HUB_TOOL_LIBRARY.filter((t) => t.shipped && !widgetKeys.has(t.key)).length,
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
  return `${formatCount(Math.floor(total / 10) * 10)}+ tools and templates`;
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
