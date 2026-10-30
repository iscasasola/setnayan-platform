'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { FormRows, SwitchRow } from '@/app/_components/form-row';
import { usePapicHead } from '@/app/dashboard/[eventId]/_components/papic-home-card';
import { SHOOT_NOW_LABEL, shootNowLine } from '@/lib/papic-shoot-now';
import { papicSaveInPlace } from '../in-place-actions';

const NOT_SAVED = 'That did not save. Nothing changed — please try again.';

/**
 * 📷 "LET EVERYBODY SHOOT NOW" — the head switch of Home's Papic card once Papic is on (owner 2026-10-30: *"the switch on
 * event home should be the let everybody shoot now function"*). See `lib/papic-shoot-now.ts` for when it is drawn.
 *
 *   · THE SAME SWITCH the head already wore — `SwitchRow` in `FormRows`, exactly as `AnswerPicker as="switch"` draws
 *     the Papic switch — never a new look.
 *   · ONE WRITE, LIVE: `events.papic_guest_capture_early` through the shipped `setPapicGuestCaptureEarly` (its couple
 *     check and service-role write), asked through the Papic in-place door (`papicSaveInPlace`) — no Apply, no
 *     navigation, the screen never resets.
 *   · The line under the card's title follows the press at once (`usePapicHead`); a refused save puts the switch AND
 *     the line back and says why under the card's head (in the card's flow, not in the switch's absolute slot).
 *
 * `early === null` — the saved value could not be read: the switch is drawn, off and disabled, and the line says
 * "Couldn’t check just now" — never an "off" that was not measured.
 *
 * `standIn` is the dev lab's only (`/dev/home-lab?card=1&shoot=…`): the press is answered without a server — 'ok' saves,
 * 'fail' refuses — so the walk can show both outcomes with no database. Production never passes it.
 */
export function ShootNowSwitch({
  eventId,
  early,
  standIn,
}: {
  eventId: string;
  early: boolean | null;
  standIn?: 'ok' | 'fail';
}) {
  const say = usePapicHead();
  const [shown, setShown] = useState(early === true);
  const [pending, start] = useTransition();
  const latest = useRef(early === true);
  const stored = useRef(early === true);
  /* 🔁 A new saved value from the server (the save's own revalidate, or another device) is the truth — the line goes
     back to the server's, never while a press of its own is on its way. */
  useEffect(() => {
    if (pending || early === null) return;
    stored.current = early;
    latest.current = early;
    setShown(early);
    say.line(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- follows the saved value only
  }, [early]);

  const flip = (on: boolean) => {
    if (early === null || on === latest.current) return;
    latest.current = on;
    setShown(on);
    say.line(shootNowLine(on));
    say.problem(null);
    start(async () => {
      let answer: { ok: true } | { ok: false; error: string };
      if (standIn) {
        answer = standIn === 'ok' ? { ok: true } : { ok: false, error: NOT_SAVED };
      } else {
        const fd = new FormData();
        fd.set('event_id', eventId);
        fd.set('early', on ? '1' : '0');
        fd.set('return_to', 'home');
        answer = await papicSaveInPlace('setPapicGuestCaptureEarly', fd).catch(() => ({ ok: false as const, error: NOT_SAVED }));
      }
      if (answer.ok) {
        stored.current = on;
        return;
      }
      if (latest.current === on) {
        latest.current = stored.current;
        setShown(stored.current);
        say.line(shootNowLine(stored.current));
        say.problem(answer.error);
      }
    });
  };

  return (
    <section data-shoot-now={early === null ? 'unread' : shown ? 'on' : 'off'} aria-busy={pending || undefined} className="flex flex-col">
      <FormRows data="papic-shoot-now">
        <SwitchRow
          name={SHOOT_NOW_LABEL}
          on={shown}
          onChange={flip}
          disabled={early === null}
          data="papic-shoot-now"
        />
      </FormRows>
    </section>
  );
}
