'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, ChevronLeft, Search, Check, X } from 'lucide-react';

export type PickerLeafView = {
  canonicalService: string;
  label: string;
  tileId: string;
};
export type PickerBranchView = { tileId: string; label: string; leaves: PickerLeafView[] };
export type PickerParentView = { folderId: string; label: string; branches: PickerBranchView[] };

/**
 * Primary-service picker — parent → branch → leaf, phone first.
 *
 * Owner 2026-08-09: *"primary service must branch from parent category until it
 * reaches leaf category."*
 *
 * ── WHY A DRILL-DOWN AND NOT A LONGER `<select>` ─────────────────────────────
 * 15 parents → 70 branches → ~237 offerable leaves. A flat list is ~237 rows on
 * a 375px screen; a native multi-level select does not exist. Drilling shows at
 * most 15 rows at a time, and the breadcrumb keeps the vendor oriented.
 *
 * ── AND WHY THERE IS ALSO A SEARCH BOX ───────────────────────────────────────
 * Drilling is only fast when you already know which of the 15 groups your trade
 * lives under. A photographer looking for "Pre-nup" should not have to guess
 * between Documentary and Look. Search cuts straight to the leaf and shows
 * `Parent › Branch` under each hit, so the vendor learns the hierarchy while
 * using it — this is the shape the 2026-07 onboarding verdict specified.
 *
 * RULE 0 — the tree itself, its pruning, and this crumb/row grammar all come
 * from the shipped coverage editor (`vendor-dashboard/services/_components/
 * coverage-panel.tsx`). What is NOT reused is that component itself: it is
 * welded to an existing vendor profile, its own server actions, and per-leaf
 * "add coverage" state that /open-shop has none of. Copying its markup is the
 * reuse; importing it would have meant faking four dependencies.
 *
 * ⚠ The first-party Setnayan SKUs are filtered SERVER-side before the tree ever
 * reaches this component (see `lib/open-shop-service-tree.ts`) — picking one
 * would make the vendor invisible in the marketplace. Do not add a client-side
 * "show everything" escape hatch.
 */
export function ServicePicker({
  tree,
  value,
  labelForValue,
  onPick,
}: {
  tree: PickerParentView[];
  /** Currently chosen leaf key, or '' when nothing is picked yet. */
  value: string;
  /** Display label for the current value (server-resolved on a re-run). */
  labelForValue: string | null;
  onPick: (leaf: PickerLeafView | null) => void;
}) {
  const [openParent, setOpenParent] = useState<string | null>(null);
  const [openBranch, setOpenBranch] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const parent = tree.find((p) => p.folderId === openParent) ?? null;
  const branch = parent?.branches.find((b) => b.tileId === openBranch) ?? null;

  /** Flat index for search — built once, not per keystroke. */
  const flat = useMemo(
    () =>
      tree.flatMap((p) =>
        p.branches.flatMap((b) =>
          b.leaves.map((l) => ({ leaf: l, path: `${p.label} › ${b.label}` })),
        ),
      ),
    [tree],
  );

  const q = query.trim().toLowerCase();
  const hits = useMemo(() => {
    if (q.length < 2) return [];
    // Label first, then the key — so "photo" ranks "Photographer" above a leaf
    // that merely has `photo` buried in its key.
    const starts = flat.filter((f) => f.leaf.label.toLowerCase().startsWith(q));
    const contains = flat.filter(
      (f) =>
        !f.leaf.label.toLowerCase().startsWith(q) &&
        (f.leaf.label.toLowerCase().includes(q) ||
          f.leaf.canonicalService.includes(q.replace(/\s+/g, '_'))),
    );
    return [...starts, ...contains].slice(0, 30);
  }, [flat, q]);

  // ── Chosen state — one line, with a way back out ──────────────────────────
  if (value) {
    return (
      <div
        className="flex items-center justify-between gap-3 rounded-xl border p-3"
        style={{ borderColor: 'var(--m-orange-3)', background: 'var(--m-orange-4)' }}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Check
            aria-hidden
            className="h-4 w-4 shrink-0"
            strokeWidth={2.25}
            style={{ color: 'var(--m-orange-deep)' }}
          />
          <span className="truncate text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
            {labelForValue || value}
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            onPick(null);
            setOpenParent(null);
            setOpenBranch(null);
            setQuery('');
          }}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium underline underline-offset-2"
          style={{ color: 'var(--m-slate)' }}
        >
          Change
        </button>
      </div>
    );
  }

  const rowStyle = 'flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm';

  return (
    <div className="space-y-2">
      {/* Search — always available, at any depth. */}
      <div
        className="flex items-center gap-2 rounded-xl border px-3 py-2"
        style={{ borderColor: 'var(--m-line)' }}
      >
        <Search aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} style={{ color: 'var(--m-slate-3)' }} />
        <input
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search what you do — e.g. photographer, catering"
          className="w-full bg-transparent text-sm outline-none"
          aria-label="Search services"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="shrink-0"
            style={{ color: 'var(--m-slate-3)' }}
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        ) : null}
      </div>

      {q.length >= 2 ? (
        <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--m-line)' }}>
          {hits.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs" style={{ color: 'var(--m-slate)' }}>
              Nothing matches “{query}”. Try a simpler word, or browse the groups below.
            </p>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--m-line)' }}>
              {hits.map((h) => (
                <li key={h.leaf.canonicalService}>
                  <button type="button" className={rowStyle} onClick={() => onPick(h.leaf)}>
                    <span className="min-w-0">
                      <span className="block truncate" style={{ color: 'var(--m-ink)' }}>
                        {h.leaf.label}
                      </span>
                      {/* The hierarchy is taught here — the vendor sees where
                          their trade lives without having to drill to find it. */}
                      <span className="block truncate text-xs" style={{ color: 'var(--m-slate-3)' }}>
                        {h.path}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          {/* Breadcrumb — also the way back up. */}
          {parent ? (
            <button
              type="button"
              onClick={() => (branch ? setOpenBranch(null) : setOpenParent(null))}
              className="inline-flex items-center gap-1 text-xs font-medium"
              style={{ color: 'var(--m-orange-deep)' }}
            >
              <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              {branch ? parent.label : 'All groups'}
            </button>
          ) : null}
          {parent ? (
            <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
              {parent.label}
              {branch ? ` › ${branch.label}` : ''}
            </p>
          ) : null}

          <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--m-line)' }}>
            <ul className="divide-y" style={{ borderColor: 'var(--m-line)' }}>
              {!parent
                ? tree.map((p) => (
                    <li key={p.folderId}>
                      <button type="button" className={rowStyle} onClick={() => setOpenParent(p.folderId)}>
                        <span style={{ color: 'var(--m-ink)' }}>{p.label}</span>
                        <ChevronRight
                          aria-hidden
                          className="h-4 w-4 shrink-0"
                          strokeWidth={1.75}
                          style={{ color: 'var(--m-slate-3)' }}
                        />
                      </button>
                    </li>
                  ))
                : !branch
                  ? parent.branches.map((b) => (
                      <li key={b.tileId}>
                        <button type="button" className={rowStyle} onClick={() => setOpenBranch(b.tileId)}>
                          <span style={{ color: 'var(--m-ink)' }}>{b.label}</span>
                          <ChevronRight
                            aria-hidden
                            className="h-4 w-4 shrink-0"
                            strokeWidth={1.75}
                            style={{ color: 'var(--m-slate-3)' }}
                          />
                        </button>
                      </li>
                    ))
                  : branch.leaves.map((l) => (
                      <li key={l.canonicalService}>
                        <button type="button" className={rowStyle} onClick={() => onPick(l)}>
                          <span style={{ color: 'var(--m-ink)' }}>{l.label}</span>
                        </button>
                      </li>
                    ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
