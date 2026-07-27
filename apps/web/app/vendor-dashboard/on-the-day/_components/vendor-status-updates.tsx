'use client';

/**
 * VendorStatusUpdates — "report to coordinator", build plan §10 #2.
 *
 * One tap per preset, writing into the SAME stream the coordinator's inbox
 * reads (`public.event_day_requests`) — not a second channel. The vendor sees
 * their own reports underneath, because a status you cannot see landing is a
 * status you send twice.
 *
 * Flag-dark: `getDayRequestsView` returns `active: false` until the owner
 * switches `coordinator_requests_inbox` on at /admin/data-privacy, and this
 * component renders NOTHING in that state — no placeholder, no "coming soon"
 * on a working console.
 *
 * The body and kind of each preset are resolved SERVER-side from the key
 * (`buildVendorStatusDraft`), so nothing here can post arbitrary text.
 */

import { useCallback, useEffect, useState, useTransition } from 'react';
import { Check, Loader2, Radio } from 'lucide-react';

import {
  VENDOR_STATUS_PRESETS,
  statusLabel,
  type DayRequestRow,
} from '@/lib/day-requests';
import { getDayRequestsView, submitVendorStatusPreset } from '../actions';

export function VendorStatusUpdates({ eventId }: { eventId: string | null }) {
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(false);
  const [rows, setRows] = useState<DayRequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sentKey, setSentKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    if (!eventId) {
      setReady(true);
      return;
    }
    try {
      const view = await getDayRequestsView(eventId);
      // `side` is null when the caller is not booked — render nothing rather
      // than an empty console section they can't use.
      setActive(view.active && view.side !== null);
      setRows(view.rows);
    } catch {
      setActive(false);
    } finally {
      setReady(true);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  function send(key: string) {
    if (!eventId) return;
    setError(null);
    startTransition(async () => {
      const res = await submitVendorStatusPreset(eventId, key);
      if (!res.ok) {
        setError(res.error ?? 'Could not send that.');
        return;
      }
      setSentKey(key);
      await load();
      // Clear the confirmation tick after a beat.
      setTimeout(() => setSentKey((k) => (k === key ? null : k)), 2500);
    });
  }

  // Dark control, no booking, or still resolving → render nothing at all.
  if (!ready || !active || !eventId) return null;

  return (
    <div>
      <h2 className="sn-sec">Report to the coordinator</h2>
      <div className="sn-tile mt-3 p-4 sm:p-6">
        <p className="flex items-center gap-2 text-sm text-ink/65">
          <Radio aria-hidden className="h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
          One tap tells the coordinator where you are. They see it on their floor inbox
          straight away.
        </p>

        {error ? (
          <p role="alert" className="mt-3 rounded-lg bg-warn-600/10 px-3 py-2 text-sm text-warn-600">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {VENDOR_STATUS_PRESETS.map((preset) => {
            const justSent = sentKey === preset.key;
            const urgent = preset.kind === 'issue';
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => send(preset.key)}
                disabled={pending}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition disabled:opacity-40 ${
                  urgent
                    ? 'border-warn-600/30 bg-warn-600/5 text-warn-600 hover:bg-warn-600/10'
                    : 'border-ink/15 bg-white text-ink/80 hover:border-terracotta hover:text-ink'
                }`}
              >
                {justSent ? (
                  <Check aria-hidden className="h-4 w-4" strokeWidth={2.5} />
                ) : pending ? (
                  <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                ) : null}
                {justSent ? 'Sent' : preset.label}
              </button>
            );
          })}
        </div>

        {rows.length > 0 ? (
          <ul className="mt-4 space-y-1.5 border-t border-ink/10 pt-4">
            {rows.slice(0, 5).map((row) => (
              <li key={row.request_id} className="flex items-center gap-2 text-sm">
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    row.status === 'resolved' ? 'bg-success-500' : 'bg-terracotta'
                  }`}
                />
                <span
                  className={`flex-1 truncate ${
                    row.status === 'resolved' ? 'text-ink/40 line-through' : 'text-ink/70'
                  }`}
                >
                  {row.body}
                </span>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/40">
                  {statusLabel(row.status)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
