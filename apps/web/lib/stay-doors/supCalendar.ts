/** The shop's calendar — Customers › Dates, its day sheet, the Customers ⚙ (teams and days), Today's days-off step
 *  and a venue card's "Uses" (`calendar/actions.ts`). */
export const SUP_CALENDAR_STAY_DOORS = [
  'supCalendar.addManualBlock',
  'supCalendar.removeBlock',
  'supCalendar.setCalendarDayState',
  'supCalendar.notifyWaitlistSlot',
  'supCalendar.pickWaitlistCouple',
  'supCalendar.updateWaitlistSettings',
  'supCalendar.updatePoolCapacity',
  'supCalendar.createCalendar',
  'supCalendar.editCalendar',
  'supCalendar.reassignCategoryPool',
  'supCalendar.setServiceHalls',
] as const;
export type SupCalendarStayDoor = (typeof SUP_CALENDAR_STAY_DOORS)[number];
