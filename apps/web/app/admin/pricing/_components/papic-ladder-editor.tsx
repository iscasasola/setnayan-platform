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
  PAPIC_DISCOUNT_FLOOR_PCT,
  discountComplaints,
  previewFamilySave,
  signupPriceFor,
} from '@/lib/onboarding-family-discount';

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
  saveDiscountAction,
}: {
  rows: PapicRungRow[];
  discountPct: number;
  saveLadderAction: (prev: RowActionState, fd: FormData) => Promise<RowActionState>;
  saveDiscountAction: (prev: RowActionState, fd: FormData) => Promise<RowActionState>;
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

  const anchors = PAPIC_ANCHOR_SHOTS.map(
    (shots) => [shots, Number(anchorPhp[shots])] as [number, number],
  ).filter(([, php]) => Number.isFinite(php) && php > 0);

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
        from the nearest one below them. The saving at set-up is a separate number, further down.
      </p>

      <PapicDiscountCard
        discountPct={discountPct}
        rows={rows.map((r) => ({
          serviceCode: r.serviceCode,
          title: `${r.shots.toLocaleString('en-PH')} shots`,
          regularPhp: phpByShots.get(r.shots) ?? r.regularPhp,
          signupPhp: r.signupPhp,
        }))}
        action={saveDiscountAction}
      />

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
            const signup = rung.php != null ? signupPriceFor(rung.php, discountPct) : null;

            return (
              <div
                key={rung.shots}
                className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-ink/8 px-4 py-2.5 last:border-b-0 ${
                  rung.isAnchor ? 'bg-cream' : 'bg-ink/[0.02]'
                }`}
              >
                <span className="flex items-center gap-2 text-[14px] font-semibold tabular-nums">
                  {rung.shots.toLocaleString('en-PH')}
                  {rung.isAnchor ? (
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
                  {rung.isAnchor ? (
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
                        aria-label={`Regular price for ${rung.shots} credits`}
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
              : `${changedCount} of ${rows.length} prices would change.`}
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

/**
 * Papic's single sign-up saving — the ONE family that carries the 10% floor.
 *
 * 🔒 Owner 2026-08-28: *"we will use the discount created for Papic Service Only
 * instead of both."* Setnayan AI is exempt and has its own box on its own tab.
 *
 * ⚠ THE FLOOR WARNS, IT DOES NOT REFUSE. Nothing has ever enforced it at write
 * time — it has only ever been a data fact — and quietly clamping what he types
 * would be worse than either warning or refusing.
 */
function PapicDiscountCard({
  discountPct,
  rows,
  action,
}: {
  discountPct: number;
  rows: { serviceCode: string; title: string; regularPhp: number; signupPhp: number | null }[];
  action: (prev: RowActionState, fd: FormData) => Promise<RowActionState>;
}) {
  const [state, formAction] = useActionState<RowActionState, FormData>(action, {
    ok: false,
    message: null,
  });
  const [pct, setPct] = useState(String(discountPct));

  const n = Number(pct);
  const usable = Number.isFinite(n);
  const complaints = usable ? discountComplaints('papic', n) : [];
  const blocked = complaints.some((c) => c.kind === 'out_of_range');
  const preview = usable && !blocked ? previewFamilySave(rows, n) : [];
  const moving = preview.filter((p) => p.moves);

  return (
    <form
      action={formAction}
      className="mb-6 rounded-r-2xl border border-l-[3px] border-ink/10 border-l-gold bg-ink/[0.02] p-4"
    >
      <input type="hidden" name="family" value="papic" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold">One saving for every shot bundle</h3>
          <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-ink/65">
            Added while setting the celebration up and it costs this much less. One number covers
            all {rows.length} bundles — each bundle&apos;s set-up price is worked out from its
            regular price, so you never type it.
          </p>
        </div>
        <label className="block shrink-0 text-right">
          <span className="mb-1.5 block font-mono text-[9.5px] uppercase tracking-[0.15em] text-ink/55">
            Saving at set-up
          </span>
          <div className="relative">
            <input
              name="discount_pct"
              type="number"
              step="0.01"
              min="0"
              max="99.99"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              className="input-field w-28 pr-7 text-right font-mono tabular-nums"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[13px] text-ink/50">
              %
            </span>
          </div>
          <span className="mt-1 block text-[11px] text-ink/45">
            meant to be at least {PAPIC_DISCOUNT_FLOOR_PCT}%
          </span>
        </label>
      </div>

      {complaints.map((c) => (
        <p
          key={c.kind}
          className={`mt-2.5 rounded-lg px-3 py-2 text-[12.5px] font-semibold ${
            c.kind === 'out_of_range'
              ? 'border border-danger-700/30 bg-danger-700/[0.06] text-danger-700'
              : 'border border-gold/40 bg-gold/[0.10] text-gold-deep'
          }`}
        >
          {c.message}
        </p>
      ))}

      {moving.length > 0 && (
        <div className="mt-3 rounded-xl border border-danger-700/30 bg-danger-700/[0.05] p-3">
          <p className="flex items-center gap-2 text-[13px] font-bold text-danger-700">
            <AlertTriangle className="h-4 w-4" strokeWidth={2} aria-hidden />
            Saving this changes {moving.length} set-up price{moving.length === 1 ? '' : 's'}
          </p>
          <ul className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-[12.5px] text-ink/75 sm:grid-cols-2">
            {moving.map((p) => (
              <li key={p.serviceCode} className="tabular-nums">
                <span className="font-semibold">{p.title}</span>{' '}
                <span className="font-mono">
                  {p.currentSignupPhp == null ? 'none' : peso(p.currentSignupPhp)}
                </span>{' '}
                →{' '}
                <span className="font-mono font-bold text-danger-700">
                  {p.nextSignupPhp == null ? 'none' : peso(p.nextSignupPhp)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {usable && !blocked && moving.length === 0 && (
        <p className="mt-2.5 text-[12.5px] text-ink/55">No set-up price changes at this saving.</p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          className="rounded-md bg-terracotta-700 px-4 py-2 text-sm font-semibold text-cream transition hover:bg-terracotta-800"
        >
          Save the saving
        </button>
        {state.message && (
          <span className={`text-xs ${state.ok ? 'text-success-800' : 'text-danger-700'}`}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
