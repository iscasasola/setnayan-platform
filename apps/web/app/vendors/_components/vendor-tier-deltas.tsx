'use client';

/**
 * VendorTierDeltas — the tier ladder as a set of DELTAS: each plan says what it
 * ADDS to the one below, once.
 *
 * ─── WHY THIS EXISTS ─────────────────────────────────────────────────────
 * The delta pattern is not new here and this component invents nothing. It has
 * shipped in the data since 2026-07-01: every entry in `VENDOR_TIER_SECTIONS`
 * already carries a tagline in exactly this shape —
 *
 *     Solo:       "Everything in Free, plus a personalized page and…"
 *     Pro:        "…Everything in Solo, plus:"
 *     Enterprise: "…Everything in Pro, plus:"
 *
 * — and each tier's `groups[].items[]` are the benefits IT introduces, not a
 * restatement of everything below it. **The model was already right. The
 * presentation was not.**
 *
 * The only renderer that consumed this data was `vendor-tier-matrix.tsx`, and
 * its `buildFeatureGroups()` deliberately UN-DELTAS it: "applied CUMULATIVELY
 * (a benefit a tier adds is ✓ from that tier upward, — below it)". So ~90
 * benefits × 5 columns became ~450 cells, of which the informative ones are the
 * ~90 first-✓ positions and the other ~360 are restatement. That is the haystack
 * the taglines were written to kill, rebuilt from the very data that killed it.
 *
 * ─── WHAT HAPPENED TO THE MATRIX ─────────────────────────────────────────
 * It is still here, and that is deliberate. A matrix is what the owner asked for
 * on 2026-07-04 ("a matrix of the benefits between each tier"), and a vendor
 * comparing two specific plans genuinely wants a grid. So the page now LEADS
 * with the deltas — what you read — and the full matrix follows behind a
 * disclosure, for the person who wants to check one row across five columns.
 * Deleting it outright would be reversing an owner instruction on the strength
 * of a design brief, which is not an engineering call to make quietly.
 *
 * ─── ONE SOURCE, STILL ───────────────────────────────────────────────────
 * Feature rows come from `VENDOR_TIER_SECTIONS`, numeric ceilings from
 * `TIER_CAPS`, Custom's dials from `VENDOR_CUSTOM_TIER.dials`, and every
 * price from the live catalog via the `prices` prop (`getVendorPrices`). No
 * peso figure is typed in this file — see the docblock on VENDOR_CUSTOM_TIER
 * in `vendor-benefits.ts` for the two that used to be, and why they are not.
 */

import { useState } from 'react';
import Link from 'next/link';
import { VENDOR_TIER_SECTIONS, customTierDialLabels } from '@/app/_components/home/vendor-benefits';
import { TIER_CAPS, type VendorTier } from '@/lib/vendor-tier-caps';
/*
 * 🔑 THE TAPER IS DERIVED, NOT TYPED. The four other public surfaces that state
 * it each hand-type "₱100,000" and declare the literal in
 * `lib/public-price-literals.ts`. `bookingFeeScheduleSummary()` composes the
 * whole sentence from `BOOKING_FEE` — the same constant `bookingFeePhp()`
 * charges from — and is pinned against that function by its own test.
 *
 * ⚠ It had ZERO CALLERS until this one. It also states the ₱50 MINIMUM, which
 * the hand-typed copy omits; its docblock argues that omission is a defect,
 * because below ₱1,000 the floor dominates and the effective rate exceeds the
 * headline. So this line is both derived and more accurate than the sentence it
 * replaces.
 */
import { bookingFeeScheduleSummary } from '@/lib/booking-fee';
import type { VendorTierMatrixPrices } from './vendor-tier-matrix';

/** The ladder as a person climbs it. `verified` is the real free-vendor state. */
const LADDER: { cap: VendorTier; source: string; label: string }[] = [
  { cap: 'verified', source: 'free', label: 'Free · Verified' },
  { cap: 'solo', source: 'solo', label: 'Solo' },
  { cap: 'pro', source: 'pro', label: 'Pro' },
  { cap: 'enterprise', source: 'enterprise', label: 'Enterprise' },
];

/**
 * The numeric ceilings that genuinely MOVE at this tier — the limits half of a
 * delta. A row that reads the same as the tier below is not an upgrade and is
 * not shown; printing it back would be the matrix again, in a smaller box.
 */
const LIMITS: { label: string; of: (c: (typeof TIER_CAPS)[VendorTier]) => string }[] = [
  {
    label: 'Service reach',
    of: (c) =>
      c.serviceRadiusKm === 0
        ? '—'
        : c.serviceRadiusKm === Infinity
          ? 'Nationwide'
          : `${c.serviceRadiusKm} km`,
  },
  {
    label: 'Parent categories',
    of: (c) => (c.parentCategories === Infinity ? 'All' : `${c.parentCategories}`),
  },
  { label: 'Service listings / category', of: (c) => `${c.servicesPerLeaf}` },
  { label: 'Team seats', of: (c) => (c.agentAccounts === 0 ? '—' : `${c.agentAccounts}`) },
  { label: 'Bookable slots / day', of: (c) => (c.slotsPerDay === 0 ? '—' : `${c.slotsPerDay}`) },
  {
    label: 'Portfolio photos',
    of: (c) => (c.portfolioPhotos === Infinity ? 'Unlimited' : `${c.portfolioPhotos}`),
  },
  {
    label: 'Answer matched couples / week',
    of: (c) =>
      c.inAppCustomersPerWeek === Infinity
        ? 'Unlimited'
        : c.inAppCustomersPerWeek === 0
          ? '—'
          : `${c.inAppCustomersPerWeek}`,
  },
];

/** What changed between two rungs — `null` below means "this is the base rung". */
function movedLimits(cap: VendorTier, below: VendorTier | null) {
  const here = TIER_CAPS[cap];
  return LIMITS.map((l) => ({ label: l.label, now: l.of(here), was: below ? l.of(TIER_CAPS[below]) : null }))
    .filter((r) => (r.was === null ? r.now !== '—' : r.now !== r.was))
    .filter((r) => r.now !== '—');
}

function SoonPill() {
  return (
    <span
      className="m-mono"
      style={{
        fontSize: 9,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'var(--m-blush-deep)',
        border: '1px solid var(--m-blush)',
        borderRadius: 'var(--m-r-full)',
        padding: '2px 7px',
        marginLeft: 8,
        whiteSpace: 'nowrap',
      }}
    >
      soon
    </span>
  );
}

export function VendorTierDeltas({
  prices,
  matrix,
}: {
  prices: VendorTierMatrixPrices;
  /** The full grid, rendered inside this section's disclosure. */
  matrix: React.ReactNode;
}) {
  const [showMatrix, setShowMatrix] = useState(false);

  const priceOf: Record<string, { price: string; unit: string }> = {
    verified: { price: '₱0', unit: 'forever' },
    solo: { price: prices.soloMonthly, unit: '/ 28 days' },
    pro: { price: prices.proMonthly, unit: '/ 28 days' },
    enterprise: { price: prices.enterpriseMonthly, unit: '/ 28 days' },
  };

  return (
    <section
      style={{
        padding: 'clamp(56px, 9vw, 104px) clamp(20px, 5vw, 56px)',
        background: 'var(--m-paper-2)',
      }}
    >
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div className="m-eyebrow">What each plan adds</div>
        <h2
          className="m-serif"
          style={{
            fontSize: 'clamp(30px, 5vw, 52px)',
            lineHeight: 1.04,
            margin: '14px 0 12px',
            color: 'var(--m-ink)',
            fontWeight: 400,
          }}
        >
          Each plan says what it adds. Once.
        </h2>
        <p
          style={{
            fontSize: 15,
            color: 'var(--m-slate)',
            lineHeight: 1.55,
            maxWidth: 720,
            margin: 0,
          }}
        >
          Free · Verified is the whole ops spine — get found, get trusted, get
          booked, keep 100%. Every paid plan includes everything before it, so
          below you only read what is <strong style={{ color: 'var(--m-ink)' }}>new</strong> at
          that step.
        </p>

        <div style={{ display: 'grid', gap: 18, marginTop: 'clamp(24px, 4vw, 36px)' }}>
          {LADDER.map(({ cap, source, label }, i) => {
            const section = VENDOR_TIER_SECTIONS.find((s) => s.tier === source);
            if (!section) return null;
            const below = i === 0 ? null : LADDER[i - 1]!.cap;
            const moved = movedLimits(cap, below);
            const meta = priceOf[cap]!;
            const isBase = i === 0;

            return (
              <article
                key={cap}
                style={{
                  background: 'var(--m-paper)',
                  border: '1px solid var(--m-line)',
                  borderRadius: 'var(--m-r-lg)',
                  boxShadow: 'var(--m-shadow-sm)',
                  padding: 'clamp(20px, 3vw, 30px)',
                }}
              >
                <header
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'baseline',
                    gap: 12,
                    justifyContent: 'space-between',
                  }}
                >
                  <h3
                    className="m-serif"
                    style={{ fontSize: 24, fontWeight: 500, color: 'var(--m-ink)', margin: 0 }}
                  >
                    {label}
                  </h3>
                  <p style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 7 }}>
                    <span className="m-display" style={{ fontSize: 22, color: 'var(--m-ink)' }}>
                      {meta.price}
                    </span>
                    <span className="m-mono" style={{ fontSize: 10.5, color: 'var(--m-slate-2)' }}>
                      {meta.unit}
                    </span>
                  </p>
                </header>

                {/* The delta sentence — already written, in the data, since
                    2026-07-01. This component did not compose it. */}
                <p
                  style={{
                    fontSize: 14.5,
                    color: 'var(--m-slate)',
                    lineHeight: 1.55,
                    margin: '10px 0 0',
                    maxWidth: '70ch',
                  }}
                >
                  {section.tagline}
                </p>

                {moved.length > 0 ? (
                  <ul
                    style={{
                      listStyle: 'none',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                      padding: 0,
                      margin: '14px 0 0',
                    }}
                  >
                    {moved.map((m) => (
                      <li
                        key={m.label}
                        className="m-mono"
                        style={{
                          fontSize: 11,
                          color: 'var(--m-slate)',
                          background: 'var(--m-paper-2)',
                          border: '1px solid var(--m-line-soft)',
                          borderRadius: 'var(--m-r-full)',
                          padding: '4px 11px',
                        }}
                      >
                        {m.label}
                        {m.was ? (
                          <>
                            {' '}
                            <span style={{ color: 'var(--m-slate-3)' }}>{m.was} →</span>{' '}
                            <span style={{ color: 'var(--m-ink)' }}>{m.now}</span>
                          </>
                        ) : (
                          <>
                            {' '}
                            <span style={{ color: 'var(--m-ink)' }}>{m.now}</span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div style={{ display: 'grid', gap: 18, marginTop: 18 }}>
                  {section.groups.map((group, gi) => (
                    <div key={group.h ?? `g${gi}`}>
                      {/* Only Free carries sub-headers; the paid rungs are one
                          list of adds, which is what a delta is. */}
                      {group.h ? (
                        <p
                          className="m-mono"
                          style={{
                            fontSize: 10.5,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            color: 'var(--m-orange-2)',
                            margin: '0 0 8px',
                          }}
                        >
                          {group.h}
                        </p>
                      ) : null}
                      <ul
                        style={{
                          listStyle: 'none',
                          padding: 0,
                          margin: 0,
                          display: 'grid',
                          gap: 9,
                          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        }}
                      >
                        {group.items.map((item) => (
                          <li key={item.n} style={{ display: 'flex', gap: 9, fontSize: 13.5 }}>
                            <span
                              aria-hidden
                              style={{ color: 'var(--m-sage-deep)', fontWeight: 700, lineHeight: 1.5 }}
                            >
                              +
                            </span>
                            <span style={{ lineHeight: 1.5 }}>
                              <span style={{ color: 'var(--m-ink)', fontWeight: 500 }}>{item.n}</span>
                              {item.soon ? <SoonPill /> : null}
                              <span style={{ color: 'var(--m-slate-2)' }}> — {item.b}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                {isBase ? (
                  <p
                    className="m-mono"
                    style={{
                      fontSize: 10.5,
                      color: 'var(--m-slate-3)',
                      margin: '16px 0 0',
                      lineHeight: 1.5,
                    }}
                  >
                    Everything above is free, forever. 0% commission while we
                    launch — after that {bookingFeeScheduleSummary()}, only on
                    couples Setnayan brings you; your own clients stay free.
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>

        {/* Custom — the negotiated tier above Enterprise. Its "from" figure is
            resolved from the live catalog, never parsed out of a label. */}
        <article
          style={{
            background: 'var(--m-ink)',
            borderRadius: 'var(--m-r-lg)',
            marginTop: 18,
            padding: 'clamp(22px, 3vw, 32px)',
          }}
        >
          <header
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              gap: 12,
              justifyContent: 'space-between',
            }}
          >
            <h3 className="m-serif" style={{ fontSize: 24, fontWeight: 500, color: 'var(--m-paper)', margin: 0 }}>
              Custom
            </h3>
            <p style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 7 }}>
              <span className="m-display" style={{ fontSize: 22, color: 'var(--m-paper)' }}>
                {prices.customFrom ?? 'Negotiated'}
              </span>
              <span className="m-mono" style={{ fontSize: 10.5, color: 'var(--m-orange-3)' }}>
                {prices.customFrom ? 'from · / 28 days · negotiated' : '/ 28 days'}
              </span>
            </p>
          </header>
          <p
            style={{
              fontSize: 14.5,
              color: 'var(--m-orange-3)',
              lineHeight: 1.55,
              margin: '10px 0 0',
              maxWidth: '70ch',
            }}
          >
            Everything in Enterprise, automatically — then only the dials you
            need, with a dedicated account team. For franchises, chains and
            multi-location houses.
          </p>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '16px 0 0',
              display: 'grid',
              gap: 9,
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            }}
          >
            {customTierDialLabels(prices.branch).map((b) => (
              <li key={b} style={{ display: 'flex', gap: 9, fontSize: 13.5, color: '#e4dac7' }}>
                <span aria-hidden style={{ color: 'var(--m-orange)', fontWeight: 700 }}>
                  +
                </span>
                <span style={{ lineHeight: 1.5 }}>{b}</span>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 18 }}>
            <Link href="/help#contact" className="m-btn m-btn-orange">
              Talk to us →
            </Link>
          </div>
        </article>

        {/* The grid, for the person who wants to check one row across five
            columns. Collapsed, because reading it is not how anyone decides. */}
        <div style={{ marginTop: 28 }}>
          <button
            type="button"
            onClick={() => setShowMatrix((v) => !v)}
            aria-expanded={showMatrix}
            style={{
              fontFamily: 'inherit',
              fontSize: 13,
              padding: '10px 18px',
              borderRadius: 'var(--m-r-full)',
              cursor: 'pointer',
              border: '1px solid var(--m-line)',
              background: 'var(--m-paper)',
              color: 'var(--m-slate)',
            }}
          >
            {showMatrix ? 'Hide the side-by-side grid' : 'Compare every tier side by side →'}
          </button>
        </div>
        {showMatrix ? <div style={{ marginTop: 8 }}>{matrix}</div> : null}
      </div>
    </section>
  );
}
