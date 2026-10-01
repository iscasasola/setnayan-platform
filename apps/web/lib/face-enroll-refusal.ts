/**
 * face-enroll-refusal.ts — THE FACE SCREEN'S WORDS, AND WHY A SELFIE DID NOT SAVE.
 *
 * ⚖ Owner 2026-09-30, after a real guest ticked, took her selfie and nothing
 * was saved: a failure must never look like success, and the words stay short
 * (*"too many texts again"*). The approved design
 * (`prototypes/face_registration_2026-09-30_fable.html`, frame E) names the
 * reason in a few words — *no face found · too dark · connection lost · more
 * than one face* — inside "Couldn't save — … Try again". `enrollGuestFace`
 * returns a CODE; this is the one place a code becomes words. Pure and tiny —
 * the face screen is a client component and imports only this.
 */

export type FaceStepFailure =
  | 'no_face'
  | 'many_faces'
  | 'too_dark'
  | 'upload'
  | 'camera'
  | 'session'
  | 'consent'
  | 'not_on'
  | 'not_wanted'
  | 'excluded'
  | 'minor'
  | 'bad_photo'
  | 'save';

const WORDS: Record<FaceStepFailure, string> = {
  no_face: 'no face found',
  many_faces: 'more than one face',
  too_dark: 'too dark',
  upload: 'connection lost',
  camera: 'camera blocked',
  session: 'open your invitation link again',
  consent: 'tick the box first',
  not_on: 'face tagging is off here',
  not_wanted: 'connection lost',
  excluded: 'your hosts turned this off for you',
  minor: 'for guests 18 and over',
  bad_photo: 'that photo didn’t upload',
  save: 'connection lost',
};

/** The few words for a failure code; anything unknown reads as "connection lost". */
export function faceStepFailureWords(code: string | null | undefined): string {
  return WORDS[(code ?? 'save') as FaceStepFailure] ?? WORDS.save;
}

/** The whole failure toast line (frame E). */
export function faceStepFailureLine(code: string | null | undefined): string {
  return `Couldn’t save — ${faceStepFailureWords(code)}.`;
}

/** The success toast (frame D). */
export const FACE_STEP_SAVED = 'You’re set — erased when you sign out or Papic closes.';
/** The screen (frames A/B). */
export const FACE_STEP_TITLE = 'Find you in photos?';
export const FACE_STEP_SUB = 'Papic tags you whenever you’re in a photo.';
export const FACE_STEP_TICK = 'I’m 18+ and agree to face tagging';
export const FACE_STEP_TICK_HINT = 'Tick to continue';
