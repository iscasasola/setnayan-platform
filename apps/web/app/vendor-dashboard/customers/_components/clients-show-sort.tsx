'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChosenRow } from '@/app/_components/form-row';
import { ShowSortSheet, ShowSortTopic } from '@/app/_components/show-sort-sheet';
import { FilterFace } from '@/app/dashboard/[eventId]/guests/_components/guests-filter-menu';
import { formatCount } from '@/lib/format-number';
import {
  CLIENTS_GROUP,
  CLIENTS_SHOW,
  CLIENTS_SORT,
  CLIENTS_STATUS,
  CLIENTS_SHOWING_EVENT,
  CLIENTS_SHOW_EVENT,
  NO_SEAT,
  clientsChoiceApplied,
  clientsChoiceParams,
  type ClientsChoice,
} from '../clients-show-sort';


const ALL = '*';

/**
 * ⇅ THE CLIENTS LIST'S SHOW & SORT (v113; spec §9 #7) — the Guests sheet's frame (`ShowSortSheet`) with the Clients
 * rows: Show · Service ▾ · Status · Client · Handled by, then Group by and Sort.
 *
 *   · SHOW shows a list the page already drew, in place — no request (the pinned row hears `CLIENTS_SHOW_EVENT`).
 *   · Every other row rides the address (`clients-show-sort.ts`): the page narrows and orders the WHOLE roster before
 *     paging, so a pick never hides an event that sits on page 2. The page stays where it is (`scroll: false`).
 *   · HANDLED BY: owners and admins pick All seats · Me · each seat · Not given to a seat; an agent sees the v113 line
 *     "Your clients only" instead of a choice. A team that could not be read says so — never an empty list of seats.
 *
 * 🔒 customers/the-clients-list-is-v113.test.ts
 */
export function ClientsShowSort({
  choice,
  initialShow,
  services,
  clients,
  seats,
  agent,
  shown,
  keep,
}: {
  choice: ClientsChoice;
  initialShow: string | null;
  /** The shop's services, by id (Service ▾). */
  services: readonly { key: string; label: string }[];
  /** Every event on the roster (Client). */
  clients: readonly { key: string; label: string }[];
  /** The team's seats; null = the team could not be read. */
  seats: readonly { key: string; label: string }[] | null;
  agent: boolean;
  /** How many events the list holds now — "Show N clients". */
  shown: number;
  /** Every other param of the address, kept (`?q=` …). */
  keep: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [show, setShow] = useState<string>(initialShow ?? 'all');
  useEffect(() => {
    const on = (e: Event) => setShow((e as CustomEvent<string | null>).detail ?? 'all');
    window.addEventListener(CLIENTS_SHOWING_EVENT, on);
    return () => window.removeEventListener(CLIENTS_SHOWING_EVENT, on);
  }, []);

  const go = (next: ClientsChoice) => {
    const params = new URLSearchParams(keep);
    for (const k of ['svc', 'st', 'client', 'who', 'group', 'sort', 'page']) params.delete(k);
    for (const [k, v] of clientsChoiceParams(next)) params.set(k, v);
    const qs = params.toString();
    router.push(`/vendor-dashboard/customers${qs ? `?${qs}` : ''}#customers`, { scroll: false });
  };
  const pickShow = (k: string) => {
    setShow(k);
    window.dispatchEvent(new CustomEvent(CLIENTS_SHOW_EVENT, { detail: k === 'all' ? null : k }));
  };
  const applied = clientsChoiceApplied(choice, agent) + (show !== 'all' ? 1 : 0);
  const on = applied > 0;

  return (
    <>
      <button
        type="button"
        aria-label="Show and sort"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink"
        data-thumb-sort=""
        data-tour="customers-sort"
      >
        <FilterFace on={on} />
      </button>
      {open ? (
        <ShowSortSheet
          onClose={() => setOpen(false)}
          titleId="clients-filter-sheet-title"
          applied={applied}
          rows="clients-filter"
          rootClassName="fixed inset-0 z-sn-pop"
          panelData={{ 'data-filter-sheet': 'clients' }}
          onClearAll={() => {
            pickShow('all');
            go({ svc: null, st: null, client: null, who: null, group: 'status', sort: 'waiting' });
          }}
          showLabel={`Show ${formatCount(shown)} ${shown === 1 ? 'client' : 'clients'}`}
        >
          <ShowSortTopic name="Who you see" first />
          <ChosenRow data="clients-show" name="Show" line="Which list is on screen" value={show} options={CLIENTS_SHOW} onPick={pickShow} dataAttr="data-clients-show" />
          {services.length > 1 ? (
            <ChosenRow
              data="clients-service"
              name="Service"
              line="Service shows booked clients only"
              value={choice.svc ?? ALL}
              options={[{ key: ALL, label: 'All services' }, ...services]}
              onPick={(k) => go({ ...choice, svc: k === ALL ? null : k })}
              dataAttr="data-clients-service"
            />
          ) : null}
          <ChosenRow
            data="clients-status"
            name="Status"
            line="Where each event stands"
            value={choice.st ?? ALL}
            options={[{ key: ALL, label: 'Every status' }, ...CLIENTS_STATUS]}
            onPick={(k) => go({ ...choice, st: k === ALL ? null : (k as ClientsChoice['st']) })}
            dataAttr="data-clients-status"
          />
          <ChosenRow
            data="clients-client"
            name="Client"
            line="One event only"
            value={choice.client ?? ALL}
            options={[{ key: ALL, label: 'All events' }, ...clients]}
            onPick={(k) => go({ ...choice, client: k === ALL ? null : k })}
            dataAttr="data-clients-client"
          />
          {agent ? (
            <p className="border-t border-ink/10 py-3 text-[14px]" data-clients-seat="agent">
              <span className="font-semibold text-ink">Your clients only</span>
              <span className="block text-[13px] text-ink/70">You see the clients the shop gave you. The owner sees every seat.</span>
            </p>
          ) : seats === null ? (
            <p role="status" className="border-t border-ink/10 py-3 text-[13px] text-ink/70" data-clients-seat="unread">
              Handled by: your team couldn’t load, so every seat is shown.
            </p>
          ) : seats.length > 0 ? (
            <ChosenRow
              data="clients-seat"
              name="Handled by"
              line="Whose clients"
              value={choice.who ?? ALL}
              options={[{ key: ALL, label: 'All seats' }, { key: 'me', label: 'Me' }, ...seats, { key: NO_SEAT, label: 'Not given to a seat' }]}
              onPick={(k) => go({ ...choice, who: k === ALL ? null : k })}
              dataAttr="data-clients-seat"
            />
          ) : null}
          <ShowSortTopic name="How it is laid out" />
          <ChosenRow
            data="clients-group"
            name="Group by"
            line="The headings of the list"
            value={choice.group}
            options={CLIENTS_GROUP.filter((g) => g.key !== 'seat' || (!agent && seats !== null && seats.length > 0))}
            onPick={(k) => go({ ...choice, group: k as ClientsChoice['group'] })}
            dataAttr="data-clients-group"
          />
          <ChosenRow
            data="clients-sort"
            name="Sort"
            line="The order inside each heading"
            value={choice.sort}
            options={CLIENTS_SORT}
            onPick={(k) => go({ ...choice, sort: k as ClientsChoice['sort'] })}
            dataAttr="data-clients-sort"
          />
        </ShowSortSheet>
      ) : null}
    </>
  );
}
