import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, ChevronRight, Lock, Play } from 'lucide-react';
import { PillLink, PillTrack } from '@/app/_components/pill-track';
import { Explain } from '@/app/_components/explain';
import { SupplierColumns } from '../../_components/supplier-columns';
import {
  HUB_SEGMENTS,
  HUB_SEGMENT_LABEL,
  hubDayWords,
  hubHref,
  hubRoleWords,
  type HubEvent,
  type HubLock,
  type HubSegment,
} from '@/lib/hub-events';
import type { RunOfShowBlock } from '@/lib/run-of-show';
import { HUB_OPEN_WINDOW_PLAIN } from '@/lib/vendor-day-picker';
import { formatWallClock } from '@/lib/schedule-datetime-local';
import { ActionButton } from '@/components/action-button';

/**
 * 🗓 THE SUPPLIER'S HUB — SET UP (supplier dashboard v13, owner "Approved." 2026-10-29; prototype `renderHub`:
 * "HUB = SETUP, like the Maker: pick one event; Set up its tools · Crew (+ QR) · the event's own pages. The day itself
 * runs on the supplier's EVENT HUB — the live page vendor-dashboard/on-the-day/live/[eventId], no new shell").
 *
 *   · the Hub ▾ picks the event (`HubEventMenu`, in the pinned row from 701);
 *   · Set up · Crew · The event's pages — one segmented control, each its own address (`?seg=`), so Back works;
 *   · the right column (from 701) is the event card + "Open the Event Hub" — never empty; on a phone the same card
 *     leads the page (the prototype stacks it above the segment's body). ONE card per width, never both drawn.
 *
 * Draws only — every value is read by the page and handed in. 🔒 on-the-day/the-hub-is-set-up-per-event.test.ts
 */
export function HubScreen({
  menu,
  event,
  seg,
  pane,
  children,
}: {
  /** The Hub ▾ (`HubEventMenu`). */
  menu: ReactNode;
  event: HubEvent;
  seg: HubSegment;
  /** The event card (`HubEventCard`) — the right column from 701, the page's top on a phone. */
  pane: ReactNode;
  /** The segment's body. */
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl tab:max-w-none" data-hub-screen={seg}>
      <div className="px-4 pt-3 sm:px-6 tab:px-0 tab:pt-0">{menu}</div>
      <SupplierColumns
        name="hub"
        paneLabel={`${event.name} · the day`}
        list={
          <div className="px-4 pb-28 sm:px-6 tab:px-4 tab:pt-3">
            {/* 📱 The phone's copy of the card: the pane is not drawn below 701, so the card leads the page there. */}
            <div className="tab:hidden" data-hub-card-phone="">
              {pane}
            </div>
            <HubSegments eventId={event.eventId} on={seg} />
            <div className="pt-2">{children}</div>
          </div>
        }
        pane={
          <div className="space-y-3 px-4 py-3" data-hub-pane="">
            <p className="text-[15px] font-semibold text-ink">The Day</p>
            {pane}
          </div>
        }
      />
    </div>
  );
}

/** Set up · Crew · The event's pages — each a link to its own address (the Shop / Customers shape). */
export function HubSegments({ eventId, on }: { eventId: string; on: HubSegment }) {
  return (
    <PillTrack as="nav" grow aria-label="Hub views" data-hub-segmented="" className="mt-3 w-full">
      {HUB_SEGMENTS.map((s) => (
        <PillLink
          key={s}
          on={s === on}
          href={hubHref(eventId, s)}
          scroll={false}
          aria-current={s === on ? 'page' : undefined}
          data-hub-seg={s}
          className="h-11 min-h-11 text-[13.5px]"
        >
          {HUB_SEGMENT_LABEL[s]}
        </PillLink>
      ))}
    </PillTrack>
  );
}

/**
 * The event card — "YOU RUN IT · COORDINATOR / Indalecio & Claire · Wedding / Fri Dec 18, 2026 · Seda Vertis North" —
 * and the ONE way into the day: "Open the Event Hub" on the day itself (the live page opens only then — its own gate),
 * else the day it opens. A locked event offers no way in; its lock is said in Set up with the way to pay.
 */
export function HubEventCard({
  event,
  title,
  place,
  saved,
}: {
  event: HubEvent;
  /** "Indalecio & Claire · Wedding" — the brief's name when read, else the row's. */
  title: string;
  place: string | null;
  /** 📶 The offline copy's mark (`SupplierSavedStrip`) — only for a day this shop works and may open. */
  saved?: ReactNode;
}) {
  const day = hubDayWords(event.date, true);
  const open = event.booked && event.when === 'today' && !event.lock;
  return (
    <div className="space-y-2" data-hub-card={event.eventId}>
      <div className="sn-tile-dark rounded-2xl p-4">
        {saved}
        <p className="text-[11.5px] font-medium uppercase tracking-[0.12em]" style={{ color: 'rgba(251,251,250,0.62)' }}>
          {hubRoleWords(event)}
        </p>
        <p className="mt-1 truncate text-[19px] font-medium leading-snug" style={{ color: 'var(--m-paper)' }}>
          {title}
        </p>
        <p className="mt-0.5 truncate text-[13.5px]" style={{ color: 'rgba(251,251,250,0.72)' }}>
          {[day ?? 'Date not set yet', place].filter(Boolean).join(' · ')}
        </p>
      </div>
      {open ? (
        <div className="[&>a]:w-full" data-hub-open="">
          <ActionButton
            tone="brand"
            main
            icon={<Play aria-hidden strokeWidth={1.9} />}
            label="Open the Event Hub"
            href={`/vendor-dashboard/on-the-day/live/${event.eventId}`}
            tour="hub-day-launch"
          />
        </div>
      ) : (
        <p className="text-[13px] text-ink/65" data-hub-opens="">
          {event.lock
            ? 'Opens once the booking fee is paid — see Set up.'
            : !event.booked
              ? 'Your shop is not booked for a day on it — set up happens in their event.'
              : event.when === 'past'
                ? 'This day is over.'
                : `The Event Hub opens here on ${day ?? 'the day'} — ${HUB_OPEN_WINDOW_PLAIN}.`}
        </p>
      )}
      <p className="text-[13px] leading-relaxed text-ink/60">
        The Event Hub is its own page for this event — only your tools for the day. Set up here feeds it.
      </p>
    </div>
  );
}

/**
 * 🔒 A LOCKED EVENT — the gate's own sentence and the bill's link, and NO tools: the lock is a door, not a label (the
 * shipped picker's rule, owner "Yes to all" 2026-10-21 item 5). The words and the amount are the gate's (`feeLockCopy`).
 */
export function HubLockRow({ lock }: { lock: HubLock }) {
  return (
    <div className="space-y-2 border-b border-ink/10 py-3" data-hub-day-locked="">
      <p className="flex items-center gap-2 text-[15px] font-medium text-ink">
        <Lock aria-hidden className="h-4 w-4 text-ink/60" strokeWidth={1.9} />
        Locked
      </p>
      <p className="text-[13.5px] text-ink/70">{lock.headline}</p>
      {lock.cta ? <ActionButton tone="brand" main icon={<ArrowRight aria-hidden strokeWidth={1.9} />} label={lock.cta} href={lock.payHref} /> : null}
    </div>
  );
}

/**
 * RUN OF SHOW — the first moments of the day, read from the couple's schedule (`fetchRunOfShowBlocks`), with "N more"
 * into the whole day. Null = the read was refused: it says so, never "nothing planned".
 */
export function HubRunOfShow({ blocks, moreHref }: { blocks: readonly RunOfShowBlock[] | null; moreHref: string | null }) {
  const shown = (blocks ?? []).slice(0, 4);
  const rest = (blocks?.length ?? 0) - shown.length;
  return (
    <div data-hub-ros="">
      <HubEyebrow about="Edited by the hosts before the day; on the day it runs on the Event Hub, where you can move, hold or cancel a moment.">
        Run of show
      </HubEyebrow>
      {blocks == null ? (
        <p className="py-3 text-[14px] text-ink/65">Couldn’t load the run of show — open their schedule to see it.</p>
      ) : shown.length === 0 ? (
        <p className="py-3 text-[14px] text-ink/65">No moments yet — the hosts have not built their schedule.</p>
      ) : (
        shown.map((b) => (
          <div key={b.block_id} className="grid min-h-12 grid-cols-[72px_minmax(0,1fr)] items-center gap-3 border-b border-ink/10 py-2">
            <span className="text-[13.5px] tabular-nums text-ink/65">{formatWallClock(b.start_at) || '—'}</span>
            <span className="min-w-0">
              <span className="block truncate text-[14.5px] text-ink">{b.label}</span>
              {b.location ? <span className="block truncate text-[12.5px] text-ink/60">{b.location}</span> : null}
            </span>
          </div>
        ))
      )}
      {rest > 0 && moreHref ? (
        <Link href={moreHref} className="sn-press flex min-h-11 items-center justify-between gap-2 py-2 text-[14px] text-ink/70">
          <span>{rest} more · the whole day</span>
          <ChevronRight aria-hidden className="h-4 w-4 text-sn-accent" strokeWidth={2} />
        </Link>
      ) : null}
    </div>
  );
}

/** A door row — the name, its one line, the terracotta arrow. The whole row is the tap. */
export function HubDoorRow({ href, label, line, data }: { href: string; label: string; line: string; data?: string }) {
  return (
    <Link href={href} data-hub-door={data ?? ''} className="sn-press flex min-h-12 items-center gap-3 border-b border-ink/10 py-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-medium text-ink">{label}</span>
        <span className="block truncate text-[12.5px] text-ink/60">{line}</span>
      </span>
      <ChevronRight aria-hidden className="h-4 w-4 flex-none text-sn-accent" strokeWidth={2} />
    </Link>
  );
}

/** The small capitals over a list, with its ⓘ — the title and one line on the page, the rest behind the ⓘ. */
export function HubEyebrow({ children, about }: { children: string; about?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 pt-4">
      <p className="home-k2">{children}</p>
      {about ? <Explain title={children}>{about}</Explain> : null}
    </div>
  );
}
