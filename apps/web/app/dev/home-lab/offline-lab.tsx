'use client';

/**
 * /dev/home-lab?view=offline — 📶 EV3's three surfaces on fixture data, every state by query (no phone storage, no
 * database). DEV-ONLY with the rest of home-lab (production builds 404 it).
 *   &state=ok|amber|nosignal|failed|saving|none|unsupported   the saved mark (default ok)
 *   &browser=1                                                a plain browser tab (shows "use the Setnayan app…")
 *   &desk=notes|sent                                          the Check-in desk's "Needs a look" / "Back online · N sent"
 * The desk is the REAL `CheckinDesk` with a stand-in queue (it keeps scans in memory; "send" empties it) — so a walk can
 * go offline (Playwright `setOffline`) and press Mark arrived, and come back online, without any database.
 */
import { useMemo } from 'react';

import { CheckinDesk, type DeskGuest } from '@/app/dashboard/[eventId]/guests/checkin/_components/checkin-desk';
import { ReadyForNoSignalView, type ReadyRow } from '@/app/_components/offline-ready/ready-for-no-signal';
import { SupplierSavedStripView } from '@/app/_components/offline-ready/supplier-saved-strip';
import { savedMark, type SavedPhase } from '@/lib/offline-copies';
import type { CheckinNote } from '@/lib/offline/checkin-queue';

const E = '0e0e0e0e-0000-4000-8000-000000000001';
const VIEWER = 'lab-viewer-0001';
const HOUR = 3_600_000;

const GUESTS: DeskGuest[] = [
  ['g1', 'Jose Santos', 'T4', 'c0ffee00000000000000000000000001'],
  ['g2', 'Maria Clara Reyes', 'T4', 'c0ffee00000000000000000000000002'],
  ['g3', 'Andres Bonifacio', 'T7', 'c0ffee00000000000000000000000003'],
  ['g4', 'Gabriela Silang', null, 'c0ffee00000000000000000000000004'],
].map(([id, name, table, token]) => ({
  guestId: id as string,
  name: name as string,
  side: 'both',
  role: 'guest',
  rsvpStatus: 'attending',
  photoUrl: null,
  plusOneNames: [],
  qrToken: token as string,
  tableLabel: (table as string | null) ?? null,
}));

function stubQueue(desk: string | undefined) {
  const items = new Map<string, { itemId: string; guestId: string; scannedAt: string }>();
  let notes: CheckinNote[] =
    desk === 'notes'
      ? [
          { viewer: VIEWER, eventId: E, guestId: 'g2', name: 'Maria Clara Reyes', scannedAt: new Date().toISOString(), kind: 'already', detail: 'Already checked in at 3:02 PM — that earlier time is kept.' },
          { viewer: VIEWER, eventId: E, guestId: 'g3', name: 'Andres Bonifacio', scannedAt: new Date().toISOString(), kind: 'refused', detail: 'Not confirmed yet — the couple hasn’t accepted this request.' },
        ]
      : [];
  if (desk === 'sent') items.set('g3', { itemId: 'i-g3', guestId: 'g3', scannedAt: new Date(Date.now() - 20 * 60_000).toISOString() });
  let n = 0;
  return {
    queueCheckin: async (i: { guestId: string }) => {
      const q = { itemId: `i${++n}`, guestId: i.guestId, scannedAt: new Date().toISOString() };
      items.set(i.guestId, q);
      return q;
    },
    queuedCheckins: async () => [...items.values()],
    unqueueCheckin: async (itemId: string) => {
      for (const [k, v] of items) if (v.itemId === itemId) items.delete(k);
    },
    sendQueuedCheckins: async () => {
      const sent = items.size;
      items.clear();
      return sent;
    },
    readCheckinNotes: () => notes,
    dismissCheckinNote: (_v: string, _e: string, guestId: string) => {
      notes = notes.filter((x) => x.guestId !== guestId);
    },
  };
}

export function OfflineLab({ state, browser, desk }: { state?: string; browser?: string; desk?: string }) {
  const now = useMemo(() => Date.now(), []);
  const phase: SavedPhase = state === 'failed' ? 'failed' : state === 'saving' ? 'saving' : state === 'none' ? 'none' : state === 'unsupported' ? 'unsupported' : 'saved';
  const savedAt = state === 'none' || state === 'unsupported' ? null : state === 'amber' ? now - 9 * HOUR : now - 40 * 60_000;
  const mark = savedMark({ phase, savedAt, now, online: state !== 'nosignal', eventDay: true });
  const installed = browser !== '1';
  const canUpdate = state !== 'saving' && state !== 'nosignal' && state !== 'unsupported';
  const rows: ReadyRow[] = [
    { key: 'guests', label: 'Guest list', value: '131', ok: true },
    { key: 'seats', label: 'Seat plan', value: '16 tables', ok: true },
    { key: 'run', label: 'Run of show', value: state === 'failed' ? null : '24 moments', ok: state !== 'failed' },
    { key: 'desk', label: 'Check-in desk', value: 'Ready', ok: true },
  ];
  const queue = useMemo(() => {
    const q = stubQueue(desk);
    return () => Promise.resolve(q as never);
  }, [desk]);
  return (
    <div className="mx-auto min-h-screen w-full max-w-xl space-y-8 bg-cream px-4 pb-28 pt-4" data-lab-offline="">
      <section aria-label="Coordinator · Home › Today">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">Coordinator · Home › Today</p>
        <ReadyForNoSignalView
          eventId={E}
          checkin
          host={state !== 'nohost'}
          rows={rows}
          mark={mark}
          busy={state === 'saving'}
          canUpdate={canUpdate}
          installed={installed}
          onUpdate={() => undefined}
        />
      </section>
      <section aria-label="Supplier · Hub › the event card">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">Supplier · Hub › the event card</p>
        <div className="sn-tile-dark sn-bloom p-5">
          <SupplierSavedStripView mark={mark} busy={state === 'saving'} canUpdate={canUpdate} installed={installed} onUpdate={() => undefined} />
          <p className="truncate text-lg font-semibold">Cale &amp; Ice</p>
          <p className="mt-0.5 truncate text-sm" style={{ color: 'rgba(251,251,250,0.62)' }}>Saturday, November 14, 2026 · Souvenirs</p>
        </div>
      </section>
      <section aria-label="Check-in desk">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">Check-in desk (Hub › Scan for a coordinator)</p>
        <CheckinDesk eventId={E} viewer={VIEWER} guests={GUESTS} initialCheckins={[{ guestId: 'g1', checkedInAt: new Date(now - 30 * 60_000).toISOString() }]} expected={4} queue={queue} />
      </section>
    </div>
  );
}
