import Link from 'next/link';
import { ArrowRight, Compass } from 'lucide-react';

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
export function ChineseSpecialistNudge() {
  return (
    <div className="rounded-xl border border-terracotta/20 bg-terracotta/[0.04] p-5">
      <div className="flex items-start gap-3">
        <Compass
          aria-hidden
          className="mt-0.5 h-4 w-4 flex-shrink-0 text-terracotta"
          strokeWidth={1.75}
        />
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
            A note for your Chinese tradition
          </p>
          <p className="text-sm leading-relaxed text-ink/75">
            Many Tsinoy families settle the date with a Four Pillars (BaZi) reading,
            which weighs each partner&apos;s birth date and time of birth. It is a
            blessing a Chinese-almanac or feng-shui specialist gives, not something we
            calculate for you — gather both birth details if you would like that reading
            on your date.
          </p>
          <p className="text-xs text-ink/55">
            Consult a date specialist — a Chinese-almanac reader or feng-shui
            consultant whose families you trust can give that reading.
          </p>
          <Link
            href="/explore?category=date_fengshui_consultant"
            className="inline-flex items-center gap-2 rounded-md border border-terracotta/30 bg-cream px-3 py-2 text-sm font-medium text-terracotta-700 transition-colors hover:border-terracotta/50 hover:text-terracotta-800"
          >
            <Compass className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
            Find a date / feng-shui specialist
            <ArrowRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
