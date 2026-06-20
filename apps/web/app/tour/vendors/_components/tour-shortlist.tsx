'use client';

/**
 * TourShortlist — the public-tour vendor shortlist (Stop 2 · client-only).
 *
 * The parent RSC resolves the ranked shortlist (via fetchWizardVendorRecommendations)
 * and the per-vendor %-match score (via computeCompatScore) ONCE, server-side, and
 * hands it down as plain serializable props. This component is purely presentational
 * + locally interactive:
 *
 *   • Interactive #1 — a Setnayan-AI ON/OFF toggle (visual mirror of
 *     app/dashboard/[eventId]/vendors/_components/summary-ai-toggle.tsx). Flipping it
 *     only touches LOCAL React state: AI on → %-match pills show and the list is
 *     sorted best-match-first; AI off → pills are stripped and the list falls back to
 *     its generic (review/rating) order. NO server call; a reload resets it.
 *
 * The vendor cards are a thin presentational FORK of the cards in
 * app/dashboard/[eventId]/vendors/_components/plan-budget-accordion.tsx (the `.v`
 * card + its `.hmatch` / `.bdg` / `.whyline` markup + CSS), with all lock/build/
 * action machinery dropped — they are static, non-navigating display tiles here.
 */

import { useMemo, useState } from 'react';
import { Gem, MapPin, Sparkles, BadgeCheck } from 'lucide-react';
import { formatPhp } from '@/lib/vendors';

/** One display-safe vendor row. Money/rating are display fields; no PII, no
 *  contact, no ids beyond the opaque vendor key (unused on the client). */
export type TourVendor = {
  key: string;
  name: string;
  city: string | null;
  photoUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  pricePhp: number | null;
  isVerified: boolean;
  isSetnayan: boolean;
  /** Precomputed server-side; only shown when AI is ON. */
  matchScore: number | null;
  matchTier: 'strong' | 'good' | 'fair' | null;
  /** Plain-English "why this %" reasons (≤3); only shown when AI is ON. */
  matchWhy: string[];
  /** Generic (AI-off) sort key — preserves the matcher's review/rating order. */
  baseRank: number;
};

export type TourCategory = {
  id: string;
  label: string;
  blurb: string;
  vendors: TourVendor[];
};

const CSS = `
.tsl{--paper:var(--m-paper,#FBFBFA);--ink:var(--m-ink,#1E2229);--ink-soft:#4F535B;
  --gold:var(--m-orange,#C5A059);--gold-deep:var(--m-orange-2,#8C6932);
  --mulberry:var(--m-mulberry,#5C2542);--line:rgba(30,34,41,.12);--card:#fff;
  --serif:var(--font-display),"Cormorant Garamond",Georgia,serif;
  --sans:var(--font-sans),"Manrope",-apple-system,system-ui,sans-serif;
  --mono:var(--font-mono),"DM Mono",ui-monospace,Menlo,monospace;
  --ease:cubic-bezier(.22,.61,.36,1);color:var(--ink);font-family:var(--sans)}
.tsl *{box-sizing:border-box}
.tsl .rail{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding:0 4px 8px;scrollbar-width:none}
.tsl .rail::-webkit-scrollbar{display:none}
.tsl .card{position:relative;flex:0 0 min(280px, calc(100vw - 80px));scroll-snap-align:start;display:flex;flex-direction:column}
.tsl .v{position:relative;display:flex;flex-direction:column;flex:1 1 auto;min-height:300px;background:var(--card);border:1px solid var(--line);border-radius:18px;overflow:hidden;transition:box-shadow .35s var(--ease)}
.tsl .v:hover{box-shadow:0 10px 30px -18px rgba(0,0,0,.4)}
.tsl .v .img{height:158px;flex:0 0 158px;background:linear-gradient(135deg,#3a3f47,#565b63);display:flex;align-items:center;justify-content:center;position:relative}
.tsl .v .img img{width:100%;height:100%;object-fit:cover}
.tsl .v .img .ini{font-family:var(--serif);font-style:italic;font-size:30px;color:rgba(255,255,255,.7)}
.tsl .v .img .hero-scrim{position:absolute;inset:auto 0 0 0;height:56%;background:linear-gradient(to top,rgba(18,20,24,.6),transparent);z-index:1;pointer-events:none}
.tsl .v .img .hmatch{position:absolute;left:10px;bottom:10px;z-index:2;font-family:var(--mono);font-size:8px;letter-spacing:.06em;text-transform:uppercase;font-weight:700;padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.93);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
.tsl .v .img .hmatch.strong{color:#2e7d4f}
.tsl .v .img .hmatch.good{color:var(--gold-deep)}
.tsl .v .img .hmatch.fair{color:var(--ink-soft)}
.tsl .v .img .hprice{position:absolute;right:10px;bottom:10px;z-index:2;font-family:var(--serif);font-style:italic;font-weight:600;font-size:16px;color:#fff;padding:3px 11px;border-radius:8px;background:rgba(18,20,24,.62);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
.tsl .v .meta{padding:13px 15px 15px;flex:1 1 auto;display:flex;flex-direction:column}
.tsl .v .vn{font-family:var(--sans);font-weight:700;font-size:15px;color:var(--ink)}
.tsl .v .dist{display:flex;align-items:center;gap:4px;font-family:var(--mono);font-size:9.5px;letter-spacing:.06em;color:var(--ink-soft);margin-top:3px}
.tsl .v .whyline{font-family:var(--mono);font-size:9px;letter-spacing:.05em;color:var(--gold-deep);margin-top:3px;line-height:1.35}
.tsl .v .stars{color:var(--gold);font-size:15px;letter-spacing:2px;margin-top:9px}
.tsl .v .stars .rcount{font-family:var(--mono);font-size:8px;letter-spacing:.03em;color:var(--ink-soft);margin-left:6px;vertical-align:1px}
.tsl .v .badges{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.tsl .bdg{display:inline-flex;align-items:center;gap:3px;font-family:var(--mono);font-size:7.5px;letter-spacing:.07em;text-transform:uppercase;padding:3px 7px;border-radius:999px;background:rgba(30,34,41,.06);color:var(--ink-soft);white-space:nowrap}
.tsl .bdg.verified{color:#2e7d4f;background:rgba(46,125,79,.1)}
.tsl .bdg.setnayan{color:var(--mulberry);background:rgba(92,37,66,.1)}
.tsl .v .price{font-family:var(--serif);font-style:italic;font-weight:600;font-size:21px;color:var(--ink);margin-top:auto;padding-top:7px}
.tsl .v .ponq{font-family:var(--mono);font-size:9.5px;letter-spacing:.04em;color:var(--ink-soft);margin-top:auto;padding-top:7px}
html.dark .tsl{--paper:#1E2229;--ink:#FBFBFA;--ink-soft:#B6B9BE;--line:rgba(251,251,250,.16);--card:#2A2E36}
html.dark .tsl .v .bdg.setnayan{color:#C99DB0}
`;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function VendorCard({ v, aiOn }: { v: TourVendor; aiOn: boolean }) {
  const showMatch = aiOn && v.matchScore !== null && v.matchTier !== null;
  const why = aiOn ? v.matchWhy : [];
  const stars = v.rating !== null ? '★★★★★'.slice(0, Math.round(v.rating)) : null;
  const starsEmpty = v.rating !== null ? '★★★★★'.slice(Math.round(v.rating)) : '';
  const price = v.pricePhp !== null && v.pricePhp > 0 ? formatPhp(v.pricePhp) : null;

  return (
    <div className="card">
      <div className="v">
        <div className="img">
          {v.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.photoUrl} alt="" loading="lazy" />
          ) : (
            <span className="ini">{initials(v.name)}</span>
          )}
          {(showMatch || price) && <span className="hero-scrim" />}
          {showMatch ? (
            <span
              className={`hmatch ${v.matchTier}`}
              title="How well this candidate fits the wedding — based on distance, reviews, and verification."
            >
              {v.matchScore}% match
            </span>
          ) : null}
          {price ? <span className="hprice">{price}</span> : null}
        </div>
        <div className="meta">
          <div className="vn">{v.name}</div>
          {v.city ? (
            <div className="dist">
              <MapPin size={11} strokeWidth={1.75} aria-hidden /> {v.city}
            </div>
          ) : null}
          {showMatch && why.length > 0 ? (
            <div className="whyline">{why.join(' · ')}</div>
          ) : null}
          {stars ? (
            <div className="stars" aria-label={`${v.rating} stars`}>
              {stars}
              <span style={{ color: 'rgba(30,34,41,.18)' }}>{starsEmpty}</span>
              {v.reviewCount !== null ? <span className="rcount">{v.reviewCount}</span> : null}
            </div>
          ) : null}
          {v.isVerified || v.isSetnayan ? (
            <div className="badges">
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
            </div>
          ) : null}
          {!price ? <div className="ponq">Price on inquiry</div> : null}
        </div>
      </div>
    </div>
  );
}

function sortVendors(vendors: TourVendor[], aiOn: boolean): TourVendor[] {
  const copy = [...vendors];
  if (aiOn) {
    // Best-match first; ties fall back to the matcher's generic order.
    copy.sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1) || a.baseRank - b.baseRank);
  } else {
    // Generic search order — exactly the order the matcher returned them in.
    copy.sort((a, b) => a.baseRank - b.baseRank);
  }
  return copy;
}

export function TourShortlist({
  categories,
  vendorCount,
}: {
  categories: TourCategory[];
  vendorCount: number;
}) {
  // Interactive #1 — Setnayan AI ON/OFF. LOCAL state only; never persisted.
  const [aiOn, setAiOn] = useState(true);

  const sorted = useMemo(
    () => categories.map((c) => ({ ...c, vendors: sortVendors(c.vendors, aiOn) })),
    [categories, aiOn],
  );

  return (
    <div className="tsl">
      <style>{CSS}</style>

      {/* AI toggle — visual mirror of SummaryAiToggle, no server action */}
      <section className="flex items-center justify-between gap-3 rounded-xl border border-[#1E2229]/10 bg-[#FBF8F1] px-4 py-3">
        <span className="flex items-center gap-2 text-sm text-[#5F5E5A]">
          <Gem className="h-4 w-4 text-[#8C6932]" strokeWidth={1.75} aria-hidden />
          {aiOn
            ? `Setnayan AI ranked ${vendorCount} vendors by fit`
            : 'Setnayan AI is off — showing a plain search'}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={aiOn}
          aria-label="Toggle Setnayan AI"
          onClick={() => setAiOn((v) => !v)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            aiOn ? 'bg-[#8C6932]' : 'bg-[#1E2229]/20'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              aiOn ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`}
          />
        </button>
      </section>

      <div className="mt-6 space-y-9">
        {sorted.map((cat) => (
          <section key={cat.id}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-serif text-2xl text-[#1E2229]">{cat.label}</h2>
              <span className="font-mono text-[11px] uppercase tracking-wider text-[#9A8F86]">
                {cat.vendors.length} found
              </span>
            </div>
            <p className="mt-1 text-sm text-[#5F5E5A]">{cat.blurb}</p>
            {cat.vendors.length > 0 ? (
              <div className="rail mt-3">
                {cat.vendors.map((v) => (
                  <VendorCard key={v.key} v={v} aiOn={aiOn} />
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-[#1E2229]/15 bg-white/50 p-5 text-sm text-[#9A8F86]">
                No sample vendors seeded in this category yet.
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
