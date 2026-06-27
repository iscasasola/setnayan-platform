'use client';

import { useState, useTransition } from 'react';
import {
  Rocket,
  Check,
  ExternalLink,
  Lock,
  CalendarClock,
  Clock,
  Eye,
  X,
} from 'lucide-react';
import {
  launchSaveTheDate,
  scheduleSaveTheDateLaunch,
  cancelScheduledLaunch,
} from '../actions';

/**
 * LaunchStdButton — the couple's "go live" control for their wedding website.
 *
 * Owner ruling 2026-06-20: the /[slug] page is PRIVATE until the couple launches
 * their Save-the-Date. Owner ask 2026-06-28: couples can ALSO schedule that
 * launch for a future date/time ("align when the website will launch"), and keep
 * a "Launch now" override. Until launch, strangers see a private holding page
 * (the couple + invited guests can already view it). Reversible anytime via
 * Website → Privacy.
 *
 * States: live → "launched" block · scheduled → countdown + change/cancel/now ·
 * private → launch now OR schedule for later. A "Preview your page" link sits in
 * every state so couples can see-it-then-ship-it.
 *
 * All times are Asia/Manila (PH, fixed +08:00) — the input is a wall-clock pick,
 * the server interprets it as Manila and stores UTC (see actions.ts).
 */

const MANILA_TZ = 'Asia/Manila';

/** ISO/Date → "Mon D, YYYY, h:mm AM" in Manila for display. */
function formatManila(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: MANILA_TZ,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Date → "YYYY-MM-DDTHH:mm" wall-clock in Manila, for <input datetime-local>. */
function toManilaInputValue(d: Date): string {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const hour = p.hour === '24' ? '00' : p.hour; // some engines emit 24 at midnight
  return `${p.year}-${p.month}-${p.day}T${hour}:${p.minute}`;
}

export function LaunchStdButton({
  eventId,
  slug,
  initialLaunched,
  initialScheduledAt,
}: {
  eventId: string;
  slug: string | null;
  initialLaunched: boolean;
  initialScheduledAt: string | null;
}) {
  const [launched, setLaunched] = useState(initialLaunched);
  const [scheduledAt, setScheduledAt] = useState<string | null>(initialScheduledAt);
  const [confirming, setConfirming] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pickValue, setPickValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const previewHref = `/site-editor/${eventId}`;

  function doLaunch() {
    setError(null);
    start(async () => {
      const res = await launchSaveTheDate(eventId);
      if (res.ok) {
        setLaunched(true);
        setScheduledAt(null);
        setConfirming(false);
        setPicking(false);
      } else {
        setError('Could not launch right now — please try again.');
      }
    });
  }

  function doSchedule() {
    setError(null);
    if (!pickValue) {
      setError('Pick a date and time first.');
      return;
    }
    start(async () => {
      const res = await scheduleSaveTheDateLaunch(eventId, pickValue);
      if (res.ok && res.scheduledAtIso) {
        setScheduledAt(res.scheduledAtIso);
        setPicking(false);
      } else if (res.error === 'past') {
        setError('Pick a time in the future.');
      } else {
        setError('Could not schedule that — please check the date and try again.');
      }
    });
  }

  function doCancel() {
    setError(null);
    start(async () => {
      const res = await cancelScheduledLaunch(eventId);
      if (res.ok) {
        setScheduledAt(null);
        setPicking(false);
      } else {
        setError('Could not cancel the schedule — please try again.');
      }
    });
  }

  function openPicker() {
    // Seed the input with the current schedule (if any), else +1 day at this hour.
    const seed = scheduledAt
      ? new Date(scheduledAt)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);
    setPickValue(toManilaInputValue(seed));
    setPicking(true);
    setError(null);
  }

  const minValue = toManilaInputValue(new Date());

  return (
    <div className="space-y-3 rounded-2xl border border-mulberry/25 bg-mulberry/[0.04] p-5">
      {launched ? (
        /* ── LIVE ── */
        <div className="space-y-1.5">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Check aria-hidden className="h-4 w-4 text-mulberry" strokeWidth={2.25} />
            Your Save-the-Date is launched — your page is live.
          </p>
          <p className="text-sm text-ink/65">
            Anyone with your link can now see it.{' '}
            {slug ? (
              <a
                href={`/${slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-terracotta underline-offset-2 hover:underline"
              >
                View your page
                <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              </a>
            ) : null}
          </p>
          <p className="text-xs text-ink/50">
            You can make it private again anytime in Website → Privacy.
          </p>
        </div>
      ) : scheduledAt ? (
        /* ── SCHEDULED ── */
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <CalendarClock aria-hidden className="h-4 w-4 text-mulberry" strokeWidth={1.9} />
            Scheduled to go live
          </p>
          <p className="text-sm text-ink/70">
            Your page becomes public on{' '}
            <span className="font-semibold text-ink">{formatManila(scheduledAt)}</span>{' '}
            <span className="text-ink/55">(Manila time)</span>. Until then only you and
            guests you&rsquo;ve invited can see it.
          </p>
          {picking ? (
            <SchedulePicker
              value={pickValue}
              min={minValue}
              pending={pending}
              onChange={setPickValue}
              onSubmit={doSchedule}
              onCancel={() => setPicking(false)}
              submitLabel="Update time"
            />
          ) : (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={doLaunch}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-full bg-mulberry px-4 py-2 text-sm font-semibold text-cream hover:bg-mulberry-600 disabled:opacity-70"
              >
                <Rocket aria-hidden className="h-4 w-4" strokeWidth={1.9} />
                {pending ? 'Launching…' : 'Launch now'}
              </button>
              <button
                type="button"
                onClick={openPicker}
                disabled={pending}
                className="rounded-full border border-mulberry/30 px-4 py-2 text-sm font-medium text-mulberry hover:bg-mulberry/10 disabled:opacity-70"
              >
                Change time
              </button>
              <button
                type="button"
                onClick={doCancel}
                disabled={pending}
                className="rounded-full px-3 py-2 text-sm font-medium text-ink/60 hover:bg-ink/5 disabled:opacity-70"
              >
                Cancel schedule
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ── PRIVATE (launch now or schedule) ── */
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Lock aria-hidden className="h-4 w-4 text-ink/55" strokeWidth={1.9} />
            Your page is private
          </p>
          <p className="text-sm text-ink/65">
            Only you and guests you&rsquo;ve invited can see it. Launch your Save-the-Date
            to make your wedding page public — now, or at a time you choose.
          </p>
          {picking ? (
            <SchedulePicker
              value={pickValue}
              min={minValue}
              pending={pending}
              onChange={setPickValue}
              onSubmit={doSchedule}
              onCancel={() => setPicking(false)}
              submitLabel="Schedule launch"
            />
          ) : confirming ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-sm text-ink/70">Make your page public now?</span>
              <button
                type="button"
                onClick={doLaunch}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-full bg-mulberry px-4 py-2 text-sm font-semibold text-cream hover:bg-mulberry-600 disabled:opacity-70"
              >
                <Rocket aria-hidden className="h-4 w-4" strokeWidth={1.9} />
                {pending ? 'Launching…' : 'Yes, launch'}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="rounded-full px-3 py-2 text-sm font-medium text-ink/60 hover:bg-ink/5"
              >
                Not yet
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="inline-flex items-center gap-2 rounded-full bg-mulberry px-5 py-2.5 text-sm font-semibold text-cream shadow-sm transition hover:bg-mulberry-600"
              >
                <Rocket aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Launch now
              </button>
              <button
                type="button"
                onClick={openPicker}
                className="inline-flex items-center gap-2 rounded-full border border-mulberry/30 px-5 py-2.5 text-sm font-semibold text-mulberry transition hover:bg-mulberry/10"
              >
                <CalendarClock aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Schedule for later
              </button>
            </div>
          )}
        </div>
      )}

      {error ? <p className="text-sm text-danger-700">{error}</p> : null}

      {/* Preview entry — see-it-then-ship-it, available in every state. */}
      <a
        href={previewHref}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-terracotta underline-offset-2 hover:underline"
      >
        <Eye aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Preview your page
      </a>
    </div>
  );
}

/**
 * SchedulePicker — the datetime-local input + confirm/cancel row, shared by the
 * private and scheduled states. Wall-clock pick is Manila time (server-side
 * interpretation); `min` blocks past picks in the browser, the server re-checks.
 */
function SchedulePicker({
  value,
  min,
  pending,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  value: string;
  min: string;
  pending: boolean;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="space-y-2 pt-1">
      <label className="flex flex-col gap-1 text-sm text-ink/70">
        <span className="flex items-center gap-1.5 font-medium text-ink">
          <Clock aria-hidden className="h-4 w-4 text-mulberry" strokeWidth={1.75} />
          Go live on (Manila time)
        </span>
        <input
          type="datetime-local"
          value={value}
          min={min}
          onChange={(e) => onChange(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-ink/20 bg-cream px-3 py-2 text-sm text-ink focus:border-mulberry focus:outline-none focus:ring-2 focus:ring-mulberry/30"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full bg-mulberry px-4 py-2 text-sm font-semibold text-cream hover:bg-mulberry-600 disabled:opacity-70"
        >
          <CalendarClock aria-hidden className="h-4 w-4" strokeWidth={1.9} />
          {pending ? 'Saving…' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium text-ink/60 hover:bg-ink/5 disabled:opacity-70"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={1.9} />
          Cancel
        </button>
      </div>
    </div>
  );
}
