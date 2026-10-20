/**
 * guest-card-change-words.ts — what a guest-card save changed, in the words a host uses (the Undo snackbar's
 * "Meal changed"). Moved out of `guest-card-autosave.tsx` (2026-10-18) so it loads the first time a save LANDS, never
 * on the Maker's first load — the same code, the same words.
 */
import { fieldsOf } from './guest-card-autosave';

/** What a host calls these, for the snackbar. A name missing here is still
 *  undoable; it just counts toward "N fields" instead of being named.
 *
 *  ⚠ THE NAME `*_LABELS` AND THE TYPE `Record<string, string>` ARE BOTH
 *  LOAD-BEARING FOR A GUARD IN ANOTHER FILE. `tests/db/enum-literals-are-real.db.test.ts`
 *  scans every source for `<column>: '<value>'` and would read `rsvp_status: 'RSVP'`
 *  below as a write of an illegal enum value. It skips maps declared exactly this
 *  way. Rename this to `FIELD_TITLES`, or drop the annotation, and that guard goes
 *  red on correct code — 35 minutes into CI, because it runs in the DB-replay step.
 *  This is a DISPLAY map and never a write payload; if it ever becomes one, the
 *  guard's WRITE_CALL assertion will say so. */
const FIELD_LABELS: Record<string, string> = {
  rsvp_status: 'RSVP',
  meal_preference: 'Meal',
  dietary_restrictions: 'Dietary',
  plus_one_count: 'Extra seats',
  side: 'Side',
  group_category: 'Group',
  role: 'Role',
  attire: 'Attire',
  photo_consent: 'Photo consent',
  faceblock_enabled: 'Live Wall blur',
  face_recognition_excluded: 'Face recognition',
  notes: 'Private note',
  host_note_for_guest: 'Note for them',
  email: 'Email',
  mobile: 'Mobile',
  first_name: 'Name',
  last_name: 'Name',
  middle_name: 'Name',
  name_prefix: 'Name',
  name_suffix: 'Name',
  display_name: 'Display name',
  seniority_rank: 'Tea-ceremony order',
  extra_roles: 'Role',
  group_ids: 'Group',
  table_id: 'Table',
  passed_away: 'Passed away',
};

/** What changed between two posts, named the way a host would name it. */
export function describeChange(prev: FormData, next: FormData): string | null {
  const a = fieldsOf(prev);
  const b = fieldsOf(next);
  const changed = new Set<string>();
  for (const k of new Set([...a.keys(), ...b.keys()])) {
    if ((a.get(k) ?? '') !== (b.get(k) ?? '')) changed.add(k);
  }
  if (changed.size === 0) return null;

  const named = new Set<string>();
  for (const k of changed) {
    // Invited-to is five inputs; a host thinks of it as one thing.
    named.add(k.startsWith('invited_') ? 'Invited to' : (FIELD_LABELS[k] ?? ''));
  }
  named.delete('');
  const labels = [...named];
  if (labels.length === 1) return `${labels[0]} changed`;
  if (labels.length === 2) return `${labels[0]} and ${labels[1]} changed`;
  return `${changed.size} fields changed`;
}

