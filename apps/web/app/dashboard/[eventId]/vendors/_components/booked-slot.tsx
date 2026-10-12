/**
 * BookedSlot — what the Suppliers page mounts under "Booked".
 *
 * The page hands in the rows it already derived (`teamRows`) and the facts it
 * already read; this component makes the two reads the body needs, together —
 * the shared resolver (`lib/budget-truth.ts`), the same ledger the Budget page
 * prints, and each booked supplier's own payment plan
 * (`lib/booked-plans.server.ts`) — and hands the pure view
 * (`lib/booked-rows.ts`) to `BookedBody`.
 *
 * ── A REFUSED MONEY READ REACHES THE ROWS ──────────────────────────────────
 * `resolveEventMoneySettled` never rejects: a refusal comes back with its
 * `reads` marked `'failed'`, `buildBudgetList` then hands `suppliers: null`
 * (unknown — never `[]`), and a priced row says its payments could not be
 * checked. With the resolver's switch off (`isBudgetTruthEnabled`) the ledger
 * was never asked, which is the same thing to a row: unknown, not empty. A
 * refused PLAN read is `null` too (never an empty map): the rows then say only
 * what the ledger knows.
 */
import { createClient } from '@/lib/supabase/server';
import { isBudgetTruthEnabled } from '@/lib/budget-truth-flag';
import { resolveEventMoneySettled, unreadEventMoney } from '@/lib/budget-truth';
import { buildBudgetList } from '@/lib/budget-page-view';
import { readBookedPlans } from '@/lib/booked-plans.server';
import { readBookedRoomSizes } from '@/lib/booked-room.server';
import { readOpenDateChange } from '@/lib/date-change.server';
import { ROOM_SIZE_GROUPS, bookedView, type BookedFacts } from '@/lib/booked-rows';
import { bookedBudget } from '@/lib/booked-budget';
import type { TeamMoney } from '@/lib/your-team';
import type { TeamRow } from '@/lib/your-team-rows';
import { BookedBody } from './booked-body';
import { BookedBudgetSection } from './booked-budget';

export async function BookedSlot({
  eventId,
  rows,
  facts,
  team,
}: {
  eventId: string;
  /** `teamRows(...)` — every group; the body draws the asked and the booked. */
  rows: readonly TeamRow[];
  facts: readonly BookedFacts[];
  /**
   * Booked · If you book these · Budget · Buffer — `teamMoneyOfModel` over the
   * page's own plan model: the SAME `teamMoney` call the Build body makes, so
   * the two tabs of this page can never print two figures for one fact.
   */
  team: { money: TeamMoney; inBuildCount: number };
}) {
  const supabase = await createClient();
  const bookedIds = rows.filter((r) => r.group === 'booked').map((r) => r.vendorId);
  // Only a booked VENUE on Setnayan has a shop that can state a room size.
  const booked = new Set(bookedIds);
  const venueShops = new Map(
    facts.flatMap((f) =>
      booked.has(f.vendorId) && f.shopId && f.groupId && ROOM_SIZE_GROUPS.has(f.groupId) ? [[f.vendorId, f.shopId] as const] : [],
    ),
  );
  // Together: the ledger, each booked supplier's own payment plan, the venues'
  // room sizes, and the event's open date-change request (if any).
  const [money, plans, rooms, dateChange] = await Promise.all([
    isBudgetTruthEnabled() ? resolveEventMoneySettled(supabase, eventId) : Promise.resolve(unreadEventMoney()),
    readBookedPlans(supabase, eventId, bookedIds),
    readBookedRoomSizes(supabase, venueShops),
    bookedIds.length > 0 ? readOpenDateChange(supabase, eventId) : Promise.resolve({ ok: true as const, view: null }),
  ]);
  const list = buildBudgetList(money);
  const view = bookedView({ rows, facts, money: list.suppliers, plans, rooms, dateChange: dateChange.ok ? dateChange.view : null });
  const budget = bookedBudget({ team, list, booked: view.booked, plansKnown: plans !== null });
  return (
    <BookedBody eventId={eventId} state={{ kind: 'view', view }} dateChangeUnread={!dateChange.ok}>
      <BookedBudgetSection eventId={eventId} budget={budget} />
    </BookedBody>
  );
}
