/**
 * 🪪 THE REPLY'S YOU STEP — the "Wrong name? Tell the couple" words and rule, and the decline arm's contact boxes, shared by the reply's sheet
 * (`app/[slug]/_components/rsvp-name-correction.tsx`) and the save (`submitRsvp`). Pure: a client component and a
 * server action both import it.
 *
 * Owner 2026-10-25 (RSVP seats-first, decision 1 "all as recommended"): the door ALWAYS works, even when the event's
 * "A note to the couple" question is off, and it writes only `guests.guest_note` — the note the couple already reads
 * on the guest's row. 🔒 Names stay host-only (2026-08-01): nothing here touches `first_name` / `last_name`.
 */

/** The field the reply posts. */
export const NAME_CORRECTION_FIELD = 'name_correction';
/** The note line's lead — what the couple reads on the guest's row. */
export const NAME_CORRECTION_PREFIX = 'Name correction: ';
/** Long enough for any real name, short enough that the note stays a note. */
export const NAME_CORRECTION_MAX = 160;

/** The posted correction, trimmed and capped — `''` when none. */
export function readNameCorrection(raw: unknown): string {
  return typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, NAME_CORRECTION_MAX) : '';
}

/**
 * The note to write: the note as it would be written anyway (`base` — the guest's typed note when the question is
 * asked, else the stored one), with ONE "Name correction: …" line added at its end.
 *
 *   · no correction → `base`, untouched (the reply exactly as before);
 *   · the same line already in the note (a second Send) → `base`, never twice;
 *   · `base` UNDEFINED — the question is off and the stored note could not be read — stays undefined: the write
 *     leaves the stored note alone rather than replace it with this one line (the same rule the off-question
 *     fields keep in `submitRsvp`).
 */
export function withNameCorrection(base: string | null | undefined, correction: string): string | null | undefined {
  if (!correction || base === undefined) return base;
  const line = `${NAME_CORRECTION_PREFIX}${correction}`;
  const note = (base ?? '').trim();
  if (note.split('\n').some((l) => l.trim() === line)) return base;
  return note ? `${note}\n${line}` : line;
}

/**
 * 🪑 THE DECLINE ARM'S CONTACT BOXES (owner 2026-10-25, RSVP seats-first). On a Yes the reply asks nickname and mobile
 * in its early You step (`contact_display_name` · `contact_mobile`); on a No it asks them where it always did, after
 * the note (decision 3, "Decline path unchanged") — the same two boxes posted under these names, because both arms
 * are in the one form and only the card's CSS shows one.
 */
export const DECLINED_CONTACT_FIELDS = {
  contact_mobile: 'declined_contact_mobile',
  contact_display_name: 'declined_contact_display_name',
} as const;

/**
 * A No reads its OWN boxes: when the answer is `declined` and the decline arm was posted, its values take the You
 * step's names before `submitRsvp` reads them — so the save itself is unchanged, and a box that was not drawn
 * (mobile, when the couple does not ask it) is removed rather than left holding the hidden You step's copy. Any
 * other answer (or a form without the arm — the key gate's form, an old page) is left exactly as posted.
 */
export function adoptDeclinedContactArm(form: FormData, status: string): void {
  if (status !== 'declined' || !form.has(DECLINED_CONTACT_FIELDS.contact_display_name)) return;
  for (const [own, declined] of Object.entries(DECLINED_CONTACT_FIELDS)) {
    const value = form.get(declined);
    if (value === null) form.delete(own);
    else form.set(own, value);
  }
}
