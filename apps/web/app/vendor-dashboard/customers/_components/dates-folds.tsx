import { BellRing, Check, QrCode, X } from 'lucide-react';
import { Fold } from '@/app/_components/fold';
import { Counter } from '@/app/_components/counter';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';
import { CALENDAR_HATCH } from '@/lib/calendar-grid';
import { blockDaysLine, capacityLine, rangeWords, waitlistLine } from '@/lib/vendor-dates';
import { formatCount } from '@/lib/format-number';
import { SupplierSubmit } from '../../_components/supplier-submit';
import { DatesRow } from './dates-row';
import { CalendarSheet, ShareTeamPick, type DatesService } from './dates-sheets';

/**
 * CUSTOMERS › DATES — under the month, the shop's calendar tools as three folds and one row (S-PR3; plan § 2:
 * "`calendar/surface.tsx` (second renderer, pools, waitlist, capacity, blocks) — Merge into Customers › Dates: one
 * month grid …, then three folds: Block days · Waitlist · Capacity (calendars + events-a-day)"; "/invite + /locked-qr
 * — Merge: one 'QR codes' …"; prototype frame 04).
 *
 * Every fold is the shared `Fold` (one open at a time; one quiet line of what is inside), every row a hairline row,
 * every write the SHIPPED action from `calendar/actions.ts` (handed in — this file imports none), coming back to
 * Dates with the fold it came from open (`return_fold`).
 *
 *   Block days — the closures ahead: label · dates · which calendar, ✕ asks once. "Block a date" is the thumb row's.
 *   Waitlist   — the switch, how many a date (kind 17 Counter), then each date with Pick and Tell them.
 *   Capacity   — each calendar's events a day (kind 17 Counter, saves itself); its name/services in a sheet; New
 *                calendar. With Named Calendars off: which services share a team (one dropdown each).
 *   QR codes › — the one QR page (Shortlist · Booked one-use, its ledger inside).
 *
 * Server component: every word arrives read; nothing here is fetched.
 */

type Action = (formData: FormData) => void | Promise<void>;

export type DatesClosure = {
  blockId: string;
  label: string;
  startDate: string;
  endDate: string;
  /** "Every calendar" or the one it closes. */
  scope: string;
};

export type DatesWaitlist = {
  /** The plan's ceiling as the switch reads it (`vendorAllowance`); 0 = not on this plan. */
  tierCap: number;
  unlimited: boolean;
  on: boolean;
  cap: number;
  /** A number the shop set above its plan's, kept (2026-08-29) — the counter may show it. */
  grandfathered: number;
  /** The settings row was read. Unread, nothing here claims what their plan holds. */
  settingsMeasured: boolean;
  /** The picked counts were read. Unread, a date says "—", never 0. */
  pickedMeasured: boolean;
  dates: { requestedDate: string; pendingCount: number; picked: number }[];
};

export type DatesCalendar = {
  poolId: string;
  label: string;
  /** The vendor-entered name (Named Calendars), else the label. */
  name: string;
  capacity: number;
  /** What it holds, in words ("Photo & video"). */
  line: string;
  serviceIds: string[];
  categories: { key: string; label: string }[];
};

export function DatesFolds({
  today,
  month,
  open,
  closures,
  closuresIncomplete,
  waitlist,
  calendars,
  ceiling,
  namedCalendars,
  services,
  qrHref,
  actions,
}: {
  today: string;
  month: string;
  /** The fold an action came back to (`?open=`). */
  open: string | null;
  closures: DatesClosure[];
  closuresIncomplete: boolean;
  waitlist: DatesWaitlist;
  calendars: DatesCalendar[];
  /** The plan's most events a day (clamped by the action too). */
  ceiling: number;
  namedCalendars: boolean;
  services: DatesService[];
  qrHref: string;
  actions: {
    removeBlock: Action;
    updateWaitlistSettings: Action;
    pickWaitlistCouple: Action;
    notifyWaitlistSlot: Action;
    updatePoolCapacity: Action;
    createCalendar: Action;
    editCalendar: Action;
    reassignCategoryPool: Action;
  };
}) {
  const back = (fold: string) => (
    <>
      <input type="hidden" name="return_to" value="dates" />
      <input type="hidden" name="return_fold" value={fold} />
      <input type="hidden" name="return_month" value={month} />
    </>
  );
  const capMax = waitlist.unlimited ? 99 : Math.max(waitlist.tierCap, waitlist.grandfathered, 1);

  return (
    <div className="mt-6 border-t border-ink/10" data-dates-folds="">
      {/* ── BLOCK DAYS ── */}
      <div className="border-b border-ink/10" data-dates-fold="block">
        <Fold title="Block days" line={closuresIncomplete ? 'Some couldn’t load — reload to see them all' : blockDaysLine(closures, today)} defaultOpen={open === 'block'} data="dates-block">
          <div className="pb-3">
            {closures.length === 0 ? (
              <p className="py-2 text-[13.5px] text-ink/60">No days blocked ahead. &ldquo;Block a date&rdquo; below closes one.</p>
            ) : (
              closures.map((c) => (
                <DatesRow
                  key={c.blockId}
                  data="closure"
                  lead={<i aria-hidden className="block h-4 w-5 shrink-0 rounded-sm" style={{ backgroundImage: CALENDAR_HATCH }} />}
                  title={c.label}
                  line={`${rangeWords(c.startDate, c.endDate, today)} · ${c.scope}`}
                  end={
                    <ConfirmForm
                      action={actions.removeBlock}
                      title="Open these days again?"
                      confirmLabel="Open them"
                      message={`${rangeWords(c.startDate, c.endDate, today)} becomes bookable on Setnayan again.`}
                    >
                      {back('block')}
                      <input type="hidden" name="block_id" value={c.blockId} />
                      <SupplierSubmit tone="danger" icon={<X aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />} label="Remove" pendingLabel="Removing…" className="icon-only" />
                    </ConfirmForm>
                  }
                />
              ))
            )}
          </div>
        </Fold>
      </div>

      {/* ── WAITLIST ── */}
      <div className="border-b border-ink/10" data-dates-fold="waitlist">
        <Fold
          title="Waitlist"
          line={
            !waitlist.settingsMeasured
              ? 'Couldn’t load your waitlist settings'
              : waitlistLine({ allowed: waitlist.tierCap > 0, on: waitlist.on, dates: waitlist.dates, today })
          }
          defaultOpen={open === 'waitlist'}
          data="dates-waitlist"
        >
          <div className="pb-3">
            {!waitlist.settingsMeasured ? (
              <p role="alert" className="py-2 text-[13.5px] text-ink/70">
                We couldn&rsquo;t read your waitlist settings, so nothing here says what your plan holds. Nothing has changed — reload in a moment.
              </p>
            ) : waitlist.tierCap === 0 ? (
              <DatesRow
                data="waitlist-plan"
                title="See the plans"
                line="A waiting list on full dates comes with the paid plans"
                href="/vendor-dashboard/subscription"
              />
            ) : (
              <>
                {/* The switch IS the submit: it posts the opposite of what it shows (works without script). */}
                <form action={actions.updateWaitlistSettings} className="flex min-h-[60px] items-center gap-3" data-dates-waitlist-switch="">
                  {back('waitlist')}
                  <input type="hidden" name="max_waitlist_acceptances" value={String(waitlist.cap)} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-ink">Hold a waiting list</span>
                    <span className="block text-[13px] text-ink/60">On dates you are full on</span>
                  </span>
                  <button
                    type="submit"
                    role="switch"
                    aria-checked={waitlist.on}
                    aria-label="Hold a waiting list"
                    name="waitlist_enabled"
                    value={waitlist.on ? '' : 'on'}
                    className={SWITCH_BUTTON}
                  >
                    <SwitchTrack on={waitlist.on} />
                  </button>
                </form>
                {waitlist.on ? (
                  waitlist.unlimited ? (
                    <DatesRow data="waitlist-cap" title="How many a date" line="As many as are waiting — no limit on your plan" />
                  ) : (
                    <form action={actions.updateWaitlistSettings} className="flex min-h-[60px] items-center gap-3 border-t border-ink/10" data-dates-waitlist-cap="">
                      {back('waitlist')}
                      <input type="hidden" name="waitlist_enabled" value="on" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-medium text-ink">How many a date</span>
                        <span className="block text-[13px] text-ink/60">
                          {waitlist.grandfathered > 0 ? `You keep ${waitlist.grandfathered}; your plan holds ${waitlist.tierCap}` : `Up to ${waitlist.tierCap} on your plan`}
                        </span>
                      </span>
                      <Counter name="max_waitlist_acceptances" value={waitlist.cap} min={1} max={capMax} label="How many a date" saveAfterMs={900} data="waitlist-cap" />
                    </form>
                  )
                ) : null}
              </>
            )}

            {waitlist.dates.length === 0 ? (
              waitlist.settingsMeasured && waitlist.tierCap > 0 ? <p className="border-t border-ink/10 py-3 text-[13.5px] text-ink/60">No one is waiting on a date right now.</p> : null
            ) : (
              waitlist.dates.map((w) => (
                <div key={w.requestedDate} className="flex min-h-[60px] flex-wrap items-center gap-x-3 gap-y-2 border-t border-ink/10 py-2.5" data-dates-waitlist-date={w.requestedDate}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-ink">{rangeWords(w.requestedDate, w.requestedDate, today)}</span>
                    <span className="block text-[13px] text-ink/60">
                      {formatCount(w.pendingCount)} waiting
                      {waitlist.on ? ` · picked ${waitlist.pickedMeasured ? formatCount(w.picked) : '—'}${waitlist.unlimited ? '' : ` of ${formatCount(waitlist.cap)}`}` : ''}
                    </span>
                  </span>
                  {waitlist.on ? (
                    <form action={actions.pickWaitlistCouple}>
                      {back('waitlist')}
                      <input type="hidden" name="requested_date" value={w.requestedDate} />
                      <SupplierSubmit tone="neutral" icon={<Check aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />} label="Pick" pendingLabel="Picking…" />
                    </form>
                  ) : null}
                  <form action={actions.notifyWaitlistSlot}>
                    {back('waitlist')}
                    <input type="hidden" name="requested_date" value={w.requestedDate} />
                    <SupplierSubmit tone="neutral" icon={<BellRing aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />} label="Tell them" pendingLabel="Telling…" />
                  </form>
                </div>
              ))
            )}
          </div>
        </Fold>
      </div>

      {/* ── CAPACITY ── */}
      <div className="border-b border-ink/10" data-dates-fold="capacity">
        <Fold title="Capacity" line={capacityLine(calendars)} defaultOpen={open === 'capacity'} data="dates-capacity">
          <div className="pb-3">
            {calendars.length === 0 ? (
              <p className="py-2 text-[13.5px] text-ink/60" data-dates-not-set="">
                Not set. {namedCalendars ? 'Make a calendar for the team that does the work.' : 'Add a service — each kind you offer gets its own calendar.'}
              </p>
            ) : (
              calendars.map((c) => (
                // The name opens its sheet OUTSIDE the counter's form — a portalled form inside another form's React
                // tree would hand its submit to the wrong action.
                <div key={c.poolId} className="flex min-h-[60px] items-center gap-3 border-t border-ink/10 first:border-t-0" data-dates-calendar={c.poolId}>
                  <span className="min-w-0 flex-1">
                    {namedCalendars ? (
                      <CalendarSheet
                        pool={{ poolId: c.poolId, name: c.name, capacity: c.capacity, serviceIds: c.serviceIds }}
                        services={services}
                        ceiling={ceiling}
                        createAction={actions.createCalendar}
                        editAction={actions.editCalendar}
                        month={month}
                        trigger={c.label}
                      />
                    ) : (
                      <span className="block truncate text-[15px] font-medium text-ink">{c.label}</span>
                    )}
                    <span className="block truncate text-[13px] text-ink/60">Events a day{c.line ? ` · ${c.line}` : ''}</span>
                  </span>
                  <form action={actions.updatePoolCapacity} className="flex-none">
                    {back('capacity')}
                    <input type="hidden" name="pool_id" value={c.poolId} />
                    <Counter name="capacity" value={c.capacity} min={1} max={Math.max(ceiling, c.capacity)} label={`${c.label} — events a day`} saveAfterMs={900} data="capacity" />
                  </form>
                </div>
              ))
            )}
            {namedCalendars ? (
              <div className="mt-3">
                <CalendarSheet services={services} ceiling={ceiling} createAction={actions.createCalendar} editAction={actions.editCalendar} month={month} />
              </div>
            ) : calendars.length > 1 ? (
              <div className="mt-2" data-dates-share-team="">
                <p className="home-k2 pt-2">Which services share a team</p>
                {calendars.flatMap((c) =>
                  c.categories.map((cat) => (
                    <ShareTeamPick
                      key={cat.key}
                      categoryKey={cat.key}
                      categoryLabel={cat.label}
                      value={c.poolId}
                      pools={calendars.map((p) => ({ poolId: p.poolId, label: p.label }))}
                      moveAction={actions.reassignCategoryPool}
                      month={month}
                    />
                  )),
                )}
              </div>
            ) : null}
          </div>
        </Fold>
      </div>

      {/* ── QR CODES › (frames 10 · 40) ── */}
      <DatesRow
        data="qr"
        lead={<QrCode aria-hidden className="h-5 w-5 shrink-0 text-ink/60" strokeWidth={1.75} />}
        title="QR codes"
        line="Shortlist · Booked, one use"
        href={qrHref}
      />
    </div>
  );
}
