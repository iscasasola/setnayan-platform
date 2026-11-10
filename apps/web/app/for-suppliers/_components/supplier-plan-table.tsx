/**
 * The full plan comparison on /for-suppliers — Free · Verified · Solo · Pro · Ultra, side by side (Build 6 Lane J;
 * owner 10 Nov 2026: *"update the full FREE vs VERIFIED vs SOLO vs PRO vs ULTRA for suppliers on the for suppliers
 * page"*).
 *
 * Every cell comes from `planTable` (plan-table-data.ts), which reads the code that enforces it — this file only
 * draws. No number, no peso, no plan name is typed here (`supplier-plan-table-tells-the-truth.test.ts`).
 *
 * Phone: the table keeps its five columns and scrolls sideways INSIDE its own card (the plan column stays pinned), so
 * the page itself keeps its 16 px gutters and never scrolls sideways at 320–390. A locked row carries its Problem →
 * Solution line under the name (owner 10 Nov: "always show the Problem and Solution").
 */
import { TABLE_TIERS, planTable, tableTierName, type PlanTablePrices, type TableCell } from './plan-table-data';
import s from './supplier-front.module.css';

function Cell({ cell }: { cell: TableCell }) {
  if (cell.kind === 'yes') {
    return (
      <td className={s.cmpYes}>
        <span aria-hidden="true">✓</span>
        <span className={s.srOnly}>{cell.text}</span>
        {cell.text !== 'Yes' ? <span aria-hidden="true"> {cell.text}</span> : null}
      </td>
    );
  }
  if (cell.kind === 'no') {
    return (
      <td className={s.cmpNo}>
        <span aria-hidden="true">—</span>
        <span className={s.srOnly}>{cell.text}</span>
      </td>
    );
  }
  if (cell.kind === 'lock') {
    return (
      <td className={s.cmpLock}>
        <span aria-hidden="true">🔒 </span>
        {cell.text}
      </td>
    );
  }
  return <td>{cell.text}</td>;
}

export function SupplierPlanTable({ paywallOn, prices }: { paywallOn: boolean; prices: PlanTablePrices }) {
  const groups = planTable({ paywallOn, prices });
  return (
    <div className={s.cmpCard} data-rv="">
      <h3 className={s.cmpHead}>Compare every plan</h3>
      <div className={s.cmpScroll} role="region" aria-label="Compare every plan" tabIndex={0}>
        <table className={s.cmp}>
          <thead>
            <tr>
              <th scope="col" className={s.cmpCorner}>
                <span className={s.srOnly}>What you get</span>
              </th>
              {TABLE_TIERS.map((t) => (
                <th key={t} scope="col">
                  {tableTierName(t)}
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
                    {r.why ? (
                      <small className={s.cmpWhy}>
                        {r.why.problem} {r.why.solution}
                      </small>
                    ) : null}
                  </th>
                  {TABLE_TIERS.map((t) => (
                    <Cell key={t} cell={r.cells[t]} />
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
