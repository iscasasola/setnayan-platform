'use client';

// The lab's client half: the real face screen and its real toasts, one state per `?state=`.

import { useSearchParams } from 'next/navigation';
import { SelfieCapture } from '@/app/[slug]/_components/selfie-capture';
import { FaceStepFailureToast, FaceStepSavedToast } from '@/app/[slug]/_components/day-of-face-enroll';
import { FaceTaggingRow } from '@/app/[slug]/_components/face-tagging-row';
import { faceStepFailureWords } from '@/lib/face-enroll-refusal';

type Capture = typeof SelfieCapture;

const noop = () => {};

export function SelfieLab({ Capture = SelfieCapture }: { Capture?: Capture }) {
  const state = useSearchParams().get('state') ?? 'open';

  if (state === 'done' || state === 'row') {
    return (
      <main className="min-h-[100dvh] bg-cream px-4 pt-[max(1.5rem,env(safe-area-inset-top))] text-ink">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink/60">Me</p>
        <div className="mt-3 border-y border-ink/10 py-3">
          <FaceTaggingRow on open faceMode="mode_a" wish turnOff={async () => {}} />
        </div>
        {state === 'done' ? <FaceStepSavedToast /> : null}
      </main>
    );
  }

  const toast =
    state === 'unread' ? (
      <FaceStepFailureToast failure={faceStepFailureWords('face_unread')} onRetry={noop} />
    ) : state === 'two' ? (
      <FaceStepFailureToast failure="more than one face" onRetry={noop} />
    ) : null;

  return (
    <div className="min-h-[100dvh] bg-cream">
      <Capture faceMode="mode_a" onShot={noop} onFail={noop} onClose={noop} saving={state === 'saving'} toast={toast} />
    </div>
  );
}
