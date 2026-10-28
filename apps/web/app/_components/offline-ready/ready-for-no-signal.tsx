'use client';

import { ChevronDown, Printer, RefreshCw } from 'lucide-react';

import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { coordinatorOfflinePaths, savedMark, type SavedMark } from '@/lib/offline-copies';

import { SavedMarkLine } from './saved-mark-line';
import { useOfflineCopy } from './use-offline-copy';

/** One "what is saved" row. `value` null = the read was refused — said so, never drawn as ✓ or as zero. */
export type ReadyRow = { key: string; label: string; value: string | null; ok: boolean };

/**
 * 📶 READY FOR NO SIGNAL — coordinator Home › Today, on the event day only (EV3, owner-approved 2026-10-28,
 * DECISION_LOG "OFFLINE SAVING IS ALWAYS ON"; prototype claude.ai/artifact/KeAoiB3WoQRH1fqG9hoKzw frame "Coordinator ·
 * Home tab"). The saved mark (amber when old), what is on this phone, Update now, Print (check-in list + seat chart —
 * one dropdown, the house rule for a set of choices), and the works / waits fold. No switch, no question: always on.
 *
 * Title + one short line visible; the rest in the ⓘ. No frame — dividers between topics; only the buttons are framed.
 */
export function ReadyForNoSignal({
  viewer,
  eventId,
  eventDate,
  eventEndDate = null,
  checkin,
  host,
  rows,
}: {
  viewer: string;
  eventId: string;
  eventDate: string | null;
  eventEndDate?: string | null;
  /** This viewer runs the door (couple / coordinator with the guest list): the Check-in desk is kept too. */
  checkin: boolean;
  /** A host of the event — the only one the check-in list (the guest registry PDF) prints for. */
  host: boolean;
  rows: readonly ReadyRow[];
}) {
  const copy = useOfflineCopy({ viewer, eventId, eventDate, eventEndDate, paths: coordinatorOfflinePaths(eventId, { checkin }) });
  return (
    <ReadyForNoSignalView
      eventId={eventId}
      checkin={checkin}
      host={host}
      rows={rows}
      mark={savedMark({ phase: copy.phase, savedAt: copy.savedAt, now: copy.now, online: copy.online, eventDay: true })}
      busy={copy.phase === 'saving'}
      canUpdate={copy.phase !== 'saving' && copy.online && copy.phase !== 'unsupported'}
      installed={copy.installed}
      onUpdate={() => void copy.update()}
    />
  );
}

/** What the card draws — every state passed in, so `/dev/home-lab?view=offline` draws each one with no phone storage. */
export function ReadyForNoSignalView({
  eventId,
  checkin,
  host,
  rows,
  mark,
  busy,
  canUpdate,
  installed,
  onUpdate,
}: {
  eventId: string;
  checkin: boolean;
  host: boolean;
  rows: readonly ReadyRow[];
  mark: SavedMark;
  busy: boolean;
  canUpdate: boolean;
  installed: boolean;
  onUpdate: () => void;
}) {
  const e = encodeURIComponent(eventId);
  const prints: Record<string, string> = {
    checkin: `/api/hub-print/guest-registry?event=${e}`,
    chart: `/dashboard/${e}/seating/print?chart=table&format=pdf`,
    'chart-az': `/dashboard/${e}/seating/print?chart=az&format=pdf`,
  };
  const download = (key: string) => {
    const href = prints[key];
    if (!href) return;
    const a = document.createElement('a');
    a.href = href;
    a.rel = 'noopener';
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <section aria-labelledby="ready-no-signal" data-ready-no-signal="" className="space-y-3 border-y border-ink/10 py-4">
      <div>
        <InfoTip label="Ready for no signal" labelAs="h2" labelId="ready-no-signal" labelClassName="text-[17px] font-semibold text-ink" align="start">
          This phone keeps its own copy of today&rsquo;s Home{checkin ? ' and Check-in desk' : ''}, refreshed every time you open
          them with signal. With no signal you see the copy from your last update &mdash; changes made after it don&rsquo;t show
          until the signal is back. Check-ins made with no signal are saved on this phone and sent when you&rsquo;re back online;
          if another phone already checked the same guest in, it&rsquo;s shown, never lost. The copy is erased from this phone
          after the event.
        </InfoTip>
        <div className="mt-1">
          <SavedMarkLine mark={mark} busy={busy} />
        </div>
      </div>

      <ul className="divide-y divide-ink/10" aria-label="Saved on this phone">
        {rows.map((r) => (
          <li key={r.key} className="flex min-h-11 items-center justify-between gap-3 py-2 text-[15px]">
            <span className="min-w-0 truncate text-ink">{r.label}</span>
            <span
              data-ready-row={r.key}
              data-ready-ok={r.ok ? '1' : '0'}
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
                r.value === null
                  ? 'bg-warn-50 text-warn-800'
                  : r.ok
                    ? 'bg-success-50 text-success-700'
                    : 'bg-ink/5 text-ink/60'
              }`}
            >
              {r.value === null ? 'Couldn’t read' : r.ok ? `${r.value} ✓` : r.value}
            </span>
          </li>
        ))}
      </ul>

      <ActionButton
        tone="brand"
        main
        icon={RefreshCw}
        label="Update now"
        className="w-full justify-center"
        disabled={!canUpdate}
        onClick={onUpdate}
      />
      {installed ? null : (
        <p className="text-[12.5px] text-ink/60" data-ready-browser-only="">
          For no-signal venues, use the Setnayan app or Add to Home Screen.
        </p>
      )}

      <div className="flex min-h-11 items-center justify-between gap-3 border-t border-ink/10 pt-3">
        <span className="min-w-0 text-[15px] text-ink">Printed check-in list + seat chart</span>
        <PickMenu
          label="Print the check-in list or the seat chart"
          value={null}
          buttonText="Print"
          dataAttr="data-ready-print"
          options={[
            {
              key: 'checkin',
              label: 'Check-in list',
              icon: <Printer aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
              ...(host ? {} : { disabledNote: 'Only the hosts can print this' }),
            },
            { key: 'chart', label: 'Seat chart · by table', icon: <Printer aria-hidden className="h-4 w-4" strokeWidth={1.75} /> },
            { key: 'chart-az', label: 'Seat chart · A to Z', icon: <Printer aria-hidden className="h-4 w-4" strokeWidth={1.75} /> },
          ]}
          onPick={download}
        />
      </div>

      <details className="group border-t border-ink/10 pt-1" data-ready-fold="">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-[15px] font-semibold text-ink">
          <span className="min-w-0 flex-1">
            What works without signal<span className="font-normal text-ink/55"> · and what waits</span>
          </span>
          <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-terracotta transition-transform group-open:rotate-180" strokeWidth={2} />
        </summary>
        <div className="space-y-1.5 pb-1 text-[13.5px] text-ink/70">
          <p>
            <b className="text-ink">Works:</b> the Check-in desk (scans are saved on this phone and sent when the signal is back),
            the seat plan and the run of show as they were at your last update.
          </p>
          <p>
            <b className="text-ink">Waits:</b> announcements to guests, Live Watch, chat, payments &mdash; and anything changed
            after your last update.
          </p>
        </div>
      </details>
    </section>
  );
}
