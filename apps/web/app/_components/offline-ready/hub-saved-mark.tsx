'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { ActionButton } from '@/components/action-button';
import {
  COPY_VIEWER_ATTR,
  GUEST_HUB_TABS_KEPT,
  guestHubSavePaths,
  offlineEventDay,
  savedMark,
  type SavedMark,
} from '@/lib/offline-copies';

import { SavedMarkLine } from './saved-mark-line';
import { useOfflineCopy } from './use-offline-copy';

/**
 * 📶 R18 — THE EVENT HUB, SAVED FOR ITS GUEST (owner 2026-11-24; DECISION_LOG R18, "Offline goes live in pieces: the
 * Event Hub first"). Mounted at the top of every Event Hub page a guest can keep — the hub's own pages (`app/[slug]/
 * page.tsx`) and its rooms (seat and table, E-Gifts, the guest list) — only for the page's OWN viewer
 * (`guestCopyViewer`). It does three things, all with the shipped pieces:
 *   1. 🔒 the seal — `data-sn-copy-viewer="<viewer>"`, drawn on the server, so the worker keeps this page only for the
 *      viewer it was drawn for (a rotated QR or a removed guest draws a stranger's page, without it);
 *   2. the save — opened with signal inside the window (T-3 days → the day after), it asks the worker for EVERY page the
 *      guest can open (`guestHubSavePaths`: the arrival page, Me, the tabs the guest's own bar offers, every room and
 *      the announcement's answer — the worker skips a copy saved < 30 min ago, and records a room the guest cannot open
 *      as theirs-not, never as failed);
 *   3. the mark — `savedMark` / `SavedMarkLine`, the approved 28 Oct words ("Saved for offline · updated 6:40 PM"; amber
 *      after 3 h on the day: "Saved 4 hours ago · update before you leave for the venue"), speaking for the whole saved
 *      hub (its OLDEST page). When a save did not land it says so, with the one "Update now" its words point to.
 * `draw={false}` keeps 1 and 2 and draws no line — Me, whose "Your schedule" already wears its own mark.
 */
export function HubSavedMark({
  viewer,
  base,
  eventDate,
  eventEndDate = null,
  draw = true,
}: {
  viewer: string;
  /** The event's bare hub address, `/<event>` (`guestHubBase`) — the copy's key whichever address form is on screen. */
  base: string;
  eventDate: string | null;
  eventEndDate?: string | null;
  draw?: boolean;
}) {
  // The tabs the guest's own bar offers — read once the page is whole (the bar is drawn last), so the first save asks
  // for exactly the pages this guest can open. Until then nothing is saved: the mark reads the phone's copy only.
  const [barTabs, setBarTabs] = useState<string[] | null>(null);
  useEffect(() => {
    const read = () => setBarTabs(readBarTabs(base));
    if (document.readyState === 'complete') read();
    else {
      window.addEventListener('load', read, { once: true });
      return () => window.removeEventListener('load', read);
    }
    return undefined;
  }, [base]);

  const copy = useOfflineCopy({
    viewer,
    eventId: base.slice(1),
    eventDate,
    eventEndDate,
    paths: guestHubSavePaths(base, barTabs ?? []),
    auto: barTabs !== null,
  });
  const mark =
    draw && copy.open
      ? savedMark({
          phase: copy.phase,
          savedAt: copy.savedAt,
          now: copy.now,
          online: copy.online,
          eventDay: offlineEventDay(eventDate, copy.now, eventEndDate),
          onCopy: copy.onCopy,
          stale: copy.stale,
        })
      : null;
  const retry = mark !== null && copy.online && copy.onCopy === null && copy.phase === 'failed';
  return (
    <HubSavedMarkView
      viewer={viewer}
      mark={mark}
      busy={copy.phase === 'saving'}
      onUpdate={retry ? () => void copy.update() : null}
    />
  );
}

/** What the mark draws — every state passed in (the lab draws each one). `mark` null = no line, the seal only. */
export function HubSavedMarkView({
  viewer,
  mark,
  busy,
  onUpdate = null,
}: {
  viewer: string;
  mark: SavedMark | null;
  busy: boolean;
  /** "Update now" — only after a save that did not land, with signal. */
  onUpdate?: (() => void) | null;
}) {
  const seal = { [COPY_VIEWER_ATTR]: viewer };
  if (!mark) return <div data-hub-saved="" {...seal} hidden />;
  return (
    <div data-hub-saved="" {...seal} className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 pt-3">
      <SavedMarkLine mark={mark} busy={busy} />
      {onUpdate ? <ActionButton tone="neutral" quiet icon={RefreshCw} label="Update now" onClick={onUpdate} /> : null}
    </div>
  );
}

/** The `?tab=` pages the guest's bar links to on this event (`/<event>` or `/{username}/<event>`), kept ones only. */
function readBarTabs(base: string): string[] {
  const kept = new Set<string>(GUEST_HUB_TABS_KEPT);
  const out = new Set<string>();
  for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
    try {
      const u = new URL(a.getAttribute('href') ?? '', window.location.href);
      const tab = u.searchParams.get('tab');
      if (u.origin !== window.location.origin || !tab || !kept.has(tab)) continue;
      if (u.pathname === base || u.pathname.endsWith(base)) out.add(tab);
    } catch {
      // Not an address.
    }
  }
  return [...out];
}
