'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Crosshair, Search, X } from 'lucide-react';
import {
  CITIES,
  REGION_CENTROID,
  TOP30,
  cityByKey,
  kmBetween,
  normPlace,
  type WeddingCity,
} from '@/app/onboarding/wedding/_data/wedding-cities';
import type { PhPlace } from '@/app/onboarding/wedding/_data/ph-places';

/**
 * 📍 CITY OR AREA — ONE DROPDOWN, NEVER TYPED (owner 2026-10-01, DECISION_LOG
 * "THE MAKER'S VENUES GET A REAL PIN AND A PICKED CITY"; frame 2 of the
 * approved `maker_venues_pin_and_time_2026-10-04_fable.html`).
 *
 * The SAME three ways to find a place as onboarding's `location-step.tsx`, on
 * the SAME data: type (the curated wedding cities first, then every PH
 * province, city and municipality — the ~80 KB PSGC list loads on the first
 * search, through the same `import()` onboarding uses), **Near me** (the phone's location, km), or — with
 * nothing typed — the places nearest the reception's pin, in km
 * (`kmBetween`; owner, Lane 2: "distance in km only"). One tap picks and the
 * list closes. The search box only FINDS; what is stored is always a place
 * from the list (`hubDraftAction` refuses any other name — `isListedPlaceName`).
 *
 * One city per event — the reception's (owner 2026-10-04, "YES TO ALL" (1)).
 */

type Pos = { lat: number; lon: number };
type Row = { c: WeddingCity; d: number | null };

/** Metro Manila — where "Near me" stands when the phone will not say (onboarding's own fallback). */
const NCR_FALLBACK: Pos = { lat: 14.58, lon: 121.0 };

/** The curated city nearest a pin, by km — the dropdown's pre-fill when the reception is pinned. */
export function nearestCity(at: { lat: number; lng: number }): WeddingCity | null {
  let best: { c: WeddingCity; d: number } | null = null;
  for (const c of CITIES) {
    const d = kmBetween({ lat: at.lat, lon: at.lng }, c);
    if (!best || d < best.d) best = { c, d };
  }
  return best?.c ?? null;
}

/** The region half of a place's sub-line ("Metro Manila · NCR" → "Metro Manila"). */
const area = (r: string) => r.split(' · ')[0] ?? r;

export function CityPick({
  value,
  near,
  onPick,
}: {
  /** The stored place name ('' = none yet). */
  value: string;
  /** The reception's pin, when it has one — the list is measured from it. */
  near: { lat: number; lng: number } | null;
  onPick: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [ph, setPh] = useState<PhPlace[] | null>(null);
  const [query, setQuery] = useState('');
  const [me, setMe] = useState<Pos | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!query.trim() || ph) return;
    let live = true;
    void import('@/app/onboarding/wedding/_data/ph-places').then((m) => live && setPh(m.PH_PLACES));
    return () => {
      live = false;
    };
  }, [query, ph]);

  const nearMe = () => {
    setLocating(true);
    const done = (p: Pos) => {
      setMe(p);
      setLocating(false);
    };
    if (typeof navigator === 'undefined' || !navigator.geolocation) return done(NCR_FALLBACK);
    navigator.geolocation.getCurrentPosition(
      (p) => done({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => done(NCR_FALLBACK),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  };

  // The rows — onboarding's own search, measured from Near me, else the pin.
  const from: Pos | null = me ?? (near ? { lat: near.lat, lon: near.lng } : null);
  let header = 'Top wedding destinations';
  let rows: Row[] = [];
  {
    const km = (c: WeddingCity) => (from ? kmBetween(from, c) : null);
    const q = query.trim().toLowerCase();
    if (q) {
      const curated: Row[] = CITIES.filter((c) => c.n.toLowerCase().includes(q) || c.r.toLowerCase().includes(q)).map((c) => ({ c, d: km(c) }));
      const seen = new Set(curated.map(({ c }) => normPlace(c.n)));
      for (const t of ph ?? []) {
        if (curated.length >= 30) break;
        if ((t[0].toLowerCase().includes(q) || t[1].toLowerCase().includes(q)) && !seen.has(normPlace(t[0]))) {
          seen.add(normPlace(t[0]));
          const cc = REGION_CENTROID[t[2]] ?? [12.8, 121.8];
          const c: WeddingCity = { k: `p:${normPlace(t[0])}:${t[2]}`, n: t[0], r: t[1], rk: t[2], lat: cc[0], lon: cc[1] };
          curated.push({ c, d: km(c) });
        }
      }
      rows = curated;
      header = rows.length ? 'Matches' : 'No match — try another spelling';
    } else if (from) {
      header = me ? 'Nearest to you' : 'Nearest to your reception';
      rows = CITIES.map((c) => ({ c, d: km(c) })).sort((a, b) => (a.d ?? 0) - (b.d ?? 0)).slice(0, 30);
    } else {
      rows = TOP30.map((k) => cityByKey(k)).filter((c): c is WeddingCity => Boolean(c)).map((c) => ({ c, d: null }));
    }
  }

  const pick = (c: WeddingCity) => {
    onPick(c.n);
    setOpen(false);
    setQuery('');
  };
  const shown = value ? (CITIES.find((c) => c.n === value) ?? null) : null;

  return (
    <div className="flex flex-col gap-2" data-city-pick="">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink/55">City or area</span>
        <button
          type="button"
          aria-expanded={open}
          aria-label="City or area"
          onClick={() => setOpen((o) => !o)}
          data-city-pick-button=""
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3.5 text-sm text-ink"
        >
          {value ? `${value}${shown ? ` · ${area(shown.r)}` : ''}` : 'Pick a city or area'}
          <ChevronDown aria-hidden className="h-3.5 w-3.5 text-ink/50" strokeWidth={2} />
        </button>
      </div>
      {open ? (
        <div className="flex flex-col gap-2 rounded-md border border-ink/10 bg-white p-2.5" role="dialog" aria-label="City or area">
          <div className="flex items-center gap-2">
            <label className="flex min-h-10 flex-1 items-center gap-2 rounded-md border border-ink/15 px-2.5">
              <Search aria-hidden className="h-3.5 w-3.5 text-ink/45" strokeWidth={2} />
              <input
                type="text"
                inputMode="search"
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a city or place…"
                aria-label="Search a city or place"
                className="w-full bg-transparent text-[16px] text-ink outline-none"
              />
            </label>
            <button
              type="button"
              onClick={nearMe}
              aria-pressed={Boolean(me)}
              className="inline-flex min-h-10 items-center gap-1 rounded-full border border-ink/15 px-3 text-xs font-medium text-ink/80"
            >
              <Crosshair aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              {locating ? 'Finding…' : 'Near me'}
            </button>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink/60">
              <X aria-hidden className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/50">{header}</p>
          <ul className="flex max-h-72 flex-col overflow-y-auto" role="listbox" aria-label="Places">
            {rows.map(({ c, d }) => {
              const on = c.n === value;
              return (
                <li key={c.k}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => pick(c)}
                    data-city-option={c.n}
                    className={`flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left ${on ? 'bg-terracotta/10' : ''}`}
                  >
                    <span className="flex flex-col">
                      <span className="text-sm font-medium text-ink">
                        {c.n}
                        {d != null ? <span className="font-normal text-ink/55"> · {d} km</span> : null}
                      </span>
                      <span className="text-xs text-ink/55">{c.r}</span>
                    </span>
                    <span aria-hidden className={`h-4 w-4 shrink-0 rounded-full border ${on ? 'border-terracotta bg-terracotta' : 'border-ink/25'}`} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
