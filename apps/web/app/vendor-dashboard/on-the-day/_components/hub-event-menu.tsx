'use client';

/**
 * 🗓 HUB ▾ — "Hub · Indalecio & Claire · Dec 18 ▾", the one dropdown that picks which event the Hub sets up (supplier
 * dashboard v13, owner "Approved." 2026-10-29; prototype `pageMenu` for the Hub: Today · Next 7 days · … · "Find an
 * event — name, date, venue"). Every event — the days this shop is booked on AND the events this person runs as the
 * hosts' coordinator (the old fifth tab, folded in: DECISION_LOG 2026-10-29) — is one option; a locked one says so.
 *
 * WHERE IT IS DRAWN: from 701 it moves UP into the pinned row's left (`[data-pin-lead-hub]`, opened by the shell's
 * page menu for the Hub) — the house contract, "the ▾ names the page"; below 701, or where the slot is absent (the dev
 * lab), it is drawn in place at the top of the page. ONE instance, never two copies of the same choice.
 *
 * ⓘ `info` — the event's details (`HubEventInfo`) ride beside the ▾ wherever it is drawn (prototype "Hub ▾ · ⓘ").
 * 🔎 The thumb row's "Find an event to set up" (`HubThumbRow`) opens THIS menu with its words in the menu's own search
 * (`HUB_FIND_EVENT`) — one list of events, never a second finder.
 * 🔒 app/vendor-dashboard/on-the-day/the-hub-is-set-up-per-event.test.ts
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-types';
import { hubDayWords, hubHref, hubMenuGroup, hubRoleWords, type HubEvent, type HubSegment } from '@/lib/hub-events';

/** Past this many events the open list gets its search row (the prototype's "Find an event"). */
const SEARCH_FROM = 8;

/** The thumb row asks the Hub ▾ to open on these words (`CustomEvent<string>` on `window`). */
export const HUB_FIND_EVENT = 'sn:hub-find-event';

export function HubEventMenu({
  events,
  selectedId,
  seg,
  today,
  info = null,
}: {
  /** ⓘ The event's details, beside the ▾ (`HubEventInfo`). */
  info?: ReactNode;
  events: readonly HubEvent[];
  selectedId: string | null;
  seg: HubSegment;
  /** `YYYY-MM-DD`, Manila — for the menu's groups. */
  today: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  // A find from the thumb row keeps the search row up even on a short list, so its words can be seen and changed.
  const [finding, setFinding] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const slot = usePinLeadSlot();
  useEffect(() => {
    const onFind = (ev: Event) => {
      const words = (ev as CustomEvent<string>).detail ?? '';
      setQ(words);
      setFinding(true);
      const face = box.current?.querySelector<HTMLButtonElement>('button[aria-expanded]');
      if (face && face.getAttribute('aria-expanded') !== 'true') face.click();
      requestAnimationFrame(() => box.current?.ownerDocument.querySelector<HTMLInputElement>('[data-hub-event-find]')?.focus());
    };
    window.addEventListener(HUB_FIND_EVENT, onFind);
    return () => window.removeEventListener(HUB_FIND_EVENT, onFind);
  }, []);
  const selected = events.find((e) => e.eventId === selectedId) ?? null;

  const options = useMemo<PickOption[]>(() => {
    const needle = q.trim().toLowerCase();
    return events
      .filter((e) => !needle || `${e.name} ${hubDayWords(e.date, true) ?? ''}`.toLowerCase().includes(needle))
      .map((e) => ({
        key: e.eventId,
        label: e.name,
        group: hubMenuGroup(e, today),
        hint: [hubDayWords(e.date) ?? 'Date not set yet', hubRoleWords(e)].join(' · '),
      }));
  }, [events, q, today]);

  if (events.length === 0) return null;
  const face = selected ? `Hub · ${selected.name}${selected.date ? ` · ${hubDayWords(selected.date)}` : ''}` : 'Hub';
  const menu = (
    <span ref={box} className="flex min-w-0 items-center gap-1" data-hub-event-menu="" data-tour="hub-next-days">
      <span className="min-w-0 flex-1">
      <PickMenu
        label="Which event the Hub sets up"
        value={selectedId}
        buttonText={face}
        options={options}
        compact
        dataAttr="data-hub-event-pick"
        head={
          events.length > SEARCH_FROM || finding ? (
            <li role="none" className="px-2 pb-1">
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Find an event — name or date"
                aria-label="Find an event"
                data-hub-event-find=""
                className="h-10 w-full rounded-full border border-ink/15 bg-white px-3.5 text-[14px] text-ink dark:bg-raised"
              />
            </li>
          ) : undefined
        }
        onPick={(k) => {
          setQ('');
          setFinding(false);
          if (k !== selectedId) router.push(hubHref(k, seg), { scroll: false });
        }}
      />
      </span>
      {info}
    </span>
  );
  return slot ? createPortal(menu, slot) : <div className="pb-2" data-hub-menu-row="">{menu}</div>;
}

/** The width at which the menu lives in the pinned row — the shell's 701 line (`boundary="tab"`). */
const UP_QUERY = '(min-width: 701px)';

/** The pinned row's Hub slot while the window is wide enough for it — else null (the menu is drawn in place). */
function usePinLeadSlot(): HTMLElement | null {
  const [box, setBox] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(UP_QUERY);
    const read = () => setBox(mq.matches ? document.querySelector<HTMLElement>('[data-pin-lead-hub]') : null);
    read();
    mq.addEventListener('change', read);
    return () => mq.removeEventListener('change', read);
  }, []);
  return box;
}
