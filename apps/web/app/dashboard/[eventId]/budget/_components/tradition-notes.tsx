/**
 * <TraditionNotes> — the Mahr and Chinese-tradition notes, as words inside the
 * Target's ⓘ (Budget B5). A server-safe component: no hooks, no client code.
 *
 * `BUDGET_PAGE_2026-10-08_fable.md` §1 row 4: the Mahr and the Chinese
 * tradition notes stay, "as a quiet ⓘ beside Target for those event types; not
 * a card". They ride inside the Target's own ⓘ — the one place a couple reads
 * what the Target does and does not count — so the summary keeps its two-by-two
 * rows and no second circle crowds the 160px cell.
 *
 * What they say is unchanged in substance:
 *   · the Mahr is the groom's gift to the bride, hers alone; Setnayan neither
 *     holds nor processes it, so it is never folded into committed/overspend;
 *   · ang pao and the lauriat are the couple's own arrangements; the lauriat is
 *     priced PER TABLE (~10 guests), so the one derived fact is the TABLE COUNT
 *     — never a ₱ figure (per-table rates are admin-managed, not in scope here).
 * The "Set mahr" link is gone with the card: an ⓘ holds words, not doors
 * (owner 2026-09-28, no "edit it over there" links). The mahr is still set from
 * the Nikah card on Home, and the note says so.
 */
import { formatCount } from '@/lib/format-number';

const LAURIAT_PAX_PER_TABLE = 10;

export function TraditionNotes({
  muslim,
  mahrDescription,
  chinese,
  pax,
}: {
  muslim: boolean;
  mahrDescription: string | null;
  chinese: boolean;
  pax: number | null;
}) {
  if (!muslim && !chinese) return null;
  const mahrSet = !!mahrDescription && mahrDescription.trim().length > 0;
  const tables = pax !== null ? Math.ceil(pax / LAURIAT_PAX_PER_TABLE) : null;
  return (
    <>
      {muslim ? (
        <span className="mt-2 block" data-budget-note="mahr">
          {mahrSet ? (
            <>
              <b>Mahr</b> · Your mahr: {mahrDescription}. It belongs to the bride alone — Setnayan never charges or
              processes it, so it stays out of these totals.
            </>
          ) : (
            <>
              <b>Mahr</b> · The groom&rsquo;s gift to the bride, hers alone. It isn&rsquo;t a Setnayan or supplier
              charge, so it stays out of these totals. Record yours from the Nikah card on Home.
            </>
          )}
        </span>
      ) : null}
      {chinese ? (
        <span className="mt-2 block" data-budget-note="chinese">
          <b>Chinese traditions</b> · Ang pao for the tea ceremony, and the lauriat banquet, priced per table — about{' '}
          {formatCount(LAURIAT_PAX_PER_TABLE)} guests to a table
          {tables !== null && pax !== null
            ? ` (about ${formatCount(tables)} ${tables === 1 ? 'table' : 'tables'} for ${formatCount(pax)} guests)`
            : ''}
          . Your own arrangements, so they stay out of these totals.
        </span>
      ) : null}
    </>
  );
}
