'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, Search, Check, X } from 'lucide-react';

import { rankTaxonomyOptionsWithClose } from '@/lib/taxonomy-search-rank';
import { folderIcon } from '@/lib/taxonomy-icons';
import { WEDDING_FOLDER_SHORT_LABEL, type WeddingFolder } from '@/lib/taxonomy';

export type PickerLeafView = {
  canonicalService: string;
  label: string;
  tileId: string;
  /** Reviewed aliases (`canonical_service_aliases`), the same words Explore and the card maker search by. */
  aliases?: readonly string[];
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
  const [query, setQuery] = useState('');

  const parent = tree.find((p) => p.folderId === openParent) ?? null;

  /**
   * Flat index for search — built once, not per keystroke. Shaped for the SHARED ranker (`key` · `label` ·
   * `aliases`), so this box finds exactly what Explore and the card maker find.
   */
  const flat = useMemo(
    () =>
      tree.flatMap((p) =>
        p.branches.flatMap((b) =>
          b.leaves.map((l) => ({
            key: l.canonicalService,
            label: l.label,
            aliases: l.aliases,
            leaf: l,
            path: `${p.label} › ${b.label}`,
          })),
        ),
      ),
    [tree],
  );

  const q = query.trim().toLowerCase();
  // 🔤 ONE RANKER (owner 2026-11-06: "search that finds the compatible and most likely compatible (to help solve
  // space, typo errors…)"). This box used to keep a private startsWith/contains search, so "photobooth" and every
  // typo found nothing here while Explore found them. `matches` = the shipped tiers; `close` = typos, shown apart
  // under "Close matches" and never picked for the vendor.
  const { matches: hits, close } = useMemo(
    () =>
      q.length < 2 ? { matches: [], close: [] } : rankTaxonomyOptionsWithClose(flat, q, 30),
    [flat, q],
  );

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
  const hitRow = (h: { leaf: PickerLeafView; path: string }) => (
    <button type="button" className={rowStyle} onClick={() => onPick(h.leaf)}>
      <span className="min-w-0">
        <span className="block truncate" style={{ color: 'var(--m-ink)' }}>
          {h.leaf.label}
        </span>
        {/* The hierarchy is taught here — the vendor sees where their trade lives without drilling to find it. */}
        <span className="block truncate text-xs" style={{ color: 'var(--m-slate-3)' }}>
          {h.path}
        </span>
      </span>
    </button>
  );

  return (
    <div className="space-y-2">
      {/* Search — always available, at any depth. */}
      <div
        className="flex items-center gap-2 rounded-xl border px-3 py-2"
        style={{ borderColor: 'var(--m-line)' }}
      >
        <Search aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} style={{ color: 'var(--m-slate-3)' }} />
        {/* The browser's own search ✕ is hidden: it drew a second clear button beside the one below. */}
        <input
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search what you do — e.g. photographer, catering"
          className="w-full bg-transparent text-sm outline-none [&::-webkit-search-cancel-button]:appearance-none"
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
          {hits.length === 0 && close.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs" style={{ color: 'var(--m-slate)' }}>
              Nothing matches “{query}”. Try a simpler word, or browse the groups below.
            </p>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--m-line)' }} data-open-shop-hits="">
              {hits.map((h) => (
                <li key={h.key}>{hitRow(h)}</li>
              ))}
              {close.length > 0 ? (
                <li
                  className="px-3 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-[0.12em]"
                  style={{ color: 'var(--m-slate-3)' }}
                  data-open-shop-close-matches=""
                >
                  Close matches
                </li>
              ) : null}
              {close.map((h) => (
                <li key={h.key}>{hitRow(h)}</li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {/* Nothing matched: the groups stay, so the vendor can still browse (never a dead end). */}
      {q.length >= 2 && (hits.length > 0 || close.length > 0) ? null : !parent ? (
        /* ── THE 16 GROUPS AS TILES, TWO COLUMNS (owner 2026-11-06: "present this better and simpler") ──
           Was one row per group — a 16-row list taller than the phone. Two columns halve it, and the group's own
           icon (`folderIcon`, the one Explore draws) is read before its name. */
        <div className="grid grid-cols-2 gap-1.5" data-open-shop-groups="">
          {tree.map((p) => {
            const Icon = folderIcon(p.folderId);
            return (
              <button
                key={p.folderId}
                type="button"
                onClick={() => setOpenParent(p.folderId)}
                aria-label={p.label}
                title={p.label}
                className="flex min-h-10 items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left text-[13px] leading-tight" // no-card-ok: a pressable group tile — this line is a <button>'s own className
                style={{ borderColor: 'var(--m-line)', color: 'var(--m-ink)' }}
              >
                <Icon aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} style={{ color: 'var(--m-orange-deep)' }} />
                {/* The thumb-width name (`WEDDING_FOLDER_SHORT_LABEL`, the chip names Explore uses) so a tile is one
                    line; the full name is the button's accessible name and the "All groups ›" crumb inside. */}
                <span className="min-w-0 truncate">{WEDDING_FOLDER_SHORT_LABEL[p.folderId as WeddingFolder] ?? p.label}</span>
              </button>
            );
          })}
        </div>
      ) : (
        /* A tapped group → its services as rows, one list (its branches as small headings, not another tap). */
        <>
          <button
            type="button"
            onClick={() => setOpenParent(null)}
            className="inline-flex items-center gap-1 text-xs font-medium"
            style={{ color: 'var(--m-orange-deep)' }}
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            All groups
          </button>
          <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
            {parent.label}
          </p>
          <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--m-line)' }}>
            <ul className="divide-y" style={{ borderColor: 'var(--m-line)' }} data-open-shop-group-services="">
              {parent.branches.map((b) => (
                <li key={b.tileId}>
                  {parent.branches.length > 1 ? (
                    <p
                      className="px-3 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-[0.12em]"
                      style={{ color: 'var(--m-slate-3)' }}
                    >
                      {b.label}
                    </p>
                  ) : null}
                  <ul className="divide-y" style={{ borderColor: 'var(--m-line)' }}>
                    {b.leaves.map((l) => (
                      <li key={l.canonicalService}>
                        <button type="button" className={rowStyle} onClick={() => onPick(l)}>
                          <span style={{ color: 'var(--m-ink)' }}>{l.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
