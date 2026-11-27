'use client';

import { useState, type ReactNode } from 'react';
import { SubmitButton } from '@/app/_components/submit-button';
import { LIVE_EMPTY_CODE_LINE } from '../_lib/connect-words';


/**
 * The Connect form of `/live` (final check A4-B04, approved drawing § 04, 25 Nov 2026).
 *
 * Pressing Connect shows pressed AT ONCE and STAYS pressed until the page answers: the shared `SubmitButton` dims,
 * reads "Connecting…" and cannot be pressed twice, and the field locks — where the TV used to sit unchanged for up to
 * a minute with nothing to say it heard the press. The form holds that state itself (`SubmitButton`'s `pending`):
 * measured in a browser, the form status fell back to "Connect" a few milliseconds after the press while the request
 * ran on for seconds. The page remounts this form with every answer (its `key`), so the answer always unlocks it.
 *
 * No spinner and no veil — a venue screen shows its words alone. An empty press is answered here, under the field,
 * never by the browser's bubble (`noValidate`) and without a trip to the server; the action keeps the same answer for
 * a screen with no script.
 */
export type ConnectLook = {
  /** The Connect button; its pressed state dims through `data-[pending=true]`. */
  button: string;
  /** The page's one answer line. */
  alert: string;
};

export function ConnectForm({
  action,
  prefill,
  message,
  look,
  field,
}: {
  action: (formData: FormData) => Promise<void>;
  prefill: string;
  /** The page's answer (the shipped messages), drawn under the form in the page's one alert line. */
  message: string | null;
  look: ConnectLook;
  /** The code field, drawn by the page (the venue screen's own big box). It is locked on submit through the form's own
   *  element, `form.elements.code` — the page remounts this form with every answer, which unlocks it. */
  field: ReactNode;
}) {
  const [sent, setSent] = useState(false);
  const [empty, setEmpty] = useState(false);
  return (
    <>
      <form
        action={action}
        noValidate
        onSubmit={(e) => {
          const code = new FormData(e.currentTarget).get('code');
          if (String(code ?? '').trim() === '') {
            e.preventDefault();
            setEmpty(true);
            return;
          }
          setEmpty(false);
          setSent(true);
          const box = e.currentTarget.elements.namedItem('code');
          if (box instanceof HTMLInputElement) {
            box.readOnly = true;
            box.setAttribute('aria-readonly', 'true');
          }
        }}
        className="mt-10 flex w-full max-w-md flex-col items-stretch gap-4"
      >
        {field}
        <SubmitButton
          pending={sent}
          overlay={false}
          pendingLabel="Connecting…"
          className={look.button}
        >
          Connect
        </SubmitButton>
      </form>
      {empty || message ? (
        <p role="alert" className={look.alert}>
          {empty ? LIVE_EMPTY_CODE_LINE : message}
        </p>
      ) : null}
    </>
  );
}
