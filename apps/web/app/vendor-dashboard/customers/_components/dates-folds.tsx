import type { ReactNode } from 'react';
import { BadgeCheck, BellRing, CalendarClock, CalendarX2, Check, Clock, Download, MapPin, QrCode, Users, X } from 'lucide-react';
import { Fold } from '@/app/_components/fold';
import { FormCounter } from '@/app/_components/form-counter';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';
import { CALENDAR_HATCH, CALENDAR_PART_STYLE } from '@/lib/calendar-grid';
import { blockDaysLine, capacityLine, closureWords, rangeWords, waitlistLine } from '@/lib/vendor-dates';
import type { DayPart, RepeatRule } from '@/lib/not-available';
import { hallGuests } from '@/lib/vendor-halls';
import { formatCount } from '@/lib/format-number';
import { SupplierSubmit } from '../../_components/supplier-submit';
import { DatesRow, RowTile } from './dates-row';
import { CalendarSheet, HallSheet, ShareTeamPick, type DatesService } from './dates-sheets';

/**
 * 2026-10-14 (owner ✅ "APPROVE" — prototype `datesBody`, plain words): the folds are **Not available** (every
 * closure ahead, repeats first, ✕ asks once, and "Mark days not available" opens the sheet with Repeats + Hours) ·
 * **Waiting list** · **How many a day** (each schedule's counter, and "Approve first" per schedule), then "QR codes ›"
 * and **More settings**: Exact time slots (every plan) and Phone calendar (.ics).
 *
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
  /** "Every schedule" or the one it closes. */
  scope: string;
  /** Not available repeats + hours (2026-10-14). */
  repeat?: RepeatRule;
  repeatUntil?: string | null;
  dayPart?: DayPart;
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
  /** A venue's hall (2026-10-14 🏛) — not limited by the plan's per-day number. */
  isHall?: boolean;
  /** A hall's guests. */
  seated?: number | null;
  standing?: number | null;
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
  slotsHref,
  icsHref,
  approveFirst,
  blockAdd,
  venue = false,
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
  /** Exact time slots live on each card in the Shop (every plan since 2026-10-14). */
  slotsHref: string;
  /** Every booking as a phone-calendar file. */
  icsHref: string;
  /**
   * Every couple's ask already waits for the shop's yes (the lock handshake is on) — "Approve first" is ON for every
   * schedule, shown as a state, never a switch that would change nothing (a fake door).
   */
  approveFirst: boolean;
  /** The "Mark days not available" button + sheet (`BlockDateAdd`, a client island). */
  blockAdd: ReactNode;
  /** The shop is a venue (it sells a venue kind, or has a hall) — it may list its halls (owner 2026-10-14 🏛). */
  venue?: boolean;
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
  // A venue's halls have their own fold; "How many a day" holds the other schedules.
  const halls = calendars.filter((c) => c.isHall);
  const schedules = calendars.filter((c) => !c.isHall);
  const capMax = waitlist.unlimited ? 99 : Math.max(waitlist.tierCap, waitlist.grandfathered, 1);

  return (
    <div className="mt-6 border-t border-ink/10" data-dates-folds="">
      {/* ── NOT AVAILABLE ── */}
      <div className="border-b border-ink/10" data-dates-fold="block">
        <Fold lead={<RowTile><CalendarX2 strokeWidth={1.75} /></RowTile>} title="Not available" line={closuresIncomplete ? 'Some couldn’t load — reload to see them all' : blockDaysLine(closures, today)} defaultOpen={open === 'block'} data="dates-block">
          <div className="pb-3">
            {closures.length === 0 ? (
              <p className="py-2 text-[13.5px] text-ink/60">Nothing marked yet.</p>
            ) : (
              closures.map((c) => (
                <DatesRow
                  key={c.blockId}
                  data="closure"
                  lead={
                    <i
                      aria-hidden
                      className="block h-4 w-5 shrink-0 rounded-sm"
                      style={(c.dayPart ?? 'all_day') === 'all_day' ? { backgroundImage: CALENDAR_HATCH } : CALENDAR_PART_STYLE}
                    />
                  }
                  title={closureWords(c, today)}
                  line={[c.label, (c.repeat ?? 'once') !== 'once' ? (c.repeatUntil ? `until ${rangeWords(c.repeatUntil, c.repeatUntil, today)}` : 'repeats on its own') : '', c.scope].filter(Boolean).join(' · ')}
                  end={
                    <ConfirmForm
                      action={actions.removeBlock}
                      title="Open these days again?"
                      confirmLabel="Open them"
                      message={
                        (c.repeat ?? 'once') !== 'once'
                          ? `This removes “${closureWords(c, today)}” — every one of those days opens again.`
                          : `${rangeWords(c.startDate, c.endDate, today)} becomes bookable on Setnayan again.`
                      }
                    >
                      {back('block')}
                      <input type="hidden" name="block_id" value={c.blockId} />
                      <SupplierSubmit tone="danger" icon={<X aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />} label="Remove" pendingLabel="Removing…" className="icon-only" />
                    </ConfirmForm>
                  }
                />
              ))
            )}
            <div className="mt-2">{blockAdd}</div>
          </div>
        </Fold>
      </div>

      {/* ── WAITLIST ── */}
      <div className="border-b border-ink/10" data-dates-fold="waitlist">
        <Fold
          lead={<RowTile><Clock strokeWidth={1.75} /></RowTile>}
          title="Waiting list"
          line={
            !waitlist.settingsMeasured
              ? 'Couldn’t load your waiting-list settings'
              : waitlistLine({ allowed: waitlist.tierCap > 0, on: waitlist.on, dates: waitlist.dates, today })
          }
          defaultOpen={open === 'waitlist'}
          data="dates-waitlist"
        >
          <div className="pb-3">
            {!waitlist.settingsMeasured ? (
              <p role="alert" className="py-2 text-[13.5px] text-ink/70">
                We couldn&rsquo;t read your waiting-list settings, so nothing here says what your plan holds. Nothing has changed — reload in a moment.
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
                    <span className="block text-[15px] font-medium text-ink">Keep a waiting list</span>
                    <span className="block text-[13px] text-ink/60">For full days</span>
                  </span>
                  <button
                    type="submit"
                    role="switch"
                    aria-checked={waitlist.on}
                    aria-label="Keep a waiting list"
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
                      <FormCounter name="max_waitlist_acceptances" value={waitlist.cap} min={1} max={capMax} label="How many a date" saveAfterMs={900} data="waitlist-cap" />
                    </form>
                  )
                ) : null}
              </>
            )}

            {waitlist.dates.length === 0 ? (
              waitlist.settingsMeasured && waitlist.tierCap > 0 ? <p className="border-t border-ink/10 py-3 text-[13.5px] text-ink/60">Nobody waiting.</p> : null
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

      {/* ── YOUR HALLS (prototype section 9 "Halls setup") — each hall its own schedule with its guests; free on every
          plan; a card says which halls it uses. ── */}
      {venue ? (
        <div className="border-b border-ink/10" data-dates-fold="halls">
          <Fold
            lead={<RowTile><MapPin strokeWidth={1.75} /></RowTile>}
            title="Your halls"
            line={halls.length > 0 ? `${halls.map((h) => h.label).join(' · ')} · free on every plan` : 'Add your first hall · free on every plan'}
            defaultOpen={open === 'capacity'}
            data="dates-halls"
          >
            <div className="pb-3">
              {halls.map((h) => (
                <DatesRow
                  key={h.poolId}
                  data="hall"
                  lead={<RowTile><MapPin strokeWidth={1.75} /></RowTile>}
                  title={<HallSheet hall={{ poolId: h.poolId, name: h.name, capacity: h.capacity, seated: h.seated ?? null, standing: h.standing ?? null }} createAction={actions.createCalendar} editAction={actions.editCalendar} month={month} />}
                  line={hallGuests({ seated: h.seated ?? null, standing: h.standing ?? null }) || 'Add its guests'}
                  badge={{ tone: 'ok', word: 'Free on every plan' }}
                />
              ))}
              <DatesRow
                data="halls-free"
                lead={<RowTile><BadgeCheck strokeWidth={1.75} /></RowTile>}
                title="Halls are free on every plan"
                line="They never count against your plan’s limit"
              />
              <div className="mt-3">
                <HallSheet createAction={actions.createCalendar} editAction={actions.editCalendar} month={month} />
              </div>
            </div>
          </Fold>
        </div>
      ) : null}

      {/* ── HOW MANY A DAY ── (a venue whose schedules are all halls has only Your halls) */}
      {venue && schedules.length === 0 ? null : (
      <div className="border-b border-ink/10" data-dates-fold="capacity">
        <Fold lead={<RowTile><Users strokeWidth={1.75} /></RowTile>} title="How many a day" line={capacityLine(schedules)} defaultOpen={open === 'capacity'} data="dates-capacity">
          <div className="pb-3">
            {schedules.length === 0 ? (
              <p className="py-2 text-[13.5px] text-ink/60" data-dates-not-set="">
                Not set. {namedCalendars ? 'Make a schedule for the team that does the work.' : 'Add a service — each kind you offer gets its own schedule.'}
              </p>
            ) : (
              schedules.map((c) => (
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
                    <span className="block truncate text-[13px] text-ink/60">
                      {c.isHall ? 'A hall · not counted in your plan' : 'At the same time'}
                      {c.line ? ` · ${c.line}` : ''}
                    </span>
                  </span>
                  <form action={actions.updatePoolCapacity} className="flex-none">
                    {back('capacity')}
                    <input type="hidden" name="pool_id" value={c.poolId} />
                    <FormCounter name="capacity" value={c.capacity} min={1} max={Math.max(ceiling, c.capacity)} label={`${c.label} — how many a day`} saveAfterMs={900} data="capacity" />
                  </form>
                </div>
              ))
            )}
            {schedules.length > 0 && approveFirst ? (
              <DatesRow
                data="approve-first"
                lead={<RowTile><Clock strokeWidth={1.75} /></RowTile>}
                title={schedules.length > 1 ? 'Approve first · every schedule' : 'Approve first'}
                line="Couples wait for your yes"
                badge={{ tone: 'ok', word: 'On' }}
              />
            ) : null}
            {schedules.length > 0 ? (
              <p className="pt-2 text-[13px] text-ink/60" data-dates-capacity-note="">
                {schedules.length > 1
                  ? 'Each schedule fills on its own — one can be full while the other is free.'
                  : 'One number for the whole shop. Add a second schedule only if two can run at the same time.'}
              </p>
            ) : null}
            {namedCalendars ? (
              <div className="mt-3">
                <CalendarSheet services={services} ceiling={ceiling} createAction={actions.createCalendar} editAction={actions.editCalendar} month={month} />
              </div>
            ) : schedules.length > 1 ? (
              <div className="mt-2" data-dates-share-team="">
                <p className="home-k2 pt-2">Which services share a schedule</p>
                {schedules.flatMap((c) =>
                  c.categories.map((cat) => (
                    <ShareTeamPick
                      key={cat.key}
                      categoryKey={cat.key}
                      categoryLabel={cat.label}
                      value={c.poolId}
                      pools={schedules.map((p) => ({ poolId: p.poolId, label: p.label }))}
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
      )}

      {/* ── QR CODES › (frames 10 · 40) ── */}
      <DatesRow
        data="qr"
        lead={<RowTile><QrCode strokeWidth={1.75} /></RowTile>}
        title="QR codes"
        line="They scan · they are listed"
        href={qrHref}
      />

      {/* ── MORE SETTINGS (prototype datesBody) ── */}
      <p className="home-k2 mt-6" data-dates-more-settings="">
        More settings
      </p>
      <DatesRow
        data="slots"
        lead={<RowTile><CalendarClock strokeWidth={1.75} /></RowTile>}
        title="Exact time slots"
        line="Fixed times couples pick · on each card in your Shop"
        href={slotsHref}
      />
      <DatesRow
        data="ics"
        lead={<RowTile><Download strokeWidth={1.75} /></RowTile>}
        title="Phone calendar"
        line="Every booking · .ics"
        href={icsHref}
        download
      />
    </div>
  );
}
