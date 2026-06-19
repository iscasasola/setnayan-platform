'use client';

import { useState } from 'react';
import { Sparkles, Check } from 'lucide-react';
import { SelfieCapture } from './selfie-capture';
import { enrollGuestFace } from '@/app/papic/face-enroll-actions';

// "Register your face if you haven't yet" — the day-of catch for a guest who
// skipped the optional RSVP selfie. Wraps the same SelfieCapture (consent +
// front camera + on-device fingerprint) in a standalone form posting to the
// cookie-authenticated enrollGuestFace action. Shown on the live day-of landing
// page and, as a fallback, inside the guest camera. Self-hides once enrolled.
//
// Face auto-tagging is DORMANT until a model is hosted, but the selfie still
// enrolls (image + fingerprint-when-available) so the guest is ready the moment
// it activates — and QR-scan tagging is the fallback either way.

export function DayOfFaceEnroll({
  context = 'day_of',
  onDone,
  onSkip,
}: {
  /** Free-text provenance stored as consent_source (e.g. 'day_of', 'guest_camera'). */
  context?: string;
  /** Called after a successful enroll (e.g. to resume the camera). */
  onDone?: () => void;
  /** When provided, renders a "Not now" dismiss (used in the camera fallback). */
  onSkip?: () => void;
}) {
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'saving' | 'done'>('idle');

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

  if (phase === 'done') {
    return (
      <section className="rounded-2xl border border-success-200 bg-success-50/60 p-5 text-center shadow-sm sm:p-6">
        <Check aria-hidden className="mx-auto h-7 w-7 text-success-600" strokeWidth={1.75} />
        <h2 className="mt-2 text-lg font-semibold tracking-tight text-ink">
          You&rsquo;re set
        </h2>
        <p className="mx-auto mt-1 max-w-prose text-sm text-ink/65">
          Your candid photos will find their way to you. Look for &ldquo;Photos
          of you&rdquo; right here as the celebration unfolds.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-ink/10 bg-cream p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-2">
        <Sparkles aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" strokeWidth={1.75} />
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
            So your photos find you
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">
            Add your face
          </h2>
          <p className="mt-1 text-sm text-ink/65">
            Take one selfie and the candid shots of you get gathered for you
            automatically — no scanning, no searching.
          </p>
        </div>
      </div>

      <form action={submit} className="mt-4 space-y-4">
        <input type="hidden" name="enroll_context" value={context} />
        <SelfieCapture onReadyChange={setReady} />

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
    </section>
  );
}
