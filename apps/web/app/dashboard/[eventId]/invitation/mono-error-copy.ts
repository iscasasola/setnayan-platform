/** The invitation page's monogram-colour refusal (`?mono_error=`) — drawn by the page, and said on the row by the in-place
 *  save (`app/_actions/stay-registry/invitation.ts`). */
export const MONO_ERROR_COPY: Record<string, string> = {
  invalid_color: 'That colour didn’t work. Pick another one.',
  // I-04 (final check): a refused or zero-row save used to land as "saved".
  not_saved: "Couldn't save your logo. Nothing changed — try again.",
};
