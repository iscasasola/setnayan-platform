'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { SelfieCapture, type SelfieShot } from './selfie-capture';
import { enrollGuestFace, recordFaceTaggingWish } from '@/app/papic/face-enroll-actions';
import type { PapicFaceMode } from '@/lib/papic-face-mode';
import type { FaceTaggingWish } from '@/lib/face-tagging-wish';
import { FACE_STEP_SAVED, faceStepFailureWords } from '@/lib/face-enroll-refusal';

// THE FACE SCREEN'S SAVE — the approved design
// `prototypes/face_registration_2026-09-30_fable.html` (owner 2026-09-30).
//
// SelfieCapture draws the screen (frames A–C); this saves the shot:
//   D · saved → the screen goes, a toast says "You're set — erased when you
//       sign out or Papic closes." and fades; the guest is back where they
//       were (Me shows "Face tagging · On");
//   E · failed → they STAY on the camera, tick kept, and the toast names the
//       reason in a few words: "Couldn't save — no face found. Try again".
//       A failure never looks like success — a real guest (Claire) ticked,
//       shot and saw nothing happen because her event was mode_b.
//   F · no Papic, or face tagging off → no screen at all (`faceMode` mode_b
//       renders nothing; the parents only mount this where it is askable).
//
// ⚖ The tick + the shot ARE the "Yes, tag me" (owner 2026-09-29: the selfie
// depends only on whether the guest wants to be tagged) — a never-answered
// guest's Yes is stored before the save, because the server enrols only a
// stored Yes. × is "not now": the answer stays as it was. A stored "No thanks"
// renders nothing.

/** The words SelfieCapture reports when the camera cannot open. */
const CAMERA_BLOCKED = 'camera blocked';

/** How long the saved toast stays before the parent is told (frame D). */
const SAVED_TOAST_MS = 2500;

export function DayOfFaceEnroll({
  context = 'day_of',
  onDone,
  onSkip,
  onDecline,
  faceMode = 'mode_b',
  wish = null,
}: {
  /** Free-text provenance stored as consent_source (e.g. 'day_of', 'guest_camera', 'me'). */
  context?: string;
  /** Called once the saved toast has been seen (e.g. to resume the camera). */
  onDone?: () => void;
  /** × — not now. */
  onSkip?: () => void;
  /** Server-resolved effective face mode. Fail-closed default: mode_b. */
  faceMode?: PapicFaceMode;
  /** Kept for the parents' "hide every face prompt" hook; × falls back to it. */
  onDecline?: () => void;
  /** `guests.face_tagging_wanted`: null never answered · true yes · false no. */
  wish?: FaceTaggingWish;
}) {
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // A blocked camera is retried by opening the camera again (a fresh screen).
  const [attempt, setAttempt] = useState(0);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (doneTimer.current) clearTimeout(doneTimer.current);
    },
    [],
  );

  const fail = useCallback((words: string) => setFailure(words), []);

  const save = useCallback(
    async (shot: SelfieShot) => {
      setSaving(true);
      setFailure(null);
      try {
        if (wish !== true) {
          const answered = await recordFaceTaggingWish(true);
          if (!answered.ok) {
            fail(faceStepFailureWords('not_wanted'));
            return;
          }
        }
        const fd = new FormData();
        fd.set('enroll_context', context);
        fd.set('selfie_ref', shot.ref);
        if (shot.vector) fd.set('selfie_vector', JSON.stringify(shot.vector));
        if (shot.quality) fd.set('selfie_quality', JSON.stringify(shot.quality));
        // The one tick covers both statements (the ⓘ sheet says both).
        fd.set('biometric_consent', '1');
        fd.set('age_affirmation', '1');
        const res = await enrollGuestFace(fd);
        if (!res.ok) {
          fail(faceStepFailureWords(res.reason));
          return;
        }
        setDone(true);
        doneTimer.current = setTimeout(() => onDone?.(), SAVED_TOAST_MS);
      } catch {
        fail(faceStepFailureWords('save'));
      } finally {
        setSaving(false);
      }
    },
    [context, fail, onDone, wish],
  );

  if (faceMode !== 'mode_a' || wish === false) return null;

  if (done) {
    return (
      <div
        role="status"
        data-face-step-toast="ok"
        className="fixed inset-x-4 bottom-20 z-[70] mx-auto flex max-w-md items-start gap-2 rounded-2xl bg-ink px-4 py-3 text-sm text-cream shadow-lg"
      >
        <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" strokeWidth={2.5} />
        <span>{FACE_STEP_SAVED}</span>
      </div>
    );
  }

  const failureToast = failure ? (
    <div
      role="alert"
      data-face-step-toast="fail"
      className="mx-4 mb-3 flex items-center gap-2 rounded-2xl bg-[#6e1f33] px-4 py-3 text-sm text-cream shadow-lg"
    >
      <span aria-hidden className="font-bold">!</span>
      <span className="min-w-0 flex-1">
        {failure === CAMERA_BLOCKED ? 'Camera blocked — allow it, then' : <>Couldn&rsquo;t save — {failure}.</>}{' '}
        <button
          type="button"
          onClick={() => {
            if (failure === CAMERA_BLOCKED) setAttempt((n) => n + 1);
            setFailure(null);
          }}
          className="font-medium underline underline-offset-2"
        >
          Try again
        </button>
      </span>
    </div>
  ) : null;

  return (
    <SelfieCapture
      key={attempt}
      faceMode={faceMode}
      onShot={save}
      onFail={fail}
      onClose={() => (onSkip ?? onDecline)?.()}
      saving={saving}
      toast={failureToast}
    />
  );
}
