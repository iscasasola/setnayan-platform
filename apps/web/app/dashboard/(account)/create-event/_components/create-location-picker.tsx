'use client';

import { useMemo, useState } from 'react';
import { CITIES } from '@/app/onboarding/wedding/_data/wedding-cities';

/**
 * Compact area picker for the non-wedding inline create form — pick up to 2
 * candidate areas ("Manila or Tagaytay"), mirroring the up-to-4 candidate dates
 * (owner 2026-07-12: "location can be in 2 places, give them choices").
 *
 * Bespoke native-Tailwind (NOT the wedding LocationStep, whose classes are
 * scoped under the onboarding-only `.onbw` stylesheet and render unstyled off
 * that route — same reason CreateDatePicker is bespoke). Uses the shared CITIES
 * data (pure). Emits the picked area keys as hidden `location_area` inputs so
 * the server action resolves them → region + venue centroid + search_areas.
 * Optional.
 */
const MAX_AREAS = 2;

export function CreateLocationPicker() {
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');

  const byKey = useMemo(() => Object.fromEntries(CITIES.map((c) => [c.k, c])), []);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? CITIES.filter((c) => c.n.toLowerCase().includes(q) || c.r.toLowerCase().includes(q))
      : CITIES.filter((c) => c.top != null).sort((a, b) => (a.top ?? 99) - (b.top ?? 99));
    return pool.slice(0, 8);
  }, [query]);

  const full = selected.length >= MAX_AREAS;
  const add = (k: string) =>
    setSelected((s) => (s.includes(k) || s.length >= MAX_AREAS ? s : [...s, k]));
  const remove = (k: string) => setSelected((s) => s.filter((x) => x !== k));

  return (
    <div className="space-y-2">
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-1.5 rounded-full bg-terracotta/10 px-3 py-1 text-sm text-ink"
            >
              {byKey[k]?.n ?? k}
              <button
                type="button"
                onClick={() => remove(k)}
                aria-label={`Remove ${byKey[k]?.n ?? k}`}
                className="text-ink/40 hover:text-ink focus:outline-none"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {full ? (
        <p className="text-xs text-ink/40">Up to 2 areas. Remove one to change it.</p>
      ) : (
        <>
          <input
            autoComplete="off"
            className="input-field"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a city or area…"
            type="text"
            value={query}
          />
          <div className="max-h-44 divide-y divide-ink/5 overflow-y-auto rounded-lg border border-ink/10">
            {results.length > 0 ? (
              results.map((c) => (
                <button
                  key={c.k}
                  type="button"
                  disabled={selected.includes(c.k)}
                  onClick={() => add(c.k)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-ink/5 focus:bg-ink/5 focus:outline-none disabled:opacity-40"
                >
                  <span className="font-medium text-ink">{c.n}</span>
                  <span className="shrink-0 text-xs text-ink/50">{c.r}</span>
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-ink/40">No matches — try another spelling.</p>
            )}
          </div>
        </>
      )}

      {selected.map((k) => (
        <input key={k} type="hidden" name="location_area" value={k} />
      ))}
    </div>
  );
}
