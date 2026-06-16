'use client';

/**
 * BuildCompare — the Compare tab (PR F of the 0016 Plan Builder redesign).
 *
 * Retires the Lean/Fits/Stretch budget-estimate baskets for the prototype's
 * named-builds model: a "build" is a named snapshot of the couple's REAL vendor
 * picks per category. The couple saves their current plan into a slot (A/B/C),
 * tweaks their picks on Build/Shortlist, saves another, and compares the actual
 * vendors side by side against their budget. No migration — reuses the existing
 * `budget_builds` 3 slots; picks live in the `snapshot` JSONB.
 *
 * Client component. Per-build Modify/Lock are now implemented: each saved build
 * can load its vendor picks into the live working build and jump to the Build
 * tab (Modify) or the Lock tab (Lock) — Lock does NOT bulk-finalize here, it just
 * loads the picks and routes to the Lock tab's hardened finalize flow.
 */

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, ChevronDown, Loader2, Lock, Pencil, Trash2 } from 'lucide-react';
import {
  savePlanBuild,
  savePlanBuildNamed,
  deleteBudgetBuild,
  type SavedPlanBuild,
  type PlanBuildSnapshot,
  type BuildSlot,
} from '../build-actions';
import { applyBuildToWorking } from '../build-pick-actions';
import { readPinMode } from './build-pin-mode';
import { goToBuildTab } from './services-takeover';
import { sortSavedBuilds, displayBuildTitle } from '@/lib/named-builds';

const peso = (php: number | null) =>
  php == null ? '—' : `₱${Math.round(php).toLocaleString('en-PH')}`;
const SLOTS: BuildSlot[] = ['A', 'B', 'C'];

// ── Available dates per build (takeover spec §4 · 2026-06-12) ───────────────
// Server-computed (page.tsx) day-intersection of each column's CONNECTED
// vendors' calendars in the couple's year/month window. Rendered as a footer
// row; columns with no connected vendors show a dash, an empty intersection
// shows the never-blank "swap one" copy.
export type CompareDatesInfo = {
  /** Marketplace-connected vendors that constrained the result. */
  connectedCount: number;
  totalAvailable: number;
  /** First few available days, pre-formatted ("Nov 14"). */
  dayLabels: string[];
  moreCount: number;
  /** Set when the intersection is empty — the "swap one" message. */
  conflictText: string | null;
};

export type CompareAvailability = {
  windowLabel: string;
  /** Keyed by build_id, plus 'current' for the live column. */
  byColumn: Record<string, CompareDatesInfo>;
};

export function BuildCompare({
  eventId,
  budgetPhp,
  currentPlan,
  savedBuilds,
  availability = null,
  named = false,
}: {
  eventId: string;
  budgetPhp: number | null;
  currentPlan: PlanBuildSnapshot;
  savedBuilds: SavedPlanBuild[];
  availability?: CompareAvailability | null;
  /**
   * BUILD_3STATE_ENABLED (default OFF). When true, the fixed A/B/C 3-slot save
   * bar swaps for the free-form NAMED Save-As flow (type a name → new build, OR
   * pick an existing build to overwrite). When false, the A/B/C slot picker +
   * `b.title ?? "Plan {label}"` column titling stay byte-identical to today.
   */
  named?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const takenSlots = useMemo(() => new Set(savedBuilds.map((b) => b.label)), [savedBuilds]);
  const [slot, setSlot] = useState<BuildSlot>(
    SLOTS.find((s) => !takenSlots.has(s as BuildSlot)) ?? 'A',
  );
  const [name, setName] = useState('');
  // Named (flag-on) Save-As: '' = create a new named build; a build_id = overwrite.
  const [overwriteId, setOverwriteId] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);
  // Per-cell inclusion expand state, keyed `${columnKey}::${groupId}`.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  // Flag-on: stable column order (A/B/C lead, then named oldest-first).
  // Flag-off: preserve the existing server order exactly (no behavior change).
  const orderedBuilds = useMemo(
    () => (named ? sortSavedBuilds(savedBuilds) : savedBuilds),
    [named, savedBuilds],
  );

  // Columns = saved builds, then the live "Current" plan last.
  const columns = useMemo(() => {
    const cols = orderedBuilds.map((b, i) => ({
      key: b.build_id,
      // Flag-on uses the named-builds display title ("Build N" fallback for an
      // untitled named row); flag-off keeps the legacy "Plan {label}" wording.
      title: named ? displayBuildTitle(b, i) : (b.title ?? `Plan ${b.label}`),
      total: b.total_php,
      picks: new Map(b.snapshot.picks.map((p) => [p.groupId, p])),
      isCurrent: false,
      // The saved snapshot, so the header can apply its picks. Old snapshots
      // (saved before vendorId existed) have no vendorId → Modify/Lock disabled.
      snapshot: b.snapshot,
    }));
    cols.push({
      key: 'current',
      title: 'Current',
      total: currentPlan.totalPhp,
      picks: new Map(currentPlan.picks.map((p) => [p.groupId, p])),
      isCurrent: true,
      snapshot: currentPlan,
    });
    return cols;
  }, [orderedBuilds, named, currentPlan]);

  function toggleCell(cellKey: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cellKey)) next.delete(cellKey);
      else next.add(cellKey);
      return next;
    });
  }

  // Rows = union of every category across the live plan + saved builds.
  const rows = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of currentPlan.picks) seen.set(p.groupId, p.label);
    for (const b of savedBuilds)
      for (const p of b.snapshot.picks) if (!seen.has(p.groupId)) seen.set(p.groupId, p.label);
    return [...seen.entries()].map(([groupId, label]) => ({ groupId, label }));
  }, [currentPlan, savedBuilds]);

  const overUnder = (total: number | null) => {
    if (total == null || budgetPhp == null) return null;
    const diff = total - budgetPhp;
    if (Math.abs(diff) < 1) return { text: 'on budget', tone: 'text-emerald-700' };
    return diff > 0
      ? { text: `${peso(diff)} over`, tone: 'text-rose-700' }
      : { text: `${peso(-diff)} to spare`, tone: 'text-emerald-700' };
  };

  function onSave() {
    setErr(null);
    if (currentPlan.picks.length === 0) {
      setErr('Add some vendors to your plan first — shortlist on the Build tab, then save.');
      return;
    }
    startTransition(async () => {
      const res = await savePlanBuild({
        eventId,
        label: slot,
        title: name.trim() || undefined,
        // Stamp which dimension led the solve (Pin solver Phase 3a) — read from
        // the Build tab's client-local mode, defaults to 'budget'.
        snapshot: { ...currentPlan, pinMode: readPinMode(eventId) },
      });
      if (!res.ok) setErr(res.error);
      else {
        setName('');
        router.refresh();
      }
    });
  }

  // Flag-on Save-As: create a NEW named build, or overwrite the chosen one.
  function onSaveNamed() {
    setErr(null);
    if (currentPlan.picks.length === 0) {
      setErr('Add some vendors to your plan first — shortlist on the Build tab, then save.');
      return;
    }
    startTransition(async () => {
      const res = await savePlanBuildNamed({
        eventId,
        rawName: name,
        overwriteBuildId: overwriteId || null,
        snapshot: { ...currentPlan, pinMode: readPinMode(eventId) },
      });
      if (!res.ok) setErr(res.error);
      else {
        setName('');
        setOverwriteId('');
        router.refresh();
      }
    });
  }

  function onDelete(buildId: string) {
    setErr(null);
    startTransition(async () => {
      const res = await deleteBudgetBuild({ eventId, buildId });
      if (!res.ok) setErr(res.error);
      else router.refresh();
    });
  }

  // Load a saved build's picks into the working build, then jump to a tab. Lock
  // does NOT finalize here — the Lock tab hosts the hardened finalize flow.
  function onApply(snapshot: PlanBuildSnapshot, destination: 'build' | 'lock') {
    setErr(null);
    const picks = snapshot.picks
      .filter((p) => p.vendorId)
      .map((p) => ({ planGroupId: p.groupId, vendorId: p.vendorId! }));
    startTransition(async () => {
      const res = await applyBuildToWorking({ eventId, picks });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.refresh();
      goToBuildTab(destination);
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-1 py-2">
      <div className="space-y-1">
        <h2 className="font-display text-2xl italic text-ink">Compare your plans</h2>
        <p className="text-sm text-ink/60">
          Save versions of your plan and compare the real vendors side by side
          {budgetPhp != null ? `, against your ${peso(budgetPhp)} budget` : ''}.
        </p>
      </div>

      {/* Save current plan — named Save-As (flag-on) or A/B/C slots (flag-off). */}
      {named ? (
        <div className="space-y-2 rounded-2xl border border-ink/10 bg-cream p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink/80">
            <Bookmark
              className="h-4 w-4 shrink-0 text-terracotta"
              strokeWidth={1.75}
              aria-hidden
            />
            Save your current plan as
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Garden wedding"
              className="min-w-[8rem] flex-1 rounded-md border border-ink/15 bg-paper px-2 py-1 text-sm outline-none focus:border-terracotta/50"
              aria-label="Build name"
            />
            <select
              value={overwriteId}
              onChange={(e) => setOverwriteId(e.target.value)}
              className="rounded-md border border-ink/15 bg-paper px-2 py-1 text-sm"
              aria-label="Save as a new build or overwrite an existing one"
            >
              <option value="">as a new build</option>
              {orderedBuilds.map((b, i) => (
                <option key={b.build_id} value={b.build_id}>
                  overwrite “{displayBuildTitle(b, i)}”
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onSaveNamed}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              {overwriteId ? 'Save' : 'Save As'}
            </button>
          </div>
          {err ? <p className="text-xs text-rose-700">{err}</p> : null}
        </div>
      ) : (
        <div className="space-y-2 rounded-2xl border border-ink/10 bg-cream p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink/80">
            <Bookmark
              className="h-4 w-4 shrink-0 text-terracotta"
              strokeWidth={1.75}
              aria-hidden
            />
            Save your current plan as
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Plan ${slot}`}
              className="min-w-[7rem] flex-1 rounded-md border border-ink/15 bg-paper px-2 py-1 text-sm outline-none focus:border-terracotta/50"
              aria-label="Build name"
            />
            into
            <select
              value={slot}
              onChange={(e) => setSlot(e.target.value as BuildSlot)}
              className="rounded-md border border-ink/15 bg-paper px-2 py-1 text-sm"
              aria-label="Slot to save into"
            >
              {SLOTS.map((s) => (
                <option key={s} value={s}>
                  Slot {s}
                  {takenSlots.has(s) ? ' (replace)' : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onSave}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              Save
            </button>
          </div>
          {err ? <p className="text-xs text-rose-700">{err}</p> : null}
        </div>
      )}

      {/* Side-by-side comparison */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-ink/10 bg-cream px-4 py-10 text-center text-sm text-ink/60">
          No vendors in your plan yet. Shortlist some and add them on the Build tab, then save a plan
          to compare versions side by side.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink/10">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-ink/[0.03] text-left">
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">
                  Category
                </th>
                {columns.map((c) => {
                  const canApply = !c.isCurrent && c.snapshot.picks.some((p) => p.vendorId);
                  return (
                    <th
                      key={c.key}
                      className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55"
                    >
                      <div className={c.isCurrent ? 'text-terracotta' : 'text-ink/70'}>
                        {c.title}
                      </div>
                      {!c.isCurrent ? (
                        <div className="mt-0.5 flex flex-col items-end gap-0.5">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => onApply(c.snapshot, 'build')}
                              disabled={pending || !canApply}
                              aria-label={`Modify with ${c.title}`}
                              className="inline-flex items-center gap-0.5 text-[9px] normal-case tracking-normal text-ink/40 hover:text-terracotta disabled:opacity-40"
                            >
                              <Pencil className="h-3 w-3" strokeWidth={1.75} aria-hidden /> modify
                            </button>
                            <button
                              type="button"
                              onClick={() => onApply(c.snapshot, 'lock')}
                              disabled={pending || !canApply}
                              aria-label={`Lock ${c.title}`}
                              className="inline-flex items-center gap-0.5 text-[9px] normal-case tracking-normal text-ink/40 hover:text-terracotta disabled:opacity-40"
                            >
                              <Lock className="h-3 w-3" strokeWidth={1.75} aria-hidden /> lock
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(c.key)}
                              disabled={pending}
                              aria-label={`Delete ${c.title}`}
                              className="inline-flex items-center gap-0.5 text-[9px] normal-case tracking-normal text-ink/35 hover:text-rose-600 disabled:opacity-50"
                            >
                              <Trash2 className="h-3 w-3" strokeWidth={1.75} aria-hidden /> delete
                            </button>
                          </div>
                          {!canApply ? (
                            <span className="text-[9px] normal-case tracking-normal text-ink/30">
                              Re-save to enable
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.groupId} className="border-t border-ink/8 align-top">
                  <td className="px-3 py-2 text-ink/80">{r.label}</td>
                  {columns.map((c) => {
                    const p = c.picks.get(r.groupId);
                    const cellKey = `${c.key}::${r.groupId}`;
                    const inclusions = p?.inclusions ?? [];
                    const hasInclusions = inclusions.length > 0;
                    const isOpen = expanded.has(cellKey);
                    return (
                      <td key={c.key} className="px-2 py-2 text-right">
                        {p ? (
                          <>
                            <div className="flex items-center justify-end gap-1">
                              <span className="truncate font-medium text-ink">{p.vendorName}</span>
                              {hasInclusions ? (
                                <button
                                  type="button"
                                  onClick={() => toggleCell(cellKey)}
                                  aria-expanded={isOpen}
                                  aria-label={
                                    isOpen ? 'Hide inclusions' : 'Show inclusions'
                                  }
                                  className="shrink-0 text-ink/40 hover:text-terracotta"
                                >
                                  <ChevronDown
                                    className={`h-3.5 w-3.5 transition-transform ${
                                      isOpen ? 'rotate-180' : ''
                                    }`}
                                    strokeWidth={1.75}
                                    aria-hidden
                                  />
                                </button>
                              ) : null}
                            </div>
                            <div className="tabular-nums text-[11px] text-ink/55">
                              {peso(p.costPhp)}
                              {p.locked ? ' · locked' : ''}
                            </div>
                            {hasInclusions && isOpen ? (
                              <div className="mt-0.5 text-[10px] leading-snug text-ink/45">
                                {inclusions.map((inc, i) => (
                                  <span key={`${cellKey}-inc-${i}`}>
                                    {i === 0 ? '+ ' : ', '}
                                    {inc}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-ink/25">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t-2 border-ink/15 bg-ink/[0.02]">
                <td className="px-3 py-2 font-semibold text-ink">Total</td>
                {columns.map((c) => {
                  const ou = overUnder(c.total);
                  return (
                    <td key={c.key} className="px-2 py-2 text-right">
                      <div className="font-display text-base italic text-ink">{peso(c.total)}</div>
                      {ou ? <div className={`text-[10px] ${ou.tone}`}>{ou.text}</div> : null}
                    </td>
                  );
                })}
              </tr>
              {availability ? (
                <tr className="border-t border-ink/10">
                  <td className="px-3 py-2 align-top text-[11px] leading-snug text-ink/55">
                    Dates that work
                    <span className="block text-[10px] text-ink/40">in {availability.windowLabel}</span>
                  </td>
                  {columns.map((c) => {
                    const a = availability.byColumn[c.key];
                    return (
                      <td key={c.key} className="px-2 py-2 text-right align-top">
                        {!a || a.connectedCount === 0 ? (
                          <span
                            className="text-[10px] text-ink/35"
                            title="No Setnayan-connected vendors in this build to check calendars for"
                          >
                            —
                          </span>
                        ) : a.conflictText ? (
                          <span className="block text-[10px] leading-snug text-rose-700">
                            {a.conflictText}
                          </span>
                        ) : (
                          <span className="block text-[10px] leading-snug text-emerald-700">
                            {a.totalAvailable} day{a.totalAvailable === 1 ? '' : 's'} free
                            {a.dayLabels.length > 0
                              ? ` · ${a.dayLabels.join(' · ')}${a.moreCount > 0 ? ` +${a.moreCount}` : ''}`
                              : ''}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-ink/45">
        <span className="text-terracotta">Current</span> is your live plan.{' '}
        {named
          ? 'Save it as a new named build to bank a version, then change your picks and save another to compare.'
          : 'Save it into a slot to bank a version, then change your picks and save another to compare.'}{' '}
        Use <span className="text-ink/70">Modify</span> to load a saved plan back into your working
        build, or <span className="text-ink/70">Lock</span> to load it and head to the Lock tab to
        finalize those vendors.
      </p>
    </div>
  );
}
