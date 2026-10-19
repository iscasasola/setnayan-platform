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
 * 🔑 A LIST THAT DID NOT LOAD SAYS SO — it is never drawn as an empty list,
 * and the keys already stored are still submitted, so a save cannot wipe them.
 */

import { useEffect, useMemo, useState } from 'react';
import { Check, Lock, Search } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { coversByRow, tileForCategory, type CoverCatalogFolder } from '@/lib/shortlist-taxonomy';
import type { VendorCategory } from '@/lib/vendors';
import { loadCoverCatalog } from '../vendors/actions';

export function ServicesCoveredPicker({
  eventId,
  category,
  ownLabel,
  catalog: given,
  initialSelected,
  disabled,
  onChange,
}: {
  eventId: string;
  /** The booking's own `event_vendors.category` — its row is locked, never offered. */
  category: string;
  ownLabel: string;
  /** The Suppliers page's rows. Omitted → read for this event (`loadCoverCatalog`). */
  catalog?: readonly CoverCatalogFolder[];
  initialSelected: readonly string[];
  disabled?: boolean;
  /** Fires with the ALSO-covers keys only; the own row is never included. */
  onChange?: (keys: string[]) => void;
}) {
  const ownTile = tileForCategory(category as VendorCategory);
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
  const offered = useMemo(
    () =>
      (folders ?? []).flatMap((f) =>
        f.options.filter((o) => o.tile !== ownTile).map((o) => ({ ...o, group: f.label })),
      ),
    [folders, ownTile],
  );
  const q = query.trim().toLowerCase();
  const shown = q
    ? offered.filter((o) => o.label.toLowerCase().includes(q) || o.group.toLowerCase().includes(q))
    : offered;
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
          head={
            <li role="none" className="sticky top-0 z-[2] -mx-1.5 -mt-1.5 mb-1 bg-cream/95 p-1.5">
              <div className="relative">
                <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/45" strokeWidth={2} />
                <input className="min-h-11 w-full rounded-xl border border-ink/15 bg-cream pl-9 pr-3 text-[14px] text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none"
                  type="search"
                  inputMode="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search categories"
                  aria-label="Search categories"
                  data-covers-search=""
                />
              </div>
              {q && shown.length === 0 ? (
                <p className="px-3 pt-2 text-[12px] text-ink/55">No category matches “{query.trim()}”.</p>
              ) : null}
            </li>
          }
          options={shown.map((o) => ({ key: o.tile, label: o.label, group: o.group }))}
          onPick={toggle}
          className="w-full border border-ink/15"
        />
      )}

      <p className="flex flex-wrap items-center gap-1 text-[12px] text-ink/60" data-covers-line="">
        {ownTile ? (
          <span className="inline-flex items-center gap-1 font-medium text-ink/75" title="This is the category you added them under">
            <Lock aria-hidden className="h-3 w-3" strokeWidth={2} />
            {ownLabel}
          </span>
        ) : null}
        {chosen.length > 0 ? <span>· {chosen.map((o) => o.label).join(' · ')}</span> : null}
      </p>

      {chosen.length > 0 ? (
        <p className="flex items-center gap-1 text-[11.5px] text-ink/50">
          <Check aria-hidden className="h-3 w-3" strokeWidth={2.2} />
          One booking, one price — counted once across all of these.
        </p>
      ) : null}
    </div>
  );
}
