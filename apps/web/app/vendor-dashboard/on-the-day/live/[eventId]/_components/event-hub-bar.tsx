'use client';

/**
 * 📌 THE SUPPLIER'S EVENT HUB — its pinned row (supplier dashboard v13, owner "Approved." 2026-10-29; prototype
 * `renderEventHub`: "pinned row: ‹ Exit · 'Event Hub · <event> ▾' LEFT · 💬 (this event's chat) + ⓘ RIGHT · count row
 * Now · Next · Arrived"). The ▾ is the Event Hub's three views as ONE dropdown — On the day · Scanner · Announce — each
 * its own address (`?view=`), so Back works. From 701 the row moves up into the shell's pinned row (the Hub's slot,
 * `[data-pin-lead-hub]`, the same one the Hub ▾ uses); below 701 it leads the page.
 *
 * Draws only: every word and count is handed in by the page, which read them.
 */
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ChevronLeft, MessageSquare } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { Explain } from '@/app/_components/explain';
import { usePinLeadSlot } from '../../../_components/hub-event-menu';
import { EVENT_HUB_VIEWS, EVENT_HUB_VIEW_LABEL, eventHubViewHref, type EventHubView } from '@/lib/event-hub-views';

export function EventHubBar({
  eventId,
  name,
  dayWords,
  view,
  exitHref,
  chatHref,
  about,
}: {
  eventId: string;
  name: string;
  dayWords: string | null;
  view: EventHubView;
  /** Back to the Hub, on this event. */
  exitHref: string;
  /** This event's chat with the hosts, or null when there is no thread. */
  chatHref: string | null;
  /** The ⓘ — the event's details in a sentence (venue · headcount). */
  about: string;
}) {
  const router = useRouter();
  const slot = usePinLeadSlot();
  const face = `Event Hub · ${name}${dayWords ? ` · ${dayWords}` : ''}`;
  const row = (
    <span className="flex min-w-0 items-center gap-1.5" data-event-hub-bar="">
      <Link
        href={exitHref}
        aria-label="Exit the Event Hub"
        className="sn-press grid h-10 w-10 flex-none place-items-center rounded-full bg-ink/[0.05] text-ink"
      >
        <ChevronLeft aria-hidden className="h-5 w-5" strokeWidth={2} />
      </Link>
      <span className="min-w-0">
        <PickMenu
          label="The Event Hub — show"
          value={view}
          buttonText={face}
          options={EVENT_HUB_VIEWS.map((v) => ({ key: v, label: EVENT_HUB_VIEW_LABEL[v] }))}
          compact
          dataAttr="data-event-hub-view"
          onPick={(k) => {
            if (k !== view) router.push(eventHubViewHref(eventId, k as EventHubView), { scroll: false });
          }}
        />
      </span>
      <span className="ml-auto flex flex-none items-center gap-1">
        {chatHref ? (
          <Link
            href={chatHref}
            aria-label="This event’s chat"
            className="sn-press grid h-10 w-10 place-items-center rounded-full bg-ink/[0.05] text-ink"
          >
            <MessageSquare aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />
          </Link>
        ) : null}
        <Explain title={name}>{about}</Explain>
      </span>
    </span>
  );
  return slot ? createPortal(row, slot) : <div className="pb-2">{row}</div>;
}

/**
 * NOW · NEXT · COMING — the count row under the pinned row (prototype `tiles`). Now and Next are the run of show's own
 * (`deriveRunOfShow`, read by the page); Coming is the RSVP headcount — the arrival count is not something a supplier
 * can read yet, so the row says what it does know. A tile that goes nowhere is not framed.
 */
export function EventHubCounts({ tiles }: { tiles: readonly { key: string; value: string; word: string; href?: string; hot?: boolean }[] }) {
  return (
    <div className="grid grid-cols-3 gap-2 pb-3" data-event-hub-counts="">
      {tiles.map((t) => {
        const inner = (
          <>
            <span className={`block truncate text-[19px] font-medium tabular-nums ${t.hot ? 'text-sn-accent' : 'text-ink'}`}>{t.value}</span>
            <span className="block truncate text-[12px] text-ink/60">{t.word}</span>
          </>
        );
        return t.href ? (
          <a key={t.key} href={t.href} className="sn-press block min-h-14 rounded-2xl bg-ink/[0.04] px-3 py-2" data-event-hub-count={t.key}>
            {inner}
          </a>
        ) : (
          <div key={t.key} className="min-h-14 px-3 py-2" data-event-hub-count={t.key}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
