'use client';

/**
 * BuildCompare — the Compare tab (PR F of the 0016 Plan Builder redesign).
 *
 * Retires the Lean/Fits/Stretch budget-estimate baskets for the named-builds
 * model: a "build" is a named snapshot of the couple's REAL vendor picks per
 * category. The couple saves their current plan as a named build, tweaks their
 * picks on Build/Shortlist, saves another, and compares the actual vendors side
 * by side against their budget. Builds live in `budget_builds`; picks live in
 * the `snapshot` JSONB.
 *
 * Client component. Per-build Modify/Lock are now implemented: each saved build
 * can load its vendor picks into the live working build and jump to the Build
 * tab (Modify) or the Lock tab (Lock) — Lock does NOT bulk-finalize here, it just
 * loads the picks and routes to the Lock tab's hardened finalize flow.
 *
 * ── PR-F · "Plans" reframe (Explore_Replan_BUILD_SPEC_2026-07-27 §3 PR-F + §8),
 * behind `isExploreReplanEnabled()` — flag OFF renders exactly as before:
 *   • the section is "Plans" (label only — the tab key stays `compare`),
 *   • LOCKED categories are PINNED: one identical row across every column,
 *     because a plan may only vary the candidate categories (§2 #10),
 *   • saved plans get a first-class named-row list with a **Load** button
 *     (Compare's "Modify" promoted) that never re-opens a locked category,
 *   • "Clear candidates" MOVED to "Your team" in PR-E (spec §8.3) — one place.
 */

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bookmark,
  ChevronDown,
  FolderOpen,
  Loader2,
  Lock,
  Pencil,
  Trash2,
} from 'lucide-react';
import {
  savePlanBuildNamed,
  deleteBudgetBuild,
  type SavedPlanBuild,
  type PlanBuildSnapshot,
} from '../build-actions';
import { applyBuildToWorking } from '../build-pick-actions';
import { useSaveLoader } from '@/components/sd-loader';
import { goToBuildTab } from './services-takeover';
import { requestPlanRename } from '@/lib/budget-build';
import {
  sortSavedBuilds,
  displayBuildTitle,
  normalizeBuildTitle,
} from '@/lib/named-builds';
import { isExploreReplanEnabled } from '@/lib/explore-replan-flag';
import {
  lockedGroupIdsOf,
  partitionPlanRows,
  planPicksToApply,
  isPlanLoadable,
} from '@/lib/plans-panel';
import { useConfirm } from '@/app/_components/confirm-dialog';

const peso = (php: number | null) =>
  php == null ? '—' : `₱${Math.round(php).toLocaleString('en-PH')}`;

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

// ── B5 · The anchored-date verdict (2026-08-14) ─────────────────────────────
// `CompareAvailability` above answers "which days COULD work" and only renders
// for year/month-precision events. Both real production events are
// day-precision, so that row has never once been reachable on real data —
// dormant, not broken.
//
// Once a couple has COMMITTED to a date, "17 days free in November" is the
// wrong question; the only one left is whether the people in this plan are free
// on THAT day. So this is a separate shape rather than a widening of the one
// above: different question, different sentence, mutually exclusive by
// precision — exactly one of the two is ever non-null.
//
// The per-vendor free/booked data is NOT re-queried. `page.tsx` already
// computes `dateFitByVendorId` for the bench's date badge via the batched
// `getBatchVendorAvailableDays`; this reuses that map, so the row costs zero
// extra calendar reads.
export type CompareAnchoredDate = {
  /** The couple's committed date, pre-formatted ("12 Dec 2026"). */
  dateLabel: string;
  /** Keyed by build_id, plus 'current' for the live column. */
  byColumn: Record<
    string,
    {
      /** Connected vendors in this column whose calendar we could actually read. */
      checkedCount: number;
      /** Names of those booked on the day — the whole point of the row. */
      bookedNames: string[];
    }
  >;
};

export function BuildCompare({
  eventId,
  budgetPhp,
  currentPlan,
  savedBuilds,
  availability = null,
  anchoredDate = null,
}: {
  eventId: string;
  budgetPhp: number | null;
  currentPlan: PlanBuildSnapshot;
  savedBuilds: SavedPlanBuild[];
  availability?: CompareAvailability | null;
  /** B5 — the day-precision counterpart of `availability`. Never both. */
  anchoredDate?: CompareAnchoredDate | null;
}) {
  const router = useRouter();
  // PR-F: every user-visible delta below is gated on this. Read once so the
  // whole surface agrees within a render.
  const replan = isExploreReplanEnabled();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  // Save-As: '' = create a new named build; a build_id = overwrite.
  const [overwriteId, setOverwriteId] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);
  // Per-cell inclusion expand state, keyed `${columnKey}::${groupId}`.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  // Confirm-first guard for Modify (it overwrites the working build).
  const { confirm, dialog } = useConfirm();
  const save = useSaveLoader();

  // Stable column order (named builds oldest-first).
  const orderedBuilds = useMemo(() => sortSavedBuilds(savedBuilds), [savedBuilds]);

  // Columns = saved builds, then the live "Current" plan last.
  const columns = useMemo(() => {
    const cols = orderedBuilds.map((b, i) => ({
      key: b.build_id,
      // Named-builds display title ("Build N" fallback for an untitled row).
      title: displayBuildTitle(b, i),
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
  }, [orderedBuilds, currentPlan]);

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

  // ── PR-F · pinned locked rows ─────────────────────────────────────────────
  // The categories the couple has LOCKED right now (the live plan is the
  // authority — a saved snapshot's `locked` flag is historical). These pin: one
  // identical row across every column, never per-column editable, and every
  // Load filters them out so a plan can't re-open a contract.
  const lockedGroups = useMemo(() => lockedGroupIdsOf(currentPlan.picks), [currentPlan]);
  const { lockedRows, candidateRows } = useMemo(
    () =>
      partitionPlanRows({
        currentPicks: currentPlan.picks,
        savedPickSets: orderedBuilds.map((b) => b.snapshot.picks ?? []),
      }),
    [currentPlan, orderedBuilds],
  );
  // Rows the matrix actually renders below the pinned block.
  const bodyRows = replan ? candidateRows : rows;
  // Candidates = the live picks a plan may vary (locked ones are contracts).
  const candidateCount = currentPlan.picks.filter((p) => !p.locked).length;

  // (The blank-name auto-naming hint moved to `TeamSavePlan` with the save bar —
  // spec §3 item 6. Only the flag-OFF bar remains here, and it has never had one.)

  const overUnder = (total: number | null) => {
    if (total == null || budgetPhp == null) return null;
    const diff = total - budgetPhp;
    if (Math.abs(diff) < 1) return { text: 'on budget', tone: 'text-success-700' };
    return diff > 0
      ? { text: `${peso(diff)} over`, tone: 'text-danger-700' }
      : { text: `${peso(-diff)} to spare`, tone: 'text-success-700' };
  };

  // Save-As: create a NEW named build, or overwrite the chosen one.
  function onSaveNamed() {
    setErr(null);
    if (currentPlan.picks.length === 0) {
      setErr('Add some vendors to your plan first — shortlist on the Build tab, then save.');
      return;
    }
    startTransition(async () => {
      const res = await save.run(
        () =>
          savePlanBuildNamed({
            eventId,
            rawName: name,
            overwriteBuildId: overwriteId || null,
            snapshot: currentPlan,
          }),
        { steps: ['Saving your build'], hint: 'Saving' },
      );
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
      const res = await save.run(() => deleteBudgetBuild({ eventId, buildId }), {
        steps: ['Deleting your build'],
        hint: 'Saving',
      });
      if (!res.ok) setErr(res.error);
      else router.refresh();
    });
  }

  // ("Clear candidates" used to live here. It MOVED to "Your team" in PR-E —
  // spec §8.3 puts the team's reset next to the team it resets, and there must
  // be exactly one. See `_components/team-controls.tsx`.)

  // Load a saved build's picks into the working build, then jump to a tab. Lock
  // does NOT finalize here — the Lock tab hosts the hardened finalize flow.
  //
  // BOTH Modify and Lock OVERWRITE the live working build with this saved
  // build's picks, so we confirm first when there's a current build to lose (an
  // empty working build has nothing to discard → no prompt). The couple's
  // current picks aren't kept unless they were already saved as their own build.
  async function onApply(
    snapshot: PlanBuildSnapshot,
    destination: 'build' | 'lock',
    title: string,
  ) {
    setErr(null);
    // Flag off: prompt whenever there's a current build to lose (shipped rule).
    // Flag on: only CANDIDATES can be lost — locked picks survive a Load.
    if (replan ? candidateCount > 0 : currentPlan.picks.length > 0) {
      const ok = await confirm({
        title: replan ? 'Load this plan?' : 'Replace your current build?',
        body: replan ? (
          <>
            <span className="font-medium text-ink">“{title}”</span>’s candidates replace the ones in
            your build right now. Your locked vendors are untouched — they’re in every plan. Save
            your current candidates as a plan first if you want to keep them.
          </>
        ) : (
          <>
            This replaces your current build with{' '}
            <span className="font-medium text-ink">“{title}”</span>. Save your current plan first if
            you want to keep it.
          </>
        ),
        confirmLabel: replan ? 'Load' : destination === 'lock' ? 'Lock' : 'Replace',
        cancelLabel: 'Cancel',
        destructive: true,
      });
      if (!ok) return;
    }
    // PR-F: a plan may only vary the UNLOCKED categories, so a Load drops every
    // pick in a locked group (and the action re-checks server-side). Flag off →
    // the shipped "every pick with a vendorId" behaviour, unchanged.
    const picks = replan
      ? planPicksToApply({ snapshotPicks: snapshot.picks, lockedGroupIds: lockedGroups })
      : snapshot.picks
          .filter((p) => p.vendorId)
          .map((p) => ({ planGroupId: p.groupId, vendorId: p.vendorId! }));
    startTransition(async () => {
      const res = await applyBuildToWorking({
        eventId,
        picks,
        ...(replan ? { lockedPlanGroupIds: lockedGroups } : {}),
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.refresh();
      // "Build absorbs Lock" 2026-06-20 (PR2): the standalone Lock tab is gone —
      // the lock action + locked list now live in Build. The per-column "lock"
      // button keeps its "Lock" confirm-label intent but lands the couple on the
      // Build tab (where they confirm), not the removed Lock tab.
      goToBuildTab(destination === 'lock' ? 'build' : destination);
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-1 py-2">
      {dialog}
      <div className="space-y-1">
        {/* No card title inside a named section — the section heading ("Your
            plans", `services-takeover.tsx`) is the only title
            (`Explore_Integration_BUILD_SPEC_2026-07-29.md` §2: today each
            section names itself twice). Flag-ON only: with the replan OFF this
            component still renders standalone-ish copy, so it keeps its own h2. */}
        {replan ? null : (
          <h2 className="font-display text-2xl italic text-ink">Compare your plans</h2>
        )}
        <p className="text-sm text-ink/60">
          {replan
            ? 'Name a set of candidates as a plan, load one back any time, and put them side by side'
            : 'Save versions of your plan and compare the real vendors side by side'}
          {budgetPhp != null ? `, against your ${peso(budgetPhp)} budget` : ''}.
          {replan ? ' Locked vendors are pinned in every plan.' : ''}
        </p>
      </div>

      {/* Save current plan as a free-form named build (new, or overwrite).
          MOVED to "Your team" 2026-07-29 behind the replan flag
          (`Explore_Integration_BUILD_SPEC_2026-07-29.md` §3 item 6) — you save
          the team where the team is, not at the top of the panel that only
          compares plans. A MOVE: flag ON this renders nothing, and
          `TeamSavePlan` is the only save bar on the page. */}
      {replan ? null : (
        <div className="sn-tile space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink/80">
            <Bookmark className="h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} aria-hidden />
            Save your current plan as
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              // §7a: the placeholder IS the name a blank save will get, so the
              // auto-name is never a surprise. Optional field — never validated.
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
          {err ? <p className="text-xs text-danger-700">{err}</p> : null}
        </div>
      )}

      {/* Flag ON, Load / Delete need somewhere to report. Their only render site
          USED to be inside the save card above — which, now that the card lives
          on the team, would have left every error on this panel invisible.
          Flag OFF this renders nothing: the card's own line (unchanged) has it. */}
      {replan && err ? <p className="text-xs text-danger-700">{err}</p> : null}

      {/* ── PR-F · the Plans list: named rows + a first-class Load ───────────
          Each saved plan is a NAMED row you can load straight back into your
          build (Compare's old per-column "modify" promoted to a real control).
          Its counterpart, "Clear candidates", now lives on Your team (PR-E ·
          spec §8.3) — the surface that owns the team owns emptying it. */}
      {replan ? (
        <div className="sn-tile space-y-2 p-4">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">
            Your saved plans
          </h3>
          {orderedBuilds.length === 0 ? (
            <p className="text-sm text-ink/55">
              No saved plans yet. Add candidates to your build, then save your team under a name.
            </p>
          ) : (
            <ul className="divide-y divide-ink/8">
              {orderedBuilds.map((b, i) => {
                const title = displayBuildTitle(b, i);
                const loadable = isPlanLoadable({
                  snapshotPicks: b.snapshot.picks ?? [],
                  lockedGroupIds: lockedGroups,
                });
                return (
                  <li
                    key={b.build_id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                      {title}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-ink/55">
                      {peso(b.total_php)}
                    </span>
                    <button
                      type="button"
                      // §7a "make renaming easy": load this plan's name into the
                      // Save-As bar with itself pre-selected as the overwrite
                      // target — typing + Save renames it in place (the shipped
                      // savePlanBuildNamed overwrite path, no new machinery).
                      //
                      // That bar now lives in "Your team" (spec §3 item 6), so
                      // the handoff goes over the rename bus and we scroll the
                      // couple to it — otherwise Rename would silently fill a
                      // field they can't see.
                      onClick={() => {
                        setErr(null);
                        requestPlanRename({
                          buildId: b.build_id,
                          name: normalizeBuildTitle(b.title) ?? title,
                        });
                        goToBuildTab('build');
                      }}
                      disabled={pending}
                      aria-label={`Rename ${title}`}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-ink/45 transition hover:text-terracotta disabled:opacity-50"
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => onApply(b.snapshot, 'build', title)}
                      disabled={pending || !loadable}
                      title={
                        loadable
                          ? undefined
                          : 'Nothing to load — every vendor in this plan is either locked already or no longer on your shortlist.'
                      }
                      className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-2.5 py-1 text-xs font-medium text-ink/75 transition hover:border-terracotta/50 hover:text-terracotta disabled:opacity-40"
                    >
                      <FolderOpen className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                      Load
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(b.build_id)}
                      disabled={pending}
                      aria-label={`Delete ${title}`}
                      className="shrink-0 rounded-full p-1 text-ink/35 transition hover:text-danger-600 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/8 pt-2">
            <span className="text-xs text-ink/50">
              Current team{' '}
              <span className="font-mono tabular-nums text-ink/70">{peso(currentPlan.totalPhp)}</span>
            </span>
          </div>
        </div>
      ) : null}

      {/* Side-by-side comparison */}
      {rows.length === 0 ? (
        <div className="sn-tile px-4 py-10 text-center text-sm text-ink/60">
          {replan
            ? 'No vendors in your team yet. Add some candidates from the bench, then save them under a name to compare plans side by side.'
            : 'No vendors in your plan yet. Shortlist some and add them on the Build tab, then save a plan to compare versions side by side.'}
        </div>
      ) : (
        <div className="sn-tile overflow-x-auto p-0">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-ink/[0.03] text-left">
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">
                  Category
                </th>
                {columns.map((c) => {
                  const canApply =
                    !c.isCurrent &&
                    (replan
                      ? isPlanLoadable({
                          snapshotPicks: c.snapshot.picks ?? [],
                          lockedGroupIds: lockedGroups,
                        })
                      : c.snapshot.picks.some((p) => p.vendorId));
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
                              onClick={() => onApply(c.snapshot, 'build', c.title)}
                              disabled={pending || !canApply}
                              aria-label={replan ? `Load ${c.title}` : `Modify with ${c.title}`}
                              className="inline-flex items-center gap-0.5 text-[9px] normal-case tracking-normal text-ink/40 hover:text-terracotta disabled:opacity-40"
                            >
                              {replan ? (
                                <>
                                  <FolderOpen className="h-3 w-3" strokeWidth={1.75} aria-hidden />{' '}
                                  load
                                </>
                              ) : (
                                <>
                                  <Pencil className="h-3 w-3" strokeWidth={1.75} aria-hidden />{' '}
                                  modify
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => onApply(c.snapshot, 'lock', c.title)}
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
                              className="inline-flex items-center gap-0.5 text-[9px] normal-case tracking-normal text-ink/35 hover:text-danger-600 disabled:opacity-50"
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
              {/* PINNED locked rows (PR-F · spec §2 #10). A locked vendor is a
                  contract, so it is IDENTICAL in every plan — rendered once
                  across the full column span rather than per-column, and with
                  no per-column control. Plans may only vary what's below. */}
              {replan
                ? lockedRows.map((r) => (
                    <tr key={`locked-${r.groupId}`} className="border-t border-ink/8 bg-ink/[0.02]">
                      <td className="px-3 py-2 text-ink/80">
                        <span className="mr-1 text-success-700" aria-hidden>
                          ●
                        </span>
                        {r.label}
                      </td>
                      <td
                        colSpan={columns.length}
                        className="px-2 py-2 text-center text-[11px] leading-snug text-ink/70"
                      >
                        <span className="font-medium text-ink">{r.vendorName}</span>
                        <span className="tabular-nums"> · {peso(r.costPhp)}</span>
                        <span className="text-ink/45"> — locked, the same in every plan</span>
                      </td>
                    </tr>
                  ))
                : null}
              {bodyRows.map((r) => (
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
                          <span className="block text-[10px] leading-snug text-danger-700">
                            {a.conflictText}
                          </span>
                        ) : (
                          <span className="block text-[10px] leading-snug text-success-700">
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
              {/* B5 — the anchored-date verdict. Renders instead of the window
                  row above once the couple has committed to a day. Three
                  states, and the middle one is the reason the row exists: a
                  plan can be affordable and still be impossible. */}
              {anchoredDate ? (
                <tr className="border-t border-ink/10">
                  <td className="px-3 py-2 align-top text-[11px] leading-snug text-ink/55">
                    On your date
                    <span className="block text-[10px] text-ink/40">
                      {anchoredDate.dateLabel}
                    </span>
                  </td>
                  {columns.map((c) => {
                    const a = anchoredDate.byColumn[c.key];
                    return (
                      <td key={c.key} className="px-2 py-2 text-right align-top">
                        {!a || a.checkedCount === 0 ? (
                          <span
                            className="text-[10px] text-ink/35"
                            title="No Setnayan-connected vendors in this plan to check calendars for"
                          >
                            —
                          </span>
                        ) : a.bookedNames.length === 0 ? (
                          <span className="block text-[10px] leading-snug text-success-700">
                            Everyone here is free
                          </span>
                        ) : (
                          <span className="block text-[10px] leading-snug text-danger-700">
                            {a.bookedNames.join(', ')} booked that day
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

      {replan ? (
        <p className="text-xs text-ink/45">
          <span className="text-success-700">●</span> Locked picks are{' '}
          <span className="text-ink/70">pinned identical rows</span> — every plan has them. The rows
          below are your <span className="text-ink/70">candidates</span>: save different candidate
          sets under different names, compare them here, then lock the winner.{' '}
          <span className="text-ink/70">Load</span> puts a saved plan’s candidates back into your
          build — your locked vendors are never touched.
        </p>
      ) : (
        <p className="text-xs text-ink/45">
          <span className="text-terracotta">Current</span> is your live plan. Save it as a new named
          build to bank a version, then change your picks and save another to compare. Use{' '}
          <span className="text-ink/70">Modify</span> to load a saved plan back into your working
          build, or <span className="text-ink/70">Lock</span> to load it and head to the Lock tab to
          finalize those vendors.
        </p>
      )}
    </div>
  );
}
