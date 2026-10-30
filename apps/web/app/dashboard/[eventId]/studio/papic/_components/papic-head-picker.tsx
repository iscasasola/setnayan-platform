'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePapicHead } from '@/app/dashboard/[eventId]/_components/papic-home-card';
import { useStudioActions } from '@/app/dashboard/[eventId]/launch/_components/studio-actions-context';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { pickButtonClass } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-place';
import { makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import {
  PAPIC_HEAD_LABEL,
  PAPIC_HEAD_OPTIONS,
  papicHeadLine,
  papicHeadPosition,
  papicHeadWrites,
  type PapicHeadPosition,
} from '@/lib/papic-shoot-now';
import { papicSaveInPlace } from '../in-place-actions';

const NOT_SAVED = 'That did not save. Nothing changed — please try again.';

/**
 * 📷 THE PAPIC CARD'S HEAD — ONE DROPDOWN, THREE POSITIONS (owner 2026-10-30: *"the switch on event home should be the let
 * everybody shoot now function"* · *"If we cannot turn it off, then maybe assign partial turn on?"*):
 * **Off · On — event day · On — everyone, now**. The rules and the writes are `lib/papic-shoot-now.ts`.
 *
 *   · ONE `PickMenu`, compact — a set of choices is one dropdown, never a pill row or a second switch.
 *   · `papic_on` goes through the SAME door the Papic switch (`AnswerPicker`) used — the Event Hub draft, `hubDraftAction`
 *     via `makerSave` — so Off / On take effect on Apply, and the line says "after you Apply" until they do. No new live
 *     write for `papic_on`.
 *   · `papic_guest_capture_early` goes through the shipped `setPapicGuestCaptureEarly`, LIVE, in place
 *     (`papicSaveInPlace`) — no navigation, the screen never resets.
 *   · The line under the title follows the pick at once (`usePapicHead`). A refused write puts the position and the line
 *     back to what IS stored (a first write that landed stays landed) and says why under the head — in the card's flow.
 *   · Unread (`draftOn` or `early` null) → the button is disabled and the line says "Couldn’t check just now".
 *
 * `standIn` is the dev lab's only (`/dev/home-lab?card=1&head=…`): picks are answered with no server — 'ok' saves,
 * 'fail' refuses. Production never passes it.
 */
export function PapicHeadPicker({
  eventId,
  live,
  draftOn,
  early,
  standIn,
}: {
  eventId: string;
  /** `events.papic_on` as guests see it now. */
  live: boolean | null;
  /** `papic_on` as the couple is editing it — the draft over live. */
  draftOn: boolean | null;
  /** `events.papic_guest_capture_early`. */
  early: boolean | null;
  standIn?: 'ok' | 'fail';
}) {
  const say = usePapicHead();
  const { hubDraftAction } = useStudioActions();
  const unread = papicHeadPosition({ live, draftOn, early }) === null;
  const [shown, setShown] = useState({ draftOn: draftOn === true, early: early === true });
  const stored = useRef({ draftOn: draftOn === true, early: early === true });
  const [pending, start] = useTransition();
  /* 🔁 New facts from the server are the truth — the line goes back to the server's, never mid-save. */
  useEffect(() => {
    if (pending || unread) return;
    stored.current = { draftOn: draftOn === true, early: early === true };
    setShown(stored.current);
    say.line(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- follows the saved facts only
  }, [draftOn, early, live]);

  if (unread) {
    return (
      <button type="button" disabled aria-label={`${PAPIC_HEAD_LABEL}: couldn’t check`} className={`${pickButtonClass(true)} opacity-50`} data-papic-head-pick="unread">
        —
      </button>
    );
  }

  const at = papicHeadPosition({ live, ...shown }) as PapicHeadPosition;

  const pick = (key: string) => {
    const to = PAPIC_HEAD_OPTIONS.find((o) => o.key === key)?.key;
    if (!to || pending || to === at) return;
    const writes = papicHeadWrites(to, stored.current);
    const next = {
      draftOn: writes.papic_on ?? stored.current.draftOn,
      early: writes.papic_guest_capture_early ?? stored.current.early,
    };
    setShown(next);
    say.line(papicHeadLine({ live, ...next }));
    say.problem(null);
    start(async () => {
      let refused: string | null = null;
      // 1 · papic_on — the draft, the Papic switch's own door (Apply makes it live).
      if (writes.papic_on !== undefined) {
        let ok = false;
        if (standIn) ok = standIn === 'ok';
        else {
          try {
            const fd = new FormData();
            fd.set('intent', 'save');
            fd.set('patch', JSON.stringify({ events: { papic_on: writes.papic_on } }));
            ok = (await makerSave(() => hubDraftAction(eventId, fd), requestMakerRefresh)).ok;
          } catch {
            ok = false;
          }
        }
        if (ok) stored.current = { ...stored.current, draftOn: writes.papic_on };
        else refused = NOT_SAVED;
      }
      // 2 · papic_guest_capture_early — live, through the shipped action, in place.
      if (refused === null && writes.papic_guest_capture_early !== undefined) {
        let answer: { ok: true } | { ok: false; error: string };
        if (standIn) answer = standIn === 'ok' ? { ok: true } : { ok: false, error: NOT_SAVED };
        else {
          const fd = new FormData();
          fd.set('event_id', eventId);
          fd.set('early', writes.papic_guest_capture_early ? '1' : '0');
          fd.set('return_to', 'home');
          answer = await papicSaveInPlace('setPapicGuestCaptureEarly', fd).catch(() => ({ ok: false as const, error: NOT_SAVED }));
        }
        if (answer.ok) stored.current = { ...stored.current, early: writes.papic_guest_capture_early };
        else refused = answer.error;
      }
      if (refused !== null) {
        setShown(stored.current);
        say.line(papicHeadLine({ live, ...stored.current }));
        say.problem(refused);
      }
    });
  };

  return (
    <span data-papic-head-pick={at} aria-busy={pending || undefined} className="inline-flex">
      <PickMenu
        label={PAPIC_HEAD_LABEL}
        value={at}
        options={PAPIC_HEAD_OPTIONS.map((o) => ({ key: o.key, label: o.label }))}
        buttonText={PAPIC_HEAD_OPTIONS.find((o) => o.key === at)?.short}
        onPick={pick}
        compact
        dataAttr="data-papic-head-button"
      />
    </span>
  );
}
