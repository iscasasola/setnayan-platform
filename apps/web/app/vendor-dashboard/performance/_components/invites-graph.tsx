import { invitesLine, type InviteMonth } from '@/lib/graph-unlocks';
import type { GraphSpec } from './graph-tile';

/**
 * 🤝 SUPPLIERS YOU INVITED — the ONE graph Invites Bronze opens (owner 15 Nov, specs 7fbff0cd (10): "one graph — suppliers
 * invited, how many booked, how many completed an event, month by month"; an imported supplier counts for Invites only
 * once its event is COMPLETED, (3)). Last 12 months, a fixed window (one bar group per month).
 *
 * ⏸ NOT COUNTED YET. Nothing records which shop imported which supplier — the add-a-supplier door is not built (owner
 * 6439 (4): "Until the add/invite door is built, the Invites badge ships showing 'Not counted yet'"). So the section
 * hands this graph no data and its card is never drawn; the badge's line under the carousel says "not counted yet"
 * (lib/graph-unlocks.ts). When the door records imports, its read feeds `invitesSpec` and nothing here changes.
 * 🔒 lib/graph-unlocks.test.ts · performance/graphs-open-at-bronze.test.ts
 */
export const INVITES_TITLE = 'Suppliers you invited';

const CW = 300;
const H = 70;

/** Three bars a month: invited · booked · completed (completed is what counts toward the badge). */
export function InvitesPic({ months }: { months: readonly InviteMonth[] }) {
  const n = Math.max(months.length, 1);
  const slot = CW / n;
  const bw = Math.max(2, (slot - 4) / 3);
  const max = Math.max(1, ...months.map((m) => m.invited));
  const bar = (v: number, i: number, j: number, cls: string) =>
    v > 0 ? (
      <rect
        key={`${i}-${j}`}
        className={`${cls} ag-grow`}
        style={{ animationDelay: `${Math.min(i * 30, 500)}ms` }}
        x={(i * slot + j * bw).toFixed(1)}
        y={(H - 2 - Math.max(3, (v / max) * (H - 10))).toFixed(1)}
        width={bw.toFixed(1)}
        height={Math.max(3, (v / max) * (H - 10)).toFixed(1)}
        rx={1.5}
      />
    ) : null;
  const first = months[0]?.month ?? '';
  const last = months[months.length - 1]?.month ?? '';
  return (
    <>
      <svg viewBox={`0 0 ${CW} ${H + 14}`} className="ag-lanes" role="img" aria-label="Suppliers you invited, booked and completed, by month" data-graph-pic="invites">
        <line className="ag-base" x1={0} x2={CW} y1={H - 2} y2={H - 2} />
        {months.flatMap((m, i) => [bar(m.invited, i, 0, 'ag-abar'), bar(m.booked, i, 1, 'ag-bbar'), bar(m.completed, i, 2, 'ag-cbar')])}
        <text className="ag-xl" x={0} y={H + 12}>
          {first}
        </text>
        <text className="ag-xl" x={CW} y={H + 12} textAnchor="end">
          {last}
        </text>
      </svg>
      <p className="ag-leg">
        <span>Invited</span>
        <span className="ag-leg-ok">Booked</span>
        <span className="ag-leg-mul">Completed an event</span>
      </p>
    </>
  );
}

const SAMPLE: InviteMonth[] = Array.from({ length: 12 }, (_, i) => ({ month: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'][i]!, invited: i % 3 === 0 ? 2 : i % 4 === 1 ? 1 : 0, booked: i % 6 === 0 ? 1 : 0, completed: i === 6 ? 1 : 0 }));
const EMPTY_LINE = 'Shows once a supplier you invited joins Setnayan.';

/** The Invites card. `months` null = the read was refused. */
export function invitesSpec(months: readonly InviteMonth[] | null): GraphSpec {
  const empty = months !== null && months.every((m) => m.invited === 0);
  const line = months === null ? 'Couldn’t load.' : empty ? EMPTY_LINE : invitesLine(months);
  return {
    k: 'invites',
    title: INVITES_TITLE,
    src: 'Counts · suppliers you invited, by month · booked · completed an event (completed is what counts)',
    tag: 'new',
    state: months === null ? 'unread' : empty ? 'empty' : 'ok',
    pic: <InvitesPic months={empty || months === null ? SAMPLE : months} />,
    line,
    problem: line,
    rec: null,
    // Not a door to an invite page: that door is not built (a door to nothing is a fake door). Its builder sets this.
    door: { label: 'Open your shop', href: '/vendor-dashboard/shop' },
  };
}
