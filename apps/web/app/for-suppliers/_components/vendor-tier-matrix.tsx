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
import { VENDOR_TIER_SECTIONS } from '@/app/_components/home/vendor-benefits';
import { TIER_CAPS, TIER_LABEL, canBuyExtraBranches } from '@/lib/vendor-tier-caps';

// The four marketed columns. `verified` is the real free-vendor state
// ("Free · Verified"); the legacy pre-verification `free` state is not a column.
// (A fifth, `custom`, was retired from the app 2026-11-06 — owner: "from the app".)
import { supplierCommissionPromise } from '@/lib/commission-promise';
import type { BookingFeeSchedule } from '@/lib/booking-fee';

type Col = 'verified' | 'solo' | 'pro' | 'enterprise';
const COLS: Col[] = ['verified', 'solo', 'pro', 'enterprise'];
const COL_RANK: Record<Col, number> = {
  verified: 0,
  solo: 1,
  pro: 2,
  enterprise: 3,
};

// Map a benefit's source tier (in vendor-benefits.ts, where the FREE tier owns
// the whole shared spine) to the column it FIRST appears in.
const SOURCE_TO_COL: Record<string, Col> = {
  free: 'verified',
  solo: 'solo',
  pro: 'pro',
  enterprise: 'enterprise',
};

export interface VendorTierMatrixPrices {
  /** Each tier price is `null` when the catalog could not be read — the column
   *  then says the price is unavailable rather than showing a typed figure. */
  soloMonthly: string | null;
  proMonthly: string | null;
  enterpriseMonthly: string | null;
  /** The live extra-branch price — Ultra's "Extra branches" row names it. */
  branch: string | null;
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
function buildLimitsGroup(branchPrice: string | null): Group {
  const cap = (col: Col) => TIER_CAPS[col];
  const km = (n: number) => (n === Infinity ? 'Nationwide' : n === 0 ? NO.kind : `${n} km`);
  const num = (n: number, unit = '') =>
    n === Infinity ? 'Unlimited' : n === 0 ? '—' : `${n}${unit}`;

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
      row('Team seats', (c) => (c.agentAccounts === 0 ? NO : val(num(c.agentAccounts)))),
      // 🏬 Branches beyond the main shop (owner 2026-11-04, "BRANCHES PER PLAN": "branches 0,0,3,10") and who may buy
      // more (Ultra only) — both read from TIER_CAPS / canBuyExtraBranches; the fee is the live catalogue price.
      row('Branches included', (c) => (c.branchesIncluded === 0 ? NO : val(num(c.branchesIncluded)))),
      row('Extra branches', (_c, col) =>
        canBuyExtraBranches(col) ? val(branchPrice ? `${branchPrice} each` : 'Yes') : NO,
      ),
      // ⏳ Waiting list — couples a shop may take off it for one booked-out date (owner 2026-11-04: 0 · 0 · 1 · 5).
      row('Waiting list / date', (c) => (c.waitlistAcceptances === 0 ? NO : val(num(c.waitlistAcceptances)))),
      // 🌐 The shop's own web address → its page (Solo and up since owner 2026-11-04).
      row('Your own web address', (c) => (c.customWebsiteName ? YES : NO)),
      // ⛔ "Bookable slots / day", "Portfolio photos" and "Answer matched couples /
      // week" were rows here until 2026-10-23. The owner ruled that plans price
      // REACH, never the things that earn a booking fee ("We want everybody to be
      // able to give us booking fee"): every plan now takes as many bookings a day
      // as the supplier sets, answers every couple, and gets the same free photo
      // base. Three columns of identical cells are not a comparison — the same
      // treatment as the reviews row below. They are said once, on Free, in
      // vendor-benefits.ts and the "What each plan adds" deltas. Do not re-add them.
      // ⛔ "Full written reviews shown" was a row here until 2026-08-09. It
      // advertised a vendor's own reviews as something they could BUY, which is
      // the opposite of the merit-first ranking lock. Reviews are now shown on
      // every tier and there is nothing to compare, so the row is gone rather
      // than turned into a column of identical ticks. Do not re-add it.
      // ⛔ "Custom URL / slug" was a row here until 2026-08-10, and it became
      // false the moment the address stopped being renameable (owner, twice:
      // "whatever they choose here will be permanent"). Every shop picks its
      // own address at /open-shop, on every tier — so this advertised a paid
      // upgrade for something already free and now impossible to change.
      // Same treatment as the reviews row above: removed, not turned into a
      // column of identical ticks. Do not re-add it.
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

/** A tier's price tag — or the honest "unavailable" state when the read failed. */
export function tierTag(price: string | null, unit: string): { price: string; unit: string } {
  return price === null ? { price: '—', unit: 'price unavailable' } : { price, unit };
}

export function VendorTierMatrix({
  prices,
  feeSchedule,
}: {
  prices: VendorTierMatrixPrices;
  /** The LIVE booking-fee schedule the server page read; NULL names the fee, no rate. */
  feeSchedule: BookingFeeSchedule | null;
}) {
  const [selected, setSelected] = useState<Col>('pro');
  const groups = useMemo(
    () => [
      buildLimitsGroup(prices.branch),
      ...buildFeatureGroups(),
    ],
    [prices.branch],
  );

  const COL_META: Record<Col, { name: string; price: string; unit?: string }> = {
    verified: { name: 'Free · Verified', price: '₱0', unit: 'forever' },
    solo: { name: 'Solo', ...tierTag(prices.soloMonthly, '/ 28d') },
    pro: { name: 'Pro', ...tierTag(prices.proMonthly, '/ 28d') },
    enterprise: { name: TIER_LABEL.enterprise, ...tierTag(prices.enterpriseMonthly, '/ 28d') },
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
          before it. Tap a plan to highlight its column.
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
          aria-label="Supplier tier comparison"
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
                  const m = COL_META[c];
                  const bg = active ? 'var(--m-orange-4)' : 'transparent';
                  const nameColor = active ? 'var(--m-orange-2)' : 'var(--m-slate-2)';
                  const priceColor = 'var(--m-ink)';
                  const unitColor = 'var(--m-slate-3)';
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
          are billed per 28-day cycle.{' '}
          {/* 🔴 "0% commission while we launch" plus a HAND-TYPED schedule:
              two ways to go stale in one sentence, and the launch half was
              already false. Both now derive from the bill. */}
          {supplierCommissionPromise(feeSchedule)}
        </p>

      </div>
    </section>
  );
}
