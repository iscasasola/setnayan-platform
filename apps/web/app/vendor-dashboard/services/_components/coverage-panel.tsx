'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Plus, X, Trash2, Check, Tag, Folder } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  createCoverage,
  updateCoverageEventTypes,
  deleteCoverage,
} from '../coverage-actions';

/**
 * Coverage-first management (Vendor Services rework 2026-07-02). A coverage is a
 * taxonomy leaf (canonical_service) a vendor serves + the event types they cater
 * for it. "Add coverage" drills the LIVE admin taxonomy parent → branch → leaf;
 * already-covered leaves lock out; event types are constrained by the leaf.
 */

export type CoverageLeaf = {
  canonicalService: string;
  label: string;
  allowedEventTypes: string[] | null;
};
export type CoverageBranch = { tileId: string; label: string; leaves: CoverageLeaf[] };
export type CoverageParent = { folderId: string; label: string; branches: CoverageBranch[] };
export type EventTypeOption = { key: string; label: string };
export type CoverageItem = {
  id: number;
  canonicalService: string;
  pathLabel: string;
  eventTypes: string[];
  serviceCount: number;
};

const line = 'var(--m-line)';
const paper = 'var(--m-paper)';

export function CoveragePanel({
  tree,
  coverages,
  eventTypeOptions,
}: {
  tree: CoverageParent[];
  coverages: CoverageItem[];
  eventTypeOptions: EventTypeOption[];
}) {
  const [adding, setAdding] = useState(false);
  const eventLabel = useMemo(() => {
    const m = new Map(eventTypeOptions.map((e) => [e.key, e.label]));
    return (k: string) => m.get(k) ?? k;
  }, [eventTypeOptions]);
  const covered = useMemo(
    () => new Set(coverages.map((c) => c.canonicalService)),
    [coverages],
  );

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2
          className="font-mono text-[11px] font-medium uppercase tracking-[0.18em]"
          style={{ color: 'var(--m-slate-3)' }}
        >
          Your coverage · categories you serve
        </h2>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1.5 text-sm font-medium"
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
            <CoverageRow key={c.id} coverage={c} eventTypeOptions={eventTypeOptions} eventLabel={eventLabel} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CoverageRow({
  coverage,
  eventTypeOptions,
  eventLabel,
}: {
  coverage: CoverageItem;
  eventTypeOptions: EventTypeOption[];
  eventLabel: (k: string) => string;
}) {
  const [editing, setEditing] = useState(false);
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
          Events
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
          action={updateCoverageEventTypes}
          className="space-y-3 border-t px-4 pb-4 pt-3"
          style={{ borderColor: line }}
        >
          <input type="hidden" name="coverage_id" value={coverage.id} />
          <p className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
            Event types you cater for this coverage. Couples planning these events find it.
          </p>
          <div className="flex flex-wrap gap-2">
            {eventTypeOptions.map((e) => {
              const on = coverage.eventTypes.includes(e.key);
              return (
                <label
                  key={e.key}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs has-[:checked]:font-medium"
                  style={{ borderColor: line, color: 'var(--m-slate)' }}
                >
                  <input type="checkbox" name="event_types" value={e.key} defaultChecked={on} className="h-3.5 w-3.5 accent-[var(--m-ink)]" />
                  {e.label}
                </label>
              );
            })}
          </div>
          <div className="flex justify-end">
            <SubmitButton className="button-primary" pendingLabel="Saving…">
              Save event types
            </SubmitButton>
          </div>
        </form>
      ) : null}
    </li>
  );
}

function AddCoverage({
  tree,
  covered,
  eventTypeOptions,
  onDone,
}: {
  tree: CoverageParent[];
  covered: Set<string>;
  eventTypeOptions: EventTypeOption[];
  onDone: () => void;
}) {
  const [parentId, setParentId] = useState<string | null>(tree[0]?.folderId ?? null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [leaf, setLeaf] = useState<CoverageLeaf | null>(null);
  const [events, setEvents] = useState<string[]>([]);

  const parent = tree.find((p) => p.folderId === parentId) ?? null;
  const branch = parent?.branches.find((b) => b.tileId === branchId) ?? null;

  const allowedEventOptions = useMemo(() => {
    if (!leaf) return [] as EventTypeOption[];
    if (!leaf.allowedEventTypes || leaf.allowedEventTypes.length === 0) return eventTypeOptions;
    const allow = new Set(leaf.allowedEventTypes);
    return eventTypeOptions.filter((e) => allow.has(e.key));
  }, [leaf, eventTypeOptions]);

  function pickLeaf(l: CoverageLeaf) {
    if (covered.has(l.canonicalService)) return;
    setLeaf(l);
    const allow = l.allowedEventTypes && l.allowedEventTypes.length ? new Set(l.allowedEventTypes) : null;
    setEvents(!allow || allow.has('wedding') ? ['wedding'] : []);
  }
  function toggleEvent(k: string) {
    setEvents((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  }

  const canSave = leaf !== null && events.length > 0;

  return (
    <form
      action={createCoverage}
      onSubmit={() => onDone()}
      className="space-y-4 rounded-2xl border p-4"
      style={{ borderColor: 'var(--m-orange-3)', background: paper }}
    >
      <input type="hidden" name="canonical_service" value={leaf?.canonicalService ?? ''} />

      <Step n={1} label="Parent category" />
      <div className="flex flex-wrap gap-1.5">
        {tree.map((p) => (
          <Pill key={p.folderId} on={p.folderId === parentId} onClick={() => { setParentId(p.folderId); setBranchId(null); setLeaf(null); setEvents([]); }}>
            {p.label}
          </Pill>
        ))}
      </div>

      <Step n={2} label="Branch" />
      <div className="flex flex-wrap gap-1.5">
        {(parent?.branches ?? []).map((b) => (
          <Pill key={b.tileId} accent on={b.tileId === branchId} onClick={() => { setBranchId(b.tileId); setLeaf(null); setEvents([]); }}>
            {b.label}
          </Pill>
        ))}
        {parent && parent.branches.length === 0 ? <Muted>No branches under this category.</Muted> : null}
      </div>

      <Step n={3} label="Leaf category" />
      {branch ? (
        <div className="flex flex-col gap-1.5">
          {branch.leaves.map((l) => {
            const taken = covered.has(l.canonicalService);
            const on = leaf?.canonicalService === l.canonicalService;
            return (
              <button
                key={l.canonicalService}
                type="button"
                disabled={taken}
                onClick={() => pickLeaf(l)}
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  borderColor: on ? 'var(--m-orange-3)' : line,
                  background: on ? 'var(--m-orange-4)' : paper,
                  color: on ? 'var(--m-orange-2)' : 'var(--m-ink)',
                }}
              >
                {l.label}
                {taken ? (
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--m-slate-3)' }}>Added</span>
                ) : on ? (
                  <Check className="h-4 w-4" strokeWidth={2} />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <Muted>Pick a branch to see its leaf categories.</Muted>
      )}

      <Step n={4} label="Event types you cater" />
      {leaf ? (
        <>
          <div className="flex flex-wrap gap-2">
            {allowedEventOptions.map((e) => {
              const on = events.includes(e.key);
              return (
                <label
                  key={e.key}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs"
                  style={{
                    borderColor: on ? 'var(--m-orange-3)' : line,
                    background: on ? 'var(--m-orange-4)' : paper,
                    color: on ? 'var(--m-orange-2)' : 'var(--m-slate)',
                  }}
                >
                  <input type="checkbox" name="event_types" value={e.key} checked={on} onChange={() => toggleEvent(e.key)} className="hidden" />
                  {e.label}
                </label>
              );
            })}
          </div>
          <p className="text-[11px]" style={{ color: 'var(--m-slate-3)' }}>
            Only the events this category can serve are shown.
          </p>
        </>
      ) : (
        <Muted>Pick a leaf category first.</Muted>
      )}

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

function Step({ n, label }: { n: number; label: string }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.13em]" style={{ color: 'var(--m-slate-3)' }}>
      {n} · {label}
    </p>
  );
}
function Pill({ children, on, accent, onClick }: { children: ReactNode; on: boolean; accent?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-3 py-1.5 text-xs"
      style={{
        borderColor: on ? (accent ? 'var(--m-orange-2)' : 'var(--m-ink)') : line,
        background: on ? (accent ? 'var(--m-orange-2)' : 'var(--m-ink)') : paper,
        color: on ? 'var(--m-paper)' : 'var(--m-slate)',
      }}
    >
      {children}
    </button>
  );
}
function Muted({ children }: { children: ReactNode }) {
  return <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>{children}</p>;
}
