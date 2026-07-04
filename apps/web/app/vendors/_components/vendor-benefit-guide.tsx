'use client';

/**
 * VendorBenefitGuide — the full, filterable ~90-benefit guide for /vendors
 * (owner 2026-07-04 free-forward redesign · mirrors the full_benefits.html
 * reference structure).
 *
 * Content is pulled ENTIRELY from the canonical VENDOR_TIER_SECTIONS in
 * app/_components/home/vendor-benefits.ts (the shipped benefit catalog, kept in
 * step with VENDOR_TIERS_AND_BENEFITS.md §2 allocation + §6 as-built). Nothing
 * is invented here — this component only FLATTENS + FILTERS that data:
 *   • Free tier keeps its sub-group headings ("Get found", "Run every booking"…)
 *   • Solo / Pro / Enterprise collapse to one group each
 *   • `soon` markers are preserved verbatim (roadmap items stay flagged)
 *
 * A filter bar (All / Free / Solo / Pro / Enterprise / Coming soon) narrows the
 * list client-side. Prices are NOT hardcoded here — the tier price tags render
 * from the DB-resolved labels passed in via `prices` (getVendorPrices), and the
 * Custom line comes from the shared VENDOR_CUSTOM_TIER constant.
 *
 * Styling uses the Clean Editorial `--m-*` system to match the rest of
 * /vendors. Display-only marketing surface — no checkout, no server calls.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  VENDOR_TIER_SECTIONS,
  VENDOR_CUSTOM_TIER,
  type VendorTier,
} from '@/app/_components/home/vendor-benefits';

export interface VendorBenefitGuidePrices {
  soloMonthly: string;
  proMonthly: string;
  enterpriseMonthly: string;
}

type FlatBenefit = {
  tier: VendorTier;
  category: string;
  name: string;
  body: string;
  soon: boolean;
};

// Flatten the tier-grouped catalog into one scannable list. Free keeps its
// section sub-headings as the category; the paid tiers become one category each.
function flatten(): FlatBenefit[] {
  const out: FlatBenefit[] = [];
  for (const section of VENDOR_TIER_SECTIONS) {
    for (const group of section.groups) {
      const category =
        section.tier === 'free'
          ? (group.h ?? 'Free · Verified')
          : `${section.name} adds`;
      for (const item of group.items) {
        out.push({
          tier: section.tier,
          category,
          name: item.n,
          body: item.b,
          soon: Boolean(item.soon),
        });
      }
    }
  }
  return out;
}

type FilterKey = 'all' | VendorTier | 'soon';

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All plans' },
  { key: 'free', label: 'Free' },
  { key: 'solo', label: 'Solo' },
  { key: 'pro', label: 'Pro' },
  { key: 'enterprise', label: 'Enterprise' },
  { key: 'soon', label: 'Coming soon' },
];

const TIER_TAG: Record<VendorTier, string> = {
  free: 'Free',
  solo: 'Solo',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

export function VendorBenefitGuide({ prices }: { prices: VendorBenefitGuidePrices }) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const all = useMemo(() => flatten(), []);

  const shown = useMemo(() => {
    if (filter === 'all') return all;
    if (filter === 'soon') return all.filter((b) => b.soon);
    return all.filter((b) => b.tier === filter);
  }, [all, filter]);

  // Preserve category order as it appears in the source, but only render the
  // categories that survive the active filter.
  const categories = useMemo(() => {
    const order: string[] = [];
    const byCat = new Map<string, FlatBenefit[]>();
    for (const b of shown) {
      if (!byCat.has(b.category)) {
        byCat.set(b.category, []);
        order.push(b.category);
      }
      byCat.get(b.category)!.push(b);
    }
    return order.map((c) => ({ title: c, items: byCat.get(c)! }));
  }, [shown]);

  const ladder: Array<{ name: string; price: string; unit?: string; desc: string; hi?: boolean }> = [
    { name: 'Free · Verified', price: '₱0', unit: '/ forever', desc: 'The whole business — found, trusted, booked & paid.' },
    { name: 'Solo', price: prices.soloMonthly, unit: '/ 28d', desc: 'Personalize your page + your own analytics.' },
    { name: 'Pro', price: prices.proMonthly, unit: '/ 28d', desc: 'Premium page, a team, wider reach & market intel.', hi: true },
    { name: 'Enterprise', price: prices.enterpriseMonthly, unit: '/ 28d', desc: 'Scale as an org with a flagship page.' },
    { name: 'Custom', price: 'from ₱8,999', desc: 'Franchises & chains, composed to fit.' },
  ];

  return (
    <section
      style={{
        padding: 'clamp(56px, 9vw, 104px) clamp(20px, 5vw, 56px)',
        background: 'var(--m-paper)',
      }}
    >
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div className="m-eyebrow">Setnayan for Vendors · Full benefit guide</div>
        <h2
          className="m-serif"
          style={{ fontSize: 'clamp(30px, 5vw, 52px)', lineHeight: 1.04, margin: '14px 0 12px', color: 'var(--m-ink)', fontWeight: 400 }}
        >
          Everything you get, in full.
        </h2>
        <p style={{ fontSize: 15, color: 'var(--m-slate)', lineHeight: 1.55, maxWidth: 720, margin: 0 }}>
          Every benefit of a Setnayan vendor account, plainly described. A free
          verified account is already a whole business — the paid tiers add more
          as you grow. Filter by the plan you&rsquo;re weighing.
        </p>

        {/* Tier ladder — price tags read the live catalog (never hardcoded). */}
        <div
          className="m-benefit-ladder"
          style={{ display: 'grid', gap: 12, margin: 'clamp(24px, 4vw, 40px) 0 20px', alignItems: 'stretch' }}
        >
          {ladder.map((t) => (
            <div
              key={t.name}
              className="m-card"
              style={{
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                background: t.hi ? 'var(--m-ink)' : 'var(--m-paper)',
                color: t.hi ? 'var(--m-paper)' : 'var(--m-ink)',
                border: t.hi ? '1px solid var(--m-orange-3)' : '1px solid var(--m-line)',
              }}
            >
              <span className="m-mono" style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.hi ? 'var(--m-orange-3)' : 'var(--m-orange-2)' }}>
                {t.name}
              </span>
              <span className="m-display" style={{ fontSize: 24, lineHeight: 1, color: t.hi ? 'var(--m-paper)' : 'var(--m-ink)' }}>
                {t.price}
                {t.unit ? (
                  <span className="m-mono" style={{ fontSize: 11, color: t.hi ? 'var(--m-slate-4)' : 'var(--m-slate-2)' }}> {t.unit}</span>
                ) : null}
              </span>
              <span style={{ fontSize: 12.5, color: t.hi ? 'var(--m-slate-4)' : 'var(--m-slate)', lineHeight: 1.4 }}>{t.desc}</span>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', margin: '8px 0 24px' }}>
          <span className="m-mono" style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--m-slate-2)', marginRight: 4 }}>
            Show
          </span>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={active}
                style={{
                  fontFamily: 'inherit',
                  fontSize: 13,
                  padding: '7px 14px',
                  borderRadius: 'var(--m-r-full)',
                  cursor: 'pointer',
                  border: `1px solid ${active ? 'var(--m-ink)' : 'var(--m-line)'}`,
                  background: active ? 'var(--m-ink)' : 'transparent',
                  color: active ? 'var(--m-paper)' : 'var(--m-slate)',
                  transition: 'background .12s, color .12s, border-color .12s',
                }}
              >
                {f.label}
              </button>
            );
          })}
          <span className="m-mono" style={{ fontSize: 11, color: 'var(--m-slate-3)', marginLeft: 4 }}>
            {shown.length} benefit{shown.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Benefit catalog */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(28px, 4vw, 44px)' }}>
          {categories.map((cat) => (
            <div key={cat.title}>
              <h3
                className="m-serif"
                style={{ fontSize: 'clamp(20px, 3vw, 26px)', lineHeight: 1.1, margin: '0 0 14px', color: 'var(--m-ink)', fontWeight: 400 }}
              >
                {cat.title}
              </h3>
              <div className="m-benefit-grid" style={{ display: 'grid', gap: 12 }}>
                {cat.items.map((b) => (
                  <div
                    key={`${b.tier}-${b.name}`}
                    className="m-card"
                    style={{ padding: 16, border: '1px solid var(--m-line)', display: 'flex', flexDirection: 'column', gap: 6 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--m-ink)', lineHeight: 1.3 }}>{b.name}</span>
                      <span style={{ display: 'inline-flex', gap: 6, flex: '0 0 auto', alignItems: 'center' }}>
                        {b.soon ? (
                          <span
                            className="m-mono"
                            style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--m-blush-deep)', border: '1px solid var(--m-blush)', borderRadius: 'var(--m-r-full)', padding: '2px 7px' }}
                          >
                            Soon
                          </span>
                        ) : null}
                        {filter === 'all' || filter === 'soon' ? (
                          <span
                            className="m-mono"
                            style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--m-orange-2)', background: 'var(--m-orange-4)', borderRadius: 'var(--m-r-full)', padding: '2px 7px' }}
                          >
                            {TIER_TAG[b.tier]}
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <span style={{ fontSize: 12.5, color: 'var(--m-slate)', lineHeight: 1.5 }}>{b.body}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Custom band — pulled from the shared VENDOR_CUSTOM_TIER constant. */}
        <div
          className="m-card m-benefit-custom"
          style={{
            marginTop: 'clamp(32px, 5vw, 52px)',
            padding: 'clamp(22px, 4vw, 36px)',
            background: 'var(--m-paper-2)',
            border: '1px solid var(--m-line)',
            display: 'grid',
            gap: 20,
          }}
        >
          <div>
            <div className="m-mono" style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--m-orange-2)' }}>
              Beyond the ladder
            </div>
            <h3 className="m-serif" style={{ fontSize: 'clamp(22px, 3.5vw, 32px)', lineHeight: 1.08, margin: '10px 0 8px', color: 'var(--m-ink)', fontWeight: 400 }}>
              {VENDOR_CUSTOM_TIER.name}
            </h3>
            <p style={{ fontSize: 14, color: 'var(--m-slate)', lineHeight: 1.55, margin: 0, maxWidth: 640 }}>
              {VENDOR_CUSTOM_TIER.tagline}
            </p>
            <Link href="/vendors#custom" className="m-btn m-btn-ghost" style={{ marginTop: 16 }}>
              See the tier cards →
            </Link>
          </div>
        </div>

        {/* Trust strip */}
        <div
          style={{
            marginTop: 'clamp(24px, 4vw, 36px)',
            padding: '18px 22px',
            borderRadius: 'var(--m-r-md)',
            background: 'var(--m-ink)',
            color: 'var(--m-paper)',
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          <b style={{ color: 'var(--m-orange-3)' }}>0% commission, always</b> · we
          never hold your money · couples pay you directly · merit-only ranking
          you can&rsquo;t buy your way up.
        </div>

        <p className="m-mono" style={{ fontSize: 10.5, color: 'var(--m-slate-3)', marginTop: 14, lineHeight: 1.5, maxWidth: 720 }}>
          Vendor benefit guide · &ldquo;Soon&rdquo; = in active build. Prices read
          the live catalog and are billed per 28-day cycle. Faithful to the
          shipped catalog.
        </p>
      </div>

      <style>{`
        .m-benefit-ladder { grid-template-columns: 1fr; }
        @media (min-width: 560px) { .m-benefit-ladder { grid-template-columns: 1fr 1fr; } }
        @media (min-width: 900px) { .m-benefit-ladder { grid-template-columns: repeat(5, 1fr); } }
        .m-benefit-grid { grid-template-columns: 1fr; }
        @media (min-width: 640px) { .m-benefit-grid { grid-template-columns: 1fr 1fr; } }
        @media (min-width: 1024px) { .m-benefit-grid { grid-template-columns: repeat(3, 1fr); } }
      `}</style>
    </section>
  );
}
