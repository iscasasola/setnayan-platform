/**
 * The full plan comparison on /for-suppliers (and /for-coordinators) — Free · Plus · Pro · Ultra (Build 6 Lane J;
 * redrawn to the owner-approved simpler plans, DECISION_LOG 2026-11-14 "SIMPLER SUPPLIER PLANS", drawing § 2).
 *
 * Every cell comes from `planTable` (plan-table-data.ts), which reads the code that enforces it — this file only
 * draws. No number, no peso, no plan name is typed here (`supplier-plan-table-tells-the-truth.test.ts`).
 *
 * Desktop (720 and up): one table, four plan columns, Pro's column softly tinted (the plan that opens first). Phone:
 * one plan at a time, picked with chips (`PlanTableChips`), instead of a table you scroll sideways. Both are drawn
 * from the SAME groups; the stylesheet shows one. A row's note (the per-service count) sits under its name.
 */
import { FREE_COLUMN_NOTE, TABLE_TIERS, planTable, tableTierName, type PlanTablePrices, type TableCell } from './plan-table-data';
import { PlanTableChips } from './plan-table-chips';
import s from './supplier-front.module.css';

/** The column that opens first, on the phone and tinted on desktop. */
const OPEN_FIRST = 'pro';

function Cell({ cell, tint }: { cell: TableCell; tint: boolean }) {
  const t = tint ? ` ${s.cmpTint}` : '';
  if (cell.kind === 'yes') {
    return (
      <td className={`${s.cmpYes}${t}`}>
        <span aria-hidden="true">✓</span>
        <span className={s.srOnly}>{cell.text}</span>
        {cell.text !== 'Yes' ? <span aria-hidden="true"> {cell.text}</span> : null}
      </td>
    );
  }
  if (cell.kind === 'no') {
    return (
      <td className={`${s.cmpNo}${t}`}>
        <span aria-hidden="true">—</span>
        <span className={s.srOnly}>{cell.text}</span>
      </td>
    );
  }
  if (cell.kind === 'lock') {
    return (
      <td className={`${s.cmpLock}${t}`}>
        <span aria-hidden="true">🔒 </span>
        {cell.text}
      </td>
    );
  }
  return <td className={tint ? s.cmpTint : undefined}>{cell.text}</td>;
}

export function SupplierPlanTable({ paywallOn, prices }: { paywallOn: boolean; prices: PlanTablePrices }) {
  const groups = planTable({ paywallOn, prices });
  return (
    <div className={s.cmpCard} data-rv="" id="plan-table">
      <h3 className={s.cmpHead}>What each plan includes</h3>
      <div className={s.cmpWide}>
        <div className={s.cmpScroll} role="region" aria-label="What each plan includes" tabIndex={0}>
          <table className={s.cmp}>
            <thead>
              <tr>
                <th scope="col" className={s.cmpCorner}>
                  <span className={s.srOnly}>What you get</span>
                </th>
                {TABLE_TIERS.map((t) => (
                  <th key={t} scope="col" className={t === OPEN_FIRST ? s.cmpTint : undefined}>
                    {tableTierName(t)}
                    {t === 'free' ? <small className={s.cmpColNote}>{FREE_COLUMN_NOTE}</small> : null}
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.title}>
                <tr className={s.cmpGroup}>
                  <th scope="colgroup" colSpan={TABLE_TIERS.length + 1}>
                    {g.title}
                  </th>
                </tr>
                {g.rows.map((r) => (
                  <tr key={r.key}>
                    <th scope="row">
                      {r.label}
                      {r.note ? <small className={s.cmpWhy}>{r.note}</small> : null}
                      {r.why ? (
                        <small className={s.cmpWhy}>
                          {r.why.problem} {r.why.solution}
                        </small>
                      ) : null}
                    </th>
                    {TABLE_TIERS.map((t) => (
                      <Cell key={t} cell={r.cells[t]} tint={t === OPEN_FIRST} />
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </div>
      <PlanTableChips
        tiers={TABLE_TIERS.map((t) => ({ key: t, name: tableTierName(t), note: t === 'free' ? FREE_COLUMN_NOTE : null }))}
        groups={groups}
        start={OPEN_FIRST}
      />
    </div>
  );
}
