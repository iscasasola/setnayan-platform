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
 * Client component. (Per-build Modify/Lock — reload a snapshot into the live
 * plan / bulk-finalize — is a follow-up; locking stays the Shortlist flow.)
 */

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, Loader2, Trash2 } from 'lucide-react';
import {
  savePlanBuild,
  deleteBudgetBuild,
  type SavedPlanBuild,
  type PlanBuildSnapshot,
  type BuildSlot,
} from '../build-actions';

const peso = (php: number | null) =>
  php == null ? '—' : `₱${Math.round(php).toLocaleString('en-PH')}`;
const SLOTS: BuildSlot[] = ['A', 'B', 'C'];

export function BuildCompare({
  eventId,
  budgetPhp,
  currentPlan,
  savedBuilds,
}: {
  eventId: string;
  budgetPhp: number | null;
  currentPlan: PlanBuildSnapshot;
  savedBuilds: SavedPlanBuild[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const takenSlots = useMemo(() => new Set(savedBuilds.map((b) => b.label)), [savedBuilds]);
  const [slot, setSlot] = useState<BuildSlot>(SLOTS.find((s) => !takenSlots.has(s)) ?? 'A');
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);

  // Columns = saved builds, then the live "Current" plan last.
  const columns = useMemo(() => {
    const cols = savedBuilds.map((b) => ({
      key: b.build_id,
      title: b.title ?? `Plan ${b.label}`,
      total: b.total_php,
      picks: new Map(b.snapshot.picks.map((p) => [p.groupId, p])),
      isCurrent: false,
    }));
    cols.push({
      key: 'current',
      title: 'Current',
      total: currentPlan.totalPhp,
      picks: new Map(currentPlan.picks.map((p) => [p.groupId, p])),
      isCurrent: true,
    });
    return cols;
  }, [savedBuilds, currentPlan]);

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
        snapshot: currentPlan,
      });
      if (!res.ok) setErr(res.error);
      else {
        setName('');
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

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-1 py-2">
      <div className="space-y-1">
        <h2 className="font-display text-2xl italic text-ink">Compare your plans</h2>
        <p className="text-sm text-ink/60">
          Save versions of your plan and compare the real vendors side by side
          {budgetPhp != null ? `, against your ${peso(budgetPhp)} budget` : ''}.
        </p>
      </div>

      {/* Save current plan into a named slot */}
      <div className="space-y-2 rounded-2xl border border-ink/10 bg-cream p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink/80">
          <Bookmark className="h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} aria-hidden />
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
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55"
                  >
                    <div className={c.isCurrent ? 'text-terracotta' : 'text-ink/70'}>{c.title}</div>
                    {!c.isCurrent ? (
                      <button
                        type="button"
                        onClick={() => onDelete(c.key)}
                        disabled={pending}
                        aria-label={`Delete ${c.title}`}
                        className="mt-0.5 inline-flex items-center gap-0.5 text-[9px] normal-case tracking-normal text-ink/35 hover:text-rose-600 disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" strokeWidth={1.75} aria-hidden /> delete
                      </button>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.groupId} className="border-t border-ink/8 align-top">
                  <td className="px-3 py-2 text-ink/80">{r.label}</td>
                  {columns.map((c) => {
                    const p = c.picks.get(r.groupId);
                    return (
                      <td key={c.key} className="px-2 py-2 text-right">
                        {p ? (
                          <>
                            <div className="truncate font-medium text-ink">{p.vendorName}</div>
                            <div className="tabular-nums text-[11px] text-ink/55">
                              {peso(p.costPhp)}
                              {p.locked ? ' · locked' : ''}
                            </div>
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
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-ink/45">
        <span className="text-terracotta">Current</span> is your live plan. Save it into a slot to
        bank a version, then change your picks and save another to compare. Locking stays on the
        Shortlist.
      </p>
    </div>
  );
}
