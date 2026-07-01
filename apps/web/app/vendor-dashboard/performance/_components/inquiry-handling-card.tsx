import { Clock, Timer, Coins, Inbox } from 'lucide-react';
import {
  formatMinutes,
  type InquiryAnalytics,
  type InquiryHeatCell,
} from '@/lib/vendor-inquiry-analytics';

/**
 * "Inquiry handling" — My Performance · Phase B family 1 (Pro tier). Four
 * own-business reads off ownership-gated RPCs:
 *   • reply-time tiles (median + 90th-percentile first reply)
 *   • token efficiency (tokens burned per booking won)
 *   • slipped-leads breakdown (declined / unanswered past SLA / no-response /
 *     waitlisted) — labelled as a floor, since "missed" is a derived judgment
 *   • a weekday × time-of-day heatmap of when couples message
 *
 * Server component — no client JS. Degrades to honest empty states when a new
 * vendor has no inquiries yet.
 */

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Display Monday-first, matching how most vendors read a week.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const BLOCKS = [
  { label: '12a', from: 0 },
  { label: '3a', from: 3 },
  { label: '6a', from: 6 },
  { label: '9a', from: 9 },
  { label: '12p', from: 12 },
  { label: '3p', from: 15 },
  { label: '6p', from: 18 },
  { label: '9p', from: 21 },
];

/** Sum heat cells into a [dow][block] grid + its peak (for intensity). */
function buildGrid(cells: InquiryHeatCell[]): { grid: number[][]; max: number } {
  const grid: number[][] = Array.from({ length: 7 }, () =>
    new Array<number>(8).fill(0),
  );
  for (const c of cells) {
    if (c.dow < 0 || c.dow > 6) continue;
    const block = Math.min(7, Math.max(0, Math.floor(c.hr / 3)));
    const row = grid[c.dow];
    if (!row) continue;
    row[block] = (row[block] ?? 0) + c.count;
  }
  const max = grid.reduce((m, row) => Math.max(m, ...row), 0);
  return { grid, max };
}

function Tile({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-5" style={{ borderColor: 'var(--m-line)' }}>
      <div className="mb-2 flex items-center gap-1.5" style={{ color: 'var(--m-slate)' }}>
        {icon}
        <span className="font-mono text-[11px] uppercase tracking-[0.15em]">{label}</span>
      </div>
      <p className="text-3xl font-semibold tabular-nums" style={{ color: 'var(--m-ink)' }}>
        {value}
      </p>
      <p className="mt-1 text-xs" style={{ color: 'var(--m-slate-3)' }}>
        {sub}
      </p>
    </div>
  );
}

export function InquiryHandlingCard({ data }: { data: InquiryAnalytics }) {
  const { reply, missed, tokens, heatmap } = data;
  const { grid, max } = buildGrid(heatmap);
  const hasHeat = max > 0;

  const tokensPerWon =
    tokens.tokensPerWon === null ? '—' : Math.round(tokens.tokensPerWon * 10) / 10 + '';

  const missedItems = [
    { label: 'Declined', value: missed.declined },
    { label: 'Unanswered · 48h+', value: missed.unansweredOverSla },
    { label: 'No response', value: missed.selfReportedNoResponse },
    { label: 'Waitlisted', value: missed.waitlisted },
  ];
  const missedTotal = missedItems.reduce((s, m) => s + m.value, 0);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold" style={{ color: 'var(--m-ink)' }}>
        Inquiry handling
      </h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile
          icon={<Clock className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
          label="Median reply"
          value={reply.answeredCount > 0 ? formatMinutes(reply.p50Minutes) : '—'}
          sub={
            reply.answeredCount > 0
              ? `Across ${reply.answeredCount} answered inquir${reply.answeredCount === 1 ? 'y' : 'ies'}`
              : 'No replies in this window yet'
          }
        />
        <Tile
          icon={<Timer className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
          label="90% within"
          value={reply.answeredCount > 0 ? formatMinutes(reply.p90Minutes) : '—'}
          sub={
            reply.answeredCount > 0
              ? '9 in 10 replies land inside this'
              : 'Reply to see your spread'
          }
        />
        <Tile
          icon={<Coins className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
          label="Tokens / booking"
          value={tokensPerWon}
          sub={
            tokens.unlockedEvents > 0
              ? `${Math.round(tokens.tokensBurned)} burned · ${tokens.wonEvents} won`
              : 'No tokens spent in this window'
          }
        />
      </div>

      {/* Slipped leads — honest floor, not a census. */}
      <div className="rounded-lg border bg-white p-5" style={{ borderColor: 'var(--m-line)' }}>
        <div className="mb-3 flex items-center gap-1.5" style={{ color: 'var(--m-slate)' }}>
          <Inbox className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          <span className="font-mono text-[11px] uppercase tracking-[0.15em]">
            Where leads slipped
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {missedItems.map((m) => (
            <div key={m.label}>
              <p className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--m-ink)' }}>
                {m.value}
              </p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--m-slate-3)' }}>
                {m.label}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px]" style={{ color: 'var(--m-slate-3)' }}>
          {missedTotal > 0
            ? 'A floor, not a full count — “unanswered” uses a 48-hour guide and “no response” is self-reported.'
            : 'No slipped leads flagged in this window.'}
        </p>
      </div>

      {/* When couples message — weekday × time-of-day heatmap. */}
      <div className="rounded-lg border bg-white p-5" style={{ borderColor: 'var(--m-line)' }}>
        <div className="mb-3 flex items-center gap-1.5" style={{ color: 'var(--m-slate)' }}>
          <span className="font-mono text-[11px] uppercase tracking-[0.15em]">
            When couples message you
          </span>
        </div>
        {hasHeat ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1 pl-9">
              {BLOCKS.map((b) => (
                <span
                  key={b.label}
                  className="flex-1 text-center font-mono text-[9px]"
                  style={{ color: 'var(--m-slate-3)' }}
                >
                  {b.label}
                </span>
              ))}
            </div>
            {DAY_ORDER.map((d) => (
              <div key={d} className="flex items-center gap-1">
                <span
                  className="w-8 font-mono text-[10px]"
                  style={{ color: 'var(--m-slate)' }}
                >
                  {DAY_LABELS[d]}
                </span>
                {(grid[d] ?? []).map((v, bi) => {
                  const intensity = max > 0 ? v / max : 0;
                  return (
                    <div
                      key={bi}
                      className="h-6 flex-1 rounded-sm"
                      title={`${DAY_LABELS[d] ?? ''} ${BLOCKS[bi]?.label ?? ''}: ${v} inquir${v === 1 ? 'y' : 'ies'}`}
                      style={{
                        background:
                          v === 0
                            ? 'var(--m-paper)'
                            : `color-mix(in srgb, var(--m-orange-2) ${Math.round(20 + intensity * 80)}%, var(--m-paper))`,
                        border: '0.5px solid var(--m-line)',
                      }}
                    />
                  );
                })}
              </div>
            ))}
            <p className="pt-1 text-[11px]" style={{ color: 'var(--m-slate-3)' }}>
              Darker = more inquiries arrive then · times shown in Philippine time
            </p>
          </div>
        ) : (
          <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
            Not enough inquiries yet to show your busy times.
          </p>
        )}
      </div>
    </section>
  );
}
