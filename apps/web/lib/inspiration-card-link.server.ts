import 'server-only';

/**
 * lib/inspiration-card-link.server.ts — the reads behind "Which of your services is this?" (owner 2026-10-30, the
 * "CONNECTED FOUR WAYS" row, item 1). The rules live in `lib/inspiration-card-link.ts`; this only reads the shop's own
 * cards and hands them to those rules.
 *
 * 🔑 THE CLIENT IS PASSED IN, AND IS ALWAYS SCOPED BY A SHOP THE CALLER ALREADY PROVED. The library actions pass the
 * service-role client with the shop `requireLibraryAccess` resolved; the suggestion action passes it with the shop the
 * SQL door (`vendor_begin_inspiration_suggestion`) proved is the caller's own booked shop. Never a shop id the browser
 * sent.
 *
 * 🔑 A FAILED READ IS `null`, NEVER `[]`. `[]` means "this shop has no card for that part" and the dropdown then offers
 * only "None of these"; a refused read drawn that way would quietly file every photo to the shop only.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { canonicalServicesForSlot } from '@/lib/moodboard-gallery';
import type { InspirationPartsSnapshot } from '@/lib/inspiration-parts';
import { displayServiceLabel } from '@/lib/vendors';
import { formatPhpRounded } from '@/lib/php';
import { cardChoicesByPart, cardVerdict, type CardChoice, type CardVerdict, type ShopCardRow } from '@/lib/inspiration-card-link';

const CARD_COLUMNS = 'vendor_service_id, title, category, starting_price_php, is_active, is_linked_only';

/** Every card of ONE shop (live or not — the rules decide). `null` = the read failed. */
export async function readShopCards(client: SupabaseClient, vendorProfileId: string): Promise<ShopCardRow[] | null> {
  const { data, error } = await client
    .from('vendor_services')
    .select(CARD_COLUMNS)
    .eq('vendor_profile_id', vendorProfileId)
    .order('created_at', { ascending: true });
  if (error) {
    logQueryError('inspirationCardLink.readShopCards', error, { vendorProfileId }, 'graceful_degrade');
    return null;
  }
  return (data ?? []) as ShopCardRow[];
}

/** A card's name the way every couple-facing card names it: its title, else its service's label. */
export function cardLabel(row: Pick<ShopCardRow, 'title' | 'category'>): string {
  return row.title?.trim() || (row.category ? displayServiceLabel(row.category) : 'Service');
}

/** "from ₱X" — the supplier's own dropdown; null when no price is set. */
export function cardPriceLabel(row: Pick<ShopCardRow, 'starting_price_php'>): string | null {
  return row.starting_price_php !== null && row.starting_price_php > 0 ? `from ${formatPhpRounded(row.starting_price_php)}` : null;
}

/** The dropdown's choices for every part a sheet offers. `null` = the cards could not be read (said by the sheet). */
export async function shopCardChoices(
  client: SupabaseClient,
  vendorProfileId: string,
  slots: readonly string[],
  parts: InspirationPartsSnapshot,
): Promise<Record<string, CardChoice[]> | null> {
  return cardChoicesByPart({
    slots,
    shopCards: await readShopCards(client, vendorProfileId),
    servicesForSlot: (slot) => canonicalServicesForSlot(slot, parts),
    labelOf: cardLabel,
    priceOf: cardPriceLabel,
  });
}

/**
 * 🛑 THE SERVER'S CHECK. The card the browser sent must be one of THIS shop's live cards whose Service links the part —
 * re-read here, never trusted as sent. The database holds the same line (trigger `inspiration_card_is_the_shops_own`,
 * migration 20271297295494); this check is what turns a refusal into words the supplier can act on.
 */
export async function verifyCardForPart(
  client: SupabaseClient,
  input: { vendorProfileId: string; slotKey: string; requested: string | null | undefined; parts: InspirationPartsSnapshot },
): Promise<CardVerdict> {
  if (!(input.requested ?? '').trim()) return { ok: true, vendorServiceId: null };
  return cardVerdict({
    requested: input.requested,
    shopCards: await readShopCards(client, input.vendorProfileId),
    partServices: canonicalServicesForSlot(input.slotKey, input.parts),
  });
}
