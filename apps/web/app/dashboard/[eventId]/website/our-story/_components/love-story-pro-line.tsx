import Link from 'next/link';
import { NOTICE_ACTION } from '@/app/_components/notices/notices';
import { InlineNotice } from '@/app/_components/notices/inline-notice';
import { LOVE_STORY_PRO_CTA, LOVE_STORY_PRO_LINE } from '@/lib/love-story-moments';

/**
 * THE ONE QUIET LINE — owner 2026-09-25, verbatim ruling: a sixth story or any
 * photo shows *"Add more stories and your photos · Go Event Hub Pro"*, opening
 * the existing Pro offer (`/studio/website-pro`, the same `ctaPath`
 * `resolveHubProOffer` hands the Maker). Nothing else in Love Story is locked,
 * dimmed or badged.
 *
 * ⛔ THE STORE SHELL GETS THE WORDS AND NOTHING ELSE — no link, no button, no ₱
 * (App Review 3.1.1; `lib/store-shell.ts`). The price is never typed here: it
 * arrives formatted from `platform_retail_catalog_v2`, or is null and omitted.
 */
export function LoveStoryProLine({
  storeShell,
  href,
  price,
}: {
  storeShell: boolean;
  href: string;
  price: string | null;
}) {
  if (storeShell) {
    return (
      <p data-love-story-pro-line="shell" className="mt-1 text-[14px] text-[color:var(--ls-muted)]">
        {LOVE_STORY_PRO_LINE}
      </p>
    );
  }
  // 🔔 Inventory #28 — Event Hub Pro: ONE offer line, used in three places (one notice system, owner approved 14 Nov
  // 2026: #26–28 "Merge"). ◆, the catalog price, "Not now" (back after 30 days), drawn where it stands (InlineNotice), inside what it explains.
  return (
    <InlineNotice
      kind="offer"
      noticeKey="hub-pro:our-story"
      title={LOVE_STORY_PRO_LINE}
      actions={
        <Link href={href} className={NOTICE_ACTION} data-love-story-pro-line="web">
          {LOVE_STORY_PRO_CTA}
          {price ? ` · ${price}` : ''}
        </Link>
      }
    />
  );
}
