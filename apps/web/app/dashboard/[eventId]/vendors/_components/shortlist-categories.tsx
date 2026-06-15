'use client';

/**
 * ShortlistCategories — the Explore takeover's "Shortlist" tab (owner 2026-06-16).
 *
 * Presents the COMPLETE taxonomy for the event (folders → all ~53 tiles), faith +
 * event-type scoped upstream by `buildShortlistFolders` (lib/shortlist-taxonomy.ts).
 * Layout per owner: a SINGLE-OPEN vertical accordion of categories (tiles) grouped
 * under folder headers — opening one category collapses the others "to keep them
 * focused" — and each open category shows its considered vendors as a CAROUSEL
 * (horizontal scroll-snap rail) plus a "Find" card into the marketplace tile.
 *
 * This is the BENCH: browse every category, see what's shortlisted, jump to find
 * more. Lock / Build / Compare live on their own takeover tabs, so this surface
 * is deliberately read-only about picks (tap a card → vendor detail) and carries
 * none of the plan-group lock/build machinery. Pill / rounded / frosted language
 * matches the app nav + sn-seg menus (owner "keep that style of the navs intact").
 */

import { useState } from 'react';
import Link from 'next/link';
import { Search, ChevronDown, Star, MapPin, BadgeCheck, Sparkles } from 'lucide-react';
import { formatPhp } from '@/lib/vendors';
import type { ShortlistFolder, ShortlistVendor } from '@/lib/shortlist-taxonomy';

const SLCAT_CSS = `
.slcat{--paper:var(--m-paper,#FBFBFA);--ink:var(--m-ink,#1E2229);--ink-soft:#4F535B;
  --gold:var(--m-orange,#C5A059);--gold-deep:var(--m-orange-2,#8C6932);
  --mulberry:var(--m-mulberry,#5C2542);--line:var(--m-line,rgba(30,34,41,.12));
  --line-soft:rgba(30,34,41,.07);--card:#fff;
  --serif:var(--font-display),"Cormorant Garamond",Georgia,serif;
  --sans:var(--font-sans),"Manrope",-apple-system,system-ui,sans-serif;
  --mono:var(--font-mono),"DM Mono",ui-monospace,Menlo,monospace;
  --ease:cubic-bezier(.22,.61,.36,1);
  color:var(--ink);font-family:var(--sans)}
.slcat *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.slcat .fold{margin:0 0 18px}
.slcat .fold-h{display:flex;align-items:baseline;gap:9px;padding:0 4px 8px}
.slcat .fold-nm{font-family:var(--serif);font-style:italic;font-size:21px;font-weight:600;color:var(--ink);line-height:1}
.slcat .fold-ct{font-family:var(--mono);font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft)}
/* category (tile) accordion row — rounded pill-card, single-open */
.slcat .cat{margin:0 0 8px;background:var(--card);border:0.5px solid var(--line);border-radius:16px;overflow:hidden;transition:box-shadow .3s var(--ease),border-color .3s var(--ease)}
.slcat .cat.open{box-shadow:0 8px 22px -14px rgba(30,34,41,.4);border-color:rgba(30,34,41,.16)}
.slcat .cat-head{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;background:transparent;border:0;cursor:pointer;padding:13px 16px;font:inherit;text-align:left;min-height:48px}
.slcat .cat-head .lh{display:flex;align-items:center;gap:9px;min-width:0}
.slcat .cat-nm{font-family:var(--serif);font-style:italic;font-size:16.5px;font-weight:600;color:var(--ink);letter-spacing:.01em;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.slcat .cat.open .cat-nm{color:var(--mulberry)}
.slcat .cat-rt{display:flex;align-items:center;gap:9px;flex:0 0 auto}
.slcat .cat-count{font-family:var(--mono);font-size:9.5px;letter-spacing:.05em;color:#fff;background:var(--mulberry);border-radius:999px;padding:3px 9px;font-weight:600;min-width:22px;text-align:center}
.slcat .cat-empty{font-family:var(--mono);font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:var(--gold-deep)}
.slcat .cat-chev{color:var(--ink-soft);transition:transform .25s var(--ease);flex:0 0 auto}
.slcat .cat.open .cat-chev{transform:rotate(180deg);color:var(--mulberry)}
.slcat .cat-body{padding:2px 0 12px;animation:slcat-rise .26s var(--ease) both}
@keyframes slcat-rise{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.slcat .cat-body{animation:none}}
/* carousel rail */
.slcat .rail{display:flex;gap:11px;overflow-x:auto;scroll-snap-type:x mandatory;padding:4px max(16px, calc(50% - 140px)) 4px 16px;scrollbar-width:none}
.slcat .rail::-webkit-scrollbar{display:none}
.slcat .vc{position:relative;flex:0 0 min(232px, calc(100vw - 108px));scroll-snap-align:start;display:flex;flex-direction:column;background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden;text-decoration:none;color:inherit;transition:transform .13s cubic-bezier(.2,.7,.2,1),box-shadow .3s var(--ease)}
.slcat .vc:active{transform:scale(.98)}
.slcat .vc:hover{box-shadow:0 10px 28px -18px rgba(0,0,0,.4)}
.slcat .vc .img{height:124px;flex:0 0 124px;background:linear-gradient(135deg,#3a3f47,#565b63);display:flex;align-items:center;justify-content:center;position:relative}
.slcat .vc .img img{width:100%;height:100%;object-fit:cover}
.slcat .vc .ini{font-family:var(--serif);font-style:italic;font-size:26px;color:rgba(255,255,255,.7)}
.slcat .vc .pcorner{position:absolute;top:8px;right:8px;font-family:var(--mono);font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#fff;background:var(--mulberry);border-radius:999px;padding:4px 8px}
.slcat .vc .meta{padding:11px 13px 13px;flex:1 1 auto;display:flex;flex-direction:column;gap:5px}
.slcat .vc .vn{font-family:var(--sans);font-weight:700;font-size:13.5px;color:var(--ink);line-height:1.2}
.slcat .vc .sub{display:flex;align-items:center;gap:5px;font-family:var(--mono);font-size:9px;letter-spacing:.03em;color:var(--ink-soft)}
.slcat .vc .stars{display:flex;align-items:center;gap:3px;font-family:var(--mono);font-size:9px;color:var(--gold-deep)}
.slcat .vc .badges{display:flex;flex-wrap:wrap;gap:4px;margin-top:1px}
.slcat .vc .bdg{display:inline-flex;align-items:center;gap:3px;font-family:var(--mono);font-size:7.5px;letter-spacing:.06em;text-transform:uppercase;padding:3px 6px;border-radius:999px;background:rgba(30,34,41,.06);color:var(--ink-soft)}
.slcat .vc .bdg.verified{color:#2e7d4f;background:rgba(46,125,79,.1)}
.slcat .vc .bdg.setnayan{color:var(--mulberry);background:rgba(92,37,66,.1)}
.slcat .vc .price{font-family:var(--serif);font-style:italic;font-weight:600;font-size:17px;color:var(--ink);margin-top:auto;padding-top:4px}
/* find card (always present — the marketplace jump for this tile) */
.slcat .find{flex:0 0 132px;scroll-snap-align:start;display:flex;text-decoration:none}
.slcat .find .inner{flex:1;min-height:200px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:8px;background:rgba(92,37,66,.05);border:1.5px dashed rgba(92,37,66,.4);border-radius:16px;color:var(--mulberry);transition:transform .13s cubic-bezier(.2,.7,.2,1),background .2s var(--ease)}
.slcat .find:active .inner{transform:scale(.97)}
.slcat .find .fi{font-size:20px;line-height:1}
.slcat .find .ft{font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;line-height:1.4;padding:0 8px}
/* empty body — single full-width find row */
.slcat .find-row{display:flex;align-items:center;gap:10px;margin:2px 16px 2px;padding:12px 14px;border:1.5px dashed rgba(92,37,66,.32);border-radius:13px;background:rgba(92,37,66,.03);text-decoration:none;color:inherit}
.slcat .find-row:active{transform:scale(.99)}
.slcat .find-row .fr-i{display:inline-flex;color:var(--mulberry)}
.slcat .find-row .fr-t{font-family:var(--sans);font-size:13px;font-weight:600;color:var(--mulberry)}
.slcat .find-row .fr-h{margin-left:auto;font-family:var(--mono);font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#b8b4ac}
.slcat a:focus-visible,.slcat button:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
html.dark .slcat{--paper:#1E2229;--ink:#FBFBFA;--ink-soft:#B6B9BE;--line:rgba(251,251,250,.16);--line-soft:rgba(251,251,250,.1);--card:#2A2E36}
html.dark .slcat .cat.open .cat-nm,html.dark .slcat .find .inner,html.dark .slcat .find-row .fr-t,html.dark .slcat .vc .bdg.setnayan{color:#C99DB0}
`;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function VendorCard({ v }: { v: ShortlistVendor }) {
  return (
    <Link href={v.href} className="vc" prefetch={false}>
      <span className="img">
        {v.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.photoUrl} alt="" loading="lazy" />
        ) : (
          <span className="ini">{initials(v.name)}</span>
        )}
        {v.status === 'locked' ? <span className="pcorner">★ Chosen</span> : null}
      </span>
      <span className="meta">
        <span className="vn">{v.name}</span>
        {v.city ? (
          <span className="sub">
            <MapPin size={11} strokeWidth={1.75} aria-hidden /> {v.city}
          </span>
        ) : null}
        {v.rating != null ? (
          <span className="stars">
            <Star size={11} strokeWidth={1.75} aria-hidden /> {v.rating.toFixed(1)}
            {v.reviewCount != null ? ` · ${v.reviewCount}` : ''}
          </span>
        ) : null}
        {v.isVerified || v.isSetnayan ? (
          <span className="badges">
            {v.isSetnayan ? (
              <span className="bdg setnayan">
                <Sparkles size={9} strokeWidth={2} aria-hidden /> Setnayan
              </span>
            ) : null}
            {v.isVerified ? (
              <span className="bdg verified">
                <BadgeCheck size={9} strokeWidth={2} aria-hidden /> Verified
              </span>
            ) : null}
          </span>
        ) : null}
        {v.totalCostPhp != null && v.totalCostPhp > 0 ? (
          <span className="price">{formatPhp(v.totalCostPhp)}</span>
        ) : null}
      </span>
    </Link>
  );
}

export function ShortlistCategories({ folders }: { folders: ShortlistFolder[] }) {
  // Single-open across ALL categories (owner: "when a category is picked, the
  // others collapse to keep them focused"). Key = tile id (unique app-wide).
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="slcat">
      <style>{SLCAT_CSS}</style>
      {folders.map((folder) => (
        <section key={folder.folder} className="fold">
          <div className="fold-h">
            <span className="fold-nm">{folder.label}</span>
            {folder.pickCount > 0 ? (
              <span className="fold-ct">
                {folder.pickCount} considering
              </span>
            ) : null}
          </div>
          {folder.tiles.map((t) => {
            const isOpen = open === t.tile;
            return (
              <div key={t.tile} className={`cat${isOpen ? ' open' : ''}`}>
                <button
                  type="button"
                  className="cat-head"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : t.tile)}
                >
                  <span className="lh">
                    <span className="cat-nm">{t.label}</span>
                  </span>
                  <span className="cat-rt">
                    {t.vendors.length > 0 ? (
                      <span className="cat-count">{t.vendors.length}</span>
                    ) : (
                      <span className="cat-empty">Browse</span>
                    )}
                    <ChevronDown className="cat-chev" size={18} strokeWidth={1.75} aria-hidden />
                  </span>
                </button>
                {isOpen ? (
                  <div className="cat-body">
                    {t.vendors.length > 0 ? (
                      <div className="rail">
                        {t.vendors.map((v) => (
                          <VendorCard key={v.vendorId} v={v} />
                        ))}
                        <Link href={t.exploreHref} className="find" prefetch={false}>
                          <span className="inner">
                            <Search className="fi" size={20} strokeWidth={1.75} aria-hidden />
                            <span className="ft">Find more {t.label}</span>
                          </span>
                        </Link>
                      </div>
                    ) : (
                      <Link href={t.exploreHref} className="find-row" prefetch={false}>
                        <span className="fr-i">
                          <Search size={16} strokeWidth={1.75} aria-hidden />
                        </span>
                        <span className="fr-t">Find {t.label}</span>
                        <span className="fr-h">Explore →</span>
                      </Link>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
