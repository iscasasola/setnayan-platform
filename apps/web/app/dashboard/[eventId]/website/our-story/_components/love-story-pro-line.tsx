import Link from 'next/link';
import { Sparkles } from 'lucide-react';
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
  return (
    <p data-love-story-pro-line="web" className="mt-1 flex flex-wrap items-center gap-x-2 text-[14px] text-[color:var(--ls-muted)]">
      <Sparkles aria-hidden className="h-3.5 w-3.5 text-[color:var(--ls-heading)]" strokeWidth={2} />
      <span>{LOVE_STORY_PRO_LINE}</span>
      <span aria-hidden>·</span>
      <Link href={href} className="font-medium text-[color:var(--ls-heading)] underline decoration-1 underline-offset-4">
        {LOVE_STORY_PRO_CTA}
        {price ? ` · ${price}` : ''}
      </Link>
    </p>
  );
}
