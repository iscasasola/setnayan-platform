/**
 * 🧮 A SUPPLIER BRIEF'S HEADCOUNT, ON THE HOSTS' BASIS (A6-48, final check 25 Nov). The brief
 * (`get_vendor_event_brief` › pax) hands the counts and `headcount_basis`; the number is taken by the ONE reader,
 * `headcountForBasis` (lib/guests.ts) — never a second rule here. Pure.
 */
import { headcountForBasis, type HeadcountBasis } from './guests';

export type { HeadcountBasis };

/**
 * The words beside a count taken on a basis (A6-48: the supplier's Headcount card says WHICH guests the number holds,
 * the same basis their pax follows). One phrase per basis; an unknown one reads as the owner-locked default.
 */
export function headcountBasisWords(basis: HeadcountBasis | null | undefined): string {
  if (basis === 'attending_plus_maybe') return 'coming or maybe';
  if (basis === 'invited') return 'invited, not declined';
  return 'coming';
}

/** A brief's pax counts (`get_vendor_event_brief`), counted on the hosts' basis by the one reader. */
export function briefHeadcount(pax: {
  invited: number;
  attending: number;
  maybe: number;
  pending: number;
  declined: number;
  headcount_basis?: HeadcountBasis | null;
}): number {
  return headcountForBasis(
    { total: pax.invited, attending: pax.attending, maybe: pax.maybe, pending: pax.pending, declined: pax.declined, plus_ones: 0 },
    pax.headcount_basis ?? 'attending',
  );
}

