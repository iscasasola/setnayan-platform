'use client';

/*
 * Reception-anchored location step (owner 2026-06-04 · supersedes the single-select
 * region picker). Ported from the onboarding prototype (Onboarding_Wedding_Flow):
 *   • idle  → a Top-30 wedding-cities CAROUSEL (real photo + per-city nugget, ranked)
 *   • type  → searches the curated cities FIRST, then the full PSGC set (every PH
 *             province/city/municipality — lazy-loaded so it never bloats the bundle)
 *   • "Near me" → device GPS re-sorts the curated cities nearest-first (haversine)
 * Couple picks up to 2 areas → chips. The pick scopes the reception-venue search;
 * the parent derives the region label + venue coords from the primary pick.
 */

import { useEffect, useRef, useState } from 'react';
import {
  CITIES,
  TOP30,
  cityByKey,
  REGION_CENTROID,
  normPlace,
  kmBetween,
  type WeddingCity,
} from '../_data/wedding-cities';
import type { PhPlace } from '../_data/ph-places';

type Pos = { lat: number; lon: number };
type Row = { c: WeddingCity; d: number | null };

const MAX = 2;
const NCR_FALLBACK: Pos = { lat: 14.58, lon: 121.0 };

export function LocationStep({
  value,
  onChange,
}: {
  value: string[];
  onChange: (keys: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'popular' | 'near'>('popular');
  const [userPos, setUserPos] = useState<Pos | null>(null);
  const [posFallback, setPosFallback] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [ph, setPh] = useState<PhPlace[] | null>(null); // full PSGC set, lazy-loaded
  const phByKey = useRef<Record<string, WeddingCity>>({});

  // Lazy-load the ~80KB PSGC set the first time the couple searches.
  useEffect(() => {
    if (query.trim() && !ph) {
      let live = true;
      import('../_data/ph-places').then((m) => {
        if (live) setPh(m.PH_PLACES);
      });
      return () => {
        live = false;
      };
    }
  }, [query, ph]);

  const phToObj = (t: PhPlace): WeddingCity => {
    const cc = REGION_CENTROID[t[2]] ?? [12.8, 121.8];
    const k = 'p:' + normPlace(t[0]) + ':' + t[2];
    const o: WeddingCity = { k, n: t[0], r: t[1], rk: t[2], lat: cc[0], lon: cc[1] };
    phByKey.current[k] = o;
    return o;
  };
  const resolve = (k: string): WeddingCity | undefined => cityByKey(k) ?? phByKey.current[k];

  const toggle = (k: string) => {
    if (value.includes(k)) onChange(value.filter((x) => x !== k));
    else if (value.length < MAX) onChange([...value, k]);
  };

  const nearMe = () => {
    if (mode === 'near') {
      setMode('popular');
      return;
    }
    setGpsLoading(true);
    const finish = (pos: Pos, fallback: boolean) => {
      setUserPos(pos);
      setPosFallback(fallback);
      setMode('near');
      setGpsLoading(false);
    };
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      finish(NCR_FALLBACK, true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => finish({ lat: p.coords.latitude, lon: p.coords.longitude }, false),
      () => finish(NCR_FALLBACK, true),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  };

  // Build the result list (null = show the idle carousel instead).
  const q = query.trim().toLowerCase();
  let header = 'Top 30 wedding destinations';
  let rows: Row[] | null = null;
  if (q) {
    const curated: Row[] = CITIES.filter(
      (c) => c.n.toLowerCase().includes(q) || c.r.toLowerCase().includes(q),
    ).map((c) => ({ c, d: userPos ? kmBetween(userPos, c) : null }));
    const seen = new Set(curated.map(({ c }) => normPlace(c.n)));
    const extra: Row[] = [];
    const PH = ph ?? [];
    for (let j = 0; j < PH.length && curated.length + extra.length < 30; j++) {
      const t = PH[j];
      if (!t) continue;
      if (
        (t[0].toLowerCase().includes(q) || t[1].toLowerCase().includes(q)) &&
        !seen.has(normPlace(t[0]))
      ) {
        seen.add(normPlace(t[0]));
        const o = phToObj(t);
        extra.push({ c: o, d: userPos ? kmBetween(userPos, o) : null });
      }
    }
    rows = curated.concat(extra);
    header = rows.length
      ? rows.length >= 30
        ? 'Matches · keep typing to narrow'
        : 'Matches'
      : 'No match — try another spelling';
  } else if (mode === 'near' && userPos) {
    header = posFallback ? 'Nearest to you · allow location for your exact area' : 'Nearest to you';
    rows = CITIES.map((c) => ({ c, d: kmBetween(userPos, c) }))
      .sort((a, b) => (a.d ?? 0) - (b.d ?? 0))
      .slice(0, 30);
  }
  const list: Row[] = rows ?? [];
  const showCarousel = rows === null;
  // Near-me results that are Top-30 destinations render as photo cards (same art the carousel uses).
  const nearActive = !showCarousel && !q && mode === 'near' && Boolean(userPos);

  return (
    <>
      <div className="viewzone">
        <div className="eyebrow">Where</div>
        <h1 className="q">Where will it be?</h1>
        <p className="sub">
          {'Pick up to 2 areas you’re considering — we’ll show venues there, and only the vendors who serve your area.'}
        </p>
        <div className="locpicks" data-count={value.length} aria-live="polite">
          {value.length === 0 ? (
            <span className="locpicks-empty">
              {'Tap a destination, search any city, or use “Near me”.'}
            </span>
          ) : (
            value.map((k) => {
              const c = resolve(k);
              return (
                <span key={k} className="locchip">
                  <span className="locchip-label">{c?.n ?? k}</span>
                  <button
                    type="button"
                    className="locchip-x"
                    aria-label={`Remove ${c?.n ?? k}`}
                    onClick={() => toggle(k)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                      <path d="M7 7l10 10M17 7L7 17" />
                    </svg>
                  </button>
                </span>
              );
            })
          )}
        </div>
      </div>

      <div className="tapzone">
        <div className="locresults-wrap">
          <div className="locresult-h">{header}</div>

          {showCarousel ? (
            <div className="loccarousel">
              {TOP30.map((k, i) => {
                const c = cityByKey(k);
                if (!c) return null;
                const on = value.includes(k);
                return (
                  <button
                    type="button"
                    key={k}
                    className={`loccard${on ? ' sel' : ''}`}
                    style={{ backgroundImage: `url(/onboarding/cities/${k}.webp)` }}
                    onClick={() => toggle(k)}
                    aria-pressed={on}
                  >
                    <span className="loccard-rank">{i + 1}</span>
                    <span className="loccard-check" />
                    <span className="loccard-scrim">
                      <span className="loccard-region">{c.r}</span>
                      <span className="loccard-city">{c.n}</span>
                      {c.nug && <span className="loccard-nug">{c.nug}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="locresults rise">
              {list.map(({ c, d }) => {
                const on = value.includes(c.k);
                // Near-me result that's a Top-30 destination → photo card (same
                // background art the carousel uses), not a plain text row.
                if (nearActive && TOP30.includes(c.k)) {
                  return (
                    <button
                      type="button"
                      key={c.k}
                      className={`locphoto${on ? ' sel' : ''}`}
                      style={{ backgroundImage: `url(/onboarding/cities/${c.k}.webp)` }}
                      onClick={() => toggle(c.k)}
                      aria-pressed={on}
                    >
                      <span className="loccard-check" />
                      <span className="loccard-scrim">
                        <span className="loccard-region">{c.r}</span>
                        <span className="loccard-city">
                          {c.n}
                          {d != null && <span className="locphoto-km"> · {d} km</span>}
                        </span>
                        {c.nug && <span className="loccard-nug">{c.nug}</span>}
                      </span>
                    </button>
                  );
                }
                return (
                  <div
                    key={c.k}
                    className={`opt rowimg locrow${on ? ' sel' : ''}`}
                    onClick={() => toggle(c.k)}
                  >
                    <div className="otcol">
                      <div className="ot">
                        {c.n}
                        {d != null && <span className="km"> · {d} km</span>}
                      </div>
                      <div className="od">{c.r}</div>
                      {c.nug && <div className="locnug">{c.nug}</div>}
                    </div>
                    <span className="check" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="locbar">
          <label className="locsearch">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              type="text"
              inputMode="search"
              autoComplete="off"
              placeholder={'Search a city or place…'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={`locgps${mode === 'near' ? ' on' : ''}${gpsLoading ? ' loading' : ''}`}
            aria-pressed={mode === 'near'}
            aria-label="Use my current location"
            onClick={nearMe}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              <circle cx="12" cy="12" r="4" />
            </svg>
            <span>Near me</span>
          </button>
        </div>
      </div>
    </>
  );
}
