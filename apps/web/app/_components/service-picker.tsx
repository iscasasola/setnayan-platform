'use client';

import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Search, X } from 'lucide-react';

import { rankTaxonomyOptionsWithClose } from '@/lib/taxonomy-search-rank';
import { InfoTip } from '@/app/_components/info-tip';
import { ActionButton } from '@/components/action-button';
import { tileIcon } from '@/lib/taxonomy-icons';
import { COORDINATOR_TRADE_SERVICES } from '@/lib/coordinator-trade';

const COORDINATOR_TRADE_SET: ReadonlySet<string> = new Set(COORDINATOR_TRADE_SERVICES);

export type PickerLeafView = {
  canonicalService: string;
  label: string;
  tileId: string;
  /** Reviewed aliases (`canonical_service_aliases`), the same words Explore and the card maker search by. */
  aliases?: readonly string[];
  /** The events this service may serve (`canonical_service_taxonomy.allowed_event_types`); null / empty = every one. */
  allowedEventTypes?: string[] | null;
};
export type PickerBranchView = {
  tileId: string;
  label: string;
  leaves: PickerLeafView[];
  /** The category's photo (`service_categories.sample_photo_r2_key`, resolved on the server) — null = the plain tile. */
  photoUrl?: string | null;
  /** The category's ⓘ line (`service_categories.hint_en`, Admin › Categories "ⓘ text") — null = no ⓘ. */
  hint?: string | null;
};
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
  onPick,
  coordinatorOnly = false,
  onSearchAll,
  excludeCategories,
  excludeServices,
  onShop,
  autoFocus = false,
}: {
  tree: PickerParentView[];
  onPick: (leaf: PickerLeafView) => void;
  /**
   * 🧭 `/open-shop?as=coordinator` (owner 2026-11-06, "SUPPLIER SIGN-UP REDESIGN — FOUR CALLS ANSWERED"): open on
   * the coordination services — the leaves whose key is in `COORDINATOR_TRADE_SERVICES`, READ FROM THE CONSTANT,
   * never a word search ("Destination Wedding Travel Coordinators" matches the word and is NOT a coordinator).
   */
  coordinatorOnly?: boolean;
  /** "Not a coordinator? Search all services" — the wizard drops the coordinator view. */
  onSearchAll?: () => void;
  /**
   * "Another category" (prototype v14.1, owner 6 Nov: *"venue is picked, so venue should not show anymore when we look
   * for more category"*): a category already on the list is not offered as a tile — more of it comes from its card's
   * blank row. A group left empty drops out.
   */
  excludeCategories?: ReadonlySet<string>;
  /** Services already on the list — never offered again (search or rows). */
  excludeServices?: ReadonlySet<string>;
  /**
   * ➕ THE DASHBOARD'S "ADD A SERVICE" (ruling 5820): the services ALREADY ON YOUR SHOP (a card of that service exists).
   * Unlike `excludeServices` they stay SHOWN — in search, in a category's rows — marked "On your shop", and are not a
   * button: never pickable twice. A category whose only service is on the shop opens on the tap instead of adding it.
   * `/open-shop` passes none (a new shop has nothing on it), so sign-up is unchanged.
   */
  onShop?: ReadonlySet<string>;
  /** "Another category" puts the cursor in the search box (prototype `add-svc`). */
  autoFocus?: boolean;
}) {
  /** The category (tree branch `tileId`) whose services are open — `null` = the category tiles. */
  const [openCategory, setOpenCategory] = useState<string | null>(null);
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
  const offered = (l: PickerLeafView) => !excludeServices?.has(l.canonicalService);

  const opened = useMemo(() => {
    for (const p of tree) for (const b of p.branches) if (b.tileId === openCategory) return { group: p, category: b };
    return null;
  }, [tree, openCategory]);

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
  // space, typo errors…)"). `matches` = the shipped tiers; `close` = typos, shown apart under "Close matches" and
  // never picked for the vendor.
  const { matches: rawHits, close: rawClose } = useMemo(
    () =>
      q.length < 2 ? { matches: [], close: [] } : rankTaxonomyOptionsWithClose(flat, q, 30),
    [flat, q],
  );
  const hits = rawHits.filter((h) => offered(h.leaf));
  const close = rawClose.filter((h) => offered(h.leaf));

  // The prototype's rows: one line, the path under it when it teaches where a trade lives, a › at the right.
  const rowStyle = 'flex min-h-[50px] w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-[15px]';
  const row = (leaf: PickerLeafView, path?: string) =>
    onShop?.has(leaf.canonicalService) ? (
      /* Already on the shop: shown so the supplier sees it is there, and NOT a button — never picked twice. */
      <div className={rowStyle} aria-disabled="true" data-service-on-shop={leaf.canonicalService}>
        <span className="min-w-0">
          <span className="block truncate" style={{ color: 'var(--m-slate-3)' }}>
            {leaf.label}
          </span>
          {path ? (
            <span className="block truncate text-xs" style={{ color: 'var(--m-slate-3)' }}>
              {path}
            </span>
          ) : null}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium" style={{ color: 'rgb(var(--color-ok))' }}>
          <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          On your shop
        </span>
      </div>
    ) : (
    <button type="button" className={rowStyle} onClick={() => onPick(leaf)} data-open-shop-service-row={leaf.canonicalService}>
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

  const tiles = (
    <CategoryTiles
      tree={tree}
      exclude={excludeCategories}
      onOpen={(id) => {
        // Owner 7 Nov (prototype v16 updated in place, specs f15a3a7, DECISION_LOG 2026-11-07): a category with only ONE
        // service adds that service on the tap — no drill-in row. Its optional specialties are never auto-picked.
        const leaves = tree.flatMap((p) => p.branches).find((b) => b.tileId === id)?.leaves;
        // ➕ Its one service already ON YOUR SHOP (the dashboard's Add a service): open the category, so the row shows it.
        const only = leaves?.length === 1 && onShop?.has(leaves[0]!.canonicalService) ? undefined : leaves;
        if (only && only.length === 1 && offered(only[0]!)) {
          setQuery('');
          onPick(only[0]!);
          return;
        }
        setOpenCategory(id);
        setQuery('');
      }}
    />
  );

  const coordinatorView = coordinatorOnly && q.length < 2 && !opened;

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
            setOpenCategory(null);
          }}
          placeholder="Search what you do"
          className="min-h-8 w-full bg-transparent text-sm outline-none [&::-webkit-search-cancel-button]:appearance-none"
          aria-label="Search services"
          // eslint-disable-next-line jsx-a11y/no-autofocus -- "Another category" opens on the search, as drawn
          autoFocus={autoFocus}
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
                {coordinatorLeaves.filter(offered).map((l) => (
                  <li key={l.canonicalService}>{row(l)}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {/* v18 BUTTON_RULE — an action is a pill (grey: it changes the view, it moves nothing forward). */}
          <p className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--m-slate-3)' }}>
            Not a coordinator?
            <ActionButton
              tone="neutral"
              icon={Search}
              label="Search all services"
              onClick={() => {
                onSearchAll?.();
                searchRef.current?.focus({ preventScroll: true });
              }}
              data-testid="open-shop-search-all"
            />
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
          /* Typos: shown apart under "Close matches — did you mean", never picked for the vendor; the categories stay
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
              Not it? Browse the categories.
            </p>
            {tiles}
          </>
        ) : (
          <>
            <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
              Nothing by that name — browse the categories.
            </p>
            {tiles}
          </>
        )
      ) : !opened ? (
        tiles
      ) : (
        /* A tapped category → its services as rows (prototype v11 `zSvcList`): the category's photo and name, "All
           categories" back, then its group with the category's ⓘ. */
        <div className={listFrame} style={{ borderColor: 'var(--m-line)' }}>
          <ul className="divide-y" style={{ borderColor: 'var(--m-line)' }} data-open-shop-category-services={opened.category.tileId}>
            <li className="flex items-center justify-between gap-2 px-3.5 py-1.5" style={{ background: 'var(--m-paper-2)' }}>
              <span className="flex min-w-0 items-center gap-2">
                {opened.category.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a signed catalogue URL, not an optimisable asset
                  <img src={opened.category.photoUrl} alt="" className="h-[27px] w-9 shrink-0 rounded-md object-cover" />
                ) : (
                  /* v19 — no photo yet: the wash + one gold icon (prototype `.cth.ph`). */
                  <span
                    aria-hidden
                    className="inline-flex h-[27px] w-9 shrink-0 items-center justify-center rounded-md"
                    style={{ background: 'var(--m-paper)', boxShadow: 'inset 0 0 0 1px var(--m-line)', color: 'rgb(var(--color-terracotta))' }}
                  >
                    {(() => {
                      const Icon = tileIcon(opened.category.tileId);
                      return <Icon className="h-4 w-4" strokeWidth={1.75} />;
                    })()}
                  </span>
                )}
                <span className="truncate text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                  {opened.category.label}
                </span>
              </span>
              {/* v18 BUTTON_RULE — going back is a grey pill, never a text link. */}
              <ActionButton tone="neutral" icon={ArrowLeft} label="All categories" onClick={() => setOpenCategory(null)} />
            </li>
            <li className="px-3.5 pb-1 pt-2 text-xs" style={{ color: 'var(--m-slate-3)' }}>
              {opened.category.hint ? (
                <InfoTip label={opened.group.label} labelClassName="text-xs" ariaLabel={`What is ${opened.category.label}?`} align="start">
                  {opened.category.hint}
                </InfoTip>
              ) : (
                opened.group.label
              )}
            </li>
            {opened.category.leaves.filter(offered).length > 0 ? (
              opened.category.leaves.filter(offered).map((l) => <li key={l.canonicalService}>{row(l)}</li>)
            ) : (
              <li className="px-3.5 py-3 text-[13px]" style={{ color: 'var(--m-slate-3)' }}>
                All of this category is on your list
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Balanced rows of at most three: 4 → 2+2, 5 → 3+2, 7 → 3+2+2 (prototype v11 `balRows`), every tile one height. */
export function balancedRows<T>(items: readonly T[]): T[][] {
  const rows = Math.ceil(items.length / 3);
  const out: T[][] = [];
  let i = 0;
  for (let k = 0; k < rows; k++) {
    const n = Math.ceil((items.length - i) / (rows - k));
    out.push(items.slice(i, i + n));
    i += n;
  }
  return out;
}

/* ── THE CATEGORIES AS PHOTO TILES, UNDER SMALL GROUP HEADINGS (prototype v11 `catTiles`): the events grid's own tile —
   the category's photo with its name on the scrim; a category with no photo is the plain tile. Each row fills the
   width. Drawn UNDER the search box — this component is placed after the picker so the source reads in screen order. */
function CategoryTiles({
  tree,
  exclude,
  onOpen,
}: {
  tree: PickerParentView[];
  exclude?: ReadonlySet<string>;
  onOpen: (tileId: string) => void;
}) {
  const groups = tree
    .map((p) => ({ group: p, cats: p.branches.filter((b) => !exclude?.has(b.tileId)) }))
    .filter((g) => g.cats.length > 0);
  return (
    <div className="grid gap-0.5" data-open-shop-categories="">
      {groups.map(({ group, cats }) => (
        <div key={group.folderId} className="grid gap-2">
          <span
            className="px-0.5 pb-0.5 pt-2.5 text-[10.5px] font-medium uppercase tracking-[0.14em]"
            style={{ color: 'var(--m-slate-3)' }}
          >
            {group.label}
          </span>
          {balancedRows(cats).map((rowCats, r) => (
            <div key={r} className="flex gap-2">
              {rowCats.map((b) => {
                // v19 (prototype `.evt.ph`, owner 7 Nov): a category with no photo yet is the app's wash + line, its
                // name in ink, ONE lucide icon in gold (`tileIcon`, the one tile→icon map) — no brown gradient, no
                // emoji. The photo, when the catalogue has one, drops in over it.
                const Icon = tileIcon(b.tileId);
                return (
                  <button
                    key={b.tileId}
                    type="button"
                    onClick={() => onOpen(b.tileId)}
                    aria-label={b.label}
                    className="relative isolate block h-24 min-w-0 flex-1 overflow-hidden rounded-[var(--m-r-sm)] text-left"
                    style={
                      b.photoUrl
                        ? { background: 'var(--m-paper-2)' }
                        : { background: 'var(--m-paper-2)', boxShadow: 'inset 0 0 0 1px var(--m-line)' }
                    }
                    data-open-shop-category-tile={b.tileId}
                    data-open-shop-category-tile-plain={b.photoUrl ? undefined : ''}
                  >
                    {b.photoUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element -- a signed catalogue URL, not an optimisable asset */}
                        <img src={b.photoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
                        {/* 🌗 A scrim over a PHOTO stays dark in both themes (the event tiles' rule). */}
                        <span
                          aria-hidden
                          className="absolute inset-0"
                          style={{ background: 'linear-gradient(to top, rgba(23,22,15,.88) 0%, rgba(23,22,15,.5) 55%, transparent 100%)' }}
                        />
                      </>
                    ) : (
                      <span
                        aria-hidden
                        className="absolute inset-x-0 bottom-[22px] top-0 flex items-center justify-center"
                        style={{ color: 'rgb(var(--color-terracotta))' }}
                      >
                        <Icon className="h-6 w-6" strokeWidth={1.75} />
                      </span>
                    )}
                    <span
                      className={`absolute inset-x-2 bottom-[7px] text-[12.5px] font-semibold leading-[1.1] ${b.photoUrl ? 'text-white' : ''}`}
                      style={b.photoUrl ? { textShadow: '0 1px 6px rgba(0,0,0,.5)' } : { color: 'var(--m-ink)' }}
                    >
                      {b.label}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
