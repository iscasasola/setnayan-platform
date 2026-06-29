/**
 * VendorPricingMatrix · 3-tier vendor comparison matrix (Solo / Pro / Enterprise).
 *
 * 2027-02-18: replaced the old Free/Verified/Pro/Enterprise 4-tier layout with
 * the new Solo/Pro/Enterprise structure. Free and Verified remain as legacy DB
 * states but are no longer marketed.
 *
 * Desktop (≥1024px): 4-column grid (feature label + 3 tier columns).
 * Mobile (<1024px): tier switcher (3 pills, default Pro) + single column.
 */
'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

type CellValue = string | boolean;

interface MatrixSection {
  section: string;
  note: string;
  rows: [string, CellValue, CellValue, CellValue][];
}

/** The fields of getVendorPrices() this component reads. */
export interface VendorMatrixPrices {
  soloMonthly: string;
  soloAnnual: string;
  soloAnnualSave: string;
  proMonthly: string;
  proAnnual: string;
  proAnnualSave: string;
  enterpriseMonthly: string;
  enterpriseAnnual: string;
  enterpriseAnnualSave: string;
}

// Rows: [feature, Solo, Pro, Enterprise]
const MATRIX_SECTIONS: MatrixSection[] = [
  {
    section: 'The basics · every tier',
    note: 'Every paying tier gets the full in-app suite from day one.',
    rows: [
      ['Verified vendor profile + microsite', true, true, true],
      ['In-app chat (couple-initiated)', true, true, true],
      ['Pipeline · Bid → Chat → Quote → Accept', true, true, true],
      ['Create service packages', true, true, true],
      ['Photo portfolio', '50 photos', 'Unlimited', 'Unlimited'],
      ['Calendar with .ics export', true, true, true],
    ],
  },
  {
    section: '🪙 Bidding · the per-action engine',
    note: 'All paid tiers get unlimited couple unlocks. Inquiries burn region-banded tokens.',
    rows: [
      ['Bids per week', 'Unlimited', 'Unlimited', 'Unlimited'],
      ['Bidding token packs', true, true, true],
      ['In-app couple inquiries', 'Unlimited', 'Unlimited', 'Unlimited'],
    ],
  },
  {
    section: '📡 Reach & visibility',
    note: 'Boost radius scales by tier. Boosters let you unlock individual features for 7 days.',
    rows: [
      ['Boost radius', '20km', '50km', '100km'],
      ['Boosters · 7-day feature unlocks · 4–100 tokens each', true, true, true],
      ['Additional branch add-on', false, true, true],
      ['Sharable bid link for social media', false, false, true],
    ],
  },
  {
    section: '🌐 Your vendor surfaces',
    note: 'Every tier gets a custom microsite. Slug and Bid Button are Pro+.',
    rows: [
      ['Custom vendor website', true, true, true],
      ['Custom slug · setnayan.com/v/yourname', false, true, true],
      ['Bid Button on your website', false, true, true],
      ['Show star ratings on profile', true, true, true],
      ['Show full reviews on profile', false, true, true],
    ],
  },
  {
    section: '🗓 Schedule',
    note: 'Hybrid scheduling on all paid tiers. Multiple events per day unlocks on Pro+.',
    rows: [
      ['Scheduling mode', 'Hybrid', 'Hybrid', 'Hybrid'],
      ['Multiple events per day', false, true, true],
    ],
  },
  {
    section: '📈 Grow & scale · Pro+',
    note: 'Tools that expand your business — editorial tagging, AI proposals, category toolkits, analytics.',
    rows: [
      ["Editorial Tagging · auto-featured in couples' editorials", false, true, true],
      ['On Boarding Bundle Maker', false, true, true],
      ['File sharing with couples', false, true, true],
      ['Specialized Tools · per-category toolkit', false, true, true],
      ['AI Proposal Builder', false, true, true],
      ['Category benchmark analytics', false, true, true],
      ['Demand pulse · what couples are searching', false, true, true],
      ['Reverse-image portfolio theft monitoring', false, true, true],
      ['Crew-rate marketplace', false, true, true],
      ['Co-listing with Setnayan Productions', false, true, true],
    ],
  },
  {
    section: '🏢 Scope',
    note: 'Solo is one operator, one category. Pro adds 3 categories and 3 agent seats. Enterprise removes all limits.',
    rows: [
      ['Categories you can list under', '1', '3', 'Multiple'],
      ['Agent seats', '—', 'Up to 3', 'Unlimited'],
    ],
  },
  {
    section: '🤝 Ops + support',
    note: 'Every tier gets couple matchmaking. Pro+ adds priority support; Enterprise adds a quarterly review.',
    rows: [
      ['Couple matching', 'Standard', 'Priority', 'Priority'],
      ['Priority support · sub-4h response', false, true, true],
      ['Quarterly business review', false, false, true],
    ],
  },
];

function MatrixCell({ value, isPro }: { value: CellValue; isPro: boolean }): ReactNode {
  if (typeof value === 'boolean') {
    if (value) {
      return (
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: isPro ? 'var(--m-orange)' : 'var(--m-sage)',
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
          }}
        >
          ✓
        </span>
      );
    }
    return (
      <span className="m-mono" style={{ color: 'var(--m-slate-3)', fontSize: 12 }}>
        —
      </span>
    );
  }
  if (value === '—') {
    return (
      <span className="m-mono" style={{ color: 'var(--m-slate-3)', fontSize: 12 }}>
        —
      </span>
    );
  }
  return (
    <span
      className="m-mono"
      style={{
        fontSize: 11,
        fontWeight: isPro ? 500 : 400,
        color: isPro ? 'var(--m-paper)' : 'var(--m-ink)',
      }}
    >
      {value}
    </span>
  );
}

interface TierMeta {
  label: string;
  /** Hero price — annual is the headline (owner 2026-06-29 "show annual then offer the monthly"). */
  price: string;
  unit: string;
  note: string;
  /** Secondary line — the 28-day run-rate, shown under the annual hero. */
  secondary?: string;
  ink: boolean;
}

export function VendorPricingMatrix({ prices }: { prices: VendorMatrixPrices }) {
  // Default to Pro (index 1) — the tier the page is built to sell.
  const [tier, setTier] = useState(1);

  const tiers: TierMeta[] = [
    {
      label: 'Solo',
      price: prices.soloAnnual,
      unit: '/ yr',
      note: '1 category · solo operator',
      secondary: `or ${prices.soloMonthly} / 28 days · save ${prices.soloAnnualSave}/yr`,
      ink: false,
    },
    {
      label: '★ Pro',
      price: prices.proAnnual,
      unit: '/ yr',
      note: '3 categories · 3 agent seats',
      secondary: `or ${prices.proMonthly} / 28 days · save ${prices.proAnnualSave}/yr`,
      ink: true,
    },
    {
      label: '⬢ Enterprise',
      price: prices.enterpriseAnnual,
      unit: '/ yr',
      note: 'all categories · unlimited team',
      secondary: `or ${prices.enterpriseMonthly} / 28 days · save ${prices.enterpriseAnnualSave}/yr`,
      ink: false,
    },
  ];
  const active = tiers[tier];
  if (!active) return null;

  return (
    <>
      {/* ============================ DESKTOP ============================ */}
      <div className="m-card m-matrix-desktop" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Header row */}
        <div
          className="m-matrix-row"
          style={{
            display: 'grid',
            gridTemplateColumns: '1.7fr 1fr 1fr 1fr',
            background: 'var(--m-paper)',
          }}
        >
          <div style={{ padding: '22px 24px', borderBottom: '1px solid var(--m-line)' }}>
            <div className="m-label-mono">Capability</div>
          </div>
          {/* SOLO */}
          <div
            style={{
              padding: '22px 16px',
              borderBottom: '1px solid var(--m-line)',
              borderLeft: '1px solid var(--m-line-soft)',
            }}
          >
            <div className="m-label-mono">Solo</div>
            <div className="m-display" style={{ fontSize: 22, color: 'var(--m-ink)', marginTop: 4 }}>
              {prices.soloAnnual}{' '}
              <span style={{ fontSize: 12, color: 'var(--m-slate-2)' }}>/ yr</span>
            </div>
            <div className="m-mono" style={{ fontSize: 10, color: 'var(--m-slate-2)', marginTop: 4 }}>
              1 category · solo operator
            </div>
            <div className="m-mono" style={{ fontSize: 10, color: 'var(--m-slate-2)', marginTop: 6 }}>
              or {prices.soloMonthly} / 28d · save {prices.soloAnnualSave}/yr
            </div>
          </div>
          {/* PRO (highlighted) */}
          <div
            style={{
              padding: '22px 16px',
              borderBottom: '1px solid var(--m-line)',
              background: 'var(--m-ink)',
              color: 'var(--m-paper)',
            }}
          >
            <div className="m-label-mono" style={{ color: 'var(--m-orange-3)' }}>★ Pro</div>
            <div className="m-display" style={{ fontSize: 22, color: 'var(--m-paper)', marginTop: 4 }}>
              {prices.proAnnual}{' '}
              <span style={{ fontSize: 12, color: 'var(--m-slate-4)' }}>/ yr</span>
            </div>
            <div className="m-mono" style={{ fontSize: 10, color: 'var(--m-orange-3)', marginTop: 4 }}>
              save {prices.proAnnualSave}/yr vs 28-day
            </div>
            <div className="m-mono" style={{ fontSize: 10, color: 'var(--m-slate-4)', marginTop: 4 }}>
              3 categories · 3 agent seats
            </div>
            <div className="m-mono" style={{ fontSize: 10, color: 'var(--m-slate-4)', marginTop: 6 }}>
              or {prices.proMonthly} / 28d
            </div>
          </div>
          {/* ENTERPRISE */}
          <div
            style={{
              padding: '22px 16px',
              borderBottom: '1px solid var(--m-line)',
              borderLeft: '1px solid var(--m-line-soft)',
            }}
          >
            <div className="m-label-mono">⬢ Enterprise</div>
            <div className="m-display" style={{ fontSize: 22, color: 'var(--m-ink)', marginTop: 4 }}>
              {prices.enterpriseAnnual}{' '}
              <span style={{ fontSize: 12, color: 'var(--m-slate-2)' }}>/ yr</span>
            </div>
            <div className="m-mono" style={{ fontSize: 10, color: 'var(--m-orange-2)', marginTop: 4 }}>
              save {prices.enterpriseAnnualSave}/yr vs 28-day
            </div>
            <div className="m-mono" style={{ fontSize: 10, color: 'var(--m-slate-2)', marginTop: 4 }}>
              all categories · unlimited team
            </div>
            <div className="m-mono" style={{ fontSize: 10, color: 'var(--m-slate-2)', marginTop: 6 }}>
              or {prices.enterpriseMonthly} / 28d
            </div>
          </div>
        </div>

        {MATRIX_SECTIONS.map((sec) => (
          <div key={sec.section}>
            <div
              className="m-matrix-row"
              style={{
                display: 'grid',
                gridTemplateColumns: '1.7fr 1fr 1fr 1fr',
                background: 'var(--m-paper-2)',
              }}
            >
              <div style={{ padding: '18px 24px 6px', gridColumn: '1 / -1' }}>
                <div
                  className="m-display"
                  style={{
                    fontSize: 14,
                    color: 'var(--m-ink)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                  }}
                >
                  {sec.section}
                </div>
                <div style={{ fontSize: 12, color: 'var(--m-slate-2)', marginTop: 4, lineHeight: 1.45 }}>
                  {sec.note}
                </div>
              </div>
            </div>
            {sec.rows.map((row, ri) => {
              const [feature, ...vals] = row;
              return (
                <div
                  key={`${sec.section}-${ri}`}
                  className="m-matrix-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.7fr 1fr 1fr 1fr',
                    borderTop: '1px solid var(--m-line-soft)',
                  }}
                >
                  <div
                    style={{
                      padding: '14px 24px',
                      fontSize: 13,
                      color: 'var(--m-ink)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {feature}
                  </div>
                  {vals.map((v, ci) => {
                    const isPro = ci === 1; // Solo=0, Pro=1, Enterprise=2
                    return (
                      <div
                        key={ci}
                        style={{
                          padding: '14px 16px',
                          borderLeft:
                            '1px solid ' +
                            (isPro ? 'rgba(255,255,255,0.08)' : 'var(--m-line-soft)'),
                          background: isPro ? 'var(--m-ink)' : 'var(--m-paper)',
                          color: isPro ? 'var(--m-paper)' : 'var(--m-slate)',
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <MatrixCell value={v} isPro={isPro} />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ============================ MOBILE ============================= */}
      <div className="m-matrix-mobile">
        <div className="m-tier-switch">
          <div role="tablist" aria-label="Choose a vendor tier to compare" className="m-tier-pills">
            {tiers.map((t, i) => (
              <button
                key={t.label}
                type="button"
                role="tab"
                aria-selected={i === tier}
                onClick={() => setTier(i)}
                className={`m-tier-pill${i === tier ? ' is-active' : ''}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className={`m-tier-banner${active.ink ? ' is-ink' : ''}`}>
            <div className="m-tier-banner-price">
              <span className="m-display">{active.price}</span>{' '}
              <span className="m-tier-banner-unit">{active.unit}</span>
            </div>
            <div className="m-tier-banner-note">{active.note}</div>
            {active.secondary ? <div className="m-tier-banner-annual">{active.secondary}</div> : null}
          </div>
        </div>

        <div
          className="m-card m-matrix-mobile-list"
          role="tabpanel"
          aria-label={`${active.label} capabilities`}
        >
          {MATRIX_SECTIONS.map((sec) => (
            <div key={sec.section}>
              <div className="m-matrix-mobile-section">
                <div
                  className="m-display"
                  style={{
                    fontSize: 14,
                    color: 'var(--m-ink)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                  }}
                >
                  {sec.section}
                </div>
                <div style={{ fontSize: 12, color: 'var(--m-slate-2)', marginTop: 4, lineHeight: 1.45 }}>
                  {sec.note}
                </div>
              </div>
              {sec.rows.map((row, ri) => (
                <div key={`m-${sec.section}-${ri}`} className="m-matrix-mobile-row">
                  <div className="m-matrix-mobile-feature">{row[0]}</div>
                  <div className="m-matrix-mobile-value">
                    <MatrixCell value={row[tier + 1] ?? false} isPro={false} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .m-matrix-mobile { display: none; }

        @media (max-width: 1023px) {
          .m-matrix-desktop { display: none; }
          .m-matrix-mobile { display: block; }
        }

        .m-tier-switch {
          position: sticky;
          top: 64px;
          z-index: 5;
          background: var(--m-paper);
          border: 1px solid var(--m-line);
          border-radius: var(--m-r-md);
          padding: 10px;
          box-shadow: 0 6px 20px -12px rgba(30, 34, 41, 0.25);
        }
        @media (min-width: 640px) {
          .m-tier-switch { top: 72px; }
        }

        .m-tier-pills {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 4px;
        }
        .m-tier-pill {
          appearance: none;
          border: 1px solid var(--m-line);
          background: var(--m-paper);
          color: var(--m-slate);
          border-radius: var(--m-r-sm);
          padding: 9px 4px;
          font-size: 11px;
          font-weight: 500;
          line-height: 1.1;
          white-space: nowrap;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }
        .m-tier-pill.is-active {
          background: var(--m-ink);
          color: var(--m-paper);
          border-color: var(--m-ink);
        }

        .m-tier-banner {
          margin-top: 10px;
          padding: 12px 14px;
          border-radius: var(--m-r-sm);
          background: var(--m-paper-2);
        }
        .m-tier-banner.is-ink {
          background: var(--m-ink);
        }
        .m-tier-banner-price .m-display {
          font-size: 26px;
          color: var(--m-ink);
        }
        .m-tier-banner.is-ink .m-tier-banner-price .m-display {
          color: var(--m-paper);
        }
        .m-tier-banner-unit {
          font-size: 12px;
          color: var(--m-slate-2);
        }
        .m-tier-banner.is-ink .m-tier-banner-unit {
          color: var(--m-slate-4);
        }
        .m-tier-banner-note {
          font-size: 12px;
          color: var(--m-slate-2);
          margin-top: 2px;
        }
        .m-tier-banner.is-ink .m-tier-banner-note {
          color: var(--m-slate-4);
        }
        .m-tier-banner-annual {
          font-size: 11px;
          color: var(--m-orange-2);
          margin-top: 5px;
        }
        .m-tier-banner.is-ink .m-tier-banner-annual {
          color: var(--m-orange-3);
        }

        .m-matrix-mobile-list {
          margin-top: 12px;
          padding: 0;
          overflow: hidden;
        }
        .m-matrix-mobile-section {
          padding: 16px 16px 8px;
          background: var(--m-paper-2);
        }
        .m-matrix-mobile-row {
          display: grid;
          grid-template-columns: 1.7fr 1fr;
          gap: 12px;
          align-items: center;
          padding: 13px 16px;
          border-top: 1px solid var(--m-line-soft);
        }
        .m-matrix-mobile-feature {
          font-size: 13px;
          color: var(--m-ink);
          line-height: 1.35;
        }
        .m-matrix-mobile-value {
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
      `}</style>
    </>
  );
}
