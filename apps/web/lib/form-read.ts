/**
 * 🧾 A FORM DRAWN FROM A READ THAT ANSWERED — final check A2-C7 / A2-A7 (25 Nov 2026).
 *
 * A form whose boxes are filled from a read (Profile's personal info, sign-up's "You" card) carries
 * `<input type="hidden" name={FORM_READ_FIELD} value="1" />`, drawn ONLY when that read answered. The save refuses a
 * submit without it: a form opened while the read was refused would post blanks, and the save would write them over
 * the person's real details. The page already stops at the refusal; this is the action's own half, so an old tab or a
 * hand-made post cannot do it either.
 */
export const FORM_READ_FIELD = 'form_read';

export const FORM_READ_REFUSAL = 'This form opened while your details could not be read. Reload and try again — nothing was changed.';

/** The refusal's words when the form was not drawn from an answered read; `null` when it may save. */
export function formReadRefusal(fd: Pick<FormData, 'get'>): string | null {
  return fd.get(FORM_READ_FIELD) === '1' ? null : FORM_READ_REFUSAL;
}
