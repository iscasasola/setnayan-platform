'use client';

import dynamic from 'next/dynamic';
import { UploadYourQr } from './upload-your-qr';
import { DOOR_CHOICE, DOOR_CHOICE_CLASS } from './door-choice-words';

/**
 * 🚪 THE THREE CHOICES BEHIND "OPEN YOUR INVITATION" (owner 2026-11-03, DECISION_LOG "THE GUEST DOOR IS ONE BUTTON"):
 *
 *   · **Scan QR** — the live camera (`lib/use-live-qr-scan.ts`, the camera half the Find-a-seat scanner shares);
 *   · **Upload QR** — the phone's picker, decoded on the phone (`upload-your-qr.tsx`, its two messages unchanged);
 *   · **Lost QR? Login** — the shipped sign-in, back to this event (`signIn`, with `next`).
 *
 * A code read by the camera goes where an uploaded one goes (`uploadedQrTarget`): this event's key, on THIS site, so
 * the ordinary redeem → RSVP-first flow runs. A code for another event says so and the camera keeps looking.
 * The same three, in the same words, behind a listed guest's "Not [name]? Switch account".
 *
 * 📦 THE CAMERA LOADS WHEN IT IS NEEDED (`next/dynamic`): the door is drawn on the Maker's canvas too, whose first-load
 * JavaScript has a budget (`scripts/check-maker-js-budget.mjs`). Until its chunk arrives, the same button is drawn.
 */
const ScanYourQr = dynamic(() => import('./scan-your-qr').then((m) => m.ScanYourQr), {
  loading: () => <ScanButtonAtRest />,
});

/** The "Scan QR" button exactly as the scanner draws it at rest — so the first screen never changes as it loads. */
function ScanButtonAtRest() {
  return (
    <div className="space-y-2" data-door-choice="scan">
      <button type="button" className={DOOR_CHOICE_CLASS}>
        {DOOR_CHOICE.scan}
      </button>
    </div>
  );
}
export function DoorChoices({ slug, signIn }: { slug: string | null; signIn: string }) {
  return (
    <div className="space-y-3" data-door-choices="">
      {slug ? <ScanYourQr slug={slug} /> : null}
      {slug ? <UploadYourQr slug={slug} /> : null}
      <a
        href={signIn}
        data-door-choice="login"
        className="flex min-h-[48px] w-full items-center justify-center text-sm font-medium text-ink underline underline-offset-4"
      >
        {DOOR_CHOICE.login}
      </a>
    </div>
  );
}
