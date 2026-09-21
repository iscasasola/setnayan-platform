'use client';

/**
 * ServicesCoveredPicker — "what services does this cover" for a supplier the
 * couple added themselves. (owner 2026-09-20)
 *
 * Owner, verbatim: *"services covered initially places it to the category you
 * manually added then add more to search more service that might be included
 * on their package."*
 *
 * ── Why a search and not a wall of chips ──────────────────────────────────
 * An earlier pass rendered every plan group as a toggle chip. There are 30+,
 * so the couple got a paragraph of pills to hunt through for the two that
 * apply. Seeded + searched inverts it: the category they added the supplier
 * under is already there, and anything else is two or three keystrokes away.
 *
 * ── The seeded chip is a FACT, not a choice ───────────────────────────────
 * The booking's own category is rendered on and un-togglable. It is covered by
 * construction — it is where the couple filed this supplier — so offering to
 * switch it off would offer them a lie. Guarded in the handler as well as by
 * `disabled`, because `aria-pressed` buttons stay keyboard-reachable in some
 * assistive setups.
 *
 * ⚖ AND IT IS NOT SUBMITTED. It is already implied by `event_vendors.category`,
 * and the column keeps meaning "ALSO covers". `bucketForVendor` never takes an
 * ALSO-covered group as the money's home (`isHomeGroupFor`, 2026-09-21 — it used
 * to read `[0]`, which filed a venue that also covers catering under Catering),
 * so dropping an own group a row happened to carry is harmless: the category
 * maps the same bucket.
 *
 * Motion: rows and chips use `.sn-canvas-rise`, the maker's own entrance —
 * already covered by the global `prefers-reduced-motion` block in globals.css,
 * which disables it with `!important`. Nothing here opts out of that.
 */

import { useMemo, useState } from 'react';
import { Check, Lock, Plus, Search, X } from 'lucide-react';

export type CoverOption = { id: string; label: string };

export function ServicesCoveredPicker({
  options,
  ownGroupId,
  ownGroupLabel,
  initialSelected,
  disabled,
  onChange,
}: {
  /** Every plan group EXCEPT the booking's own — that one is passed separately. */
  options: readonly CoverOption[];
  ownGroupId: string | null;
  ownGroupLabel: string;
  initialSelected: readonly string[];
  disabled?: boolean;
  /** Fires with the ALSO-covers ids only; the own group is never included. */
  onChange?: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(initialSelected.filter((id) => id !== ownGroupId)),
  );
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return [];
    return options
      .filter((o) => o.id !== ownGroupId && !selected.has(o.id))
      .filter((o) => o.label.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, options, ownGroupId, selected]);

  function commit(next: Set<string>) {
    setSelected(next);
    onChange?.([...next]);
  }

  function add(id: string) {
    const next = new Set(selected);
    next.add(id);
    commit(next);
    setQuery('');
  }

  function remove(id: string) {
    // The own group is never in `selected`, so it can never reach this.
    const next = new Set(selected);
    next.delete(id);
    commit(next);
  }

  const chosen = options.filter((o) => selected.has(o.id));

  return (
    <div className="space-y-2">
      {/* The submitted set. The own group is deliberately absent — see docblock. */}
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="covers" value={id} />
      ))}

      <div className="flex flex-wrap items-center gap-1.5">
        {ownGroupId ? (
          <span
            className="sn-canvas-rise inline-flex items-center gap-1 rounded-full border border-mulberry/40 bg-mulberry/10 px-2.5 py-1 text-xs font-medium text-mulberry"
            title="This is the category you added them under"
          >
            <Lock aria-hidden className="h-3 w-3" strokeWidth={2} />
            {ownGroupLabel}
          </span>
        ) : null}

        {chosen.map((o, i) => (
          <span
            key={o.id}
            className="sn-canvas-rise inline-flex items-center gap-1 rounded-full border border-ink/15 bg-cream px-2.5 py-1 text-xs font-medium text-ink/75 transition-colors"
            style={{ animationDelay: `${Math.min(i, 6) * 28}ms` }}
          >
            {o.label}
            <button
              type="button"
              disabled={disabled}
              onClick={() => remove(o.id)}
              aria-label={`Remove ${o.label}`}
              className="-mr-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-ink/45 transition-colors hover:bg-ink/10 hover:text-ink disabled:opacity-50"
            >
              <X aria-hidden className="h-3 w-3" strokeWidth={2.2} />
            </button>
          </span>
        ))}
      </div>

      <div className="relative">
        <div className="flex items-center gap-2 rounded-md border border-ink/15 bg-cream px-2.5 focus-within:border-terracotta">
          <Search aria-hidden className="h-3.5 w-3.5 shrink-0 text-ink/40" strokeWidth={1.9} />
          <input
            type="text"
            value={query}
            disabled={disabled}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Add another service they cover…"
            aria-label="Search services this supplier also covers"
            className="w-full bg-transparent py-2 text-sm text-ink placeholder:text-ink/40 focus:outline-none disabled:opacity-60"
          />
        </div>

        {matches.length > 0 ? (
          <ul
            className="sn-canvas-rise absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-ink/15 bg-cream shadow-lg"
            aria-label="Matching services"
          >
            {matches.map((o, i) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => add(o.id)}
                  className="sn-canvas-rise flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-mulberry/10"
                  style={{ animationDelay: `${i * 22}ms` }}
                >
                  <Plus aria-hidden className="h-3.5 w-3.5 text-ink/40" strokeWidth={2} />
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {/* An empty search is silent on purpose — the couple keeps typing. A
            "no results" line would be noise on a list they are mid-way
            through spelling. */}
      </div>

      {chosen.length > 0 ? (
        <p className="flex items-center gap-1 text-[11px] text-ink/50">
          <Check aria-hidden className="h-3 w-3" strokeWidth={2.2} />
          One booking, one price — counted once across all of these.
        </p>
      ) : null}
    </div>
  );
}
