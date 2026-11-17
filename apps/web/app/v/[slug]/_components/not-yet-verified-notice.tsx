import { ShieldAlert } from 'lucide-react';
import { InlineNotice } from '@/app/_components/notices/inline-notice';
import { NOT_YET_VERIFIED_INFO, NOT_YET_VERIFIED_LINE } from '@/lib/findable-shop';

/**
 * 🔔 Inventory #42 — a LIVE notice (info) in the one notice system (owner approved 14 Nov 2026): no close; it leaves
 * when the shop is verified. Same words, same ⓘ (`lib/findable-shop.ts`), drawn where it stands at the top of the calm
 * column.
 */
export function NotYetVerifiedNotice() {
  return (
    <section aria-label={NOT_YET_VERIFIED_LINE} data-not-yet-verified className="mb-6">
      <InlineNotice
        kind="live"
        tone="warning"
        closable={false}
        noticeKey="shop-not-verified"
        mark={<ShieldAlert aria-hidden className="h-5 w-5 shrink-0 text-warn-800" strokeWidth={1.75} />}
        title={NOT_YET_VERIFIED_LINE}
        detail={NOT_YET_VERIFIED_INFO}
      />
    </section>
  );
}
