'use client';

/**
 * VendorTierMatrix — the tier-comparison MATRIX for /vendors (owner
 * 2026-07-04: "a matrix of the benefits between each tier").
 *
 * Benefits as ROWS × tiers as COLUMNS (Free · Verified / Solo / Pro /
 * Enterprise) with ✓ / — / value cells + `soon` markers, grouped under the same
 * section headers used by the filterable guide. Behavior (not styling) follows
 * sny_popup_final.html: a selectable tier highlights its column, and on narrow
 * screens the table scrolls horizontally inside its own overflow-x container so
 * the page body never scrolls sideways.
 *
 * Sourced from the SAME canonical data:
 *   • feature rows (✓/—/soon) from VENDOR_TIER_SECTIONS (vendor-benefits.ts) —
 *     applied CUMULATIVELY (a benefit a tier adds is ✓ from that tier upward,
 *     — below it); `soon` items render "soon" wherever they're available.
 *   • numeric "Plans & limits" rows from TIER_CAPS (vendor-tier-caps.ts).
 *
 * Prices are NOT hardcoded here — the column price tags come from the
 * DB-resolved labels passed in via `prices` (getVendorPrices). Display-only
 * marketing surface — no checkout, no server calls. Clean Editorial `--m-*`.
 */

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { VENDOR_TIER_SECTIONS, VENDOR_CUSTOM_TIER } from '@/app/_components/home/vendor-benefits';
import { TIER_CAPS } from '@/lib/vendor-tier-caps';

// Custom's "from ₱X" floor is not a DB catalog SKU (Custom is composed per
// plan) — it lives on the shared VENDOR_CUSTOM_TIER constant used across the
// /vendors surfaces. Parse the "₱8,999" out of its name so the matrix header
// and the benefit guide stay on ONE source; never a fresh hardcoded literal.
const CUSTOM_FROM_PRICE =
  VENDOR_CUSTOM_TIER.name.match(/₱[\d,]+/)?.[0] ?? '₱8,999';

// The five marketed columns. `verified` is the real free-vendor state
// ("Free · Verified"); the legacy pre-verification `free` state is not a column.
// `custom` is the negotiated tier ABOVE Enterprise — it "runs as Enterprise
// automatically" (TIER_CAPS.custom is the Enterprise clone), so every feature
// row it carries the Enterprise value, and it uniquely owns the Custom-only
// rows (extra branches, nationwide reach, dedicated account manager, domain).
type Col = 'verified' | 'solo' | 'pro' | 'enterprise' | 'custom';
const COLS: Col[] = ['verified', 'solo', 'pro', 'enterprise', 'custom'];
const COL_RANK: Record<Col, number> = {
  verified: 0,
  solo: 1,
  pro: 2,
  enterprise: 3,
  custom: 4,
};

// Map a benefit's source tier (in vendor-benefits.ts, where the FREE tier owns
// the whole shared spine) to the column it FIRST appears in. There is no
// `custom` source tier — Custom carries every benefit at its Enterprise value
// (it never introduces a benefit of its own in the shared spine), so any
// benefit available at Enterprise is available at Custom too.
const SOURCE_TO_COL: Record<string, Col> = {
  free: 'verified',
  solo: 'solo',
  pro: 'pro',
  enterprise: 'enterprise',
};

export interface VendorTierMatrixPrices {
  soloMonthly: string;
  proMonthly: string;
  enterpriseMonthly: string;
}

type Cell = { kind: 'yes' | 'no' | 'soon' | 'value'; value?: string };
type Row = { label: string; cells: Record<Col, Cell> };
type Group = { title: string; rows: Row[] };

const YES: Cell = { kind: 'yes' };
const NO: Cell = { kind: 'no' };
const SOON: Cell = { kind: 'soon' };
const val = (v: string): Cell => ({ kind: 'value', value: v });

/** Cumulative feature rows built from the canonical benefit sections. A benefit
 *  is ✓ from its source column upward, — below it. `soon` items render "soon"
 *  in the columns at/above their source, — below. */
function buildFeatureGroups(): Group[] {
  const bySection = new Map<string, Row[]>();
  const order: string[] = [];

  for (const section of VENDOR_TIER_SECTIONS) {
    const startCol = SOURCE_TO_COL[section.tier];
    if (!startCol) continue;
    const startRank = COL_RANK[startCol];
    for (const group of section.groups) {
      // Free tier carries its own sub-headers; the paid tiers collapse to one
      // "<Tier> adds" section so their added benefits stay grouped.
      const title =
        section.tier === 'free' ? (group.h ?? 'Free · Verified') : `${section.name} adds`;
      if (!bySection.has(title)) {
        bySection.set(title, []);
        order.push(title);
      }
      for (const item of group.items) {
        const cells = {} as Record<Col, Cell>;
        for (const c of COLS) {
          if (COL_RANK[c] < startRank) cells[c] = NO;
          else cells[c] = item.soon ? SOON : YES;
        }
        bySection.get(title)!.push({ label: item.n, cells });
      }
    }
  }
  return order.map((title) => ({ title, rows: bySection.get(title)! }));
}

/** Numeric "Plans & limits" rows straight from TIER_CAPS. Infinity → "All" /
 *  "Unlimited"; 0 → —. */
function buildLimitsGroup(): Group {
  const cap = (col: Col) => TIER_CAPS[col];
  const km = (n: number) => (n === Infinity ? 'Nationwide' : n === 0 ? NO.kind : `${n} km`);
  const num = (n: number, unit = '') =>
    n === Infinity ? 'Unlimited' : n === 0 ? '—' : `${n}${unit}`;

  // Custom's numeric ceilings are negotiated per composed plan (not the static
  // Enterprise-clone values in TIER_CAPS.custom), so on the scalable axes the
  // Custom cell reads "Custom" rather than a concrete number. Reach is the one
  // axis with a firm marketed ceiling (Nationwide), so it keeps its value.
  const CUSTOM = val('Custom');
  const row = (
    label: string,
    pick: (c: ReturnType<typeof cap>, col: Col) => Cell,
  ): Row => ({
    label,
    cells: COLS.reduce(
      (acc, c) => {
        acc[c] = pick(cap(c), c);
        return acc;
      },
      {} as Record<Col, Cell>,
    ),
  });

  return {
    title: 'Plans & limits',
    rows: [
      row('Service reach', (c) =>
        c.serviceRadiusKm === 0 ? NO : val(km(c.serviceRadiusKm)),
      ),
      row('Parent categories', (c) =>
        c.parentCategories === Infinity ? val('All') : val(num(c.parentCategories)),
      ),
      row('Service listings / category', (c) => val(num(c.servicesPerLeaf))),
      row('Team seats', (c, col) =>
        col === 'custom' ? CUSTOM : c.agentAccounts === 0 ? NO : val(num(c.agentAccounts)),
      ),
      row('Bookable slots / day', (c, col) =>
        col === 'custom' ? CUSTOM : c.slotsPerDay === 0 ? NO : val(num(c.slotsPerDay)),
      ),
      row('Portfolio photos', (c, col) =>
        col === 'custom' ? CUSTOM : val(num(c.portfolioPhotos)),
      ),
      row('Answer matched couples / week', (c) =>
        c.inAppCustomersPerWeek === Infinity
          ? val('Unlimited')
          : c.inAppCustomersPerWeek === 0
            ? NO
            : val(`${c.inAppCustomersPerWeek}`),
      ),
      row('Full written reviews shown', (c) => (c.reviewCommentsViewable ? YES : NO)),
      row('Custom URL / slug', (c) => (c.customWebsiteName ? YES : NO)),
    ],
  };
}

/** Custom-only rows — benefits that exist ONLY at the negotiated Custom tier
 *  (— on every other column). These have no source in VENDOR_TIER_SECTIONS
 *  (that catalog stops at Enterprise), so they're defined here as the Custom
 *  column's exclusive adds, mirroring the prototype's "Scale as an organization"
 *  Custom-only lines. */
function buildCustomOnlyGroup(): Group {
  const onlyCustom = (): Record<Col, Cell> =>
    COLS.reduce(
      (acc, c) => {
        acc[c] = c === 'custom' ? YES : NO;
        return acc;
      },
      {} as Record<Col, Cell>,
    );
  return {
    title: 'Custom adds',
    rows: [
      { label: 'Additional branches', cells: onlyCustom() },
      { label: 'Nationwide reach', cells: onlyCustom() },
      { label: 'Dedicated account manager · white-glove', cells: onlyCustom() },
      { label: 'Custom domain', cells: onlyCustom() },
    ],
  };
}

function CellView({ cell, selected }: { cell: Cell; selected: boolean }) {
  const base: React.CSSProperties = {
    textAlign: 'center',
    padding: '10px 12px',
    fontSize: 13,
    borderLeft: '1px solid var(--m-line-soft)',
    background: selected ? 'var(--m-orange-4)' : 'transparent',
    whiteSpace: 'nowrap',
  };
  if (cell.kind === 'yes')
    return (
      <td style={base}>
        <span aria-label="Included" style={{ color: 'var(--m-sage-deep)', fontWeight: 700 }}>
          ✓
        </span>
      </td>
    );
  if (cell.kind === 'no')
    return (
      <td style={base}>
        <span aria-label="Not included" style={{ color: 'var(--m-slate-4)' }}>
          —
        </span>
      </td>
    );
  if (cell.kind === 'soon')
    return (
      <td style={base}>
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
          }}
        >
          soon
        </span>
      </td>
    );
  return (
    <td style={{ ...base, color: 'var(--m-ink)', fontWeight: 500 }}>{cell.value}</td>
  );
}

export function VendorTierMatrix({ prices }: { prices: VendorTierMatrixPrices }) {
  const [selected, setSelected] = useState<Col>('pro');
  const groups = useMemo(
    () => [buildLimitsGroup(), ...buildFeatureGroups(), buildCustomOnlyGroup()],
    [],
  );

  const COL_META: Record<Col, { name: string; price: string; unit?: string }> = {
    verified: { name: 'Free · Verified', price: '₱0', unit: 'forever' },
    solo: { name: 'Solo', price: prices.soloMonthly, unit: '/ 28d' },
    pro: { name: 'Pro', price: prices.proMonthly, unit: '/ 28d' },
    enterprise: { name: 'Enterprise', price: prices.enterpriseMonthly, unit: '/ 28d' },
    custom: { name: 'Custom', price: CUSTOM_FROM_PRICE, unit: 'from · negotiated' },
  };

  return (
    <section
      style={{
        padding: 'clamp(56px, 9vw, 104px) clamp(20px, 5vw, 56px)',
        background: 'var(--m-paper-2)',
      }}
    >
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div className="m-eyebrow">Compare every tier</div>
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
          The whole ladder, side by side.
        </h2>
        <p style={{ fontSize: 15, color: 'var(--m-slate)', lineHeight: 1.55, maxWidth: 720, margin: 0 }}>
          Every benefit as a row, every plan as a column. Free · Verified is the
          whole ops spine; each paid tier adds more and includes everything
          before it — and <strong style={{ color: 'var(--m-ink)' }}>Custom</strong>{' '}
          is built for franchises and chains that need more than Enterprise. Tap a
          plan to highlight its column.
        </p>

        {/* Tier selector — highlights a column (esp. on narrow screens). */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: 'clamp(20px, 3vw, 28px) 0 16px' }}>
          {COLS.map((c) => {
            const active = selected === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setSelected(c)}
                aria-pressed={active}
                style={{
                  fontFamily: 'inherit',
                  fontSize: 13,
                  padding: '8px 15px',
                  borderRadius: 'var(--m-r-full)',
                  cursor: 'pointer',
                  border: `1px solid ${active ? 'var(--m-ink)' : 'var(--m-line)'}`,
                  background: active ? 'var(--m-ink)' : 'var(--m-paper)',
                  color: active ? 'var(--m-paper)' : 'var(--m-slate)',
                  transition: 'background .12s, color .12s, border-color .12s',
                }}
              >
                {COL_META[c].name}
              </button>
            );
          })}
        </div>

        {/* The matrix — scrolls horizontally inside its own container on
            mobile so the page body never scrolls sideways. */}
        <div
          role="region"
          aria-label="Vendor tier comparison"
          tabIndex={0}
          style={{
            overflowX: 'auto',
            borderRadius: 'var(--m-r-md)',
            border: '1px solid var(--m-line)',
            background: 'var(--m-paper)',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <table
            style={{
              borderCollapse: 'collapse',
              width: '100%',
              minWidth: 900,
              tableLayout: 'fixed',
            }}
          >
            <colgroup>
              <col style={{ width: '34%' }} />
              {COLS.map((c) => (
                <col key={c} style={{ width: `${66 / COLS.length}%` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th
                  scope="col"
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 2,
                    background: 'var(--m-paper)',
                    textAlign: 'left',
                    padding: '14px 16px',
                    borderBottom: '1px solid var(--m-line)',
                  }}
                />
                {COLS.map((c) => {
                  const active = selected === c;
                  const isCustom = c === 'custom';
                  const m = COL_META[c];
                  // The Custom column reads as the top tier with a dark ink
                  // header (mirrors the prototype's th.cust). An active selection
                  // still wins with the champagne highlight.
                  const bg = active
                    ? 'var(--m-orange-4)'
                    : isCustom
                      ? 'var(--m-ink)'
                      : 'transparent';
                  const nameColor = active
                    ? 'var(--m-orange-2)'
                    : isCustom
                      ? 'var(--m-orange-3)'
                      : 'var(--m-slate-2)';
                  const priceColor = active || !isCustom ? 'var(--m-ink)' : 'var(--m-paper)';
                  const unitColor = isCustom && !active ? 'var(--m-mulberry-3)' : 'var(--m-slate-3)';
                  return (
                    <th
                      key={c}
                      scope="col"
                      style={{
                        padding: '14px 12px',
                        textAlign: 'center',
                        borderLeft: '1px solid var(--m-line-soft)',
                        borderBottom: '1px solid var(--m-line)',
                        background: bg,
                        verticalAlign: 'top',
                      }}
                    >
                      <div
                        className="m-mono"
                        style={{
                          fontSize: 10.5,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color: nameColor,
                        }}
                      >
                        {m.name}
                      </div>
                      <div className="m-display" style={{ fontSize: 20, color: priceColor, marginTop: 4 }}>
                        {m.price}
                      </div>
                      {m.unit ? (
                        <div className="m-mono" style={{ fontSize: 10, color: unitColor, marginTop: 2 }}>
                          {m.unit}
                        </div>
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={`grp-${g.title}`}>
                  <tr>
                    <th
                      colSpan={1 + COLS.length}
                      scope="colgroup"
                      style={{
                        textAlign: 'left',
                        padding: '14px 16px 8px',
                        background: 'var(--m-ivory)',
                        borderTop: '1px solid var(--m-line)',
                        borderBottom: '1px solid var(--m-line-soft)',
                      }}
                    >
                      <span
                        className="m-mono"
                        style={{
                          fontSize: 11,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color: 'var(--m-orange-2)',
                        }}
                      >
                        {g.title}
                      </span>
                    </th>
                  </tr>
                  {g.rows.map((r) => (
                    <tr key={`${g.title}-${r.label}`}>
                      <th
                        scope="row"
                        style={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                          background: 'var(--m-paper)',
                          textAlign: 'left',
                          fontWeight: 400,
                          padding: '10px 16px',
                          fontSize: 13.5,
                          color: 'var(--m-ink)',
                          borderTop: '1px solid var(--m-line-soft)',
                        }}
                      >
                        {r.label}
                      </th>
                      {COLS.map((c) => (
                        <CellView key={c} cell={r.cells[c]} selected={selected === c} />
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <p className="m-mono" style={{ fontSize: 10.5, color: 'var(--m-slate-3)', marginTop: 14, lineHeight: 1.5, maxWidth: 760 }}>
          Every benefit, every tier &mdash; ~90 in all.{' '}
          &ldquo;Soon&rdquo; = in active build. Prices read the live catalog and
          are billed per 28-day cycle. Enterprise is a bounded plan; franchises &amp;
          multi-location go Custom. 0% commission on every booking, every tier.
        </p>

        {/* Custom "for those who need more" callout — the negotiated tier ABOVE
            Enterprise. Copy from the shared VENDOR_CUSTOM_TIER constant; the
            "from ₱X" floor is CUSTOM_FROM_PRICE (parsed from that same constant,
            never a fresh literal). */}
        <div
          className="m-cust-band"
          style={{
            background: 'var(--m-ink)',
            color: 'var(--m-mulberry-3)',
            borderRadius: 'var(--m-r-lg)',
            marginTop: 34,
            padding: 'clamp(26px, 4vw, 40px)',
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            gap: 28,
            alignItems: 'center',
          }}
        >
          <div>
            <span
              className="m-mono"
              style={{
                fontSize: 11,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'var(--m-orange)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span aria-hidden style={{ width: 24, height: 1, background: 'var(--m-orange)' }} />
              Custom · beyond Enterprise &middot; {CUSTOM_FROM_PRICE}
            </span>
            <h3 className="m-serif" style={{ fontSize: 28, fontWeight: 600, margin: '14px 0 8px', color: '#fff' }}>
              For those who need more.
            </h3>
            <p style={{ fontSize: 14, color: '#c7bca4', margin: 0, maxWidth: '46ch', lineHeight: 1.55 }}>
              Franchises, chains and multi-location houses compose their own plan
              &mdash; Enterprise as the base, then only the units they need, with a
              dedicated account team.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              'More branches & team seats',
              'Nationwide reach',
              'Higher photo & event limits',
              'Dedicated account manager · white-glove',
            ].map((cl) => (
              <div key={cl} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: '#e4dac7' }}>
                <span aria-hidden style={{ color: 'var(--m-orange)', fontWeight: 700 }}>＋</span>
                {cl}
              </div>
            ))}
            <div style={{ marginTop: 8 }}>
              <Link href="/help#contact" className="m-btn m-btn-orange">
                Talk to us →
              </Link>
            </div>
          </div>
        </div>
      </div>
      <style>{`@media(max-width:720px){ .m-cust-band{grid-template-columns:1fr !important} }`}</style>
    </section>
  );
}
