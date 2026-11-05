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
import { readScheduleMarks } from '@/lib/supplier-schedule-marks.server';
import { readBookedSchedule } from '@/lib/booked-call-times.server';
import { readTradeChapters } from '@/lib/trade-chapters';
import { readOpenDateChange } from '@/lib/date-change.server';
import { readEventServiceCounts } from '@/lib/supplier-count.server';
import { ROOM_SIZE_GROUPS, bookedView, type BookedFacts } from '@/lib/booked-rows';
import type { TeamRow } from '@/lib/your-team-rows';
import { BookedBody } from './booked-body';

export async function BookedSlot({
  eventId,
  rows,
  facts,
  scheduleShared = true,
  firstOpen = null,
}: {
  eventId: string;
  /** `teamRows(...)` — every group; the body draws the asked and the booked. */
  rows: readonly TeamRow[];
  facts: readonly BookedFacts[];
  /**
   * The viewer may read the Schedule (a delegate the host set to Off reads no moments). Off → the call-time line is
   * not drawn at all, rather than "No call time yet" over moments they simply cannot see.
   */
  scheduleShared?: boolean;
  /** 🔗 Open on this supplier's row (`?team=`) — the invite nudge lands on their claim door. */
  firstOpen?: string | null;
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
  // room sizes, the event's open date-change request (if any), and each supplier's
  // call time — the Schedule moment they are tagged on (owner 2026-10-27).
  const [money, plans, rooms, dateChange, schedule, marks, trade, counts] = await Promise.all([
    isBudgetTruthEnabled() ? resolveEventMoneySettled(supabase, eventId) : Promise.resolve(unreadEventMoney()),
    readBookedPlans(supabase, eventId, bookedIds),
    readBookedRoomSizes(supabase, venueShops),
    bookedIds.length > 0 ? readOpenDateChange(supabase, eventId) : Promise.resolve({ ok: true as const, view: null }),
    // 📍 The same one read also gives each supplier's Where — the chapters they are on (owner 2026-11-01).
    scheduleShared ? readBookedSchedule(supabase, eventId, bookedIds) : Promise.resolve(undefined),
    // ✅ Each booked supplier's Seen / Confirm my times (audit G6) — the Team row says it.
    scheduleShared && bookedIds.length > 0 ? readScheduleMarks(supabase, eventId) : Promise.resolve(undefined),
    // 📖 Each trade's usual chapters — "Which chapters will they serve?" starts from them (owner 2026-11-04).
    scheduleShared && bookedIds.length > 0 ? readTradeChapters(supabase) : Promise.resolve({ ok: false as const }),
    // 🧮 "Who they count" per per-head service (owner 2026-11-04) — one request, in the same batch.
    bookedIds.length > 0 ? readEventServiceCounts(supabase, eventId) : Promise.resolve(null),
  ]);
  const list = buildBudgetList(money);
  const view = bookedView({
    rows,
    facts,
    money: list.suppliers,
    plans,
    rooms,
    dateChange: dateChange.ok ? dateChange.view : null,
    callTimes: schedule === undefined ? undefined : schedule === null ? null : schedule.callTimes,
    marks,
    chapters: schedule === undefined ? undefined : schedule === null ? null : schedule.chapters,
    tradeChapters: trade.ok ? trade.byCategory : null,
  });
  // The Budget is its own page (Team · Budget · Schedule, owner 2026-10-29; Home's page since 2026-11-01), a door in
  // the body's "Team ▾" — so the small block that sat under the rows is not drawn here.
  return <BookedBody eventId={eventId} state={{ kind: 'view', view }} dateChangeUnread={!dateChange.ok} firstOpen={firstOpen} counts={counts} />;
}
