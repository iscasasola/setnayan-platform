'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePapicHead } from '@/app/dashboard/[eventId]/_components/papic-home-card';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { pickButtonClass } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-place';
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
/** 📏 The open list's least width — "On — everyone, now" on one line (owner-approved 2026-10-30: options never wrap). */
export const PAPIC_HEAD_MENU_MIN_WIDTH = 232;

/**
 * 📷 THE PAPIC CARD'S HEAD — ONE DROPDOWN, THREE POSITIONS (owner 2026-10-30: *"the switch on event home should be the let
 * everybody shoot now function"* · *"If we cannot turn it off, then maybe assign partial turn on?"*):
 * **Off · On — event day · On — everyone, now**. The rules and the writes are `lib/papic-shoot-now.ts`.
 *
 *   · ONE `PickMenu`, compact — a set of choices is one dropdown, never a pill row or a second switch.
 *   · ⚡ LIVE — NO APPLY (owner 2026-11-22, "THE PAPIC DROPDOWN IN MEMORIES IS LIVE — NO APPLY"): `papic_on` and
 *     `papic_guest_capture_early` go in ONE live write through the shipped `setPapicGuestCaptureEarly`, in place
 *     (`papicSaveInPlace`) — no navigation, the screen never resets. That action clears any `papic_on` still waiting in
 *     the Event Hub draft and re-renders the card, so the couple's camera button follows without a reload.
 *   · The line under the title follows the pick at once (`usePapicHead`). A refused write puts the position and the line
 *     back to what IS stored (a first write that landed stays landed) and says why under the head — in the card's flow.
 *   · Unread (`live` or `early` null) → the button is disabled and the line says "Couldn’t check just now".
 *
 * `standIn` is the dev lab's only (`/dev/home-lab?card=1&head=…`): picks are answered with no server — 'ok' saves,
 * 'fail' refuses. Production never passes it.
 */
export function PapicHeadPicker({
  eventId,
  live,
  early,
  hints,
  standIn,
}: {
  eventId: string;
  /** `events.papic_on` as guests see it now. */
  live: boolean | null;
  /** `events.papic_guest_capture_early`. */
  early: boolean | null;
  /** Each choice's sub-line, from the gate (`papicHeadHints`) — the drawing's "cameras open Fri 18 Dec". */
  hints?: Partial<Record<PapicHeadPosition, string>>;
  standIn?: 'ok' | 'fail';
}) {
  const say = usePapicHead();
  const unread = papicHeadPosition({ live, early }) === null;
  const [shown, setShown] = useState({ on: live === true, early: early === true });
  const stored = useRef({ on: live === true, early: early === true });
  const [pending, start] = useTransition();
  /* 🔁 New facts from the server are the truth — the line goes back to the server's, never mid-save. */
  useEffect(() => {
    if (pending || unread) return;
    stored.current = { on: live === true, early: early === true };
    setShown(stored.current);
    say.line(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- follows the saved facts only
  }, [early, live]);

  if (unread) {
    return (
      <button type="button" disabled aria-label={`${PAPIC_HEAD_LABEL}: couldn’t check`} className={`${pickButtonClass(true)} opacity-50`} data-papic-head-pick="unread">
        —
      </button>
    );
  }

  const at = papicHeadPosition({ live: shown.on, early: shown.early }) as PapicHeadPosition;

  const pick = (key: string) => {
    const to = PAPIC_HEAD_OPTIONS.find((o) => o.key === key)?.key;
    if (!to || pending || to === at) return;
    const writes = papicHeadWrites(to, stored.current);
    const next = {
      on: writes.papic_on ?? stored.current.on,
      early: writes.papic_guest_capture_early ?? stored.current.early,
    };
    setShown(next);
    say.line(papicHeadLine({ live: next.on, early: next.early }));
    say.problem(null);
    start(async () => {
      // ⚡ ONE live write for both columns — `papic_on` and the early column land together or not at all.
      let answer: { ok: true } | { ok: false; error: string };
      if (standIn) answer = standIn === 'ok' ? { ok: true } : { ok: false, error: NOT_SAVED };
      else {
        const fd = new FormData();
        fd.set('event_id', eventId);
        if (writes.papic_on !== undefined) fd.set('papic_on', writes.papic_on ? '1' : '0');
        if (writes.papic_guest_capture_early !== undefined) fd.set('early', writes.papic_guest_capture_early ? '1' : '0');
        fd.set('return_to', 'memories'); // the card's seat since 2026-11-08 (papicSeatBack)
        answer = await papicSaveInPlace('setPapicGuestCaptureEarly', fd).catch(() => ({ ok: false as const, error: NOT_SAVED }));
      }
      if (answer.ok) stored.current = next;
      else {
        setShown(stored.current);
        say.line(papicHeadLine({ live: stored.current.on, early: stored.current.early }));
        say.problem(answer.error);
      }
    });
  };

  return (
    <span data-papic-head-pick={at} aria-busy={pending || undefined} className="inline-flex">
      <PickMenu
        label={PAPIC_HEAD_LABEL}
        value={at}
        options={PAPIC_HEAD_OPTIONS.map((o) => ({ key: o.key, label: o.label, hint: hints?.[o.key] }))}
        // The pill says the choice in full ("On — event day"), as the approved Memories drawing draws it (20 Nov).
        buttonText={PAPIC_HEAD_OPTIONS.find((o) => o.key === at)?.label}
        onPick={pick}
        compact
        // The drawn pill's frame in light too (the shared pick sets it only in dark) — it sits on the white block.
        className="border border-ink/15"
        menuMinWidth={PAPIC_HEAD_MENU_MIN_WIDTH}
        dataAttr="data-papic-head-button"
      />
    </span>
  );
}
