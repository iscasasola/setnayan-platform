import 'server-only';
import type { SupCalendarStayDoor } from '@/lib/stay-doors/supCalendar';
import { supplierScreen, type StayWords } from '@/lib/save-in-place';
import { datesRefusal } from '@/app/vendor-dashboard/calendar/dates-notices';
import {
  addManualBlock,
  createCalendar,
  editCalendar,
  notifyWaitlistSlot,
  pickWaitlistCouple,
  reassignCategoryPool,
  removeBlock,
  setCalendarDayState,
  setServiceHalls,
  updatePoolCapacity,
  updateWaitlistSettings,
} from '@/app/vendor-dashboard/calendar/actions';
import { kind, type Door } from './_door';

/** A calendar outcome comes back as `?notice=<code>` (or `?gnotice=` inside the Customers ⚙); a refusal is said in the
 *  words Customers' toast uses for it (`calendar/dates-notices.ts`, the one set both read). */
const refuseDates = (q: URLSearchParams) => datesRefusal(q.get('notice') ?? q.get('gnotice'));

/**
 * Every calendar form lives on Customers (`/vendor-dashboard/customers` — Dates, the day sheet, Events' outside
 * clients, the ⚙). `/vendor-dashboard/calendar`, `/calendar/<day>` and `/clients` are the old addresses an action can
 * still name (`backToCalendar`), each now a forward to that same screen — so they stay too. Signed out → `/login`, no
 * shop → bare `/vendor-dashboard`: both navigate.
 */
const SUP_CALENDAR_WORDS: StayWords = {
  within: [supplierScreen('customers'), supplierScreen('calendar'), /^\/vendor-dashboard\/calendar\/\d{4}-\d{2}-\d{2}$/, supplierScreen('clients')],
  refuse: refuseDates,
};
const supCalendar = kind(SUP_CALENDAR_WORDS, false);

/**
 * A venue card's "Uses" (`/vendor-dashboard/services/<card>`, `halls-uses-pick.tsx`) saves with `return_to=shop`, which
 * lands on `/vendor-dashboard/shop?saved=1` — read as saved, so the card the supplier is editing stays open instead of
 * being swapped for the Shop list. Its refusals fall through to `/vendor-dashboard/calendar?notice=<code>`.
 */
const SUP_HALLS_WORDS: StayWords = { within: [supplierScreen('shop'), supplierScreen('calendar')], refuse: refuseDates };
const supHalls = kind(SUP_HALLS_WORDS, false);

export const SUP_CALENDAR: Readonly<Record<SupCalendarStayDoor, Door>> = {
  'supCalendar.addManualBlock': supCalendar(addManualBlock),
  'supCalendar.removeBlock': supCalendar(removeBlock),
  'supCalendar.setCalendarDayState': supCalendar(setCalendarDayState),
  'supCalendar.notifyWaitlistSlot': supCalendar(notifyWaitlistSlot),
  'supCalendar.pickWaitlistCouple': supCalendar(pickWaitlistCouple),
  'supCalendar.updateWaitlistSettings': supCalendar(updateWaitlistSettings),
  'supCalendar.updatePoolCapacity': supCalendar(updatePoolCapacity),
  'supCalendar.createCalendar': supCalendar(createCalendar),
  'supCalendar.editCalendar': supCalendar(editCalendar),
  'supCalendar.reassignCategoryPool': supCalendar(reassignCategoryPool),
  'supCalendar.setServiceHalls': supHalls(setServiceHalls),
};
