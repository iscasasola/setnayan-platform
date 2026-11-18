import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readBadgeRewardFacts } from '@/lib/badge-rewards.server';
import { readShopSeals } from '@/lib/shop-seals.server';
import type { ShopBadgeFacts } from '@/lib/shop-badges';
import { printBadgesV84, type PrintBadge } from '@/lib/print-badges-v84';

/**
 * 🖨 THE PRINT BADGES, READ ON THE SERVER — the one place a print route learns what the shop wears today. Every print
 * surface (the badges file, the seven prints, the door sticker) calls this and then `resolvePrintBadgeArt`
 * (`lib/print-badge-art.ts`); none composes badges of its own. 🔒 lib/prints-wear-only-v84-badges.test.ts
 */

/**
 * What a print wears TODAY: the reward engine's counts (the Shop › Badges shelf's own read) and the shop's seals, read
 * beside each other. A failed read prints nothing of that kind — never a guess (`printBadgesV84`).
 */
export async function readPrintBadges(admin: SupabaseClient, vendorProfileId: string, facts: ShopBadgeFacts): Promise<PrintBadge[]> {
  const [counts, seals] = await Promise.all([
    readBadgeRewardFacts(admin, vendorProfileId, facts).catch((err) => {
      console.error('[print-badges] reward counts unread', err);
      return null;
    }),
    readShopSeals(vendorProfileId, facts.verified).catch(() => null),
  ]);
  return printBadgesV84({ verified: facts.verified, counts, seals: seals?.rows ?? null });
}
