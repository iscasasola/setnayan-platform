import { DAILY_CAPACITY_MAX } from '@/lib/vendor-tier-caps';
import type { SupplierOutcomeTone } from '../_components/supplier-toast';

/**
 * Every calendar action's outcome (`calendar/actions.ts` — `?notice=`, and `?gnotice=` inside the Customers ⚙), said once
 * by Customers' toast and kept as the status line. Moved here from `customers/page.tsx` unchanged, so the page and the
 * stay door (`app/_actions/stay-registry/supCalendar.ts`, which says a refusal on the row it was pressed on — owner
 * 2026-10-26 "a save never resets the screen") read ONE set of words.
 */
export const DATES_NOTICES: Readonly<Record<string, { tone: SupplierOutcomeTone; text: string; retry?: boolean }>> = {
  block_added: { tone: 'ok', text: 'Marked not available. Couples see only “unavailable”.' },
  block_removed: { tone: 'ok', text: 'Open again — bookable on Setnayan.' },
  client_imported: { tone: 'ok', text: 'Booking from outside added — free. It holds that date on your schedule now.' },
  capacity_saved: { tone: 'ok', text: 'How many a day — saved.' },
  capacity_clamped: { tone: 'note', text: `Saved at ${DAILY_CAPACITY_MAX} a day — the most a calendar takes.` },
  pool_saved: { tone: 'ok', text: 'Saved — those services share that schedule now.' },
  waitlist_notified: { tone: 'ok', text: 'Told them — the couples waiting know the date is open.' },
  waitlist_settings_saved: { tone: 'ok', text: 'Waiting list saved.' },
  waitlist_picked: { tone: 'ok', text: 'Picked — they hold their place for that date.' },
  waitlist_full: { tone: 'note', text: 'That date’s waiting list is full. Raise how many a date to pick more.' },
  waitlist_not_in_plan: { tone: 'note', text: 'A waiting list comes with the paid plans. Nothing changed.' },
  waitlist_none: { tone: 'note', text: 'No one is waiting on that date yet.' },
  day_state_saved: { tone: 'ok', text: 'Day updated. Couples see only “unavailable”.' },
  day_state_cleared: { tone: 'ok', text: 'Day reopened — it’s bookable again.' },
  calendar_created: { tone: 'ok', text: 'Schedule made.' },
  calendar_saved: { tone: 'ok', text: 'Schedule saved.' },
  bad_dates: { tone: 'bad', text: 'Those dates don’t work. Check the first and last day.', retry: true },
  bad_name: { tone: 'bad', text: 'It needs a name. Nothing was saved.', retry: true },
  bad_pool: { tone: 'bad', text: 'Pick which schedule it belongs to. Nothing was saved.', retry: true },
  bad_capacity: { tone: 'bad', text: 'How many a day must be 1 or more. Nothing was saved.', retry: true },
  save_failed: { tone: 'bad', text: 'That did not go through. Nothing changed — please try again.', retry: true },
};

/**
 * The outcomes that are NOT a save — every `bad` one, and the three `note`s that say nothing happened (a full waiting
 * list, a plan without one, nobody waiting). `capacity_clamped` is a note too, but it DID save (at the most a day).
 */
const NOTHING_HAPPENED = new Set(['waitlist_full', 'waitlist_not_in_plan', 'waitlist_none']);

/** The sentence for a calendar outcome that did not save, or null when it saved (or is not a calendar outcome). */
export function datesRefusal(notice: string | null): string | null {
  if (!notice) return null;
  const n = DATES_NOTICES[notice];
  return n && (n.tone === 'bad' || NOTHING_HAPPENED.has(notice)) ? n.text : null;
}
