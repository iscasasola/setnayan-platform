import Link from 'next/link';
import { Trophy, BarChart3, TrendingUp, ArrowRight } from 'lucide-react';
import {
  AWARD_LABELS,
  AWARD_BLURBS,
  type SpotlightAwardType,
} from '@/lib/spotlight-awards';

/**
 * SpotlightAwardBanner — "You earned a Spotlight Award" banner on the vendor
 * dashboard HOME. Shown only to vendors who hold at least one award in the
 * current period (the parent page passes the award types in; an empty list
 * renders nothing). A celebratory, brand-voice nudge — no engineering jargon.
 *
 * The awards come from `vendor_spotlight_awards` (public-read), fetched by the
 * vendor's own session client in the dashboard loader. This component is pure
 * presentation.
 */

const AWARD_ICON: Record<SpotlightAwardType, React.ReactNode> = {
  top_pick: <Trophy className="h-4 w-4" strokeWidth={2} aria-hidden />,
  most_booked: <BarChart3 className="h-4 w-4" strokeWidth={2} aria-hidden />,
  rising: <TrendingUp className="h-4 w-4" strokeWidth={2} aria-hidden />,
};

// Stable display order: Top Pick → Most Booked → Rising.
const ORDER: SpotlightAwardType[] = ['top_pick', 'most_booked', 'rising'];

export function SpotlightAwardBanner({ awards }: { awards: SpotlightAwardType[] }) {
  if (!awards || awards.length === 0) return null;

  const sorted = [...new Set(awards)].sort(
    (a, b) => ORDER.indexOf(a) - ORDER.indexOf(b),
  );
  const lead = sorted[0]!;

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-[color:var(--m-champagne,#caa45a)]/40 bg-gradient-to-br from-[#fdf6e9] to-[#faf0db] p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/70 text-[color:var(--m-orange-2,#b5762e)] ring-1 ring-[color:var(--m-champagne,#caa45a)]/40">
          <Trophy className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="space-y-1">
            <p className="sn-eye text-[color:var(--m-orange-2,#b5762e)]">
              Spotlight Award
            </p>
            <h2 className="text-lg font-semibold tracking-tight text-ink">
              You earned a Spotlight Award this month
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {sorted.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-[color:var(--m-orange-2,#b5762e)] ring-1 ring-[color:var(--m-champagne,#caa45a)]/40"
              >
                {AWARD_ICON[t]}
                {AWARD_LABELS[t]}
              </span>
            ))}
          </div>
          <p className="max-w-prose text-sm text-ink/75">{AWARD_BLURBS[lead]}</p>
          <Link
            href="/explore"
            className="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--m-orange-2,#b5762e)] hover:underline"
          >
            See how couples discover you
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
