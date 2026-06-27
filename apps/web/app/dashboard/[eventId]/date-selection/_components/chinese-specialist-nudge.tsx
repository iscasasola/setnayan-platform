import { Compass } from 'lucide-react';

/**
 * Advisory nudge shown on the date-selection surfaces for Chinese (Tsinoy)
 * weddings — primary OR overlay (gate on `isChineseWedding` at the call site).
 *
 * LOCKED posture (Chinese_Wedding_Traditions_Reference_2026-06-28 §2.3): BaZi /
 * Four Pillars is ADVISORY + delegate-to-a-specialist. We explain it and point
 * the couple to a real reader — we NEVER compute a compatibility/clash verdict
 * or a date "score". Server component (no hooks) so any surface can mount it.
 *
 * TODO: deep-link the closing line to the `date_fengshui_consultant` vendor
 * leaf once that leaf lands (a later PR). Until then it stays advisory copy,
 * never a route, so we never ship a broken link.
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
            Consult a date specialist — look for a Chinese-almanac reader or feng-shui
            consultant whose families you trust.
          </p>
        </div>
      </div>
    </div>
  );
}
