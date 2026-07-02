'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Plus, X, Trash2, Check, Tag, Folder, Search, ChevronRight, ChevronLeft } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  createCoverage,
  updateCoverageServes,
  deleteCoverage,
} from '../coverage-actions';

/**
 * Coverage-first management (Vendor Services rework 2026-07-02 · Phase 2). A
 * coverage is a taxonomy leaf (canonical_service) a vendor serves + WHO they
 * serve it for: event types AND faiths ("Serves"). "Add coverage" is a
 * search-first, 3-per-row drill of the LIVE admin taxonomy (parent → branch →
 * leaf) with a breadcrumb that jumps to any level. Already-covered leaves lock
 * out; event types are constrained by the leaf; faiths default to "all welcome".
 */

export type CoverageLeaf = {
  canonicalService: string;
  label: string;
  allowedEventTypes: string[] | null;
};
export type CoverageBranch = { tileId: string; label: string; leaves: CoverageLeaf[] };
export type CoverageParent = { folderId: string; label: string; branches: CoverageBranch[] };
export type EventTypeOption = { key: string; label: string };
export type FaithOption = { key: string; label: string };
export type ParentUsage = { used: number; cap: number };
export type CoverageItem = {
  id: number;
  canonicalService: string;
  pathLabel: string;
  eventTypes: string[];
  faiths: string[];
  serviceCount: number;
};

const line = 'var(--m-line)';
const paper = 'var(--m-paper)';

export function CoveragePanel({
  tree,
  coverages,
  eventTypeOptions,
  faithOptions,
  parentUsage,
}: {
  tree: CoverageParent[];
  coverages: CoverageItem[];
  eventTypeOptions: EventTypeOption[];
  faithOptions: FaithOption[];
  parentUsage: ParentUsage;
}) {
  const [adding, setAdding] = useState(false);
  const eventLabel = useMemo(() => {
    const m = new Map(eventTypeOptions.map((e) => [e.key, e.label]));
    return (k: string) => m.get(k) ?? k;
  }, [eventTypeOptions]);
  const faithLabel = useMemo(() => {
    const m = new Map(faithOptions.map((f) => [f.key, f.label]));
    return (k: string) => m.get(k) ?? k;
  }, [faithOptions]);
  const covered = useMemo(
    () => new Set(coverages.map((c) => c.canonicalService)),
    [coverages],
  );
  const capLabel = Number.isFinite(parentUsage.cap) ? String(parentUsage.cap) : '∞';
  const overCap = Number.isFinite(parentUsage.cap) && parentUsage.used > parentUsage.cap;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2
            className="font-mono text-[11px] font-medium uppercase tracking-[0.18em]"
            style={{ color: 'var(--m-slate-3)' }}
          >
            Your coverage · categories you serve
          </h2>
          <p className="mt-0.5 text-[11px]" style={{ color: overCap ? 'var(--m-blush-deep)' : 'var(--m-slate-3)' }}>
            Parent categories {parentUsage.used} of {capLabel}
            {overCap ? ' · upgrade to add more' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium"
          style={{ color: 'var(--m-orange-2)' }}
        >
          {adding ? <X className="h-4 w-4" strokeWidth={2} /> : <Plus className="h-4 w-4" strokeWidth={2} />}
          {adding ? 'Cancel' : 'Add coverage'}
        </button>
      </div>

      {adding ? (
        <AddCoverage
          tree={tree}
          covered={covered}
          eventTypeOptions={eventTypeOptions}
          faithOptions={faithOptions}
          onDone={() => setAdding(false)}
        />
      ) : null}

      {coverages.length === 0 && !adding ? (
        <div
          className="rounded-2xl border border-dashed p-6 text-center text-sm"
          style={{ borderColor: line, background: paper, color: 'var(--m-slate-2)' }}
        >
          No coverage yet. Add a category you serve — then build service cards inside it.
        </div>
      ) : (
        <ul className="space-y-2">
          {coverages.map((c) => (
            <CoverageRow
              key={c.id}
              coverage={c}
              eventTypeOptions={eventTypeOptions}
              faithOptions={faithOptions}
              eventLabel={eventLabel}
              faithLabel={faithLabel}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function CoverageRow({
  coverage,
  eventTypeOptions,
  faithOptions,
  eventLabel,
  faithLabel,
}: {
  coverage: CoverageItem;
  eventTypeOptions: EventTypeOption[];
  faithOptions: FaithOption[];
  eventLabel: (k: string) => string;
  faithLabel: (k: string) => string;
}) {
  const [editing, setEditing] = useState(false);
  const faithSummary =
    coverage.faiths.length === 0 ? 'All faiths' : coverage.faiths.map(faithLabel).join(', ');
  return (
    <li
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: line, background: paper }}
    >
      <div className="flex items-center gap-3 p-4">
        <span
          aria-hidden
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'var(--m-paper-2)', color: 'var(--m-slate)' }}
        >
          <Folder className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
            {coverage.pathLabel}
          </p>
          <p className="truncate text-xs" style={{ color: 'var(--m-slate-2)' }}>
            {coverage.eventTypes.map(eventLabel).join(' · ') || 'No event types'}
            {' · '}
            {faithSummary}
            {' · '}
            {coverage.serviceCount} card{coverage.serviceCount === 1 ? '' : 's'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium"
          style={{ borderColor: line, color: 'var(--m-slate)' }}
        >
          <Tag className="h-3.5 w-3.5" strokeWidth={1.75} />
          Serves
        </button>
        <form
          action={deleteCoverage}
          onSubmit={(e) => {
            if (
              !confirm(
                `Remove "${coverage.pathLabel}"? This drops it from search` +
                  (coverage.serviceCount > 0
                    ? ` and unlinks its ${coverage.serviceCount} service card${coverage.serviceCount === 1 ? '' : 's'}.`
                    : '.'),
              )
            )
              e.preventDefault();
          }}
        >
          <input type="hidden" name="coverage_id" value={coverage.id} />
          <button
            type="submit"
            aria-label="Remove coverage"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border"
            style={{ borderColor: line, color: 'var(--m-blush-deep)' }}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </form>
      </div>

      {editing ? (
        <form
          action={updateCoverageServes}
          className="space-y-4 border-t px-4 pb-4 pt-3"
          style={{ borderColor: line }}
        >
          <input type="hidden" name="coverage_id" value={coverage.id} />
          <div className="space-y-2">
            <SubLabel>Event types you cater · couples planning these find you</SubLabel>
            <div className="flex flex-wrap gap-2">
              {eventTypeOptions.map((e) => (
                <CheckChip key={e.key} name="event_types" value={e.key} defaultChecked={coverage.eventTypes.includes(e.key)}>
                  {e.label}
                </CheckChip>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <SubLabel>Faiths you serve · leave all off = welcome every faith</SubLabel>
            <div className="flex flex-wrap gap-2">
              {faithOptions.map((f) => (
                <CheckChip key={f.key} name="faiths" value={f.key} defaultChecked={coverage.faiths.includes(f.key)}>
                  {f.label}
                </CheckChip>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <SubmitButton className="button-primary" pendingLabel="Saving…">
              Save
            </SubmitButton>
          </div>
        </form>
      ) : null}
    </li>
  );
}

type LeafHit = {
  leaf: CoverageLeaf;
  parentId: string;
  branchId: string;
  parentLabel: string;
  branchLabel: string;
};

function AddCoverage({
  tree,
  covered,
  eventTypeOptions,
  faithOptions,
  onDone,
}: {
  tree: CoverageParent[];
  covered: Set<string>;
  eventTypeOptions: EventTypeOption[];
  faithOptions: FaithOption[];
  onDone: () => void;
}) {
  const [query, setQuery] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [leaf, setLeaf] = useState<CoverageLeaf | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [faiths, setFaiths] = useState<string[]>([]);

  const parent = tree.find((p) => p.folderId === parentId) ?? null;
  const branch = parent?.branches.find((b) => b.tileId === branchId) ?? null;

  // Flat leaf index for search (across every level, with its path).
  const allLeaves = useMemo<LeafHit[]>(() => {
    const out: LeafHit[] = [];
    for (const p of tree)
      for (const b of p.branches)
        for (const l of b.leaves)
          out.push({ leaf: l, parentId: p.folderId, branchId: b.tileId, parentLabel: p.label, branchLabel: b.label });
    return out;
  }, [tree]);

  const q = query.trim().toLowerCase();
  const searchHits = useMemo<LeafHit[]>(() => {
    if (!q) return [];
    return allLeaves
      .filter(
        (h) =>
          h.leaf.label.toLowerCase().includes(q) ||
          h.leaf.canonicalService.toLowerCase().includes(q) ||
          h.parentLabel.toLowerCase().includes(q) ||
          h.branchLabel.toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [q, allLeaves]);

  const allowedEventOptions = useMemo(() => {
    if (!leaf) return [] as EventTypeOption[];
    if (!leaf.allowedEventTypes || leaf.allowedEventTypes.length === 0) return eventTypeOptions;
    const allow = new Set(leaf.allowedEventTypes);
    return eventTypeOptions.filter((e) => allow.has(e.key));
  }, [leaf, eventTypeOptions]);

  function pickLeaf(hit: { leaf: CoverageLeaf; parentId: string; branchId: string }) {
    if (covered.has(hit.leaf.canonicalService)) return;
    setLeaf(hit.leaf);
    setParentId(hit.parentId);
    setBranchId(hit.branchId);
    setQuery('');
    const allow = hit.leaf.allowedEventTypes && hit.leaf.allowedEventTypes.length ? new Set(hit.leaf.allowedEventTypes) : null;
    setEvents(!allow || allow.has('wedding') ? ['wedding'] : []);
    setFaiths([]);
  }
  function toggle(list: string[], k: string) {
    return list.includes(k) ? list.filter((x) => x !== k) : [...list, k];
  }

  const canSave = leaf !== null && events.length > 0;

  // ── Confirm / Serves step (a leaf is picked) ────────────────────────────
  if (leaf) {
    const path = `${parent?.label ?? ''} › ${branch?.label ?? ''}`;
    return (
      <form
        action={createCoverage}
        onSubmit={() => onDone()}
        className="space-y-4 rounded-2xl border p-4"
        style={{ borderColor: 'var(--m-orange-3)', background: paper }}
      >
        <input type="hidden" name="canonical_service" value={leaf.canonicalService} />

        <button
          type="button"
          onClick={() => setLeaf(null)}
          className="inline-flex items-center gap-1 text-xs font-medium"
          style={{ color: 'var(--m-slate-2)' }}
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Back to categories
        </button>

        <div>
          <p className="text-[11px]" style={{ color: 'var(--m-slate-3)' }}>{path}</p>
          <p className="text-base font-semibold" style={{ color: 'var(--m-ink)' }}>
            Add “{leaf.label}” to your coverage?
          </p>
        </div>

        <div className="space-y-2">
          <SubLabel>Event types you cater</SubLabel>
          <div className="flex flex-wrap gap-2">
            {allowedEventOptions.map((e) => {
              const on = events.includes(e.key);
              return (
                <SelectChip key={e.key} on={on}>
                  <input type="checkbox" name="event_types" value={e.key} checked={on} onChange={() => setEvents((c) => toggle(c, e.key))} className="hidden" />
                  {e.label}
                </SelectChip>
              );
            })}
          </div>
          <p className="text-[11px]" style={{ color: 'var(--m-slate-3)' }}>
            Only the events this category can serve are shown.
          </p>
        </div>

        <div className="space-y-2">
          <SubLabel>Faiths you serve</SubLabel>
          <div className="flex flex-wrap gap-2">
            {faithOptions.map((f) => {
              const on = faiths.includes(f.key);
              return (
                <SelectChip key={f.key} on={on}>
                  <input type="checkbox" name="faiths" value={f.key} checked={on} onChange={() => setFaiths((c) => toggle(c, f.key))} className="hidden" />
                  {f.label}
                </SelectChip>
              );
            })}
          </div>
          <p className="text-[11px]" style={{ color: 'var(--m-slate-3)' }}>
            Leave all off to welcome every faith.
          </p>
        </div>

        <div className="flex items-center justify-between pt-1">
          <button type="button" onClick={onDone} className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
            Cancel
          </button>
          <SubmitButton className="button-primary disabled:opacity-50" pendingLabel="Adding…" disabled={!canSave}>
            Add coverage
          </SubmitButton>
        </div>
      </form>
    );
  }

  // ── Drill / search step (no leaf yet) ───────────────────────────────────
  return (
    <div className="space-y-3 rounded-2xl border p-4" style={{ borderColor: 'var(--m-orange-3)', background: paper }}>
      {/* Search */}
      <label className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: line, background: 'var(--m-paper-2)' }}>
        <Search className="h-4 w-4 shrink-0" strokeWidth={1.75} style={{ color: 'var(--m-slate-3)' }} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search categories — e.g. photography, catering, lights"
          className="w-full bg-transparent text-sm outline-none"
          style={{ color: 'var(--m-ink)' }}
        />
      </label>

      {q ? (
        // Flat search results
        searchHits.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {searchHits.map((h) => {
              const taken = covered.has(h.leaf.canonicalService);
              return (
                <GridCard
                  key={h.leaf.canonicalService}
                  label={h.leaf.label}
                  sub={`${h.parentLabel} › ${h.branchLabel}`}
                  disabled={taken}
                  added={taken}
                  onClick={() => pickLeaf(h)}
                />
              );
            })}
          </div>
        ) : (
          <Muted>No categories match “{query}”. Try a broader word.</Muted>
        )
      ) : (
        <>
          {/* Breadcrumb */}
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <Crumb active={!parentId} onClick={() => { setParentId(null); setBranchId(null); }}>
              Categories
            </Crumb>
            {parent ? (
              <>
                <ChevronRight className="h-3 w-3" strokeWidth={2} style={{ color: 'var(--m-slate-3)' }} />
                <Crumb active={!branchId} onClick={() => setBranchId(null)}>
                  {parent.label}
                </Crumb>
              </>
            ) : null}
            {branch ? (
              <>
                <ChevronRight className="h-3 w-3" strokeWidth={2} style={{ color: 'var(--m-slate-3)' }} />
                <Crumb active onClick={() => {}}>
                  {branch.label}
                </Crumb>
              </>
            ) : null}
          </div>

          {/* Grid at the current level */}
          {!parent ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {tree.map((p) => (
                <GridCard
                  key={p.folderId}
                  label={p.label}
                  sub={`${p.branches.length} group${p.branches.length === 1 ? '' : 's'}`}
                  drill
                  onClick={() => { setParentId(p.folderId); setBranchId(null); }}
                />
              ))}
            </div>
          ) : !branch ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {parent.branches.map((b) => (
                <GridCard
                  key={b.tileId}
                  label={b.label}
                  sub={`${b.leaves.length} categor${b.leaves.length === 1 ? 'y' : 'ies'}`}
                  drill
                  onClick={() => setBranchId(b.tileId)}
                />
              ))}
              {parent.branches.length === 0 ? <Muted>No groups under this category.</Muted> : null}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {branch.leaves.map((l) => {
                const taken = covered.has(l.canonicalService);
                return (
                  <GridCard
                    key={l.canonicalService}
                    label={l.label}
                    disabled={taken}
                    added={taken}
                    onClick={() => pickLeaf({ leaf: l, parentId: parent.folderId, branchId: branch.tileId })}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GridCard({
  label,
  sub,
  drill,
  added,
  disabled,
  onClick,
}: {
  label: string;
  sub?: string;
  drill?: boolean;
  added?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-[3.75rem] flex-col justify-center gap-0.5 rounded-xl border px-3 py-2.5 text-left disabled:cursor-not-allowed disabled:opacity-55"
      style={{ borderColor: line, background: 'var(--m-paper-2)' }}
    >
      <span className="flex items-center justify-between gap-1.5">
        <span className="line-clamp-2 text-[13px] font-medium leading-tight" style={{ color: 'var(--m-ink)' }}>
          {label}
        </span>
        {added ? (
          <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em]" style={{ color: 'var(--m-slate-3)' }}>
            Added
          </span>
        ) : drill ? (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2} style={{ color: 'var(--m-slate-3)' }} />
        ) : (
          <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2} style={{ color: 'var(--m-orange-2)' }} />
        )}
      </span>
      {sub ? (
        <span className="truncate text-[11px]" style={{ color: 'var(--m-slate-3)' }}>
          {sub}
        </span>
      ) : null}
    </button>
  );
}

function Crumb({ children, active, onClick }: { children: ReactNode; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded px-1 py-0.5 font-medium"
      style={{ color: active ? 'var(--m-ink)' : 'var(--m-orange-2)' }}
    >
      {children}
    </button>
  );
}

function SelectChip({ children, on }: { children: ReactNode; on: boolean }) {
  // The controlled hidden checkbox (in children) is the single toggle source —
  // clicking the label toggles it and fires its onChange. No label onClick (that
  // would double-fire against the input and net to a no-op).
  return (
    <label
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs"
      style={{
        borderColor: on ? 'var(--m-orange-3)' : line,
        background: on ? 'var(--m-orange-4)' : paper,
        color: on ? 'var(--m-orange-2)' : 'var(--m-slate)',
      }}
    >
      {children}
    </label>
  );
}

function CheckChip({
  children,
  name,
  value,
  defaultChecked,
}: {
  children: ReactNode;
  name: string;
  value: string;
  defaultChecked: boolean;
}) {
  return (
    <label
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs has-[:checked]:font-medium"
      style={{ borderColor: line, color: 'var(--m-slate)' }}
    >
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="h-3.5 w-3.5 accent-[var(--m-ink)]" />
      {children}
    </label>
  );
}

function SubLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.13em]" style={{ color: 'var(--m-slate-3)' }}>
      {children}
    </p>
  );
}
function Muted({ children }: { children: ReactNode }) {
  return <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>{children}</p>;
}
