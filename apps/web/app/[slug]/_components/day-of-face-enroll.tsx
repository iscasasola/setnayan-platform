'use client';

import { useEventWords, WORDS_AS_SHIPPED } from './event-words-provider';

import { useState } from 'react';
import { Sparkles, Check } from 'lucide-react';
import { SelfieCapture } from './selfie-capture';
import { enrollGuestFace, recordFaceTaggingWish } from '@/app/papic/face-enroll-actions';
import type { PapicFaceMode } from '@/lib/papic-face-mode';
import {
  FACE_TAGGING_NO,
  FACE_TAGGING_QUESTION,
  FACE_TAGGING_YES,
  faceTaggingHint,
  type FaceTaggingWish,
} from '@/lib/face-tagging-wish';

// "Register your face if you haven't yet" — the day-of catch for a guest who
// skipped the optional RSVP selfie. Wraps the same SelfieCapture (consent +
// front camera + on-device fingerprint) in a standalone form posting to the
// cookie-authenticated enrollGuestFace action. Shown on the live day-of landing
// page and, as a fallback, inside the guest camera. Self-hides once enrolled.
//
// Face auto-tagging is DORMANT until a model is hosted, but the selfie still
// enrolls (image + fingerprint-when-available) so the guest is ready the moment
// it activates — and QR-scan tagging is the fallback either way.
//
// ⚖ ONE QUESTION FIRST (owner 2026-09-29: *"it should only depend if they want
// to be tagged"*). A guest who never answered "Want to be tagged in the
// photos?" is asked exactly that — Yes, tag me / No thanks — and the selfie
// appears only after Yes. "No thanks" is stored and closes the card, and the
// parents never mount it again for that guest (`dayOfFaceCatchShows`,
// lib/face-tagging-wish.ts). A guest who already said yes goes straight to the
// selfie. Nobody is shown the selfie without choosing it.

export function DayOfFaceEnroll({
  context = 'day_of',
  onDone,
  onSkip,
  onDecline,
  faceMode = 'mode_b',
  wish = null,
}: {
  /** Free-text provenance stored as consent_source (e.g. 'day_of', 'guest_camera'). */
  context?: string;
  /** Called after a successful enroll (e.g. to resume the camera). */
  onDone?: () => void;
  /** When provided, renders a "Not now" dismiss (used in the camera fallback). */
  onSkip?: () => void;
  /** Server-resolved effective face mode, threaded to SelfieCapture so mode_b
   *  computes/transmits NO descriptor. Fail-closed default: mode_b. */
  faceMode?: PapicFaceMode;
  /** Called after "No thanks" is chosen — the parent hides every face prompt
   *  for the rest of the visit. Falls back to `onSkip`. */
  onDecline?: () => void;
  /** The guest's stored answer (`guests.face_tagging_wanted`). `null` — never
   *  answered — asks the one question first; `true` goes straight to the
   *  selfie; `false` renders nothing (a guest who said no is not nagged).
   *  Defaults to `null`, so a mount that forgets it ASKS rather than shows the
   *  selfie unasked. */
  wish?: FaceTaggingWish;
}) {
  // The event's own word for whoever is throwing it. Falls back to the exact
  // wording this surface shipped with, so a missing provider cannot regress a
  // real wedding — event-words-mounted.test.ts is what stops that hiding.
  const w = useEventWords() ?? WORDS_AS_SHIPPED;
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'saving' | 'done'>('idle');
  // 'ask' until the guest chooses; a stored yes skips straight to the selfie.
  const [step, setStep] = useState<'ask' | 'selfie' | 'declined'>(
    wish === true ? 'selfie' : wish === false ? 'declined' : 'ask',
  );

  function choose(yes: boolean) {
    // Best-effort: the answer is saved in the background, and the screen moves
    // on either way — a failed save only means the question comes back once.
    void recordFaceTaggingWish(yes);
    if (yes) {
      setStep('selfie');
    } else {
      setStep('declined');
      (onDecline ?? onSkip)?.();
    }
  }

  async function submit(formData: FormData) {
    setPhase('saving');
    const res = await enrollGuestFace(formData);
    if (res.ok) {
      setPhase('done');
      onDone?.();
    } else {
      setPhase('idle');
    }
  }

  // "No thanks" asks nothing more — not the selfie, not a second question.
  if (step === 'declined') return null;

  if (phase === 'done') {
    return (
      <section className="rounded-2xl border border-gild bg-veil/60 p-5 text-center shadow-sm sm:p-6">
        <Check aria-hidden className="mx-auto h-7 w-7 text-gild" strokeWidth={1.75} />
        <h2 className="mt-2 text-lg font-semibold tracking-tight text-ink">
          You&rsquo;re set
        </h2>
        {/* ⚠ The promise has to follow the event, like the consent box it sits
            above. This card RECEIVES `faceMode` and always did — it just never
            used it for its own words, so on an event with matching switched off
            it promised photos would arrive by themselves while the checkbox two
            inches below said no recognition runs. The two contradicted each
            other on one screen. */}
        <p className="mx-auto mt-1 max-w-prose text-sm text-ink/65">
          {faceMode === 'mode_a' ? (
            <>
              Your candid photos will find their way to you. Look for &ldquo;Photos
              of you&rdquo; right here as the {w.occasion} unfolds.
            </>
          ) : (
            <>
              Your photo is on the guest list now. Look for &ldquo;Photos of
              you&rdquo; right here — pictures arrive when someone scans your QR or
              tags you.
            </>
          )}
        </p>
      </section>
    );
  }

  // THE ONE QUESTION — drawn in the same card the selfie uses, so the step
  // swaps its contents rather than stacking a second box. No selfie here.
  const question = (
    <>
      <div className="flex items-start gap-2">
        <Sparkles aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" strokeWidth={1.75} />
        <h2 className="text-lg font-semibold tracking-tight text-ink">{FACE_TAGGING_QUESTION}</h2>
      </div>
      <p className="mt-1 text-sm text-ink/65">{faceTaggingHint(faceMode, w.theOrganizer)}</p>
      <div data-face-tagging-choice className="mt-4 grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={() => choose(true)}
          className="min-h-12 rounded-full bg-mulberry px-5 text-base font-medium text-cream transition hover:bg-mulberry-600"
        >
          {FACE_TAGGING_YES}
        </button>
        <button
          type="button"
          onClick={() => choose(false)}
          className="min-h-12 rounded-full bg-ink/[0.05] px-5 text-base font-medium text-ink transition hover:bg-ink/10"
        >
          {FACE_TAGGING_NO}
        </button>
      </div>
    </>
  );

  return (
    <section className="rounded-2xl border border-ink/10 bg-cream p-5 shadow-sm sm:p-6">
      {step === 'ask' ? question : (
      <>
      <div className="flex items-start gap-2">
        <Sparkles aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" strokeWidth={1.75} />
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
            {faceMode === 'mode_a' ? 'So your photos find you' : 'So people know you'}
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">
            {faceMode === 'mode_a' ? 'Add your face' : 'Add your photo'}
          </h2>
          <p className="mt-1 text-sm text-ink/65">
            {faceMode === 'mode_a' ? (
              <>
                Take a few quick selfies — or upload up to 3 photos — and the candid
                shots of you get gathered for you automatically. No scanning, no
                searching.
              </>
            ) : (
              <>
                Take a quick selfie — or upload a photo — so {w.theOrganizer} and their
                team can recognize you. Pictures reach you when someone scans your
                QR or tags you.
              </>
            )}
          </p>
        </div>
      </div>

      <form action={submit} className="mt-4 space-y-4">
        <input type="hidden" name="enroll_context" value={context} />
        <SelfieCapture onReadyChange={setReady} multiShot faceMode={faceMode} />

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!ready || phase === 'saving'}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream transition hover:bg-mulberry-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {phase === 'saving' ? 'Saving…' : 'Save my face'}
          </button>
          {onSkip ? (
            <button
              type="button"
              onClick={onSkip}
              className="text-sm font-medium text-ink/55 hover:text-ink/80"
            >
              Not now
            </button>
          ) : null}
        </div>
      </form>
      </>
      )}
    </section>
  );
}
