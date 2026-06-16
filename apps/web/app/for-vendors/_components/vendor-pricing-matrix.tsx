/**
 * VendorPricingMatrix · the v2.1 4-tier vendor matrix, responsive.
 *
 * WHY: split out of ForVendorsDeepDive (2026-06-15) so the dense comparison
 * matrix can adapt to phones. The matrix is 8 sections × ~35 feature rows ×
 * 4 tiers — on desktop that reads as a wide grid, but the old mobile fallback
 * (`overflow-x: auto` + `min-width: 760px`) forced a 760px-wide sideways scroll
 * on a ~380px phone: Pro/Enterprise (the columns we sell) sat off-screen and
 * the price header scrolled away after a few rows.
 *
 * Owner-picked fix (2026-06-15): a tier SWITCHER on mobile. A sticky segmented
 * control (Free / Verified / Pro / Enterprise, default Pro) drives a single
 * 2-column layout — feature label + the selected tier's value. Zero horizontal
 * scroll; the tier + price stay pinned while you scan the full feature list.
 *
 * Desktop (≥1024px) renders the original 5-column grid VERBATIM — no visual
 * change. Which layout shows is pure CSS (`display`), so there is no
 * JS-breakpoint hydration mismatch; the only client state is the selected tier.
 *
 * Prices arrive pre-resolved from the server (getVendorPrices) as a prop so
 * this stays a thin client island over a server data fetch.
 */
'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

type CellValue = string | boolean;

interface MatrixSection {
  section: string;
  note: string;
  rows: [string, CellValue, CellValue, CellValue, CellValue][];
}

/** The fields of getVendorPrices() this component reads. */
export interface VendorMatrixPrices {
  proMonthly: string;
  proAnnual: string;
  proAnnualSave: string;
  enterpriseMonthly: string;
  enterpriseAnnual: string;
  enterpriseAnnualSave: string;
}

const MATRIX_SECTIONS: MatrixSection[] = [
  {
    section: 'The basics · every tier',
    note: 'Free already matches the best free vendor stack on the market.',
    rows: [
      ['Verified vendor profile + microsite', 'Free', 'Free', 'Free', 'Free'],
      ['In-app chat (couple-initiated)', 'Free', 'Free', 'Free', 'Free'],
      ['Pipeline · Bid → Chat → Quote → Accept', 'Free', 'Free', 'Free', 'Free'],
      ['Create service packages', 'Free', 'Free', 'Free', 'Free'],
      ['Photo portfolio', 'Up to 15', 'Unlimited', 'Unlimited', 'Unlimited'],
      ['Calendar with .ics export', 'Free', 'Free', 'Free', 'Free'],
    ],
  },
  {
    section: '🪙 Bidding · the per-action engine',
    note: 'Vendors spend tokens to accept couple inquiries; verified vendors get free couple unlocks every week.',
    rows: [
      ['Bids per week', 'Up to 10', 'Unlimited', 'Unlimited', 'Unlimited'],
      ['Bidding token packs', 'Buy packs', 'Buy packs', 'Buy packs', 'Buy packs'],
      ['Free couple unlocks per week', '—', 'Up to 10', 'Up to 10', 'Up to 10'],
    ],
  },
  {
    section: '📡 Reach & visibility',
    note: 'Boost radius scales by tier. Boost individual features for 7 days · 4–100 tokens each. Higher tiers also unlock paid ad placements and a shareable bid link for social.',
    rows: [
      ['Boost radius', '10km', '20km', '50km', '100km'],
      ['Boosters · 7-day feature unlocks · 4–100 tokens each', true, true, true, true],
      ['Sponsored Boost · top of category search', false, false, true, true],
      ['Boosted Ads add-on', false, false, true, true],
      ['Additional branch add-on', false, false, true, true],
      ['Sharable bid link for social media', false, false, false, true],
    ],
  },
  {
    section: '🌐 Your vendor surfaces',
    note: 'From a profile to a full custom microsite with a bid button. Higher tiers get more polish.',
    rows: [
      ['Public vendor website', '—', 'Website', 'Custom website', 'Custom website'],
      ['Custom slug · setnayan.com/v/yourname', false, false, true, true],
      ['Bid Button on your website', false, false, true, true],
      ['Show star ratings on profile', false, true, true, true],
      ['Show full reviews on profile', false, false, true, true],
    ],
  },
  {
    section: '🗓 Schedule',
    note: 'Manual on Free; Hybrid on Verified+ — pending bids show as white-marker holds, locked bids auto-block the date.',
    rows: [
      ['Scheduling mode', 'Manual', 'Hybrid', 'Hybrid', 'Hybrid'],
      ['Multiple events per day', false, false, true, true],
    ],
  },
  {
    section: '📈 Grow & scale · Pro+',
    note: "Tools that expand your business as it grows — never ones you need to run your craft. Editorial tagging that auto-builds your \"successful weddings\" collection, category toolkits, AI proposal drafts: automation, polish, and insight that put you in front of more couples and save you time as you scale.",
    rows: [
      [
        'Editorial Tagging · auto-featured in couples\' editorials',
        false,
        false,
        true,
        true,
      ],
      ['On Boarding Bundle Maker', false, false, true, true],
      ['File sharing with couples', false, false, true, true],
      ['Specialized Tools · per-category toolkit', false, false, true, true],
      ['AI Proposal Builder', false, false, true, true],
      ['Category benchmark analytics', false, false, true, true],
      ['Demand pulse · what couples are searching', false, false, true, true],
      ['Reverse-image portfolio theft monitoring', false, false, true, true],
      ['Crew-rate marketplace', false, false, true, true],
      ['Co-listing with Setnayan Productions', false, false, true, true],
    ],
  },
  {
    section: '🏢 Scope (Enterprise difference)',
    note: 'Pro is built for one team running one category. Enterprise opens it up — multiple categories, unlimited team accounts.',
    rows: [
      ['Categories you can list under', '1', '1', '1', 'Multiple'],
      ['Team accounts', '1', '1', 'Up to 5', 'Unlimited'],
    ],
  },
  {
    section: '🤝 Ops + support',
    note: 'Every vendor gets couple matchmaking. Pro+ adds priority support; Enterprise adds a quarterly review.',
    rows: [
      ['Couple matching', 'Free', 'Free', 'Priority', 'Priority'],
      ['Priority support · sub-4h response', false, false, true, true],
      ['Quarterly business review', false, false, false, true],
    ],
  },
];

function MatrixCell({
  value,
  isPro,
}: {
  value: CellValue;
  isPro: boolean;
}): ReactNode {
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
      <span
        className="m-mono"
        style={{
          color: 'var(--m-slate-3)',
          fontSize: 12,
        }}
      >
        —
      </span>
    );
  }
  if (value === '—') {
    return (
      <span
        className="m-mono"
        style={{ color: 'var(--m-slate-3)', fontSize: 12 }}
      >
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
  price: string;
  unit: string;
  note: string;
  annual?: string;
  /** Pro is the highlighted/dark column on desktop; mirror that on mobile. */
  ink: boolean;
}

export function VendorPricingMatrix({
  prices,
}: {
  prices: VendorMatrixPrices;
}) {
  // Default to Pro (index 2) — the tier the page is built to sell.
  const [tier, setTier] = useState(2);

  const tiers: TierMeta[] = [
    { label: 'Free', price: '₱0', unit: '/ 28d', note: 'no card needed', ink: false },
    {
      label: '✓ Verified',
      price: '₱0',
      unit: 'to start',
      note: 'verified badge · free to get',
      ink: false,
    },
    {
      label: '★ Pro',
      price: prices.proMonthly,
      unit: '/ 28d',
      note: '3 categories · 3 accounts',
      annual: `or ${prices.proAnnual}/yr · save ${prices.proAnnualSave}`,
      ink: true,
    },
    {
      label: '⬢ Enterprise',
      price: prices.enterpriseMonthly,
      unit: '/ 28d',
      note: 'all categories · unlimited team',
      annual: `or ${prices.enterpriseAnnual}/yr · save ${prices.enterpriseAnnualSave}`,
      ink: false,
    },
  ];
  const active = tiers[tier];
  // tier is always 0–3 and tiers has 4 entries, so this is unreachable —
  // it just narrows away the `| undefined` from noUncheckedIndexedAccess.
  if (!active) return null;

  return (
    <>
      {/* ============================ DESKTOP ============================ */}
      {/* Original 5-column grid · unchanged markup (≥1024px). */}
      <div
        className="m-card m-matrix-desktop"
        style={{ padding: 0, overflow: 'hidden' }}
      >
        {/* Header row · 4 tiers */}
        <div
          className="m-matrix-row"
          style={{
            display: 'grid',
            gridTemplateColumns: '1.7fr 1fr 1fr 1fr 1fr',
            background: 'var(--m-paper)',
          }}
        >
          <div
            style={{
              padding: '22px 24px',
              borderBottom: '1px solid var(--m-line)',
            }}
          >
            <div className="m-label-mono">Capability</div>
          </div>
          {/* FREE */}
          <div
            style={{
              padding: '22px 16px',
              borderBottom: '1px solid var(--m-line)',
              borderLeft: '1px solid var(--m-line-soft)',
            }}
          >
            <div className="m-label-mono">Free</div>
            <div
              className="m-display"
              style={{ fontSize: 22, color: 'var(--m-ink)', marginTop: 4 }}
            >
              ₱0{' '}
              <span style={{ fontSize: 12, color: 'var(--m-slate-2)' }}>/ 28d</span>
            </div>
            <div
              className="m-mono"
              style={{ fontSize: 10, color: 'var(--m-slate-2)', marginTop: 4 }}
            >
              no card needed
            </div>
          </div>
          {/* VERIFIED */}
          <div
            style={{
              padding: '22px 16px',
              borderBottom: '1px solid var(--m-line)',
              borderLeft: '1px solid var(--m-line-soft)',
            }}
          >
            <div className="m-label-mono">✓ Verified</div>
            <div
              className="m-display"
              style={{ fontSize: 22, color: 'var(--m-ink)', marginTop: 4 }}
            >
              ₱0{' '}
              <span style={{ fontSize: 12, color: 'var(--m-slate-2)' }}>to start</span>
            </div>
            <div
              className="m-mono"
              style={{ fontSize: 10, color: 'var(--m-slate-2)', marginTop: 4 }}
            >
              verified badge · free to get
            </div>
          </div>
          {/* PRO (highlighted) */}
          <div
            style={{
              padding: '22px 16px',
              borderBottom: '1px solid var(--m-line)',
              background: 'var(--m-ink)',
              color: 'var(--m-paper)',
              position: 'relative',
            }}
          >
            <div className="m-label-mono" style={{ color: 'var(--m-orange-3)' }}>
              ★ Pro
            </div>
            <div
              className="m-display"
              style={{ fontSize: 22, color: 'var(--m-paper)', marginTop: 4 }}
            >
              {prices.proMonthly}{' '}
              <span style={{ fontSize: 12, color: 'var(--m-slate-4)' }}>/ 28d</span>
            </div>
            <div
              className="m-mono"
              style={{ fontSize: 10, color: 'var(--m-slate-4)', marginTop: 4 }}
            >
              3 categories · 3 accounts
            </div>
            <div
              className="m-mono"
              style={{ fontSize: 10, color: 'var(--m-orange-3)', marginTop: 6 }}
            >
              or {prices.proAnnual}/yr · save {prices.proAnnualSave}
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
            <div
              className="m-display"
              style={{ fontSize: 22, color: 'var(--m-ink)', marginTop: 4 }}
            >
              {prices.enterpriseMonthly}{' '}
              <span style={{ fontSize: 12, color: 'var(--m-slate-2)' }}>/ 28d</span>
            </div>
            <div
              className="m-mono"
              style={{ fontSize: 10, color: 'var(--m-slate-2)', marginTop: 4 }}
            >
              all categories · unlimited team
            </div>
            <div
              className="m-mono"
              style={{ fontSize: 10, color: 'var(--m-orange-2)', marginTop: 6 }}
            >
              or {prices.enterpriseAnnual}/yr · save {prices.enterpriseAnnualSave}
            </div>
          </div>
        </div>

        {MATRIX_SECTIONS.map((sec) => (
          <div key={sec.section}>
            <div
              className="m-matrix-row"
              style={{
                display: 'grid',
                gridTemplateColumns: '1.7fr 1fr 1fr 1fr 1fr',
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
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--m-slate-2)',
                    marginTop: 4,
                    lineHeight: 1.45,
                  }}
                >
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
                    gridTemplateColumns: '1.7fr 1fr 1fr 1fr 1fr',
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
                    const isPro = ci === 2;
                    return (
                      <div
                        key={ci}
                        style={{
                          padding: '14px 16px',
                          borderLeft:
                            '1px solid ' +
                            (isPro
                              ? 'rgba(255,255,255,0.08)'
                              : 'var(--m-line-soft)'),
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
      {/* Tier switcher (<1024px): sticky segmented control + single column. */}
      <div className="m-matrix-mobile">
        <div className="m-tier-switch">
          <div
            role="tablist"
            aria-label="Choose a vendor tier to compare"
            className="m-tier-pills"
          >
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
            {active.annual ? (
              <div className="m-tier-banner-annual">{active.annual}</div>
            ) : null}
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
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--m-slate-2)',
                    marginTop: 4,
                    lineHeight: 1.45,
                  }}
                >
                  {sec.note}
                </div>
              </div>
              {sec.rows.map((row, ri) => (
                <div key={`m-${sec.section}-${ri}`} className="m-matrix-mobile-row">
                  <div className="m-matrix-mobile-feature">{row[0]}</div>
                  <div className="m-matrix-mobile-value">
                    {/* Light background on mobile → never the dark-column styling. */}
                    <MatrixCell value={row[tier + 1] ?? false} isPro={false} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        /* Desktop matrix shows by default; mobile switcher hidden. */
        .m-matrix-mobile { display: none; }

        @media (max-width: 1023px) {
          .m-matrix-desktop { display: none; }
          .m-matrix-mobile { display: block; }
        }

        /* Sticky tier control — pins just below the sticky site nav. */
        .m-tier-switch {
          position: sticky;
          top: 64px;
          z-index: 5;
          background: var(--m-paper);
          border: 1px solid var(--m-line);
          border-radius: 14px;
          padding: 10px;
          box-shadow: 0 6px 20px -12px rgba(30, 34, 41, 0.25);
        }
        @media (min-width: 640px) {
          .m-tier-switch { top: 72px; }
        }

        .m-tier-pills {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 4px;
        }
        .m-tier-pill {
          appearance: none;
          border: 1px solid var(--m-line);
          background: var(--m-paper);
          color: var(--m-slate);
          border-radius: 9px;
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
          border-radius: 10px;
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
