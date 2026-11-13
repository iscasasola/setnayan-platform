import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Notice, NOTICE_ACTION } from '@/app/_components/notices/notices';

/**
 * Advisory nudge shown on the date-selection surfaces for Chinese (Tsinoy)
 * weddings — primary OR overlay (gate on `isChineseWedding` at the call site).
 *
 * LOCKED posture (Chinese_Wedding_Traditions_Reference_2026-06-28 §2.3): BaZi /
 * Four Pillars is ADVISORY + delegate-to-a-specialist. We explain it and point
 * the couple to a real reader — we NEVER compute a compatibility/clash verdict
 * or a date "score". Server component (no hooks) so any surface can mount it.
 *
 * The closing line deep-links to the `date_fengshui_consultant` marketplace
 * leaf via the same `/explore?category=…` target the /paperwork guide uses,
 * so both Chinese surfaces route the couple to the same real specialist.
 */
/**
 * 🔔 Inventory #25 — an OFFER (one notice system, owner approved 14 Nov 2026): ◆ "Consult a date specialist ⓘ · Find a
 * specialist · Not now", at the end of the page. The Four Pillars note is behind the ⓘ.
 */
export function ChineseSpecialistNudge() {
  return (
    <Notice
      kind="offer"
      noticeKey="date-specialist"
      title="Consult a date specialist"
      detail="A note for your Chinese tradition: many Tsinoy families settle the date with a Four Pillars (BaZi) reading, which weighs each partner's birth date and time of birth. It is a blessing a Chinese-almanac or feng-shui specialist gives, not something we calculate for you — gather both birth details if you would like that reading on your date."
      actions={
        <Link href="/explore?category=date_fengshui_consultant" className={NOTICE_ACTION}>
          <Compass className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
          Find a date / feng-shui specialist
        </Link>
      }
    />
  );
}
