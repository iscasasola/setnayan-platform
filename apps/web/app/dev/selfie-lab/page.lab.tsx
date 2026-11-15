/**
 * /dev/selfie-lab — the REAL face-registration screen (`SelfieCapture`), its saved / refused toasts
 * (`FaceStepSavedToast` · `FaceStepFailureToast`) and Me › Face tagging (`FaceTaggingRow`), on fixture props, with no
 * sign-in and no database. DEV-ONLY: production builds 404 this route. The camera is the page's own stream (a walk
 * draws a stand-in into it); nothing here saves a selfie.
 *
 *   ?state=open     the screen as it opens — before the tick (the face models load in the background)
 *   ?state=live     the same; the walk ticks the box and the stand-in feed fills the oval
 *   ?state=saving   "registering…" — the parent is saving (the button waits)
 *   ?state=done     the save landed: the screen has gone, the toast says so
 *   ?state=unread   the refusal: "Couldn't save — your face wasn't clear. Try again"
 *   ?state=two      the refusal: "Couldn't save — more than one face. Try again"
 *   ?state=row      Me › Face tagging: On (tap → Retake selfie · Turn off)
 */
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { SelfieLab } from './selfie-lab';

export default function SelfieLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <Suspense>
      <SelfieLab />
    </Suspense>
  );
}
