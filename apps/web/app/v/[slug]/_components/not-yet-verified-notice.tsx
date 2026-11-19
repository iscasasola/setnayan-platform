import { ShieldAlert } from 'lucide-react';
import { InlineNotice } from '@/app/_components/notices/inline-notice';
import { NOT_YET_VERIFIED_INFO, NOT_YET_VERIFIED_LINE } from '@/lib/findable-shop';
import { RENEWING_COUPLE_LINE, RENEWING_COUPLE_MARK } from '@/lib/papers-renewal';

/**
 * 🔔 Inventory #42 — a LIVE notice (info) in the one notice system (owner approved 14 Nov 2026): no close; it leaves
 * when the shop is verified. Same words, same ⓘ (`lib/findable-shop.ts`), drawn where it stands at the top of the calm
 * column.
 */
export function NotYetVerifiedNotice({ renewing = false }: { renewing?: boolean } = {}) {
  // 📄 Papers renewal ruling (4): a shop verified BEFORE whose papers lapsed says it is renewing, not "not verified".
  const title = renewing ? RENEWING_COUPLE_MARK : NOT_YET_VERIFIED_LINE;
  return (
    <section aria-label={title} data-not-yet-verified className="mb-6" data-renewing={renewing ? '' : undefined}>
      <InlineNotice
        kind="live"
        tone="warning"
        closable={false}
        noticeKey={renewing ? 'shop-renewing' : 'shop-not-verified'}
        mark={<ShieldAlert aria-hidden className="h-5 w-5 shrink-0 text-warn-800" strokeWidth={1.75} />}
        title={title}
        detail={renewing ? RENEWING_COUPLE_LINE : NOT_YET_VERIFIED_INFO}
      />
    </section>
  );
}
