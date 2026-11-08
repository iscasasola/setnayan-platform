'use client';

/**
 * 🗓 CHANGE THE SCHEDULE — the day-of sheet (owner 2026-11-04: it replaces Hold 10 min and the +5 · +10 · +15 · +30
 * row; supplier prototype v59 `rosMoveSheet`): **Part ▾ · Move it Later/Earlier ▾ · N min ▾**, one line saying what Move
 * will do, then **Move** and **Skip this part**. Every set of choices is ONE dropdown (`ChosenRow` → `PickMenu`). After it
 * landed, the result and its Undo ride the shipped Undo toast.
 *
 * One component, both doors: the coordinator's floor and the emcee's desk (`ScheduleUpdater`, `via="floor"`) and a crew
 * Member's phone (`app/join/crew/[token]`, `via="crew"`). The rule and the words are `lib/change-the-schedule.ts`; the
 * write is `floorChangeSchedule` (one action — every export is a route). On the crew phone the sheet ASKS (owner
 * 2026-11-05 (D)): **Ask the hosts** files requests the coordinator / hosts approve with one tap, and **Ask to skip**
 * (owner 2026-11-05, *"yes they can request"*) asks the coordinator, who approves it on the floor; no Undo. A part a
 * LOCKED supplier is on says the lock's line instead and offers no ask; a part already asked says it waits.
 *
 * 🔒 A skip of a locked supplier's part is refused by the database with the lock's own line (#7253's words) — said here,
 * never "try again".
 */
import { useId, useMemo, useState, useTransition } from 'react';
import { CalendarClock, MoveRight, SkipForward } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { ChosenRow, FormRows } from '@/app/_components/form-row';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { guestToast, pushUndo } from '@/app/dashboard/[eventId]/guests/_components/undo-store';
import { formatWallClock } from '@/lib/schedule-datetime-local';
import { lockedHead } from '@/lib/supplier-schedule-marks';
import {
  MOVE_MINUTES,
  moveLead,
  requestLead,
  movableParts,
  partsThatFollow,
  skipLead,
  skippableParts,
  undoOf,
  type ChangeablePart,
  type ScheduleChange,
} from '@/lib/change-the-schedule';
import { floorChangeSchedule } from './actions';

export function ChangeTheSchedule({
  eventId,
  parts,
  via = 'floor',
  lockedBy,
  asked,
  className,
}: {
  eventId: string;
  /** The run of show as the page already read it — never read again here. */
  parts: readonly ChangeablePart[];
  via?: 'floor' | 'crew';
  /** Crew phone: the parts a LOCKED supplier is on → that shop's name (the page's lock read). */
  lockedBy?: Readonly<Record<string, string>>;
  /** Crew phone: the parts that already wait on a skip ask. */
  asked?: readonly string[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const [pending, start] = useTransition();

  const movable = useMemo(() => movableParts(parts), [parts]);
  const skippable = useMemo(() => new Set(skippableParts(parts).map((p) => p.block_id)), [parts]);
  // The part the floor is on: the live one, else the next to start.
  const first = movable.find((p) => p.run_state === 'live') ?? movable[0] ?? null;
  const [partId, setPartId] = useState<string | null>(first?.block_id ?? null);
  const [later, setLater] = useState(true);
  const [minutes, setMinutes] = useState(10);
  const [error, setError] = useState<string | null>(null);

  const part = movable.find((p) => p.block_id === partId) ?? first;
  const signed = later ? minutes : -minutes;
  const following = part ? Math.max(0, partsThatFollow(parts, part.block_id).length - 1) : 0;
  /** A crew phone asks (owner 2026-11-05 (D)) — a move, or a skip (owner 2026-11-05, "yes they can request"). */
  const ask = via === 'crew';
  const skippableHere = part ? skippable.has(part.block_id) : false;
  const lockedShop = ask && part ? (lockedBy?.[part.block_id] ?? null) : null;
  const alreadyAsked = ask && part ? (asked ?? []).includes(part.block_id) : false;
  const canSkip = skippableHere && !lockedShop && !alreadyAsked;

  const show = () => {
    setPartId(first?.block_id ?? null);
    setError(null);
    setOpen(true);
  };

  const run = (change: ScheduleChange) => {
    setError(null);
    start(async () => {
      const res = await floorChangeSchedule(eventId, change, via);
      if (!res.ok) {
        setError(res.error ?? 'Nothing changed — try again.');
        return;
      }
      // The action revalidates, so this page re-renders with the new times — no refresh of our own.
      setOpen(false);
      // A crew phone ASKED — nothing changed yet, so there is nothing to undo (owner 2026-11-05 (D)).
      if (ask) {
        guestToast.success(res.message ?? 'Sent to the hosts.');
        return;
      }
      const moved = res.moved ?? [];
      pushUndo({
        label: res.message ?? 'Schedule changed',
        undo: async () => {
          const back = await floorChangeSchedule(eventId, undoOf(change, moved), via);
          if (!back.ok) guestToast.error(back.error ?? 'Couldn’t undo — change it again from the sheet.');
        },
      });
    });
  };

  if (!first) return null;

  const sheet = (
    <Sheet open={open} onClose={() => setOpen(false)} labelledById={headingId} rise>
      <div className="px-5 pb-5 pt-5" data-change-the-schedule="">
        <h2 id={headingId} className="pr-12 text-[17px] font-semibold text-ink">
          Change the schedule
        </h2>
        <FormRows width="wide">
          <ChosenRow
            name="Part"
            label="Part"
            value={part?.block_id ?? null}
            options={movable.map((p) => ({
              key: p.block_id,
              label: `${formatWallClock(p.start_at, { hour12: true })} · ${p.label}`,
              hint: p.run_state === 'live' ? 'Now' : undefined,
            }))}
            onPick={(k) => {
              setPartId(k);
              setError(null);
            }}
            dataAttr="data-change-part"
          />
          <ChosenRow
            name="Move it"
            label="Move it"
            value={later ? 'later' : 'earlier'}
            options={[
              { key: 'later', label: 'Later' },
              { key: 'earlier', label: 'Earlier' },
            ]}
            onPick={(k) => setLater(k === 'later')}
            dataAttr="data-change-direction"
          />
          <ChosenRow
            name="By"
            label="By"
            value={String(minutes)}
            options={MOVE_MINUTES.map((m) => ({ key: String(m), label: `${m} min` }))}
            onPick={(k) => setMinutes(Number(k))}
            dataAttr="data-change-minutes"
          />
        </FormRows>
        {part ? (
          <p className="mt-3 text-[13.5px] leading-snug text-ink/70" data-change-lead="">
            {ask ? requestLead(part, signed, following) : moveLead(part, signed, following)}
          </p>
        ) : null}
        {part && canSkip ? (
          <p className="mt-1.5 text-[12.5px] leading-snug text-ink/55" data-change-skip-lead="">
            {ask ? 'Ask to skip' : 'Skip'}: {skipLead(part)}
            {ask ? ' Nothing changes until the coordinator approves it.' : ''}
          </p>
        ) : null}
        {part && skippableHere && lockedShop ? (
          <p className="mt-1.5 text-[12.5px] leading-snug text-ink/55" data-change-skip-locked="">
            {lockedHead(lockedShop)}
          </p>
        ) : null}
        {part && skippableHere && !lockedShop && alreadyAsked ? (
          <p className="mt-1.5 text-[12.5px] leading-snug text-ink/55" data-change-skip-asked="">
            Skip asked — waiting for the coordinator.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3 text-[13px] font-semibold text-danger-700 dark:text-danger-300" data-change-error="">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex gap-2">
          <ActionButton
            tone="brand"
            main
            icon={MoveRight}
            label={ask ? 'Ask the hosts' : 'Move'}
            disabled={pending || !part}
            onClick={() => part && run({ op: 'move', blockId: part.block_id, minutes: signed })}
            className="flex-1"
          />
          {canSkip ? (
            <ActionButton
              tone="neutral"
              icon={SkipForward}
              label={ask ? 'Ask to skip' : 'Skip this part'}
              disabled={pending}
              onClick={() => part && run({ op: 'skip', blockId: part.block_id })}
            />
          ) : null}
        </div>
      </div>
    </Sheet>
  );

  return (
    <>
      <ActionButton
        tone="neutral"
        icon={CalendarClock}
        label="Change the schedule"
        aria-haspopup="dialog"
        onClick={show}
        className={className}
        data-testid="change-the-schedule"
      />
      {sheet}
      <UndoToastHost />
    </>
  );
}
