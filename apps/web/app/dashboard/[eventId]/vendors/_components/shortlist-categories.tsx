'use client';

/**
 * ShortlistCategories — the Explore takeover's "Shortlist" tab (owner 2026-06-16).
 *
 * Presents the COMPLETE taxonomy for the event (folders → all ~53 tiles), faith +
 * event-type scoped upstream by `buildShortlistFolders` (lib/shortlist-taxonomy.ts).
 *
 * NAVIGATION (owner 2026-06-16 "make it easier to understand and navigate"): a
 * TWO-LEVEL single-open accordion so the default view is ~10 calm folder rows, not
 * 53. Tap a folder → it reveals its categories; tap a category → its considered
 * vendors as a horizontal CAROUSEL plus "Find" + "Add manually". One folder open
 * at a time, one category open at a time ("when one opens, the others collapse").
 * Plain height/opacity expand — no sticky-header overlap (the bug in the legacy
 * accordion). No "NOT STARTED" noise: a folder shows "N considering" only once you
 * have picks there (else a quiet category count), a category shows a count badge
 * only when it has picks — calm by default, informative where it matters.
 *
 * This is the BENCH: browse every category, see what's shortlisted, find more.
 * Lock / Build / Compare live on their own tabs, so this surface is read-only about
 * picks (tap a card → detail) and carries none of the plan-group lock/build
 * machinery. Pill / rounded / frosted language matches the app nav + sn-seg menus.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, ChevronDown, Star, MapPin, BadgeCheck, Sparkles, Pencil } from 'lucide-react';
import { formatPhp } from '@/lib/vendors';
import { NewManualVendorModal } from '@/app/dashboard/[eventId]/_components/new-manual-vendor-modal';
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

/* ── Level 1 · folder card (collapsible) ── */
.slcat .fold{margin:0 0 8px;background:var(--card);border:0.5px solid var(--line);border-radius:16px;overflow:hidden;transition:box-shadow .3s var(--ease),border-color .3s var(--ease)}
.slcat .fold.open{box-shadow:0 8px 22px -16px rgba(30,34,41,.4);border-color:rgba(30,34,41,.16)}
.slcat .fold-head{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;background:transparent;border:0;cursor:pointer;padding:13px 16px;font:inherit;text-align:left;min-height:48px}
.slcat .fold-nm{font-family:var(--serif);font-style:italic;font-size:18px;font-weight:600;color:var(--ink);line-height:1;letter-spacing:.01em}
.slcat .fold.open .fold-nm{color:var(--mulberry)}
.slcat .fold-rt{display:flex;align-items:center;gap:11px;flex:0 0 auto}
.slcat .fold-meta{font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft)}
.slcat .fold-meta.has{color:var(--gold-deep)}
.slcat .fold-chev{color:var(--ink-soft);transition:transform .28s var(--ease);flex:0 0 auto}
.slcat .fold.open .fold-chev{transform:rotate(180deg);color:var(--mulberry)}

/* ── Level 2 · category rows inside an open folder (connecting rail) ── */
.slcat .fold-body{position:relative;padding:0 0 8px;animation:slcat-rise .26s var(--ease) both}
.slcat .fold-body::before{content:'';position:absolute;left:22px;top:0;bottom:14px;width:2px;background:rgba(92,37,66,.16);border-radius:2px;pointer-events:none}
@keyframes slcat-rise{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.slcat .fold-body{animation:none}}
.slcat .cat{margin:0 14px 0 34px;border-top:1px solid var(--line-soft)}
.slcat .fold-body .cat:first-child{border-top:0}
.slcat .cat-head{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;background:transparent;border:0;cursor:pointer;padding:10px 4px;font:inherit;text-align:left;min-height:42px}
.slcat .cat-nm{font-family:var(--sans);font-weight:600;font-size:14px;color:var(--ink);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.slcat .cat.open .cat-nm{color:var(--mulberry)}
.slcat .cat-rt{display:flex;align-items:center;gap:9px;flex:0 0 auto}
.slcat .cat-count{font-family:var(--mono);font-size:9.5px;letter-spacing:.04em;color:#fff;background:var(--mulberry);border-radius:999px;padding:3px 9px;font-weight:600;min-width:21px;text-align:center}
.slcat .cat-chev{color:var(--ink-soft);transition:transform .22s var(--ease);flex:0 0 auto}
.slcat .cat.open .cat-chev{transform:rotate(180deg);color:var(--mulberry)}
.slcat .cat-body{padding:2px 0 12px;animation:slcat-rise .22s var(--ease) both}

/* ── Level 3 · vendor carousel + find / add-manually ── */
.slcat .rail{display:flex;gap:11px;overflow-x:auto;scroll-snap-type:x mandatory;padding:4px 16px 4px 0;scrollbar-width:none}
.slcat .rail::-webkit-scrollbar{display:none}
.slcat .vc{position:relative;flex:0 0 min(206px, calc(100vw - 132px));scroll-snap-align:start;display:flex;flex-direction:column;background:var(--card);border:1px solid var(--line);border-radius:15px;overflow:hidden;text-decoration:none;color:inherit;transition:transform .13s cubic-bezier(.2,.7,.2,1),box-shadow .3s var(--ease)}
.slcat .vc:active{transform:scale(.98)}
.slcat .vc:hover{box-shadow:0 10px 28px -18px rgba(0,0,0,.4)}
.slcat .vc .img{height:108px;flex:0 0 108px;background:linear-gradient(135deg,#3a3f47,#565b63);display:flex;align-items:center;justify-content:center;position:relative}
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
/* dashed action cards (in the rail, after the vendors) */
.slcat .act{flex:0 0 116px;scroll-snap-align:start;display:flex}
.slcat .act>*{flex:1;min-height:182px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:8px;border-radius:15px;text-decoration:none;font:inherit;cursor:pointer;transition:transform .13s cubic-bezier(.2,.7,.2,1),background .2s var(--ease)}
.slcat .act>*:active{transform:scale(.97)}
.slcat .act.find>*{background:rgba(92,37,66,.05);border:1.5px dashed rgba(92,37,66,.4);color:var(--mulberry)}
.slcat .act.manual>*{background:rgba(30,34,41,.03);border:1.5px dashed var(--line);color:var(--ink-soft)}
.slcat .act .at{font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;line-height:1.4;padding:0 8px}
/* empty category — Find + Add-manually share a row */
.slcat .find-set{display:flex;flex-wrap:wrap;gap:8px;padding:2px 16px 2px 0}
.slcat .fr{display:flex;align-items:center;gap:9px;flex:1 1 150px;padding:12px 14px;border-radius:13px;text-decoration:none;color:inherit;font:inherit;cursor:pointer;text-align:left;appearance:none;-webkit-appearance:none;transition:transform .13s cubic-bezier(.2,.7,.2,1)}
.slcat .fr:active{transform:scale(.99)}
.slcat .fr.find{border:1.5px dashed rgba(92,37,66,.32);background:rgba(92,37,66,.03)}
.slcat .fr.manual{border:1.5px dashed var(--line);background:rgba(30,34,41,.025)}
.slcat .fr .fr-i{display:inline-flex;flex:0 0 auto}
.slcat .fr.find .fr-i,.slcat .fr.find .fr-t{color:var(--mulberry)}
.slcat .fr.manual .fr-i,.slcat .fr.manual .fr-t{color:var(--ink-soft)}
.slcat .fr .fr-t{font-family:var(--sans);font-size:13px;font-weight:600}
.slcat a:focus-visible,.slcat button:focus-visible{outline:2px solid var(--gold);outline-offset:2px}

html.dark .slcat{--paper:#1E2229;--ink:#FBFBFA;--ink-soft:#B6B9BE;--line:rgba(251,251,250,.16);--line-soft:rgba(251,251,250,.1);--card:#2A2E36}
html.dark .slcat .fold.open .fold-nm,html.dark .slcat .cat.open .cat-nm,html.dark .slcat .act.find>*,html.dark .slcat .fr.find .fr-i,html.dark .slcat .fr.find .fr-t,html.dark .slcat .vc .bdg.setnayan{color:#C99DB0}
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

export function ShortlistCategories({
  folders,
  eventId,
}: {
  folders: ShortlistFolder[];
  eventId: string;
}) {
  const router = useRouter();
  // Level 1: which folder is open. ALL COLLAPSED by default (owner 2026-06-16
  // "we want the parent categories to collapse so we can find the other services
  // faster") — the surface opens as a tight list of the ~10 parent categories, so
  // any one is a single tap away instead of starting mid-expansion.
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  // Level 2: which category (tile) is open. Single-open across the whole list.
  const [openTile, setOpenTile] = useState<string | null>(null);
  // The category whose "Add manually" modal is open (every category has Find + Add).
  const [manual, setManual] = useState<{ category: string; label: string } | null>(null);

  return (
    <div className="slcat">
      <style>{SLCAT_CSS}</style>
      {folders.map((folder) => {
        const folderOpen = openFolder === folder.folder;
        return (
          <section key={folder.folder} className={`fold${folderOpen ? ' open' : ''}`}>
            <button
              type="button"
              className="fold-head"
              aria-expanded={folderOpen}
              onClick={() => {
                setOpenFolder(folderOpen ? null : folder.folder);
                setOpenTile(null);
              }}
            >
              <span className="fold-nm">{folder.label}</span>
              <span className="fold-rt">
                <span className={`fold-meta${folder.pickCount > 0 ? ' has' : ''}`}>
                  {folder.pickCount > 0
                    ? `${folder.pickCount} considering`
                    : `${folder.tiles.length} categories`}
                </span>
                <ChevronDown className="fold-chev" size={17} strokeWidth={1.75} aria-hidden />
              </span>
            </button>
            {folderOpen ? (
              <div className="fold-body">
                {folder.tiles.map((t) => {
                  const tileOpen = openTile === t.tile;
                  return (
                    <div key={t.tile} className={`cat${tileOpen ? ' open' : ''}`}>
                      <button
                        type="button"
                        className="cat-head"
                        aria-expanded={tileOpen}
                        onClick={() => setOpenTile(tileOpen ? null : t.tile)}
                      >
                        <span className="cat-nm">{t.label}</span>
                        <span className="cat-rt">
                          {t.vendors.length > 0 ? (
                            <span className="cat-count">{t.vendors.length}</span>
                          ) : null}
                          <ChevronDown className="cat-chev" size={16} strokeWidth={1.75} aria-hidden />
                        </span>
                      </button>
                      {tileOpen ? (
                        <div className="cat-body">
                          {t.vendors.length > 0 ? (
                            <div className="rail">
                              {t.vendors.map((v) => (
                                <VendorCard key={v.vendorId} v={v} />
                              ))}
                              <span className="act find">
                                <Link href={t.exploreHref} prefetch={false}>
                                  <Search size={20} strokeWidth={1.75} aria-hidden />
                                  <span className="at">Find more</span>
                                </Link>
                              </span>
                              <span className="act manual">
                                <button
                                  type="button"
                                  onClick={() => setManual({ category: t.category, label: t.label })}
                                >
                                  <Pencil size={18} strokeWidth={1.75} aria-hidden />
                                  <span className="at">Add manually</span>
                                </button>
                              </span>
                            </div>
                          ) : (
                            <div className="find-set">
                              <Link href={t.exploreHref} className="fr find" prefetch={false}>
                                <span className="fr-i">
                                  <Search size={16} strokeWidth={1.75} aria-hidden />
                                </span>
                                <span className="fr-t">Find {t.label}</span>
                              </Link>
                              <button
                                type="button"
                                className="fr manual"
                                onClick={() => setManual({ category: t.category, label: t.label })}
                              >
                                <span className="fr-i">
                                  <Pencil size={16} strokeWidth={1.75} aria-hidden />
                                </span>
                                <span className="fr-t">Add manually</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}
      {manual ? (
        <NewManualVendorModal
          eventId={eventId}
          category={manual.category}
          categoryLabel={manual.label}
          onClose={() => setManual(null)}
          onCreated={() => {
            setManual(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
