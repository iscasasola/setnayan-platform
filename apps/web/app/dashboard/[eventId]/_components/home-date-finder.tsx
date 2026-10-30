'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DATE_FINDER_PARAM, dateFinderHref } from '@/lib/home-date-finder';

/** THE shipped date sheet — Suppliers' date chip opens this same one (`fact-line.tsx`). Loaded only when opened. */
const FactSheet = dynamic(() => import('../vendors/_components/fact-sheets').then((m) => m.FactSheet), { ssr: false });

/**
 * 📅 HOME › THE DATE FINDER, IN PLACE (owner 2026-10-30: *"date finder. because we want them to find the date for their
 * event"*). The Countdown — the phone tile and the desktop card alike — links to `dateFinderHref`; on Home this catches
 * that tap (capture phase, before the link navigates) and opens Suppliers' own date sheet on **Help me choose**. A set
 * date is shown by the sheet's own UI. Arriving with `?date=find` (a link from elsewhere) opens it with the page; closing
 * drops the word from the address without a navigation. A save made while it was open owes Home ONE redraw, paid at
 * close — the same rule `fact-line.tsx` keeps. The couple's only (the Countdown's door for a helper is Event Details).
 */
export function HomeDateFinder({ eventId, openAtFirst = false }: { eventId: string; openAtFirst?: boolean }) {
  const [open, setOpen] = useState(openAtFirst);
  const router = useRouter();
  const owed = useRef(false);
  const href = dateFinderHref(eventId);

  useEffect(() => {
    if (openAtFirst) setOpen(true);
  }, [openAtFirst]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (!a || a.getAttribute('href') !== href) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener('click', onClick, true);
    return () => window.removeEventListener('click', onClick, true);
  }, [href]);

  const close = () => {
    setOpen(false);
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has(DATE_FINDER_PARAM)) {
        url.searchParams.delete(DATE_FINDER_PARAM);
        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
      }
    } catch {
      /* the address keeps its word; the sheet is closed either way */
    }
    if (owed.current) {
      owed.current = false;
      // one-render: keep (no-revalidate) — a date saved to the draft revalidates nothing; one re-read when the sheet closes.
      router.refresh();
    }
  };

  return open ? (
    <FactSheet
      eventId={eventId}
      which="date"
      helpFirst
      priced={[]}
      onWrote={() => {
        owed.current = true;
      }}
      onClose={close}
    />
  ) : null;
}
