import type { SchedulePool } from '@/lib/vendor-schedule';
import type { DatesBlock, DatesBooking } from '@/lib/vendor-dates';

/**
 * The lab shop's month (November 2026, v113's own month) in the exact shape the Schedule calendar draws (`ScheduleCalendarInputs`) — so the
 * Schedule page's calendar draws from a fixture and asks for nothing. Reyes & Santos is the 8th; the 16th is closed.
 */
export const LAB_TODAY = '2026-11-08';

const POOL: SchedulePool = {
  poolId: 'p-main',
  label: 'Main team',
  capacity: 2,
  categories: ['photo_video'],
  calendarName: 'Main team',
  isVendorCreated: true,
  serviceIds: [],
};

const BOOKINGS: DatesBooking[] = [
  { poolId: 'p-main', bookedDate: '2026-11-08', eventName: 'Reyes & Santos wedding' },
  { poolId: 'p-main', bookedDate: '2026-11-08', eventName: 'Villanueva debut' },
  { poolId: 'p-main', bookedDate: '2026-11-10', eventName: 'Lim christening' },
  { poolId: 'p-main', bookedDate: '2026-11-21', eventName: 'Bautista wedding' },
];

const BLOCKS: DatesBlock[] = [
  { blockId: 'blk-16', poolId: null, source: 'manual', startDate: '2026-11-16', endDate: '2026-11-16', label: 'Not available', clientName: null },
  { poolId: 'p-main', source: 'external_client', startDate: '2026-11-12', endDate: '2026-11-12', label: null, clientName: 'Garcia corporate party', clientTime: '14:00' },
];

export const LAB_CALENDAR = {
  pools: [POOL],
  bookings: BOOKINGS,
  blocks: BLOCKS,
  dayStates: [],
  waitlist: [],
  closuresComplete: true,
  // v113's asking marks (1 · 5 · 12 Nov) — the Schedule month draws them now its one read carries the asks (Build 2 #43g).
  inquiries: [
    { requestedDate: '2026-11-01', count: 1 },
    { requestedDate: '2026-11-05', count: 1 },
    { requestedDate: '2026-11-12', count: 1 },
  ],
};
