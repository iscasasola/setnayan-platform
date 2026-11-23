import type { ComponentProps, ComponentType, ReactNode, SVGProps } from 'react';
import {
  CalendarClock,
  Camera,
  ChefHat,
  FileCheck2,
  HandHeart,
  ListChecks,
  Music,
  PackageCheck,
  QrCode,
  ScanLine,
  Star,
  Ticket,
  TriangleAlert,
  Truck,
  Users,
  UsersRound,
} from 'lucide-react';
import type { DayOfModuleId } from '@/lib/vendor-dayof-modules';
import type { RunOfShowBlock } from '@/lib/run-of-show';
import type { EventHubView } from '@/lib/event-hub-views';
import { formatCount } from '@/lib/format-number';
import { SupplierSavedStrip } from '@/app/_components/offline-ready/supplier-saved-strip';
import { PartCard, PartList, PartPage, PartRow, PartSec, setTwo } from '../../../../_components/set-two/parts';
import { ReadFailedNote } from '../../../../_components/set-two/read-failed';
import { EventHubBar, EventHubCounts } from './event-hub-bar';
import { FloorClock } from './floor-clock';
import { DayRunOfShow } from './day-run-of-show';

/**
 * THE EVENT DAY — the Hub console beside its tools, in the November look (owner-approved 21 Nov 2026, supplier pages
 * set two, page 8; drawing `prototypes/supplier_pages_set2_2026-11-21/supplier_pages_set2_v2_fable.html` `#p8`).
 *
 * Draws only — every word, count and tool is read by `page.tsx` and handed in, so the lab draws it from fixtures.
 * What reads data of its own arrives as a SLOT the page renders (the march, live reviews, the specialization desk, the
 * Scanner and Announce views). The Hub bar stays one row; under it the three counts are the shared count tiles, the
 * floor clock stays dark (glare), the phone keeps its jump bar, and each tool is one row of one list. On a computer the
 * counts, the clock and the desk sit on the left and the tools on the right.
 *
 * 🔒 THE COUPLE'S PROGRAM IS EITHER READ OR SAID UNREAD (drawing "The couple’s program could not be read"). When
 * `programUnread`, the now/next tiles, the clock line and the Now / Up next card — everything that reads the program —
 * give way to ONE warn note with Try again inside it; the "coming" tile (its own read) stays. Decided before anything
 * that would draw an empty program. 🔒 app/vendor-dashboard/on-the-day/set-two-day-reads-are-honest.test.ts
 */

type Icon = ComponentType<SVGProps<SVGSVGElement> & { strokeWidth?: number | string }>;

/** Each tool's mark — what it is about (the drawing's row icons). */
const TOOL_ICON: Record<DayOfModuleId, Icon> = {
  run_of_show: CalendarClock,
  pax_headcount: Users,
  delivery_handover: HandHeart,
  review_qr: QrCode,
  live_reviews: Star,
  qr_scanner: ScanLine,
  shot_list: ListChecks,
  setlist: Music,
  issues_log: TriangleAlert,
  production_sheet: ChefHat,
  vendor_papic: Camera,
  // 🧰 Hub tools — drawn inline (`hubTools`), never a row; their marks still answer for the jump bar and labs.
  queue_counter: Ticket,
  entourage: UsersRound,
  paperwork_checklist: FileCheck2,
  load_in_and_venue_access: Truck,
  delivery_and_drop_off: PackageCheck,
};

export type DayCount = { key: string; value: string; word: string; href?: string; hot?: boolean };
export type DayTool = { id: DayOfModuleId; label: string; blurb: string; href: string };

export function EventDayBody({
  eventId,
  view,
  bar,
  counts,
  programUnread,
  focal,
  blocks,
  nav,
  genericDomId,
  showRunOfShow,
  march,
  headcount,
  tools,
  reviews,
  hubTools,
  desk,
  otherView,
}: {
  eventId: string;
  view: EventHubView;
  bar: ComponentProps<typeof EventHubBar>;
  /** Now · Next · Coming, as the page derived them. */
  counts: readonly DayCount[];
  /** The couple's program could not be read (`fetchRunOfShowBlocks` answered null) — never the same as an empty one. */
  programUnread: boolean;
  /** The dark focal: who, where, and this phone's saved copy. */
  focal: { coupleName: string; place: string | null; viewer: string; eventDate: string | null; checkin: boolean };
  blocks: RunOfShowBlock[];
  /** The phone's jump bar — every href anchors a section this same render produces. */
  nav: readonly { href: string; label: string }[];
  genericDomId: string;
  showRunOfShow: boolean;
  /** The Wedding March (read-only), or null when nobody walks / it is not this trade's. */
  march: ReactNode;
  /** The headcount row (attending of invited), or null when the module is off. */
  headcount: { attending: number; invited: number } | null;
  tools: readonly DayTool[];
  /** Live reviews, or null when the module is off. */
  reviews: ReactNode;
  /** 🧰 The hub tools switched on for this booking (`HubToolsSection`), or null when none is. */
  hubTools?: ReactNode;
  /** The specialization slot (Song Desk · Emcee script · Floor Command) — its own contents, unchanged; null = none. */
  desk: ReactNode;
  /** The Scanner or Announce view, drawn in place of The Day. */
  otherView: ReactNode;
}) {
  const shownCounts = programUnread ? counts.filter((t) => t.key === 'coming') : counts;
  const tilesBlock = (
    <>
      {programUnread ? (
        <ReadFailedNote mark="program">We couldn&rsquo;t load the couple&rsquo;s program right now.</ReadFailedNote>
      ) : null}
      <EventHubCounts tiles={shownCounts} />
    </>
  );

  return (
    <PartPage column="mx-auto w-full tab:max-w-5xl" mark="event-day">
      <div data-event-hub-view={view}>
        <EventHubBar {...bar} />
        {view !== 'day' ? (
          <>
            {tilesBlock}
            <div className="px-3 pt-2 tab:px-0">{otherView}</div>
          </>
        ) : (
          <div className={setTwo.day}>
            <div className={setTwo.dayCounts}>{tilesBlock}</div>

            {/* The obsidian focal — kept dark on purpose: the one glare-legible anchor on a venue floor.
                `id="schedule"`: where a "Schedule moved" notice lands (lib/schedule-shift-notice.ts) — the clock's
                now/next, on a block that ALWAYS renders, so the link never misses. */}
            <div id="schedule" className={`scroll-mt-4 ${setTwo.dayClockSlot}`}>
              <div className={`sn-tile-dark relative ${setTwo.dayClock}`}>
                {/* 📶 The offline copy's mark (EV3) — this phone's own copy of the Event Hub, for a venue without signal. */}
                <SupplierSavedStrip
                  viewer={focal.viewer}
                  eventId={eventId}
                  eventDate={focal.eventDate}
                  checkin={focal.checkin}
                />
                <p className={setTwo.dayClockName}>{focal.coupleName}</p>
                {focal.place ? (
                  <p className={setTwo.dayClockPlace} style={{ color: 'color-mix(in srgb, var(--sn-gold-100) 72%, transparent)' }}>
                    {focal.place}
                  </p>
                ) : null}
                {programUnread ? null : (
                  <div className={setTwo.dayClockLine}>
                    <FloorClock blocks={blocks} />
                  </div>
                )}
              </div>
            </div>

            {/* The phone's jump bar — only when there are two sections to move between; a computer shows both. */}
            {nav.length > 0 ? (
              <nav aria-label="Console sections" className={setTwo.jump}>
                {nav.map((item) => (
                  <a key={item.href} href={item.href}>
                    {item.label}
                  </a>
                ))}
              </nav>
            ) : null}

            {/* ── THE GENERIC KIT — every supplier, every tier, unchanged ─────────── */}
            <section id={genericDomId} className={`scroll-mt-4 ${setTwo.dayTools}`}>
              {showRunOfShow && !programUnread ? (
                <DayRunOfShow eventId={eventId} blocks={blocks} />
              ) : (
                <PartSec>Your tools</PartSec>
              )}

              {march ? <PartCard>{march}</PartCard> : null}

              {headcount || tools.length > 0 ? (
                <PartList>
                  {headcount ? (
                    <PartRow
                      icon={Users}
                      title={`${formatCount(headcount.attending)} / ${formatCount(headcount.invited)}`}
                      sub="attending · pulled live from RSVPs"
                      mark="headcount"
                    />
                  ) : null}
                  {tools.map((t) => (
                    <PartRow key={t.id} icon={TOOL_ICON[t.id]} title={t.label} sub={t.blurb} href={t.href} wrap mark={t.id} />
                  ))}
                </PartList>
              ) : null}

              {hubTools ?? null}

              {reviews ? <PartCard>{reviews}</PartCard> : null}
            </section>

            {/* ── THE SPECIALIZATION SLOT — the only gated section on this page; its contents are its own ── */}
            {desk ? (
              <div className={setTwo.dayDesk}>
                <PartCard>{desk}</PartCard>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </PartPage>
  );
}
