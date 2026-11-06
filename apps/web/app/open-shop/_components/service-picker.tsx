'use client';

import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Search, Check, X } from 'lucide-react';

import { rankTaxonomyOptionsWithClose } from '@/lib/taxonomy-search-rank';
import { folderIcon } from '@/lib/taxonomy-icons';
import { COORDINATOR_TRADE_SERVICES } from '@/lib/coordinator-trade';

const COORDINATOR_TRADE_SET: ReadonlySet<string> = new Set(COORDINATOR_TRADE_SERVICES);

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
  coordinatorOnly = false,
  onSearchAll,
}: {
  tree: PickerParentView[];
  /** Currently chosen leaf key, or '' when nothing is picked yet. */
  value: string;
  /** Display label for the current value (server-resolved on a re-run). */
  labelForValue: string | null;
  onPick: (leaf: PickerLeafView | null) => void;
  /**
   * 🧭 `/open-shop?as=coordinator` (owner 2026-11-06, "SUPPLIER SIGN-UP REDESIGN — FOUR CALLS ANSWERED"): open on
   * the coordination services — the leaves whose key is in `COORDINATOR_TRADE_SERVICES`, READ FROM THE CONSTANT,
   * never a word search ("Destination Wedding Travel Coordinators" matches the word and is NOT a coordinator).
   */
  coordinatorOnly?: boolean;
  /** "Not a coordinator? Search all services" — the wizard drops the coordinator view. */
  onSearchAll?: () => void;
}) {
  const [openParent, setOpenParent] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  /** The coordination services, from the constant, in the tree's own order. */
  const coordinatorLeaves = useMemo(
    () =>
      tree.flatMap((p) =>
        p.branches.flatMap((b) => b.leaves.filter((l) => COORDINATOR_TRADE_SET.has(l.canonicalService))),
      ),
    [tree],
  );

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

  // The prototype's rows: one line, the path under it when it teaches where a trade lives, a › at the right.
  const rowStyle = 'flex min-h-[50px] w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-[15px]';
  const row = (leaf: PickerLeafView, path?: string) => (
    <button type="button" className={rowStyle} onClick={() => onPick(leaf)}>
      <span className="min-w-0">
        <span className="block truncate" style={{ color: 'var(--m-ink)' }}>
          {leaf.label}
        </span>
        {/* The hierarchy is taught here — the vendor sees where their trade lives without drilling to find it. */}
        {path ? (
          <span className="block truncate text-xs" style={{ color: 'var(--m-slate-3)' }}>
            {path}
          </span>
        ) : null}
      </span>
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} style={{ color: 'var(--m-slate-3)' }} />
    </button>
  );
  /** The small caps heading at the top of a list ("Matches", "Coordination services"). */
  const heading = (words: string, data?: Record<string, string>) => (
    <li
      className="border-b px-3.5 pb-1 pt-2.5 text-[10.5px] font-medium uppercase tracking-[0.14em]"
      style={{ color: 'var(--m-slate-3)', background: 'var(--m-paper-2)', borderColor: 'var(--m-line)' }}
      {...data}
    >
      {words}
    </li>
  );
  const listFrame = 'overflow-hidden rounded-xl border';

  const groups = <GroupTiles tree={tree} onOpen={setOpenParent} />;

  const coordinatorView = coordinatorOnly && q.length < 2 && !parent;

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
          ref={searchRef}
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpenParent(null);
          }}
          placeholder="Search what you do"
          className="min-h-8 w-full bg-transparent text-sm outline-none [&::-webkit-search-cancel-button]:appearance-none"
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

      {coordinatorView ? (
        <>
          {coordinatorLeaves.length > 0 ? (
            <div className={listFrame} style={{ borderColor: 'var(--m-line)' }}>
              <ul className="divide-y" style={{ borderColor: 'var(--m-line)' }} data-open-shop-coordinator-services="">
                {heading('Coordination services')}
                {coordinatorLeaves.map((l) => (
                  <li key={l.canonicalService}>{row(l)}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
            Not a coordinator?{' '}
            <button
              type="button"
              className="font-medium text-terracotta"
              onClick={() => {
                onSearchAll?.();
                searchRef.current?.focus({ preventScroll: true });
              }}
              data-open-shop-search-all=""
            >
              Search all services
            </button>
          </p>
        </>
      ) : q.length >= 2 ? (
        hits.length > 0 ? (
          <div className={listFrame} style={{ borderColor: 'var(--m-line)' }}>
            <ul className="divide-y" style={{ borderColor: 'var(--m-line)' }} data-open-shop-hits="">
              {heading('Matches')}
              {hits.map((h) => (
                <li key={h.key}>{row(h.leaf, h.path)}</li>
              ))}
            </ul>
          </div>
        ) : close.length > 0 ? (
          /* Typos: shown apart under "Close matches — did you mean", never picked for the vendor; the groups stay
             underneath so a wrong guess is never a dead end. */
          <>
            <div className={listFrame} style={{ borderColor: 'var(--m-line)' }}>
              <ul className="divide-y" style={{ borderColor: 'var(--m-line)' }} data-open-shop-hits="">
                {heading('Close matches — did you mean', { 'data-open-shop-close-matches': '' })}
                {close.map((h) => (
                  <li key={h.key}>{row(h.leaf, h.path)}</li>
                ))}
              </ul>
            </div>
            <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
              Not it? Browse the groups.
            </p>
            {groups}
          </>
        ) : (
          <>
            <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
              Nothing by that name — browse the groups.
            </p>
            {groups}
          </>
        )
      ) : !parent ? (
        groups
      ) : (
        /* A tapped group → its services as rows, one list (its branches as small headings, not another tap). */
        <div className={listFrame} style={{ borderColor: 'var(--m-line)' }}>
          <ul className="divide-y" style={{ borderColor: 'var(--m-line)' }} data-open-shop-group-services="">
            <li
              className="flex items-center justify-between gap-2 px-3.5 py-1"
              style={{ background: 'var(--m-paper-2)' }}
            >
              <span className="text-[10.5px] font-medium uppercase tracking-[0.14em]" style={{ color: 'var(--m-slate-3)' }}>
                {parent.label}
              </span>
              <button
                type="button"
                onClick={() => setOpenParent(null)}
                className="inline-flex min-h-9 items-center gap-1 text-[13px] font-medium"
                style={{ color: 'var(--m-orange-deep)' }}
              >
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                All groups
              </button>
            </li>
            {parent.branches.map((b) => (
              <li key={b.tileId}>
                {parent.branches.length > 1 ? (
                  <p
                    className="px-3.5 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-[0.12em]"
                    style={{ color: 'var(--m-slate-3)' }}
                  >
                    {b.label}
                  </p>
                ) : null}
                <ul className="divide-y" style={{ borderColor: 'var(--m-line)' }}>
                  {b.leaves.map((l) => (
                    <li key={l.canonicalService}>{row(l)}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ── THE 16 GROUPS AS TILES, TWO COLUMNS (owner 2026-11-06: "present this better and simpler"; the redesign's tiles
   carry the group's own name, as the prototype draws them). The group's icon (`folderIcon`, the one Explore draws) is
   read before its name. Drawn UNDER the search box — this component is placed after the picker so the source reads
   in screen order too. */
function GroupTiles({ tree, onOpen }: { tree: PickerParentView[]; onOpen: (folderId: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5" data-open-shop-groups="">
      {tree.map((p) => {
        const Icon = folderIcon(p.folderId);
        return (
          <button
            key={p.folderId}
            type="button"
            onClick={() => onOpen(p.folderId)}
            aria-label={p.label}
            title={p.label}
            className="flex min-h-[58px] items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm leading-tight" // no-card-ok: a pressable group tile — this line is a <button>'s own className
            style={{ borderColor: 'var(--m-line)', color: 'var(--m-ink)', background: 'var(--m-paper)' }}
          >
            <Icon aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} style={{ color: 'var(--m-orange-deep)' }} />
            <span className="line-clamp-2 min-w-0">{p.label}</span>
          </button>
        );
      })}
    </div>
  );
}
