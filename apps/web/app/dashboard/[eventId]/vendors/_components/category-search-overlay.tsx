'use client';

/**
 * CategorySearchOverlay — the in-place full-page sheet that replaces the
 * marketplace JUMP from the Vendors-tab "Find / Add" buttons. Hard-scoped to
 * one plan group's vendors (can't drift to another category), X upper-left,
 * live as-you-type search at the bottom, a bottom-sheet Filter, and an Add
 * that shortlists the vendor and STAYS open so the couple can keep browsing
 * (add-and-stay → "✓ Added").
 *
 * Result order is owner-locked (favorites → boosted → top-10 reviews →
 * nearest); the ranking + hybrid-anonymity name resolution live server-side
 * in _actions/category-search.ts. Add reuses saveVendorToPicks (the same
 * action the marketplace Save button uses).
 *
 * Look mirrors Category_Search_Overlay_Prototype_2026-05-31.html, scoped under
 * `.csov` with the prototype's design vars aliased to the Clean Editorial
 * `--m-*` tokens + next/font families.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { saveVendorToPicks } from '@/app/vendors/actions';
import { haptic } from '@/lib/haptics';
import { VENDOR_PLACEHOLDER_PHOTO } from '@/lib/vendors';
import {
  searchCategoryVendors,
  type CategoryVendorResult,
} from '../_actions/category-search';

const CSS = `
.csov{position:fixed;inset:0;z-index:120;display:flex;flex-direction:column;
  --paper:var(--m-paper,#FBFBFA);--ink:var(--m-ink,#1E2229);--ink-soft:var(--m-ink-soft,#5C6660);
  --gold:var(--m-orange,#C5A059);--gold-deep:var(--m-orange-2,#8C6932);--mulberry:var(--m-mulberry,#5C2542);
  --line:rgba(30,34,41,.1);
  --serif:var(--font-serif,'Cormorant Garamond',serif);--sans:var(--font-sans,'Manrope',system-ui,sans-serif);--mono:var(--font-mono,'DM Mono',ui-monospace,monospace);
  background:var(--paper);color:var(--ink);font-family:var(--sans);
  animation:csov-up .3s cubic-bezier(.2,.7,.2,1)}
@keyframes csov-up{from{transform:translateY(100%)}to{transform:translateY(0)}}
.csov *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.csov .head{flex:0 0 auto;padding:14px 18px 12px;border-bottom:1px solid var(--line);background:var(--paper)}
.csov .x{width:38px;height:38px;border-radius:999px;border:1px solid var(--line);background:#fff;color:var(--ink);display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;transition:transform .13s cubic-bezier(.2,.7,.2,1),background .2s}
.csov .x:active{transform:scale(.92);background:var(--m-orange-4,#F4ECD8)}
.csov .eyebrow{font-family:var(--mono);font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold-deep);margin:12px 0 3px}
.csov .title{font-family:var(--serif);font-style:italic;font-size:27px;line-height:1.04;color:var(--ink)}
.csov .scope{font-family:var(--mono);font-size:9px;letter-spacing:.04em;color:var(--ink-soft);margin-top:6px}
.csov .results{flex:1 1 auto;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px 16px 18px}
.csov .r{display:flex;gap:12px;align-items:center;border:1px solid var(--line);border-radius:16px;background:#fff;padding:11px;margin-bottom:10px;transition:border-color .2s,box-shadow .2s}
.csov .r.added{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold) inset}
.csov .r .img{flex:0 0 64px;height:64px;border-radius:12px;background:linear-gradient(135deg,#efe9df,#e4dccd);display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-style:italic;font-size:20px;font-weight:600;color:var(--gold-deep);overflow:hidden}
.csov .r .img img{width:100%;height:100%;object-fit:cover}
.csov .r .meta{flex:1 1 auto;min-width:0}
.csov .r .vn{font-family:var(--serif);font-style:italic;font-size:17px;font-weight:600;line-height:1.12;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.csov .r .sub{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:3px;font-family:var(--mono);font-size:8.5px;letter-spacing:.03em;color:var(--ink-soft)}
.csov .r .stars{color:var(--gold-deep);letter-spacing:0}
.csov .r .badge{display:inline-flex;flex:0 0 auto;align-self:center;min-height:0;align-items:center;gap:3px;border-radius:999px;padding:2px 6px;line-height:1.4;white-space:nowrap;text-transform:uppercase}
.csov .r .badge.vrf{color:var(--gold-deep);background:rgba(197,160,89,.16)}
.csov .r .badge.bst{color:var(--mulberry);background:rgba(92,37,66,.1)}
.csov .r .badge.mt{font-weight:600;color:var(--mulberry);background:rgba(92,37,66,.12)}
.csov .r .badge.mt.good{color:var(--gold-deep);background:rgba(197,160,89,.18)}
.csov .r .badge.mt.fair{color:var(--ink-soft);background:rgba(30,34,41,.06)}
.csov .r .addbtn{flex:0 0 auto;align-self:center;border:1px solid var(--mulberry);background:var(--mulberry);color:#fff;border-radius:999px;padding:8px 14px;font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;min-height:38px;transition:transform .13s cubic-bezier(.2,.7,.2,1),opacity .2s}
.csov .r .addbtn:active{transform:scale(.93)}
.csov .r .addbtn:disabled{opacity:.6}
.csov .r .addbtn.done{border-color:var(--gold);background:transparent;color:var(--gold-deep)}
.csov .empty{font-family:var(--serif);font-style:italic;font-size:15px;color:var(--ink-soft);text-align:center;padding:40px 20px}
.csov .loading{font-family:var(--mono);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);text-align:center;padding:30px 20px}
.csov .foot{flex:0 0 auto;display:flex;gap:10px;align-items:center;padding:12px 16px;padding-bottom:calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--line);background:var(--paper)}
.csov .searchwrap{flex:1 1 auto;display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:999px;background:#fff;padding:0 14px;min-height:44px}
.csov .searchwrap input{flex:1;border:0;outline:0;background:transparent;font-family:var(--sans);font-size:14px;color:var(--ink);min-width:0}
.csov .searchwrap .si{color:var(--ink-soft);font-size:15px}
.csov .filterbtn{flex:0 0 auto;display:flex;align-items:center;gap:6px;border:1px solid var(--ink);background:var(--ink);color:var(--paper);border-radius:999px;padding:0 16px;min-height:44px;font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;transition:transform .13s cubic-bezier(.2,.7,.2,1)}
.csov .filterbtn:active{transform:scale(.95)}
.csov .filterbtn .dot{width:6px;height:6px;border-radius:50%;background:var(--gold)}
/* filter bottom-sheet */
.csov .fscrim{position:absolute;inset:0;z-index:5;background:rgba(30,34,41,.4);animation:csov-fade .2s ease}
@keyframes csov-fade{from{opacity:0}to{opacity:1}}
.csov .fsheet{position:absolute;left:0;right:0;bottom:0;z-index:6;background:var(--paper);border-radius:22px 22px 0 0;padding:18px 18px calc(20px + env(safe-area-inset-bottom,0px));box-shadow:0 -16px 40px -20px rgba(0,0,0,.4);animation:csov-up .25s cubic-bezier(.2,.7,.2,1)}
.csov .fsheet h4{font-family:var(--serif);font-style:italic;font-size:20px;color:var(--ink);margin-bottom:14px}
.csov .frow{margin-bottom:16px}
.csov .flab{font-family:var(--mono);font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:8px}
.csov .chips{display:flex;flex-wrap:wrap;gap:8px}
.csov .chip{border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:999px;padding:8px 14px;font-family:var(--mono);font-size:10px;letter-spacing:.04em;min-height:40px;transition:transform .13s cubic-bezier(.2,.7,.2,1)}
.csov .chip:active{transform:scale(.95)}
.csov .chip.on{border-color:var(--mulberry);background:var(--mulberry);color:#fff}
.csov .ftoggle{display:flex;align-items:center;justify-content:space-between;border:1px solid var(--line);border-radius:14px;padding:12px 14px;background:#fff}
.csov .ftoggle .tn{font-family:var(--serif);font-style:italic;font-size:16px;color:var(--ink)}
.csov .sw{width:46px;height:27px;border-radius:999px;background:rgba(30,34,41,.18);position:relative;transition:background .2s;flex:0 0 auto}
.csov .sw.on{background:var(--mulberry)}
.csov .sw .knob{position:absolute;top:3px;left:3px;width:21px;height:21px;border-radius:50%;background:#fff;transition:transform .2s}
.csov .sw.on .knob{transform:translateX(19px)}
.csov .fapply{width:100%;margin-top:6px;border:0;background:var(--mulberry);color:#fff;border-radius:14px;min-height:48px;font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;transition:transform .13s cubic-bezier(.2,.7,.2,1)}
.csov .fapply:active{transform:scale(.98)}
`;

const RADIUS_CHIPS: ReadonlyArray<{ label: string; km: number | null }> = [
  { label: 'Any distance', km: null },
  { label: 'Within 10 km', km: 10 },
  { label: 'Within 25 km', km: 25 },
  { label: 'Within 50 km', km: 50 },
];

export function CategorySearchOverlay({
  eventId,
  groupId,
  label,
  onClose,
}: {
  eventId: string;
  groupId: string;
  label: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  // Portal mount guard — see the createPortal note near the return.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [maxKm, setMaxKm] = useState<number | null>(null);
  const [results, setResults] = useState<CategoryVendorResult[]>([]);
  const [hasCoords, setHasCoords] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  // Vendor IDs whose logo <img> failed to load (e.g. picsum rate-limiting the
  // demo placeholders) → fall back to the initials tile, not a broken-image icon.
  const [failedLogos, setFailedLogos] = useState<Set<string>>(new Set());
  // draft filter state (committed on Apply)
  const [draftVerified, setDraftVerified] = useState(false);
  const [draftKm, setDraftKm] = useState<number | null>(null);
  const reqSeq = useRef(0);

  const run = useCallback(
    async (q: string, vOnly: boolean, km: number | null) => {
      const seq = ++reqSeq.current;
      setLoading(true);
      try {
        const res = await searchCategoryVendors({
          eventId,
          groupId,
          query: q,
          verifiedOnly: vOnly,
          maxKm: km,
        });
        if (seq !== reqSeq.current) return; // a newer request superseded this
        setResults(res.results);
        setHasCoords(res.hasReceptionCoords);
        setAdded((prev) => {
          const next = new Set(prev);
          for (const r of res.results) if (r.alreadyAdded) next.add(r.vendorProfileId);
          return next;
        });
      } finally {
        if (seq === reqSeq.current) setLoading(false);
      }
    },
    [eventId, groupId],
  );

  // initial load
  useEffect(() => {
    void run('', false, null);
  }, [run]);

  // live search — debounce typing, re-query
  useEffect(() => {
    const t = setTimeout(() => void run(query.trim(), verifiedOnly, maxKm), 240);
    return () => clearTimeout(t);
  }, [query, verifiedOnly, maxKm, run]);

  // body scroll-lock + Escape close
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (filterOpen) setFilterOpen(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, filterOpen]);

  async function add(vendorProfileId: string) {
    if (added.has(vendorProfileId) || pendingId) return;
    // Fire synchronously in the tap context — iOS only honors the switch-toggle
    // haptic in-gesture, so it must run before the saveVendorToPicks await.
    haptic('select');
    setPendingId(vendorProfileId);
    try {
      const fd = new FormData();
      fd.set('vendor_profile_id', vendorProfileId);
      const res = await saveVendorToPicks(fd);
      if (res.status === 'ok' || res.status === 'already_saved') {
        setAdded((prev) => new Set(prev).add(vendorProfileId));
      }
    } finally {
      setPendingId(null);
    }
  }

  function openFilter() {
    setDraftVerified(verifiedOnly);
    setDraftKm(maxKm);
    setFilterOpen(true);
  }
  function applyFilter() {
    setVerifiedOnly(draftVerified);
    setMaxKm(draftKm);
    setFilterOpen(false);
  }

  const filterCount = (verifiedOnly ? 1 : 0) + (maxKm !== null ? 1 : 0);
  const scope = loading
    ? `Showing only ${label.toLowerCase()} vendors`
    : `Showing only ${label.toLowerCase()} vendors · ${results.length} ${
        hasCoords ? 'near you' : 'available'
      }`;

  // Render in a portal at <body> so the overlay is NOT a DOM descendant of the
  // plan-budget-accordion (`.pbacc`). That accordion injects a GLOBAL <style>
  // using generic class names this overlay also reuses (`.v`, `.img`, `.meta`,
  // `.vn`, `.stars`). As a descendant, `.pbacc .v` (min-height:300px; flex:1 1
  // auto) bled into the verified `badge v`, ballooning it into a giant pill.
  // Portaling to <body> removes the descendant relationship, killing every
  // `.pbacc *` bleed at once. (A position:fixed full-screen overlay belongs at
  // <body> anyway.)
  if (!mounted) return null;

  return createPortal(
    <div className="csov" role="dialog" aria-modal="true" aria-label={`Add ${label} to your plan`}>
      <style>{CSS}</style>

      <div className="head">
        <button type="button" className="x" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="eyebrow">Add to your plan</div>
        <div className="title">{label}</div>
        <div className="scope">{scope}</div>
      </div>

      <div className="results">
        {loading && results.length === 0 ? (
          <div className="loading">Finding {label.toLowerCase()} vendors…</div>
        ) : results.length === 0 ? (
          <div className="empty">
            No {label.toLowerCase()} vendors match yet. Try a different search,
            or widen your filters.
          </div>
        ) : (
          results.map((r) => {
            const isAdded = added.has(r.vendorProfileId);
            const isPending = pendingId === r.vendorProfileId;
            return (
              <div className={`r${isAdded ? ' added' : ''}`} key={r.vendorProfileId}>
                <div className="img">
                  {r.logoUrl && !failedLogos.has(r.vendorProfileId) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.logoUrl}
                      alt=""
                      onError={() =>
                        setFailedLogos((s) => {
                          if (s.has(r.vendorProfileId)) return s;
                          const next = new Set(s);
                          next.add(r.vendorProfileId);
                          return next;
                        })
                      }
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={VENDOR_PLACEHOLDER_PHOTO} alt="" />
                  )}
                </div>
                <div className="meta">
                  <div className="vn">{r.name}</div>
                  <div className="sub">
                    {r.compatScore !== null ? (
                      <span
                        className={`badge mt${r.compatTier === 'good' ? ' good' : r.compatTier === 'fair' ? ' fair' : ''}`}
                      >
                        {r.compatScore}% match
                      </span>
                    ) : null}
                    {r.rating !== null && r.reviewCount ? (
                      <span className="stars">
                        ★ {r.rating.toFixed(1)} ({r.reviewCount})
                      </span>
                    ) : null}
                    {r.distanceKm !== null ? <span>{r.distanceKm} km</span> : r.city ? <span>{r.city}</span> : null}
                    {r.verified ? <span className="badge vrf">Verified</span> : null}
                    {r.boosted ? <span className="badge bst">Featured</span> : null}
                  </div>
                </div>
                <button
                  type="button"
                  className={`addbtn${isAdded ? ' done' : ''}`}
                  onClick={() => add(r.vendorProfileId)}
                  disabled={isAdded || isPending}
                >
                  {isAdded ? '✓ Added' : isPending ? '…' : '+ Add'}
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="foot">
        <div className="searchwrap">
          <span className="si" aria-hidden>
            ⌕
          </span>
          <input
            type="search"
            inputMode="search"
            placeholder={`Search ${label.toLowerCase()}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={`Search ${label} vendors`}
          />
        </div>
        <button type="button" className="filterbtn" onClick={openFilter}>
          {filterCount > 0 ? <span className="dot" aria-hidden /> : null}
          Filter
        </button>
      </div>

      {filterOpen ? (
        <>
          <div className="fscrim" onClick={() => setFilterOpen(false)} />
          <div className="fsheet" role="dialog" aria-modal="true" aria-label="Filter vendors">
            <h4>Refine</h4>
            <div className="frow">
              <div className="ftoggle">
                <span className="tn">Verified only</span>
                <button
                  type="button"
                  className={`sw${draftVerified ? ' on' : ''}`}
                  onClick={() => setDraftVerified((v) => !v)}
                  aria-pressed={draftVerified}
                  aria-label="Verified only"
                >
                  <span className="knob" />
                </button>
              </div>
            </div>
            {hasCoords ? (
              <div className="frow">
                <div className="flab">Distance from your venue</div>
                <div className="chips">
                  {RADIUS_CHIPS.map((c) => (
                    <button
                      type="button"
                      key={c.label}
                      className={`chip${draftKm === c.km ? ' on' : ''}`}
                      onClick={() => setDraftKm(c.km)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <button type="button" className="fapply" onClick={applyFilter}>
              Show results
            </button>
          </div>
        </>
      ) : null}
    </div>,
    document.body,
  );
}
