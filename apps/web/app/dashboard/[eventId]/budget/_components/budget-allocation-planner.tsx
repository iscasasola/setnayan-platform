'use client';

// ============================================================================
// BudgetAllocationPlanner — the COUPLE-facing "suggested budget split" surface.
//
// Design: Budget_Planner_Allocation_Engine_2026-06-05.md (spec corpus).
//
// The pure engine (lib/budget-allocation.ts) is the COUNTERPART to lib/budget.ts:
// budget.ts TRACKS what booked vendors actually cost; this screen RECOMMENDS what
// each service SHOULD cost — a ₱ target + shopping range per leaf, BEFORE the
// couple picks anyone.
//
// Architecture (per the design doc): the server resolver (budget-allocation-data.ts)
// fetches the inputs ONCE; this client component imports computeBudgetAllocation
// directly and re-runs it on every tilt so the couple gets INSTANT feedback with
// no round-trip. The only server call is the snapshot save (the behavioral
// capture) via saveAllocationSnapshot.
//
// It is a GUIDE, never a rule (design doc §1): nothing here blocks, clamps, or
// disables an input for being "over budget" — over-budget / shortfall states only
// surface soft warnings. The couple's own number always wins.
//
// Tilt model:
//   • `recommended` = computeBudgetAllocation with NO pins (the default baseline).
//   • `final`       = the same call, with the couple's pins layered in.
//   Pinning a leaf to the recommended value (or clearing it) removes the pin so
//   the leaf snaps back to following the budget. Splurge ≈ 1.25× recommended,
//   Save ≈ 0.8× recommended, both rounded to the nearest ₱1,000.
//
// Modal UX follows the canonical Setnayan pattern (cancel-booking-button.tsx /
// plan-card-lock.tsx): native overlay div + role="dialog", bottom sheet on mobile
// (`items-end`) → centered card on desktop (`sm:items-center`), ESC + backdrop
// dismissal. Palette + type scale match budget/page.tsx (text-ink, bg-cream,
// terracotta / emerald accents, font-mono eyebrows, font-display numerals).
//
// Polite brand voice per [[feedback_setnayan_no_dev_text_post_launch]] — outcome-
// first copy, no engineering jargon, no exclamation marks.
// ============================================================================

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  PiggyBank,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import {
  computeBudgetAllocation,
  type AllocationConfig,
  type LeafAllocation,
} from '@/lib/budget-allocation';
import type { PlannerLeafInput } from '@/lib/budget-allocation-data';
import { formatPhp } from '@/lib/budget';
import {
  saveAllocationSnapshot,
  type SnapshotLeaf,
} from '../allocation-actions';

type Props = {
  eventId: string;
  budgetPhp: number | null;
  leaves: PlannerLeafInput[];
  config: Partial<AllocationConfig>;
  pax: number | null;
  region: string | null;
};

/** Round a peso amount to the nearest ₱1,000 (Splurge / Save snap to clean
 *  shopping numbers, never raw 1.25× decimals). Always ≥ 0. */
function roundToThousand(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(0, Math.round(value / 1000) * 1000);
}

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saved'; count: number }
  | { kind: 'error'; message: string };

export function BudgetAllocationPlanner({
  eventId,
  budgetPhp,
  leaves,
  config,
  pax,
  region,
}: Props) {
  // The couple's pins: canonicalService → pinned ₱. Order they were FIRST pinned
  // drives pin_order (the priority signal captured in the snapshot).
  const [pins, setPins] = useState<Record<string, number>>({});
  const [pinOrder, setPinOrder] = useState<string[]>([]);
  const [openLeaf, setOpenLeaf] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const [isSaving, startSaving] = useTransition();

  // Label lookup so we render the human label, not the plan_group_id key.
  const labelByLeaf = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of leaves) m.set(l.canonicalService, l.label);
    return m;
  }, [leaves]);

  // BASELINE — no pins. The "suggested" numbers + the per-leaf reset target.
  const recommended = useMemo(
    () =>
      budgetPhp == null
        ? null
        : computeBudgetAllocation({ budgetPhp, leaves, config }),
    [budgetPhp, leaves, config],
  );

  // FINAL — the couple's pins layered onto the same inputs. Re-runs instantly on
  // every tilt (this is why the engine is pure + client-side).
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

  // Editing the planner invalidates the last "Saved" confirmation so the couple
  // never sees a stale green chip against numbers they've since changed.
  useEffect(() => {
    setSaveState((s) => (s.kind === 'saved' ? { kind: 'idle' } : s));
  }, [pins]);

  // ── Pin mutators ───────────────────────────────────────────────────────────

  /** Set a leaf to an explicit ₱. If the value equals the recommended amount (or
   *  is non-positive), clear the pin instead so the leaf rejoins the budget-led
   *  split. First-time pins append to pinOrder. */
  function setPin(canonicalService: string, amountPhp: number) {
    const rec = recommendedByLeaf.get(canonicalService);
    const recAmt = rec?.amountPhp ?? 0;
    const rounded = Math.max(0, Math.round(amountPhp));

    if (rounded <= 0 || rounded === recAmt) {
      clearPin(canonicalService);
      return;
    }
    setPins((prev) => ({ ...prev, [canonicalService]: rounded }));
    setPinOrder((prev) =>
      prev.includes(canonicalService) ? prev : [...prev, canonicalService],
    );
  }

  /** Remove a leaf's pin — it snaps back to the suggested (budget-led) amount. */
  function clearPin(canonicalService: string) {
    setPins((prev) => {
      if (!(canonicalService in prev)) return prev;
      const next = { ...prev };
      delete next[canonicalService];
      return next;
    });
    setPinOrder((prev) => prev.filter((c) => c !== canonicalService));
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  function handleSave() {
    if (!recommended || !final) return;
    const recMap = new Map(recommended.leaves.map((l) => [l.canonicalService, l]));
    const snapshotLeaves: SnapshotLeaf[] = final.leaves.map((fin) => {
      const rec = recMap.get(fin.canonicalService);
      const isPinned = fin.canonicalService in pins;
      const orderIdx = pinOrder.indexOf(fin.canonicalService);
      return {
        canonicalService: fin.canonicalService,
        recommendedAmountPhp: rec?.amountPhp ?? null,
        finalAmountPhp: fin.amountPhp,
        recommendedShareBp: rec?.shareBp ?? null,
        finalShareBp: fin.shareBp,
        wasPinned: isPinned,
        pinOrder: orderIdx >= 0 ? orderIdx + 1 : null,
      };
    });

    startSaving(async () => {
      try {
        const res = await saveAllocationSnapshot({
          eventId,
          totalBudgetPhp: budgetPhp,
          region,
          pax,
          leaves: snapshotLeaves,
        });
        if (res.ok) {
          setSaveState({ kind: 'saved', count: res.count });
        } else {
          setSaveState({ kind: 'error', message: res.error });
        }
      } catch (err) {
        setSaveState({
          kind: 'error',
          message:
            err instanceof Error ? err.message : 'Something went wrong. Try again.',
        });
      }
    });
  }

  // ── Empty state ────────────────────────────────────────────────────────────

  if (budgetPhp == null || final == null || recommended == null) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/20 bg-cream p-8 text-center">
        <PiggyBank
          aria-hidden
          className="mx-auto h-8 w-8 text-ink/35"
          strokeWidth={1.5}
        />
        <p className="mx-auto mt-3 max-w-sm text-sm text-ink/65">
          Set your total budget above to see your suggested split.
        </p>
      </div>
    );
  }

  const cushion = final.cushionPhp;
  const overBudget = final.overBudget;
  const hasShortfall = final.shortfallPhp > 0;
  const openLeafAlloc = openLeaf
    ? final.leaves.find((l) => l.canonicalService === openLeaf) ?? null
    : null;

  return (
    <div className="space-y-4">
      {/* Header — total budget + the cushion / over-budget readout. */}
      <div className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              <Wallet aria-hidden className="h-3.5 w-3.5 text-terracotta" strokeWidth={1.75} />
              Total budget
            </p>
            <p className="font-display text-3xl text-ink sm:text-4xl">
              {formatPhp(budgetPhp)}
            </p>
          </div>
          <div className="space-y-1 text-right">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              {overBudget ? 'Over budget' : 'Cushion'}
            </p>
            {overBudget ? (
              <p className="font-display text-2xl text-terracotta-700 sm:text-3xl">
                {formatPhp(Math.abs(cushion))}
              </p>
            ) : (
              <p className="font-display text-2xl text-emerald-700 sm:text-3xl">
                {formatPhp(cushion)}
              </p>
            )}
            <p className="text-xs text-ink/55">
              {overBudget ? 'over your stated budget' : 'unallocated'}
            </p>
          </div>
        </div>

        {/* Shortfall = the budget can't cover the cheapest viable version of
            everything selected. Advisory, never a block. */}
        {hasShortfall ? (
          <div
            role="status"
            className="mt-4 flex items-start gap-2 rounded-xl border border-terracotta/30 bg-terracotta/[0.06] px-3 py-2.5 text-sm text-ink/80"
          >
            <AlertTriangle
              aria-hidden
              className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-700"
              strokeWidth={1.75}
            />
            <span>
              Your budget is about{' '}
              <strong className="font-medium text-ink">
                {formatPhp(final.shortfallPhp)}
              </strong>{' '}
              short for these services — consider raising it or trimming a few.
            </span>
          </div>
        ) : null}
      </div>

      {/* One row per leaf. */}
      <ul className="space-y-2.5">
        {final.leaves.map((leaf) => (
          <LeafRow
            key={leaf.canonicalService}
            leaf={leaf}
            label={labelByLeaf.get(leaf.canonicalService) ?? leaf.canonicalService}
            onOpen={() => {
              setOpenLeaf(leaf.canonicalService);
            }}
          />
        ))}
      </ul>

      {/* Save plan — sticky to the bottom so the couple can save from anywhere
          in the list. The save itself runs through a transition (pending state). */}
      <div className="sticky bottom-3 z-10 mt-2">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink/10 bg-white/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="button-primary px-5 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" strokeWidth={2} />
                Saving…
              </>
            ) : (
              'Save plan'
            )}
          </button>

          {saveState.kind === 'saved' ? (
            <p
              role="status"
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800"
            >
              <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              Saved
            </p>
          ) : null}
          {saveState.kind === 'error' ? (
            <p
              role="alert"
              className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-800"
            >
              <AlertTriangle aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              {saveState.message}
            </p>
          ) : null}

          <p className="ml-auto hidden text-xs text-ink/50 sm:block">
            A guide, not a rule — nudge anything.
          </p>
        </div>
      </div>

      {/* Tilt editor — bottom sheet on mobile, centered card on desktop. */}
      {openLeafAlloc ? (
        <TiltEditor
          leaf={openLeafAlloc}
          label={labelByLeaf.get(openLeafAlloc.canonicalService) ?? openLeafAlloc.canonicalService}
          recommendedAmountPhp={
            recommendedByLeaf.get(openLeafAlloc.canonicalService)?.amountPhp ?? 0
          }
          onClose={() => setOpenLeaf(null)}
          onSetAmount={(amt) => setPin(openLeafAlloc.canonicalService, amt)}
          onReset={() => clearPin(openLeafAlloc.canonicalService)}
        />
      ) : null}
    </div>
  );
}

// ── Leaf row ─────────────────────────────────────────────────────────────────

function LeafRow({
  leaf,
  label,
  onOpen,
}: {
  leaf: LeafAllocation;
  label: string;
  onOpen: () => void;
}) {
  const sharePct = (leaf.shareBp / 100).toFixed(1);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-center gap-3 rounded-xl border border-ink/10 bg-cream p-4 text-left transition-colors hover:border-terracotta/40 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-1 focus-visible:ring-offset-cream"
        aria-label={`Adjust ${label} — suggested ${formatPhp(leaf.amountPhp)}`}
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-ink">{label}</span>
            <ConfidenceChip confidence={leaf.confidence} />
            {leaf.pinned ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-terracotta/30 bg-terracotta/[0.06] px-2 py-0.5 text-[10px] font-medium text-terracotta-700">
                <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
                you set this
              </span>
            ) : null}
            {leaf.belowFloor ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/60 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                <Info aria-hidden className="h-3 w-3" strokeWidth={2} />
                below typical floor
              </span>
            ) : null}
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/45">
            Range {formatPhp(leaf.rangeLowPhp)}–{formatPhp(leaf.rangeHighPhp)}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-display text-xl text-ink tabular-nums">
            {formatPhp(leaf.amountPhp)}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
            {sharePct}% of budget
          </p>
        </div>
      </button>
    </li>
  );
}

/** Confidence calibrates the UI: high reads as a quiet ✓; thinner data reads as
 *  an explicit "good estimate" / "rough estimate" so the couple knows how much
 *  to trust the number. */
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
      <span className="rounded-full border border-ink/15 bg-white px-2 py-0.5 text-[10px] font-medium text-ink/60">
        good estimate
      </span>
    );
  }
  // low | none — be honest that the number is rough.
  return (
    <span className="rounded-full border border-ink/15 bg-white px-2 py-0.5 text-[10px] font-medium text-ink/55">
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

  // The peso input is pre-filled with the leaf's CURRENT (final) amount and
  // tracked as a display string so the couple can type freely.
  const [draft, setDraft] = useState<string>(formatPlain(leaf.amountPhp));

  // Re-seed when a different leaf opens (the component stays mounted; only the
  // `leaf` prop changes between opens through the parent's openLeaf swap).
  useEffect(() => {
    setDraft(formatPlain(leaf.amountPhp));
  }, [leaf.canonicalService, leaf.amountPhp]);

  // Focus the close button on open — calm default, matches the canonical modal.
  useEffect(() => {
    closeBtnRef.current?.focus();
  }, []);

  // ESC dismissal.
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
    const parsed = parsePlain(raw);
    onSetAmount(parsed);
  }

  const isStandard = !leaf.pinned;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tilt-editor-headline"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-ink/10 bg-cream p-5 shadow-xl sm:p-6">
        <button
          ref={closeBtnRef}
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-ink/55 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>

        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Adjust this service
        </p>
        <h2
          id="tilt-editor-headline"
          className="mt-1 font-display text-2xl italic tracking-tight text-ink"
        >
          {label}
        </h2>
        <p className="mt-2 text-sm text-ink/65">
          Suggested{' '}
          <strong className="font-medium text-ink">
            {formatPhp(recommendedAmountPhp)}
          </strong>{' '}
          · typical range {formatPhp(leaf.rangeLowPhp)}–{formatPhp(leaf.rangeHighPhp)}.
        </p>

        {/* Quick tilts. Standard clears the pin (back to suggested); Splurge /
            Save snap to clean ₱1,000-rounded multiples of the recommendation. */}
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

        {/* Free ₱ entry — set any amount. */}
        <div className="mt-5 space-y-2">
          <label
            htmlFor="tilt-amount"
            className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
          >
            Or set your own (PHP)
          </label>
          <div className="flex items-center gap-2">
            <span className="text-lg text-ink/55">₱</span>
            <input
              id="tilt-amount"
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
              className="input-field h-12 flex-1 text-xl tabular-nums"
            />
          </div>
          {leaf.belowFloor ? (
            <p className="flex items-start gap-1.5 text-xs text-amber-800">
              <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              That&rsquo;s below the cheapest price we&rsquo;ve seen for this — still
              fine, just worth knowing.
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
            className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-ink/60 transition-colors hover:text-terracotta-700"
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
            className="button-primary px-5"
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
      className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-3 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta ${
        active
          ? 'border-terracotta bg-terracotta/[0.08] text-terracotta-700'
          : 'border-ink/15 bg-white text-ink/75 hover:border-terracotta/40 hover:text-ink'
      }`}
    >
      <span className="text-sm font-semibold">{label}</span>
      <span className="font-mono text-[10px] tabular-nums text-ink/50">{sub}</span>
    </button>
  );
}

// ── Plain-number input helpers (peso, thousands-separated, no decimals) ───────
// The planner works in whole pesos (the engine rounds to integers), so these are
// the integer-only counterparts of budget-setter.tsx's formatters.

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
