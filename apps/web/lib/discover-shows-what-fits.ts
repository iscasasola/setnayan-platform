/**
 * discover-shows-what-fits.ts — DISCOVER'S SUPPLIER VIEW SHOWS ONLY WHAT CAN BE BOOKED ON THE COUPLE'S DATE.
 *
 * Owner, 13 Nov 2026 (6134), verbatim: *"If a supplier is unavailable for that day, then we do not need to show
 * them. we only show what fits."*
 *
 * Find on the Suppliers page already hides them (`searchCategoryVendors({ hideUnbookable: true })`, H6, and the
 * per-card `keepFreeCards`). Discover's supplier view (`app/(shell)/explore/_lib/marketplace-view.tsx`) only moved
 * them DOWN the page. This file decides who leaves it — with the SAME refusal and the SAME stranger rule as Find:
 *
 *   • the refusal is the booking path's own (`service_cards_unbookable_on`, the mirror of `acquire_schedule_pools`:
 *     closure · the shop's hard hold · a full pool · a full slot — capacity per service, `daily_capacity`), read by
 *     `findSuppliersWithNoBookingLeft` (a supplier) and `readCardRefusals` (a card). Nothing new is invented here;
 *   • a supplier the couple already knows (on their list, or who has opened their event) never leaves — that is
 *     `leavesBenchSearch`, the bench search's own predicate;
 *   • a read that failed hides nobody (the caller passes `null`): a supplier wrongly shown costs a message, one
 *     wrongly hidden costs a supplier who could have said yes;
 *   • 🔑 AND A READ THAT FAILED IS NEVER PASSED OFF AS A FILTERED LIST. Each function returns `checked: false` when
 *     the date could not be judged, and the page then says "Couldn't check who's free on <date>." above the list
 *     (`dateUncheckedWords`, `lib/supplier-find-empty.ts`). Audit of #7556, 2026-11-13: an unreadable capacity
 *     answer used to come back as an empty set — "everybody is free" — so the page drew every supplier, full or
 *     not, under a date it had promised to filter by, and nothing on screen differed from a real check.
 *
 * Pure — no database — so every rule is executed by `find-shows-only-what-can-be-booked.test.ts`.
 */
import { cardFits, fitOptions, leavesBenchSearch, needsEveryDay, type UnbookableScope } from './bench-bookable-days';

/** What a keep returns: the rows the page goes on with, how many the date removed, and whether the date was judged. */
export type FitResult<T> = { rows: T[]; hidden: number; checked: boolean };

/**
 * Suppliers on Discover: drop the strangers with no booking left on the date.
 *   noBookingLeft  `null` = the capacity read failed.
 *   known          who the couple already knows; `null` = that read failed. Only needed when somebody is full.
 * Either `null` (when it matters) → every row stays and `checked: false`.
 */
export function keepSuppliersThatFit<T>(
  rows: readonly T[],
  idOf: (row: T) => string,
  noBookingLeft: ReadonlySet<string> | null,
  known: ReadonlySet<string> | null,
): FitResult<T> {
  if (noBookingLeft === null) return { rows: [...rows], hidden: 0, checked: false };
  if (noBookingLeft.size === 0) return { rows: [...rows], hidden: 0, checked: true };
  if (known === null) return { rows: [...rows], hidden: 0, checked: false };
  const kept = rows.filter(
    (r) => !leavesBenchSearch({ vendorProfileId: idOf(r), alreadyAdded: known.has(idOf(r)), relationshipDepth: 0 }, noBookingLeft),
  );
  return { rows: kept, hidden: rows.length - kept.length, checked: true };
}

/**
 * Service cards on Discover: a card stays when it fits the event's dates (`fitOptions`: free on ANY ONE judged day —
 * one day, any day of the span, any one candidate, any day of the window or month; an accommodation card needs every
 * night ±1 of one of them), or when its shop is one the couple already knows.
 *   refused     `null` = the read failed → every card stays, `checked: false`.
 *   days        the judged scope (`fitDateScope`), or a plain day list (each day its own option); none → every card
 *               stays, `checked: true` (there was nothing to check).
 *   known       `null` = that read failed; only matters when some card is refused.
 *   categoryOf  the card's category, so accommodation is judged by its nights. Omitted → every card judged by day.
 */
export function keepCardsThatFit<T>(
  cards: readonly T[],
  serviceIdOf: (card: T) => string,
  supplierIdOf: (card: T) => string,
  refused: ReadonlySet<string> | null,
  days: readonly string[] | UnbookableScope | null,
  known: ReadonlySet<string> | null,
  categoryOf?: (card: T) => string | null | undefined,
): { cards: T[]; hidden: number; checked: boolean } {
  const scope: UnbookableScope | null = !days ? null : Array.isArray(days) ? { kind: 'dates', days: [...days] } : (days as UnbookableScope);
  if (!scope || scope.days.length === 0) return { cards: [...cards], hidden: 0, checked: true };
  if (refused === null) return { cards: [...cards], hidden: 0, checked: false };
  if (refused.size === 0) return { cards: [...cards], hidden: 0, checked: true };
  if (known === null) return { cards: [...cards], hidden: 0, checked: false };
  const kept = cards.filter(
    (c) => {
      if (known.has(supplierIdOf(c))) return true;
      const category = categoryOf?.(c) ?? null;
      return cardFits(serviceIdOf(c), refused, fitOptions(scope, category), needsEveryDay(category));
    },
  );
  return { cards: kept, hidden: cards.length - kept.length, checked: true };
}
