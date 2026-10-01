/**
 * "WANT TO BE TAGGED IN THE PHOTOS?" — the one question in front of the selfie.
 *
 * ⚖ Owner 2026-09-29, verbatim, about the RSVP's "Take a selfie" step (it was
 * shown to every attending guest):
 *   *"registry of face tagging starts when papic service is running. if not
 *   running then this is not needed?"* →
 *   *"only if the want tagging service. if the do not click tagging service.
 *   no selfie needed"* →
 *   *"it should only depend if they want to be tagged"*.
 *
 * THE RULE: the selfie is asked ONLY of a guest who says they want to be
 * tagged. One plain question first — "Yes, tag me" / "No thanks" — and the
 * selfie appears only after Yes. No → nothing else is asked, and the day-of
 * catch does not ask again. Nobody is ever shown the selfie without choosing it.
 *
 * Stored on `guests.face_tagging_wanted` (NULL never answered · TRUE yes ·
 * FALSE no thanks). ⚠ It governs only WHETHER we ask — it is NOT consent: the
 * selfie's own two ticks (biometric consent + 18+) still gate every enrolment.
 *
 * Pure and isomorphic: the RSVP card (server), the day-of catch (client) and
 * both actions read the same words and the same parse.
 */

/** The RSVP form field carrying the answer. */
export const FACE_TAGGING_FIELD = 'face_tagging';

/** The question, once, so the RSVP card and the day-of catch cannot drift. */
export const FACE_TAGGING_QUESTION = 'Want to be tagged in the photos?';
export const FACE_TAGGING_YES = 'Yes, tag me';
export const FACE_TAGGING_NO = 'No thanks';

/**
 * The one line under the question: what "Yes" costs, in the event's own words.
 * It follows the face mode, like the consent box it leads to (2026-08-05): only
 * a mode_a event finds photos by face; everywhere else the selfie lets people
 * recognise and tag the guest by hand.
 */
export function faceTaggingHint(faceMode: 'mode_a' | 'mode_b', theOrganizer: string, opts: { onTheDay?: boolean } = {}): string {
  // The invitation asks the question only; the selfie waits for the day (owner 2026-09-30).
  const when = opts.onTheDay ? ' on the day' : '';
  return faceMode === 'mode_a'
    ? `Yes means one quick selfie${when}, so your photos find you.`
    : `Yes means one quick selfie${when}, so ${theOrganizer} and their team can find and tag you.`;
}

/** `null` = never answered · `true` = yes · `false` = no thanks. */
export type FaceTaggingWish = boolean | null;

/**
 * The posted answer → what to store. `undefined` = the question was not on the
 * form (off, locked out, or the door) — leave whatever is stored alone.
 */
export function parseFaceTaggingAnswer(raw: FormDataEntryValue | null | undefined): boolean | undefined {
  if (raw === 'yes') return true;
  if (raw === 'no') return false;
  return undefined;
}

/**
 * Does the day-of catch (the face step in the guest camera) appear at all?
 *
 *   · the couple declined face tagging for their event → never (their "no" is
 *     the last word, `resolveFaceTagging`) ·
 *   · the guest already has a live selfie → no, nothing to catch ·
 *   · the guest said "No thanks" → no — a guest who said no is not nagged ·
 *   · never answered, or said yes without finishing → yes. Never-answered is
 *     asked the SAME one question first (`DayOfFaceEnroll`), never shown the
 *     selfie straight away.
 */
export function dayOfFaceCatchShows(input: {
  askable: boolean;
  enrolled: boolean;
  wish: FaceTaggingWish | undefined;
}): boolean {
  if (!input.askable) return false;
  if (input.enrolled) return false;
  return input.wish !== false;
}

/**
 * 🗑 "NO THANKS" AFTER A SELFIE (owner 2026-09-29, DECISION_LOG "OWNER ANSWERS —
 * TEN OPEN QUESTIONS" (3): *"Selfie: yes"* — a guest who picks "No thanks" after
 * giving a selfie → one confirm → their selfie and automatic face tags are
 * deleted, through the same erasure as the "Delete my face data" button).
 * The confirm posts this field as `1`; without it a "No" never deletes.
 */
export const SELFIE_DELETE_FIELD = 'delete_selfie';

/**
 * 📵 THE INVITATION TAKES NO FACE (owner 2026-09-30, "go" — DECISION_LOG "THE
 * TAGGING QUESTION AT RSVP, THE SELFIE ON THE DAY"). The reply page asks "Want
 * to be tagged in the photos?" and saves the answer; the selfie itself is taken
 * ON THE DAY, only from a guest who said Yes (`dayOfFaceCatchShows`), keeping
 * the 2026-09-11 rule "face tagging happens on the day, not on the invite".
 *
 * The page draws no camera, and the invite's save strips every face field a
 * crafted post could carry — the photo reference(s), the quality and the
 * vector(s), and the two consent ticks — so none can reach `submitRsvp`.
 * The answer itself (`face_tagging`) and "No thanks — delete my selfie"
 * (`delete_selfie`, which only ever REMOVES face data) pass through.
 */
export const INVITE_REFUSED_FACE_FIELDS = [
  'selfie_ref',
  'selfie_refs',
  'selfie_quality',
  'selfie_qualities',
  'selfie_vector',
  'selfie_vectors',
  'biometric_consent',
  'age_affirmation',
] as const;

/** Remove every face field from an invitation's reply (see `INVITE_REFUSED_FACE_FIELDS`). */
export function stripInviteFaceFields(formData: FormData): void {
  for (const k of INVITE_REFUSED_FACE_FIELDS) formData.delete(k);
  for (const k of [...formData.keys()]) if (k.startsWith('selfie_')) formData.delete(k);
}
export const SELFIE_DELETE_CONFIRM = {
  title: 'Delete your selfie?',
  body: 'Your selfie and the photos we tagged you in automatically are removed. You can still find yourself in the album by hand.',
  yes: 'Yes, delete my selfie',
  keep: 'Keep it — tag me',
} as const;
