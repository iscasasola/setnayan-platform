/**
 * Customers › Dates and QR codes on fixture data (S-PR3) — the REAL components, the prototype's own October (frames
 * 04 · 29 · 35 · 10 · 40). Drawn only by `/dev/supplier-lab` (404 in production). Every form posts the SHIPPED
 * calendar / QR actions; with no session each one refuses — nothing is written from here. The month draws other
 * months from the fixtures alone (no month fetcher).
 */
import { renderUrlQrSvg } from '@/lib/qr';
import type { SchedulePool } from '@/lib/vendor-schedule';
import { formatPhp } from '@/lib/orders';
import { CustomersCalendar } from '@/app/vendor-dashboard/customers/_components/customers-calendar';
import { CustomersSegments } from '@/app/vendor-dashboard/customers/_components/customers-segments';
import { DatesFolds, type DatesWaitlist } from '@/app/vendor-dashboard/customers/_components/dates-folds';
import { BlockDateAdd } from '@/app/vendor-dashboard/customers/_components/dates-sheets';
import { DaySheet, type DaySheetData } from '@/app/vendor-dashboard/customers/_components/day-sheet';
import { OutsideClientAdd } from '@/app/vendor-dashboard/customers/_components/outside-client-add';
import { QrCodes } from '@/app/vendor-dashboard/invite/_components/qr-codes';
import { LockedQrGenerator } from '@/app/vendor-dashboard/invite/_components/locked-qr-generator';
import { SupplierThumbRow } from '@/app/vendor-dashboard/_components/supplier-thumb-row';
import { SupplierToast } from '@/app/vendor-dashboard/_components/supplier-toast';
import {
  addManualBlock,
  createCalendar,
  editCalendar,
  importExternalClient,
  notifyWaitlistSlot,
  pickWaitlistCouple,
  reassignCategoryPool,
  removeBlock,
  setCalendarDayState,
  updatePoolCapacity,
  updateWaitlistSettings,
} from '@/app/vendor-dashboard/calendar/actions';

export const DATES_STATES = ['dates', 'dates-free', 'dates-empty', 'dates-day', 'dates-dayblocked', 'qr', 'qr-booked', 'qr-issued', 'qr-fail'] as const;
export type DatesState = (typeof DATES_STATES)[number];

const TODAY = '2026-10-02'; // Fri Oct 2 in Manila (the lab's NOW)

const pool = (poolId: string, label: string, capacity: number, categories: string[]): SchedulePool => ({
  poolId,
  label,
  capacity,
  categories,
  calendarName: label,
  isVendorCreated: true,
  serviceIds: [],
});
const MAIN = pool('p-main', 'Main team', 1, ['photo_video']);
const SECOND = pool('p-second', 'Second team', 2, ['styling']);

const BOOKINGS = [
  { poolId: 'p-main', bookedDate: '2026-10-03', eventName: 'Reyes debut' },
  { poolId: 'p-main', bookedDate: '2026-10-04', eventName: 'Cruz wedding' },
  { poolId: 'p-second', bookedDate: '2026-10-10', eventName: 'Bautista christening' },
  { poolId: 'p-main', bookedDate: '2026-10-31', eventName: 'Santos wedding' },
];
const BLOCKS = [
  { poolId: null, source: 'manual' as const, startDate: '2026-10-14', endDate: '2026-10-15', label: 'Family trip', clientName: null },
  { poolId: 'p-second', source: 'external_client' as const, startDate: '2026-10-17', endDate: '2026-10-17', label: null, clientName: 'Lopez anniversary' },
];
const ASKS = [
  { requestedDate: '2026-10-24', count: 2 },
  { requestedDate: '2026-10-03', count: 1 },
];
const WAITLIST = [{ requestedDate: '2026-10-25', pendingCount: 2 }];

const WAIT_ON: DatesWaitlist = {
  tierCap: 3,
  unlimited: false,
  on: true,
  cap: 2,
  grandfathered: 0,
  settingsMeasured: true,
  pickedMeasured: true,
  dates: [{ requestedDate: '2026-10-25', pendingCount: 2, picked: 1 }],
};
const WAIT_FREE: DatesWaitlist = { ...WAIT_ON, tierCap: 0, on: false, cap: 1, dates: [] };

const ACTIONS = { removeBlock, updateWaitlistSettings, pickWaitlistCouple, notifyWaitlistSlot, updatePoolCapacity, createCalendar, editCalendar, reassignCategoryPool };

const DAY: DaySheetData = {
  day: '2026-10-03',
  today: TODAY,
  calendarsLine: 'Main team',
  backHref: '/dev/supplier-lab?s=dates',
  bookings: [{ key: 'b1', title: 'Reyes debut', line: 'Tagaytay · Debut · Main team', href: '/dev/supplier-lab?s=dates-day' }],
  outside: [],
  holders: [
    { threadId: 't-dela', title: 'Dela Cruz', line: 'asked Sep 30 · not booked' },
    { threadId: 't-santos', title: 'Santos', line: 'asked Oct 1 · not booked' },
  ],
  holdersMeasured: true,
  waiting: 0,
  closures: [],
  holds: [],
  whoWorks: 'You',
};
const DAY_BLOCKED: DaySheetData = {
  ...DAY,
  day: '2026-10-14',
  calendarsLine: '',
  bookings: [],
  holders: [],
  closures: [{ blockId: 'blk-1', label: 'Family trip', startDate: '2026-10-14', endDate: '2026-10-15', scope: 'every calendar' }],
  holds: [{ key: 'h1', scope: 'p-second', title: 'Held by you', line: 'Second team' }],
  waiting: 2,
  whoWorks: null,
};

const LAB_TOASTS = {
  blocked: { text: 'Blocked. Couples see only “unavailable”.', tone: 'ok' as const },
  failed: { text: 'That did not go through. Nothing changed — please try again.', tone: 'bad' as const, retry: true },
};

export async function DatesLab({ state, toast, open }: { state: DatesState; toast?: string; open?: string }) {
  const base = `/dev/supplier-lab?s=${state}`;
  const t = toast && toast in LAB_TOASTS ? LAB_TOASTS[toast as keyof typeof LAB_TOASTS] : null;

  if (state.startsWith('qr')) {
    const modeOptions = [
      { key: 'shortlist', label: 'Shortlist · free', href: '/dev/supplier-lab?s=qr' },
      { key: 'locked', label: 'Booked · one-use', href: '/dev/supplier-lab?s=qr-booked' },
    ];
    const shortUrl = 'https://www.setnayan.com/vendor-invite/lumina?et=wedding';
    const lockUrl = 'https://www.setnayan.com/vendor/lock/lab-token';
    const svg = state === 'qr-fail' ? null : await renderUrlQrSvg(state === 'qr-issued' ? lockUrl : shortUrl, 220);
    return (
      <div className="min-h-screen bg-cream" data-supplier-lab={state}>
        {state === 'qr' || state === 'qr-fail' ? (
          <QrCodes
            mode="shortlist"
            backHref="/dev/supplier-lab?s=dates"
            modeOptions={modeOptions}
            canShare
            setupHref="/dev/supplier-lab?s=qr"
            shortlist={{
              url: shortUrl,
              svg,
              shopName: 'Lumina Studio',
              eventPick: { value: 'wedding', options: [{ key: 'any', label: 'Any event', href: base }, { key: 'wedding', label: 'Wedding', href: base }, { key: 'debut', label: 'Debut', href: base }] },
              servicePick: { value: 'all', options: [{ key: 'all', label: 'All my services', href: base }, { key: 'photo_video', label: 'Photo & video', href: base }] },
              scope: ' on their wedding plan',
            }}
            booked={null}
          />
        ) : (
          <QrCodes
            mode="locked"
            backHref="/dev/supplier-lab?s=dates"
            modeOptions={modeOptions}
            canShare
            setupHref="/dev/supplier-lab?s=qr"
            shortlist={null}
            booked={{
              issued:
                state === 'qr-issued'
                  ? { url: lockUrl, svg, title: `Photo & video · ${formatPhp(45_000)}`, line: `${formatPhp(15_000)} paid · one use — give it to that one customer`, used: false }
                  : null,
              error: null,
              generator: (
                <LockedQrGenerator
                  eventTypes={[{ value: 'wedding', label: 'Wedding' }, { value: 'debut', label: 'Debut' }]}
                  services={[{ value: 'svc-1', label: 'Photo & video' }]}
                  contracts={[]}
                />
              ),
              ledger: [
                { token: 'tk-1', title: 'Photo & video', line: `${formatPhp(45_000)} · ${formatPhp(15_000)} paid · claimed Oct 1`, status: 'claimed', showHref: null },
                { token: 'tk-2', title: 'Photo & video', line: `${formatPhp(60_000)} · ${formatPhp(20_000)} paid · issued Sep 28`, status: 'pending', showHref: '/dev/supplier-lab?s=qr-issued' },
                { token: 'tk-3', title: 'Styling', line: `${formatPhp(30_000)} · ${formatPhp(10_000)} paid · issued Sep 20`, status: 'void', showHref: null },
              ],
              ledgerOpen: open === 'issued',
              newHref: '/dev/supplier-lab?s=qr-booked',
            }}
          />
        )}
      </div>
    );
  }

  if (state === 'dates-day' || state === 'dates-dayblocked') {
    return (
      <div className="min-h-screen bg-cream px-4 pb-32 pt-4" data-supplier-lab={state}>
        {t ? <SupplierToast {...t} /> : null}
        <DaySheet data={state === 'dates-day' ? DAY : DAY_BLOCKED} actions={{ addManualBlock, removeBlock, setCalendarDayState, notifyWaitlistSlot }} />
        <SupplierThumbRow name="dates" label="Date tools">
          <OutsideClientAdd pools={[MAIN, SECOND]} action={importExternalClient} today={TODAY} setupHref={base} returnTo="dates" />
        </SupplierThumbRow>
      </div>
    );
  }

  const pools = state === 'dates-empty' ? [] : state === 'dates-free' ? [MAIN] : [MAIN, SECOND];
  const shown = new Set(pools.map((p) => p.poolId));
  return (
    <div className="min-h-screen bg-cream px-4 pb-32 pt-4" data-supplier-lab={state}>
      <div className="space-y-4">
        <CustomersSegments seg="dates" hrefOf={(s) => (s === 'dates' ? base : `/dev/supplier-lab?s=${s === 'people' ? 'people' : 'dates'}`)} />
        {t ? <SupplierToast {...t} /> : null}
        <div id="calendar">
          {pools.length === 0 ? (
            <p className="mb-2 text-[13.5px] text-ink/70" data-dates-no-calendar="">
              Calendar not set — open Capacity below to make one.
            </p>
          ) : null}
          <CustomersCalendar
            initialDayStates={state === 'dates' ? [{ dayStateId: 'ds-1', poolId: 'p-second', stateDate: '2026-10-21', dayState: 'locked', note: null }] : []}
            initialWaitlist={state === 'dates' ? WAITLIST : []}
            inquiries={state === 'dates-empty' ? [] : ASKS}
            initialMonth="2026-10"
            initialDay="2026-10-03"
            todayIso={TODAY}
            pools={pools}
            bookings={BOOKINGS.filter((b) => shown.has(b.poolId))}
            blocks={state === 'dates-empty' ? [] : BLOCKS.filter((b) => b.poolId === null || shown.has(b.poolId))}
            agents={state === 'dates' ? [{ value: 'tm-marco', label: 'Marco' }] : []}
            agentCategories={{ 'tm-marco': ['styling'] }}
            fetchMonth={null}
          />
        </div>
        <DatesFolds
          today={TODAY}
          month="2026-10"
          open={open ?? null}
          closures={state === 'dates-empty' ? [] : [{ blockId: 'blk-1', label: 'Family trip', startDate: '2026-10-14', endDate: '2026-10-15', scope: 'every calendar' }]}
          closuresIncomplete={false}
          waitlist={state === 'dates' ? WAIT_ON : WAIT_FREE}
          calendars={pools.map((p) => ({
            poolId: p.poolId,
            label: p.label,
            name: p.label,
            capacity: p.capacity,
            line: p.poolId === 'p-main' ? 'Photo & video' : 'Styling',
            serviceIds: [],
            categories: [],
          }))}
          ceiling={state === 'dates-free' ? 1 : 3}
          namedCalendars
          services={[
            { serviceId: 'svc-1', label: 'Photo & video', poolId: 'p-main' },
            { serviceId: 'svc-2', label: 'Styling', poolId: 'p-second' },
          ]}
          qrHref="/dev/supplier-lab?s=qr"
          actions={ACTIONS}
        />
      </div>
      <SupplierThumbRow name="dates" label="Date tools">
        <BlockDateAdd pools={pools} action={addManualBlock} today={TODAY} month="2026-10" />
        <OutsideClientAdd pools={pools} action={importExternalClient} today={TODAY} setupHref={base} returnTo="dates" />
      </SupplierThumbRow>
    </div>
  );
}
