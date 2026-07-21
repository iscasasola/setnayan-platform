'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Plus, X, Check, Tag, Folder, Search, ChevronRight, ChevronLeft } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  createCoverage,
  updateCoverageServes,
  deleteCoverage,
} from '../coverage-actions';
import { leafServesEventType } from '@/lib/taxonomy-event-scope';

/**
 * Coverage tab (v20 prototype structure — owner: "we had a prototype. follow
 * that"). The BROWSE IS THE SURFACE: search bar + a 3-per-row card drill of the
 * LIVE admin taxonomy (parent → branch → leaf) with a breadcrumb, always
 * visible — no "Add coverage" gate. Clicking a leaf opens the "Add this
 * coverage?" confirm (event types + faiths). Below a divider, "Your coverage"
 * lists leaves GROUPED BY PARENT as removable pills; clicking a pill opens its
 * Serves editor.
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
  /** Tier-1 parent label (first segment of the path) — the grouping key. */
  parentLabel: string;
  /** Leaf display label (last segment of the path). */
  leafLabel: string;
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
  const covered = useMemo(
    () => new Set(coverages.map((c) => c.canonicalService)),
    [coverages],
  );
  const capLabel = Number.isFinite(parentUsage.cap) ? String(parentUsage.cap) : '∞';
  const overCap = Number.isFinite(parentUsage.cap) && parentUsage.used > parentUsage.cap;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium" style={{ color: 'var(--m-slate)' }}>
          Add what you serve
        </span>
        <span className="text-xs" style={{ color: overCap ? 'var(--m-blush-deep)' : 'var(--m-slate-3)' }}>
          Parents{' '}
          <b className="font-medium" style={{ color: overCap ? 'var(--m-blush-deep)' : 'var(--m-orange-2)' }}>
            {parentUsage.used} of {capLabel}
          </b>
          {overCap ? ' · upgrade to add more' : ''}
        </span>
      </div>

      {/* The browse IS the surface (v20) — search + 3-per-row drill, always on. */}
      <CoverageBrowse
        tree={tree}
        covered={covered}
        eventTypeOptions={eventTypeOptions}
        faithOptions={faithOptions}
      />

      <div className="border-t" style={{ borderColor: line }} />

      <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
        Your coverage
      </p>
      {coverages.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
          Nothing yet — pick a category above and it lands here. Service cards
          are built inside your coverage.
        </p>
      ) : (
        <YourCoverage
          coverages={coverages}
          eventTypeOptions={eventTypeOptions}
          faithOptions={faithOptions}
        />
      )}
    </section>
  );
}

// ── "Your coverage" — leaves grouped by parent (v20 pills) ──────────────────

function YourCoverage({
  coverages,
  eventTypeOptions,
  faithOptions,
}: {
  coverages: CoverageItem[];
  eventTypeOptions: EventTypeOption[];
  faithOptions: FaithOption[];
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const faithLabel = useMemo(() => {
    const m = new Map(faithOptions.map((f) => [f.key, f.label]));
    return (k: string) => m.get(k) ?? k;
  }, [faithOptions]);
  const eventLabel = useMemo(() => {
    const m = new Map(eventTypeOptions.map((e) => [e.key, e.label]));
    return (k: string) => m.get(k) ?? k;
  }, [eventTypeOptions]);

  const groups = useMemo(() => {
    const g = new Map<string, CoverageItem[]>();
    for (const c of coverages) {
      const arr = g.get(c.parentLabel) ?? [];
      arr.push(c);
      g.set(c.parentLabel, arr);
    }
    return Array.from(g.entries());
  }, [coverages]);

  const open = openId != null ? coverages.find((c) => c.id === openId) ?? null : null;

  return (
    <div className="space-y-3">
      {groups.map(([parent, items]) => (
        <div key={parent}>
          <div className="mb-1.5 flex items-center gap-2">
            <span
              aria-hidden
              className="inline-flex h-6 w-6 items-center justify-center rounded-md"
              style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
            >
              <Folder className="h-3.5 w-3.5" strokeWidth={1.75} />
            </span>
            <span className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
              {parent}
            </span>
            <span className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
              {items.length} {items.length === 1 ? 'leaf' : 'leaves'}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 pl-8">
            {items.map((c) => {
              const on = openId === c.id;
              return (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1 rounded-full border py-1 pl-3 pr-1.5 text-xs"
                  style={{
                    borderColor: on ? 'var(--m-orange-3)' : line,
                    background: on ? 'var(--m-orange-4)' : paper,
                    color: on ? 'var(--m-orange-2)' : 'var(--m-slate)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(on ? null : c.id)}
                    className="inline-flex items-center gap-1"
                    aria-expanded={on}
                    title="Edit who you serve this for"
                  >
                    {c.leafLabel}
                    {c.serviceCount > 0 ? (
                      <span style={{ color: 'var(--m-slate-3)' }}>· {c.serviceCount}</span>
                    ) : null}
                    <Tag className="h-3 w-3" strokeWidth={1.75} style={{ color: 'var(--m-slate-3)' }} />
                  </button>
                  <form
                    action={deleteCoverage}
                    className="inline-flex"
                    onSubmit={(e) => {
                      if (
                        !confirm(
                          `Remove "${c.leafLabel}"? This drops it from search` +
                            (c.serviceCount > 0
                              ? ` and unlinks its ${c.serviceCount} service card${c.serviceCount === 1 ? '' : 's'}.`
                              : '.'),
                        )
                      )
                        e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="coverage_id" value={c.id} />
                    <button
                      type="submit"
                      aria-label={`Remove ${c.leafLabel}`}
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full"
                      style={{ color: 'var(--m-slate-3)' }}
                    >
                      <X className="h-3 w-3" strokeWidth={2} />
                    </button>
                  </form>
                </span>
              );
            })}
          </div>
        </div>
      ))}

      {open ? (
        <form
          action={updateCoverageServes}
          className="space-y-4 rounded-2xl border p-4"
          style={{ borderColor: 'var(--m-orange-3)', background: paper }}
        >
          <input type="hidden" name="coverage_id" value={open.id} />
          <div>
            <p className="text-[11px]" style={{ color: 'var(--m-slate-3)' }}>{open.pathLabel}</p>
            <p className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
              Who do you serve this for?
            </p>
            <p className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
              Now: {open.eventTypes.map(eventLabel).join(' · ') || 'no event types'} ·{' '}
              {open.faiths.length === 0 ? 'all faiths' : open.faiths.map(faithLabel).join(', ')}
            </p>
          </div>
          <div className="space-y-2">
            <SubLabel>Event types you cater · couples planning these find you</SubLabel>
            <div className="flex flex-wrap gap-2">
              {eventTypeOptions.map((e) => (
                <CheckChip key={`${open.id}-${e.key}`} name="event_types" value={e.key} defaultChecked={open.eventTypes.includes(e.key)}>
                  {e.label}
                </CheckChip>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <SubLabel>Faiths you serve · leave all off = welcome every faith</SubLabel>
            <div className="flex flex-wrap gap-2">
              {faithOptions.map((f) => (
                <CheckChip key={`${open.id}-${f.key}`} name="faiths" value={f.key} defaultChecked={open.faiths.includes(f.key)}>
                  {f.label}
                </CheckChip>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setOpenId(null)} className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
              Close
            </button>
            <SubmitButton className="button-primary" pendingLabel="Saving…">
              Save
            </SubmitButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}

// ── The always-on browse (search + 3-per-row drill + confirm) ───────────────

type LeafHit = {
  leaf: CoverageLeaf;
  parentId: string;
  branchId: string;
  parentLabel: string;
  branchLabel: string;
};

function CoverageBrowse({
  tree,
  covered,
  eventTypeOptions,
  faithOptions,
}: {
  tree: CoverageParent[];
  covered: Set<string>;
  eventTypeOptions: EventTypeOption[];
  faithOptions: FaithOption[];
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
    // FAIL-OPEN: an untagged leaf offers every active event type. This is the
    // platform rule (lib/taxonomy-event-scope.ts); only the suggestion ranker
    // inverts it.
    return eventTypeOptions.filter((e) => leafServesEventType(leaf.allowedEventTypes, e.key));
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

        <div className="flex items-center justify-end pt-1">
          <SubmitButton className="button-primary disabled:opacity-50" pendingLabel="Adding…" disabled={!canSave}>
            Add coverage
          </SubmitButton>
        </div>
      </form>
    );
  }

  // ── Drill / search step (no leaf yet) ───────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Search */}
      <label className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: line, background: 'var(--m-paper-2)' }}>
        <Search className="h-4 w-4 shrink-0" strokeWidth={1.75} style={{ color: 'var(--m-slate-3)' }} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search categories, or browse below"
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
          <Muted>No categories match “{query}”. Try a broader word — or request it under Tools.</Muted>
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
          <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2} style={{ color: 'var(--m-slate-3)' }} />
        ) : drill ? (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2} style={{ color: 'var(--m-slate-3)' }} />
        ) : (
          <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2} style={{ color: 'var(--m-orange-2)' }} />
        )}
      </span>
      {added ? (
        <span className="truncate text-[11px]" style={{ color: 'var(--m-slate-3)' }}>
          Already added
        </span>
      ) : sub ? (
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
  // clicking the label toggles it and fires its onChange.
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
