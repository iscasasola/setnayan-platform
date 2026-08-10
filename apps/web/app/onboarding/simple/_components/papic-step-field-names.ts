/**
 * The three form-field names the `/onboarding/simple` Papic picker posts.
 *
 * Their own module, carrying NEITHER 'use client' NOR 'use server', because both
 * sides of the boundary need them: `papic-step-fields.tsx` (a client component)
 * renders the hidden inputs, and `actions.ts` (a server action module) reads
 * them back off the FormData. Importing a constant across that boundary in
 * either direction is the kind of thing that works until a bundler or a lint
 * rule decides it should not — a plain shared module has no such question.
 *
 * 🔑 They are shared as CONSTANTS and not typed twice on purpose. A form field
 * whose name is spelled in two places is a field that silently stops posting the
 * day one of them is edited: the input still renders, the action still runs, and
 * `formData.get()` simply returns null. Nothing errors — the couple's pick just
 * quietly evaporates. Same shape as every other "the query was declined and the
 * only symptom is an absence" bug on this codebase's board.
 */

export const PAPIC_FIELD_POOL_RUNG = 'papic_pool_rung';
export const PAPIC_FIELD_ONE_RUNG = 'papic_one_rung';
export const PAPIC_FIELD_ONE_CAMERAS = 'papic_one_cameras';
/**
 * Setnayan AI's yes/no. Posted as the STRING 'true' or 'false' — never as a
 * bare checkbox, whose unchecked state posts NOTHING at all and would be
 * indistinguishable from the field having been renamed away.
 */
export const AI_FIELD_SELECTED = 'setnayan_ai_selected';
