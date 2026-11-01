'use client';

import { useState, useTransition } from 'react';
import { CalendarClock, Rocket, X } from 'lucide-react';
import { SwitchRow } from '@/app/_components/form-row';
import { ActionButton } from '@/components/action-button';
import { useSaveLoader } from '@/components/sd-loader';
import { cancelScheduledLaunch, launchSaveTheDate, scheduleSaveTheDateLaunch } from '../../studio/save-the-date/actions';
import { SchedulePicker, formatManila, toManilaInputValue } from '../../studio/save-the-date/_components/launch-std-button';
import { makerSave, requestMakerRefresh } from '@/lib/maker-refresh';

/**
 * ⚙ GO LIVE AS A SWITCH — the Hub's ⚙ Event Hub settings › Your Event Hub (owner 2026-10-30, verbatim: *"Redraw to
 * prototype"*; prototype `prototypes/build-contracts-2026-10-30/event-hub-pro/` `openSettings`: "Go live" is a switch
 * row, its line saying where it stands). The shipped panel (`LaunchStdButton` — "Your Event Hub is private · Launch now ·
 * Schedule for later") is the same three writes; only the drawing is a row.
 *
 * 🔒 WHAT THE SHIPPED PANEL GUARDS, KEPT:
 *   · it ASKS before it goes public — the switch opens the panel's own question ("Make your Event Hub public now?")
 *     with Yes, launch · Schedule for later · Not yet, under the row; a tap never launches by itself;
 *   · SCHEDULE FOR LATER stays reachable — in that question, and, once scheduled, the row's line says when and
 *     Change time · Cancel schedule sit under it (the panel's own `SchedulePicker`, Manila time, no past times);
 *   · ONCE LIVE THERE IS NO "OFF" — the panel has no un-launch and neither does this: the switch stays on, locked, and
 *     its ⓘ says the way back is Who can view (the next row). No new write is invented;
 *   · a press that never answered is a refusal said under the row (caught where it is awaited), never the app's
 *     error screen, and a launch that was not confirmed never looks launched (a cancel is drawn first and put back).
 *   · Launching makes the page public (`publishSaveTheDate` sets Who can view to Public) — `onLaunched` tells the row
 *     beside it, so the two never disagree on screen.
 * The panel's "Preview your Event Hub" link is not drawn here: this sheet sits on the Maker, whose ▶ is the preview.
 */
export function HubGoLiveRow({
  eventId,
  initialLaunched,
  initialScheduledAt,
  onLaunched,
}: {
  eventId: string;
  initialLaunched: boolean;
  initialScheduledAt: string | null;
  /** Launching made the page Public — the Who can view row beside it says so. */
  onLaunched?: () => void;
}) {
  const [launched, setLaunched] = useState(initialLaunched);
  const [scheduledAt, setScheduledAt] = useState<string | null>(initialScheduledAt);
  const [asking, setAsking] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pickValue, setPickValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = useSaveLoader();

  /* Each press goes through the Maker's one save door (`makerSave` — one refresh per burst), its question or picker
     closing first (what changes on screen before the server answers); a request that never answered is caught here
     and SAID, never thrown into the transition (it would replace the whole Maker with the error screen). A launch
     that was not confirmed never looks launched; a schedule not confirmed reopens its picker with the time kept. */
  function doLaunch() {
    setError(null);
    setAsking(false);
    start(async () => {
      try {
        const res = await makerSave(() => save.run(() => launchSaveTheDate(eventId), { steps: ['Launching your Save-the-Date'], hint: 'Please wait' }), requestMakerRefresh, { ok: (r) => r.ok });
        if (res.ok) {
          setLaunched(true);
          setScheduledAt(null);
          setPicking(false);
          onLaunched?.();
        } else {
          setError('Could not launch right now — please try again.');
        }
      } catch {
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
    setPicking(false);
    start(async () => {
      try {
        const res = await makerSave(() => save.run(() => scheduleSaveTheDateLaunch(eventId, pickValue), { steps: ['Scheduling the launch'], hint: 'Please wait' }), requestMakerRefresh, { ok: (r) => r.ok });
        if (res.ok && res.scheduledAtIso) {
          setScheduledAt(res.scheduledAtIso);
          setAsking(false);
        } else {
          setPicking(true);
          setError(res.error === 'past' ? 'Pick a time in the future.' : 'Could not schedule that — please check the date and try again.');
        }
      } catch {
        setPicking(true);
        setError('Could not schedule that — please check the date and try again.');
      }
    });
  }

  function doCancel() {
    setError(null);
    /* Drawn first, put back with words if refused — the house pattern of the rows beside it (`pickWho`). */
    const before = scheduledAt;
    setScheduledAt(null);
    setPicking(false);
    start(async () => {
      try {
        const res = await makerSave(() => save.run(() => cancelScheduledLaunch(eventId), { steps: ['Cancelling the schedule'], hint: 'Please wait' }), requestMakerRefresh, { ok: (r) => r.ok });
        if (!res.ok) {
          setScheduledAt(before);
          setError('Could not cancel the schedule — please try again.');
        }
      } catch {
        setScheduledAt(before);
        setError('Could not cancel the schedule — please try again.');
      }
    });
  }

  function openPicker() {
    setPickValue(toManilaInputValue(scheduledAt ? new Date(scheduledAt) : new Date(Date.now() + 24 * 60 * 60 * 1000)));
    setPicking(true);
    setAsking(false);
    setError(null);
  }

  const line = launched
    ? 'Live — Who can view decides who opens it'
    : scheduledAt
      ? `Goes live ${formatManila(scheduledAt)} · Manila`
      : 'Not yet — private until you launch';

  const below = launched ? null : picking ? (
    <div className="pb-3" data-hub-go-live="picking">
      <SchedulePicker
        value={pickValue}
        min={toManilaInputValue(new Date())}
        pending={pending}
        onChange={setPickValue}
        onSubmit={doSchedule}
        onCancel={() => setPicking(false)}
        submitLabel={scheduledAt ? 'Update time' : 'Schedule launch'}
      />
    </div>
  ) : asking ? (
    <div className="flex flex-col gap-2 pb-3" data-hub-go-live="asking">
      <p className="text-[13.5px] text-ink/75">
        {scheduledAt ? `Make your Event Hub public now, instead of ${formatManila(scheduledAt)}?` : 'Make your Event Hub public now?'}
      </p>
      <div className="flex flex-wrap gap-2">
        <ActionButton tone="brand" main icon={Rocket} label={pending ? 'Launching…' : 'Yes, launch'} waiting={pending} onClick={doLaunch} />
        <ActionButton tone="neutral" icon={CalendarClock} label={scheduledAt ? 'Change time' : 'Schedule for later'} onClick={openPicker} />
        <ActionButton tone="neutral" quiet icon={X} label="Not yet" onClick={() => setAsking(false)} />
      </div>
    </div>
  ) : scheduledAt ? (
    <div className="flex flex-wrap gap-2 pb-3" data-hub-go-live="scheduled">
      <ActionButton tone="neutral" icon={CalendarClock} label="Change time" onClick={openPicker} />
      <ActionButton tone="neutral" quiet icon={X} label="Cancel schedule" waiting={pending} onClick={doCancel} />
    </div>
  ) : null;

  return (
    <SwitchRow
      data="go-live"
      name="Go live"
      line={line}
      about={{
        words: launched
          ? 'Your Event Hub is launched. Who can open it is the next row — set Who can view to Private to close it again.'
          : 'Going live makes your Event Hub public — now, or at a time you choose (Manila time). Until then only you and the guests you invited can open it.',
      }}
      on={launched}
      /* 🔒 Once live there is no off — the shipped panel has no un-launch (the way back is Who can view). */
      disabled={launched}
      onChange={() => {
        setError(null);
        setPicking(false);
        setAsking((v) => !v);
      }}
      problem={error}
      below={below}
      attrs={{ 'data-studio-hub-row': 'go-live', 'data-studio-switch': 'go-live', 'data-hub-go-live-state': launched ? 'live' : scheduledAt ? 'scheduled' : 'private' }}
    />
  );
}
