/**
 * roster-meters.tsx — the two meters, in one row.
 *
 * ⚖ Owner 2026-09-20, pointing at the shipped three-line block: *"we don't
 * have this anymore on the plan. how can we keep this?"*
 *
 * ── THEY STAY IN THE OPEN, AND THEY STAY TWO ───────────────────────────────
 * The obvious compression — fold these behind the guest count — is wrong:
 * they are the only numbers on the page that answer MONEY questions. "Have I
 * invited enough to fill the minimum I am paying for" and "have they answered"
 * are different questions with different answers, and one bar cannot carry
 * both. So: two meters, side by side, one row.
 *
 * ── WHAT IS COMPRESSIBLE IS THE THIRD LINE ─────────────────────────────────
 * The shipped "Pax pool — 151 unassigned · 79 of 230 listed" line restates the
 * space LEFT in the target bar. So the bar carries it instead, in three
 * segments that sum to the target:
 *
 *     [ headcount ── solid ][ listed − headcount ── pale ][ unassigned ── empty ]
 *
 * 🔑 NOTHING HERE IS A NEW NUMBER. Every value is a field `PaxProgress`
 * already computes, read as its docblock defines it: `headcount` is the SURE-
 * ATTENDING count — the owner-locked pricing basis — and `listed` is total
 * minus declined, which that type is explicit is DISPLAY-ONLY. Attending is a
 * subset of listed, so `listed − headcount` is the still-unconfirmed and can
 * never be negative in data; it is floored anyway, because a bar segment with
 * a negative width is a layout bug that renders as nothing and says nothing.
 *
 * 🔑 THE COPY IS VERBATIM: "Guest target" · "Now planning for" ·
 * "Confirmations" · "not loaded". The honest "not loaded" matters most: on a
 * refused read, "0 of 0 responded · 0%" would be the most confident sentence
 * on the page and pure invention.
 *
 * Presentational only — no hooks, no I/O — so it renders to static markup and
 * can be measured.
 */

import type { PaxProgress } from '@/lib/guests';

export type MeterStats = {
  total: number;
  attending: number;
  maybe: number;
  declined: number;
  pending: number;
  plus_ones: number;
};

const pctOf = (n: number, of: number) => (of > 0 ? Math.max(0, Math.min(100, (n / of) * 100)) : 0);

export function RosterMeters({
  paxProgress,
  stats,
  measured,
}: {
  paxProgress: PaxProgress | null;
  stats: MeterStats;
  /** False when the guest read was refused — the meters then say so. */
  measured: boolean;
}) {
  const responded = stats.attending + stats.maybe + stats.declined;
  const repliedPct = stats.total > 0 ? Math.round((responded / stats.total) * 100) : 0;

  return (
    // One row where there is room; on a phone the two stack, because a number
    // squeezed to four characters is worse than a second line.
    <div className="flex flex-col gap-x-6 gap-y-2 border-b border-ink/[0.07] py-2.5 sm:flex-row sm:items-center">
      {paxProgress ? <TargetMeter p={paxProgress} /> : null}

      <Meter
        label="Confirmations"
        numbers={
          measured ? (
            <>
              {responded} of {stats.total} · {repliedPct}%
              {stats.plus_ones > 0 ? ` · ${stats.plus_ones} plus-one${stats.plus_ones === 1 ? '' : 's'}` : ''}
            </>
          ) : (
            'not loaded'
          )
        }
        ariaLabel={
          measured
            ? `${responded} of ${stats.total} guests have responded (${stats.attending} attending, ${stats.maybe} maybe, ${stats.declined} declined, ${stats.pending} pending)`
            : 'Responses could not be loaded'
        }
        segments={
          measured
            ? [
                { w: pctOf(stats.attending, stats.total), cls: 'bg-success-400' },
                { w: pctOf(stats.maybe, stats.total), cls: 'bg-warn-300' },
                { w: pctOf(stats.declined, stats.total), cls: 'bg-danger-300' },
              ]
            : []
        }
      />
    </div>
  );
}

function TargetMeter({ p }: { p: PaxProgress }) {
  // Exceeded: the bar is full and the headline turns to what is being planned
  // for, in the darker gold — the shipped meter's behaviour, kept.
  if (p.exceeded) {
    return (
      <Meter
        label="Now planning for"
        accent
        numbers={
          <>
            {p.headcount} guests · {p.overBy} over your {p.target} minimum
          </>
        }
        ariaLabel={`Now planning for ${p.headcount} attending guests, ${p.overBy} over the ${p.target} minimum pax`}
        segments={[{ w: 100, cls: 'bg-terracotta-700' }]}
      />
    );
  }
  const solid = pctOf(p.headcount, p.target);
  const pale = Math.max(0, Math.min(100 - solid, pctOf(p.listed - p.headcount, p.target)));
  return (
    <Meter
      label="Guest target"
      accent
      numbers={
        <>
          {p.headcount} of {p.target} pax ·{' '}
          {p.overListed > 0 ? `${p.listed} listed, ${p.overListed} over` : `${p.listed} listed`}
        </>
      }
      // The unassigned pool lives in the sentence a screen reader hears and in
      // the tooltip — the one fact that is shown by the empty tail, not printed.
      ariaLabel={`${p.headcount} attending of a ${p.target} minimum pax target, ${p.progressPct}%. ${p.listed} listed, ${
        p.overListed > 0 ? `${p.overListed} over the target` : `${p.unassigned} seats still unassigned`
      }.`}
      title={p.overListed > 0 ? `${p.overListed} listed over your ${p.target}` : `${p.unassigned} still to invite`}
      segments={[
        { w: solid, cls: 'bg-terracotta' },
        { w: pale, cls: 'bg-terracotta/30' },
      ]}
    />
  );
}

function Meter({
  label,
  numbers,
  ariaLabel,
  segments,
  accent = false,
  title,
}: {
  label: string;
  numbers: React.ReactNode;
  ariaLabel: string;
  segments: { w: number; cls: string }[];
  accent?: boolean;
  title?: string;
}) {
  return (
    // 🪤 `flex-wrap`, found by rendering it at 380px: the exceeded sentence
    // "162 guests · 12 over your 150 minimum" is `whitespace-nowrap`, and on a
    // phone it ran straight past the border. The copy is the owner's and stays
    // whole; when it has no room beside the bar it drops onto its own line
    // under it instead. On a desktop there is room, so nothing wraps.
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1" title={title}>
      <span
        className={`shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] ${
          accent ? 'text-terracotta-700' : 'text-ink/55'
        }`}
      >
        {label}
      </span>
      <div
        role="img"
        aria-label={ariaLabel}
        className="flex h-1.5 min-w-[3rem] flex-1 overflow-hidden rounded-full bg-ink/10"
      >
        {segments.map((s, i) => (
          <i key={i} className={`block h-full ${s.cls}`} style={{ width: `${s.w}%` }} />
        ))}
      </div>
      <span className="shrink-0 whitespace-nowrap font-mono text-[11px] tabular-nums text-ink/60">
        {numbers}
      </span>
    </div>
  );
}
