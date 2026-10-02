'use client';

import { useActionState, useState } from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import type { RowActionState } from '@/app/admin/pricing/actions';
import {
  PAPIC_ANCHOR_SHOTS,
  buildPapicLadder,
  ladderComplaints,
} from '@/lib/papic-anchor-ladder';
import {
  signupPriceFor,
} from '@/lib/onboarding-family-discount';
import { formatCount } from '@/lib/format-number';

export type PapicRungRow = {
  serviceCode: string;
  title: string;
  shots: number;
  regularPhp: number;
  signupPhp: number | null;
  isActive: boolean;
};

const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`;

/**
 * FIVE PRICES IN, SIXTEEN OUT.
 *
 * ⚠ THE ELEVEN COMPUTED RUNGS MUST READ AS RESULTS. They are rendered as plain
 * text on a tinted row with a padlock, never as an input — a computed price in a
 * box that looks editable is a field somebody types into and watches do nothing.
 *
 * 🔑 EVERYTHING RECOMPUTES AS HE TYPES, so the eleven move before he saves and
 * a bad anchor is visible immediately rather than after a write.
 */
export function PapicLadderEditor({
  rows,
  discountPct,
  saveLadderAction,
}: {
  rows: PapicRungRow[];
  /** THE one sign-up discount (owner d18) — set on the Pricing tab, read here. */
  discountPct: number;
  saveLadderAction: (prev: RowActionState, fd: FormData) => Promise<RowActionState>;
}) {
  const [ladderState, ladderFormAction] = useActionState<RowActionState, FormData>(
    saveLadderAction,
    { ok: false, message: null },
  );

  // Seeded from the live catalog rows, so what is on screen is what is charged.
  const [anchorPhp, setAnchorPhp] = useState<Record<number, string>>(() => {
    const seed: Record<number, string> = {};
    for (const shots of PAPIC_ANCHOR_SHOTS) {
      seed[shots] = String(rows.find((r) => r.shots === shots)?.regularPhp ?? '');
    }
    return seed;
  });

  /*
    🔴 CLEARING A BOX USED TO DELETE THE BOX. Owner 2026-08-29: *"when a number
    box becomes 0, that row disappears. that should not happen."*

    This filter is correct for the ARITHMETIC — a zero or blank anchor cannot
    set a rate — but its result was also feeding `buildPapicLadder`, which marks
    a rung `isAnchor` by asking whether the anchor set contains it. So emptying
    a field dropped that rung out of the anchor set, the row re-rendered as a
    locked "works itself out" line, and THE INPUT WAS GONE — with no way to type
    the value back short of reloading the page. Every rung beneath it blanked at
    the same time, because the rate that carried forward had vanished with it.

    🔑 WHETHER A RUNG IS AN ANCHOR IS A PROPERTY OF THE LADDER, NOT OF WHAT IS
    CURRENTLY TYPED. `PAPIC_ANCHOR_SHOTS` decides that, and it does not change
    while somebody edits. Only the PRICE is unknown while a box is empty.
  */
  const usableAnchors = PAPIC_ANCHOR_SHOTS.map(
    (shots) => [shots, Number(anchorPhp[shots])] as [number, number],
  ).filter(([, php]) => Number.isFinite(php) && php > 0);
  const anchors = usableAnchors;
  /** The rungs that own an input, whatever is currently in it. */
  const anchorShots = new Set<number>(PAPIC_ANCHOR_SHOTS);
  /** Anchors whose box is empty or zero — named, so the screen can say so. */
  const emptyAnchors = PAPIC_ANCHOR_SHOTS.filter(
    (shots) => !usableAnchors.some(([s]) => s === shots),
  );

  const allShots = rows.map((r) => r.shots);
  const ladder = buildPapicLadder(allShots, anchors);
  const complaints = anchors.length === PAPIC_ANCHOR_SHOTS.length ? ladderComplaints(ladder) : [];
  const phpByShots = new Map(ladder.map((r) => [r.shots, r.php]));

  const changedCount = rows.filter((r) => {
    const next = phpByShots.get(r.shots);
    return next != null && next !== r.regularPhp;
  }).length;

  return (
    <div>
      <p className="mb-5 max-w-prose text-sm leading-relaxed text-ink/70">
        Shots are sold against <strong>₱1 a shot</strong>, with a bulk saving that deepens as the
        number grows. You set <strong>five</strong> prices; the other eleven work themselves out
        from the nearest one below them. The At set-up column follows the one sign-up discount.
      </p>

      <form action={ladderFormAction}>
        <div className="overflow-hidden rounded-2xl border border-ink/10">
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-ink/10 bg-ink/[0.03] px-4 py-2.5 font-mono text-[9.5px] uppercase tracking-[0.15em] text-ink/55">
            <span>Shots</span>
            <span className="text-right">Regular price</span>
            <span className="text-right">Per shot</span>
            <span className="text-right">At set-up</span>
          </div>

          {ladder.map((rung) => {
            const row = rows.find((r) => r.shots === rung.shots);
            const stored = row?.regularPhp ?? null;
            const willMove = rung.php != null && stored != null && rung.php !== stored;
            // NOT `rung.isAnchor` — that follows what is typed, so an emptied
            // box would take its own input away. See the note on `anchors`.
            const ownsAnInput = anchorShots.has(rung.shots);
            const signup = rung.php != null ? signupPriceFor(rung.php, discountPct) : null;

            return (
              <div
                key={rung.shots}
                className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-ink/8 px-4 py-2.5 last:border-b-0 ${
                  ownsAnInput ? 'bg-cream' : 'bg-ink/[0.02]'
                }`}
              >
                <span className="flex items-center gap-2 text-[14px] font-semibold tabular-nums">
                  {rung.shots.toLocaleString('en-PH')}
                  {ownsAnInput ? (
                    <span className="rounded-full border border-gold/40 bg-gold/[0.14] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.11em] text-gold-deep">
                      you set this
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.11em] text-ink/45">
                      <Lock className="h-3 w-3" strokeWidth={2} aria-hidden />
                      works itself out
                    </span>
                  )}
                </span>

                <span className="w-32 text-right">
                  {ownsAnInput ? (
                    <span className="relative inline-block">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-ink/50">
                        ₱
                      </span>
                      <input
                        name={`anchor_${rung.shots}`}
                        type="number"
                        step="1"
                        min="1"
                        value={anchorPhp[rung.shots] ?? ''}
                        onChange={(e) =>
                          setAnchorPhp((p) => ({ ...p, [rung.shots]: e.target.value }))
                        }
                        className="input-field h-9 w-32 pl-6 text-right font-mono tabular-nums"
                        aria-label={`Regular price for ${formatCount(rung.shots)} credits`}
                      />
                    </span>
                  ) : (
                    <span
                      className={`font-mono text-[14px] tabular-nums ${
                        willMove ? 'font-bold text-danger-700' : 'text-ink/75'
                      }`}
                    >
                      {rung.php == null ? '—' : peso(rung.php)}
                    </span>
                  )}
                </span>

                <span className="w-20 text-right font-mono text-[12.5px] tabular-nums text-ink/55">
                  {rung.ratePerCredit == null ? '—' : `₱${rung.ratePerCredit.toFixed(3)}`}
                </span>

                <span className="w-24 text-right font-mono text-[12.5px] tabular-nums text-ink/55">
                  {signup == null ? '—' : peso(signup)}
                </span>
              </div>
            );
          })}
        </div>

        {/*
          An empty anchor is not a broken ladder — it is an unfinished edit, and
          it must READ that way. Without this the rungs beneath simply go blank
          and nothing on screen says why, which is the state the owner met.
        */}
        {emptyAnchors.length > 0 && (
          <div className="mt-3 rounded-xl border border-warn-700/35 bg-warn-500/[0.08] p-3">
            <p className="text-[13px] font-bold text-warn-700">
              {emptyAnchors.length === 1
                ? 'One price is empty'
                : `${emptyAnchors.length} prices are empty`}
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink/75">
              {emptyAnchors.map((s) => s.toLocaleString('en-PH')).join(', ')} —{' '}
              {emptyAnchors.length === 1 ? 'this rung sets' : 'these rungs set'} the rate for
              everything below, so those prices stay blank until{' '}
              {emptyAnchors.length === 1 ? 'it has' : 'they have'} a number. Nothing is saved
              until you press save.
            </p>
          </div>
        )}

        {complaints.length > 0 && (
          <div className="mt-3 rounded-xl border border-danger-700/35 bg-danger-700/[0.06] p-3">
            <p className="flex items-center gap-2 text-[13px] font-bold text-danger-700">
              <AlertTriangle className="h-4 w-4" strokeWidth={2} aria-hidden />
              This ladder would not make sense
            </p>
            <ul className="mt-1.5 space-y-1 text-[12.5px] text-ink/75">
              {complaints.map((c, i) => (
                <li key={`${c.kind}-${i}`}>{c.message}</li>
              ))}
            </ul>
            <p className="mt-2 text-[11.5px] text-ink/55">
              A rung that costs more per shot than a smaller one is one nobody would ever buy — they
              would buy the smaller one twice. This will not save.
            </p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="rounded-md bg-terracotta-700 px-4 py-2 text-sm font-semibold text-cream transition hover:bg-terracotta-800"
          >
            Save shot prices
          </button>
          <span className="text-[12.5px] text-ink/60">
            {changedCount === 0
              ? 'No price would change.'
              : `${formatCount(changedCount)} of ${formatCount(rows.length)} prices would change.`}
          </span>
          {ladderState.message && (
            <span className={`text-xs ${ladderState.ok ? 'text-success-800' : 'text-danger-700'}`}>
              {ladderState.message}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
