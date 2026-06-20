'use client';

// ============================================================================
// TourBudgetPlanner — CLIENT-ONLY interactive fork of
// app/dashboard/[eventId]/budget/_components/budget-allocation-planner.tsx for
// the public Maria & Jose tour.
//
// Why a fork (not a reuse): the dashboard BudgetAllocationPlanner imports
// `saveAllocationSnapshot` from ../allocation-actions (a SERVER ACTION) — which
// would trip the app/tour/** no-restricted-imports guard and persist behavioral
// data from an anonymous visitor. This fork keeps the EXACT same client-only
// interaction model — the PURE engine (computeBudgetAllocation +
// computeBudgetOverspend) re-runs on every tilt so totals recompute locally
// with no round-trip — but drops the save action and its UI entirely.
//
// This is the stop's "client-only interactive" moment: local React state
// (pins) updates the on-screen split, calls NO server, and resets on reload.
// Palette retuned to the tour's tokens (serif headings, #1E2229 ink, #5F5E5A
// body, #8C6932 / #C5A059 gold, #5C2542 mulberry, #FBF8F1 / #FBF6EA creams).
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  PiggyBank,
  RotateCcw,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';
import {
  computeBudgetAllocation,
  type AllocationConfig,
  type LeafAllocation,
} from '@/lib/budget-allocation';
import { computeBudgetOverspend } from '@/lib/budget-overspend';
import type { PlannerLeafInput } from '@/lib/budget-allocation-data';
import { formatPhp } from '@/lib/budget';

type Props = {
  budgetPhp: number | null;
  leaves: PlannerLeafInput[];
  config: Partial<AllocationConfig>;
};

/** Round a peso amount to the nearest ₱1,000. Always ≥ 0. */
function roundToThousand(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(0, Math.round(value / 1000) * 1000);
}

export function TourBudgetPlanner({ budgetPhp, leaves, config }: Props) {
  // The visitor's local pins: canonicalService → pinned ₱. NEVER persisted.
  const [pins, setPins] = useState<Record<string, number>>({});
  const [openLeaf, setOpenLeaf] = useState<string | null>(null);

  const labelByLeaf = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of leaves) m.set(l.canonicalService, l.label);
    return m;
  }, [leaves]);

  // BASELINE — no pins. The "suggested" numbers + the per-leaf reset target.
  const recommended = useMemo(
    () => (budgetPhp == null ? null : computeBudgetAllocation({ budgetPhp, leaves, config })),
    [budgetPhp, leaves, config],
  );

  // FINAL — the visitor's pins layered onto the same inputs. Re-runs instantly.
  const final = useMemo(
    () =>
      budgetPhp == null
        ? null
        : computeBudgetAllocation({
            budgetPhp,
            leaves: leaves.map((l) => ({
              ...l,
              pinnedAmountPhp: pins[l.canonicalService] ?? null,
            })),
            config,
          }),
    [budgetPhp, leaves, config, pins],
  );

  const recommendedByLeaf = useMemo(() => {
    const m = new Map<string, LeafAllocation>();
    if (recommended) for (const l of recommended.leaves) m.set(l.canonicalService, l);
    return m;
  }, [recommended]);

  const overspend = useMemo(() => {
    if (!final || !recommended) return null;
    const recMap = new Map(recommended.leaves.map((l) => [l.canonicalService, l]));
    return computeBudgetOverspend(
      final.leaves.map((leaf) => ({
        key: leaf.canonicalService,
        label: labelByLeaf.get(leaf.canonicalService) ?? leaf.canonicalService,
        benchmarkPhp: recMap.get(leaf.canonicalService)?.amountPhp ?? 0,
        actualPhp: leaf.amountPhp,
      })),
    );
  }, [final, recommended, labelByLeaf]);

  // ── Pin mutators ───────────────────────────────────────────────────────────

  function setPin(canonicalService: string, amountPhp: number) {
    const rec = recommendedByLeaf.get(canonicalService);
    const recAmt = rec?.amountPhp ?? 0;
    const rounded = Math.max(0, Math.round(amountPhp));
    if (rounded <= 0 || rounded === recAmt) {
      clearPin(canonicalService);
      return;
    }
    setPins((prev) => ({ ...prev, [canonicalService]: rounded }));
  }

  function clearPin(canonicalService: string) {
    setPins((prev) => {
      if (!(canonicalService in prev)) return prev;
      const next = { ...prev };
      delete next[canonicalService];
      return next;
    });
  }

  // ── Empty state ────────────────────────────────────────────────────────────

  if (budgetPhp == null || final == null || recommended == null) {
    return (
      <div className="rounded-2xl border border-dashed border-[#1E2229]/20 bg-[#FBF8F1] p-8 text-center">
        <PiggyBank aria-hidden className="mx-auto h-8 w-8 text-[#1E2229]/35" strokeWidth={1.5} />
        <p className="mx-auto mt-3 max-w-sm text-sm text-[#5F5E5A]">
          This sample wedding hasn&rsquo;t set a budget yet, so there&rsquo;s no split to show.
        </p>
      </div>
    );
  }

  const cushion = final.cushionPhp;
  const overBudget = final.overBudget;
  const hasShortfall = final.shortfallPhp > 0;
  const openLeafAlloc = openLeaf ? final.leaves.find((l) => l.canonicalService === openLeaf) ?? null : null;

  return (
    <div className="space-y-4">
      {/* Header — total budget + the cushion / over-budget readout. */}
      <div className="rounded-2xl border border-[#1E2229]/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-[#5F5E5A]">
              <Wallet aria-hidden className="h-3.5 w-3.5 text-[#8C6932]" strokeWidth={1.75} />
              Total budget
            </p>
            <p className="font-serif text-3xl text-[#1E2229] sm:text-4xl">{formatPhp(budgetPhp)}</p>
          </div>
          <div className="space-y-1 text-right">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#5F5E5A]">
              {overBudget ? 'Over budget' : 'Cushion'}
            </p>
            {overBudget ? (
              <p className="font-serif text-2xl text-[#5C2542] sm:text-3xl">{formatPhp(Math.abs(cushion))}</p>
            ) : (
              <p className="font-serif text-2xl text-emerald-700 sm:text-3xl">{formatPhp(cushion)}</p>
            )}
            <p className="text-xs text-[#5F5E5A]">{overBudget ? 'over your stated budget' : 'unallocated'}</p>
          </div>
        </div>

        {hasShortfall ? (
          <div
            role="status"
            className="mt-4 flex items-start gap-2 rounded-xl border border-[#5C2542]/30 bg-[#5C2542]/[0.06] px-3 py-2.5 text-sm text-[#1E2229]/80"
          >
            <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[#5C2542]" strokeWidth={1.75} />
            <span>
              Your budget is about{' '}
              <strong className="font-medium text-[#1E2229]">{formatPhp(final.shortfallPhp)}</strong> short for these
              services — consider raising it or trimming a few.
            </span>
          </div>
        ) : null}

        {overspend && overspend.hasOverspend ? <OverspendBanner overspend={overspend} /> : null}
      </div>

      {/* One row per leaf. */}
      <ul className="space-y-2.5">
        {final.leaves.map((leaf) => (
          <LeafRow
            key={leaf.canonicalService}
            leaf={leaf}
            label={labelByLeaf.get(leaf.canonicalService) ?? leaf.canonicalService}
            onOpen={() => setOpenLeaf(leaf.canonicalService)}
          />
        ))}
      </ul>

      <p className="text-center text-xs text-[#5F5E5A]">A guide, not a rule — nudge anything. Nothing is saved.</p>

      {/* Tilt editor — bottom sheet on mobile, centered card on desktop. */}
      {openLeafAlloc ? (
        <TiltEditor
          leaf={openLeafAlloc}
          label={labelByLeaf.get(openLeafAlloc.canonicalService) ?? openLeafAlloc.canonicalService}
          recommendedAmountPhp={recommendedByLeaf.get(openLeafAlloc.canonicalService)?.amountPhp ?? 0}
          onClose={() => setOpenLeaf(null)}
          onSetAmount={(amt) => setPin(openLeafAlloc.canonicalService, amt)}
          onReset={() => clearPin(openLeafAlloc.canonicalService)}
        />
      ) : null}
    </div>
  );
}

// ── Overspend + absorption banner ────────────────────────────────────────────

function joinLabels(labels: string[]): string {
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

function OverspendBanner({ overspend }: { overspend: ReturnType<typeof computeBudgetOverspend> }) {
  const overLabels = overspend.overspent.map((c) => c.label);
  const absorbLabels = Array.from(new Set(overspend.transfers.map((t) => t.fromLabel)));
  const emerald = overspend.fullyAbsorbable;

  return (
    <div
      role="status"
      className={`mt-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm text-[#1E2229]/80 ${
        emerald ? 'border-emerald-300/60 bg-emerald-50/60' : 'border-[#5C2542]/30 bg-[#5C2542]/[0.06]'
      }`}
    >
      {emerald ? (
        <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" strokeWidth={1.75} />
      ) : (
        <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[#5C2542]" strokeWidth={1.75} />
      )}
      <span>
        {joinLabels(overLabels)} {overLabels.length === 1 ? 'is' : 'are'} about{' '}
        <strong className="font-medium text-[#1E2229]">{formatPhp(overspend.totalOverspendPhp)}</strong> over the
        suggested split.{' '}
        {emerald ? (
          <>Your room on {joinLabels(absorbLabels)} can cover it — you&rsquo;re still within budget.</>
        ) : (
          <>
            {absorbLabels.length > 0 ? <>Room on {joinLabels(absorbLabels)} covers part of it; </> : null}
            about <strong className="font-medium text-[#1E2229]">{formatPhp(overspend.netOverPhp)}</strong> isn&rsquo;t
            covered elsewhere — consider trimming or raising your budget.
          </>
        )}
      </span>
    </div>
  );
}

// ── Leaf row ─────────────────────────────────────────────────────────────────

function LeafRow({ leaf, label, onOpen }: { leaf: LeafAllocation; label: string; onOpen: () => void }) {
  const sharePct = (leaf.shareBp / 100).toFixed(1);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-center gap-3 rounded-xl border border-[#1E2229]/10 bg-[#FBF8F1] p-4 text-left transition-colors hover:border-[#C5A059]/50 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C6932] focus-visible:ring-offset-1 focus-visible:ring-offset-[#FBF8F1]"
        aria-label={`Adjust ${label} — suggested ${formatPhp(leaf.amountPhp)}`}
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-[#1E2229]">{label}</span>
            <ConfidenceChip confidence={leaf.confidence} />
            {leaf.pinned ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#C5A059]/40 bg-[#C5A059]/[0.1] px-2 py-0.5 text-[10px] font-medium text-[#8C6932]">
                <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
                you set this
              </span>
            ) : null}
            {leaf.belowFloor ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#C5A059]/40 bg-[#FBF6EA] px-2 py-0.5 text-[10px] font-medium text-[#8C6932]">
                <Info aria-hidden className="h-3 w-3" strokeWidth={2} />
                below typical floor
              </span>
            ) : null}
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#5F5E5A]">
            Range {formatPhp(leaf.rangeLowPhp)}–{formatPhp(leaf.rangeHighPhp)}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-serif text-xl text-[#1E2229] tabular-nums">{formatPhp(leaf.amountPhp)}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#5F5E5A]">{sharePct}% of budget</p>
        </div>
      </button>
    </li>
  );
}

function ConfidenceChip({ confidence }: { confidence: LeafAllocation['confidence'] }) {
  if (confidence === 'high') {
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700"
        title="Backed by plenty of real vendor prices"
      >
        <CheckCircle2 aria-hidden className="h-3 w-3" strokeWidth={2} />
      </span>
    );
  }
  if (confidence === 'medium') {
    return (
      <span className="rounded-full border border-[#1E2229]/15 bg-white px-2 py-0.5 text-[10px] font-medium text-[#5F5E5A]">
        good estimate
      </span>
    );
  }
  return (
    <span className="rounded-full border border-[#1E2229]/15 bg-white px-2 py-0.5 text-[10px] font-medium text-[#5F5E5A]">
      rough estimate
    </span>
  );
}

// ── Tilt editor (bottom sheet / centered card) ───────────────────────────────

function TiltEditor({
  leaf,
  label,
  recommendedAmountPhp,
  onClose,
  onSetAmount,
  onReset,
}: {
  leaf: LeafAllocation;
  label: string;
  recommendedAmountPhp: number;
  onClose: () => void;
  onSetAmount: (amountPhp: number) => void;
  onReset: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const [draft, setDraft] = useState<string>(formatPlain(leaf.amountPhp));

  useEffect(() => {
    setDraft(formatPlain(leaf.amountPhp));
  }, [leaf.canonicalService, leaf.amountPhp]);

  useEffect(() => {
    closeBtnRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const splurgeAmt = roundToThousand(recommendedAmountPhp * 1.25);
  const saveAmt = roundToThousand(recommendedAmountPhp * 0.8);

  function commitDraft(raw: string) {
    onSetAmount(parsePlain(raw));
  }

  const isStandard = !leaf.pinned;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-tilt-editor-headline"
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#1E2229]/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-[#1E2229]/10 bg-[#FBF8F1] p-5 shadow-xl sm:p-6">
        <button
          ref={closeBtnRef}
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-[#5F5E5A] transition-colors hover:bg-[#1E2229]/5 hover:text-[#1E2229] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8C6932]"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>

        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#5F5E5A]">Adjust this service</p>
        <h2 id="tour-tilt-editor-headline" className="mt-1 font-serif text-2xl tracking-tight text-[#1E2229]">
          {label}
        </h2>
        <p className="mt-2 text-sm text-[#5F5E5A]">
          Suggested <strong className="font-medium text-[#1E2229]">{formatPhp(recommendedAmountPhp)}</strong> · typical
          range {formatPhp(leaf.rangeLowPhp)}–{formatPhp(leaf.rangeHighPhp)}.
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <TiltButton
            active={leaf.pinned && leaf.amountPhp === saveAmt && saveAmt > 0}
            onClick={() => {
              onSetAmount(saveAmt);
              setDraft(formatPlain(saveAmt));
            }}
            label="Save"
            sub={formatPhp(saveAmt)}
          />
          <TiltButton
            active={isStandard}
            onClick={() => {
              onReset();
              setDraft(formatPlain(recommendedAmountPhp));
            }}
            label="Standard"
            sub={formatPhp(recommendedAmountPhp)}
          />
          <TiltButton
            active={leaf.pinned && leaf.amountPhp === splurgeAmt && splurgeAmt > 0}
            onClick={() => {
              onSetAmount(splurgeAmt);
              setDraft(formatPlain(splurgeAmt));
            }}
            label="Splurge"
            sub={formatPhp(splurgeAmt)}
          />
        </div>

        <div className="mt-5 space-y-2">
          <label htmlFor="tour-tilt-amount" className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#5F5E5A]">
            Or set your own (PHP)
          </label>
          <div className="flex items-center gap-2">
            <span className="text-lg text-[#5F5E5A]">₱</span>
            <input
              id="tour-tilt-amount"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={draft}
              onChange={(e) => setDraft(reformatPlain(e.target.value))}
              onBlur={(e) => commitDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitDraft((e.target as HTMLInputElement).value);
                  onClose();
                }
              }}
              placeholder={formatPlain(recommendedAmountPhp)}
              className="h-12 flex-1 rounded-lg border border-[#1E2229]/15 bg-white px-3 text-xl tabular-nums text-[#1E2229] outline-none focus:border-[#8C6932] focus:ring-2 focus:ring-[#8C6932]/30"
            />
          </div>
          {leaf.belowFloor ? (
            <p className="flex items-start gap-1.5 text-xs text-[#8C6932]">
              <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              That&rsquo;s below the cheapest price we&rsquo;ve seen for this — still fine, just worth knowing.
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <button
            type="button"
            onClick={() => {
              onReset();
              setDraft(formatPlain(recommendedAmountPhp));
            }}
            className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-[#5F5E5A] transition-colors hover:text-[#5C2542]"
          >
            <RotateCcw aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Reset to suggested
          </button>
          <button
            type="button"
            onClick={() => {
              commitDraft(draft);
              onClose();
            }}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#5C2542] px-5 py-2 text-sm font-semibold text-[#FBFBFA] transition-opacity hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function TiltButton({
  active,
  onClick,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-3 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8C6932] ${
        active
          ? 'border-[#8C6932] bg-[#C5A059]/[0.12] text-[#8C6932]'
          : 'border-[#1E2229]/15 bg-white text-[#5F5E5A] hover:border-[#C5A059]/50 hover:text-[#1E2229]'
      }`}
    >
      <span className="text-sm font-semibold">{label}</span>
      <span className="font-mono text-[10px] tabular-nums text-[#5F5E5A]">{sub}</span>
    </button>
  );
}

// ── Plain-number input helpers (peso, thousands-separated, no decimals) ───────

function formatPlain(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function reformatPlain(raw: string): string {
  const cleaned = raw.replace(/[₱\s,]/g, '').replace(/[^0-9]/g, '');
  if (cleaned.length === 0) return '';
  return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function parsePlain(raw: string): number {
  const cleaned = raw.replace(/[^0-9]/g, '');
  if (cleaned.length === 0) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
