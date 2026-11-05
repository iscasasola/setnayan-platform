'use client';

import { useEffect, useRef, useState } from 'react';
import { InfoTip } from '@/app/_components/info-tip';
import { useKeyboardRide } from '@/lib/keyboard-ride';
import { NAME_CORRECTION_FIELD, NAME_CORRECTION_MAX, readNameCorrection } from '@/lib/rsvp-you-step';

/**
 * "WRONG NAME? TELL THE COUPLE" — the You step's one door out of a name that is not theirs (owner 2026-10-25, the
 * RSVP-seats-first prototype, decision 1 "as recommended": *always works, even when the event's note question is
 * off*).
 *
 * 🔒 THE NAME STAYS HOST-ONLY (2026-08-01, `seedBindAllowed`): the link may be printed on a poster, so nothing here
 * edits `first_name` / `last_name`. What the guest types rides with the reply as ONE field, and `submitRsvp` adds it
 * to the note the couple already reads (`guests.guest_note`, `withNameCorrection`) — no new column, no new action.
 *
 * The draft in the sheet posts nothing until "Add to my reply": only the hidden input carries a value, so a typed
 * and cancelled correction is never sent. Without script the button does nothing and the reply sends as before.
 */
export function RsvpNameCorrection({ theOrganizer }: { /** "the couple" / "the family". */ theOrganizer: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const draftRef = useRef<HTMLInputElement>(null);
  const [sent, setSent] = useState('');
  const keyboard = useKeyboardRide();

  const close = () => dialogRef.current?.close();
  const commit = () => {
    setSent(readNameCorrection(draftRef.current?.value ?? ''));
    close();
  };

  /* ⏎ Enter in the sheet adds the line — and never reaches the form, whose own Enter moves to the next question
     (`RsvpOneAtATime`). A NATIVE listener: React's handler runs at the root, after the form has already heard it. */
  useEffect(() => {
    const input = draftRef.current;
    if (!input) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      e.stopPropagation();
      commit();
    };
    input.addEventListener('keydown', onKey);
    return () => input.removeEventListener('keydown', onKey);
  });

  return (
    <div className="space-y-1" data-rsvp-name-correction="">
      <input type="hidden" name={NAME_CORRECTION_FIELD} value={sent} />
      <button
        type="button"
        className="min-h-11 text-sm text-ink underline decoration-ink/35 underline-offset-[3px]"
        onClick={() => {
          if (draftRef.current) draftRef.current.value = sent;
          dialogRef.current?.showModal();
          // The box, not the ⓘ (the dialog's first control), takes the focus — the guest came here to type.
          draftRef.current?.focus();
        }}
        data-rsvp-wrong-name=""
      >
        Wrong name? Tell {theOrganizer}
      </button>
      {sent ? (
        <p className="text-xs text-ink/70" data-rsvp-name-correction-sent="">
          Goes with your reply: “{sent}”
        </p>
      ) : null}
      <dialog
        ref={dialogRef}
        aria-labelledby="rsvp-name-correction-title"
        /* A modal <dialog> stands in the top layer, fixed over the whole screen; the sheet sits on the screen's foot
           and RIDES the keyboard through the one keyboard reading (`useKeyboardRide`): while the keyboard is up its
           foot is the keyboard's top, so "How should your name read?" is never typed blind. */
        className="w-full rounded-t-2xl bg-cream px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3.5 text-ink shadow-[0_-14px_40px_rgba(0,0,0,0.12)] backdrop:bg-ink/20"
        style={{ top: 'auto', left: 0, right: 0, bottom: keyboard.open ? keyboard.bottom : 0, margin: '0 auto', maxWidth: 'min(100%, 28rem)' }}
      >
        <span aria-hidden className="mx-auto mb-4 block h-1 w-10 rounded-full bg-ink/15" />
        <p id="rsvp-name-correction-title" className="font-serif text-2xl font-medium leading-tight text-ink">
          Tell {theOrganizer}
        </p>
        <InfoTip
          label={`Only ${theOrganizer} can change a name on the list.`}
          labelClassName="text-sm text-ink/70"
          className="mt-1.5"
          align="start"
          ariaLabel="Why the name is not edited here"
        >
          Your link may be printed or shared, so a name is never edited from here. This goes to {theOrganizer} with your
          reply; they fix it from their Guest list.
        </InfoTip>
        <label htmlFor="rsvp_name_correction_draft" className="mt-5 block text-sm font-medium text-ink">
          How should your name read?
        </label>
        <input
          ref={draftRef}
          id="rsvp_name_correction_draft"
          type="text"
          maxLength={NAME_CORRECTION_MAX}
          autoComplete="off"
          placeholder="e.g. Maria Teresita Aquino-Reyes"
          className="input-field mt-1.5"
        />
        <button type="button" className="button-primary mt-5 min-h-[48px] w-full" onClick={commit}>
          Add to my reply
        </button>
        <p className="mt-2 text-center">
          <button type="button" className="min-h-11 px-3 text-sm text-ink/70 underline underline-offset-[3px]" onClick={close}>
            Cancel
          </button>
        </p>
      </dialog>
    </div>
  );
}
