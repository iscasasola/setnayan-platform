'use client';

/**
 * VendorStatusUpdates — 📣 "POST AN UPDATE" (owner-approved cut 6, 2026-11-14; prototype
 * `prototypes/supplier_eleven_jobs_cuts_2026-11-14_fable.html` § 6). It was "report to coordinator", build plan §10 #2,
 * drawn only on the event's own day, below the tools. Now it is ONE button at the top of each booked event's page,
 * every day, with what was posted underneath; the button opens a sheet with the same six statuses and note box. The
 * couple reads the updates on their day (Home's day-of grid, "From your suppliers"); "Need help" files as work for
 * the coordinator, whose floor inbox reads the same stream.
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
 * The body and kind of each PRESET are resolved SERVER-side from the key
 * (`buildVendorStatusDraft`), so a tap can never post text of its own choosing.
 *
 * ⚠ THIS DOCBLOCK USED TO END "so nothing here can post arbitrary text", and
 * that was a description of a LIMITATION being read as a security property. It
 * was neither: the coordinator has always had a free-text box on the same
 * stream, the RLS INSERT policies already distinguish the two lanes, and the
 * only thing the closed list of six actually prevented was a supplier
 * reporting a problem nobody had thought of in advance. There is now a
 * free-text box here too, going through `submitDayRequest`, which derives the
 * lane from the caller's own side — so a supplier still cannot post as the
 * coordinator, which is the property that ever mattered.
 */

import { useCallback, useEffect, useId, useState, useTransition } from 'react';
import { Check, Loader2, Megaphone } from 'lucide-react';

import { Explain } from '@/app/_components/explain';
import { Sheet } from '@/app/_components/sheet';
import {
  VENDOR_STATUS_PRESETS,
  presetByKey,
  type DayRequestRow,
} from '@/lib/day-requests';
import { getDayRequestsView, submitDayRequest, submitVendorStatusPreset } from '../actions';

/** Who reads a post — the sheet's one line, and the help answer's. */
export const POST_AN_UPDATE_READERS = 'The couple sees it on their Event Hub. Need help also goes to their coordinator.';

/** A posted row as the supplier reads it back: the status word, their note under it (if any). */
export function ownUpdateLine(row: Pick<DayRequestRow, 'preset_key' | 'body'>): { status: string; note: string | null } {
  const preset = presetByKey(row.preset_key);
  if (!preset) return { status: 'Update', note: row.body };
  return { status: preset.label, note: row.body === preset.body ? null : row.body };
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function VendorStatusUpdates({
  eventId,
  initial,
}: {
  eventId: string | null;
  /** The labs' fixtures (`/dev/supplier-lab`): drawn as read, with no read of their own. Never passed by a real page. */
  initial?: DayRequestRow[];
}) {
  const [ready, setReady] = useState(Boolean(initial));
  const [active, setActive] = useState(Boolean(initial));
  const [rows, setRows] = useState<DayRequestRow[]>(initial ?? []);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  const [pending, startTransition] = useTransition();
  const headingId = useId();
  const noteId = useId();

  const load = useCallback(async () => {
    if (initial) return;
    if (!eventId) {
      setReady(true);
      return;
    }
    try {
      const view = await getDayRequestsView(eventId);
      // `side` is null when the caller is not booked — render nothing rather than a button they can't use.
      setActive(view.active && view.side !== null);
      setRows(view.rows);
    } catch {
      setActive(false);
    } finally {
      setReady(true);
    }
  }, [eventId, initial]);

  useEffect(() => {
    void load();
  }, [load]);

  function close() {
    setOpen(false);
    setError(null);
  }

  // ── ONE POST, ONE ROW ──────────────────────────────────────────────────────
  // A status (with or without a note) goes through the preset door, which keeps the status's KIND server-side; a note
  // with no status is the shipped free-text door (`submitDayRequest`). Both file on the supplier's own lane.
  function post() {
    if (!eventId) return;
    const body = note.trim();
    if (!picked && !body) {
      setError('Pick a status or write a note.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = picked ? await submitVendorStatusPreset(eventId, picked, body || null) : await submitDayRequest(eventId, body);
      if (!res.ok) {
        setError(res.error ?? 'Could not post that. Try again.');
        return;
      }
      setOpen(false);
      setPicked(null);
      setNote('');
      setPosted(true);
      await load();
      setTimeout(() => setPosted(false), 2500);
    });
  }

  // Dark control, no booking, or still resolving → render nothing at all.
  if (!ready || !active || !eventId) return null;

  const mine = rows.filter((r) => r.origin === 'vendor').slice(0, 5);

  return (
    <div data-post-an-update="" data-tour="hub-post-update" className="pt-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-mulberry px-4 text-[15px] font-semibold text-cream transition hover:bg-mulberry-600"
        data-post-an-update-open=""
      >
        <Megaphone aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Post an update
      </button>
      {posted ? (
        <p className="pt-1.5 text-center text-[12.5px] text-ink/60" aria-live="polite">
          <Check aria-hidden className="mr-1 inline h-3.5 w-3.5" strokeWidth={2.5} />
          Posted
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2 pt-4">
        <p className="home-k2">Your updates</p>
        <Explain title="Your updates">
          What you posted for this event. The couple sees each one on their Event Hub; Running late and Need help also
          go to their coordinator’s inbox as something to act on.
        </Explain>
      </div>
      {mine.length === 0 ? (
        <p className="py-2 text-[13px] text-ink/55" data-post-an-update-empty="">
          Nothing posted yet. On the day, tap Post an update when you arrive, finish setting up, or need a hand.
        </p>
      ) : (
        <ul data-post-an-update-list="">
          {mine.map((row) => {
            const line = ownUpdateLine(row);
            return (
              <li key={row.request_id} className="border-b border-ink/10 py-2">
                <p className="flex items-baseline justify-between gap-3">
                  <span className={`text-[14px] font-semibold ${row.kind === 'issue' ? 'text-warn-600' : 'text-ink'}`}>{line.status}</span>
                  <span className="shrink-0 font-mono text-[11px] text-ink/50">{timeOf(row.created_at)}</span>
                </p>
                {line.note ? <p className="text-[13px] leading-snug text-ink/65">{line.note}</p> : null}
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={open} onClose={close} labelledById={headingId} rise>
        <div className="px-5 pb-6 pt-5" data-post-an-update-sheet="">
          <h2 id={headingId} className="pr-12 text-[17px] font-semibold text-ink">
            Post an update
          </h2>
          <div role="radiogroup" aria-label="Status" className="mt-3 flex flex-wrap gap-2">
            {VENDOR_STATUS_PRESETS.map((preset) => {
              const on = picked === preset.key;
              const urgent = preset.kind === 'issue';
              return (
                <button
                  key={preset.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPicked(on ? null : preset.key)}
                  disabled={pending}
                  data-post-status={preset.key}
                  className={`min-h-11 rounded-full border px-4 text-[14px] font-medium transition disabled:opacity-40 ${
                    on
                      ? 'border-mulberry bg-mulberry text-cream'
                      : urgent
                        ? 'border-warn-600/30 bg-warn-600/5 text-warn-600'
                        : 'border-ink/15 bg-white text-ink/80'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          <label htmlFor={noteId} className="mt-4 block text-[13px] font-semibold text-ink">
            Note <span className="font-normal text-ink/55">optional</span>
          </label>
          <textarea
            id={noteId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={240}
            disabled={pending}
            placeholder="The cake is melting near the lights…"
            className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-[15px] text-ink placeholder:text-ink/35 focus:border-terracotta focus:outline-none disabled:opacity-40"
          />
          <p className="pt-1 text-[12.5px] leading-snug text-ink/60">{POST_AN_UPDATE_READERS}</p>
          {error ? (
            <p role="alert" className="mt-2 text-[13px] font-semibold text-danger-700">
              {error}
            </p>
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={close} className="min-h-11 rounded-xl border border-ink/15 px-4 text-[14px] font-medium text-ink">
              Cancel
            </button>
            <button
              type="button"
              onClick={post}
              disabled={pending || (!picked && note.trim().length === 0)}
              data-post-an-update-post=""
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-mulberry px-5 text-[14px] font-semibold text-cream transition hover:bg-mulberry-600 disabled:opacity-40"
            >
              {pending ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.75} /> : null}
              Post
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
