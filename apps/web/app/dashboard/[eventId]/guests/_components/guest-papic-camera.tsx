'use client';

import { useEffect, useState } from 'react';
import { FORM_PICK_CLASS, FormRow, TypedRow, usePillWidth } from '@/app/_components/form-row';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import {
  GUEST_CAMERA_ABOUT,
  GUEST_CAMERA_CHOICES,
  GUEST_CAMERA_LINES,
  GUEST_CAMERA_NEEDS_NUMBER,
  GUEST_CAMERA_WORDS,
  checkGuestCredits,
  guestCameraOf,
  guestCameraPost,
  guestCameraRefusal,
  type GuestCamera,
} from '@/lib/papic-guest-camera';
import { useGuestActions } from './guest-actions-context';

/**
 * guest-papic-camera.tsx — "Their camera ▾" on the guest card's Papic row (owner 2026-10-23; prototype
 * `guest_card_groups_and_papic_2026-10-23.html`, frame 3). ONE dropdown, three choices, each one value of the SHIPPED
 * ceiling (`lib/papic-guest-camera.ts`), written by the SHIPPED action (`setGuestAllotment`, quiet) — no new storage and
 * no second writer.
 *
 * 🔑 NOT PART OF THE CARD'S FORM. The ceiling is its own write (an RPC under a row lock), so nothing here has a `name`
 * and its events stop here — a tap never wakes the card's autosave, as `CardRename` does.
 *
 *   · Shares with everyone / No camera — saved on the tap.
 *   · A set number — opens "Credits"; nothing is saved until a number is kept (a choice with no figure would be a guess).
 *   · A save that did not land puts the dropdown back and says so on the row — never the look of success.
 *
 * Handed in by the Guests pages (`PapicCamera`), never imported by `GuestCardBody` — the Maker's first load stays as it is.
 */
export function GuestPapicCamera({ eventId, guestId, ceiling }: { eventId: string; guestId: string; ceiling: number | null }) {
  const { setGuestAllotment } = useGuestActions();
  const width = usePillWidth();
  /** What the row holds (the last save that landed). */
  const [saved, setSaved] = useState<number | null>(ceiling);
  /** What the dropdown shows — "A set number" may be showing before its figure is kept. */
  const [camera, setCamera] = useState<GuestCamera>(guestCameraOf(ceiling));
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    setSaved(ceiling);
    setCamera(guestCameraOf(ceiling));
  }, [ceiling]);

  const save = async (allotment: string): Promise<string | null> => {
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('guest_id', guestId);
    fd.set('allotment', allotment);
    fd.set('quiet', '1');
    try {
      const res = await setGuestAllotment(fd);
      if (res && 'refused' in res) return guestCameraRefusal(res.refused);
      return null;
    } catch {
      return 'Couldn’t save — check your connection and try again.';
    }
  };

  const pick = async (key: string) => {
    const next = key as GuestCamera;
    if (next === camera) return;
    setProblem(null);
    setCamera(next);
    if (next === 'set') return; // the figure is asked for below; nothing changes until it is kept
    const why = await save(guestCameraPost(next));
    if (why) {
      setCamera(guestCameraOf(saved));
      setProblem(why);
      return;
    }
    setSaved(next === 'none' ? 0 : null);
  };

  const keepCredits = async (text: string) => {
    const n = Number(text.trim());
    if (text.trim() === '' || !Number.isInteger(n) || n < 1) return { ok: false as const, error: 'A whole number, 1 or more.' };
    const why = await save(guestCameraPost('set', n));
    if (why) return { ok: false as const, error: why };
    setSaved(n);
    setProblem(null);
    return { ok: true as const };
  };

  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  return (
    <div data-guest-papic-camera="" onInput={stop} onChange={stop} className="contents">
      <FormRow
        name="Their camera"
        about={{ words: GUEST_CAMERA_ABOUT }}
        /* A set number with no figure yet says so — never the look of a saved choice. */
        line={camera === 'set' && !(saved !== null && saved > 0) ? GUEST_CAMERA_NEEDS_NUMBER : GUEST_CAMERA_LINES[camera]}
        problem={problem}
        data="card-papic-camera"
        attrs={{ 'data-card-field': 'papic_camera' }}
      >
        <PickMenu
          label="Their camera"
          value={camera}
          options={GUEST_CAMERA_CHOICES.map((c) => ({ key: c, label: GUEST_CAMERA_WORDS[c] }))}
          onPick={(k) => void pick(k)}
          className={`${FORM_PICK_CLASS} ${width}`}
        />
      </FormRow>
      {camera === 'set' ? (
        <TypedRow
          name="Credits"
          value={saved !== null && saved > 0 ? String(saved) : ''}
          empty={GUEST_CAMERA_NEEDS_NUMBER}
          placeholder="e.g. 50"
          inputMode="numeric"
          maxLength={6}
          check={checkGuestCredits}
          onKeep={keepCredits}
          about={{ words: 'The most this guest may take. It never holds credits back — what they don’t use stays theirs.' }}
          data="card-papic-credits"
          attrs={{ 'data-card-field': 'papic_credits' }}
        />
      ) : null}
    </div>
  );
}
