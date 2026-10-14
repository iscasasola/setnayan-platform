/**
 * book-this-build.ts — the pure rules behind "Book this build" (Suppliers PR3;
 * corpus `SUPPLIERS_BUILD_PLAN_2026-10-07_fable.md`: *"a loop over
 * `finalizeVendor` with ONE combined confirmation that lists every date-lock /
 * impact / slot / terms state the loop returns; a date conflict refuses that
 * line"*).
 *
 * THERE IS STILL ONE BOOKING PATH. Every pick goes through the shipped
 * `finalizeVendor`, one at a time, exactly as its own Book button would send
 * it. This file only sorts what comes back:
 *
 *   done      asked (the supplier has to say yes) · booked · proposed
 *   confirm   the booking sets the date, or closes saved builds / other
 *             suppliers — answered ONCE, for every such pick together
 *   own step  a time slot, the reservation terms, a first payment, a category
 *             already booked: each has its own shipped step with its own
 *             consent, and is finished from that supplier's card — listed
 *             here, never answered here
 *   refused   the supplier cannot be booked as things stand, with the reason
 *
 * 🔑 A RESULT THIS DOES NOT NAME IS A COMPILE ERROR (`never`), and a server
 * newer than this bundle still reads as "could not confirm" — never as nothing.
 */
import type { FinalizeVendorResult } from '@/app/dashboard/[eventId]/vendors/actions';
import { formatCount } from './format-number';
import { lockImpactCopy } from './lock-impact';

export type BookPick = {
  vendorId: string;
  name: string;
  /** The category row it sits under (the Find row to open). */
  tile: string;
  category: string;
  /** Why it cannot be booked (taken on the date, declined) — never sent. */
  blockedNote: string | null;
};

export type BookOutcome =
  | { kind: 'done'; how: 'asked' | 'booked' | 'proposed' }
  | { kind: 'confirm'; flags: Array<'confirm_date_lock' | 'confirm_lock_impact'>; headline: string; lines: string[] }
  | { kind: 'own_step'; why: string }
  | { kind: 'refused'; why: string };

export function bookOutcomeOf(result: FinalizeVendorResult, name: string): BookOutcome {
  switch (result.status) {
    case 'ok':
    case 'already_locked':
      return { kind: 'done', how: 'booked' };
    case 'lock_requested':
      return { kind: 'done', how: 'asked' };
    case 'proposed':
      return { kind: 'done', how: 'proposed' };
    case 'date_will_lock': {
      const more = result.impact ? (lockImpactCopy(result.impact, name)?.lines ?? []) : [];
      return {
        kind: 'confirm',
        // That gate carries the impact too — answering it answers both.
        flags: ['confirm_date_lock', 'confirm_lock_impact'],
        headline: 'This books your date.',
        lines: [
          `Booking ${name} leaves only one of your candidate dates open. Continuing will finally set your date to ${result.dateLabel}. You can still change suppliers, but the date becomes official.`,
          ...more,
        ],
      };
    }
    case 'lock_will_cost': {
      const copy = lockImpactCopy(result.impact, name);
      return { kind: 'confirm', flags: ['confirm_lock_impact'], headline: copy?.headline ?? `Booking ${name}`, lines: copy?.lines ?? [] };
    }
    case 'slot_required':
      return { kind: 'own_step', why: `${name} books by time slot — pick yours when you book them.` };
    case 'reservation_terms_required':
      return { kind: 'own_step', why: `${name} has reservation terms to read and agree to when you book them.` };
    case 'downpayment_required':
      return { kind: 'own_step', why: `${name} asks for a first payment when you book them.` };
    case 'hard_single_conflict':
      return { kind: 'own_step', why: `You already booked ${result.existingVendorName} for ${result.groupLabel}.` };
    case 'soft_hold_limit_reached':
      return { kind: 'refused', why: `${result.vendorName} is fully booked with soft holds for your date.` };
    case 'vendor_not_verified':
      return { kind: 'refused', why: `${name} is completing verification and can’t be booked just yet.` };
    case 'not_signed_in':
      return { kind: 'refused', why: 'Please sign in.' };
    case 'not_secured':
      return { kind: 'refused', why: 'Secure your account before you book a supplier.' };
    case 'not_found':
      return { kind: 'refused', why: `${name} is no longer on your list.` };
    case 'error':
      return { kind: 'refused', why: result.message };
    default: {
      const unhandled: never = result;
      return {
        kind: 'refused',
        why: `We couldn’t confirm the booking (${(unhandled as { status?: string }).status ?? 'unknown'}). Refresh the page to see where it stands.`,
      };
    }
  }
}

/** What one pick's booking posts — the SAME fields its own Book button posts. */
export function bookFields(eventId: string, vendorId: string, flags: readonly string[]): Array<[string, string]> {
  return [['event_id', eventId], ['vendor_id', vendorId], ...flags.map((f) => [f, '1'] as [string, string])];
}

/** The toast once the loop is through — the prototype's words. */
export function bookedToast(done: ReadonlyArray<'asked' | 'booked' | 'proposed'>): string | null {
  const asked = done.filter((h) => h === 'asked').length;
  const booked = done.filter((h) => h === 'booked').length;
  const proposed = done.filter((h) => h === 'proposed').length;
  const n = (count: number) => `${formatCount(count)} supplier${count === 1 ? '' : 's'}`;
  if (asked > 0) {
    return `Asked ${n(asked)} to book — each opens when they say yes${booked > 0 ? ` · booked ${n(booked)} ✓` : ''}`;
  }
  if (booked > 0) return `Booked ${n(booked)} ✓`;
  if (proposed > 0) return `Proposed ${n(proposed)} — waiting for the hosts to confirm`;
  return null;
}
