'use client';

/**
 * ServicesCoveredPicker — "what services does this cover" for a supplier the
 * couple added themselves. (owner 2026-09-20)
 *
 * Owner, verbatim: *"services covered initially places it to the category you
 * manually added then add more to search more service that might be included
 * on their package."*
 *
 * ── THE LIST IS THE SUPPLIERS PAGE'S OWN ROWS (owner 2026-10-20) ──────────
 * *"how do i connect the dunkin donuts to a food truck category?"* … *"we
 * already have that food truck category"* … *"allow us to search that and add
 * it on the category for their service … we do not have the categories synced
 * properly"*. This used to offer the ~30 PLAN GROUPS while the Suppliers page
 * draws the TAXONOMY TILES, so Food Truck, Food Cart, Dessert, Massage Chair …
 * could not be ticked at all. The options are now `CoverCatalogFolder[]` — what
 * `coverCatalogFromFolders` makes of the page's own `buildShortlistFolders`
 * call (same names, folders and order) — and the type is the guard: a caller
 * cannot hand this a plan-group list any more. A search box heads the list.
 * Guard: `lib/also-covers-is-the-suppliers-rows.test.ts`.
 *
 * ── Why a dropdown and not a wall of chips ────────────────────────────────
 * The house dropdown with checkmarks (PickMenu `picked`; INTERACTION_RULES § 9
 * — "any set of choices = ONE PickMenu"); PickMenu has no search of its own, so
 * the box rides in its `head` slot and filters the options it is given.
 *
 * ── The card's own row is a FACT, not a choice ────────────────────────────
 * The row the couple filed this supplier under is said under the dropdown,
 * locked, and never offered — it is covered by construction, so offering to
 * switch it off would offer them a lie.
 *
 * ⚖ AND IT IS NOT SUBMITTED. It is already implied by `event_vendors.category`,
 * and the column keeps meaning "ALSO covers". `bucketForVendor` never takes an
 * ALSO-covered group as the money's home (`isHomeGroupFor`, 2026-09-21).
 *
 * ⚖ A STORED KEY IS KEPT AS STORED. Selection is by ROW (tile); a key already
 * on a row stays byte-for-byte (`officiant` stays `officiant`, though it draws
 * under Ceremony) unless the couple unticks it, so opening and saving the sheet
 * never rewrites what the Budget readers see. A key that names no row is kept
 * too, and still submitted.
 *
 * ── "MOVE TO ANOTHER CATEGORY" (owner 2026-10-20 → "okay") ────────────────
 * Beside the locked row, for a supplier already on the event (`move`): the SAME
 * searchable one list, single pick, moves the card's OWN row there. The pick is
 * confirmed in place in one line — "Dunkin' Donuts moves from Everything else
 * to Food Truck. Its price and payments move with it." · Move · Cancel — and an
 * Undo rides the toast after. The write is `moveSupplierToCategory` (one action,
 * the card's own auth); what it writes is `planSupplierMove`, shared with the
 * guard `lib/a-moved-supplier-is-drawn-once-under-its-new-row.test.ts`.
 *
 * 🔑 A LIST THAT DID NOT LOAD SAYS SO — it is never drawn as an empty list,
 * and the keys already stored are still submitted, so a save cannot wipe them.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, Lock, Search } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { PeekToast } from '@/app/_components/toast/peek-toast';
import { coversByRow, tileForCategory, type CoverCatalogFolder } from '@/lib/shortlist-taxonomy';
import type { VendorCategory } from '@/lib/vendors';
import { loadCoverCatalog } from '../vendors/actions';
import { moveSupplierToCategory } from '../vendors/[vendorId]/workspace/actions';

type Offered = { key: string; tile: string; label: string; group: string };

/** The list's search box — one drawing for both lists (also covers · move). */
function SearchHead({ query, onQuery, empty }: { query: string; onQuery: (q: string) => void; empty: boolean }) {
  return (
    <li role="none" className="sticky top-0 z-[2] -mx-1.5 -mt-1.5 mb-1 bg-cream/95 p-1.5">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/45" strokeWidth={2} />
        <input className="min-h-11 w-full rounded-xl border border-ink/15 bg-cream pl-9 pr-3 text-[14px] text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none"
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search categories"
          aria-label="Search categories"
          data-covers-search=""
        />
      </div>
      {empty ? (
        <p className="px-3 pt-2 text-[12px] text-ink/55">No category matches “{query.trim()}”.</p>
      ) : null}
    </li>
  );
}

function matching(list: readonly Offered[], query: string): Offered[] {
  const q = query.trim().toLowerCase();
  return q ? list.filter((o) => o.label.toLowerCase().includes(q) || o.group.toLowerCase().includes(q)) : [...list];
}

export function ServicesCoveredPicker({
  eventId,
  category,
  homeTile,
  ownLabel,
  catalog: given,
  initialSelected,
  disabled,
  onChange,
  move,
  onMoved,
}: {
  eventId: string;
  /** The booking's own `event_vendors.category` — its row is locked, never offered. */
  category: string;
  /** The row the card is drawn under (`homeTileForRow`) when the caller knows it; else from `category`. */
  homeTile?: string | null;
  ownLabel: string;
  /** The Suppliers page's rows. Omitted → read for this event (`loadCoverCatalog`). */
  catalog?: readonly CoverCatalogFolder[];
  initialSelected: readonly string[];
  disabled?: boolean;
  /** Fires with the ALSO-covers keys only; the own row is never included. */
  onChange?: (keys: string[]) => void;
  /** A supplier already on the event — offers "Move <name> to another category". */
  move?: { vendorId: string; name: string };
  /** The card's own row changed (a move, or its Undo). */
  onMoved?: (tile: string) => void;
}) {
  const [ownTile, setOwnTile] = useState<string | null>(
    () => homeTile ?? tileForCategory(category as VendorCategory),
  );
  const [fetched, setFetched] = useState<readonly CoverCatalogFolder[] | 'loading' | 'failed'>('loading');
  const hasGiven = given !== undefined;
  useEffect(() => {
    if (hasGiven) return;
    let live = true;
    loadCoverCatalog(eventId).then(
      (r) => {
        if (live) setFetched(r.ok ? r.catalog : 'failed');
      },
      () => {
        if (live) setFetched('failed');
      },
    );
    return () => {
      live = false;
    };
  }, [eventId, hasGiven]);
  const read = given ?? fetched;

  const [rows, setRows] = useState(() => coversByRow(initialSelected, ownTile));
  const [query, setQuery] = useState('');
  const submitted = [...[...rows.byTile.values()].flat(), ...rows.unplaced];

  const folders = read === 'loading' || read === 'failed' ? null : read;
  const every = useMemo<Offered[]>(
    () => (folders ?? []).flatMap((f) => f.options.map((o) => ({ ...o, group: f.label }))),
    [folders],
  );
  const labelOf = (tile: string | null) => (tile ? every.find((o) => o.tile === tile)?.label : undefined);
  const homeLabel = labelOf(ownTile) ?? ownLabel;
  const offered = useMemo(() => every.filter((o) => o.tile !== ownTile), [every, ownTile]);
  const shown = matching(offered, query);
  const chosen = offered.filter((o) => rows.byTile.has(o.tile));

  /** A tick adds the row; a second tick takes it off again. */
  function toggle(tile: string) {
    if (disabled || tile === ownTile) return;
    const key = offered.find((o) => o.tile === tile)?.key;
    if (!key) return;
    const byTile = new Map(rows.byTile);
    if (byTile.has(tile)) byTile.delete(tile);
    else byTile.set(tile, [key]);
    setRows({ byTile, unplaced: rows.unplaced });
    onChange?.([...[...byTile.values()].flat(), ...rows.unplaced]);
  }

  // ── Move the card's own row ───────────────────────────────────────────────
  const [moveQuery, setMoveQuery] = useState('');
  const moveShown = matching(offered, moveQuery);
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [moveErr, setMoveErr] = useState<string | null>(null);
  const [toast, setToast] = useState<{ n: number; tone: 'ok' | 'bad'; text: ReactNode; undo?: () => void } | null>(null);

  /** The stored keys after the server's move, drawn under the new home. */
  function settle(home: string, keys: readonly string[]) {
    const next = coversByRow(keys, home);
    setOwnTile(home);
    setRows(next);
    onChange?.([...[...next.byTile.values()].flat(), ...next.unplaced]);
    onMoved?.(home);
  }

  async function runMove(to: string, restoreCovers: string[] = []): Promise<{ from: string | null; removed: string[] } | null> {
    if (!move) return null;
    setBusy(true);
    setMoveErr(null);
    try {
      const r = await moveSupplierToCategory({ eventId, vendorId: move.vendorId, tile: to, restoreCovers });
      if (!r.ok) {
        setMoveErr(r.error);
        return null;
      }
      const kept = submitted.filter((k) => !r.removedCovers.includes(k));
      settle(r.to, [...kept, ...restoreCovers]);
      return { from: r.from, removed: r.removedCovers };
    } catch {
      setMoveErr(`${move.name} did not move. Please try again.`);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function confirmMove() {
    if (!move || !target) return;
    const fromLabel = homeLabel;
    const toLabel = labelOf(target) ?? target;
    const done = await runMove(target);
    setTarget(null);
    if (!done) return;
    const back = done.from;
    setToast({
      n: Date.now(),
      tone: 'ok',
      text: `Moved ${move.name} to ${toLabel}.`,
      undo: back
        ? async () => {
            setToast(null);
            const undone = await runMove(back, done.removed);
            setToast({
              n: Date.now(),
              tone: undone ? 'ok' : 'bad',
              text: undone ? `Moved ${move.name} back to ${fromLabel}.` : `${move.name} did not move back.`,
            });
          }
        : undefined,
    });
  }

  const lists = read === 'loading' || read === 'failed' ? null : true;

  return (
    <div className="space-y-2" data-services-covered="">
      {/* The submitted set. The own row is deliberately absent — see docblock. */}
      {submitted.map((key) => (
        <input key={key} type="hidden" name="covers" value={key} />
      ))}

      {read === 'loading' ? (
        <p className="text-[12px] text-ink/55" data-covers-loading="">
          Loading categories…
        </p>
      ) : read === 'failed' ? (
        <p role="alert" className="text-[12px] text-danger-900" data-covers-failed="">
          The category list did not load. What they already cover is kept — close this and open it again to add more.
        </p>
      ) : (
        <PickMenu
          label="Services this supplier also covers"
          value={null}
          picked={chosen.map((o) => o.tile)}
          buttonText={chosen.length > 0 ? `Also covers · ${chosen.length}` : 'Add another service they cover'}
          dataAttr="data-also-covers"
          head={<SearchHead query={query} onQuery={setQuery} empty={query.trim().length > 0 && shown.length === 0} />}
          options={shown.map((o) => ({ key: o.tile, label: o.label, group: o.group }))}
          onPick={toggle}
          className="w-full border border-ink/15"
        />
      )}

      <p className="flex flex-wrap items-center gap-1 text-[12px] text-ink/60" data-covers-line="">
        {ownTile ? (
          <span className="inline-flex items-center gap-1 font-medium text-ink/75" title="This is the category you added them under" data-covers-own={ownTile}>
            <Lock aria-hidden className="h-3 w-3" strokeWidth={2} />
            {homeLabel}
          </span>
        ) : null}
        {chosen.length > 0 ? <span>· {chosen.map((o) => o.label).join(' · ')}</span> : null}
      </p>

      {/* MOVE — the same one list, single pick: it changes the locked row above. */}
      {move && lists && !target ? (
        <PickMenu
          label={`Move ${move.name} to another category`}
          value={null}
          buttonText={`Move ${move.name} to another category`}
          dataAttr="data-move-category"
          head={<SearchHead query={moveQuery} onQuery={setMoveQuery} empty={moveQuery.trim().length > 0 && moveShown.length === 0} />}
          options={moveShown.map((o) => ({ key: o.tile, label: o.label, group: o.group }))}
          onPick={(tile) => {
            if (disabled || busy || tile === ownTile) return;
            setMoveErr(null);
            setTarget(tile);
          }}
          className="w-full border border-ink/15"
        />
      ) : null}

      {move && target ? (
        <div className="space-y-2 rounded-xl bg-ink/[0.04] p-3" data-move-confirm={target}>
          <p className="text-[13px] leading-snug text-ink">
            {move.name} moves from {homeLabel} to {labelOf(target) ?? target}. Its price and payments move with it.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmMove}
              disabled={busy || disabled}
              data-move-yes=""
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-mulberry px-4 text-sm font-medium text-cream hover:bg-mulberry-700 disabled:opacity-60"
            >
              {busy ? 'Moving…' : 'Move'}
            </button>
            <button
              type="button"
              onClick={() => setTarget(null)}
              disabled={busy}
              data-move-no=""
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-ink/15 px-4 text-sm font-medium text-ink hover:bg-ink/[0.04] disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {moveErr ? (
        <p role="alert" className="text-[12px] text-danger-900" data-move-error="">
          {moveErr}
        </p>
      ) : null}

      {chosen.length > 0 ? (
        <p className="flex items-center gap-1 text-[11.5px] text-ink/50">
          <Check aria-hidden className="h-3 w-3" strokeWidth={2.2} />
          One booking, one price — counted once across all of these.
        </p>
      ) : null}

      {toast ? (
        <PeekToast
          key={toast.n}
          tone={toast.tone}
          data="move-category"
          onGone={() => setToast((t) => (t?.n === toast.n ? null : t))}
          action={toast.undo ? { label: 'Undo', onPress: toast.undo } : undefined}
        >
          {toast.text}
        </PeekToast>
      ) : null}
    </div>
  );
}
