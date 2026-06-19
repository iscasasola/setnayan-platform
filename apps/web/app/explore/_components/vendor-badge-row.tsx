/**
 * Vendor badge row — renders the 4 trust badges from the
 * 2026-05-22 owner directive. Server component (no interactive state).
 *
 * Color scheme per the brief:
 *   - `new`           — terracotta tint + Sparkles icon
 *   - `verified`      — emerald tint + CheckCircle icon
 *   - `most_booking`  — gold tint + TrendingUp icon
 *   - `top_pick`      — burgundy tint + Award icon
 *
 * Tooltip strategy uses the native `title` attribute — keyboard +
 * screen-reader accessible without a JS popover library. The tooltip
 * explains what the badge MEANS so couples scanning the grid
 * understand why they're seeing it. Brand-voice copy stays calm +
 * polite per [[feedback_setnayan_no_dev_text_post_launch]].
 *
 * Order: badges always render in the same order so the visual
 * scan-pattern is consistent across cards. Vendors with stacked
 * badges still read left-to-right in the locked order. Computation
 * in `lib/vendor-badges.ts` returns badges in the right order so
 * this component just renders the array.
 */

import type { LucideIcon } from 'lucide-react';
import { Sparkles, CheckCircle, TrendingUp, Award } from 'lucide-react';
import type { VendorBadge } from '@/lib/vendor-badges';

type BadgeMeta = {
  label: string;
  tooltip: string;
  icon: LucideIcon;
  classes: string;
};

const BADGE_META: Record<VendorBadge, BadgeMeta> = {
  new: {
    label: 'New',
    tooltip:
      'Newly verified vendor — joined Setnayan in the last 3 months.',
    icon: Sparkles,
    classes:
      'border-terracotta/30 bg-terracotta/10 text-terracotta-700',
  },
  verified: {
    label: 'Verified',
    tooltip:
      'Setnayan checked this vendor — DTI, BIR, and contact details on file.',
    icon: CheckCircle,
    classes:
      'border-success-300/50 bg-success-50 text-success-900',
  },
  most_booking: {
    label: 'Most Booked',
    tooltip:
      'Among the top 10% of verified vendors by completed weddings this year.',
    icon: TrendingUp,
    // Soft amber/gold so it stays distinct from the Sponsored ad
    // accent (which uses a saturated amber-400 fill in the card
    // border). The badge sits inside the card; the ad accent sits
    // on the card border, so the two never visually clash.
    classes:
      'border-warn-300/60 bg-warn-50 text-warn-900',
  },
  top_pick: {
    label: 'Top Pick',
    tooltip:
      "Setnayan's pick of the month — top 5% by review score and volume.",
    icon: Award,
    // No `burgundy` token in apps/web/tailwind.config.ts; use rose-tinted
    // tokens for the deep prestige read. Matches the editorial palette
    // and stays distinct from the gold "Most Booked" and emerald
    // "Verified" rows.
    classes:
      'border-danger-300/60 bg-danger-50 text-danger-900',
  },
};

export function VendorBadgeRow({
  badges,
}: {
  badges: ReadonlyArray<VendorBadge>;
}) {
  if (badges.length === 0) return null;
  return (
    <ul
      aria-label="Vendor trust badges"
      className="flex flex-wrap gap-1.5"
    >
      {badges.map((key) => {
        const meta = BADGE_META[key];
        const Icon = meta.icon;
        return (
          <li
            key={key}
            title={meta.tooltip}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] ${meta.classes}`}
          >
            <Icon className="h-3 w-3" strokeWidth={2} aria-hidden />
            {meta.label}
          </li>
        );
      })}
    </ul>
  );
}
